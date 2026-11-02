import type { GatewayWrite, ResumeMark, TenantGatewayStore } from '../../../../src/tenancy/tenants/tenant-gateway-store.ts';
import type { InsertRequestedResult, ReadRoutesResult, RegistryCount, TenantRegistryStore, TenantRoute, TenantState } from '../../../../src/tenancy/tenants/tenant-registry-store.ts';

interface FakeRow {
  readonly state: TenantState;
  readonly internalUrl: string | null;
  readonly serviceId: string | null;
  /** The organization name that the tenant request stored; null without one. No later change of the row removes it. */
  readonly organizationName: string | null;
  /** The time of the last change on the clock of the fake, as updated_at gives it in the database. */
  readonly changedAt: number;
}

export class TenantRegistryFake implements TenantRegistryStore, TenantGatewayStore {
  readonly rows = new Map<string, FakeRow>();
  readonly requests: string[] = [];
  readonly inserts: string[] = [];
  readonly activeWrites: string[] = [];
  readFailure = false;
  insertFailure: 'unavailable' | 'unconfirmed' | undefined;
  reads = 0;
  readonly #now: () => number;

  // The clock of the change times. Without one, each change happens at 0.
  constructor(now: () => number = () => 0) {
    this.#now = now;
  }

  /** The live record of the provisioner, now. */
  live(organizationId: string, internalUrl: string): void {
    const serviceId = `srv-${organizationId.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
    this.rows.set(organizationId, { state: 'live', internalUrl, serviceId, organizationName: this.organizationNameOf(organizationId), changedAt: this.#now() });
  }

  set(organizationId: string, row: { readonly state: TenantState; readonly internalUrl?: string; readonly serviceId?: string }): void {
    const organizationName = this.organizationNameOf(organizationId);
    this.rows.set(organizationId, { state: row.state, internalUrl: row.internalUrl ?? null, serviceId: row.serviceId ?? null, organizationName, changedAt: this.#now() });
  }

  stateOf(organizationId: string): TenantState | undefined {
    return this.rows.get(organizationId)?.state;
  }

  /** The organization name of the row; null without a row or without a name. */
  organizationNameOf(organizationId: string): string | null {
    return this.rows.get(organizationId)?.organizationName ?? null;
  }

  async insertRequested(organizationId: string, admit: (count: RegistryCount) => boolean, organizationName?: string): Promise<InsertRequestedResult> {
    this.requests.push(organizationId);
    if (this.insertFailure !== undefined) return { status: this.insertFailure };
    const count = this.countFor(organizationId);
    if (!admit(count)) return { status: 'refused', count };
    this.rows.set(organizationId, { state: 'requested', internalUrl: null, serviceId: null, organizationName: organizationName ?? null, changedAt: this.#now() });
    this.inserts.push(organizationId);
    return { status: 'inserted' };
  }

  async readRoutes(): Promise<ReadRoutesResult> {
    this.reads += 1;
    if (this.readFailure) return { status: 'unavailable' };
    const routes = new Map<string, TenantRoute>([...this.rows].map(([organizationId, { state, internalUrl, changedAt }]) => [organizationId, { state, internalUrl, sinceChangeMs: this.#now() - changedAt }]));
    return { status: 'complete', routes };
  }

  async markResuming(organizationId: string): Promise<ResumeMark> {
    const row = this.rows.get(organizationId);
    if (row?.state !== 'suspended' || row.serviceId === null) return { status: 'moved' };
    this.rows.set(organizationId, { ...row, state: 'deploying', changedAt: this.#now() });
    return { status: 'resuming', serviceId: row.serviceId };
  }

  // The restore names the service of the mark, as the guarded update of the SQL adapter does.
  async restoreSuspended(organizationId: string, serviceId: string): Promise<GatewayWrite> {
    const row = this.rows.get(organizationId);
    if (row?.state !== 'deploying' || row.serviceId !== serviceId) return { status: 'moved' };
    this.rows.set(organizationId, { ...row, state: 'suspended', changedAt: this.#now() });
    return { status: 'recorded' };
  }

  // As the SQL adapter, the activity write keeps the state and the change time.
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
