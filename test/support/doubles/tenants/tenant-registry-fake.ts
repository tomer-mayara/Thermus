import type { GatewayWrite, ResumeMark, TenantGatewayStore } from '../../../../src/tenancy/tenants/tenant-gateway-store.ts';
import type { InsertRequestedResult, ReadRoutesResult, RegistryCount, TenantRegistryStore, TenantRoute, TenantState } from '../../../../src/tenancy/tenants/tenant-registry-store.ts';

interface FakeRow {
  readonly state: TenantState;
  readonly internalUrl: string | null;
  readonly serviceId: string | null;
}

export class TenantRegistryFake implements TenantRegistryStore, TenantGatewayStore {
  readonly rows = new Map<string, FakeRow>();
  readonly requests: string[] = [];
  readonly inserts: string[] = [];
  readonly activeWrites: string[] = [];
  readFailure = false;
  insertFailure: 'unavailable' | 'unconfirmed' | undefined;
  reads = 0;

  live(organizationId: string, internalUrl: string): void {
    this.rows.set(organizationId, { state: 'live', internalUrl, serviceId: `srv-${organizationId.toLowerCase().replace(/[^a-z0-9]/g, '')}` });
  }

  set(organizationId: string, row: { readonly state: TenantState; readonly internalUrl?: string; readonly serviceId?: string }): void {
    this.rows.set(organizationId, { state: row.state, internalUrl: row.internalUrl ?? null, serviceId: row.serviceId ?? null });
  }

  stateOf(organizationId: string): TenantState | undefined {
    return this.rows.get(organizationId)?.state;
  }

  async insertRequested(organizationId: string, admit: (count: RegistryCount) => boolean): Promise<InsertRequestedResult> {
    this.requests.push(organizationId);
    if (this.insertFailure !== undefined) return { status: this.insertFailure };
    const count = this.countFor(organizationId);
    if (!admit(count)) return { status: 'refused', count };
    this.rows.set(organizationId, { state: 'requested', internalUrl: null, serviceId: null });
    this.inserts.push(organizationId);
    return { status: 'inserted' };
  }

  async readRoutes(): Promise<ReadRoutesResult> {
    this.reads += 1;
    if (this.readFailure) return { status: 'unavailable' };
    const routes = new Map<string, TenantRoute>([...this.rows].map(([organizationId, { state, internalUrl }]) => [organizationId, { state, internalUrl }]));
    return { status: 'complete', routes };
  }

  async markResuming(organizationId: string): Promise<ResumeMark> {
    const row = this.rows.get(organizationId);
    if (row?.state !== 'suspended' || row.serviceId === null) return { status: 'moved' };
    this.rows.set(organizationId, { ...row, state: 'deploying' });
    return { status: 'resuming', serviceId: row.serviceId };
  }

  // The restore names the service of the mark, as the guarded update of the SQL adapter does.
  async restoreSuspended(organizationId: string, serviceId: string): Promise<GatewayWrite> {
    const row = this.rows.get(organizationId);
    if (row?.state !== 'deploying' || row.serviceId !== serviceId) return { status: 'moved' };
    this.rows.set(organizationId, { ...row, state: 'suspended' });
    return { status: 'recorded' };
  }

  async recordActive(organizationId: string): Promise<GatewayWrite> {
    if (!this.rows.has(organizationId)) return { status: 'moved' };
    this.activeWrites.push(organizationId);
    return { status: 'recorded' };
  }

  private countFor(organizationId: string): RegistryCount {
    const rowsByState = new Map<TenantState, number>();
    for (const { state } of this.rows.values()) rowsByState.set(state, (rowsByState.get(state) ?? 0) + 1);
    const current = this.rows.get(organizationId)?.state;
    return current === undefined ? { rowsByState } : { current, rowsByState };
  }
}
