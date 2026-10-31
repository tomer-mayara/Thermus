import type { InsertRequestedResult, ReadRoutesResult, RegistryCount, TenantRegistryStore, TenantRoute, TenantState } from '../../../../src/tenancy/tenants/tenant-registry-store.ts';

// A row of the fake. Each read gives its time since the last change; 0 when the case does not set one.
type FakeRoute = Omit<TenantRoute, 'sinceChangeMs'> & { readonly sinceChangeMs?: number };

export class TenantRegistryStoreFake implements TenantRegistryStore {
  readonly rows = new Map<string, FakeRoute>();
  insertFailure?: 'unavailable' | 'unconfirmed';
  readFailure = false;
  readGate?: Promise<void>;
  reads = 0;

  async insertRequested(organizationId: string, admit: (count: RegistryCount) => boolean): Promise<InsertRequestedResult> {
    if (this.insertFailure !== undefined) return { status: this.insertFailure };
    const count = this.countFor(organizationId);
    if (!admit(count)) return { status: 'refused', count };
    this.rows.set(organizationId, { state: 'requested', internalUrl: null });
    return { status: 'inserted' };
  }

  async readRoutes(): Promise<ReadRoutesResult> {
    this.reads += 1;
    await this.readGate;
    if (this.readFailure) return { status: 'unavailable' };
    return { status: 'complete', routes: new Map([...this.rows].map(([organizationId, row]) => [organizationId, { sinceChangeMs: 0, ...row }])) };
  }

  private countFor(organizationId: string): RegistryCount {
    const rowsByState = new Map<TenantState, number>();
    for (const { state } of this.rows.values()) rowsByState.set(state, (rowsByState.get(state) ?? 0) + 1);
    const current = this.rows.get(organizationId)?.state;
    return current === undefined ? { rowsByState } : { current, rowsByState };
  }
}
