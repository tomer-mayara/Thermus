import assert from 'node:assert/strict';
import test from 'node:test';
import { BoundedSqlRuntime } from '../../../src/logs/audit/bounded-sql-runtime.ts';

interface TestSqlClient {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(destroy?: boolean): void;
}

test('Given stalled acquisition, when caller expires, then late work retains its slot and its client is destroyed', async () => {
  let finish!: (client: TestSqlClient) => void;
  const releases: boolean[] = [];
  const pool = { connect: () => new Promise<TestSqlClient>((resolve) => { finish = resolve; }), end: async () => {}, on: () => {} };
  const runtime = new BoundedSqlRuntime(pool, { active: 1, pending: 0, operationMs: 20, acquisitionMs: 100 });
  assert.deepEqual(await runtime.run(async () => 'late'), { status: 'unavailable' });
  assert.deepEqual(await runtime.run(async () => 'overflow'), { status: 'unavailable' });
  finish({ query: async () => ({ rows: [] }), release: (destroy: boolean) => releases.push(destroy) });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(releases, [true]);
  await runtime.close();
});

test('Given stalled write, when caller expires, then completion is unconfirmed and late results are suppressed', async () => {
  let finish!: () => void;
  const releases: boolean[] = [];
  const pool = { connect: async () => ({ query: () => new Promise<{rows: never[]}>((resolve) => { finish = () => resolve({ rows: [] }); }), release: (destroy?: boolean) => releases.push(Boolean(destroy)) }), end: async () => {}, on: () => {} };
  const runtime = new BoundedSqlRuntime(pool, { active: 1, pending: 0, operationMs: 20 });
  assert.deepEqual(await runtime.run(async (session) => { await session.query('write', [], true); return 'late'; }), { status: 'unconfirmed' });
  assert.deepEqual(await runtime.run(async () => 'overflow'), { status: 'unavailable' });
  finish();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(releases, [true]);
  await runtime.close();
});

test('Given acquisition has a shorter deadline, when no client arrives, then callers return at acquisition deadline', async () => {
  let finish!: (client: { query(): Promise<{ rows: never[] }>; release(): void }) => void;
  const runtime = new BoundedSqlRuntime({ connect: () => new Promise((resolve) => { finish = resolve; }), end: async () => {}, on: () => {} }, { acquisitionMs: 10, operationMs: 1000 });
  const start = Date.now();
  assert.deepEqual(await runtime.run(async () => 'late'), { status: 'unavailable' });
  assert.ok(Date.now() - start < 300);
  finish({ query: async () => ({ rows: [] }), release: () => {} });
  await runtime.close();
});

test('Given pending and active work, when runtime closes, then callers settle and close is idempotent', async () => {
  let finish!: (client: { query(): Promise<{ rows: never[] }>; release(): void }) => void;
  let ends = 0;
  const runtime = new BoundedSqlRuntime({ connect: () => new Promise((resolve) => { finish = resolve; }), end: async () => { ends++; }, on: () => {} }, { active: 1, pending: 1, operationMs: 1000 });
  const active = runtime.run(async () => 'late');
  const pending = runtime.run(async () => 'late');
  assert.deepEqual(await runtime.run(async () => 'excess'), { status: 'unavailable' });
  await runtime.close();
  await runtime.close();
  finish({ query: async () => ({ rows: [] }), release: () => {} });
  assert.deepEqual(await active, { status: 'unavailable' });
  assert.deepEqual(await pending, { status: 'unavailable' });
  assert.equal(ends, 1);
});

test('Given an unsafe direct factory URL, when a runtime is requested, then it fails before network work', async () => {
  const { createPgSettingsRuntime } = await import('../../../src/logs/audit/bounded-sql-runtime.ts');
  for (const connectionString of ['postgresql://localhost/db', 'postgresql://user:password@%2Ftmp/db', 'postgresql://user:password@localhost/db?host=evil', 'postgresql://user:password@localhost/db#fragment', 'postgresql://user:password@localhost/db?', 'postgresql://us\ner:password@localhost/db']) {
    assert.throws(() => createPgSettingsRuntime({ connectionString }), /Invalid database connection configuration/);
  }
});

test('Given a live query at shutdown, when close runs, then the client is destroyed and the caller settles before the query', async () => {
  let started!: () => void;
  let finish!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  const releases: boolean[] = [];
  const runtime = new BoundedSqlRuntime({
    connect: async () => ({ query: () => { started(); return new Promise<{ rows: never[] }>((resolve) => { finish = () => resolve({ rows: [] }); }); }, release: (destroy?: boolean) => { releases.push(Boolean(destroy)); } }),
    end: async () => {}, on: () => {},
  });
  const result = runtime.run(async (session) => session.query('write', [], true));
  await ready;
  await runtime.close();
  assert.deepEqual(await result, { status: 'unconfirmed' });
  assert.deepEqual(releases, [true]);
  assert.deepEqual(await runtime.run(async () => 'closed'), { status: 'unavailable' });
  finish();
});

test('Given an idle pool disconnect, when the pool reports its error, then it does not crash the owner', async () => {
  let idleError!: (error: Error) => void;
  const runtime = new BoundedSqlRuntime({ connect: async () => ({ query: async () => ({ rows: [] }), release: () => {} }), end: async () => {}, on: (_event, listener) => { idleError = listener; } });
  assert.doesNotThrow(() => idleError(new Error('credential-bearing database failure')));
  assert.deepEqual(await runtime.run(async () => 'available'), { status: 'complete', value: 'available' });
  await runtime.close();
});
