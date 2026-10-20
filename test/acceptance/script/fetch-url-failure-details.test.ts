import assert from 'node:assert/strict';
import { test } from 'node:test';
import { WebsiteFetchHttpError } from '../../../src/website-fetcher/website-fetcher.ts';
import { openFetchSite } from '../../support/in-process/mcp-fetch-site.ts';
import { runFetchUrl } from '../../support/processes/fetch-url-command.ts';

test('Given a page fetch that fails with HTTP 429 and private error details, when the command fetches the page, then it reports the status without exposing private data', { timeout: 10_000 }, async (t) => {
  const failure = new WebsiteFetchHttpError(429, { cause: new Error('PRIVATE_FETCH_CAUSE Bearer PRIVATE_FETCH_TOKEN') });
  failure.message = 'PRIVATE_FETCH_MESSAGE stdout stderr command path';
  const site = await openFetchSite(t, '2026-07-28', {
    fetcher: { fetchURL: async () => { throw failure; } },
  });

  const result = await runFetchUrl(t, [
    '--endpoint', site.url.href,
    '--url', 'https://source.example/article',
    '--reason', 'Debug the page conversion',
  ], { credential: 'PRIVATE_CLI_TOKEN' });

  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(site.fetchCalls.length, 1);
  assert.equal(site.pipelineCalls.length, 0);
  const completions = site.completionLines().map((line) => JSON.parse(line));
  assert.equal(completions.length, 1);
  assert.equal(completions[0].status, 'fetch_failed');
  assert.doesNotMatch(result.stderr + site.records.join('\n'), /PRIVATE_/);
  assert.equal(result.stderr, 'fetch-url: Page fetch failed: HTTP 429\n');
});
