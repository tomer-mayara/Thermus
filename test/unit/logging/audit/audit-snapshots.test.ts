import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuditSnapshots, type RevisionBoundAuditEvent } from '../../../../src/logs/audit/audit-snapshots.ts';
import { eventFor, immediateTurn, settings, SnapshotStoreSpy } from './fixtures/audit-snapshot-fixtures.ts';

test('Given an unknown tenant, when capture occurs, then reads start asynchronously and the triggering event is admitted after enabled settings load', async t => {
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }); t.after(() => snapshots.close());
  const first = eventFor();
  assert.equal(snapshots.writeAuditEvent(first), true);
  assert.deepEqual(store.reads, []);
  await immediateTurn();
  assert.deepEqual(store.reads, ['tenant-a']);
  await store.answer(settings());
  const next = eventFor();
  assert.equal(snapshots.writeAuditEvent(next), true);
  assert.deepEqual(admitted, [{ destinationRevision: 'revision-a', event: first }, { destinationRevision: 'revision-a', event: next }]);
});

test('Given absent or disabled settings, when further activity occurs within freshness, then no event or additional read is admitted', async t => {
  for (const answer of [{ status: 'absent' as const }, settings(false)]) {
    const store = new SnapshotStoreSpy();
    const admitted: RevisionBoundAuditEvent[] = [];
    const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }); t.after(() => snapshots.close());
    snapshots.writeAuditEvent(eventFor());
    await immediateTurn(); await store.answer(answer);
    assert.equal(snapshots.writeAuditEvent(eventFor()), false);
    await immediateTurn(); assert.equal(store.reads.length, 1); assert.equal(admitted.length, 0);
  }
});

test('Given an expired enabled revision, when refresh fails, then old content remains unusable until later activity loads a new revision', async t => {
  let now = 0;
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { now: () => now }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(eventFor()); await immediateTurn(); await store.answer(settings());
  admitted.length = 0;
  now = 30_000;
  assert.equal(snapshots.writeAuditEvent(eventFor()), true);
  await immediateTurn(); await store.answer({ status: 'unavailable' });
  snapshots.writeAuditEvent(eventFor()); await immediateTurn();
  assert.equal(store.reads.length, 2); assert.equal(admitted.length, 0);
  now += 5_000;
  snapshots.writeAuditEvent(eventFor()); await immediateTurn(); await store.answer(settings(true, 'revision-b'));
  snapshots.writeAuditEvent(eventFor());
  assert.equal(admitted.length, 2); assert.equal(admitted[0]?.destinationRevision, 'revision-b');
});

test('Given repeated activity and many tenants, when loads are scheduled before the event loop runs, then scheduled and native work stay within two reservations', async t => {
  const store = new SnapshotStoreSpy();
  const snapshots = new AuditSnapshots(store, { admit: () => {} }); t.after(() => snapshots.close());
  for (let i = 0; i < 20; i++) {
    snapshots.writeAuditEvent(eventFor('tenant-a'));
    snapshots.writeAuditEvent(eventFor(`tenant-${i}`));
  }
  assert.deepEqual(store.reads, []);
  await immediateTurn();
  assert.deepEqual(store.reads, ['tenant-a', 'tenant-0']);
  await store.answer(settings()); await store.answer(settings());
});

test('Given a timed-out read, when backoff ends and its resident is evicted, then the physical read still owns its global and per-tenant reservation', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { now: () => now, bounds: { entries: 3 } }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(eventFor('tenant-a')); await immediateTurn();
  now = 2_500; t.mock.timers.tick(2_500);
  now += 5_000;
  snapshots.writeAuditEvent(eventFor('tenant-b')); await immediateTurn();
  snapshots.writeAuditEvent(eventFor('tenant-a')); await immediateTurn();
  assert.deepEqual(store.reads, ['tenant-a', 'tenant-b']);
  await store.answer(settings(true, 'late-a'));
  snapshots.writeAuditEvent(eventFor('tenant-a'));
  assert.equal(admitted.length, 0);
  await store.answer(settings(true, 'revision-b'));
  snapshots.writeAuditEvent(eventFor('tenant-a')); await immediateTurn();
  assert.deepEqual(store.reads, ['tenant-a', 'tenant-b', 'tenant-a']);
  await store.answer(settings(true, 'fresh-a'));
  snapshots.writeAuditEvent(eventFor('tenant-a'));
  assert.equal(admitted.at(-1)?.destinationRevision, 'fresh-a');
});

test('Given a slow read, when its deadline passes and activity repeats, then it retains admission and late completion cannot enable capture', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let now = 0;
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { now: () => now, bounds: { active: 1 } }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(eventFor()); await immediateTurn();
  now = 2_500; t.mock.timers.tick(2_500); now += 5_000;
  for (let i = 0; i < 8; i++) snapshots.writeAuditEvent(eventFor());
  snapshots.writeAuditEvent(eventFor('tenant-b')); await immediateTurn();
  assert.deepEqual(store.reads, ['tenant-a']);
  await store.answer(settings());
  assert.equal(snapshots.writeAuditEvent(eventFor()), true);
  await immediateTurn(); assert.deepEqual(store.reads, ['tenant-a', 'tenant-a']);
  await store.answer({ status: 'absent' }); assert.equal(admitted.length, 0);
});

test('Given queued and native loads, when close runs twice, then it returns immediately and late completion restores nothing', async () => {
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } });
  snapshots.writeAuditEvent(eventFor()); await immediateTurn();
  snapshots.writeAuditEvent(eventFor('tenant-b'));
  assert.equal(snapshots.close(), undefined); snapshots.close();
  await store.answer(settings());
  assert.equal(snapshots.writeAuditEvent(eventFor()), false);
  await immediateTurn(); assert.deepEqual(store.reads, ['tenant-a']); assert.equal(admitted.length, 0);
});

test('Given small resident and byte bounds, when tenant churn occurs, then old snapshots become unknown and pinned failure backoff is not bypassed', async t => {
  let now = 0;
  const store = new SnapshotStoreSpy();
  const snapshots = new AuditSnapshots(store, { admit: () => {} }, { now: () => now, bounds: { entries: 2, metadataBytes: 700 } }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(eventFor()); await immediateTurn(); await store.answer({ status: 'unavailable' });
  snapshots.writeAuditEvent(eventFor('tenant-b')); await immediateTurn();
  assert.deepEqual(store.reads, ['tenant-a']);
  snapshots.writeAuditEvent(eventFor()); await immediateTurn(); assert.equal(store.reads.length, 1);
  now = 5_000;
  snapshots.writeAuditEvent(eventFor('tenant-b')); await immediateTurn(); assert.deepEqual(store.reads, ['tenant-a', 'tenant-b']);
  await store.answer(settings());
  assert.equal(snapshots.writeAuditEvent(eventFor()), true);
  await immediateTurn(); assert.equal(store.reads.length, 3);
  await store.answer(settings());
});

test('Given invalid tenant or settings metadata, when activity occurs, then bounded projection refuses it without touching destination fields', async t => {
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(eventFor('é'.repeat(513))); await immediateTurn(); assert.deepEqual(store.reads, []);
  snapshots.writeAuditEvent(eventFor()); await immediateTurn();
  const answer = settings();
  assert.equal(answer.status, 'found'); if (answer.status !== 'found') return;
  let destinationReads = 0;
  Object.defineProperty(answer.settings, 'endpoint', { get: () => { destinationReads++; return 'private-endpoint'; } });
  Object.defineProperty(answer.settings, 'encryptedCredential', { get: () => { destinationReads++; return 'private-ciphertext'; } });
  Object.defineProperty(answer.settings, 'revision', { value: 'é'.repeat(65) });
  await store.answer(answer);
  assert.equal(snapshots.writeAuditEvent(eventFor()), false); assert.equal(admitted.length, 0); assert.equal(destinationReads, 0);
});

test('Given fresh enabled settings, when downstream refuses or throws, then capture is nonthrowing and later capture can still proceed', async t => {
  const store = new SnapshotStoreSpy();
  let calls = 0;
  const snapshots = new AuditSnapshots(store, { admit: () => { if (++calls === 1) throw new Error('private-export-cause'); return false; } }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(eventFor()); await immediateTurn(); await store.answer(settings());
  calls = 0;
  assert.equal(snapshots.writeAuditEvent(eventFor()), false);
  assert.equal(snapshots.writeAuditEvent(eventFor()), false); assert.equal(calls, 2);
});

test('Given a fresh enabled snapshot, when an admitted event is later mutated by its caller, then its bound tenant and content stay detached', async t => {
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(eventFor()); await immediateTurn(); await store.answer(settings());
  const event = eventFor('tenant-a', 'fresh-event'); snapshots.writeAuditEvent(event);
  Object.assign(event, { organizationId: 'tenant-b' }); Object.assign(event.actor, { subject: 'other' });
  assert.equal(admitted.length, 2);
  assert.equal(admitted.at(-1)?.event.organizationId, 'tenant-a'); assert.equal(admitted.at(-1)?.event.actor.subject, 'fresh-event');
  assert.ok(Object.isFrozen(admitted.at(-1))); assert.ok(Object.isFrozen(admitted.at(-1)?.event));
});

test('Given a read whose completion passes its deadline before the timer callback runs, when it resolves, then the late snapshot is refused with backoff', async t => {
  let now = 0;
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { now: () => now }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(eventFor()); await immediateTurn();
  now = 2_500;
  await store.answer(settings());
  assert.equal(snapshots.writeAuditEvent(eventFor()), false);
  await immediateTurn(); assert.equal(store.reads.length, 1); assert.equal(admitted.length, 0);
});

test('Given a scheduled load whose deadline passes before its callback runs, when the callback executes, then no native read starts and backoff applies', async t => {
  let now = 0;
  const store = new SnapshotStoreSpy();
  const snapshots = new AuditSnapshots(store, { admit: () => {} }, { now: () => now }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(eventFor()); now = 2_500;
  await immediateTurn(); assert.deepEqual(store.reads, []);
  snapshots.writeAuditEvent(eventFor()); await immediateTurn(); assert.deepEqual(store.reads, []);
  now += 5_000;
  snapshots.writeAuditEvent(eventFor()); await immediateTurn(); assert.deepEqual(store.reads, ['tenant-a']);
  await store.answer(settings());
});

test('Given valid settings with adversarial destination getters, when metadata loads, then capture uses only detached enabled and revision values', async t => {
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }); t.after(() => snapshots.close());
  const answer = settings(); assert.equal(answer.status, 'found'); if (answer.status !== 'found') return;
  let destinationReads = 0;
  for (const key of ['endpoint', 'encryptedCredential']) Object.defineProperty(answer.settings, key, { get: () => { destinationReads++; throw new Error('private-destination-cause'); } });
  snapshots.writeAuditEvent(eventFor()); await immediateTurn(); await store.answer(answer);
  Object.assign(answer.settings, { enabled: false, revision: 'changed-later' });
  assert.equal(snapshots.writeAuditEvent(eventFor()), true);
  assert.equal(admitted.length, 2);
  assert.equal(admitted.at(-1)?.destinationRevision, 'revision-a'); assert.equal(destinationReads, 0);
  assert.doesNotMatch(JSON.stringify(admitted), /private-destination-cause|changed-later/);
});

for (const failure of ['synchronous', 'rejected', 'enabled-getter', 'revision-getter', 'invalid-enabled'] as const) {
  test(`Given a ${failure} settings read failure, when activity repeats, then failure is contained and backoff prevents another read`, async t => {
    let now = 0;
    let reads = 0;
    const admitted: RevisionBoundAuditEvent[] = [];
    const store = { read: () => {
      reads++;
      if (failure === 'synchronous') throw new Error('private-store-cause');
      if (failure === 'rejected') return Promise.reject(new Error('private-store-cause'));
      const result = settings(); assert.equal(result.status, 'found'); if (result.status !== 'found') throw new Error('fixture');
      if (failure === 'invalid-enabled') Object.assign(result.settings, { enabled: 'true' });
      else Object.defineProperty(result.settings, failure === 'enabled-getter' ? 'enabled' : 'revision', { get: () => { throw new Error('private-getter-cause'); } });
      return Promise.resolve(result);
    } };
    const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { now: () => now }); t.after(() => snapshots.close());
    assert.equal(snapshots.writeAuditEvent(eventFor()), true);
    assert.equal(reads, 0); await immediateTurn(); assert.equal(reads, 1);
    snapshots.writeAuditEvent(eventFor()); await immediateTurn(); assert.equal(reads, 1);
    now += 5_000; snapshots.writeAuditEvent(eventFor()); await immediateTurn();
    assert.equal(reads, 2); assert.equal(admitted.length, 0);
  });
}

test('Given a byte budget smaller than one resident plus its load, when activity occurs, then no read can bypass the shared metadata account', async t => {
  const store = new SnapshotStoreSpy();
  const snapshots = new AuditSnapshots(store, { admit: () => {} }, { bounds: { metadataBytes: 527 } }); t.after(() => snapshots.close());
  for (let i = 0; i < 20; i++) snapshots.writeAuditEvent(eventFor());
  await immediateTurn(); assert.deepEqual(store.reads, []);
});

test('Given exactly enough bytes for one resident and load, when a valid multibyte revision loads, then future capture stays within the fixed allowances', async t => {
  const store = new SnapshotStoreSpy();
  const admitted: RevisionBoundAuditEvent[] = [];
  const snapshots = new AuditSnapshots(store, { admit: item => { admitted.push(item); } }, { bounds: { metadataBytes: 528 } }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(eventFor()); await immediateTurn(); await store.answer(settings(true, 'é'.repeat(64)));
  assert.equal(snapshots.writeAuditEvent(eventFor()), true);
  assert.equal(admitted.length, 2);
  assert.equal(admitted.at(-1)?.destinationRevision, 'é'.repeat(64));
});

test('Given unknown then disabled capture, when an event contains a throwing getter, then pending admission refuses it safely and fresh disabled capture never reads content', async t => {
  const store = new SnapshotStoreSpy();
  const snapshots = new AuditSnapshots(store, { admit: () => {} }); t.after(() => snapshots.close());
  let contentReads = 0;
  const event = eventFor();
  Object.defineProperty(event, 'actor', { get: () => { contentReads++; throw new Error('must-not-read-content'); } });
  assert.equal(snapshots.writeAuditEvent(event), false);
  await immediateTurn(); await store.answer(settings(false));
  assert.equal(snapshots.writeAuditEvent(event), false);
  assert.equal(contentReads, 1);
});
