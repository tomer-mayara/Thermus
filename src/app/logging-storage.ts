import { AuditCollector } from '../logs/audit/audit-collector.ts';
import type { RevisionBoundAuditSink } from '../logs/audit/audit-snapshots.ts';
import type { TrackedAuditSender } from '../logs/audit/audit-send.ts';
import type { DestinationTestSender } from '../logs/audit/destination-test.ts';
import { OtlpAuditSender } from '../logs/audit/otlp-audit-sender.ts';
import { DestinationSettingsService } from '../logs/audit/destination-settings-service.ts';
import { loadLoggingStorageConfig } from '../runtime/config/logging-storage-config.ts';
import type { SystemLog } from '../logs/system/system-logger.ts';
import type { DestinationSettingsStore } from '../logs/audit/destination-settings-store.ts';

// Stores customer audit destination settings, not system log output or audit history.
export interface HostedLoggingStorage {
  readonly store: DestinationSettingsStore;
  readonly service?: DestinationSettingsService;
  readonly dispatch?: RevisionBoundAuditSink;
  close(): Promise<void>;
}

export async function openLoggingStorage(environment: Readonly<Record<string, string | undefined>>, logger: SystemLog): Promise<HostedLoggingStorage | undefined> {
  const config = await loadLoggingStorageConfig(environment);
  if (config.status === 'unavailable') {
    logger.error(`Logging storage is unavailable: ${config.issues.join(' ')}`);
    return undefined;
  }
  try {
    const { openDestinationSettingsRuntime } = await import('../logs/audit/pg-destination-settings-store.ts');
    const runtime = await openDestinationSettingsRuntime(config);
    return composeLoggingStorage(runtime, config.encryptionKey);
  } catch {
    logger.error('Logging storage is unavailable: DATABASE_URL and DATABASE_CA_CERT_PATH must permit a verified TLS connection.');
    return undefined;
  }
}

/** Test and customer export share the sender's native DNS, TLS, and HTTP admission. */
export function composeLoggingStorage(runtime: Pick<HostedLoggingStorage, 'store' | 'close'>, key: Uint8Array, sender: DestinationTestSender & TrackedAuditSender = new OtlpAuditSender()): HostedLoggingStorage {
  const service = new DestinationSettingsService(runtime.store, key, sender);
  const dispatch = new AuditCollector(service, sender);
  return { store: runtime.store, service, dispatch, close: () => { dispatch.close(); return runtime.close(); } };
}
