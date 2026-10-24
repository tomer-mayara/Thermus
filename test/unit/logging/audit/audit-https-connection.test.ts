import assert from 'node:assert/strict';
import test from 'node:test';
import tls from 'node:tls';
import { EventEmitter } from 'node:events';
import { connectAuditTls, closeAuditSocket } from '../../../../src/logs/audit/audit-https-connection.ts';

class TlsSocketStub extends EventEmitter {
  authorized = true;
  remoteAddress = '8.8.8.8';
  closed = false;
  destroyed = false;
  destroy() { this.destroyed = true; queueMicrotask(() => { this.closed = true; this.emit('close'); }); return this; }
}

test('Given a validated address, when TLS starts, then DNS cannot change the connection and the original hostname is verified', async (t) => {
  const socket = new TlsSocketStub();
  const connect = t.mock.method(tls, 'connect', (options: tls.ConnectionOptions) => { assert.equal(options.host, '8.8.8.8'); assert.equal(options.servername, 'collector.example'); assert.equal(options.rejectUnauthorized, true); queueMicrotask(() => socket.emit('secureConnect')); return socket; });
  const opened = await connectAuditTls(new URL('https://collector.example/v1/logs'), { address: '8.8.8.8', family: 4 }, new AbortController().signal);
  assert.equal(connect.mock.calls.length, 1);
  assert.equal(opened, socket);
  await closeAuditSocket(opened);
  assert.equal(socket.destroyed, true);
});
for (const address of ['127.0.0.1', '8.8.4.4', '::ffff:127.0.0.1']) {
  test(`Given actual peer ${address}, when TLS connects, then the socket closes before it can carry HTTP data`, async (t) => {
    const socket = new TlsSocketStub(); socket.remoteAddress = address;
    t.mock.method(tls, 'connect', () => { queueMicrotask(() => socket.emit('secureConnect')); return socket; });
    await assert.rejects(connectAuditTls(new URL('https://collector.example/v1/logs'), { address: '8.8.8.8', family: 4 }, new AbortController().signal));
    assert.equal(socket.closed, true);
  });
}
test('Given failed certificate authorization, when TLS connects, then the socket is closed', async (t) => {
  const socket = new TlsSocketStub(); socket.authorized = false;
  t.mock.method(tls, 'connect', () => { queueMicrotask(() => socket.emit('secureConnect')); return socket; });
  await assert.rejects(connectAuditTls(new URL('https://collector.example/v1/logs'), { address: '8.8.8.8', family: 4 }, new AbortController().signal));
  assert.equal(socket.closed, true);
});
test('Given an IP literal, when TLS starts, then SNI is omitted and certificate identity checks that IP', async (t) => {
  const socket = new TlsSocketStub();
  t.mock.method(tls, 'connect', (options: tls.ConnectionOptions) => { assert.equal(options.servername, undefined); assert.ok(options.checkServerIdentity?.('ignored', { subjectaltname: 'DNS:collector.example' } as tls.PeerCertificate)); queueMicrotask(() => socket.emit('secureConnect')); return socket; });
  const opened = await connectAuditTls(new URL('https://8.8.8.8/v1/logs'), { address: '8.8.8.8', family: 4 }, new AbortController().signal);
  await closeAuditSocket(opened);
});
test('Given a cancelled TLS handshake, when cancellation arrives, then the socket is disposed', async (t) => {
  const socket = new TlsSocketStub(); const controller = new AbortController();
  t.mock.method(tls, 'connect', () => { queueMicrotask(() => controller.abort()); return socket; });
  await assert.rejects(connectAuditTls(new URL('https://collector.example/v1/logs'), { address: '8.8.8.8', family: 4 }, controller.signal));
  assert.equal(socket.closed, true);
});
