import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Pool } from 'pg';
import { openLoggingStorage } from '../../../../src/app/logging-storage.ts';
import { PgDestinationSettingsStore } from '../../../../src/logs/audit/pg-destination-settings-store.ts';
import { BoundedSqlRuntime, createPgSettingsRuntime } from '../../../../src/runtime/sql/bounded-sql-runtime.ts';
import type { RemovalIntent, RemovedMember } from '../../../../src/accounts/organizations/removal-operation-store.ts';
import { postgresSettingsSite } from '../../../support/in-process/postgres-settings-site.ts';

type Site = Awaited<ReturnType<typeof postgresSettingsSite>>;

function intent(organizationId = 'org-a'): RemovalIntent {
  return { organizationId, operationId: randomUUID(), membershipId: 'membership-a', revision: 'opaque-revision-a', actor: { authority: 'workos', subject: 'user-a' }, startedAt: '2026-10-25T10:00:00.000Z' };
}

function removedMember(): RemovedMember {
  return { authority: 'workos', subject: 'user-removed', organizationId: 'org-a', membershipId: 'membership-removed', operationId: randomUUID(), recordedAt: '2026-11-02T10:00:00.000Z' };
}

/** Each row of the table of removed members as the owner reads it, in the shape of the record. */
async function removedRows(site: Site): Promise<RemovedMember[]> {
  const text = await site.ownerQuery(`SELECT coalesce(json_agg(json_build_object('membershipId', membership_id, 'organizationId', organization_id,
    'authority', authority, 'subject', subject, 'operationId', operation_id,
    'recordedAt', to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) ORDER BY membership_id), '[]')
    FROM thermus_admin.removed_members`);
  return JSON.parse(text) as RemovedMember[];
}

test('Given independent SQL pools, when removals contend, then one pending intent wins and another organization proceeds', async t => {
  const site = await postgresSettingsSite(t);
  const firstRuntime = createPgSettingsRuntime(site.connection);
  const secondRuntime = createPgSettingsRuntime(site.connection);
  t.after(() => Promise.all([firstRuntime.close(), secondRuntime.close()]));
  const first = new PgDestinationSettingsStore(firstRuntime);
  const second = new PgDestinationSettingsStore(secondRuntime);
  const requests = [intent(), intent()] as const;
  const results = await Promise.all([first.admitRemoval(requests[0]), second.admitRemoval(requests[1])]);
  assert.deepEqual(results.map(result => result.status).sort(), ['admitted', 'busy']);
  const winner = requests[results.findIndex(result => result.status === 'admitted')];
  assert.ok(winner, 'One competing request must own the admitted operation');
  assert.deepEqual(await second.readRemoval('org-a'), { status: 'found', operation: { ...winner, outcome: null } });
  assert.deepEqual(await second.admitRemoval(intent('org-b')), { status: 'admitted' });
  assert.deepEqual(await first.admitRemoval(intent()), { status: 'busy' });
  assert.deepEqual(await first.readRemoval('org-missing'), { status: 'absent' });
});

test('Given persisted pending and terminal operations, when pools reopen and stale completions arrive, then only the same intent can settle', async t => {
  const site = await postgresSettingsSite(t);
  const firstRuntime = createPgSettingsRuntime(site.connection);
  t.after(() => firstRuntime.close());
  const initial = intent();
  assert.deepEqual(await new PgDestinationSettingsStore(firstRuntime).admitRemoval(initial), { status: 'admitted' });
  await firstRuntime.close();
  const reopened = createPgSettingsRuntime(site.connection);
  t.after(() => reopened.close());
  const store = new PgDestinationSettingsStore(reopened);
  assert.deepEqual(await store.readRemoval('org-a'), { status: 'found', operation: { ...initial, outcome: null } });
  assert.deepEqual(await store.admitRemoval(intent()), { status: 'busy' });
  assert.deepEqual(await store.completeRemoval('org-b', initial.operationId, 'applied'), { status: 'mismatch' });
  assert.deepEqual(await store.completeRemoval('org-a', randomUUID(), 'applied'), { status: 'mismatch' });
  assert.deepEqual(await store.completeRemoval('org-a', initial.operationId, 'no-effect'), { status: 'completed' });
  assert.deepEqual(await store.completeRemoval('org-a', initial.operationId, 'no-effect'), { status: 'completed' });
  assert.deepEqual(await store.completeRemoval('org-a', initial.operationId, 'applied'), { status: 'mismatch' });
  assert.deepEqual(await store.readRemoval('org-a'), { status: 'found', operation: { ...initial, outcome: 'no-effect' } });
  const next = { ...intent(), membershipId: 'replacement-membership' };
  assert.deepEqual(await store.admitRemoval(next), { status: 'admitted' });
  assert.deepEqual(await store.completeRemoval('org-a', initial.operationId, 'no-effect'), { status: 'mismatch' });
  assert.deepEqual(await store.readRemoval('org-a'), { status: 'found', operation: { ...next, outcome: null } });
  assert.deepEqual(await store.completeRemoval('org-a', next.operationId, 'applied'), { status: 'completed' });
  await reopened.close();
  const finalRuntime = createPgSettingsRuntime(site.connection);
  t.after(() => finalRuntime.close());
  assert.deepEqual(await new PgDestinationSettingsStore(finalRuntime).readRemoval('org-a'), { status: 'found', operation: { ...next, outcome: 'applied' } });
});

test('Given committed writes whose replies are lost, when reread through a new pool, then the pending intent and same terminal receipt survive', async t => {
  const site = await postgresSettingsSite(t);
  const pool = new Pool({ connectionString: site.connection.connectionString, ssl: { rejectUnauthorized: true, ca: site.connection.ca }, max: 1 });
  const runtime = new BoundedSqlRuntime({ connect: async () => {
    const client = await pool.connect();
    return { query: async (text, values) => {
      const result = await client.query(text, values);
      if (text.startsWith('INSERT') || text.startsWith('UPDATE')) throw new Error('Connection lost after commit');
      return result;
    }, release: destroy => client.release(destroy) };
  }, end: () => pool.end(), on: (_event, listener) => pool.on('error', listener) });
  t.after(() => runtime.close());
  const store = new PgDestinationSettingsStore(runtime);
  const operation = intent();
  assert.deepEqual(await store.admitRemoval(operation), { status: 'unconfirmed' });
  assert.equal(pool.totalCount, 0, 'The failed write releases its client before returning');
  const verifyingRuntime = createPgSettingsRuntime(site.connection);
  t.after(() => verifyingRuntime.close());
  const verifier = new PgDestinationSettingsStore(verifyingRuntime);
  assert.deepEqual(await verifier.readRemoval('org-a'), { status: 'found', operation: { ...operation, outcome: null } });
  assert.deepEqual(await verifier.admitRemoval(intent()), { status: 'busy' });
  assert.deepEqual(await store.completeRemoval('org-a', operation.operationId, 'applied'), { status: 'unconfirmed' });
  assert.equal(pool.totalCount, 0);
  assert.deepEqual(await verifier.readRemoval('org-a'), { status: 'found', operation: { ...operation, outcome: 'applied' } });
});

test('Given production logging storage configuration, when settings and removal intent are used and storage closes, then both public roles share the same concrete store and closure', async t => {
  const site = await postgresSettingsSite(t);
  const directory = await mkdtemp(join(tmpdir(), 'thermus-removal-loader-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const certificate = join(directory, 'database-ca.pem');
  await writeFile(certificate, site.connection.ca);
  const errors: unknown[] = [];
  const storage = await openLoggingStorage({ DATABASE_URL: site.connection.connectionString, DATABASE_CA_CERT_PATH: certificate, LOGGING_DESTINATION_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') }, { info: () => {}, error: message => { errors.push(message); } }, 25);
  assert.ok(storage);
  t.after(() => storage.close());
  assert.ok(storage.removalStore);
  assert.equal(storage.removalStore, storage.store);
  const saved = await storage.store.save('org-loader', null, { endpoint: 'https://collector.example/v1/logs', auth: 'none', enabled: false, encryptedCredential: null });
  assert.equal(saved.status, 'saved');
  const removal = intent('org-loader');
  assert.deepEqual(await storage.removalStore.admitRemoval(removal), { status: 'admitted' });
  assert.deepEqual(await storage.removalStore.readRemoval('org-loader'), { status: 'found', operation: { ...removal, outcome: null } });
  await storage.close();
  assert.deepEqual(await storage.store.read('org-loader'), { status: 'unavailable' });
  assert.deepEqual(await storage.removalStore.readRemoval('org-loader'), { status: 'unavailable' });
  assert.deepEqual(errors, []);
});

test('Given a recorded removed member, when a new pool reads by its identity, then it is found, and another subject of the same authority and the same subject of another authority are absent', async t => {
  const site = await postgresSettingsSite(t);
  const recordingRuntime = createPgSettingsRuntime(site.connection);
  t.after(() => recordingRuntime.close());
  const record = removedMember();
  assert.deepEqual(await new PgDestinationSettingsStore(recordingRuntime).recordRemovedMember(record), { status: 'recorded' });
  await recordingRuntime.close();
  const readingRuntime = createPgSettingsRuntime(site.connection);
  t.after(() => readingRuntime.close());
  const store = new PgDestinationSettingsStore(readingRuntime);
  assert.deepEqual(await store.readRemovedMember({ authority: record.authority, subject: record.subject }), { status: 'found' });
  assert.deepEqual(await store.readRemovedMember({ authority: record.authority, subject: 'user-other' }), { status: 'absent' });
  assert.deepEqual(await store.readRemovedMember({ authority: 'other-authority', subject: record.subject }), { status: 'absent' });
});

test('Given a recorded membership, when the same membership is recorded again, also by another operation at another time, then each answer is recorded and the table still holds the one row with the first values', async t => {
  const site = await postgresSettingsSite(t);
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  const store = new PgDestinationSettingsStore(runtime);
  const first = removedMember();
  assert.deepEqual(await store.recordRemovedMember(first), { status: 'recorded' });
  assert.deepEqual(await store.recordRemovedMember(first), { status: 'recorded' }, 'The same record again');
  const later = { ...first, operationId: randomUUID(), recordedAt: '2026-11-02T11:30:00.000Z' };
  assert.deepEqual(await store.recordRemovedMember(later), { status: 'recorded' }, 'The same membership from another operation');
  assert.deepEqual(await removedRows(site), [first]);
});

test('Given the migration, when the server role changes or deletes a row, then PostgreSQL denies it, because the role holds only SELECT and INSERT, no other role holds a grant, and row-level security is on and forced', async t => {
  const site = await postgresSettingsSite(t);
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  const record = removedMember();
  assert.deepEqual(await new PgDestinationSettingsStore(runtime).recordRemovedMember(record), { status: 'recorded' });

  const grantedTo = (grantees: string) => site.ownerQuery(`SELECT privilege_type FROM information_schema.role_table_grants
    WHERE table_schema = 'thermus_admin' AND table_name = 'removed_members' AND grantee IN (${grantees}) ORDER BY 1`);
  assert.equal(await grantedTo("'thermus_logging'"), 'INSERT\nSELECT');
  assert.equal(await grantedTo("'PUBLIC', 'anon', 'authenticated', 'service_role'"), '', 'PUBLIC and the API roles of Supabase hold no grant');
  assert.equal(await site.ownerQuery("SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE oid = 'thermus_admin.removed_members'::regclass"), 't|t');
  // The runtime hides the error of a failed statement, so the session reports the message of PostgreSQL itself.
  const outcome = (statement: string) => runtime.run(async (session) => {
    try { await session.query(statement, [], true); return 'executed'; } catch (error) { return (error as Error).message; }
  });
  const denied = { status: 'complete', value: 'permission denied for table removed_members' };
  assert.deepEqual(await outcome("UPDATE thermus_admin.removed_members SET organization_id = 'org-moved'"), denied, 'The role has no UPDATE grant');
  assert.deepEqual(await outcome('DELETE FROM thermus_admin.removed_members'), denied, 'The role has no DELETE grant');
  assert.deepEqual(await removedRows(site), [record], 'The denied statements changed no row');
});

test('Given a committed record of a removed member whose reply is lost, when the member is recorded, then the answer is unconfirmed, the client is released, and a new pool finds the record', async t => {
  const site = await postgresSettingsSite(t);
  const pool = new Pool({ connectionString: site.connection.connectionString, ssl: { rejectUnauthorized: true, ca: site.connection.ca }, max: 1 });
  const runtime = new BoundedSqlRuntime({ connect: async () => {
    const client = await pool.connect();
    return { query: async (text, values) => {
      const result = await client.query(text, values);
      if (text.startsWith('INSERT')) throw new Error('Connection lost after commit');
      return result;
    }, release: destroy => client.release(destroy) };
  }, end: () => pool.end(), on: (_event, listener) => pool.on('error', listener) });
  t.after(() => runtime.close());
  const record = removedMember();
  assert.deepEqual(await new PgDestinationSettingsStore(runtime).recordRemovedMember(record), { status: 'unconfirmed' });
  assert.equal(pool.totalCount, 0, 'The failed write releases its client before returning');
  const verifyingRuntime = createPgSettingsRuntime(site.connection);
  t.after(() => verifyingRuntime.close());
  assert.deepEqual(await new PgDestinationSettingsStore(verifyingRuntime).readRemovedMember({ authority: record.authority, subject: record.subject }), { status: 'found' });
});
