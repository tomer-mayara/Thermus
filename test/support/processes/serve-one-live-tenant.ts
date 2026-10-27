import { AuditLog, type RelayedToolCompletion } from '../../../src/logs/audit/audit-log.ts';
import { PgTenantRegistryStore } from '../../../src/tenancy/tenants/pg-tenant-registry-store.ts';
import type { GatewayWrite } from '../../../src/tenancy/tenants/tenant-gateway-store.ts';
import type { ReadRoutesResult } from '../../../src/tenancy/tenants/tenant-registry-store.ts';

// This preload gives a control plane one live tenant without PostgreSQL: the registry statements answer with the
// organization of THERMUS_TEST_TENANT_ORGANIZATION at the internal address THERMUS_TEST_TENANT_URL. It also writes one
// line for each relayed audit event that the relay route captures, so a test sees that a relay reached the control
// plane, and one line for each activity write.
const organizationId = process.env.THERMUS_TEST_TENANT_ORGANIZATION ?? '';
const internalUrl = process.env.THERMUS_TEST_TENANT_URL ?? '';

PgTenantRegistryStore.prototype.readRoutes = async (): Promise<ReadRoutesResult> => ({
  status: 'complete',
  routes: new Map([[organizationId, { state: 'live', internalUrl }]]),
});

PgTenantRegistryStore.prototype.recordActive = async (organization: string): Promise<GatewayWrite> => {
  process.stderr.write(`Test registry recorded the activity of ${organization}\n`);
  return { status: 'recorded' };
};

const toolRelayed = AuditLog.prototype.toolRelayed;
AuditLog.prototype.toolRelayed = function reportRelayed(this: AuditLog, event: RelayedToolCompletion): void {
  process.stderr.write(`Relayed audit event captured: ${JSON.stringify({ organizationId: event.organizationId, operationId: event.operationId, status: event.status })}\n`);
  toolRelayed.call(this, event);
};
