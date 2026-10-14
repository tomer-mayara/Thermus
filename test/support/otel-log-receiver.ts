import { createServer, type IncomingHttpHeaders } from 'node:http';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { TestContext } from 'node:test';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor, LoggerProvider } from '@opentelemetry/sdk-logs';
import { axiomTestSettings, trackTestExports } from './axiom-test-export.ts';

export interface ReceivedLogExport {
  readonly method: string | undefined;
  readonly path: string | undefined;
  readonly headers: IncomingHttpHeaders;
  readonly body: string;
}

export interface ExportedLogRecord {
  readonly severityNumber: number;
  readonly severityText: string;
  readonly timeUnixNano: string;
  readonly body: { readonly stringValue: string };
}

export function logRecordsOf(request: ReceivedLogExport): ExportedLogRecord[] {
  const body: {
    resourceLogs: { scopeLogs: { logRecords: ExportedLogRecord[] }[] }[];
  } = JSON.parse(request.body);
  return body.resourceLogs.flatMap((resource) => {
    return resource.scopeLogs.flatMap((scope) => scope.logRecords);
  });
}

async function startLogReceiver(): Promise<{
  readonly endpoint: string;
  readonly requests: ReceivedLogExport[];
  close(): Promise<void>;
}> {
  const requests: ReceivedLogExport[] = [];
  const server = createServer(async (request, response) => {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    requests.push({
      method: request.method,
      path: request.url,
      headers: request.headers,
      body: Buffer.concat(chunks).toString('utf8'),
    });
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end('{}');
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('The log receiver needs a TCP port.');
  return {
    endpoint: `http://127.0.0.1:${address.port}/v1/logs`,
    requests,
    async close() {
      const closed = once(server, 'close');
      server.close();
      server.closeAllConnections();
      await closed;
    },
  };
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
      headers: { Authorization: `Bearer ${settings.apiKey}`, 'X-Axiom-Dataset': settings.dataset },
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
