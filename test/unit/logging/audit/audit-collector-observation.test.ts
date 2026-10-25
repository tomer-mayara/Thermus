import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AuditSnapshots } from '../../../../src/logs/audit/audit-snapshots.ts';
import type { AuditSendOutcome } from '../../../../src/logs/audit/audit-send.ts';
import { eventFor, immediateTurn, settings, SnapshotStoreSpy } from './fixtures/audit-snapshot-fixtures.ts';
import { captured, collectorWith, pending, ready, turn } from './fixtures/audit-collector-fixtures.ts';
import type { ExportAuthorization } from '../../../../src/logs/audit/destination-settings-service.ts';

for (const change of ['revision', 'disabled', 'absent'] as const) {
  test(`Given a held send, when activity refresh observes ${change}, then the old attempt is aborted without polling or retargeting`, async t => {
    let now = 0;
    const outcome = pending<AuditSendOutcome>(); const native = pending<void>();
    const store = new SnapshotStoreSpy();
    const { collector, sends, reads } = collectorWith({ now: () => now }, { start: () => ({ outcome: outcome.promise, settled: native.promise }) });
    t.after(() => { collector.close(); outcome.resolve({ kind: 'cancelled' }); native.resolve(); });
    const snapshots = new AuditSnapshots(store, collector, { now: () => now, bounds: { freshMs: 100 } }); t.after(() => snapshots.close());
    const active = eventFor('tenant-a', 'old-active');
    const queued = eventFor('tenant-a', 'old-queued');
    const refresh = eventFor('tenant-a', 'refresh-trigger');
    snapshots.writeAuditEvent(active); await immediateTurn(); await store.answer(settings(true, 'revision-a'));
    snapshots.writeAuditEvent(queued); await turn(); assert.equal(sends.length, 1);
    now = 100; snapshots.writeAuditEvent(refresh); await immediateTurn();
    await store.answer(change === 'absent' ? { status: 'absent' } : settings(change !== 'disabled', change === 'revision' ? 'revision-b' : 'revision-a'));
    assert.equal(sends[0]?.signal?.aborted, true);
    outcome.resolve({ kind: 'cancelled' }); native.resolve(); await turn();
    assert.deepEqual(sends.map(send => send.item), change === 'revision' ? [active, refresh] : [active]);
    assert.deepEqual(reads.map(read => read.revision), change === 'revision' ? ['revision-a', 'revision-b'] : ['revision-a']);
    assert.equal(store.reads.length, 2);
  });
}

test('Given an authorization still in progress, when observation disables its revision, then the late ready result cannot start a send', async t => {
  const authorization = pending<ExportAuthorization>();
  const { collector, sends, reads } = collectorWith({}, { authorize: () => authorization.promise }); t.after(() => collector.close());
  collector.admit(captured()); await turn();
  collector.settingsObserved('tenant-a', null);
  assert.equal(reads[0]?.signal?.aborted, true);
  authorization.resolve(ready); await turn(); assert.equal(sends.length, 0);
});

test('Given no admitted work, when observations name many tenants, then they retain no destination admission state', t => {
  const { collector } = collectorWith({ bounds: { tenants: 1 } }); t.after(() => collector.close());
  for (let i = 0; i < 100; i++) collector.settingsObserved(`unadmitted-${i}`, null);
  assert.equal(collector.admit(captured()), true);
});

test('Given a failing metadata refresh, when an old send is held, then no successful observation is invented', async t => {
  let now = 0;
  const outcome = pending<AuditSendOutcome>(); const native = pending<void>();
  const store = new SnapshotStoreSpy();
  const { collector, sends } = collectorWith({ now: () => now }, { start: () => ({ outcome: outcome.promise, settled: native.promise }) }); t.after(() => collector.close());
  const snapshots = new AuditSnapshots(store, collector, { now: () => now, bounds: { freshMs: 100 } }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(eventFor()); await immediateTurn(); await store.answer(settings(true, 'revision-a'));
  snapshots.writeAuditEvent(eventFor()); await turn();
  now = 100; snapshots.writeAuditEvent(eventFor()); await immediateTurn(); await store.answer({ status: 'unavailable' });
  assert.equal(sends[0]?.signal?.aborted, false);
  collector.close(); outcome.resolve({ kind: 'cancelled' }); native.resolve(); await turn();
});

test('Given a downstream observation hook that throws, when valid metadata loads, then future capture still uses the successful snapshot', async t => {
  const store = new SnapshotStoreSpy();
  let admissions = 0;
  const snapshots = new AuditSnapshots(store, {
    admit: () => { admissions++; },
    settingsObserved: () => { throw new Error('private-observer-cause'); },
  }); t.after(() => snapshots.close());
  snapshots.writeAuditEvent(eventFor()); await immediateTurn(); await store.answer(settings());
  assert.equal(snapshots.writeAuditEvent(eventFor()), true); assert.equal(admissions, 2);
});
