import assert from 'node:assert/strict';
import { Server } from 'node:net';
import { describe, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { startHttpServer } from '../../../src/http/server.ts';
import { bodyReader, connectionError, encoded, loopback, publicBaseUrl, RawConnection, serve, serverHandles } from './fixtures/http-server-fixtures.ts';

describe('HTTP server listening', () => {
  test('Given a free loopback port, when the server starts, then it serves requests and its URL reports the real host and port', { timeout: 5_000 }, async (t) => {
    const server = await serve(t, async () => new Response('hello'));

    const response = await fetch(server.url);

    assert.equal(await response.text(), 'hello');
    assert.notEqual(server.url.port, '0');
    assert.equal(server.url.href, `http://127.0.0.1:${server.url.port}/`);
  });

  test('Given an IPv6 loopback host, when the server starts, then its URL puts the host in brackets', { timeout: 5_000 }, async (t) => {
    const server = await serve(t, async () => new Response('hello'), { listen: { host: '::1', port: 0 } });

    const response = await fetch(server.url);

    assert.equal(await response.text(), 'hello');
    assert.equal(server.url.href, `http://[::1]:${server.url.port}/`);
  });

  test('Given a port that another server uses, when the server starts, then it rejects with the listen error and leaves no server running', { timeout: 5_000 }, async (t) => {
    const blocker = await serve(t, async () => new Response('first'));
    const before = serverHandles();

    await assert.rejects(
      startHttpServer(async () => new Response('second'), { listen: { host: '127.0.0.1', port: Number(blocker.url.port) }, publicBaseUrl }),
      { code: 'EADDRINUSE' },
    );

    // Node closes a failed listen handle one event loop turn later.
    while (serverHandles() > before) await delay(5);
    assert.equal(await (await fetch(blocker.url)).text(), 'first');
  });

  test('Given a listen address that a URL cannot show, when the server starts, then it rejects and the server stops listening', { timeout: 5_000 }, async (t) => {
    const listening: Server[] = [];
    t.mock.method(Server.prototype, 'address', function (this: Server) {
      listening.push(this);
      return { address: 'fe80::1%en0', family: 'IPv6', port: 8080 };
    });

    await assert.rejects(startHttpServer(async () => new Response('never'), { listen: loopback, publicBaseUrl }), { code: 'ERR_INVALID_URL' });

    assert.deepEqual(listening.map((server) => server.listening), [false]);
  });
});

describe('HTTP server cancellation', () => {
  test('Given a handler that waits for its request signal, when the client disconnects before the response, then the signal is aborted and the late body is cancelled', { timeout: 5_000 }, async (t) => {
    const started = Promise.withResolvers<AbortSignal>();
    const aborted = Promise.withResolvers<void>();
    const lateBodyCancelled = Promise.withResolvers<void>();
    const server = await serve(t, async (request) => {
      request.signal.addEventListener('abort', () => aborted.resolve());
      started.resolve(request.signal);
      await aborted.promise;
      return new Response(new ReadableStream<Uint8Array>({ cancel: () => lateBodyCancelled.resolve() }));
    });
    const connection = RawConnection.open(t, server).send(['GET /wait HTTP/1.1', 'Host: localhost:8080']);
    const signal = await started.promise;

    connection.disconnect();
    await aborted.promise;
    await lateBodyCancelled.promise;

    assert.equal(signal.aborted, true);
  });

  test('Given a streamed response, when the client disconnects before the stream ends, then the request signal is aborted and the body is cancelled', { timeout: 5_000 }, async (t) => {
    const signals: AbortSignal[] = [];
    const cancelled = Promise.withResolvers<void>();
    const server = await serve(t, async (request) => {
      signals.push(request.signal);
      return new Response(new ReadableStream<Uint8Array>({
        start: (controller) => controller.enqueue(encoded('data: one\n\n')),
        cancel: () => cancelled.resolve(),
      }));
    });
    const connection = RawConnection.open(t, server).send(['GET /events HTTP/1.1', 'Host: localhost:8080']);
    await connection.received('data: one');

    connection.disconnect();
    await cancelled.promise;

    assert.deepEqual(signals.map((signal) => signal.aborted), [true]);
  });
});

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

    await Promise.all([server.close(), server.close()]);

    assert.equal((await connectionError(server)).code, 'ECONNREFUSED');
    await server.close();
  });
});
