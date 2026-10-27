import type { BoundedSqlRuntime, SettingsSqlSession } from '../../runtime/sql/bounded-sql-runtime.ts';
import type { ClaimRequest, ClaimResult, LiveRecord, RecordResult, TenantProvisioningStore } from './tenant-provisioning-store.ts';

// A row of an earlier run or a resume comes before the oldest request. The row lock holds the row until the claim
// commits, and SKIP LOCKED takes the next row when another writer holds one, so a claim never waits for it. The
// claim is not a lease: one control plane runs one loop (plan section 7).
const NEXT_ROW = `SELECT organization_id, state, service_name, render_service_id FROM thermus_admin.tenants
  WHERE state IN ('requested', 'creating', 'deploying')
  ORDER BY state = 'requested', updated_at, organization_id
  LIMIT 1 FOR UPDATE SKIP LOCKED`;
const CLAIM_REQUESTED = `UPDATE thermus_admin.tenants SET state = 'creating', service_name = $2, plan = $3, updated_at = now()
  WHERE organization_id = $1 AND state = 'requested'`;
const NAME_RESUMED = 'UPDATE thermus_admin.tenants SET service_name = $2 WHERE organization_id = $1 AND service_name IS NULL';
// Each change names the state that it starts from, so a row that another writer changed stays as it is.
const RECORD_SERVICE = `UPDATE thermus_admin.tenants SET state = 'deploying', render_service_id = $2, updated_at = now()
  WHERE organization_id = $1 AND state = 'creating' RETURNING organization_id`;
const RECORD_LIVE = `UPDATE thermus_admin.tenants SET state = 'live', internal_url = $2, image_digest = COALESCE($3::text, image_digest), applied_plan = plan,
  failure_reason = NULL, updated_at = now() WHERE organization_id = $1 AND state = 'deploying' RETURNING organization_id`;
const RECORD_FAILED = `UPDATE thermus_admin.tenants SET state = 'failed', failure_reason = $2, updated_at = now()
  WHERE organization_id = $1 AND state IN ('creating', 'deploying') RETURNING organization_id`;
const OWNS_SERVICE = 'SELECT 1 AS owned FROM thermus_admin.tenants WHERE render_service_id = $1';
const MAX_REASON_LENGTH = 1_000;

type ClaimedState = 'requested' | 'creating' | 'deploying';

/** The provisioning statements of the tenants table, on the shared SQL runtime. */
export class PgTenantProvisioningStore implements TenantProvisioningStore {
  private readonly runtime: BoundedSqlRuntime;

  constructor(runtime: BoundedSqlRuntime) { this.runtime = runtime; }

  // A failure before COMMIT destroys the client, so PostgreSQL rolls the claim back and frees the row lock.
  async claimNext(request: ClaimRequest): Promise<ClaimResult> {
    const result = await this.runtime.run(async (session): Promise<ClaimResult> => {
      await session.query('BEGIN');
      const [row] = await session.query(NEXT_ROW);
      const claimed = row === undefined ? { status: 'idle' as const } : await claim(session, row, request);
      await session.query('COMMIT', [], claimed.status === 'claimed');
      return claimed;
    });
    return result.status === 'complete' ? result.value : { status: 'unavailable' };
  }

  recordService(organizationId: string, serviceId: string): Promise<RecordResult> {
    return this.change(RECORD_SERVICE, [organizationId, serviceId]);
  }

  recordLive(organizationId: string, live: LiveRecord): Promise<RecordResult> {
    return this.change(RECORD_LIVE, [organizationId, live.internalUrl, live.imageDigest ?? null]);
  }

  recordFailed(organizationId: string, reason: string): Promise<RecordResult> {
    return this.change(RECORD_FAILED, [organizationId, reason.slice(0, MAX_REASON_LENGTH)]);
  }

  async ownsService(serviceId: string): Promise<boolean> {
    const result = await this.runtime.run(async (session) => (await session.query(OWNS_SERVICE, [serviceId])).length > 0);
    return result.status === 'complete' && result.value;
  }

  private async change(text: string, values: unknown[]): Promise<RecordResult> {
    const result = await this.runtime.run(async (session) => (await session.query(text, values, true)).length > 0);
    if (result.status !== 'complete') return { status: 'unavailable' };
    return { status: result.value ? 'recorded' : 'moved' };
  }
}

async function claim(session: SettingsSqlSession, row: Record<string, unknown>, request: ClaimRequest): Promise<ClaimResult> {
  const organizationId = row.organization_id as string;
  const state = row.state as ClaimedState;
  const storedName = row.service_name as string | null;
  // A new claim takes the name of the current prefix; a resumed row keeps the name that its create used.
  const serviceName = state === 'requested' || storedName === null ? request.serviceNameOf(organizationId) : storedName;
  if (state === 'requested') await session.query(CLAIM_REQUESTED, [organizationId, serviceName, request.plan], true);
  else if (storedName === null) await session.query(NAME_RESUMED, [organizationId, serviceName], true);
  const provisioning = { organizationId, state: state === 'requested' ? 'creating' as const : state, serviceName, serviceId: row.render_service_id as string | null };
  return { status: 'claimed', resumed: state !== 'requested', row: provisioning };
}
