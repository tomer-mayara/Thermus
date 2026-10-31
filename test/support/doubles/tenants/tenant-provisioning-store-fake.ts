import type { TenantState } from '../../../../src/tenancy/tenants/tenant-registry-store.ts';
import type {
  ClaimRequest, ClaimResult, LiveRecord, LiveTarget, ProvisioningRow, RecordResult, TenantProvisioningStore,
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
  /** last_active_at and created_at, ISO 8601 in UTC. */
  lastActiveAt: string | null;
  createdAt: string;
  /** The order of the changes, as updated_at gives it. */
  updatedAt: number;
  /** The time of the last change on the clock of the fake. */
  changedAtMs: number;
  /** The holder of the claim, and the end of its lease on the clock of the fake; both null when no loop holds the row. */
  claimedBy: string | null;
  claimedUntilMs: number | null;
}

export type StoreOperation = 'claim' | 'renew' | 'release' | 'service' | 'live' | 'failed';

/** The creation time of a row that a test puts without one. */
export const fakeCreatedAt = '2026-10-01T08:00:00.000Z';

const PROVISIONING_STATES: ReadonlySet<TenantState> = new Set(['creating', 'deploying']);
type RecordOperation = 'service' | 'live' | 'failed';
// The states that each change starts from, as the guarded updates of the SQL adapter have them.
const FROM_STATES: Readonly<Record<RecordOperation, readonly TenantState[]>> = {
  service: ['creating'], live: ['deploying'], failed: ['creating', 'deploying'],
};
// The claim lease of the SQL adapter.
const CLAIM_LEASE_MS = 60_000;
// As the claim of the SQL adapter: a deploying row that keeps the address of its last live deploy is the row of a
// resume, and the claim takes it 15 s after its last change.
const RESUME_CLAIM_DELAY_MS = 15_000;

/**
 * A working tenant registry in memory (a fake), with the claim order of the SQL adapter: a row in creating or
 * deploying first, then the oldest requested row. changes lists each state that a row takes, in order. An operation in
 * unavailable stands in for a storage failure of that operation. With a clock, the claim leaves the row of a resume
 * until 15 s after its change, as the SQL adapter does; without one, it takes the row at once. As the SQL adapter, a
 * claim holds the row for its holder: the claim of another holder leaves it until the lease of 60 s ends on the clock
 * of the fake (never without a clock), each record names the holder, and the live and failed records free the row.
 */
export class TenantProvisioningStoreFake implements TenantProvisioningStore {
  readonly rows = new Map<string, FakeTenantRow>();
  readonly changes: string[] = [];
  readonly unavailable = new Set<StoreOperation>();
  protected readonly clock: (() => number) | undefined;
  #time = 0;

  constructor(clock?: () => number) {
    this.clock = clock;
  }

  request(organizationId: string): void {
    this.put({ organizationId, state: 'requested' });
  }

  put(row: Partial<FakeTenantRow> & Pick<FakeTenantRow, 'organizationId' | 'state'>): void {
    this.rows.set(row.organizationId, {
      serviceName: null, serviceId: null, internalUrl: null, imageDigest: null, plan: null, appliedPlan: null, failureReason: null,
      lastActiveAt: null, createdAt: fakeCreatedAt, claimedBy: null, claimedUntilMs: null, ...row, updatedAt: this.tick(), changedAtMs: this.clock?.() ?? 0,
    });
  }

  row(organizationId: string): FakeTenantRow {
    const row = this.rows.get(organizationId);
    if (row === undefined) throw new Error(`The fake registry has no row for ${organizationId}`);
    return row;
  }

  async claimNext(request: ClaimRequest): Promise<ClaimResult> {
    if (this.unavailable.has('claim')) return { status: 'unavailable' };
    const byAge = [...this.rows.values()].filter((row) => this.claimableBy(row, request.holder)).sort((first, second) => first.updatedAt - second.updatedAt);
    const resumed = byAge.find((row) => PROVISIONING_STATES.has(row.state) && !this.resumedLately(row));
    if (resumed !== undefined) {
      resumed.serviceName ??= request.serviceNameOf(resumed.organizationId);
      return { status: 'claimed', resumed: true, row: this.held(resumed, request.holder) };
    }
    const requested = byAge.find((row) => row.state === 'requested');
    if (requested === undefined) return { status: 'idle' };
    this.change(requested, 'creating');
    requested.serviceName = request.serviceNameOf(requested.organizationId);
    requested.plan = request.plan;
    return { status: 'claimed', resumed: false, row: this.held(requested, request.holder) };
  }

  async renewClaim(claimed: ProvisioningRow): Promise<RecordResult> {
    if (this.unavailable.has('renew')) return { status: 'unavailable' };
    const row = this.rows.get(claimed.organizationId);
    if (row?.claimedBy !== claimed.holder || !PROVISIONING_STATES.has(row.state)) return { status: 'moved' };
    row.claimedUntilMs = this.leaseEnd();
    return { status: 'recorded' };
  }

  async releaseClaim(claimed: ProvisioningRow): Promise<void> {
    const row = this.rows.get(claimed.organizationId);
    if (this.unavailable.has('release') || row?.claimedBy !== claimed.holder || row.state === 'creating') return;
    freed(row);
  }

  async recordService(claimed: ProvisioningRow, serviceId: string): Promise<RecordResult> {
    return this.move('service', claimed, (row) => {
      this.change(row, 'deploying');
      row.serviceId = serviceId;
    });
  }

  // The live record names the service of the work, as the guarded update of the SQL adapter does.
  async recordLive(claimed: LiveTarget, serviceId: string, live: LiveRecord): Promise<RecordResult> {
    return this.move('live', claimed, (row) => {
      if (row.serviceId !== serviceId) return false;
      this.change(row, 'live');
      row.internalUrl = live.internalUrl;
      row.imageDigest = live.imageDigest ?? row.imageDigest;
      row.appliedPlan = row.plan;
      row.failureReason = null;
      freed(row);
      return true;
    });
  }

  // The failure names the service of the work too; a row without a service binds to null.
  async recordFailed(claimed: ProvisioningRow, serviceId: string | null, reason: string): Promise<RecordResult> {
    return this.move('failed', claimed, (row) => {
      if (row.serviceId !== serviceId) return false;
      this.change(row, 'failed');
      row.failureReason = reason;
      freed(row);
      return true;
    });
  }

  async ownsService(serviceId: string): Promise<boolean> {
    return [...this.rows.values()].some((row) => row.serviceId === serviceId);
  }

  // apply gives false when the row is in a start state but on another service.
  // A target without a holder, the fleet resume, writes whoever holds the row.
  private move(operation: RecordOperation, claimed: LiveTarget, apply: (row: FakeTenantRow) => boolean | void): RecordResult {
    if (this.unavailable.has(operation)) return { status: 'unavailable' };
    const row = this.rows.get(claimed.organizationId);
    if (row === undefined || !FROM_STATES[operation].includes(row.state)) return { status: 'moved' };
    if (claimed.holder !== null && row.claimedBy !== claimed.holder) return { status: 'moved' };
    return { status: apply(row) === false ? 'moved' : 'recorded' };
  }

  // A row without a claim, a row of the holder, or a row whose lease ended.
  private claimableBy(row: FakeTenantRow, holder: string): boolean {
    return row.claimedBy === null || row.claimedBy === holder || (row.claimedUntilMs ?? 0) <= (this.clock?.() ?? Number.NEGATIVE_INFINITY);
  }

  private held(row: FakeTenantRow, holder: string): ProvisioningRow {
    row.claimedBy = holder;
    row.claimedUntilMs = this.leaseEnd();
    return provisioningRowOf(row);
  }

  private leaseEnd(): number {
    return (this.clock?.() ?? 0) + CLAIM_LEASE_MS;
  }

  private change(row: FakeTenantRow, state: TenantState): void {
    row.state = state;
    row.updatedAt = this.tick();
    row.changedAtMs = this.clock?.() ?? 0;
    this.changes.push(`${row.organizationId} ${state}`);
  }

  // The row of a resume within 15 s of its change, by the clock of the fake.
  private resumedLately(row: FakeTenantRow): boolean {
    if (this.clock === undefined || row.state !== 'deploying' || row.internalUrl === null) return false;
    return this.clock() - row.changedAtMs < RESUME_CLAIM_DELAY_MS;
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
    holder: row.claimedBy ?? '',
  };
}

function freed(row: FakeTenantRow): void {
  row.claimedBy = null;
  row.claimedUntilMs = null;
}
