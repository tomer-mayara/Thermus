import type { TenantState } from '../../../../src/tenancy/tenants/tenant-registry-store.ts';
import type {
  ClaimRequest, ClaimResult, LiveRecord, ProvisioningRow, RecordResult, TenantProvisioningStore,
} from '../../../../src/tenancy/tenants/tenant-provisioning-store.ts';

export interface FakeTenantRow {
  readonly organizationId: string;
  state: TenantState;
  serviceName: string | null;
  serviceId: string | null;
  internalUrl: string | null;
  imageDigest: string | null;
  plan: string | null;
  appliedPlan: string | null;
  failureReason: string | null;
  updatedAt: number;
}

export type StoreOperation = 'claim' | 'service' | 'live' | 'failed';

const PROVISIONING_STATES: ReadonlySet<TenantState> = new Set(['creating', 'deploying']);
// The states that each change starts from, as the guarded updates of the SQL adapter have them.
const FROM_STATES: Readonly<Record<Exclude<StoreOperation, 'claim'>, readonly TenantState[]>> = {
  service: ['creating'], live: ['deploying'], failed: ['creating', 'deploying'],
};

/**
 * A working tenant registry in memory (a fake), with the claim order of the SQL adapter: a row in creating or
 * deploying first, then the oldest requested row. changes lists each state that a row takes, in order. An operation in
 * unavailable stands in for a storage failure of that operation.
 */
export class TenantProvisioningStoreFake implements TenantProvisioningStore {
  readonly rows = new Map<string, FakeTenantRow>();
  readonly changes: string[] = [];
  readonly unavailable = new Set<StoreOperation>();
  #time = 0;

  request(organizationId: string): void {
    this.put({ organizationId, state: 'requested' });
  }

  put(row: Partial<FakeTenantRow> & Pick<FakeTenantRow, 'organizationId' | 'state'>): void {
    this.rows.set(row.organizationId, {
      serviceName: null, serviceId: null, internalUrl: null, imageDigest: null, plan: null, appliedPlan: null, failureReason: null,
      ...row, updatedAt: this.tick(),
    });
  }

  row(organizationId: string): FakeTenantRow {
    const row = this.rows.get(organizationId);
    if (row === undefined) throw new Error(`The fake registry has no row for ${organizationId}`);
    return row;
  }

  async claimNext(request: ClaimRequest): Promise<ClaimResult> {
    if (this.unavailable.has('claim')) return { status: 'unavailable' };
    const byAge = [...this.rows.values()].sort((first, second) => first.updatedAt - second.updatedAt);
    const resumed = byAge.find((row) => PROVISIONING_STATES.has(row.state));
    if (resumed !== undefined) {
      resumed.serviceName ??= request.serviceNameOf(resumed.organizationId);
      return { status: 'claimed', resumed: true, row: provisioningRowOf(resumed) };
    }
    const requested = byAge.find((row) => row.state === 'requested');
    if (requested === undefined) return { status: 'idle' };
    this.change(requested, 'creating');
    requested.serviceName = request.serviceNameOf(requested.organizationId);
    requested.plan = request.plan;
    return { status: 'claimed', resumed: false, row: provisioningRowOf(requested) };
  }

  async recordService(organizationId: string, serviceId: string): Promise<RecordResult> {
    return this.move('service', organizationId, (row) => {
      this.change(row, 'deploying');
      row.serviceId = serviceId;
    });
  }

  // The live record names the service of the work, as the guarded update of the SQL adapter does.
  async recordLive(organizationId: string, serviceId: string, live: LiveRecord): Promise<RecordResult> {
    return this.move('live', organizationId, (row) => {
      if (row.serviceId !== serviceId) return false;
      this.change(row, 'live');
      row.internalUrl = live.internalUrl;
      row.imageDigest = live.imageDigest ?? row.imageDigest;
      row.appliedPlan = row.plan;
      row.failureReason = null;
      return true;
    });
  }

  async recordFailed(organizationId: string, reason: string): Promise<RecordResult> {
    return this.move('failed', organizationId, (row) => {
      this.change(row, 'failed');
      row.failureReason = reason;
    });
  }

  async ownsService(serviceId: string): Promise<boolean> {
    return [...this.rows.values()].some((row) => row.serviceId === serviceId);
  }

  // apply gives false when the row is in a start state but on another service.
  private move(operation: Exclude<StoreOperation, 'claim'>, organizationId: string, apply: (row: FakeTenantRow) => boolean | void): RecordResult {
    if (this.unavailable.has(operation)) return { status: 'unavailable' };
    const row = this.rows.get(organizationId);
    if (row === undefined || !FROM_STATES[operation].includes(row.state)) return { status: 'moved' };
    return { status: apply(row) === false ? 'moved' : 'recorded' };
  }

  private change(row: FakeTenantRow, state: TenantState): void {
    row.state = state;
    row.updatedAt = this.tick();
    this.changes.push(`${row.organizationId} ${state}`);
  }

  private tick(): number {
    this.#time += 1;
    return this.#time;
  }
}

function provisioningRowOf(row: FakeTenantRow): ProvisioningRow {
  return {
    organizationId: row.organizationId,
    state: row.state === 'deploying' ? 'deploying' : 'creating',
    serviceName: row.serviceName ?? '',
    serviceId: row.serviceId,
  };
}
