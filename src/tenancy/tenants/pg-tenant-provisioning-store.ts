import type { BoundedSqlRuntime } from '../../runtime/sql/bounded-sql-runtime.ts';
import { claimNextRow } from './pg-tenant-claim.ts';
import type { ClaimRequest, ClaimResult, LiveRecord, RecordResult, TenantProvisioningStore } from './tenant-provisioning-store.ts';

// Each change names the state that it starts from, so a row that another writer changed stays as it is.
const RECORD_SERVICE = `UPDATE thermus_admin.tenants SET state = 'deploying', render_service_id = $2, updated_at = now()
  WHERE organization_id = $1 AND state = 'creating' RETURNING organization_id`;
// Render does not always give the digest of a deploy; the row then keeps the digest that it has.
const RECORD_LIVE = `UPDATE thermus_admin.tenants SET state = 'live', internal_url = $2, image_digest = COALESCE($3::text, image_digest), applied_plan = plan,
  failure_reason = NULL, updated_at = now() WHERE organization_id = $1 AND state = 'deploying' RETURNING organization_id`;
const RECORD_FAILED = `UPDATE thermus_admin.tenants SET state = 'failed', failure_reason = $2, updated_at = now()
  WHERE organization_id = $1 AND state IN ('creating', 'deploying') RETURNING organization_id`;
const OWNS_SERVICE = 'SELECT 1 AS owned FROM thermus_admin.tenants WHERE render_service_id = $1';
// A bounded reason keeps a long answer of Render out of the row.
const MAX_REASON_LENGTH = 1_000;

/** The provisioning statements of the tenants table, on the shared SQL runtime. */
export class PgTenantProvisioningStore implements TenantProvisioningStore {
  private readonly runtime: BoundedSqlRuntime;

  constructor(runtime: BoundedSqlRuntime) { this.runtime = runtime; }

  async claimNext(request: ClaimRequest): Promise<ClaimResult> {
    const result = await this.runtime.run((session) => claimNextRow(session, request));
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

  /** The write guard of the Render adapter. It fails closed: a registry that cannot answer owns no service. */
  async ownsService(serviceId: string): Promise<boolean> {
    const result = await this.runtime.run(async (session) => (await session.query(OWNS_SERVICE, [serviceId])).length > 0);
    return result.status === 'complete' && result.value;
  }

  // No changed row: the row is no longer in the start state of the change, because another writer moved it.
  private async change(text: string, values: unknown[]): Promise<RecordResult> {
    const result = await this.runtime.run(async (session) => (await session.query(text, values, true)).length > 0);
    if (result.status !== 'complete') return { status: 'unavailable' };
    return { status: result.value ? 'recorded' : 'moved' };
  }
}
