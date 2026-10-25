import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, mkdir } from 'node:fs/promises';
import type { TestContext } from 'node:test';
import { postgresSettingsSite } from '../../test/support/in-process/postgres-settings-site.ts';
import { MembershipRemovalProcess } from '../../test/support/processes/membership-removal-process.ts';
import { createPgSettingsRuntime } from '../../src/logs/audit/bounded-sql-runtime.ts';
import { PgDestinationSettingsStore } from '../../src/logs/audit/pg-destination-settings-store.ts';
import { OrganizationAdministration } from '../../src/accounts/organizations/organization-administration.ts';
import { BillingFree } from '../../src/accounts/billing/billing-free.ts';
import { OrganizationDirectoryDouble } from '../../test/support/doubles/organizations/organization-directory-double.ts';
import { adminGrant, userGrant } from '../../test/support/fixtures/hosted-roles.ts';

const exec = promisify(execFile);
const cleanups: (() => unknown)[] = [];
const t = { after: (action: () => unknown) => cleanups.push(action) } as unknown as TestContext;
const evidence: Record<string, unknown>[] = [];
const folder = '.cache/s25-02/restore';
await mkdir(folder, { recursive: true });
const note = (stage: string, facts: Record<string, unknown>) => evidence.push({ at: new Date().toISOString(), stage, ...facts });
try {
  const sql = await postgresSettingsSite(t);
  const owner = async (query: string) => (await exec('docker', ['exec', sql.container, 'psql', '-X', '-U', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query])).stdout.trim();
  const dump = (await exec('docker', ['exec', sql.container, 'pg_dump', '-U', 'postgres', '--data-only', '--no-owner', '--no-privileges', '--table=thermus_admin.membership_removal_operations'])).stdout;
  assert.doesNotMatch(dump, /^(?:GRANT|REVOKE|ALTER ROLE|CREATE|DROP)/m);
  await writeFile(`${folder}/before-intent.sql`, dump);
  const observerRuntime = createPgSettingsRuntime(sql.connection);
  const observer = new PgDestinationSettingsStore(observerRuntime);
  cleanups.push(() => observerRuntime.close());
  assert.deepEqual(await observer.readRemoval('org-a'), { status: 'absent' });
  note('snapshot-before-intent', { rowCount: 0, scope: 'one disposable removal table; data only; no ACL or role replay' });

  const oldSender = MembershipRemovalProcess.launch(t, sql.connection, 'before-completion');
  const paused = await oldSender.message('paused');
  assert.equal(paused.deleteCalls, 1);
  assert.equal(paused.completionOutcome, 'applied');
  const pending = await observer.readRemoval('org-a');
  assert.equal(pending.status, 'found');
  if (pending.status !== 'found') throw new Error('No pending operation');
  assert.equal(pending.operation.operationId, paused.operationId);
  assert.equal(pending.operation.outcome, null);
  await writeFile(`${folder}/independent-operation.json`, JSON.stringify({ paused, pending }, null, 2)+'\n');
  note('known-provider-effect-before-sql-completion', { ...paused, receipt: pending.operation, provider: 'controlled directory; independent child IPC before durable completion; no WorkOS claim' });
  assert.equal(await oldSender.crash(), 'SIGKILL');
  await observerRuntime.close();
  note('old-sender-contained', { signal: 'SIGKILL', exited: true, laterRemoteEffect: 'not inferred from exit; controlled independent applied receipt is retained' });

  await owner("ALTER ROLE thermus_logging NOLOGIN; REVOKE INSERT, UPDATE ON thermus_admin.membership_removal_operations FROM thermus_logging");
  await owner("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=current_database() AND usename='thermus_logging'");
  const aclQuery = "SELECT json_build_object('select',has_table_privilege('thermus_logging','thermus_admin.membership_removal_operations','SELECT'),'insert',has_table_privilege('thermus_logging','thermus_admin.membership_removal_operations','INSERT'),'update',has_table_privilege('thermus_logging','thermus_admin.membership_removal_operations','UPDATE'),'delete',has_table_privilege('thermus_logging','thermus_admin.membership_removal_operations','DELETE'))";
  const held = { select: true, insert: false, update: false, delete: false };
  assert.deepEqual(JSON.parse(await owner(aclQuery)), held);
  assert.equal(await owner("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND usename='thermus_logging'"), '0');
  note('external-hold-established', { effectivePrivileges: held, oldRuntimeSessions: 0 });
  const replacement = `BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'; DELETE FROM thermus_admin.membership_removal_operations WHERE organization_id='org-a';\n${dump}\nCOMMIT;\n`;
  await writeFile(`${folder}/scoped-restore.sql`, replacement);
  await exec('docker', ['cp', `${folder}/scoped-restore.sql`, `${sql.container}:/tmp/scoped-restore.sql`]);
  await exec('docker', ['exec', sql.container, 'psql', '-X', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-f', '/tmp/scoped-restore.sql']);
  assert.equal(await owner("SELECT count(*) FROM thermus_admin.membership_removal_operations WHERE organization_id='org-a'"), '0');
  assert.deepEqual(JSON.parse(await owner(aclQuery)), held);
  await owner('ALTER ROLE thermus_logging LOGIN');

  const current = new OrganizationDirectoryDouble();
  current.authority = 'removal-restart-provider';
  current.addMembers(
    { subject: 'admin-a', organizationId: 'org-a', membershipId: 'admin-a-in-a', grants: [adminGrant] },
    { subject: 'admin-b', organizationId: 'org-a', membershipId: 'replacement-admin-b', grants: [userGrant] },
    { subject: 'later-admin', organizationId: 'org-a', membershipId: 'later-admin-grant', grants: [adminGrant] },
  );
  const expected = await Promise.all(['admin-a-in-a', 'replacement-admin-b', 'later-admin-grant'].map(id => current.member(id)));
  let deleteCalls = 0;
  const originalDelete = current.deleteMembership.bind(current);
  current.deleteMembership = async id => { deleteCalls++; return originalDelete(id); };
  const runtime = createPgSettingsRuntime(sql.connection);
  const store = new PgDestinationSettingsStore(runtime);
  cleanups.push(() => runtime.close());
  assert.deepEqual(await store.readRemoval('org-a'), { status: 'absent' });
  const admin = new OrganizationAdministration({ directory: current, billing: new BillingFree(), records: { record: () => {} }, removalStore: store });
  cleanups.push(() => admin.close());
  const result = await admin.removeMember({ user: { authority: current.authority, subject: 'admin-a' } }, { organizationId: 'org-a', membershipId: 'replacement-admin-b', revision: 'r1' });
  assert.equal(result, 'unknown');
  assert.equal(deleteCalls, 0);
  assert.deepEqual(await Promise.all(['admin-a-in-a', 'replacement-admin-b', 'later-admin-grant'].map(id => current.member(id))), expected);
  note('restored-runtime-held', { login: true, sqlSelectWorks: true, restoredOperationAbsent: true, result, deleteCalls, effectivePrivileges: JSON.parse(await owner(aclQuery)), replacementMembershipAndLaterAdminUnchanged: true });

  // In this disposable drill the independent child receipt proves applied. An owner must not infer this from a list or 404.
  const op = pending.operation;
  const literal = (s: string) => `'${s.replaceAll("'", "''")}'`;
  await owner(`INSERT INTO thermus_admin.membership_removal_operations (organization_id,operation_id,membership_id,revision,actor_authority,actor_subject,started_at,outcome) VALUES (${[op.organizationId,op.operationId,op.membershipId,op.revision,op.actor.authority,op.actor.subject,op.startedAt].map(literal).join(',')},NULL)`);
  const reconciliation = await owner(`UPDATE thermus_admin.membership_removal_operations SET outcome='applied' WHERE organization_id=${literal(op.organizationId)} AND operation_id=${literal(op.operationId)}::uuid AND outcome IS NULL RETURNING operation_id`);
  assert.ok(reconciliation.startsWith(op.operationId));
  assert.ok(reconciliation.endsWith('UPDATE 1'));
  const terminal = await store.readRemoval('org-a');
  assert.equal(terminal.status, 'found');
  assert.equal(terminal.status === 'found' && terminal.operation.outcome, 'applied');
  assert.deepEqual(await Promise.all(['admin-a-in-a', 'replacement-admin-b', 'later-admin-grant'].map(id => current.member(id))), expected);
  note('independent-reconciliation', { operationId: op.operationId, reconstructedExactPendingRow: true, exactPendingCompareAndSet: 'UPDATE 1', outcome: 'applied', unchangedProviderInventory: true, evidence: 'independent-operation.json; known controlled applied result before child exit' });
  await owner('GRANT INSERT, UPDATE ON thermus_admin.membership_removal_operations TO thermus_logging');
  assert.deepEqual(JSON.parse(await owner(aclQuery)), { select: true, insert: true, update: true, delete: false });
  assert.equal(deleteCalls, 0);
  note('reviewed-disposable-hold-released', { noFurtherDelete: true, productionChanges: false, scope: 'only this disposable database; full data-loss/distributed-provider recovery remains an operator decision' });
} finally {
  for (const cleanup of cleanups.reverse()) await cleanup();
  await writeFile(`${folder}/evidence.json`, JSON.stringify(evidence, null, 2)+'\n');
}
console.log(`Restore drill passed ${evidence.length} stages; exact disposable resources cleaned.`);
