import assert from 'node:assert/strict';
import test from 'node:test';
import type { TestContext } from 'node:test';
import { BoundedSqlRuntime } from '../../../../src/runtime/sql/bounded-sql-runtime.ts';
import { PgDestinationSettingsStore } from '../../../../src/logs/audit/pg-destination-settings-store.ts';
import type { RemovalIntent, RemovedMember } from '../../../../src/accounts/organizations/removal-operation-store.ts';

const intent: RemovalIntent = { organizationId: 'org-a', operationId: '4a5c3911-ae48-4d71-8114-151e56ebbd28', membershipId: 'membership-a', revision: 'revision-a', actor: { authority: 'workos', subject: 'user-a' }, startedAt: '2026-10-25T10:00:00.000Z' };
const removed: RemovedMember = { authority: 'workos', subject: 'user-b', organizationId: 'org-a', membershipId: 'membership-b', operationId: intent.operationId, recordedAt: '2026-11-02T18:00:00.000Z' };
const row = { organization_id: intent.organizationId, operation_id: intent.operationId, membership_id: intent.membershipId, revision: intent.revision, actor_authority: intent.actor.authority, actor_subject: intent.actor.subject, started_at: new Date(intent.startedAt), outcome: null };

function removalStore(t: TestContext, query: () => Promise<{ rows: Record<string, unknown>[] }>, release: () => void = () => {}): PgDestinationSettingsStore {
  const runtime = new BoundedSqlRuntime({ connect: async () => ({ query, release }), end: async () => {}, on: () => {} });
  t.after(() => runtime.close());
  return new PgDestinationSettingsStore(runtime);
}

test('Given a durable removal row, when read, then the original intent and terminal receipt are returned', async t => {
  const store = removalStore(t, async () => ({ rows: [row] }));
  assert.deepEqual(await store.readRemoval(intent.organizationId), { status: 'found', operation: { ...intent, outcome: null } });
  const terminal = removalStore(t, async () => ({ rows: [{ ...row, outcome: 'applied' }] }));
  assert.deepEqual(await terminal.readRemoval(intent.organizationId), { status: 'found', operation: { ...intent, outcome: 'applied' } });
});

test('Given no removal row, when read, then absence is explicit', async t => {
  const store = removalStore(t, async () => ({ rows: [] }));
  assert.deepEqual(await store.readRemoval(intent.organizationId), { status: 'absent' });
});

test('Given an admission statement result, when admitted or blocked, then only its durable outcome is reported', async t => {
  const admitted = removalStore(t, async () => ({ rows: [row] }));
  assert.deepEqual(await admitted.admitRemoval(intent), { status: 'admitted' });
  const busy = removalStore(t, async () => ({ rows: [] }));
  assert.deepEqual(await busy.admitRemoval(intent), { status: 'busy' });
});

test('Given a conditional completion result, when completed or mismatched, then it reports that outcome', async t => {
  const completed = removalStore(t, async () => ({ rows: [{ outcome: 'applied' }] }));
  assert.deepEqual(await completed.completeRemoval(intent.organizationId, intent.operationId, 'applied'), { status: 'completed' });
  const mismatch = removalStore(t, async () => ({ rows: [] }));
  assert.deepEqual(await mismatch.completeRemoval(intent.organizationId, intent.operationId, 'applied'), { status: 'mismatch' });
});

test('Given a query failure, when removal storage reads or writes, then it reports safe unavailable or unconfirmed results', async t => {
  const store = removalStore(t, async () => { throw new Error('private database details'); });
  assert.deepEqual(await store.readRemoval(intent.organizationId), { status: 'unavailable' });
  assert.deepEqual(await store.admitRemoval(intent), { status: 'unconfirmed' });
  assert.deepEqual(await store.completeRemoval(intent.organizationId, intent.operationId, 'no-effect'), { status: 'unconfirmed' });
});

test('Given failed acquisition, when admission or completion is requested, then no write is claimed', async t => {
  const runtime = new BoundedSqlRuntime({ connect: async () => { throw new Error('private connection'); }, end: async () => {}, on: () => {} });
  t.after(() => runtime.close());
  const store = new PgDestinationSettingsStore(runtime);
  assert.deepEqual(await store.admitRemoval(intent), { status: 'unavailable' });
  assert.deepEqual(await store.completeRemoval(intent.organizationId, intent.operationId, 'applied'), { status: 'unavailable' });
});

test('Given a finished removal statement, when its promise resolves, then the SQL client is already released', async t => {
  let released = 0;
  const store = removalStore(t, async () => ({ rows: [row] }), () => { released++; });
  await store.admitRemoval(intent);
  assert.equal(released, 1);
  await store.readRemoval(intent.organizationId);
  assert.equal(released, 2);
  await store.completeRemoval(intent.organizationId, intent.operationId, 'applied');
  assert.equal(released, 3);
});

test('Given a removed-member insert that completes, when the member is recorded, then the record is reported, also when the row of that membership already exists', async t => {
  const statements: { text: string; values: unknown[] | undefined }[] = [];
  const inserted = removalStore(t, async () => ({ rows: [{ membership_id: removed.membershipId }] }));
  const runtime = new BoundedSqlRuntime({ connect: async () => ({ query: async (text: string, values?: unknown[]) => { statements.push({ text, values }); return { rows: [] }; }, release: () => {} }), end: async () => {}, on: () => {} });
  t.after(() => runtime.close());
  const repeated = new PgDestinationSettingsStore(runtime);

  assert.deepEqual(await inserted.recordRemovedMember(removed), { status: 'recorded' });
  assert.deepEqual(await repeated.recordRemovedMember(removed), { status: 'recorded' });
  assert.equal(statements.length, 1);
  assert.match(statements[0].text, /INSERT INTO thermus_admin\.removed_members/);
  assert.match(statements[0].text, /ON CONFLICT \(membership_id\) DO NOTHING/);
  assert.deepEqual(statements[0].values, [removed.membershipId, removed.organizationId, removed.authority, removed.subject, removed.operationId, removed.recordedAt]);
});

test('Given a removed-member row of the identity, when it is read, then it is found; without one, absence is explicit', async t => {
  const statements: { text: string; values: unknown[] | undefined }[] = [];
  const runtime = new BoundedSqlRuntime({ connect: async () => ({ query: async (text: string, values?: unknown[]) => { statements.push({ text, values }); return { rows: [{ membership_id: removed.membershipId }] }; }, release: () => {} }), end: async () => {}, on: () => {} });
  t.after(() => runtime.close());
  const found = new PgDestinationSettingsStore(runtime);
  const absent = removalStore(t, async () => ({ rows: [] }));

  assert.deepEqual(await found.readRemovedMember({ authority: removed.authority, subject: removed.subject }), { status: 'found' });
  assert.deepEqual(await absent.readRemovedMember({ authority: removed.authority, subject: 'user-z' }), { status: 'absent' });
  assert.match(statements[0].text, /FROM thermus_admin\.removed_members WHERE authority = \$1 AND subject = \$2/);
  assert.deepEqual(statements[0].values, [removed.authority, removed.subject]);
});

test('Given a query failure, when a removed member is recorded or read, then the results are unconfirmed and unavailable', async t => {
  const store = removalStore(t, async () => { throw new Error('private database details'); });
  assert.deepEqual(await store.recordRemovedMember(removed), { status: 'unconfirmed' });
  assert.deepEqual(await store.readRemovedMember({ authority: removed.authority, subject: removed.subject }), { status: 'unavailable' });
});

test('Given failed acquisition, when a removed member is recorded or read, then no write is claimed and the read is unavailable', async t => {
  const runtime = new BoundedSqlRuntime({ connect: async () => { throw new Error('private connection'); }, end: async () => {}, on: () => {} });
  t.after(() => runtime.close());
  const store = new PgDestinationSettingsStore(runtime);
  assert.deepEqual(await store.recordRemovedMember(removed), { status: 'unavailable' });
  assert.deepEqual(await store.readRemovedMember({ authority: removed.authority, subject: removed.subject }), { status: 'unavailable' });
});

test('Given a finished removed-member statement, when its promise resolves, then the SQL client is already released', async t => {
  let released = 0;
  const store = removalStore(t, async () => ({ rows: [] }), () => { released++; });
  await store.recordRemovedMember(removed);
  assert.equal(released, 1);
  await store.readRemovedMember({ authority: removed.authority, subject: removed.subject });
  assert.equal(released, 2);
});
