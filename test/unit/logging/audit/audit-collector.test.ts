import assert from 'node:assert/strict';
import { test } from 'node:test';
import { captured, collectorWith, pending, ready, turn } from './fixtures/audit-collector-fixtures.ts';
import type { ExportAuthorization } from '../../../../src/logs/audit/destination-settings-service.ts';
import type { AuditSendOutcome } from '../../../../src/logs/audit/audit-send.ts';

test('Given captured work, when admission returns, then it has not called storage or network and one later fresh authorization starts one attempt', async t => {
  const { collector, reads, sends } = collectorWith(); t.after(() => collector.close());
  assert.equal(collector.admit(captured()), true);
  assert.equal(reads.length, 0); assert.equal(sends.length, 0);
  await turn();
  assert.deepEqual(reads.map(({ tenant, revision }) => [tenant, revision]), [['tenant-a', 'revision-a']]);
  assert.equal(sends.length, 1);
});

test('Given global and tenant item limits, when work is queued or reading, then the same account refuses excess items until disposal', async t => {
  const read = pending<ExportAuthorization>();
  const { collector, reads } = collectorWith({ bounds: { items: 3, tenantItems: 2 } }, { authorize: () => read.promise }); t.after(() => collector.close());
  assert.equal(collector.admit(captured()), true); assert.equal(collector.admit(captured()), true);
  assert.equal(collector.admit(captured()), false);
  assert.equal(collector.admit(captured('tenant-b')), true); assert.equal(collector.admit(captured('tenant-c')), false);
  await turn(); assert.equal(reads.length, 2);
  assert.equal(collector.admit(captured('tenant-c')), false);
  read.resolve(ready); await turn();
  assert.equal(collector.admit(captured('tenant-c')), true);
});

test('Given tenant and global serialized byte budgets, when content exceeds either bound, then admission refuses it without I/O', async t => {
  const item = captured(); const bytes = Buffer.byteLength(JSON.stringify(item));
  const { collector, reads } = collectorWith({ bounds: { bytes: bytes * 2, tenantBytes: bytes } }); t.after(() => collector.close());
  assert.equal(collector.admit(item), true); assert.equal(collector.admit(item), false);
  assert.equal(collector.admit(captured('tenant-b')), true); assert.equal(collector.admit(captured('tenant-c')), false);
  assert.equal(reads.length, 0);
});

test('Given a full tenant table or oversized event, when another event arrives, then content and destination counts remain bounded', async t => {
  const { collector } = collectorWith({ bounds: { tenants: 1, eventBytes: 500 } }); t.after(() => collector.close());
  assert.equal(collector.admit(captured()), true); assert.equal(collector.admit(captured('tenant-b')), false);
  assert.equal(collector.admit(captured('tenant-a', 'revision-a', 'x'.repeat(600))), false);
});

test('Given two items for one tenant and another tenant, when authorization stalls, then one dispatch per tenant and two globally can run', async t => {
  const read = pending<ExportAuthorization>();
  const { collector, reads } = collectorWith({}, { authorize: () => read.promise }); t.after(() => collector.close());
  collector.admit(captured()); collector.admit(captured()); collector.admit(captured('tenant-b')); collector.admit(captured('tenant-c'));
  await turn(); assert.deepEqual(reads.map(item => item.tenant), ['tenant-a', 'tenant-b']);
  read.resolve(ready); await turn(); await turn(); assert.equal(reads.length, 4);
});

test('Given old revision work, when its fresh authorization reports changed, then every matching pending event drops without a send or retarget', async t => {
  const { collector, sends, reads } = collectorWith({}, { authorize: async () => ({ status: 'changed' }) }); t.after(() => collector.close());
  collector.admit(captured()); collector.admit(captured()); await turn();
  assert.equal(sends.length, 0); assert.equal(reads.length, 1);
});

test('Given a transient failure followed by changed settings, when retry becomes due, then it reads again and does not send the old event to new settings', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let now = 0;
  const { collector, sends, reads } = collectorWith({ now: () => now, random: () => 0 }, {
    authorize: async () => reads.length === 1 ? ready : { status: 'changed' },
    start: () => ({ outcome: Promise.resolve({ kind: 'transient_failure', reason: 'http_status', statusCode: 503 }), settled: Promise.resolve() }),
  }); t.after(() => collector.close());
  collector.admit(captured()); await turn(); assert.equal(sends.length, 1);
  now += 250; t.mock.timers.tick(250); await turn();
  assert.equal(reads.length, 2); assert.equal(sends.length, 1);
});

test('Given failed reads and continued same-tenant traffic, when the head backs off, then new arrivals cannot bypass its cooldown or reset its age', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let now = 0;
  const { collector, reads } = collectorWith({ now: () => now, random: () => 0, bounds: { ageMs: 400 } }, { authorize: async () => ({ status: 'unavailable' }) }); t.after(() => collector.close());
  collector.admit(captured()); await turn();
  collector.admit(captured()); await turn(); assert.equal(reads.length, 1);
  now = 250; t.mock.timers.tick(250); await turn(); assert.equal(reads.length, 2);
  now = 400; t.mock.timers.tick(150); await turn();
  assert.equal(reads.length, 2);
});

test('Given expired work and an uncancellable read, when activity continues, then admission remains charged and no late send starts', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let now = 0;
  const read = pending<ExportAuthorization>();
  const { collector, reads, sends } = collectorWith({ now: () => now, bounds: { items: 1, ageMs: 100 } }, { authorize: () => read.promise }); t.after(() => collector.close());
  collector.admit(captured()); await turn();
  now = 100; t.mock.timers.tick(100);
  assert.equal(reads[0]?.signal?.aborted, true); assert.equal(collector.admit(captured()), false);
  read.resolve(ready); await turn(); assert.equal(sends.length, 0);
  assert.equal(collector.admit(captured()), true);
});

test('Given a sender outcome before its native work settles, when age expires, then its physical reservation stays charged until settlement', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let now = 0;
  const native = pending<void>();
  const { collector, sends } = collectorWith({ now: () => now, bounds: { items: 1, ageMs: 100 } }, { start: () => ({ outcome: Promise.resolve({ kind: 'accepted' }), settled: native.promise }) }); t.after(() => collector.close());
  collector.admit(captured()); await turn(); assert.equal(sends.length, 1);
  now = 100; t.mock.timers.tick(100);
  assert.equal(sends[0]?.signal?.aborted, true); assert.equal(collector.admit(captured()), false);
  native.resolve(); await turn(); assert.equal(collector.admit(captured()), true);
});

test('Given queued and reading work, when close runs, then it is immediate and late work cannot start another send', async () => {
  const read = pending<ExportAuthorization>();
  const { collector, reads, sends } = collectorWith({}, { authorize: () => read.promise });
  collector.admit(captured()); collector.admit(captured()); await turn();
  assert.equal(collector.close(), undefined); collector.close();
  assert.equal(reads[0]?.signal?.aborted, true); assert.equal(collector.admit(captured()), false);
  read.resolve(ready); await turn(); assert.equal(sends.length, 0);
});

for (const outcome of [
  { kind: 'permanent_failure', reason: 'http_status', statusCode: 500 },
  { kind: 'transient_failure', reason: 'http_status', statusCode: 503, retryAfterMs: 30_000 },
] as const satisfies readonly AuditSendOutcome[]) {
  test(`Given ${outcome.kind} HTTP ${outcome.statusCode}, when delivery finishes, then permanent or out-of-age retries drop without another attempt`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let now = 0;
    const { collector, sends } = collectorWith({ now: () => now, random: () => 0 }, { start: () => ({ outcome: Promise.resolve(outcome), settled: Promise.resolve() }) }); t.after(() => collector.close());
    collector.admit(captured()); await turn(); now = 30_000; t.mock.timers.tick(30_000); await turn();
    assert.equal(sends.length, 1);
  });
}

test('Given mutable caller fields, when content is admitted and then the caller changes its tenant or actor, then dispatch uses the detached original event', async t => {
  const { collector, sends, reads } = collectorWith(); t.after(() => collector.close());
  const original = captured();
  const event = { ...original.event, actor: { ...original.event.actor } };
  const envelope = { destinationRevision: 'revision-a', event };
  assert.equal(collector.admit(envelope), true);
  event.organizationId = 'tenant-b'; event.actor.subject = 'changed-actor'; envelope.destinationRevision = 'revision-b';
  await turn();
  assert.deepEqual(reads.map(item => [item.tenant, item.revision]), [['tenant-a', 'revision-a']]);
  assert.match(JSON.stringify(sends), /tenant-a/); assert.doesNotMatch(JSON.stringify(sends), /tenant-b|changed-actor/);
});

test('Given a read that passes its absolute deadline before the timer callback, when it completes, then it cannot start a send or release admission early', async t => {
  let now = 0;
  const read = pending<ExportAuthorization>();
  const { collector, sends } = collectorWith({ now: () => now, bounds: { items: 1 } }, { authorize: () => read.promise }); t.after(() => collector.close());
  collector.admit(captured()); await turn(); now = 2_500;
  assert.equal(collector.admit(captured()), false);
  read.resolve(ready); await turn(); assert.equal(sends.length, 0);
  assert.equal(collector.admit(captured()), true);
});

test('Given a read deadline timer and a delayed native result, when the deadline fires, then it aborts but retains accounting until the read settles', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let now = 0;
  const read = pending<ExportAuthorization>();
  const { collector, reads, sends } = collectorWith({ now: () => now, bounds: { items: 1 } }, { authorize: () => read.promise }); t.after(() => collector.close());
  collector.admit(captured()); await turn(); now = 2_500; t.mock.timers.tick(2_500);
  assert.equal(reads[0]?.signal?.aborted, true); assert.equal(collector.admit(captured()), false);
  read.resolve(ready); await turn(); assert.equal(sends.length, 0); assert.equal(collector.admit(captured()), true);
});

test('Given queued work whose age passed before its scheduled pump, when the pump runs, then it starts no authorization or send', async t => {
  let now = 0;
  const { collector, reads, sends } = collectorWith({ now: () => now, bounds: { ageMs: 100 } }); t.after(() => collector.close());
  collector.admit(captured()); now = 100; await turn();
  assert.equal(reads.length, 0); assert.equal(sends.length, 0);
});

test('Given repeated busy delivery, when three authorization cycles complete, then retry stops with no fourth read or attempt', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let now = 0;
  const { collector, reads, sends } = collectorWith({ now: () => now, random: () => 0 }, { start: () => ({ outcome: Promise.resolve({ kind: 'busy' }), settled: Promise.resolve() }) }); t.after(() => collector.close());
  collector.admit(captured()); await turn();
  now += 250; t.mock.timers.tick(250); await turn();
  now += 500; t.mock.timers.tick(500); await turn();
  now += 2_000; t.mock.timers.tick(2_000); await turn();
  assert.equal(reads.length, 3); assert.equal(sends.length, 3);
});

test('Given a bounded Retry-After minimum, when earlier backoff would be due, then the fresh authorization waits for that minimum', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let now = 0;
  const { collector, sends } = collectorWith({ now: () => now, random: () => 0 }, { start: () => ({ outcome: Promise.resolve({ kind: 'transient_failure', reason: 'http_status', statusCode: 503, retryAfterMs: 1_000 }), settled: Promise.resolve() }) }); t.after(() => collector.close());
  collector.admit(captured()); await turn();
  now = 999; t.mock.timers.tick(999); await turn(); assert.equal(sends.length, 1);
  now = 1_000; t.mock.timers.tick(1); await turn(); assert.equal(sends.length, 2);
});

for (const kind of ['throw', 'reject'] as const) {
  test(`Given an authorizer that can ${kind}, when reads fail, then causes stay contained and retries use the same fixed attempt budget`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] }); let now = 0;
    const { collector, reads, sends } = collectorWith({ now: () => now, random: () => 0 }, { authorize: () => {
      if (kind === 'throw') throw new Error('private-storage-cause');
      return Promise.reject(new Error('private-storage-cause'));
    } }); t.after(() => collector.close());
    collector.admit(captured()); await turn();
    now = 250; t.mock.timers.tick(250); await turn();
    now = 750; t.mock.timers.tick(500); await turn();
    now = 2_750; t.mock.timers.tick(2_000); await turn();
    assert.equal(reads.length, 3); assert.equal(sends.length, 0);
  });
}

test('Given a per-tenant byte account, when accepted outcome precedes physical settlement, then retained bytes still refuse the next event', async t => {
  const item = captured(); const bytes = Buffer.byteLength(JSON.stringify(item));
  const native = pending<void>();
  const { collector } = collectorWith({ bounds: { bytes: bytes, tenantBytes: bytes } }, { start: () => ({ outcome: Promise.resolve({ kind: 'accepted' }), settled: native.promise }) }); t.after(() => collector.close());
  collector.admit(item); await turn(); assert.equal(collector.admit(item), false);
  native.resolve(); await turn(); assert.equal(collector.admit(item), true);
});

test('Given a held send and queued work, when close runs, then its signal aborts and a late transient result cannot schedule another attempt', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let now = 0;
  const outcome = pending<AuditSendOutcome>(); const native = pending<void>();
  const { collector, sends, reads } = collectorWith({ now: () => now, random: () => 0 }, { start: () => ({ outcome: outcome.promise, settled: native.promise }) });
  t.after(() => { collector.close(); outcome.resolve({ kind: 'cancelled' }); native.resolve(); });
  collector.admit(captured()); collector.admit(captured()); await turn();
  assert.equal(sends.length, 1);
  assert.equal(collector.close(), undefined);
  assert.equal(sends[0]?.signal?.aborted, true);
  outcome.resolve({ kind: 'transient_failure', reason: 'http_status', statusCode: 503 }); native.resolve(); await turn();
  now = 10_000; t.mock.timers.tick(10_000); await turn();
  assert.equal(reads.length, 1); assert.equal(sends.length, 1); assert.equal(collector.admit(captured()), false);
});

test('Given retry-backoff work, when close runs before the retry deadline, then neither queued nor later retry work starts', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let now = 0;
  const { collector, sends, reads } = collectorWith({ now: () => now, random: () => 0 }, { start: () => ({ outcome: Promise.resolve({ kind: 'transient_failure', reason: 'http_status', statusCode: 503 }), settled: Promise.resolve() }) }); t.after(() => collector.close());
  collector.admit(captured()); collector.admit(captured()); await turn();
  assert.equal(sends.length, 1);
  assert.equal(collector.close(), undefined);
  now = 10_000; t.mock.timers.tick(10_000); await turn();
  assert.equal(reads.length, 1); assert.equal(sends.length, 1); assert.equal(collector.admit(captured()), false);
});
