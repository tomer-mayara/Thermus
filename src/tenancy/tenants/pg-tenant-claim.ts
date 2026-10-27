import type { SettingsSqlSession } from '../../runtime/sql/bounded-sql-runtime.ts';
import type { ClaimRequest, ClaimResult } from './tenant-provisioning-store.ts';

// A row of an earlier run or a resume comes before the oldest request. The row lock holds the row until the claim
// commits, and SKIP LOCKED takes the next row when another writer holds one, so a claim never waits for it. The
// claim is not a lease: one control plane runs one loop (plan section 7).
const NEXT_ROW = `SELECT organization_id, state, service_name, render_service_id FROM thermus_admin.tenants
  WHERE state IN ('requested', 'creating', 'deploying')
  ORDER BY state = 'requested', updated_at, organization_id
  LIMIT 1 FOR UPDATE SKIP LOCKED`;
const CLAIM_REQUESTED = `UPDATE thermus_admin.tenants SET state = 'creating', service_name = $2, plan = $3, updated_at = now()
  WHERE organization_id = $1 AND state = 'requested'`;
// A resumed row without a name gets one before its next create, so that the search by name can find its service.
const NAME_RESUMED = 'UPDATE thermus_admin.tenants SET service_name = $2 WHERE organization_id = $1 AND service_name IS NULL';

// No deletion state: the provisioner works only toward live (answer 6 of 27 October 2026).
type ClaimedState = 'requested' | 'creating' | 'deploying';

/** The claim of the next row in one transaction. A failure before COMMIT destroys the client, so PostgreSQL rolls back. */
export async function claimNextRow(session: SettingsSqlSession, request: ClaimRequest): Promise<ClaimResult> {
  await session.query('BEGIN');
  const [row] = await session.query(NEXT_ROW);
  const claimed = row === undefined ? { status: 'idle' as const } : await claim(session, row, request);
  await session.query('COMMIT', [], claimed.status === 'claimed');
  return claimed;
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
