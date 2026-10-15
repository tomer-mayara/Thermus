import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { openFetchSite, validFetchArguments } from '../../support/in-process/mcp-fetch-site.ts';
import { eraNegotiation, mcpProtocolEras } from '../../support/drivers/mcp/mcp-protocol-eras.ts';

for (const era of mcpProtocolEras) {
  for (const stage of ['fetch-rejection', 'after-fetch', 'after-pipeline'] as const) {
    test(`Given cancellation at ${stage} in ${era}, when ${era === '2026-07-28' ? 'the client aborts the call' : 'the client disconnects its HTTP stream'}, then work observes cancellation and no success is recorded`, { timeout: 5_000 }, async (t) => {
      const started = Promise.withResolvers<void>();
      const abortObserved = Promise.withResolvers<void>();
      const cancelled = new AbortController();
      const site = await openFetchSite(t, era, {
        httpSignal: era === '2025-11-25' ? cancelled.signal : undefined,
        fetcher: { fetchURL: async (url, signal) => {
          assert.ok(signal);
          if (stage !== 'after-pipeline') {
            started.resolve();
            await new Promise<void>((resolve) => signal.addEventListener('abort', () => { abortObserved.resolve(); resolve(); }, { once: true }));
            if (stage === 'fetch-rejection') throw new Error('private-fetch-abort-cause');
          }
          return { requestedUrl: url, finalUrl: url, html: '<p>Source</p>' };
        } },
        pipeline: { process: async (page, signal) => {
          assert.ok(signal);
          started.resolve();
          await new Promise<void>((resolve) => signal.addEventListener('abort', () => { abortObserved.resolve(); resolve(); }, { once: true }));
          return { ...page, removed: 0, skipped: 0, markdown: 'private-late-success' };
        } },
      });
      const pending = site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }, { signal: cancelled.signal });
      const rejected = assert.rejects(pending);
      await started.promise;
      cancelled.abort(new Error('private-client-abort-cause'));
      await rejected;
      await abortObserved.promise;
      const completion = JSON.parse(await site.firstCompletion);
      assert.equal(completion.status, 'cancelled');
      assert.equal(site.records.length, 1);
      assert.equal(site.fetchCalls.length, 1);
      assert.equal(site.pipelineCalls.length, stage === 'after-pipeline' ? 1 : 0);
      assert.doesNotMatch(site.records[0], /private-client-abort-cause|private-fetch-abort-cause|private-late-success/);
    });
  }

  test(`Given a cancelled signal before dispatch in ${era}, when the HTTP client starts the call, then no fetch or completion occurs`, async (t) => {
    const site = await openFetchSite(t, era);
    const cancelled = new AbortController();
    cancelled.abort();
    await assert.rejects(site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments }, { signal: cancelled.signal }));
    assert.deepEqual(site.fetchCalls, []);
    assert.deepEqual(site.records, []);
  });
}

for (const era of mcpProtocolEras) {
  test(`Given two active HTTP calls in ${era}, when one stream is cancelled, then the other call keeps its signal and completes`, { timeout: 5_000 }, async (t) => {
    const firstStarted = Promise.withResolvers<void>();
    const secondStarted = Promise.withResolvers<void>();
    const finishSecond = Promise.withResolvers<void>();
    const cancelled = new AbortController();
    const site = await openFetchSite(t, era, {
      httpSignal: era === '2025-11-25' ? cancelled.signal : undefined,
      fetcher: { fetchURL: async (url, signal) => {
        assert.ok(signal);
        if (url.endsWith('/cancel')) {
          firstStarted.resolve();
          await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve(), { once: true }));
        } else {
          secondStarted.resolve();
          await finishSecond.promise;
          assert.equal(signal.aborted, false);
        }
        return { requestedUrl: url, finalUrl: url, html: '<p>Source</p>' };
      } },
    });
    const otherClient = new Client({ name: 'independent-call', version: '0.0.0' }, { versionNegotiation: eraNegotiation(era) });
    t.after(() => otherClient.close());
    await otherClient.connect(new StreamableHTTPClientTransport(site.url, { authProvider: { token: async () => 'another-token' } }), { signal: t.signal, timeout: 5_000 });
    const first = site.client.callTool({ name: 'getURLAsMarkdown', arguments: { ...validFetchArguments, url: 'https://example.com/cancel' } }, { signal: cancelled.signal });
    const firstRejected = assert.rejects(first);
    const second = otherClient.callTool({ name: 'getURLAsMarkdown', arguments: { ...validFetchArguments, url: 'https://example.com/complete' } });
    await Promise.all([firstStarted.promise, secondStarted.promise]);
    cancelled.abort();
    await firstRejected;
    assert.equal(JSON.parse(await site.firstCompletion).status, 'cancelled');
    finishSecond.resolve();
    const result = await second;
    await otherClient.close();
    assert.equal(result.isError, undefined);
    assert.equal(site.records.length, 2);
    assert.deepEqual(site.records.map((entry) => JSON.parse(entry).status), ['cancelled', 'success']);
    assert.equal(site.pipelineCalls.length, 1);
    assert.equal(site.pipelineCalls[0]?.page.requestedUrl, 'https://example.com/complete');
  });
}
