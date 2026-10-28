import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import type { TestContext } from 'node:test';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { axiomExportHeaders, axiomTestSettings, trackTestExports } from '../../in-process/axiom-test-export.ts';

interface ReceivedLogExport {
  readonly method: string | undefined;
  readonly path: string | undefined;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
  // performance.now() of the test process when the whole body arrived.
  readonly receivedAt: number;
}

interface ExportedLogRecord {
  readonly severityNumber: number;
  readonly severityText: string;
  readonly timeUnixNano: string;
  readonly body: { readonly stringValue: string };
}

interface ExportedAttribute {
  readonly key: string;
  readonly value: { readonly stringValue?: string };
}

interface ExportBody {
  readonly resourceLogs: readonly {
    readonly resource?: { readonly attributes?: readonly ExportedAttribute[] };
    readonly scopeLogs: readonly { readonly logRecords: readonly ExportedLogRecord[] }[];
  }[];
}

export interface LogReceiverOptions {
  // The status of each answer.
  readonly status?: number;
  // A TLS key and certificate in PEM: the receiver then serves https.
  readonly tls?: { readonly key: Buffer; readonly cert: Buffer };
  // false: the receiver reads each request and never answers, as an endpoint that hangs.
  readonly answers?: boolean;
  // The receiver answers each request only after this promise settles, so that an export stays in flight.
  readonly answerAfter?: Promise<unknown>;
}

export interface LogReceiver {
  readonly endpoint: string;
  readonly port: number;
  readonly requests: ReceivedLogExport[];
  close(): Promise<void>;
}

// The OTLP/HTTP JSON body of the SDK exporter: the log records of each resource and scope.
export function logRecordsOf(request: ReceivedLogExport): ExportedLogRecord[] {
  const body: ExportBody = JSON.parse(request.body);
  return body.resourceLogs.flatMap((resource) => {
    return resource.scopeLogs.flatMap((scope) => scope.logRecords);
  });
}

// The string attributes of each resource of the request, one record for each resource.
export function resourceAttributesOf(request: ReceivedLogExport): Record<string, string | undefined>[] {
  const body: ExportBody = JSON.parse(request.body);
  return body.resourceLogs.map(({ resource }) => Object.fromEntries((resource?.attributes ?? []).map(({ key, value }) => [key, value.stringValue])));
}

export async function startLogReceiver(options: LogReceiverOptions = {}): Promise<LogReceiver> {
  const requests: ReceivedLogExport[] = [];
  const listener = async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push({
      method: request.method,
      path: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks).toString('utf8'),
      receivedAt: performance.now(),
    });
    if (options.answers === false) return;
    await options.answerAfter;
    response.writeHead(options.status ?? 200, { 'Content-Type': 'application/json' });
    response.end('{}');
  };
  const server = options.tls === undefined ? createServer(listener) : createHttpsServer(options.tls, listener);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  return {
    endpoint: `${options.tls === undefined ? 'http' : 'https'}://127.0.0.1:${port}/v1/logs`,
    port,
    requests,
    async close() {
      const closed = once(server, 'close');
      server.close();
      server.closeAllConnections();
      await closed;
    },
  };
}

// An https endpoint on a loopback port where no server listens, so that the system refuses each connection.
export async function refusedLogEndpoint(): Promise<{ readonly endpoint: string; readonly port: number }> {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  const closed = once(server, 'close');
  server.close();
  await closed;
  return { endpoint: `https://127.0.0.1:${port}/v1/logs`, port };
}

export async function createOtlpFixture(t: TestContext, headers?: Record<string, string>): Promise<{
  readonly provider: LoggerProvider;
  readonly requests: ReceivedLogExport[];
  readonly scopeName: string;
  flush(): Promise<void>;
}> {
  const settings = axiomTestSettings();
  const scopeName = `thermus-otel-test-${randomUUID()}`;
  const receiver = await startLogReceiver();
  let exporter: OTLPLogExporter | undefined;
  let liveOutput: OTLPLogExporter | undefined;
  try {
    exporter = new OTLPLogExporter({ url: receiver.endpoint, headers, timeoutMillis: 2_000 });
    const processor = new BatchLogRecordProcessor({ exporter, scheduledDelayMillis: 60_000, exportTimeoutMillis: 2_000 });
    liveOutput = new OTLPLogExporter({
      url: settings.endpoint,
      headers: axiomExportHeaders(settings),
      timeoutMillis: 5_000,
    });
    const live = trackTestExports(liveOutput);
    const liveProcessor = new BatchLogRecordProcessor({ exporter: live.exporter, scheduledDelayMillis: 60_000, exportTimeoutMillis: 6_000 });
    const provider = new LoggerProvider({ processors: [processor, liveProcessor] });
    t.after(async () => {
      try {
        await provider.shutdown();
      } finally {
        await receiver.close();
      }
    });
    return {
      provider, requests: receiver.requests, scopeName,
      async flush() {
        try {
          await provider.forceFlush({ timeoutMillis: 7_000 });
        } catch {
          throw new Error('The test log export did not flush in time.');
        }
        live.assertSuccess();
        t.diagnostic(`Axiom system-log-test scope: ${scopeName}`);
      },
    };
  } catch (error) {
    try {
      await Promise.all([exporter?.shutdown(), liveOutput?.shutdown()]);
    } finally {
      await receiver.close();
    }
    throw error;
  }
}
