import assert from 'node:assert/strict';
import test from 'node:test';
import dns from 'node:dns/promises';
import { OtlpAuditSender } from '../../../../src/logs/audit/otlp-audit-sender.ts';
import { DestinationSettingsService } from '../../../../src/logs/audit/destination-settings-service.ts';
import type { DestinationSettingsStore, ReadSettingsResult, StoredDestinationSettings } from '../../../../src/logs/audit/destination-settings-store.ts';
import type { AuditDestination, AuditSendOutcome } from '../../../../src/logs/audit/audit-send.ts';
import type { AuditEvent } from '../../../../src/logs/audit/audit-log.ts';
import { DestinationCredentialCodec } from '../../../../src/logs/audit/destination-credential-codec.ts';

const key = Buffer.alloc(32, 6);
const actor = { authority: 'trusted', subject: 'admin-a' };
const requester = { organizationId: 'tenant-a', actor };
const form = { expectedRevision: 'r1', endpoint: 'https://collector.example/v1/logs', auth: 'bearer' as const, enabled: false, token: '' };
const saved = (): StoredDestinationSettings => ({ revision: 'r1', endpoint: form.endpoint, auth: form.auth, enabled: form.enabled, encryptedCredential: new DestinationCredentialCodec(key).encrypt('tenant-a', 'saved-token') });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(complete => { resolve = complete; });
  return { promise, resolve };
}
function fixture() {
  let row: StoredDestinationSettings | undefined = saved();
  const reads: string[] = [];
  const sends: { destination: AuditDestination; event: AuditEvent; signal?: AbortSignal }[] = [];
  let writes = 0;
  const store: DestinationSettingsStore = {
    async read(tenant) { reads.push(tenant); return row ? { status: 'found', settings: row } : { status: 'absent' }; },
    async save() { writes++; throw new Error('Test must not save'); },
  };
  const sender = { async send(destination: AuditDestination, event: AuditEvent, signal?: AbortSignal): Promise<AuditSendOutcome> { sends.push({ destination, event, signal }); return { kind: 'accepted' }; } };
  return { store, sender, reads, sends, writes: () => writes, set: (value: StoredDestinationSettings | undefined) => { row = value; } };
}

test('Given one disabled saved version, when tested, then its single full read supplies credential and synthetic event without a write', async () => {
  const f = fixture();
  const service = new DestinationSettingsService(f.store, key, f.sender);
  assert.deepEqual(await service.test(requester, form), { status: 'tested', revision: 'r1', outcome: { kind: 'accepted' } });
  assert.deepEqual(f.reads, ['tenant-a', 'tenant-a']);
  assert.equal(f.writes(), 0);
  assert.equal(f.sends.length, 1);
  assert.deepEqual(f.sends[0].destination, { endpoint: form.endpoint, auth: { type: 'bearer', token: 'saved-token' } });
  assert.deepEqual(f.sends[0].event, { eventName: 'audit.destination.test', timestamp: f.sends[0].event.timestamp, organizationId: 'tenant-a', actor, destinationRevision: 'r1' });
  assert.ok(Number.isFinite(Date.parse(f.sends[0].event.timestamp)));
});

for (const edit of [{ endpoint: 'https://other.example' }, { auth: 'none' as const }, { enabled: true }, { token: 'saved-token' }, { token: 'replacement' }]) {
  test('Given unsaved fields, when Test is requested, then it requires Save and sends nothing', async () => {
    const f = fixture();
    assert.deepEqual(await new DestinationSettingsService(f.store, key, f.sender).test(requester, { ...form, ...edit }), { status: 'unsaved' });
    assert.equal(f.sends.length, 0);
    assert.equal(f.writes(), 0);
  });
}
for (const missing of [true, false]) {
  test('Given an absent destination or stale submitted revision, when tested, then there is no send', async () => {
    const f = fixture();
    if (missing) f.set(undefined);
    assert.deepEqual(await new DestinationSettingsService(f.store, key, f.sender).test(requester, { ...form, expectedRevision: 'old' }), { status: 'conflict' });
    assert.equal(f.sends.length, 0);
  });
}
for (const tenant of ['tenant-a', 'tenant-b']) {
  test('Given corrupt or another tenant credential, when tested, then the destination is unavailable', async () => {
    const f = fixture();
    if (tenant === 'tenant-a') f.set({ ...saved(), encryptedCredential: 'corrupt-secret' });
    assert.deepEqual(await new DestinationSettingsService(f.store, key, f.sender).test({ organizationId: tenant, actor }, form), { status: 'unavailable' });
    assert.equal(f.sends.length, 0);
    assert.deepEqual(f.reads, [tenant]);
  });
}
for (const phase of ['before', 'after'] as const) {
  test(`Given storage fails ${phase} send, when tested, then a safe ${phase === 'before' ? 'unavailable' : 'unconfirmed'} result escapes`, async () => {
    const f = fixture();
    let reads = 0;
    const store = { ...f.store, async read(tenant: string): Promise<ReadSettingsResult> { if (++reads === (phase === 'before' ? 1 : 2)) throw new Error('private SQL token'); return f.store.read(tenant); } };
    assert.deepEqual(await new DestinationSettingsService(store, key, f.sender).test(requester, form), { status: phase === 'before' ? 'unavailable' : 'unconfirmed' });
    assert.equal(f.sends.length, phase === 'before' ? 0 : 1);
  });
}
for (const outcome of [
  { kind: 'accepted' }, { kind: 'warning' }, { kind: 'partial_rejection', rejectedRecords: 1 },
  { kind: 'permanent_failure', reason: 'http_status', statusCode: 401 },
  { kind: 'transient_failure', reason: 'http_status', statusCode: 503, retryAfterMs: 2000 },
  { kind: 'unconfirmed', reason: 'timeout' }, { kind: 'cancelled' }, { kind: 'busy' },
] as AuditSendOutcome[]) {
  test(`Given sender outcome ${outcome.kind}, when the revision stays current, then the typed outcome is returned once`, async () => {
    const f = fixture();
    f.sender.send = async () => outcome;
    assert.deepEqual(await new DestinationSettingsService(f.store, key, f.sender).test(requester, form), { status: 'tested', revision: 'r1', outcome });
    assert.equal(f.reads.length, 2);
  });
}
test('Given a sender throws private diagnostics, when Test settles, then only a safe unconfirmed transport outcome escapes', async () => {
  const f = fixture();
  f.sender.send = async () => { throw new Error('private transport token'); };
  assert.deepEqual(await new DestinationSettingsService(f.store, key, f.sender).test(requester, form), { status: 'tested', revision: 'r1', outcome: { kind: 'unconfirmed', reason: 'transport' } });
});
for (const replacement of [undefined, { ...saved(), revision: 'r2' }]) {
  test('Given the saved revision changes during send, when it settles, then no obsolete outcome is returned', async () => {
    const f = fixture();
    f.sender.send = async () => { f.set(replacement); return { kind: 'accepted' }; };
    assert.deepEqual(await new DestinationSettingsService(f.store, key, f.sender).test(requester, form), { status: 'conflict' });
  });
}

test('Given pending storage, when caller mutates submitted form and actor, then Test keeps its submitted snapshot', async () => {
  const f = fixture();
  const gate = deferred<void>();
  let reads = 0;
  const service = new DestinationSettingsService({ ...f.store, async read(tenant) { if (++reads === 1) await gate.promise; return f.store.read(tenant); } }, key, f.sender);
  const input = { ...form };
  const admin = { ...actor };
  const pending = service.test({ organizationId: 'tenant-a', actor: admin }, input);
  input.endpoint = 'https://unsaved.example';
  admin.subject = 'mutated';
  gate.resolve();
  assert.equal((await pending).status, 'tested');
  assert.deepEqual(f.sends[0].event.actor, actor);
});

test('Given four stalled reads, when callers cancel and repeat Test, then admission stays bounded and late reads never send', async () => {
  const f = fixture();
  const gate = deferred<ReadSettingsResult>();
  let reads = 0;
  const service = new DestinationSettingsService({ ...f.store, read() { reads++; return gate.promise; } }, key, f.sender);
  const controller = new AbortController();
  const pending = Array.from({ length: 4 }, () => service.test(requester, form, controller.signal));
  assert.deepEqual(await service.test(requester, form), { status: 'busy' });
  controller.abort();
  assert.deepEqual(await Promise.all(pending), Array.from({ length: 4 }, () => ({ status: 'cancelled' })));
  assert.deepEqual(await service.test(requester, form), { status: 'busy' });
  assert.equal(reads, 4);
  gate.resolve({ status: 'found', settings: saved() });
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(f.sends.length, 0);
  assert.equal((await service.test(requester, form)).status, 'tested');
});

test('Given a read that never settles, when the five-second deadline passes, then callers settle while admission stays occupied', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  let reads = 0;
  const service = new DestinationSettingsService({ ...f.store, read() { reads++; return new Promise(() => {}); } }, key, f.sender);
  const pending = Array.from({ length: 4 }, () => service.test(requester, form));
  t.mock.timers.tick(5000);
  assert.deepEqual(await Promise.all(pending), Array.from({ length: 4 }, () => ({ status: 'unconfirmed' })));
  assert.deepEqual(await service.test(requester, form), { status: 'busy' });
  assert.equal(reads, 4);
  assert.equal(f.sends.length, 0);
});

test('Given cancellation before Test, when requested, then neither storage nor sender starts', async () => {
  const f = fixture();
  const signal = AbortSignal.abort();
  assert.deepEqual(await new DestinationSettingsService(f.store, key, f.sender).test(requester, form, signal), { status: 'cancelled' });
  assert.equal(f.reads.length, 0);
});

test('Given a saved None destination, when tested, then no credential is sent and the one current snapshot supplies all delivery fields', async () => {
  const f = fixture();
  f.set({ ...saved(), endpoint: 'https://latest.example/v1/logs', revision: 'latest', auth: 'none', enabled: true, encryptedCredential: null });
  f.sender.send = async (destination, event) => {
    assert.deepEqual(f.reads, ['tenant-a']);
    assert.deepEqual(destination, { endpoint: 'https://latest.example/v1/logs', auth: { type: 'none' } });
    assert.equal(event.eventName === 'audit.destination.test' && event.destinationRevision, 'latest');
    return { kind: 'accepted' };
  };
  assert.deepEqual(await new DestinationSettingsService(f.store, key, f.sender).test(requester, { ...form, expectedRevision: 'latest', endpoint: 'https://latest.example/v1/logs', auth: 'none', enabled: true }), { status: 'tested', revision: 'latest', outcome: { kind: 'accepted' } });
});

for (const pendingPhase of ['sender', 'post-read'] as const) {
  test(`Given pending ${pendingPhase}, when cancelled, then its late result cannot confirm Test or start more work`, async () => {
    const f = fixture();
    const gate = deferred<void>();
    let readCount = 0;
    let sendCount = 0;
    let sendSignal: AbortSignal | undefined;
    const store = { ...f.store, async read(tenant: string) { if (++readCount === 2 && pendingPhase === 'post-read') await gate.promise; return f.store.read(tenant); } };
    const sender = { async send(_destination: AuditDestination, _event: AuditEvent, signal?: AbortSignal): Promise<AuditSendOutcome> { sendCount++; sendSignal = signal; if (pendingPhase === 'sender') await gate.promise; return { kind: 'accepted' }; } };
    const service = new DestinationSettingsService(store, key, sender);
    const controller = new AbortController();
    const result = service.test(requester, form, controller.signal);
    await new Promise<void>(resolve => setImmediate(resolve));
    controller.abort('private cancellation reason');
    assert.deepEqual(await result, { status: 'cancelled' });
    assert.equal(sendSignal?.aborted, true);
    gate.resolve();
    await new Promise<void>(resolve => setImmediate(resolve));
    assert.equal(readCount, pendingPhase === 'sender' ? 1 : 2);
    assert.equal(sendCount, 1);
  });
}

test('Given a wrong encryption key, when Test is requested, then the sender is never called', async () => {
  const f = fixture();
  assert.deepEqual(await new DestinationSettingsService(f.store, Buffer.alloc(32, 8), f.sender).test(requester, form), { status: 'unavailable' });
  assert.equal(f.sends.length, 0);
});

for (const changesRevision of [false, true]) {
  test('Given a sender throws before returning its promise, when it may have sent, then the saved-revision check still governs its safe result', async () => {
    const f = fixture();
    let sends = 0;
    const sender = { send(): Promise<AuditSendOutcome> { sends++; if (changesRevision) f.set({ ...saved(), revision: 'r2' }); throw new Error('private synchronous sender secret'); } };
    const result = await new DestinationSettingsService(f.store, key, sender).test(requester, form);
    assert.deepEqual(result, changesRevision ? { status: 'conflict' } : { status: 'tested', revision: 'r1', outcome: { kind: 'unconfirmed', reason: 'transport' } });
    assert.equal(sends, 1);
    assert.deepEqual(f.reads, ['tenant-a', 'tenant-a']);
  });
}

test('Given Test and export share a sender, when four native attempts are pending, then aggregate admission refuses a fifth attempt even after cancellation', async t => {
  const pending: Array<(value: { address: string; family: number }[]) => void> = [];
  t.mock.method(dns, 'lookup', () => new Promise(resolve => { pending.push(resolve); }));
  const sender = new OtlpAuditSender();
  const controller = new AbortController();
  const event: AuditEvent = { eventName: 'audit.destination.test', timestamp: '2026-10-24T12:00:00Z', organizationId: 'tenant-a', actor, destinationRevision: 'r1' };
  const destination: AuditDestination = { endpoint: form.endpoint, auth: { type: 'none' } };
  const exports = Array.from({ length: 3 }, () => sender.start(destination, event, controller.signal));
  const f = fixture();
  const service = new DestinationSettingsService(f.store, key, sender);
  const tested = service.test(requester, form, controller.signal);
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(pending.length, 4);
  assert.deepEqual(await sender.send(destination, event), { kind: 'busy' });
  controller.abort();
  assert.deepEqual(await tested, { status: 'cancelled' });
  assert.deepEqual(await sender.send(destination, event), { kind: 'busy' });
  for (const finish of pending) finish([{ address: '8.8.8.8', family: 4 }]);
  await Promise.all(exports.map(attempt => attempt.settled));
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.deepEqual(await sender.send({ ...destination, endpoint: 'https://127.0.0.1/' }, event), { kind: 'permanent_failure', reason: 'unsafe_destination' });
});

test('Given a trusted display name, when a destination Test starts and its caller changes the actor, then the synthetic event keeps a frozen named copy', async () => {
  const f = fixture();
  const namedActor = { ...actor, name: 'Zoë O’Neil — 李', ignored: 'private-extra' };
  const pending = new DestinationSettingsService(f.store, key, f.sender).test({ organizationId: 'tenant-a', actor: namedActor }, form);
  namedActor.name = 'changed';
  await pending;
  assert.deepEqual(f.sends[0]?.event.actor, { ...actor, name: 'Zoë O’Neil — 李' });
  assert.ok(Object.isFrozen(f.sends[0]?.event.actor));
});

for (const name of ['', ' ', 42, '\ud800', 'bad\nname', 'é'.repeat(513)]) {
  test('Given invalid optional display metadata, when a saved destination is tested, then the synthetic event retains only the stable actor identity', async () => {
    const f = fixture();
    const namedActor = Object.assign({}, actor, { name }) as typeof actor & { name?: string };
    const result = await new DestinationSettingsService(f.store, key, f.sender).test({ organizationId: 'tenant-a', actor: namedActor }, form);
    assert.equal(result.status, 'tested');
    assert.deepEqual(f.sends[0]?.event.actor, actor);
  });
}
