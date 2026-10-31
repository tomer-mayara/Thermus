import type { LogRecordExporter } from '@opentelemetry/sdk-logs';
import { loadDeploymentConfig } from '../runtime/config/deployment-config.ts';
import { loadSystemLogExportSettings, type SystemLogExportSettings } from '../runtime/config/system-log-export-config.ts';
import type { SystemLogExport, SystemLogOutput } from './system-log-output.ts';

type Environment = Readonly<Record<string, string | undefined>>;
type FailureReport = (failure: unknown) => void;

// The bounds of SO-11a. A full queue drops the newest record. One export, with the retries of the exporter, ends
// within 4 s; the timeout of the processor is a backstop after it. A failed export drops its records, because there is
// no queue on disk.
const BATCH = { maxQueueSize: 2_048, maxExportBatchSize: 512, scheduledDelayMillis: 2_000, exportTimeoutMillis: 5_000 } as const;
const EXPORT_TIMEOUT_MS = 4_000;
// ExportResultCode.SUCCESS of @opentelemetry/core.
const EXPORT_SUCCESS = 0;

/**
 * Starts the export when the hosted control plane has the export settings. A tenant refuses the token, and the
 * self-hosted edition writes to standard error only. Invalid settings stop the start.
 */
export async function startSystemLogExport(environment: Environment, output: SystemLogOutput): Promise<void> {
  const settings = controlPlaneExportSettingsOf(environment);
  if (settings !== undefined) output.startExport(await openSystemLogExport(settings, output.reportExportFailure.bind(output)));
}

function controlPlaneExportSettingsOf(environment: Environment): SystemLogExportSettings | undefined {
  const config = loadDeploymentConfig(environment, 'http');
  const controlPlane = config.deployment === 'hosted' && config.role === 'control-plane';
  return controlPlane ? loadSystemLogExportSettings(environment) : undefined;
}

/**
 * The OpenTelemetry SDK in front of the OTLP/HTTP JSON exporter. It loads only when the export starts. The audit
 * sender of src/logs/audit/ stays separate: this path carries only the system log.
 */
export async function openSystemLogExport(settings: SystemLogExportSettings, reportFailure: FailureReport): Promise<SystemLogExport> {
  const { OTLPLogExporter } = await import('@opentelemetry/exporter-logs-otlp-http');
  const { BatchLogRecordProcessor, LoggerProvider } = await import('@opentelemetry/sdk-logs');
  const { resourceFromAttributes } = await import('@opentelemetry/resources');
  const { OtelSystemLogSink } = await import('../logs/system/otel-system-log-sink.ts');
  const exporter = new OTLPLogExporter({ url: settings.endpoint, headers: exportHeadersOf(settings), timeoutMillis: EXPORT_TIMEOUT_MS });
  const processor = new BatchLogRecordProcessor({ ...BATCH, exporter: reportingFailures(exporter, reportFailure) });
  const provider = new LoggerProvider({ resource: resourceFromAttributes(resourceAttributesOf(settings)), processors: [processor] });
  return { sink: new OtelSystemLogSink(provider.getLogger('thermus-system-log')), close: provider.shutdown.bind(provider) };
}

/** The resource of each record: the service, and the instance when Render names it. */
export function resourceAttributesOf({ instanceId }: SystemLogExportSettings): Record<string, string> {
  const service = { 'service.name': 'thermus-control-plane' };
  return instanceId === undefined ? service : { ...service, 'service.instance.id': instanceId };
}

/** Axiom reads the ingest token from the bearer header and the dataset from X-Axiom-Dataset. */
export function exportHeadersOf({ token, dataset }: SystemLogExportSettings): Record<string, string> {
  const authorization = { Authorization: `Bearer ${token}` };
  return dataset === undefined ? authorization : { ...authorization, 'X-Axiom-Dataset': dataset };
}

// The exporter gives each failed export, after its bounded retries, to the report, and the batch is dropped. The
// batch ends first, so that a failed report cannot hold the processor.
export function reportingFailures(exporter: LogRecordExporter, reportFailure: FailureReport): LogRecordExporter {
  return {
    export: (records, done) => exporter.export(records, (result) => {
      done(result);
      if (result.code !== EXPORT_SUCCESS) reportFailure(result.error);
    }),
    forceFlush: () => exporter.forceFlush(),
    shutdown: () => exporter.shutdown(),
  };
}
