import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { BoundedSqlRuntime } from '../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgTenantRegistryStore } from '../../../src/tenancy/tenants/pg-tenant-registry-store.ts';
import type { RegistryCount } from '../../../src/tenancy/tenants/tenant-registry-store.ts';

type Rows = Record<string, unknown>[];

const lock = 'LOCK TABLE thermus_admin.tenants IN SHARE ROW EXCLUSIVE MODE';
const count = /^SELECT state, count\(\*\)::integer AS rows, bool_or\(organization_id = \$1\) AS current\s+FROM thermus_admin\.tenants GROUP BY state$/;
const insert = "INSERT INTO thermus_admin.tenants (organization_id, state) VALUES ($1, 'requested')";
const routes = `SELECT organization_id, state, internal_url, extract(epoch FROM now() - updated_at)::float8 * 1000 AS since_change_ms
  FROM thermus_admin.tenants`;

function registryStore(t: TestContext, answer: (text: string) => Rows | Error) {
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
  return { store: new PgTenantRegistryStore(runtime), queries, releases };
}

function counted(rows: Rows): (text: string) => Rows {
  return (text) => count.test(text) ? rows : [];
}

test('Given a free place, when a request is admitted, then one transaction locks the registry, counts the rows, inserts the requested row, and commits', async (t) => {
  const { store, queries, releases } = registryStore(t, counted([{ state: 'live', rows: 2, current: false }, { state: 'failed', rows: 1, current: false }]));
  const seen: RegistryCount[] = [];
  assert.deepEqual(await store.insertRequested('org_A', (registry) => { seen.push(registry); return true; }), { status: 'inserted' });
  assert.deepEqual(seen, [{ rowsByState: new Map([['live', 2], ['failed', 1]]) }]);
  assert.deepEqual(queries.map(({ text }) => text).filter((text) => !count.test(text)), ['BEGIN', lock, insert, 'COMMIT']);
  assert.match(queries[2]?.text ?? '', count);
  assert.deepEqual(queries.map(({ values }) => values), [undefined, undefined, ['org_A'], ['org_A'], []]);
  assert.deepEqual(releases, [false]);
});

test('Given the row of the organization, when the decision refuses, then the transaction commits without an insert and returns the count it saw', async (t) => {
  const { store, queries, releases } = registryStore(t, counted([{ state: 'live', rows: 1, current: true }, { state: 'requested', rows: 3, current: false }]));
  assert.deepEqual(await store.insertRequested('org_A', () => false), { status: 'refused', count: { current: 'live', rowsByState: new Map([['live', 1], ['requested', 3]]) } });
  assert.deepEqual(queries.map(({ text }) => text).filter((text) => !count.test(text)), ['BEGIN', lock, 'COMMIT']);
  assert.deepEqual(releases, [false]);
});

test('Given an empty registry, when a request counts the rows, then the count has no row and no current state', async (t) => {
  const { store } = registryStore(t, counted([]));
  assert.deepEqual(await store.insertRequested('org_A', () => false), { status: 'refused', count: { rowsByState: new Map() } });
});

test('Given a query failure, when a request runs, then it is unavailable before the insert and unconfirmed after it, and the client is destroyed', async (t) => {
  const beforeInsert = registryStore(t, (text) => text === lock ? new Error('private lock details') : []);
  assert.deepEqual(await beforeInsert.store.insertRequested('org_A', () => true), { status: 'unavailable' });
  assert.deepEqual(beforeInsert.releases, [true]);
  const atCommit = registryStore(t, (text) => text === 'COMMIT' ? new Error('private commit details') : []);
  assert.deepEqual(await atCommit.store.insertRequested('org_A', () => true), { status: 'unconfirmed' });
  assert.deepEqual(atCommit.releases, [true]);
});

test('Given a decision that throws, when a request runs, then it is unavailable, nothing is inserted, and the open transaction is destroyed', async (t) => {
  const { store, queries, releases } = registryStore(t, counted([]));
  assert.deepEqual(await store.insertRequested('org_A', () => { throw new Error('decision failure'); }), { status: 'unavailable' });
  assert.equal(queries.some(({ text }) => text === insert || text === 'COMMIT'), false);
  assert.deepEqual(releases, [true]);
});

test('Given failed acquisition, when a request or a read runs, then no write is claimed', async (t) => {
  const runtime = new BoundedSqlRuntime({ connect: async () => { throw new Error('private connection'); }, end: async () => {}, on: () => {} });
  t.after(() => runtime.close());
  const store = new PgTenantRegistryStore(runtime);
  assert.deepEqual(await store.insertRequested('org_A', () => true), { status: 'unavailable' });
  assert.deepEqual(await store.readRoutes(), { status: 'unavailable' });
});

test('Given registry rows, when the routes are read, then one plain read maps each organization to its state, its internal address, and the time since the last change of its row', async (t) => {
  const { store, queries, releases } = registryStore(t, (text) => text === routes ? [
    { organization_id: 'org_A', state: 'live', internal_url: 'http://thermus-tenant-org-a:8080', since_change_ms: 30_000.25 },
    { organization_id: 'org_B', state: 'requested', internal_url: null, since_change_ms: 4.5 },
  ] : new Error('unexpected statement'));
  assert.deepEqual(await store.readRoutes(), { status: 'complete', routes: new Map([
    ['org_A', { state: 'live', internalUrl: 'http://thermus-tenant-org-a:8080', sinceChangeMs: 30_000.25 }],
    ['org_B', { state: 'requested', internalUrl: null, sinceChangeMs: 4.5 }],
  ]) });
  assert.deepEqual(queries, [{ text: routes, values: undefined }]);
  assert.deepEqual(releases, [false]);
});

test('Given a failed read, when the routes are read, then the result is unavailable without the cause', async (t) => {
  const { store } = registryStore(t, () => new Error('private storage details'));
  assert.deepEqual(await store.readRoutes(), { status: 'unavailable' });
});

const markResuming = `UPDATE thermus_admin.tenants SET state = 'deploying', updated_at = now()
  WHERE organization_id = $1 AND state = 'suspended' AND render_service_id IS NOT NULL RETURNING render_service_id`;
const restoreSuspended = `UPDATE thermus_admin.tenants SET state = 'suspended', updated_at = now()
  WHERE organization_id = $1 AND state = 'deploying' AND render_service_id = $2 RETURNING organization_id`;
const recordActive = 'UPDATE thermus_admin.tenants SET last_active_at = now() WHERE organization_id = $1 RETURNING organization_id';

test('Given a suspended row, when the gateway marks it resuming, then one write moves only a suspended row with a service ID to deploying and gives that service ID', async (t) => {
  const { store, queries, releases } = registryStore(t, (text) => text === markResuming ? [{ render_service_id: 'srv-a' }] : new Error('unexpected statement'));
  assert.deepEqual(await store.markResuming('org_A'), { status: 'resuming', serviceId: 'srv-a' });
  assert.deepEqual(queries, [{ text: markResuming, values: ['org_A'] }]);
  assert.deepEqual(releases, [false]);
});

test('Given no row in the state that a gateway write starts from, when the gateway writes, then the result is moved', async (t) => {
  const { store } = registryStore(t, () => []);
  assert.deepEqual(await store.markResuming('org_A'), { status: 'moved' });
  assert.deepEqual(await store.restoreSuspended('org_A', 'srv-a'), { status: 'moved' });
  assert.deepEqual(await store.recordActive('org_A'), { status: 'moved' });
});

test('Given a deploying row after a failed resume, when the gateway restores it, then one write moves only a deploying row on the service of the mark back to suspended', async (t) => {
  const { store, queries } = registryStore(t, (text) => text === restoreSuspended ? [{ organization_id: 'org_A' }] : new Error('unexpected statement'));
  assert.deepEqual(await store.restoreSuspended('org_A', 'srv-a'), { status: 'recorded' });
  assert.deepEqual(queries, [{ text: restoreSuspended, values: ['org_A', 'srv-a'] }]);
});

test('Given a row, when the gateway records its use, then one write sets last_active_at to the database time and keeps the state and updated_at', async (t) => {
  const { store, queries } = registryStore(t, (text) => text === recordActive ? [{ organization_id: 'org_A' }] : new Error('unexpected statement'));
  assert.deepEqual(await store.recordActive('org_A'), { status: 'recorded' });
  assert.deepEqual(queries, [{ text: recordActive, values: ['org_A'] }]);
});

test('Given a failed write, when the gateway writes, then the result is unavailable without the cause', async (t) => {
  const { store } = registryStore(t, () => new Error('private storage details'));
  assert.deepEqual(await store.markResuming('org_A'), { status: 'unavailable' });
  assert.deepEqual(await store.restoreSuspended('org_A', 'srv-a'), { status: 'unavailable' });
  assert.deepEqual(await store.recordActive('org_A'), { status: 'unavailable' });
});
