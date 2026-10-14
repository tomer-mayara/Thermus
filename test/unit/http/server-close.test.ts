import assert from 'node:assert/strict';
import { Server } from 'node:net';
import { describe, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { startHttpServer } from '../../../src/http/server.ts';
import { bodyReader, connectionError, encoded, loopback, nextAcceptedConnection, publicBaseUrl, RawConnection, serve } from './fixtures/http-server-fixtures.ts';

describe('HTTP server close', () => {
  test('Given an idle keep-alive connection, when close is called, then the connection ends at once and close resolves before the grace period', { timeout: 5_000 }, async (t) => {
    const server = await serve(t, async () => new Response('ok'), { shutdownGraceMs: 10_000 });
    const connection = RawConnection.open(t, server).send(['GET /idle HTTP/1.1', 'Host: localhost:8080']);
    await connection.received('0\r\n\r\n');
    const started = performance.now();

    await server.close();
    const elapsed = performance.now() - started;

    assert.ok(elapsed < 1_000, `close took ${elapsed} ms`);
    assert.match(await connection.ended, /\r\nok\r\n0\r\n\r\n$/);
  });

  test('Given an accepted connection that has sent no request, when close is called, then the connection ends at once and close resolves before the grace period', { timeout: 5_000 }, async (t) => {
    let handled = 0;
    const server = await serve(t, async () => { handled += 1; return new Response('never'); }, { shutdownGraceMs: 3_000 });
    const accepted = nextAcceptedConnection(server);
    const connection = RawConnection.open(t, server);
    await accepted;
    const started = performance.now();

    await server.close();
    const elapsed = performance.now() - started;

    assert.ok(elapsed < 1_000, `close took ${elapsed} ms`);
    assert.equal(await connection.ended, '');
    assert.equal(handled, 0);
  });

  test('Given a fetch client with an idle keep-alive connection, when it aborts a streamed response that the handler leaves open after its request signal aborts, then close resolves before the grace period', { timeout: 5_000 }, async (t) => {
    const firstStarted = Promise.withResolvers<void>();
    const releaseFirst = Promise.withResolvers<void>();
    const aborted = Promise.withResolvers<void>();
    const server = await serve(t, async (request) => {
      if (new URL(request.url).pathname === '/first') {
        firstStarted.resolve();
        await releaseFirst.promise;
        return new Response('first');
      }
      request.signal.addEventListener('abort', () => aborted.resolve(), { once: true });
      return new Response(new ReadableStream<Uint8Array>({ start: (controller) => controller.enqueue(encoded('data: one\n\n')) }));
    }, { shutdownGraceMs: 3_000 });
    const first = fetch(new URL('/first', server.url));
    await firstStarted.promise;
    const cancelled = new AbortController();
    const reader = bodyReader(await fetch(new URL('/events', server.url), { signal: cancelled.signal }));
    await reader.read();
    releaseFirst.resolve();
    assert.equal(await (await first).text(), 'first');

    // Node's fetch (undici 7.29.0) replaces the aborted connection with a new one that sends no request. The idle
    // connection keeps the client's pool, so the new connection stays open until the client's idle timeout.
    const replacement = nextAcceptedConnection(server);
    cancelled.abort();
    await aborted.promise;
    await Promise.race([replacement, delay(1_000)]);
    const started = performance.now();
    await server.close();
    const elapsed = performance.now() - started;

    assert.ok(elapsed < 1_000, `close took ${elapsed} ms`);
  });

  test('Given an in-flight response, when close is called, then new connections are refused, the response finishes, and close resolves when it ends', { timeout: 5_000 }, async (t) => {
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const server = await serve(t, async () => {
      started.resolve();
      await release.promise;
      return new Response('finished');
    }, { shutdownGraceMs: 10_000 });
    const connection = RawConnection.open(t, server).send(['GET /slow HTTP/1.1', 'Host: localhost:8080']);
    await started.promise;

    const closing = server.close();
    const refused = await connectionError(server);
    release.resolve();
    const released = performance.now();
    await closing;
    const elapsed = performance.now() - released;

    assert.equal(refused.code, 'ECONNREFUSED');
    assert.ok(elapsed < 1_000, `close took ${elapsed} ms after the response`);
    assert.match(await connection.ended, /\r\nfinished\r\n0\r\n\r\n$/);
  });

  test('Given a streamed response that never ends, when close is called, then close waits for the grace period, ends the connection, and resolves', { timeout: 5_000 }, async (t) => {
    const cancelled = Promise.withResolvers<void>();
    const server = await serve(t, async () => new Response(new ReadableStream<Uint8Array>({
      start: (controller) => controller.enqueue(encoded('data: one\n\n')),
      cancel: () => cancelled.resolve(),
    })), { shutdownGraceMs: 100 });
    const reader = bodyReader(await fetch(server.url));
    await reader.read();
    const started = performance.now();

    await server.close();
    const elapsed = performance.now() - started;

    assert.ok(elapsed >= 90 && elapsed < 2_000, `close took ${elapsed} ms`);
    await assert.rejects(reader.read());
    await cancelled.promise;
  });

  test('Given close is called two times, when both calls finish, then both resolve, the server is closed, and a later call also resolves', { timeout: 5_000 }, async (t) => {
    const server = await serve(t, async () => new Response('ok'));
    const close = t.mock.method(Server.prototype, 'close');
    const schedule = t.mock.method(globalThis, 'setTimeout');
    const clear = t.mock.method(globalThis, 'clearTimeout');

    const first = server.close();
    const second = server.close();
    assert.equal(first, second);
    await Promise.all([first, second]);

    assert.equal((await connectionError(server)).code, 'ECONNREFUSED');
    await server.close();
    assert.equal(close.mock.callCount(), 1);
    assert.equal(schedule.mock.callCount(), 1);
    assert.deepEqual(clear.mock.calls.map(({ arguments: args }) => args[0]), [schedule.mock.calls[0]?.result]);
  });

  test('Given a listener cleanup failure, when concurrent and later close calls finish, then every call observes the same failure and the deadline is cleared once', { timeout: 5_000 }, async (t) => {
    const server = await startHttpServer(async () => new Response('ok'), { listen: loopback, publicBaseUrl });
    const failure = new Error('Listener cleanup failed');
    const originalClose = Server.prototype.close;
    const close = t.mock.method(Server.prototype, 'close', function (this: Server, callback?: (error?: Error) => void) {
      return originalClose.call(this, () => callback?.(failure));
    });
    const clear = t.mock.method(globalThis, 'clearTimeout');
    const first = server.close();
    assert.equal(server.close(), first);
    await assert.rejects(first, (error) => error === failure);
    await assert.rejects(server.close(), (error) => error === failure);

    assert.equal(close.mock.callCount(), 1);
    assert.equal(clear.mock.callCount(), 1);
  });
});
