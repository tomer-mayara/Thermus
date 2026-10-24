import assert from 'node:assert/strict';
import test from 'node:test';
import { PgDestinationSettingsStore } from '../../../../src/logs/audit/pg-destination-settings-store.ts';
import { createPgSettingsRuntime } from '../../../../src/logs/audit/bounded-sql-runtime.ts';
import { postgresSettingsSite } from '../../../support/in-process/postgres-settings-site.ts';

const desired = { endpoint: 'https://collector.example/v1/logs', auth: 'none' as const, enabled: false, encryptedCredential: null };

test('Given real PostgreSQL, when saves compete or repeat, then only actual changes advance the scoped revision', async (t) => {
  const site = await postgresSettingsSite(t);
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  const store = new PgDestinationSettingsStore(runtime);
  const first = await store.save('a', null, desired);
  assert.equal(first.status, 'saved');
  if (first.status !== 'saved') throw new Error('Expected committed fixture');
  assert.deepEqual(await store.save('a', first.settings.revision, desired), { status: 'unchanged', settings: first.settings });
  const outcomes = await Promise.all([
    store.save('a', first.settings.revision, { ...desired, enabled: true }),
    store.save('a', first.settings.revision, { ...desired, endpoint: 'https://other.example' }),
  ]);
  assert.deepEqual(outcomes.map((result) => result.status).sort(), ['conflict', 'saved']);
  const current = await store.read('a');
  assert.equal(current.status, 'found');
  if (current.status !== 'found') throw new Error('Expected persisted fixture');
  assert.notEqual(current.settings.revision, first.settings.revision);
  assert.deepEqual(await store.save('b', current.settings.revision, desired), { status: 'conflict' });
  const disabled = await store.save('a', current.settings.revision, desired);
  assert.equal(disabled.status, 'saved');
  if (disabled.status !== 'saved') throw new Error('Expected disable');
  const enabled = await store.save('a', disabled.settings.revision, { ...desired, enabled: true });
  assert.equal(enabled.status, 'saved');
  if (enabled.status !== 'saved') throw new Error('Expected enable');
  assert.notEqual(enabled.settings.revision, disabled.settings.revision);
});

test('Given an untrusted certificate, when settings are read, then verified TLS rejects the connection safely', async (t) => {
  const site = await postgresSettingsSite(t);
  const runtime = createPgSettingsRuntime({ connectionString: site.connection.connectionString });
  t.after(() => runtime.close());
  assert.deepEqual(await new PgDestinationSettingsStore(runtime).read('a'), { status: 'unavailable' });
});

test('Given conflicting ambient PostgreSQL variables, when an explicit runtime connects, then its scoped verified configuration wins', async (t) => {
  const site = await postgresSettingsSite(t);
  const previous = { ...process.env };
  t.after(() => { for (const key of ['PGUSER', 'PGPASSWORD', 'PGHOST', 'PGPORT', 'PGDATABASE', 'PGSSLMODE', 'PGSSLNEGOTIATION', 'PGOPTIONS']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; } });
  Object.assign(process.env, { PGUSER: 'wrong', PGPASSWORD: 'wrong', PGHOST: '/tmp', PGPORT: '1', PGDATABASE: 'wrong', PGSSLMODE: 'disable', PGSSLNEGOTIATION: 'invalid', PGOPTIONS: '-c search_path=unrelated' });
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  assert.deepEqual(await new PgDestinationSettingsStore(runtime).read('a'), { status: 'absent' });
});

test('Given a live PostgreSQL query, when local shutdown closes its socket, then the caller settles and late server work ends within its statement deadline', async (t) => {
  const site = await postgresSettingsSite(t);
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  const result = runtime.run(async (session) => { await session.query('SELECT pg_sleep(30)'); });
  const observationDeadline = Date.now() + 1000;
  let active = await site.settingsConnections(true);
  while (active === 0 && Date.now() < observationDeadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    active = await site.settingsConnections(true);
  }
  assert.equal(active, 1, 'The backend must run the query before shutdown begins');
  const before = Date.now();
  await runtime.close();
  assert.ok(Date.now() - before < 2000);
  assert.deepEqual(await result, { status: 'unavailable' });
  let connections = await site.settingsConnections();
  while (connections > 0 && Date.now() - before < 2000) {
    await new Promise((resolve) => setTimeout(resolve, 25));
    connections = await site.settingsConnections();
  }
  assert.equal(connections, 0);
  assert.ok(Date.now() - before < 2100);
});

test('Given a trusted certificate for a different hostname, when settings are read, then hostname verification rejects it', async (t) => {
  const site = await postgresSettingsSite(t, 'DNS:other.invalid');
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  assert.deepEqual(await new PgDestinationSettingsStore(runtime).read('a'), { status: 'unavailable' });
});

test('Given an idle database disconnect, when PostgreSQL terminates the connection, then later explicit reads can recover', async (t) => {
  const site = await postgresSettingsSite(t);
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  const store = new PgDestinationSettingsStore(runtime);
  assert.deepEqual(await store.read('a'), { status: 'absent' });
  await site.disconnectIdleSettingsConnections();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(await store.read('a'), { status: 'absent' });
});
