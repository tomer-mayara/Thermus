import assert from 'node:assert/strict';
import test from 'node:test';
import { PgDestinationSettingsStore } from '../../../../src/logs/audit/pg-destination-settings-store.ts';
import { createPgSettingsRuntime } from '../../../../src/logs/audit/bounded-sql-runtime.ts';
import { postgresSettingsSite } from '../../../support/in-process/postgres-settings-site.ts';

const desired = { endpoint: 'https://collector.example/v1/logs', auth: 'bearer' as const, enabled: true, encryptedCredential: 'opaque-ciphertext' };

test('Given tenant settings, when the SQL runtime reopens, then committed settings persist and other tenants stay isolated', async (t) => {
  const site = await postgresSettingsSite(t);
  const first = createPgSettingsRuntime(site.connection);
  const store = new PgDestinationSettingsStore(first);
  const saved = await store.save('tenant-a', null, desired);
  assert.equal(saved.status, 'saved');
  await first.close();
  const reopened = createPgSettingsRuntime(site.connection);
  t.after(() => reopened.close());
  const next = new PgDestinationSettingsStore(reopened);
  assert.deepEqual(await next.read('tenant-a'), { status: 'found', settings: saved.status === 'saved' ? saved.settings : undefined });
  assert.deepEqual(await next.read('tenant-b'), { status: 'absent' });
  assert.deepEqual(await next.save('tenant-b', saved.status === 'saved' ? saved.settings.revision : '', desired), { status: 'conflict' });
});

test('Given competing first saves, when both expect absence, then one commits and the other conflicts', async (t) => {
  const site = await postgresSettingsSite(t);
  const runtime = createPgSettingsRuntime(site.connection);
  t.after(() => runtime.close());
  const store = new PgDestinationSettingsStore(runtime);
  const outcomes = await Promise.all([store.save('tenant-a', null, desired), store.save('tenant-a', null, desired)]);
  assert.deepEqual(outcomes.map((result) => result.status).sort(), ['conflict', 'saved']);
});

test('Given a real SQL query that stalls, when a storage deadline passes, then callers return and late work stays bounded', async (t) => {
  const site = await postgresSettingsSite(t);
  const runtime = createPgSettingsRuntime({ ...site.connection, bounds: { active: 1, pending: 0, operationMs: 60, statementMs: 1000 } });
  t.after(() => runtime.close());
  const start = Date.now();
  const stalled = runtime.run(async (session) => { await session.query('SELECT pg_sleep(5)'); return 'late'; });
  assert.deepEqual(await runtime.run(async () => 'overflow'), { status: 'unavailable' });
  assert.deepEqual(await stalled, { status: 'unavailable' });
  assert.ok(Date.now() - start < 1000);
});

test('Given a table lock in real PostgreSQL, when public settings calls stall, then reads fail safely and writes remain unconfirmed', async (t) => {
  const site = await postgresSettingsSite(t);
  const holder = createPgSettingsRuntime(site.connection);
  const runtime = createPgSettingsRuntime({ ...site.connection, bounds: { operationMs: 80 } });
  let release!: () => void;
  let locked!: () => void;
  const acquired = new Promise<void>((resolve) => { locked = resolve; });
  const unblock = new Promise<void>((resolve) => { release = resolve; });
  t.after(async () => { release(); await Promise.all([holder.close(), runtime.close()]); });
  const holding = holder.run(async (session) => {
    await session.query('BEGIN');
    await session.query('LOCK TABLE thermus_admin.logging_destination_settings IN ACCESS EXCLUSIVE MODE');
    locked();
    await unblock;
    await session.query('ROLLBACK');
  });
  await acquired;
  const store = new PgDestinationSettingsStore(runtime);
  const started = Date.now();
  assert.deepEqual(await store.read('a'), { status: 'unavailable' });
  assert.deepEqual(await store.save('a', null, desired), { status: 'unconfirmed' });
  assert.ok(Date.now() - started < 1000);
  release();
  await holding;
});
