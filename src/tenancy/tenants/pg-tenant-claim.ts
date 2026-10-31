import type { SettingsSqlSession } from '../../runtime/sql/bounded-sql-runtime.ts';
import type { ClaimRequest, ClaimResult } from './tenant-provisioning-store.ts';

// A row of an earlier run or a resume comes before the oldest request. The row lock holds the row until the claim
// commits, and SKIP LOCKED takes the next row when another writer holds one, so a claim never waits for it.
// The claim is a lease: it holds the row for the holder of the claim for 60 s, and the loop renews it while it works on
// the row. Render keeps the old instance of the control plane for about 120 s after a new deploy is live, so two loops
// run during each deploy (SO-12 rehearsal of 31 October 2026); the second loop leaves a row in work until its lease
// ends. A loop takes back a row of its own at once, for example after a failed record.
// A deploying row with an address is the row of a resume: only a live record gives an address, and a delete takes it
// away. Right after a resume, the newest deploy of the service is still the live deploy from before the suspend
// (record SO-09), and Render made the deploy of the resume 1.8 to 2.0 s after the resume call (SO-01c, SO-09). So the
// claim takes such a row 15 s after its resume mark, when the newest deploy is the deploy of the resume.
const NEXT_ROW = `SELECT organization_id, state, service_name, render_service_id FROM thermus_admin.tenants
  WHERE state IN ('requested', 'creating', 'deploying')
  AND (claimed_by IS NULL OR claimed_by = $1 OR claimed_until <= now())
  AND (state <> 'deploying' OR internal_url IS NULL OR updated_at <= now() - interval '15 seconds')
  ORDER BY state = 'requested', updated_at, organization_id
  LIMIT 1 FOR UPDATE SKIP LOCKED`;
const CLAIM_REQUESTED = `UPDATE thermus_admin.tenants SET state = 'creating', service_name = $2, plan = $3, claimed_by = $4,
  claimed_until = now() + interval '60 seconds', updated_at = now() WHERE organization_id = $1 AND state = 'requested'`;
// A resumed row without a name gets one before its next create, so that the search by name can find its service.
const CLAIM_RESUMED = `UPDATE thermus_admin.tenants SET service_name = COALESCE(service_name, $2), claimed_by = $3,
  claimed_until = now() + interval '60 seconds' WHERE organization_id = $1`;
/** The renewal of the lease by its holder, while the row is in work. */
export const RENEW_CLAIM = `UPDATE thermus_admin.tenants SET claimed_until = now() + interval '60 seconds'
  WHERE organization_id = $1 AND claimed_by = $2 AND state IN ('creating', 'deploying') RETURNING organization_id`;
/** The release by the holder at the end of its work. A creating row stays held until its lease ends. */
export const RELEASE_CLAIM = `UPDATE thermus_admin.tenants SET claimed_by = NULL, claimed_until = NULL
  WHERE organization_id = $1 AND claimed_by = $2 AND state <> 'creating'`;
/** The release by the holder of a claim that it did not work on, in each state. */
export const RELEASE_UNWORKED_CLAIM = 'UPDATE thermus_admin.tenants SET claimed_by = NULL, claimed_until = NULL WHERE organization_id = $1 AND claimed_by = $2';

// No deletion state: the provisioner works only toward live (answer 6 of 27 October 2026).
type ClaimedState = 'requested' | 'creating' | 'deploying';

/** The claim of the next row in one transaction. A failure before COMMIT destroys the client, so PostgreSQL rolls back. */
export async function claimNextRow(session: SettingsSqlSession, request: ClaimRequest): Promise<ClaimResult> {
  await session.query('BEGIN');
  const [row] = await session.query(NEXT_ROW, [request.holder]);
  const claimed = row === undefined ? { status: 'idle' as const } : await claim(session, row, request);
  await session.query('COMMIT', [], claimed.status === 'claimed');
  return claimed;
}

async function claim(session: SettingsSqlSession, row: Record<string, unknown>, request: ClaimRequest): Promise<ClaimResult> {
  const organizationId = row.organization_id as string;
  const state = row.state as ClaimedState;
  const storedName = row.service_name as string | null;
  const { holder } = request;
  // A new claim takes the name of the current prefix; a resumed row keeps the name that its create used.
  const serviceName = state === 'requested' || storedName === null ? request.serviceNameOf(organizationId) : storedName;
  if (state === 'requested') await session.query(CLAIM_REQUESTED, [organizationId, serviceName, request.plan, holder], true);
  else await session.query(CLAIM_RESUMED, [organizationId, serviceName, holder], true);
  const provisioning = { organizationId, state: state === 'requested' ? 'creating' as const : state, serviceName, serviceId: row.render_service_id as string | null, holder };
  return { status: 'claimed', resumed: state !== 'requested', row: provisioning };
}
