import type { BoundedSqlRuntime } from '../../runtime/sql/bounded-sql-runtime.ts';
import { claimNextRow, RELEASE_CLAIM, RELEASE_UNWORKED_CLAIM, RENEW_CLAIM } from './pg-tenant-claim.ts';
import type { ClaimRequest, ClaimResult, LiveRecord, LiveTarget, ProvisioningRow, RecordResult, TenantProvisioningStore } from './tenant-provisioning-store.ts';

// Each change names the state that it starts from and the holder of the claim, so a row that another writer changed, or
// that another loop claimed after the lease ended, stays as it is.
const RECORD_SERVICE = `UPDATE thermus_admin.tenants SET state = 'deploying', render_service_id = $2, updated_at = now()
  WHERE organization_id = $1 AND state = 'creating' AND claimed_by = $3 RETURNING organization_id`;
// The platform does not always give the digest of a deploy; the row then keeps the digest that it has. The record names
// the service of the work too, so the live deploy of an old service never records a replacement row. The end of the
// work frees the claim. The fleet resume of the operator holds no claim (NULL), and records the row as before the lease.
const RECORD_LIVE = `UPDATE thermus_admin.tenants SET state = 'live', internal_url = $3, image_digest = COALESCE($4::text, image_digest), applied_plan = plan,
  failure_reason = NULL, claimed_by = NULL, claimed_until = NULL, updated_at = now()
  WHERE organization_id = $1 AND state = 'deploying' AND render_service_id = $2 AND (claimed_by = $5 OR $5::text IS NULL) RETURNING organization_id`;
// The failure names the service of the work as well; a creating row without a service binds to NULL.
const RECORD_FAILED = `UPDATE thermus_admin.tenants SET state = 'failed', failure_reason = $2, claimed_by = NULL, claimed_until = NULL, updated_at = now()
  WHERE organization_id = $1 AND state IN ('creating', 'deploying') AND render_service_id IS NOT DISTINCT FROM $3 AND claimed_by = $4 RETURNING organization_id`;
const OWNS_SERVICE = 'SELECT 1 AS owned FROM thermus_admin.tenants WHERE render_service_id = $1';
// A bounded reason keeps a long answer of the platform out of the row.
const MAX_REASON_LENGTH = 1_000;

export class PgTenantProvisioningStore implements TenantProvisioningStore {
  private readonly runtime: BoundedSqlRuntime;

  constructor(runtime: BoundedSqlRuntime) { this.runtime = runtime; }

  async claimNext(request: ClaimRequest): Promise<ClaimResult> {
    const result = await this.runtime.run((session) => claimNextRow(session, request));
    return result.status === 'complete' ? result.value : { status: 'unavailable' };
  }

  renewClaim(row: ProvisioningRow): Promise<RecordResult> {
    return this.change(RENEW_CLAIM, [row.organizationId, row.holder]);
  }

  // A failed release changes nothing: the lease of the row ends by itself.
  async releaseClaim(row: ProvisioningRow): Promise<void> {
    await this.runtime.run((session) => session.query(RELEASE_CLAIM, [row.organizationId, row.holder], true));
  }

  async releaseUnworkedClaim(row: ProvisioningRow): Promise<void> {
    await this.runtime.run((session) => session.query(RELEASE_UNWORKED_CLAIM, [row.organizationId, row.holder], true));
  }

  recordService(row: ProvisioningRow, serviceId: string): Promise<RecordResult> {
    return this.change(RECORD_SERVICE, [row.organizationId, serviceId, row.holder]);
  }

  recordLive(row: LiveTarget, serviceId: string, live: LiveRecord): Promise<RecordResult> {
    return this.change(RECORD_LIVE, [row.organizationId, serviceId, live.internalUrl, live.imageDigest ?? null, row.holder]);
  }

  recordFailed(row: ProvisioningRow, serviceId: string | null, reason: string): Promise<RecordResult> {
    return this.change(RECORD_FAILED, [row.organizationId, reason.slice(0, MAX_REASON_LENGTH), serviceId, row.holder]);
  }

  /** The write guard of the platform adapter. It fails closed: a registry that cannot answer owns no service. */
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
