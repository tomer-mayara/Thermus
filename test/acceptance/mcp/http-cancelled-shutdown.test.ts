import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import { openFetchSite, validFetchArguments } from '../../support/mcp-fetch-site.ts';

test('Given a 2026-07-28 SDK call cancelled while fetch waits, when the server stops after its cancelled completion, then stop does not wait for that connection', { timeout: 10_000 }, async (t) => {
  const started = Promise.withResolvers<void>();
  const cancelled = new AbortController();
  const site = await openFetchSite(t, '2026-07-28', {
    fetcher: { fetchURL: async (url, signal) => {
      assert.ok(signal);
      started.resolve();
      await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
      // Wait for asynchronous fetch cleanup before recording cancellation.
      await delay(50);
      return { requestedUrl: url, finalUrl: url, html: '<p>Late source</p>' };
    } },
    pipeline: { process: async (page) => ({ ...page, removed: 0, skipped: 0, markdown: 'Late success' }) },
  });
  const pending = site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }, { signal: cancelled.signal });
  const rejected = assert.rejects(pending);
  await started.promise;

  cancelled.abort();
  await rejected;
  assert.equal(JSON.parse(await site.firstCompletion).status, 'cancelled');
  const stoppingAt = performance.now();
  await Promise.all([site.listener.close(), site.server.close()]);
  const elapsedMs = performance.now() - stoppingAt;

  assert.equal(site.records.length, 1);
  assert.equal(site.pipelineCalls.length, 0);
  assert.doesNotMatch(site.records[0], /Late source|Late success/);
  assert.ok(elapsedMs < 1_000, `server stop took ${elapsedMs.toFixed(1)} ms after cancellation`);
});
