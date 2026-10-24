import { readFileSync } from 'node:fs';
import type { Writable } from 'node:stream';
import { parseEnv } from 'node:util';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor, LoggerProvider, type LogRecordExporter } from '@opentelemetry/sdk-logs';
import { SystemLogger } from '../../../src/logs/system/system-logger.ts';
import { OtelSystemLogSink } from '../../../src/logs/system/otel-system-log-sink.ts';
import { systemErrorName } from '../../../src/pipelines/providers/website-fetcher/website-fetcher.ts';

function loadLocalSettings(): NodeJS.ProcessEnv {
  try {
    return parseEnv(readFileSync('.env.local', 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  }
}

function axiomLogEndpoint(value: string | undefined): string {
  let endpoint: URL;
  try {
    endpoint = new URL('/v1/logs', value ?? '');
  } catch {
    throw new Error('Set AXOIM_ENDPOINT_URL to an HTTPS Axiom ingestion endpoint.');
  }
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.edge.axiom.co') || endpoint.username || endpoint.password || endpoint.port) {
    throw new Error('AXOIM_ENDPOINT_URL must be an HTTPS Axiom ingestion endpoint.');
  }
  return endpoint.href;
}

interface AxiomTestSettings {
  readonly apiKey: string;
  readonly endpoint: string;
  readonly dataset: string;
}

export function axiomTestSettings(environment: NodeJS.ProcessEnv = process.env): AxiomTestSettings {
  if (environment === process.env) environment = { ...loadLocalSettings(), ...environment };
  const apiKey = environment.AXIOM_API_KEY?.trim();
  if (!apiKey) throw new Error('Set AXIOM_API_KEY before running the Axiom logger tests.');
  const endpoint = axiomLogEndpoint(environment.AXOIM_ENDPOINT_URL);
  const dataset = environment.AXIOM_SYSTEM_LOG_TEST_DATA_SET?.trim() || 'system-log-test';
  if (dataset !== 'system-log-test') throw new Error('AXIOM_SYSTEM_LOG_TEST_DATA_SET must be system-log-test.');
  return { apiKey, endpoint, dataset };
}

// Axiom reads the ingest token from the bearer header and the dataset from a different header.
export function axiomExportHeaders({ apiKey, dataset }: AxiomTestSettings): Record<string, string> {
  return { Authorization: `Bearer ${apiKey}`, 'X-Axiom-Dataset': dataset };
}

export function trackTestExports(output: LogRecordExporter): {
  exporter: LogRecordExporter; assertSuccess(): void;
} {
  let started = 0;
  const codes: number[] = [];
  return {
    exporter: {
      export(records, complete) {
        started += 1;
        output.export(records, (result) => {
          codes.push(result.code);
          complete(result.code === 0 ? { code: result.code } : { code: result.code, error: new Error('Axiom rejected the test log export.') });
        });
      },
      forceFlush: () => output.forceFlush(),
      shutdown: () => output.shutdown(),
    },
    assertSuccess() {
      if (started === 0 || codes.length !== started) throw new Error('Axiom did not complete the test log export.');
      if (codes.some((code) => code !== 0)) throw new Error('Axiom rejected the test log export.');
    },
  };
}

export interface AxiomLogging {
  readonly logger: SystemLogger;
  // Sends the records that wait in the batch, then stops the export. It rejects when an export failed.
  close(): Promise<void>;
}

export function openAxiomLogging(settings: AxiomTestSettings, scopeName: string, console: Writable = process.stderr): AxiomLogging {
  const reported = reportFailedExports(new OTLPLogExporter({
    url: settings.endpoint,
    headers: axiomExportHeaders(settings),
    timeoutMillis: 10_000,
  }), console);
  const processor = new BatchLogRecordProcessor({ exporter: reported.exporter, scheduledDelayMillis: 1_000, exportTimeoutMillis: 10_000 });
  const provider = new LoggerProvider({ processors: [processor] });
  return {
    logger: new SystemLogger(new OtelSystemLogSink(provider.getLogger(scopeName))),
    close: async () => {
      await provider.shutdown();
      const failed = reported.failures();
      if (failed > 0) throw new Error(`Axiom refused or did not accept ${failed === 1 ? '1 log export' : `${failed} log exports`}. See the lines above.`);
    },
  };
}

// OTel 0.223 gives an export error only to its diagnostic logger, which is off. This line does not go through the
// OtelSystemLogSink, so it cannot loop back into OTel. It omits the error message and the body: they can repeat the request.
function reportFailedExports(output: LogRecordExporter, console: Writable): { exporter: LogRecordExporter; failures(): number } {
  let failures = 0;
  return {
    exporter: {
      export(records, complete) {
        output.export(records, (result) => {
          if (result.code !== 0) {
            failures += 1;
            console.write(`Axiom log export failed: ${failureOf(result.error)}.\n`);
          }
          complete(result);
        });
      },
      forceFlush: () => output.forceFlush(),
      shutdown: () => output.shutdown(),
    },
    failures: () => failures,
  };
}

// The OTLP exporter error holds the HTTP status in its numeric code. A connection error holds a system error name there.
function failureOf(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown error';
  const code = 'code' in error ? error.code : undefined;
  if (typeof code === 'number') return `${error.name} with HTTP ${code}`;
  const name = systemErrorName(code);
  return name === 'UNKNOWN' ? error.name : `${error.name} (${name})`;
}
