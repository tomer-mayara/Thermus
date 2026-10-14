import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { RawConnection, serve } from './fixtures/http-server-fixtures.ts';

describe('HTTP server close and request bodies', () => {
  // Node counts a connection as idle only after it has read the complete request. The test starts close() in the
  // promise jobs that Node runs while it reads the body, so the answer can end before Node reads the rest. Node also
  // stops reading an unread body at its buffer limit until the response ends.
  const answersAfterClose = [
    { given: 'a POST with an unread 600 B body', method: 'POST', size: 600, readsBody: false },
    { given: 'a POST with an unread 64 KiB body', method: 'POST', size: 64 * 1024, readsBody: false },
    { given: 'a POST with an unread 1 MiB body', method: 'POST', size: 1024 * 1024, readsBody: false },
    { given: 'a POST with a 1 MiB body that the handler reads', method: 'POST', size: 1024 * 1024, readsBody: true },
    { given: 'a GET without a body', method: 'GET', size: 0, readsBody: false },
  ];
  for (const { given, method, size, readsBody } of answersAfterClose) {
    test(`Given ${given}, when its handler answers after close starts, then the response arrives and close resolves before the grace period`, { timeout: 5_000 }, async (t) => {
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const server = await serve(t, async (request) => {
        if (readsBody) await request.arrayBuffer();
        started.resolve();
        await release.promise;
        return new Response('closed', { status: 503 });
      }, { shutdownGraceMs: 3_000 });
      const length = size === 0 ? [] : [`Content-Length: ${size}`];
      const connection = RawConnection.open(t, server).send([`${method} /answer HTTP/1.1`, 'Host: localhost:8080', ...length], 'x'.repeat(size));
      await started.promise;

      const closing = server.close();
      release.resolve();
      const released = performance.now();
      await closing;
      const elapsed = performance.now() - released;

      assert.ok(elapsed < 1_000, `close took ${elapsed} ms after the response`);
      assert.match(await connection.ended, /^HTTP\/1\.1 503 Service Unavailable\r\n[^]*\r\nclosed\r\n0\r\n\r\n$/);
    });
  }

  for (const answered of ['before', 'after'] as const) {
    test(`Given a client that is still sending a body that the handler does not read, when the response ends ${answered} close starts, then close waits for the rest of the body and then ends the connection before the grace period`, { timeout: 5_000 }, async (t) => {
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const server = await serve(t, async () => {
        started.resolve();
        if (answered === 'after') await release.promise;
        return new Response('refused', { status: 413 });
      }, { shutdownGraceMs: 3_000 });
      const connection = RawConnection.open(t, server).send(['POST /upload HTTP/1.1', 'Host: localhost:8080', 'Content-Length: 1200'], 'x'.repeat(600));
      await started.promise;
      if (answered === 'before') await connection.received('\r\nrefused\r\n0\r\n\r\n');

      const closing = server.close();
      release.resolve();
      await connection.received('\r\nrefused\r\n0\r\n\r\n');
      // To end the connection before Node reads the rest can reset it, and the client can then lose the response.
      assert.equal(await Promise.race([closing.then(() => 'closed'), delay(100, 'open')]), 'open');
      connection.sendMore('x'.repeat(600));
      const sent = performance.now();
      await closing;
      const elapsed = performance.now() - sent;

      assert.ok(elapsed < 1_000, `close took ${elapsed} ms after the rest of the body`);
      assert.match(await connection.ended, /^HTTP\/1\.1 413 Payload Too Large\r\n[^]*\r\nrefused\r\n0\r\n\r\n$/);
    });
  }
});
