import assert from 'node:assert/strict';
import test from 'node:test';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import type { TLSSocket } from 'node:tls';
import { requestAuditExport } from '../../../../src/logs/audit/otlp-audit-request.ts';

class RequestSpy extends EventEmitter {
  destroyed = false;
  body: Buffer | undefined;
  end(body: Buffer) { this.body = body; }
  destroy() { this.destroyed = true; return this; }
}

function responseWith(statusCode = 200, headers: Record<string, string> = { 'content-type': 'application/json' }) {
  return Object.assign(new PassThrough(), { statusCode, headers });
}

test('Given a checked socket and Bearer credential, when exporting, then POST uses only explicit headers and that socket', async (t) => {
  const request = new RequestSpy(); const response = responseWith(); const socket = {} as TLSSocket;
  t.mock.method(https, 'request', (options: https.RequestOptions, listener: (response: unknown) => void) => {
    assert.equal(options.method, 'POST'); assert.equal(options.path, '/custom/logs');
    assert.equal(options.agent, undefined); assert.equal(options.createConnection?.(options, () => {}), socket);
    assert.deepEqual(options.headers, { 'content-type': 'application/json', 'content-length': 2, connection: 'close', authorization: 'Bearer customer-token' });
    queueMicrotask(() => { listener(response); response.end('{}'); }); return request;
  });
  assert.deepEqual(await requestAuditExport(socket, new URL('https://collector.example/custom/logs'), Buffer.from('{}'), 'Bearer customer-token', new AbortController().signal), { kind: 'accepted' });
  assert.equal(request.body?.toString(), '{}');
});
test('Given no credential, when exporting, then no Authorization header is added', async (t) => {
  const response = responseWith();
  t.mock.method(https, 'request', (options: https.RequestOptions, listener: (response: unknown) => void) => {
    assert.ok(options.headers && !('authorization' in options.headers));
    queueMicrotask(() => { listener(response); response.end('{}'); }); return new RequestSpy();
  });
  assert.deepEqual(await requestAuditExport({} as TLSSocket, new URL('https://collector.example/v1/logs'), Buffer.from('{}'), undefined, new AbortController().signal), { kind: 'accepted' });
});
test('Given an oversized response stream, when its byte limit is exceeded, then request and response are destroyed without retry', async (t) => {
  const request = new RequestSpy(); const response = responseWith(503);
  t.mock.method(https, 'request', (_options: https.RequestOptions, listener: (response: unknown) => void) => {
    queueMicrotask(() => { listener(response); response.write(Buffer.alloc(16_385)); }); return request;
  });
  assert.deepEqual(await requestAuditExport({} as TLSSocket, new URL('https://collector.example/v1/logs'), Buffer.from('{}'), undefined, new AbortController().signal), { kind: 'unconfirmed', reason: 'response_too_large' });
  assert.equal(request.destroyed, true); assert.equal(response.destroyed, true);
});
test('Given unsupported success compression, when a response ends, then it cannot confirm acceptance', async (t) => {
  const response = responseWith(200, { 'content-type': 'application/json', 'content-encoding': 'gzip' });
  t.mock.method(https, 'request', (_options: https.RequestOptions, listener: (response: unknown) => void) => {
    queueMicrotask(() => { listener(response); response.end('{}'); }); return new RequestSpy();
  });
  assert.deepEqual(await requestAuditExport({} as TLSSocket, new URL('https://collector.example/v1/logs'), Buffer.from('{}'), undefined, new AbortController().signal), { kind: 'unconfirmed', reason: 'invalid_response' });
});
test('Given response headers exceed their limit, when Node refuses them, then the result is nonretryable', async (t) => {
  const request = new RequestSpy();
  t.mock.method(https, 'request', (options: https.RequestOptions) => { assert.equal(options.maxHeaderSize, 16_384); queueMicrotask(() => request.emit('error', Object.assign(new Error('private header text'), { code: 'HPE_HEADER_OVERFLOW' }))); return request; });
  assert.deepEqual(await requestAuditExport({} as TLSSocket, new URL('https://collector.example/v1/logs'), Buffer.from('{}'), undefined, new AbortController().signal), { kind: 'unconfirmed', reason: 'response_too_large' });
});
test('Given a cancelled operation, when exporting would start, then no HTTP request is created', async (t) => {
  const request = t.mock.method(https, 'request', () => { throw new Error('must not run'); });
  const controller = new AbortController(); controller.abort();
  assert.throws(() => requestAuditExport({} as TLSSocket, new URL('https://collector.example/v1/logs'), Buffer.from('{}'), undefined, controller.signal));
  assert.equal(request.mock.calls.length, 0);
});


test('Given end is queued after oversize, when parsing the end event, then no oversized combined buffer is allocated', async (t) => {
  const request = new RequestSpy(); const response = new EventEmitter() as EventEmitter & { statusCode: number; headers: Record<string, string>; destroy(): void };
  response.statusCode = 200; response.headers = { 'content-type': 'application/json' }; response.destroy = () => {};
  t.mock.method(https, 'request', (_options: https.RequestOptions, listener: (response: unknown) => void) => {
    queueMicrotask(() => { listener(response); response.emit('data', Buffer.alloc(16_385)); response.emit('end'); }); return request;
  });
  const concatenate = t.mock.method(Buffer, 'concat', () => { throw new Error('Oversize response must never be combined'); });
  assert.deepEqual(await requestAuditExport({} as TLSSocket, new URL('https://collector.example/v1/logs'), Buffer.from('{}'), undefined, new AbortController().signal), { kind: 'unconfirmed', reason: 'response_too_large' });
  assert.equal(concatenate.mock.calls.length, 0);
});
