import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { createPgSettingsRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import type { SqlBounds } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgTenantFleetStore } from '../../../src/tenancy/tenants/pg-tenant-fleet-store.ts';
import { postgresSettingsSite } from '../../support/in-process/postgres-settings-site.ts';

// The claim of the ticks of the tenant sweeps with the real fleet store and the sql runtime on disposable PostgreSQL
// 17, with verified test TLS and the scoped runtime role thermus_logging. Each pool stands in for one instance of the
// control plane during a deploy (SO-12 rehearsal of 31 October 2026).

type Site = Awaited<ReturnType<typeof postgresSettingsSite>>;

const tuesdayTick = '2026-11-03T04:00:00.000Z';
const wednesdayTick = '2026-11-04T04:00:00.000Z';
// The claims of the wait case wait for the insert of another session; these bounds keep them waiting.
const insertWait: Partial<SqlBounds> = { operationMs: 10_000, statementMs: 8_000 };

function storeOn(t: TestContext, site: Site, bounds: Partial<SqlBounds> = {}) {
  const runtime = createPgSettingsRuntime({ ...site.connection, bounds });
  t.after(() => runtime.close());
  return { runtime, store: new PgTenantFleetStore(runtime) };
}

// Each claimed tick as "<UTC time> <holder>".
async function claimedTicks(site: Site): Promise<string[]> {
  const text = await site.ownerQuery("SELECT to_char(tick_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') || ' ' || claimed_by FROM thermus_admin.tenant_sweep_ticks ORDER BY tick_at");
  return text === '' ? [] : text.split('\n');
}

// Another session of the runtime role inserts the row of a tick and keeps its transaction open, as the claim of another
// instance that has not committed yet; end commits or rolls it back.
async function uncommittedClaim(t: TestContext, site: Site, tickAt: string, holder: string) {
  const runtime = createPgSettingsRuntime({ ...site.connection, bounds: { operationMs: 30_000, statementMs: 30_000 } });
  const inserted = Promise.withResolvers<void>();
  const ending = Promise.withResolvers<'COMMIT' | 'ROLLBACK'>();
  const holding = runtime.run(async (session) => {
    await session.query('BEGIN');
    await session.query('INSERT INTO thermus_admin.tenant_sweep_ticks (tick_at, claimed_by) VALUES ($1::timestamptz, $2)', [tickAt, holder], true);
    inserted.resolve();
    await session.query(await ending.promise, [], true);
  });
  t.after(async () => { ending.resolve('ROLLBACK'); await holding; await runtime.close(); });
  // A failed insert ends the session at once, so the case fails at once instead of at its timeout.
  const started = await Promise.race([inserted.promise.then(() => 'inserted'), holding.then((result) => result.status)]);
  assert.equal(started, 'inserted', 'The other session inserted the claim of the tick');
  return { end: async (how: 'COMMIT' | 'ROLLBACK') => { ending.resolve(how); await holding; } };
}

// A claim that meets an uncommitted row of the same key waits for the transaction of that row.
async function untilClaimsWait(site: Site, expected: number): Promise<void> {
  const deadline = performance.now() + 5_000;
  while (await site.ownerQuery("SELECT count(*) FROM pg_locks WHERE locktype = 'transactionid' AND NOT granted") !== String(expected)) {
    assert.ok(performance.now() < deadline, `Expected ${expected} claims to wait for the uncommitted claim`);
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test('Given the migration and the scoped role, when holders claim ticks through the real SQL runtime, then the first claim of a tick adds its row with the holder, each later claim of the tick finds it taken, and the role can only read and add the rows', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const { runtime, store } = storeOn(t, site);

  assert.deepEqual(await store.claimTick(tuesdayTick, 'holder-a'), { status: 'claimed' });
  assert.deepEqual(await store.claimTick(tuesdayTick, 'holder-b'), { status: 'taken' });
  assert.deepEqual(await store.claimTick(tuesdayTick, 'holder-a'), { status: 'taken' }, 'A tick is claimed one time, also for its own holder');
  assert.deepEqual(await store.claimTick(wednesdayTick, 'holder-b'), { status: 'claimed' }, 'The next tick has its own claim');

  assert.deepEqual(await claimedTicks(site), ['2026-11-03 04:00 holder-a', '2026-11-04 04:00 holder-b']);
  assert.equal(await site.ownerQuery("SELECT bool_and(claimed_at > now() - interval '1 minute') FROM thermus_admin.tenant_sweep_ticks"), 't', 'The row keeps the time of the claim');
  const privileges = await site.ownerQuery(`SELECT string_agg(privileges.name, ', ' ORDER BY privileges.name)
    FROM unnest(ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER']) privileges(name)
    WHERE has_table_privilege('thermus_logging', 'thermus_admin.tenant_sweep_ticks', privileges.name)`);
  assert.equal(privileges, 'INSERT, SELECT');
  assert.equal(await site.ownerQuery("SELECT relrowsecurity AND relforcerowsecurity FROM pg_class WHERE oid = 'thermus_admin.tenant_sweep_ticks'::regclass"), 't');
  assert.deepEqual(await runtime.run((session) => session.query("UPDATE thermus_admin.tenant_sweep_ticks SET claimed_by = 'holder-b'")), { status: 'unavailable' }, 'The role has no UPDATE grant');
  assert.deepEqual(await runtime.run((session) => session.query('DELETE FROM thermus_admin.tenant_sweep_ticks')), { status: 'unavailable' }, 'The role has no DELETE grant');
  assert.deepEqual(await claimedTicks(site), ['2026-11-03 04:00 holder-a', '2026-11-04 04:00 holder-b']);
});

test('Given claims of one tick from two pools at the same time, when they run, then exactly one claim is claimed and the row names its holder', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const pools = [storeOn(t, site).store, storeOn(t, site).store] as const;
  const holders = ['a-1', 'b-1', 'a-2', 'b-2', 'a-3', 'b-3'];

  const results = await Promise.all(holders.map((holder, index) => pools[index % 2]?.claimTick(tuesdayTick, holder)));

  const claimed = holders.filter((_holder, index) => results[index]?.status === 'claimed');
  assert.equal(claimed.length, 1, `One claimed claim: ${JSON.stringify(results)}`);
  assert.equal(results.filter((result) => result?.status === 'taken').length, 5);
  assert.deepEqual(await claimedTicks(site), [`2026-11-03 04:00 ${claimed[0]}`]);
});

test('Given the claim of a tick that another instance inserted and has not committed, when it commits, then a waiting claim of each pool finds the tick taken; and when it rolls back, the first waiting claim is claimed', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const pools = [storeOn(t, site, insertWait).store, storeOn(t, site, insertWait).store] as const;

  const committing = await uncommittedClaim(t, site, tuesdayTick, 'holder-old');
  const afterCommit = Promise.all(pools.map((pool, index) => pool.claimTick(tuesdayTick, `holder-${index}`)));
  await untilClaimsWait(site, 2);
  await committing.end('COMMIT');
  assert.deepEqual((await afterCommit).map(({ status }) => status), ['taken', 'taken']);

  const rollingBack = await uncommittedClaim(t, site, wednesdayTick, 'holder-old');
  const afterRollback = Promise.all(pools.map((pool, index) => pool.claimTick(wednesdayTick, `holder-${index}`)));
  await untilClaimsWait(site, 2);
  await rollingBack.end('ROLLBACK');
  const results = (await afterRollback).map(({ status }) => status);
  assert.deepEqual(results.toSorted(), ['claimed', 'taken']);

  assert.deepEqual(await claimedTicks(site), ['2026-11-03 04:00 holder-old', `2026-11-04 04:00 holder-${results.indexOf('claimed')}`]);
});

test('Given a registry without the table of the ticks, as before its migration, when a holder claims a tick, then the claim is unavailable', { timeout: 60_000 }, async (t) => {
  const site = await postgresSettingsSite(t);
  const { store } = storeOn(t, site);
  await site.ownerQuery('DROP TABLE thermus_admin.tenant_sweep_ticks');

  assert.deepEqual(await store.claimTick(tuesdayTick, 'holder-a'), { status: 'unavailable' });
});
