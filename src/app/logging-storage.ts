import { AuditCollector } from '../logs/audit/audit-collector.ts';
import type { RevisionBoundAuditSink } from '../logs/audit/audit-snapshots.ts';
import type { TrackedAuditSender } from '../logs/audit/audit-send.ts';
import type { DestinationTestSender } from '../logs/audit/destination-test.ts';
import { OtlpAuditSender } from '../logs/audit/otlp-audit-sender.ts';
import { DestinationSettingsService } from '../logs/audit/destination-settings-service.ts';
import { loadLoggingStorageConfig } from '../runtime/config/logging-storage-config.ts';
import type { SystemLog } from '../logs/system/system-logger.ts';
import type { DestinationSettingsStore } from '../logs/audit/destination-settings-store.ts';
import type { RemovalOperationStore } from '../accounts/organizations/removal-operation-store.ts';
import type { BoundedSqlRuntime } from '../runtime/sql/bounded-sql-runtime.ts';
import { PgTenantRegistryStore } from '../tenancy/tenants/pg-tenant-registry-store.ts';
import { TenantLookup } from '../tenancy/tenants/tenant-lookup.ts';
import { TenantRequests } from '../tenancy/tenants/tenant-requests.ts';

// One private SQL runtime owns destination settings, membership-removal intent, and the tenant registry.
export interface HostedLoggingStorage {
  readonly store: DestinationSettingsStore;
  readonly removalStore?: RemovalOperationStore;
  readonly tenants?: { readonly requests: TenantRequests; readonly lookup: TenantLookup };
  readonly service?: DestinationSettingsService;
  readonly dispatch?: RevisionBoundAuditSink;
  close(): Promise<void>;
}

export async function openLoggingStorage(environment: Readonly<Record<string, string | undefined>>, logger: SystemLog, freeTenantLimit: number): Promise<HostedLoggingStorage | undefined> {
  const config = await loadLoggingStorageConfig(environment);
  if (config.status === 'unavailable') {
    logger.error(`Logging storage is unavailable: ${config.issues.join(' ')}`);
    return undefined;
  }
  try {
    const { createPgSettingsRuntime } = await import('../runtime/sql/bounded-sql-runtime.ts');
    const { PgDestinationSettingsStore } = await import('../logs/audit/pg-destination-settings-store.ts');
    const runtime = createPgSettingsRuntime(config);
    const store = new PgDestinationSettingsStore(runtime);
    return composeLoggingStorage({ store, removalStore: store, tenants: tenantRegistry(runtime, freeTenantLimit), close: () => runtime.close() }, config.encryptionKey);
  } catch {
    logger.error('Logging storage is unavailable: DATABASE_URL and DATABASE_CA_CERT_PATH must permit a verified TLS connection.');
    return undefined;
  }
}

function tenantRegistry(runtime: BoundedSqlRuntime, freeTenantLimit: number): NonNullable<HostedLoggingStorage['tenants']> {
  const store = new PgTenantRegistryStore(runtime);
  return { requests: new TenantRequests(store, freeTenantLimit), lookup: new TenantLookup(store) };
}

/** Test and customer export share the sender's native DNS, TLS, and HTTP admission. */
export function composeLoggingStorage(runtime: Pick<HostedLoggingStorage, 'store' | 'removalStore' | 'tenants' | 'close'>, key: Uint8Array, sender: DestinationTestSender & TrackedAuditSender = new OtlpAuditSender()): HostedLoggingStorage & { readonly service: DestinationSettingsService; readonly dispatch: RevisionBoundAuditSink } {
  const service = new DestinationSettingsService(runtime.store, key, sender);
  const dispatch = new AuditCollector(service, sender);
  return { store: runtime.store, removalStore: runtime.removalStore, tenants: runtime.tenants, service, dispatch, close: () => { dispatch.close(); return runtime.close(); } };
}
