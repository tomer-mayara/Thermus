import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuditSnapshots, type RevisionBoundAuditEvent } from '../../../../src/logs/audit/audit-snapshots.ts';
import { eventFor, immediateTurn, settings, SnapshotStoreSpy } from './fixtures/audit-snapshot-fixtures.ts';

const event = (subject: string) => ({ ...eventFor(), actor: { authority: 'provider', subject } });

test('Given an unknown tenant, when several events await one settings read, then capture returns immediately and flushes each detached event once in arrival order', async t => {
  const store = new SnapshotStoreSpy();
  const calls: string[] = [];
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, {
    settingsObserved: (_tenant, revision) => { calls.push(`observed:${revision}`); },
    admit: item => { calls.push(item.event.actor.subject); admitted.push(item); },
  }); t.after(() => snapshots.close());
  const first = event('first');
  assert.equal(snapshots.writeAuditEvent(first), true);
  assert.equal(snapshots.writeAuditEvent(event('second')), true);
  Object.assign(first, { organizationId: 'wrong-tenant' });
  first.actor.subject = 'mutated';
  assert.deepEqual(store.reads, []); assert.equal(admitted.length, 0);
  await immediateTurn();
  assert.deepEqual(store.reads, ['tenant-a']);
  await store.answer(settings());
  assert.deepEqual(calls, ['observed:revision-a', 'first', 'second']);
  assert.deepEqual(admitted.map(item => item.event.organizationId), ['tenant-a', 'tenant-a']);
  assert.ok(admitted.every(item => Object.isFrozen(item.event) && Object.isFrozen(item.event.actor)));
  await immediateTurn(); assert.equal(admitted.length, 2);
});

test('Given expired enabled settings, when the next event refreshes to another revision, then that event uses only the new revision', async t => {
  let now = 0;
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { now: () => now }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(event('startup')); await immediateTurn(); await store.answer(settings());
  now = 30_000;
  assert.equal(snapshots.writeAuditEvent(event('expired')), true);
  await immediateTurn(); await store.answer(settings(true, 'revision-b'));
  assert.deepEqual(admitted.map(item => [item.event.actor.subject, item.destinationRevision]), [['startup', 'revision-a'], ['expired', 'revision-b']]);
});

for (const result of [{ status: 'absent' as const }, settings(false), { status: 'unavailable' as const }]) {
  test(`Given pending content and a ${result.status === 'found' ? 'disabled' : result.status} read, when later settings enable export, then rejected content never returns`, async t => {
    let now = 0;
    const store = new SnapshotStoreSpy();
    const admitted: RevisionBoundAuditEvent[] = [];
    const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { now: () => now }); t.after(() => snapshots.close());
    assert.equal(snapshots.writeAuditEvent(event('discarded')), true);
    await immediateTurn(); await store.answer(result);
    assert.equal(admitted.length, 0);
    now = 30_000;
    snapshots.writeAuditEvent(event('new-content')); await immediateTurn(); await store.answer(settings(true, 'enabled-later'));
    assert.deepEqual(admitted.map(item => item.event.actor.subject), ['new-content']);
  });
}

test('Given a pending batch, when one downstream event throws or is refused, then later events are still offered once and no batch is replayed', async t => {
  const store = new SnapshotStoreSpy();
  const offered: string[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => {
    offered.push(item.event.actor.subject);
    if (item.event.actor.subject === 'throws') throw new Error('private-sink-error');
    return item.event.actor.subject !== 'refused';
  } }); t.after(() => snapshots.close());
  for (const subject of ['throws', 'refused', 'accepted']) snapshots.writeAuditEvent(event(subject));
  await immediateTurn(); await store.answer(settings());
  assert.deepEqual(offered, ['throws', 'refused', 'accepted']);
  await immediateTurn(); assert.equal(offered.length, 3);
});

for (const bound of ['items', 'bytes', 'event'] as const) {
  test(`Given a pending ${bound} bound, when capture exceeds it, then excess content is refused and completion releases capacity`, async t => {
    const store = new SnapshotStoreSpy();
    const admitted: RevisionBoundAuditEvent[] = [];
    const one = event('one');
    const bytes = Buffer.byteLength(JSON.stringify(one));
    const bounds = bound === 'items' ? { pendingItems: 1 } : bound === 'bytes' ? { pendingBytes: bytes } : { eventBytes: bytes };
    let now = 0;
    const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { bounds, now: () => now }); t.after(() => snapshots.close());
    assert.equal(snapshots.writeAuditEvent(one), true);
    assert.equal(snapshots.writeAuditEvent(event('too-big')), false);
    await immediateTurn(); await store.answer(settings());
    now = 30_000;
    assert.equal(snapshots.writeAuditEvent(event('two')), true);
    await immediateTurn(); await store.answer(settings());
    assert.deepEqual(admitted.map(item => item.event.actor.subject), ['one', 'two']);
  });
}

test('Given a pending read whose absolute deadline has passed before its timer, when another event arrives, then both events are discarded and no second read starts until settlement', async t => {
  let now = 0;
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { now: () => now, bounds: { pendingItems: 1, active: 1 } }); t.after(() => snapshots.close());
  assert.equal(snapshots.writeAuditEvent(event('expired')), true);
  await immediateTurn();
  now = 2_500;
  assert.equal(snapshots.writeAuditEvent(event('too-late')), false);
  now += 5_000;
  assert.equal(snapshots.writeAuditEvent(eventFor('tenant-b')), false);
  await immediateTurn(); assert.deepEqual(store.reads, ['tenant-a']);
  await store.answer(settings()); assert.equal(admitted.length, 0);
  assert.equal(snapshots.writeAuditEvent(event('after-timeout')), true);
  await immediateTurn(); await store.answer(settings());
  assert.deepEqual(admitted.map(item => item.event.actor.subject), ['after-timeout']);
});

test('Given events join a pending load just before its deadline, when the deadline passes, then joiners cannot extend payload retention or revive after a late read', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { now: () => now }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(event('first')); await immediateTurn();
  now = 2_499;
  assert.equal(snapshots.writeAuditEvent(event('joiner')), true);
  now = 2_500; t.mock.timers.tick(2_500);
  await store.answer(settings());
  assert.equal(admitted.length, 0);
});

test('Given pending batches for two tenants, when one fails and the other succeeds, then content and released capacity stay tenant scoped', async t => {
  let now = 0;
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { now: () => now, bounds: { pendingItems: 1 } }); t.after(() => snapshots.close());
  assert.equal(snapshots.writeAuditEvent(eventFor('tenant-a')), true);
  assert.equal(snapshots.writeAuditEvent(eventFor('tenant-b')), true);
  assert.equal(snapshots.writeAuditEvent(eventFor('tenant-c')), false);
  await immediateTurn(); await store.answer({ status: 'unavailable' }); await store.answer(settings(true, 'b'));
  now = 5_000;
  assert.equal(snapshots.writeAuditEvent(eventFor('tenant-a')), true);
  await immediateTurn(); await store.answer(settings(true, 'a'));
  assert.deepEqual(admitted.map(item => [item.event.organizationId, item.destinationRevision]), [['tenant-b', 'b'], ['tenant-a', 'a']]);
});

test('Given queued and active pending content, when capture closes, then no content is admitted by either a queued callback or a late read', async () => {
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } });
  snapshots.writeAuditEvent(event('active')); await immediateTurn();
  snapshots.writeAuditEvent(eventFor('tenant-b'));
  snapshots.close(); snapshots.close();
  await store.answer(settings()); await immediateTurn();
  assert.deepEqual(store.reads, ['tenant-a']); assert.equal(admitted.length, 0);
  assert.equal(snapshots.writeAuditEvent(event('after-close')), false);
});

test('Given a pending tool event, when its caller mutates nested input and result before settings resolve, then the saved event keeps its original query, result and operation ID', async t => {
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }); t.after(() => snapshots.close());
  const original = {
    eventName: 'mcp.tool.completed' as const, timestamp: '2026-10-24T12:00:00.000Z', organizationId: 'tenant-a',
    actor: { authority: 'provider', subject: 'user' }, operationId: 'original-operation', tool: 'search' as const,
    input: { query: 'original query', reason: 'original reason' }, status: 'success' as const, durationMs: 1,
    result: { text: 'original result', originalBytes: 15, capturedBytes: 15, truncated: false },
  };
  assert.equal(snapshots.writeAuditEvent(original), true);
  original.input.query = 'mutated query'; original.input.reason = 'mutated reason';
  original.result.text = 'mutated result'; original.operationId = 'mutated-operation';
  await immediateTurn(); await store.answer(settings());
  const saved = admitted[0]?.event;
  if (saved?.eventName !== 'mcp.tool.completed' || saved.tool !== 'search') throw new Error('Expected search audit event');
  assert.deepEqual(saved.input, { query: 'original query', reason: 'original reason' });
  assert.equal(saved.result.text, 'original result'); assert.equal(saved.operationId, 'original-operation');
  assert.ok(Object.isFrozen(saved.input)); assert.ok(Object.isFrozen(saved.result));
});

test('Given expired enabled settings, when the refresh observes disabled and a later refresh observes enabled, then only the new enabled event is captured', async t => {
  let now = 0;
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { now: () => now }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(event('startup')); await immediateTurn(); await store.answer(settings());
  admitted.length = 0;
  now = 30_000;
  snapshots.writeAuditEvent(event('disabled-refresh')); await immediateTurn(); await store.answer(settings(false));
  assert.equal(snapshots.writeAuditEvent(event('fresh-disabled')), false);
  assert.equal(admitted.length, 0);
  now = 60_000;
  snapshots.writeAuditEvent(event('enabled-refresh')); await immediateTurn(); await store.answer(settings(true, 'later-revision'));
  assert.deepEqual(admitted.map(item => [item.event.actor.subject, item.destinationRevision]), [['enabled-refresh', 'later-revision']]);
});
