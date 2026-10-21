import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serveSearchDebugSite } from '../../support/in-process/search-debug-site.ts';
import { runSearch } from '../../support/processes/search-command.ts';

const query = ' Lightpanda browser documentation 🐼 ';
const reason = ' Find the official browser documentation ';

test('Given an accepted Bearer credential, when the command searches with a reason, then it prints the exact Markdown', { timeout: 10_000 }, async (t) => {
  const site = await serveSearchDebugSite(t);
  const result = await runSearch(t, ['--endpoint', site.endpoint, '--query', query, '--reason', reason], { credential: 'test-search-token' });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, '# Results\n\n[Browser](https://example.com/browser)\n');
  assert.equal(result.stderr, '');
  assert.deepEqual(site.calls, [{ query, reason }]);
  assert.ok(site.requests.every(({ authorization }) => authorization === 'Bearer test-search-token'));
});

test('Given a Bearer credential on stdin, when the command searches, then stdin replaces the environment credential', { timeout: 10_000 }, async (t) => {
  const site = await serveSearchDebugSite(t);
  const result = await runSearch(t, ['--endpoint', site.endpoint, '--query', query, '--reason', reason, '--api-key-stdin'], {
    input: 'test-search-token\n', credential: 'private-wrong-token',
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, '# Results\n\n[Browser](https://example.com/browser)\n');
  assert.deepEqual(site.calls, [{ query, reason }]);
});

test('Given a search failure with private remote text, when the command searches, then it reports a safe diagnosis and no Markdown', { timeout: 10_000 }, async (t) => {
  const site = await serveSearchDebugSite(t, { result: { isError: true, content: [{ type: 'text', text: 'private-search-token' }] } });
  const result = await runSearch(t, ['--endpoint', site.endpoint, '--query', query, '--reason', reason], { credential: 'test-search-token' });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'search: search failed. Check the query and server logs.\n');
});
