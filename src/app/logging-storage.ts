import { loadLoggingStorageConfig } from '../runtime/config/logging-storage-config.ts';
import type { ApplicationLogger } from './application.ts';
import type { DestinationSettingsStore } from '../logging/destination-settings-store.ts';

export interface HostedLoggingStorage {
  readonly store: DestinationSettingsStore;
  close(): Promise<void>;
}

export async function openLoggingStorage(environment: Readonly<Record<string, string | undefined>>, logger: ApplicationLogger): Promise<HostedLoggingStorage | undefined> {
  const config = await loadLoggingStorageConfig(environment);
  if (config.status === 'unavailable') {
    logger.error(`Logging storage is unavailable: ${config.issues.join(' ')}`);
    return undefined;
  }
  try {
    const { openDestinationSettingsRuntime } = await import('../logging/pg-destination-settings-store.ts');
    return openDestinationSettingsRuntime(config);
  } catch {
    logger.error('Logging storage is unavailable: DATABASE_URL and DATABASE_CA_CERT_PATH must permit a verified TLS connection.');
    return undefined;
  }
}
