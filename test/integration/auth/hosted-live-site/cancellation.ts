import assert from 'node:assert/strict';
import { once } from 'node:events';
import { text } from 'node:stream/consumers';
import { describe, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { composeApplication } from '../../../../src/application.ts';
import { sendHttpsRequest } from '../../../support/hosted-live/https-client.ts';
import { LocalHttpsSite, selfSignedCertificate } from '../../../support/hosted-live/local-https-site.ts';
import { localOrigin } from '../../../support/hosted-live/settings.ts';
import { beforeDeadline, httpsSettings, temporaryDirectory, writePortalBuild } from '../fixtures/https-site-fixtures.ts';

export function describeHttpsCancellation(): void {
  describe('Local HTTPS request cancellation and shutdown', () => {
    test('Given an active request before response headers, when its HTTPS client disconnects, then the backend request is cancelled', { timeout: 10_000 }, async (t) => {
      const started = Promise.withResolvers<void>();
      const aborted = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const certificate = await selfSignedCertificate(await temporaryDirectory(t));
      const site = await LocalHttpsSite.start(httpsSettings, {
        portalBuild: await writePortalBuild(t), certificate,
        application: async () => ({
          handle: async (request) => {
            request.signal.addEventListener('abort', () => aborted.resolve(), { once: true });
            started.resolve();
            await Promise.race([aborted.promise, release.promise]);
            return new Response('Finished');
          },
          close: async () => {},
        }),
      });
      t.after(() => site.close());
      const call = await sendHttpsRequest(new Request(`${localOrigin}/slow`), certificate.cert);
      const disconnected = assert.rejects(call.response);
      try {
        await started.promise;
        call.request.destroy(new Error('The client disconnected'));
        await disconnected;
        await beforeDeadline(aborted.promise);
      } finally {
        release.resolve();
      }
    });

    test('Given a response stream with no first chunk, when the HTTPS client receives its headers and then disconnects after a chunk, then the backend stream is cancelled', { timeout: 10_000 }, async (t) => {
      const cancelled = Promise.withResolvers<void>();
      const controller = Promise.withResolvers<ReadableStreamDefaultController<Uint8Array>>();
      let ended = false;
      const certificate = await selfSignedCertificate(await temporaryDirectory(t));
      const site = await LocalHttpsSite.start(httpsSettings, {
        portalBuild: await writePortalBuild(t), certificate,
        application: async () => ({
          handle: async () => new Response(new ReadableStream<Uint8Array>({
            start: controller.resolve,
            cancel: () => { ended = true; cancelled.resolve(); },
          }), { headers: { 'Content-Type': 'text/event-stream' } }),
          close: async () => {},
        }),
      });
      t.after(() => site.close());
      const call = await sendHttpsRequest(new Request(`${localOrigin}/stream`), certificate.cert);
      try {
        const incoming = await beforeDeadline(call.response);
        incoming.on('error', () => {});
        assert.equal(incoming.headers['content-type'], 'text/event-stream');
        const first = once(incoming, 'data');
        (await controller.promise).enqueue(new TextEncoder().encode('data: first\n\n'));
        await first;
        incoming.destroy();
        await beforeDeadline(cancelled.promise);
      } finally {
        call.request.destroy();
        if (!ended) (await controller.promise).close();
      }
    });

    test('Given a stream whose first chunk arrived, when the backend stream fails, then the HTTPS response fails instead of completing with truncated content', { timeout: 10_000 }, async (t) => {
      const controller = Promise.withResolvers<ReadableStreamDefaultController<Uint8Array>>();
      const certificate = await selfSignedCertificate(await temporaryDirectory(t));
      const site = await LocalHttpsSite.start(httpsSettings, {
        portalBuild: await writePortalBuild(t), certificate,
        application: async () => ({
          handle: async () => new Response(new ReadableStream<Uint8Array>({
            start: (opened) => {
              controller.resolve(opened);
              opened.enqueue(new TextEncoder().encode('first chunk\n'));
            },
          })),
          close: async () => {},
        }),
      });
      t.after(() => site.close());
      const call = await sendHttpsRequest(new Request(`${localOrigin}/fails`), certificate.cert);
      const incoming = await call.response;
      const first = once(incoming, 'data');
      const failed = assert.rejects(text(incoming));
      await first;
      (await controller.promise).error(new Error('The backend stream failed'));
      await failed;
    });

    test('Given active backend work and its application cleanup, when the site closes, then cleanup cancels the work before the listener drain deadline and the close waits for that drain', { timeout: 10_000 }, async (t) => {
      const started = Promise.withResolvers<void>();
      const release = Promise.withResolvers<void>();
      const cancelled = new AbortController();
      const site = await LocalHttpsSite.start(httpsSettings, {
        portalBuild: await writePortalBuild(t),
        application: async () => composeApplication(async () => {
          started.resolve();
          await Promise.race([once(cancelled.signal, 'abort'), release.promise]);
          return new Response('Cancelled work');
        }, { close: async () => { cancelled.abort(); } }),
      });
      t.after(() => site.close());
      const response = fetch(new URL('slow', site.thermusUrl));
      const consumed = response.then((answer) => answer.text());
      try {
        await started.promise;
        await beforeDeadline(site.close());
        assert.equal(cancelled.signal.aborted, true);
        assert.equal(await consumed, 'Cancelled work');
        await assert.rejects(fetch(site.thermusUrl));
      } finally {
        release.resolve();
        await consumed.catch(() => undefined);
      }
    });

    for (const cleanupFails of [false, true]) {
      test(`Given an application whose cleanup ${cleanupFails ? 'throws' : 'ignores the drain argument'}, when the site closes with a response still pending, then it waits for the listener to drain before ${cleanupFails ? 'reporting the cleanup failure' : 'completing'}`, { timeout: 10_000 }, async (t) => {
        const started = Promise.withResolvers<void>();
        const cancelled = Promise.withResolvers<void>();
        const finish = Promise.withResolvers<void>();
        const cleanupFailure = new Error('The application cleanup failed');
        const site = await LocalHttpsSite.start(httpsSettings, {
          portalBuild: await writePortalBuild(t),
          application: async () => ({
            handle: async () => {
              started.resolve();
              await cancelled.promise;
              await finish.promise;
              return new Response('The response drained');
            },
            close: async () => {
              cancelled.resolve();
              if (cleanupFails) throw cleanupFailure;
            },
          }),
        });
        t.after(() => site.close().catch(() => undefined));
        const consumed = fetch(new URL('slow', site.thermusUrl)).then((answer) => answer.text());
        await started.promise;
        let finished = false;
        const closing = site.close().then(
          () => { finished = true; return undefined; },
          (error: unknown) => { finished = true; return error; },
        );
        try {
          await cancelled.promise;
          await delay(25);
          assert.equal(finished, false, 'The site closed before its response drained');
          finish.resolve();
          assert.equal(await consumed, 'The response drained');
          assert.equal(await closing, cleanupFails ? cleanupFailure : undefined);
        } finally {
          finish.resolve();
          await consumed;
          await closing;
        }
      });
    }
  });
}
