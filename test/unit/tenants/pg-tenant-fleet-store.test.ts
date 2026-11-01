import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { BoundedSqlRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgTenantFleetStore } from '../../../src/tenancy/tenants/pg-tenant-fleet-store.ts';
import type { RegistryCount } from '../../../src/tenancy/tenants/tenant-registry-store.ts';

// The SQL adapter of the fleet statements on the real bounded runtime over a client double: each statement, the state
// that it starts from, its values, and its outcome.

type Rows = Record<string, unknown>[];

const readFleet = /^SELECT organization_id, state, plan, applied_plan, render_service_id, service_name, internal_url, image_digest,\s+failure_reason, last_active_at, created_at, updated_at FROM thermus_admin\.tenants ORDER BY organization_id$/;
const readIdle = /^SELECT organization_id, state, plan, applied_plan, render_service_id, service_name, internal_url, image_digest,\s+failure_reason, last_active_at, created_at, updated_at FROM thermus_admin\.tenants\s+WHERE state = 'live' AND render_service_id IS NOT NULL AND plan = \$1 AND COALESCE\(last_active_at, created_at\) <= \$2::timestamptz\s+ORDER BY organization_id$/;
const markDeleted = /^UPDATE thermus_admin\.tenants SET state = 'deleted', internal_url = NULL, updated_at = now\(\)\s+WHERE organization_id = \$1 AND state = \$2 AND state <> 'deleted' AND render_service_id IS NOT DISTINCT FROM \$3 RETURNING organization_id$/;
const markSuspended = /^UPDATE thermus_admin\.tenants SET state = 'suspended', updated_at = now\(\)\s+WHERE organization_id = \$1 AND state = 'live' AND render_service_id = \$2 RETURNING organization_id$/;
const markResumed = /^UPDATE thermus_admin\.tenants SET state = 'deploying', updated_at = now\(\)\s+WHERE organization_id = \$1 AND state = 'suspended' AND render_service_id = \$2 RETURNING organization_id$/;
const recordDigest = /^UPDATE thermus_admin\.tenants SET image_digest = \$3, updated_at = now\(\)\s+WHERE organization_id = \$1 AND render_service_id = \$2 AND state = 'live' RETURNING organization_id$/;
const lock = 'LOCK TABLE thermus_admin.tenants IN SHARE ROW EXCLUSIVE MODE';
const count = /^SELECT state, count\(\*\)::integer AS rows, bool_or\(organization_id = \$1\) AS current\s+FROM thermus_admin\.tenants GROUP BY state$/;
const claimTick = /^INSERT INTO thermus_admin\.tenant_sweep_ticks \(tick_at, claimed_by\) VALUES \(\$1::timestamptz, \$2\)\s+ON CONFLICT \(tick_at\) DO NOTHING RETURNING tick_at$/;
const tickHolder = 'SELECT claimed_by FROM thermus_admin.tenant_sweep_ticks WHERE tick_at = $1::timestamptz';
const revive = /^UPDATE thermus_admin\.tenants SET state = 'requested', render_service_id = NULL, service_name = NULL, internal_url = NULL,\s+plan = NULL, applied_plan = NULL, image_digest = NULL, last_active_at = NULL, failure_reason = NULL, created_at = now\(\), updated_at = now\(\)\s+WHERE organization_id = \$1 AND state = 'deleted'$/;

function fleetStore(t: TestContext, answer: (text: string) => Rows | Error) {
  const queries: { readonly text: string; readonly values?: unknown[] }[] = [];
  const releases: boolean[] = [];
  const runtime = new BoundedSqlRuntime({
    connect: async () => ({
      query: async (text: string, values?: unknown[]) => {
        queries.push({ text, values });
        const rows = answer(text);
        if (rows instanceof Error) throw rows;
        return { rows };
      },
      release: (destroy?: boolean) => { releases.push(Boolean(destroy)); },
    }),
    end: async () => {}, on: () => {},
  });
  t.after(() => runtime.close());
  return { store: new PgTenantFleetStore(runtime), queries, releases, texts: () => queries.map(({ text }) => text) };
}

const changed = (pattern: RegExp) => (text: string): Rows => pattern.test(text) ? [{ organization_id: 'org_01A' }] : [];

test('Given rows in the registry, when the fleet is read, then one SELECT gives every row with its times in ISO 8601', async (t) => {
  const { store, texts } = fleetStore(t, (text) => readFleet.test(text) ? [{
    organization_id: 'org_01A', state: 'live', plan: '0.5c-512mb', applied_plan: '0.5c-512mb', render_service_id: 'srv-a', service_name: 'thermus-tenant-org-01a',
    internal_url: 'http://thermus-tenant-org-01a:8080', image_digest: `sha256:${'a'.repeat(64)}`, failure_reason: null,
    last_active_at: null, created_at: new Date('2026-10-28T01:00:00Z'), updated_at: new Date('2026-10-28T02:00:00Z'),
  }, {
    organization_id: 'org_01B', state: 'requested', plan: null, applied_plan: null, render_service_id: null, service_name: null, internal_url: null,
    image_digest: null, failure_reason: null, last_active_at: new Date('2026-10-28T03:00:00Z'), created_at: new Date('2026-10-28T03:00:00Z'), updated_at: new Date('2026-10-28T03:00:00Z'),
  }] : []);

  assert.deepEqual(await store.readFleet(), {
    status: 'complete',
    rows: [{
      organizationId: 'org_01A', state: 'live', plan: '0.5c-512mb', appliedPlan: '0.5c-512mb', serviceId: 'srv-a', serviceName: 'thermus-tenant-org-01a',
      internalUrl: 'http://thermus-tenant-org-01a:8080', imageDigest: `sha256:${'a'.repeat(64)}`, failureReason: null,
      lastActiveAt: null, createdAt: '2026-10-28T01:00:00.000Z', updatedAt: '2026-10-28T02:00:00.000Z',
    }, {
      organizationId: 'org_01B', state: 'requested', plan: null, appliedPlan: null, serviceId: null, serviceName: null, internalUrl: null,
      imageDigest: null, failureReason: null, lastActiveAt: '2026-10-28T03:00:00.000Z', createdAt: '2026-10-28T03:00:00.000Z', updatedAt: '2026-10-28T03:00:00.000Z',
    }],
  });
  assert.equal(texts().length, 1);
});

test('Given a registry that cannot be read, when the fleet is read, then the read is unavailable', async (t) => {
  const { store, releases } = fleetStore(t, () => new Error('connection refused'));
  assert.deepEqual(await store.readFleet(), { status: 'unavailable' });
  assert.deepEqual(releases, [true]);
});

test('Given a free plan and a cutoff, when the idle rows are read, then one SELECT gives the live rows of that plan with a service whose last use, or creation without a use, is at or before the cutoff', async (t) => {
  const { store, queries } = fleetStore(t, (text) => readIdle.test(text) ? [{
    organization_id: 'org_01A', state: 'live', plan: '0.5c-512mb', applied_plan: '0.5c-512mb', render_service_id: 'srv-a', service_name: 'thermus-tenant-org-01a',
    internal_url: 'http://thermus-tenant-org-01a:8080', image_digest: null, failure_reason: null,
    last_active_at: null, created_at: new Date('2026-10-01T08:00:00Z'), updated_at: new Date('2026-10-01T08:02:00Z'),
  }] : []);

  const idle = await store.readIdle('0.5c-512mb', '2026-10-20T04:00:00.000Z');

  assert.deepEqual(idle, {
    status: 'complete',
    rows: [{
      organizationId: 'org_01A', state: 'live', plan: '0.5c-512mb', appliedPlan: '0.5c-512mb', serviceId: 'srv-a', serviceName: 'thermus-tenant-org-01a',
      internalUrl: 'http://thermus-tenant-org-01a:8080', imageDigest: null, failureReason: null,
      lastActiveAt: null, createdAt: '2026-10-01T08:00:00.000Z', updatedAt: '2026-10-01T08:02:00.000Z',
    }],
  });
  assert.equal(queries.length, 1);
  assert.deepEqual(queries[0]?.values, ['0.5c-512mb', '2026-10-20T04:00:00.000Z']);
  const failed = fleetStore(t, () => new Error('connection refused'));
  assert.deepEqual(await failed.store.readIdle('0.5c-512mb', '2026-10-20T04:00:00.000Z'), { status: 'unavailable' });
});

test('Given a row in the state and on the service that the caller read, when it is marked deleted, then one UPDATE from that state and that service ends its route', async (t) => {
  const { store, queries } = fleetStore(t, changed(markDeleted));
  assert.deepEqual(await store.markDeleted('org_01A', 'suspended', 'srv-a'), { status: 'recorded' });
  assert.match(queries[0]?.text ?? '', markDeleted);
  assert.deepEqual(queries[0]?.values, ['org_01A', 'suspended', 'srv-a']);
  assert.deepEqual(await store.markDeleted('org_01A', 'requested', null), { status: 'recorded' }, 'A row without a service binds to no service');
  assert.deepEqual(queries[1]?.values, ['org_01A', 'requested', null]);
});

test('Given a row that another writer moved, or a write that fails, when it is marked deleted, then the result is moved or unavailable', async (t) => {
  const moved = fleetStore(t, () => []);
  assert.deepEqual(await moved.store.markDeleted('org_01A', 'live', 'srv-a'), { status: 'moved' });
  const failed = fleetStore(t, () => new Error('connection reset'));
  assert.deepEqual(await failed.store.markDeleted('org_01A', 'live', 'srv-a'), { status: 'unavailable' });
});

test('Given a live row, when it is marked suspended, and a suspended row, when it is marked resumed, then each UPDATE names its start state and the service that the caller read', async (t) => {
  const suspended = fleetStore(t, changed(markSuspended));
  assert.deepEqual(await suspended.store.markSuspended('org_01A', 'srv-a'), { status: 'recorded' });
  assert.deepEqual(suspended.queries[0]?.values, ['org_01A', 'srv-a']);
  const resumed = fleetStore(t, changed(markResumed));
  assert.deepEqual(await resumed.store.markResumed('org_01A', 'srv-a'), { status: 'recorded' });
  assert.deepEqual(resumed.queries[0]?.values, ['org_01A', 'srv-a']);
  const notLive = fleetStore(t, () => []);
  assert.deepEqual(await notLive.store.markSuspended('org_01A', 'srv-a'), { status: 'moved' });
  assert.deepEqual(await notLive.store.markResumed('org_01A', 'srv-a'), { status: 'moved' });
});

test('Given a live row on the service of the upgrade, when the digest is recorded, then one UPDATE names the service and the live state', async (t) => {
  const digest = `sha256:${'b'.repeat(64)}`;
  const { store, queries } = fleetStore(t, changed(recordDigest));
  assert.deepEqual(await store.recordDigest('org_01A', 'srv-a', digest), { status: 'recorded' });
  assert.deepEqual(queries[0]?.values, ['org_01A', 'srv-a', digest]);
  const other = fleetStore(t, () => []);
  assert.deepEqual(await other.store.recordDigest('org_01A', 'srv-other', digest), { status: 'moved' });
});

test('Given a tick that no holder claimed, when a holder claims it, then one INSERT of the tick and the holder adds the row of the tick, and the tick is claimed', async (t) => {
  const { store, queries, releases } = fleetStore(t, (text) => claimTick.test(text) ? [{ tick_at: new Date('2026-11-03T04:00:00Z') }] : []);
  assert.deepEqual(await store.claimTick('2026-11-03T04:00:00.000Z', 'holder-a'), { status: 'claimed' });
  assert.equal(queries.length, 1);
  assert.match(queries[0]?.text ?? '', claimTick);
  assert.deepEqual(queries[0]?.values, ['2026-11-03T04:00:00.000Z', 'holder-a']);
  assert.deepEqual(releases, [false]);
});

test('Given a tick that another holder claimed, when a holder claims it, then the INSERT adds nothing, the read of the holder finds the other one, and the claim is taken', async (t) => {
  const { store, queries } = fleetStore(t, (text) => text === tickHolder ? [{ claimed_by: 'holder-a' }] : []);
  assert.deepEqual(await store.claimTick('2026-11-03T04:00:00.000Z', 'holder-b'), { status: 'taken' });
  assert.match(queries[0]?.text ?? '', claimTick);
  assert.deepEqual(queries.slice(1), [{ text: tickHolder, values: ['2026-11-03T04:00:00.000Z'] }]);
});

test('Given a tick that this holder claimed while the answer got lost, when it claims the tick again, then the read of the holder finds it, and the claim is claimed', async (t) => {
  const { store } = fleetStore(t, (text) => text === tickHolder ? [{ claimed_by: 'holder-a' }] : []);
  assert.deepEqual(await store.claimTick('2026-11-03T04:00:00.000Z', 'holder-a'), { status: 'claimed' });
});

test('Given a claim that fails, when a holder claims a tick, then the claim is unavailable', async (t) => {
  const missing = fleetStore(t, () => new Error('relation "thermus_admin.tenant_sweep_ticks" does not exist'));
  assert.deepEqual(await missing.store.claimTick('2026-11-03T04:00:00.000Z', 'holder-b'), { status: 'unavailable' }, 'An unconfirmed claim is unavailable too');
  assert.deepEqual(missing.releases, [true]);
});

function counted(rows: Rows): (text: string) => Rows {
  return (text) => count.test(text) ? rows : [];
}

test('Given a deleted row and a free place, when it is revived, then one transaction locks the registry, counts the rows, moves the row to requested as a new request, and commits', async (t) => {
  const { store, queries, releases } = fleetStore(t, counted([{ state: 'deleted', rows: 1, current: true }, { state: 'live', rows: 2, current: false }]));
  const seen: RegistryCount[] = [];

  assert.deepEqual(await store.reviveDeleted('org_01A', (registry) => { seen.push(registry); return true; }), { status: 'revived' });

  assert.deepEqual(queries.map(({ text }) => text.replace(/\s+/g, ' ')).slice(0, 2), ['BEGIN', lock]);
  assert.match(queries[2]?.text ?? '', count);
  assert.deepEqual(queries[2]?.values, ['org_01A']);
  assert.match(queries[3]?.text ?? '', revive);
  assert.deepEqual(queries[3]?.values, ['org_01A']);
  assert.equal(queries[4]?.text, 'COMMIT');
  assert.deepEqual(seen, [{ current: 'deleted', rowsByState: new Map([['deleted', 1], ['live', 2]]) }]);
  assert.deepEqual(releases, [false]);
});

test('Given a decision that refuses the revive, when it is revived, then nothing changes and the count comes back', async (t) => {
  const { store, texts } = fleetStore(t, counted([{ state: 'live', rows: 25, current: false }, { state: 'deleted', rows: 1, current: true }]));
  assert.deepEqual(await store.reviveDeleted('org_01A', () => false), { status: 'refused', count: { current: 'deleted', rowsByState: new Map([['live', 25], ['deleted', 1]]) } });
  assert.ok(texts().every((text) => !revive.test(text)));
  assert.equal(texts().at(-1), 'COMMIT');
});

test('Given a failure before or after the revive statement, when it is revived, then the result is unavailable or unconfirmed and the client is destroyed', async (t) => {
  const before = fleetStore(t, (text) => text === lock ? new Error('lock timeout') : []);
  assert.deepEqual(await before.store.reviveDeleted('org_01A', () => true), { status: 'unavailable' });
  assert.deepEqual(before.releases, [true]);
  const after = fleetStore(t, (text) => text === 'COMMIT' ? new Error('connection reset') : counted([{ state: 'deleted', rows: 1, current: true }])(text));
  assert.deepEqual(await after.store.reviveDeleted('org_01A', () => true), { status: 'unconfirmed' });
  assert.deepEqual(after.releases, [true]);
});
