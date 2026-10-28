import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readBoundedBody } from '../../../src/runtime/http/bounded-body.ts';

// A request body that the test sends in chunks and that records each cancel and each read.
function streamedRequest(chunks: readonly string[], headers: Record<string, string> = {}) {
  const sent = { reads: 0, cancels: [] as unknown[] };
  const queue = chunks.map((chunk) => new TextEncoder().encode(chunk));
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      sent.reads += 1;
      const next = queue.shift();
      if (next === undefined) controller.close();
      else controller.enqueue(next);
    },
    cancel(reason) { sent.cancels.push(reason); },
  }, { highWaterMark: 0 });
  return { request: new Request('http://gateway.test/mcp', { method: 'POST', headers, body, duplex: 'half' }), sent };
}

test('Given a body within the limit, when it is read, then the reader gives all its bytes and cancels nothing', async () => {
  const { request, sent } = streamedRequest(['{"jsonrpc":', '"2.0"}']);
  const bytes = await readBoundedBody(request, 64, new AbortController().signal);
  assert.equal(bytes?.toString('utf8'), '{"jsonrpc":"2.0"}');
  assert.deepEqual(sent.cancels, []);
});

test('Given a body of exactly the limit, when it is read, then the reader gives the body', async () => {
  const { request } = streamedRequest(['12345', '678']);
  const bytes = await readBoundedBody(request, 8, new AbortController().signal);
  assert.equal(bytes?.toString('utf8'), '12345678');
});

test('Given a Content-Length above the limit, when the body is read, then the reader gives undefined, reads no byte, and cancels the body', async () => {
  const { request, sent } = streamedRequest(['123456789'], { 'content-length': '9' });
  assert.equal(await readBoundedBody(request, 8, new AbortController().signal), undefined);
  assert.equal(sent.reads, 0);
  assert.equal(sent.cancels.length, 1);
});

test('Given a streamed body above the limit, when it is read, then the reader gives undefined and cancels the rest of the body', async () => {
  const { request, sent } = streamedRequest(['12345', '6789', 'never read']);
  assert.equal(await readBoundedBody(request, 8, new AbortController().signal), undefined);
  assert.equal(sent.cancels.length, 1);
  assert.equal(sent.reads, 2);
});

test('Given a read in progress, when the signal aborts, then the read rejects with the abort reason and cancels the body', async () => {
  const stop = new AbortController();
  const cancels: unknown[] = [];
  const body = new ReadableStream<Uint8Array>({ pull() { stop.abort(new Error('client gone')); }, cancel(reason) { cancels.push(reason); } }, { highWaterMark: 0 });
  const request = new Request('http://gateway.test/mcp', { method: 'POST', body, duplex: 'half' });
  await assert.rejects(readBoundedBody(request, 64, stop.signal), /client gone/);
  assert.equal(cancels.length, 1);
});

test('Given a signal that aborted before the read, when the body is read, then the read rejects with the abort reason and reads no byte', async () => {
  const { request, sent } = streamedRequest(['{}']);
  const stop = new AbortController();
  stop.abort(new Error('shutdown'));
  await assert.rejects(readBoundedBody(request, 64, stop.signal), /shutdown/);
  assert.equal(sent.reads, 0);
});

test('Given a request without a body, when it is read, then the reader gives an empty buffer', async () => {
  const bytes = await readBoundedBody(new Request('http://gateway.test/mcp'), 64, new AbortController().signal);
  assert.equal(bytes?.byteLength, 0);
});
