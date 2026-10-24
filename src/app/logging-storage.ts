import { loadLoggingStorageConfig } from '../runtime/config/logging-storage-config.ts';
import type { SystemLog } from '../logs/system/system-logger.ts';
import type { DestinationSettingsStore } from '../logs/audit/destination-settings-store.ts';

// Stores customer audit destination settings, not system log output or audit history.
export interface HostedLoggingStorage {
  readonly store: DestinationSettingsStore;
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
    return openDestinationSettingsRuntime(config);
  } catch {
    logger.error('Logging storage is unavailable: DATABASE_URL and DATABASE_CA_CERT_PATH must permit a verified TLS connection.');
    return undefined;
  }
}
