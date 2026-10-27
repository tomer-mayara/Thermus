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
import type { RemovalIntent } from '../../../../src/accounts/organizations/removal-operation-store.ts';
import { postgresSettingsSite } from '../../../support/in-process/postgres-settings-site.ts';

function intent(organizationId = 'org-a'): RemovalIntent {
  return { organizationId, operationId: randomUUID(), membershipId: 'membership-a', revision: 'opaque-revision-a', actor: { authority: 'workos', subject: 'user-a' }, startedAt: '2026-10-25T10:00:00.000Z' };
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
