import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WebsiteFetchFailure, type FetchDiagnostic } from '../../../src/website-fetcher/website-fetcher.ts';
import { openFetchSite, validFetchArguments } from '../../support/in-process/mcp-fetch-site.ts';

for (const [diagnostic, detail] of [
  [{ category: 'http', phase: 'renderer_result', httpStatus: 429 }, 'HTTP 429'],
  [{ category: 'http', phase: 'renderer_result' }, 'HTTP request failed (status unavailable)'],
  [{ category: 'http', phase: 'renderer_process', exitCode: 22, metadata: 'absent' }, 'HTTP request failed (status unavailable)'],
  [{ category: 'http', phase: 'renderer_process', exitCode: 22, metadata: 'invalid' }, 'HTTP request failed (status unavailable)'],
  [{ category: 'readiness_timeout', phase: 'renderer_process', budgetMs: 20_000 }, 'Renderer readiness timed out'],
  [{ category: 'dns_timeout', phase: 'destination_policy', budgetMs: 5_000 }, 'DNS lookup timed out'],
  [{ category: 'launch', phase: 'renderer_launch', processErrorCode: 'ENOENT' }, 'Renderer could not start (ENOENT)'],
  [{ category: 'unknown', phase: 'destination_policy', processErrorCode: 'ENOTFOUND' }, 'DNS lookup failed'],
  [{ category: 'renderer', phase: 'renderer_result', rendererErrorCode: 'OperationTimedout' }, 'Renderer request timed out'],
  [{ category: 'renderer', phase: 'renderer_result', rendererErrorCode: 'HttpError' }, 'HTTP request failed (status unavailable)'],
  [{ category: 'unknown', phase: 'renderer_process', httpStatus: 429, signal: 'SIGTERM' }, 'Renderer process was interrupted'],
] as const) {
  test(`Given a page fetch with ${detail}, when an SDK client calls the tool, then it receives one safe text failure and a fetch_failed completion`, async (t) => {
    const failure = new WebsiteFetchFailure('PRIVATE message URL HTML stdout stderr path', diagnostic, { cause: new Error('PRIVATE cause') });
    const site = await openFetchSite(t, '2026-07-28', { fetcher: { fetchURL: async () => { throw failure; } } });
    const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });

    assert.deepEqual([result.content, result.isError], [[{ type: 'text', text: `Page fetch failed: ${detail}` }], true]);
    assert.equal(site.fetchCalls.length, 1);
    assert.equal(site.pipelineCalls.length, 0);
    assert.equal(site.completionLines().length, 1);
    assert.equal(JSON.parse(site.completionLines()[0]).status, 'fetch_failed');
    assert.doesNotMatch(JSON.stringify(result) + site.records.join('\n'), /PRIVATE/);
  });
}

for (const failure of [
  new Error('Page fetch failed: HTTP 429 PRIVATE'),
  new WebsiteFetchFailure('PRIVATE message', { category: 'unknown', phase: 'renderer_result', httpStatus: 429 }),
  new WebsiteFetchFailure('PRIVATE message', { category: 'PRIVATE', phase: 'PRIVATE', httpStatus: 429 } as unknown as FetchDiagnostic),
]) {
  test('Given an unclassified fetch failure with private details, when an SDK client calls the tool, then it receives only the generic fetch failure', async (t) => {
    const site = await openFetchSite(t, '2026-07-28', { fetcher: { fetchURL: async () => { throw failure; } } });
    const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: validFetchArguments });
    assert.deepEqual([result.content, result.isError], [[{ type: 'text', text: 'Page fetch failed' }], true]);
    assert.equal(JSON.parse(site.completionLines()[0]).status, 'fetch_failed');
  });
}
