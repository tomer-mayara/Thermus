import { SeverityNumber, type Logger } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { BatchLogRecordProcessor, LoggerProvider, type LogRecordExporter } from '@opentelemetry/sdk-logs';
import type { Writable } from 'node:stream';
import { BaseLogger, LogLevel } from '../../../src/logging/base-logger.ts';
import { systemErrorName } from '../../../src/website-fetcher/website-fetcher.ts';

// The map of src/logging/otel-logger.ts, which keeps its copy private. DRY3 allows this second copy.
const severity: Record<LogLevel, SeverityNumber> = {
  [LogLevel.DEBUG]: SeverityNumber.DEBUG,
  [LogLevel.INFO]: SeverityNumber.INFO,
  [LogLevel.WARNING]: SeverityNumber.WARN,
  [LogLevel.ERROR]: SeverityNumber.ERROR,
  [LogLevel.FATAL]: SeverityNumber.FATAL,
  [LogLevel.NONE]: SeverityNumber.UNSPECIFIED,
};

// A subclass, because BaseLogger finds the call site before it calls write(). A wrapper shows itself as the call site.
export class WorkSliceLogger extends BaseLogger {
  public constructor(
    private readonly output: Pick<Logger, 'emit'>,
    private readonly console: Writable = process.stderr,
    level: LogLevel = LogLevel.INFO,
  ) {
    super(level);
  }

  protected override write(level: LogLevel, time: string, message: string): void {
    this.console.write(`[${time}] ${LogLevel[level]} ${message}\n`);
    this.output.emit({ severityNumber: severity[level], severityText: LogLevel[level], body: message });
  }
}

export interface AxiomLogSettings {
  readonly apiKey: string;
  readonly endpoint: string;
  readonly dataset: string;
}

export interface AxiomLogging {
  readonly logger: WorkSliceLogger;
  // Sends the records that wait in the batch, then stops the export. It rejects when an export failed.
  close(): Promise<void>;
}

export function openAxiomLogging(settings: AxiomLogSettings, scopeName: string, console: Writable = process.stderr): AxiomLogging {
  const reported = reportFailedExports(new OTLPLogExporter({
    url: settings.endpoint,
    headers: { Authorization: `Bearer ${settings.apiKey}`, 'X-Axiom-Dataset': settings.dataset },
    timeoutMillis: 10_000,
  }), console);
  const processor = new BatchLogRecordProcessor({ exporter: reported.exporter, scheduledDelayMillis: 1_000, exportTimeoutMillis: 10_000 });
  const provider = new LoggerProvider({ processors: [processor] });
  return {
    logger: new WorkSliceLogger(provider.getLogger(scopeName), console),
    close: async () => {
      await provider.shutdown();
      const failed = reported.failures();
      if (failed > 0) throw new Error(`Axiom refused or did not accept ${failed === 1 ? '1 log export' : `${failed} log exports`}. See the lines above.`);
    },
  };
}

// OTel 0.223 gives an export error only to its diagnostic logger, which is off. This line does not go through the
// WorkSliceLogger, so it cannot loop back into OTel. It omits the error message and the body: they can repeat the request.
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
