import type { GatewayWrite, ResumeMark, TenantGatewayStore } from '../../../../src/tenancy/tenants/tenant-gateway-store.ts';
import type { InsertRequestedResult, ReadRoutesResult, RegistryCount, TenantRegistryStore, TenantRoute } from '../../../../src/tenancy/tenants/tenant-registry-store.ts';
import { TenantFleetStoreFake } from './tenant-fleet-store-fake.ts';

/**
 * The tenants table in memory (a fake) with the statements of each store on it: the lookup, the tenant request, and the
 * writes of the gateway, next to the statements of the provisioner, the fleet commands, and the sweeps of the fakes that
 * it extends. So the gateway, the provisioner, and the sweeps of one test share one registry, as they share one table
 * in production. Each gateway write names the state that it starts from, as the guarded updates of the SQL adapter do.
 */
export class TenantTableFake extends TenantFleetStoreFake implements TenantRegistryStore, TenantGatewayStore {
  readonly activeWrites: string[] = [];

  async insertRequested(organizationId: string, admit: (count: RegistryCount) => boolean): Promise<InsertRequestedResult> {
    const count = this.countFor(organizationId);
    if (!admit(count)) return { status: 'refused', count };
    this.request(organizationId);
    return { status: 'inserted' };
  }

  // The time since the last change of each row, by the clock of the fake, as updated_at gives it in the database.
  async readRoutes(): Promise<ReadRoutesResult> {
    const now = this.clock?.() ?? 0;
    const routes = new Map<string, TenantRoute>([...this.rows].map(([organizationId, { state, internalUrl, changedAtMs }]) => [organizationId, { state, internalUrl, sinceChangeMs: now - changedAtMs }]));
    return { status: 'complete', routes };
  }

  async markResuming(organizationId: string): Promise<ResumeMark> {
    const row = this.rows.get(organizationId);
    if (row?.state !== 'suspended' || row.serviceId === null) return { status: 'moved' };
    this.moveTo(row, 'deploying');
    return { status: 'resuming', serviceId: row.serviceId };
  }

  async restoreSuspended(organizationId: string, serviceId: string): Promise<GatewayWrite> {
    const row = this.rows.get(organizationId);
    if (row?.state !== 'deploying' || row.serviceId !== serviceId) return { status: 'moved' };
    this.moveTo(row, 'suspended');
    return { status: 'recorded' };
  }

  async recordActive(organizationId: string): Promise<GatewayWrite> {
    const row = this.rows.get(organizationId);
    if (row === undefined) return { status: 'moved' };
    row.lastActiveAt = new Date().toISOString();
    this.activeWrites.push(organizationId);
    return { status: 'recorded' };
  }
}
