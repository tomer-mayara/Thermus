import assert from 'node:assert/strict';
import test from 'node:test';
import dns from 'node:dns/promises';
import tls from 'node:tls';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { OtlpAuditSender } from '../../../../src/logs/audit/otlp-audit-sender.ts';
import type { AuditEvent } from '../../../../src/logs/audit/audit-log.ts';

const event: AuditEvent = { eventName: 'mcp.tool.completed', timestamp: '2026-10-23T12:00:00Z', organizationId: 'org-a', actor: { authority: 'workos', subject: 'user-a' }, operationId: 'op-a', tool: 'search', status: 'success', durationMs: 3, input: { query: 'public query', reason: 'public reason' }, result: { text: 'public result', originalBytes: 13, capturedBytes: 13, truncated: false } };
const destination = { endpoint: 'https://collector.example/v1/logs', auth: { type: 'none' as const } };

class HandshakeSocketStub extends EventEmitter {
  authorized = true;
  remoteAddress = '127.0.0.1';
  closed = false;
  destroyed = false;
  autoClose = true;
  destroy(error?: Error) {
    if (this.destroyed) return this;
    this.destroyed = true;
    queueMicrotask(() => {
      if (error) this.emit('error', error);
      if (this.autoClose) { this.closed = true; this.emit('close'); }
    });
    return this;
  }
}


test('Given already cancelled work, when submitted, then no DNS work starts', async (t) => {
  const lookup = t.mock.method(dns, 'lookup', async () => { throw new Error('must not run'); });
  const controller = new AbortController(); controller.abort('private reason');
  assert.deepEqual(await new OtlpAuditSender().send(destination, event, controller.signal), { kind: 'cancelled' });
  assert.equal(lookup.mock.calls.length, 0);
});
test('Given four pending native lookups, when they time out, then caller results settle but admission remains occupied until DNS settles', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const pending: Array<(value: { address: string; family: number }[]) => void> = [];
  t.mock.method(dns, 'lookup', () => new Promise((resolve) => pending.push(resolve)));
  const sender = new OtlpAuditSender();
  const attempts = Array.from({ length: 4 }, () => sender.send(destination, event));
  t.mock.timers.tick(5_000);
  assert.deepEqual(await Promise.all(attempts), Array.from({ length: 4 }, () => ({ kind: 'unconfirmed', reason: 'timeout' })));
  assert.deepEqual(await sender.send(destination, event), { kind: 'busy' });
  for (const settle of pending) settle([{ address: '127.0.0.1', family: 4 }]);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(await sender.send({ ...destination, endpoint: 'https://127.0.0.1/v1/logs' }, event), { kind: 'permanent_failure', reason: 'unsafe_destination' });
});
test('Given cancelled pending DNS, when the caller cancels, then late DNS cannot start a connection', async (t) => {
  let settle: (value: { address: string; family: number }[]) => void = () => {};
  t.mock.method(dns, 'lookup', () => new Promise((resolve) => { settle = resolve; }));
  const controller = new AbortController();
  const result = new OtlpAuditSender().send(destination, event, controller.signal);
  controller.abort(new Error('private cancellation detail'));
  assert.deepEqual(await result, { kind: 'cancelled' });
  settle([{ address: '8.8.8.8', family: 4 }]);
  await new Promise<void>((resolve) => setImmediate(resolve));
});
test('Given a DNS failure with secret details, when submitted, then only a safe transient outcome is returned', async (t) => {
  t.mock.method(dns, 'lookup', async () => { throw new Error('private token and source stack'); });
  assert.deepEqual(await new OtlpAuditSender().send(destination, event), { kind: 'transient_failure', reason: 'transport' });
});
test('Given an invalid event, when submitted, then DNS is never reached', async (t) => {
  const lookup = t.mock.method(dns, 'lookup', async () => { throw new Error('must not run'); });
  assert.deepEqual(await new OtlpAuditSender().send(destination, { ...event, timestamp: 'invalid' }), { kind: 'permanent_failure', reason: 'invalid_event' });
  assert.equal(lookup.mock.calls.length, 0);
});

test('Given a public DNS answer but a private connected peer, when TLS completes, then no HTTP event or credential is sent', async (t) => {
  const socket = new HandshakeSocketStub();
  t.mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
  t.mock.method(tls, 'connect', () => { queueMicrotask(() => socket.emit('secureConnect')); return socket; });
  const http = t.mock.method(https, 'request', () => { throw new Error('must not send HTTP'); });
  assert.deepEqual(await new OtlpAuditSender().send({ ...destination, auth: { type: 'bearer', token: 'private-token' } }, event), { kind: 'permanent_failure', reason: 'unsafe_destination' });
  assert.equal(http.mock.calls.length, 0);
  assert.equal(socket.closed, true);
});

test('Given cancelled handshakes whose sockets are still closing, when another attempt arrives, then physical resources retain admission', async (t) => {
  const sockets: HandshakeSocketStub[] = [];
  t.mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
  t.mock.method(tls, 'connect', () => {
    const socket = new HandshakeSocketStub(); socket.autoClose = false;
    sockets.push(socket); return socket;
  });
  const sender = new OtlpAuditSender(); const controller = new AbortController();
  const attempts = Array.from({ length: 4 }, () => sender.send(destination, event, controller.signal));
  await new Promise<void>((resolve) => setImmediate(resolve));
  controller.abort();
  assert.deepEqual(await Promise.all(attempts), Array.from({ length: 4 }, () => ({ kind: 'cancelled' })));
  assert.deepEqual(await sender.send(destination, event), { kind: 'busy' });
  for (const socket of sockets) { socket.closed = true; socket.emit('close'); }
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(await sender.send({ ...destination, endpoint: 'https://127.0.0.1/v1/logs' }, event), { kind: 'permanent_failure', reason: 'unsafe_destination' });
});

for (const code of ['CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_CRL', 'INVALID_PURPOSE']) {
  test(`Given TLS verification failure ${code}, when the connection fails, then it is a permanent safe TLS result`, async (t) => {
    t.mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
    t.mock.method(tls, 'connect', () => { throw Object.assign(new Error('private certificate details'), { code }); });
    assert.deepEqual(await new OtlpAuditSender().send(destination, event), { kind: 'permanent_failure', reason: 'tls' });
  });
}

for (const invalid of [
  { truncated: 'private invalid flag' },
  { originalBytes: -1 },
  { originalBytes: 1.5 },
  { originalBytes: Number.POSITIVE_INFINITY },
  { capturedBytes: -1 },
  { capturedBytes: 1.5 },
  { capturedBytes: 12 },
  { text: { private: 'not public text' } },
]) {
  test(`Given invalid result metadata ${JSON.stringify(invalid)}, when submitted, then a safe refusal occurs before transport`, async (t) => {
    const lookup = t.mock.method(dns, 'lookup', async () => { throw new Error('must not resolve'); });
    const request = t.mock.method(https, 'request', () => { throw new Error('must not send'); });
    const malformed = { ...event, result: { ...event.result, ...invalid } } as unknown as AuditEvent;
    const outcome = await new OtlpAuditSender().send(destination, malformed);
    assert.deepEqual(outcome, { kind: 'permanent_failure', reason: 'invalid_event' });
    assert.doesNotMatch(JSON.stringify(outcome), /private|public result|org-a|user-a/);
    assert.equal(lookup.mock.calls.length, 0);
    assert.equal(request.mock.calls.length, 0);
  });
}
