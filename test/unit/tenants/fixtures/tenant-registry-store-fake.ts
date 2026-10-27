import type { InsertRequestedResult, ReadRoutesResult, RegistryCount, TenantRegistryStore, TenantRoute, TenantState } from '../../../../src/tenancy/tenants/tenant-registry-store.ts';

/** A working registry in memory. The failure fields and the read gate stand in for storage faults and slow reads. */
export class TenantRegistryStoreFake implements TenantRegistryStore {
  readonly rows = new Map<string, TenantRoute>();
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
    return this.readFailure ? { status: 'unavailable' } : { status: 'complete', routes: new Map(this.rows) };
  }

  private countFor(organizationId: string): RegistryCount {
    const rowsByState = new Map<TenantState, number>();
    for (const { state } of this.rows.values()) rowsByState.set(state, (rowsByState.get(state) ?? 0) + 1);
    const current = this.rows.get(organizationId)?.state;
    return current === undefined ? { rowsByState } : { current, rowsByState };
  }
}
