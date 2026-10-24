import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { setTimeout as delay, setImmediate as nextTurn } from 'node:timers/promises';
import type { FetchHandler } from '../../../src/runtime/http/server.ts';
import { bodyReader, decoded, encoded, RawConnection, serve } from './fixtures/http-server-fixtures.ts';

describe('HTTP server handler errors', () => {
  const failingHandlers: ReadonlyArray<[string, FetchHandler]> = [
    ['throws', (request) => {
      throw new Error(`Rejected ${request.headers.get('Authorization')}`);
    }],
    ['rejects', async (request) => {
      throw new Error(`Rejected ${request.headers.get('Authorization')} with ${await request.text()}`);
    }],
  ];
  for (const [failure, handler] of failingHandlers) {
    test(`Given a handler that ${failure} with request data in its error, when a request arrives, then the client gets a generic 500 and the log has no request data`, { timeout: 5_000 }, async (t) => {
      const messages: string[] = [];
      const server = await serve(t, handler, { logger: { error: (message) => messages.push(String(message)) } });

      const response = await fetch(new URL('/fail?code=secret-query', server.url), {
        method: 'POST',
        headers: { Authorization: 'Bearer secret-token' },
        body: 'secret-body',
      });

      assert.equal(response.status, 500);
      assert.equal(await response.text(), 'Internal Server Error');
      assert.deepEqual(messages, ['The HTTP handler failed for POST /fail: Error']);
    });
  }

  test('Given a response body that fails after its first chunk, when the client reads it, then the connection ends before the response ends and the log has a short message', { timeout: 5_000 }, async (t) => {
    const messages: string[] = [];
    const failure = Promise.withResolvers<void>();
    const server = await serve(t, async () => new Response(new ReadableStream<Uint8Array>({
      start: (controller) => controller.enqueue(encoded('data: one\n\n')),
      pull: async (controller) => {
        await failure.promise;
        controller.error(new Error('Stream failed with secret-detail'));
      },
    })), { logger: { error: (message) => messages.push(String(message)) } });

    const reader = bodyReader(await fetch(new URL('/events', server.url)));
    const first = await reader.read();
    failure.resolve();

    await assert.rejects(reader.read());
    assert.equal(decoded(first.value), 'data: one\n\n');
    assert.deepEqual(messages, ['The HTTP handler failed for GET /events: Error']);
  });
});

describe('HTTP server response', () => {
  test('Given a response with a status text, headers, two cookies, and a body, when the client gets it, then every part arrives and the cookies stay separate', { timeout: 5_000 }, async (t) => {
    const server = await serve(t, async () => new Response('created body', {
      status: 201,
      statusText: 'Made Here',
      headers: [['Set-Cookie', 'session=one; HttpOnly'], ['Set-Cookie', 'theme=dark'], ['X-Kind', 'example'], ['Content-Type', 'text/plain']],
    }));

    const response = await fetch(server.url);

    assert.equal(response.status, 201);
    assert.equal(response.statusText, 'Made Here');
    assert.deepEqual(response.headers.getSetCookie(), ['session=one; HttpOnly', 'theme=dark']);
    assert.equal(response.headers.get('X-Kind'), 'example');
    assert.equal(response.headers.get('Content-Type'), 'text/plain');
    assert.equal(await response.text(), 'created body');
  });

  test('Given a handler that streams events over time, when a client reads the response, then the headers and each event arrive before the next event is sent', { timeout: 5_000 }, async (t) => {
    const events = new TransformStream<Uint8Array, Uint8Array>();
    const writer = events.writable.getWriter();
    const server = await serve(t, async () => new Response(events.readable, { headers: { 'Content-Type': 'text/event-stream' } }));

    const response = await fetch(server.url);
    const reader = bodyReader(response);
    await writer.write(encoded('data: one\n\n'));
    const first = await reader.read();
    await writer.write(encoded('data: two\n\n'));
    const second = await reader.read();
    await writer.close();

    assert.equal(response.headers.get('Content-Type'), 'text/event-stream');
    assert.deepEqual([decoded(first.value), decoded(second.value)], ['data: one\n\n', 'data: two\n\n']);
    assert.equal((await reader.read()).done, true);
  });

  test('Given a client that stops reading, when the handler streams a large body, then the bridge stops reading the body until the client reads again', { timeout: 5_000 }, async (t) => {
    let pulls = 0;
    const chunk = new Uint8Array(65_536);
    const server = await serve(t, async () => new Response(new ReadableStream<Uint8Array>({
      async pull(controller) {
        pulls += 1;
        await nextTurn();
        controller.enqueue(chunk);
      },
    }, { highWaterMark: 0 })));
    const reader = bodyReader(await fetch(server.url));
    await reader.read();

    await delay(300);
    const pullsWhileClientWaits = pulls;
    while (pulls <= pullsWhileClientWaits) await reader.read();
    await reader.cancel();

    assert.ok(pullsWhileClientWaits < 1_000, `The bridge read ${pullsWhileClientWaits} chunks while the client did not read.`);
  });

  test('Given a HEAD request, when the handler returns a body that never ends, then the client gets the headers without the body and the body is cancelled', { timeout: 5_000 }, async (t) => {
    const cancelled = Promise.withResolvers<void>();
    const server = await serve(t, async () => new Response(new ReadableStream<Uint8Array>({
      start: (controller) => controller.enqueue(encoded('body text')),
      cancel: () => cancelled.resolve(),
    }), { headers: { 'X-Kind': 'head' } }));

    const response = await RawConnection.open(t, server).send(['HEAD /page HTTP/1.1', 'Host: localhost:8080', 'Connection: close']).ended;
    await cancelled.promise;

    assert.match(response, /^HTTP\/1\.1 200 OK\r\n/);
    assert.match(response, /\r\nx-kind: head\r\n/i);
    assert.ok(response.endsWith('\r\n\r\n'), 'The response ends after its headers.');
    assert.doesNotMatch(response, /body text/);
  });
});
