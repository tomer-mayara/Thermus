import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { serveSearchDebugSite } from '../../support/in-process/search-debug-site.ts';
import { runSearch } from '../../support/processes/search-command.ts';

const query = ' Lightpanda browser documentation 🐼 ';
const reason = ' Find the official browser documentation ';
const searchArgs = (endpoint: string) => ['--endpoint', endpoint, '--query', query, '--reason', reason];

test('Given an accepted Bearer credential, when the command searches with a reason, then it prints the exact Markdown', { timeout: 10_000 }, async (t) => {
  const site = await serveSearchDebugSite(t);
  const result = await runSearch(t, ['--endpoint', site.endpoint, '--query', query, '--reason', reason], { credential: 'test-search-token' });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, '# Results\n\n[Browser](https://example.com/browser)\n');
  assert.equal(result.stderr, '');
  assert.deepEqual(site.calls, [{ query, reason }]);
  assert.ok(site.requests.every(({ authorization }) => authorization === 'Bearer test-search-token'));
});

for (const mode of ['json', 'sse'] as const) {
  test(`Given modern ${mode} responses, when search runs, then it negotiates the modern protocol and prints exact no-results Markdown`, async (t) => {
    const site = await serveSearchDebugSite(t, { responseMode: mode, result: { content: [{ type: 'text', text: 'No search results.' }] } });
    const result = await runSearch(t, searchArgs(site.endpoint), { credential: 'test-search-token' });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout, 'No search results.');
    assert.equal(result.stderr, '');
    assert.ok(site.requests.some(({ method }) => method === 'server/discover'));
    assert.ok(site.requests.some(({ version }) => version === '2026-07-28'));
  });
}

test('Given a legacy server and maximum search inputs, when search runs, then it preserves the accepted text and empty Markdown', async (t) => {
  const site = await serveSearchDebugSite(t, { legacy: true, result: { content: [{ type: 'text', text: '' }] } });
  const query = '🐼'.repeat(512);
  const reason = '🐼'.repeat(2000);
  const result = await runSearch(t, ['--endpoint', site.endpoint, '--query', query, '--reason', reason], { credential: 'test-search-token' });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.deepEqual(site.calls, [{ query, reason }]);
  assert.ok(site.requests.some(({ version }) => version === '2025-11-25'));
});

for (const message of ['Search content withheld', 'Search failed: HTTP 429', 'Search processing failed']) {
  test(`Given the public failure ${message}, when search fails, then it preserves only the safe diagnosis`, async (t) => {
    const site = await serveSearchDebugSite(t, { result: { isError: true, content: [{ type: 'text', text: message }], structuredContent: { token: 'private-remote-token' } } });
    const result = await runSearch(t, searchArgs(site.endpoint), { credential: 'test-search-token' });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `search: ${message}\n`);
  });
}

for (const [name, toolResult] of [
  ['a private suffix', { isError: true, content: [{ type: 'text', text: 'Search failed: HTTP 429 private-remote-token' }] }],
  ['extra content', { isError: true, content: [{ type: 'text', text: 'Search failed' }, { type: 'text', text: 'private-remote-token' }] }],
  ['a non-text success', { content: [{ type: 'image', data: 'YWJj', mimeType: 'image/png' }] }],
] satisfies [string, CallToolResult][]) {
  test(`Given ${name}, when search receives the tool result, then it fails without printing the remote content`, async (t) => {
    const site = await serveSearchDebugSite(t, { result: toolResult });
    const result = await runSearch(t, searchArgs(site.endpoint), { credential: 'test-search-token' });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, toolResult.isError ? 'search: Search failed. Check the query and server logs.\n' : 'search: Unexpected tool result: expected one Markdown text item.\n');
  });
}

for (const status of [401, 403, 500]) {
  test(`Given HTTP ${status} with private remote text, when search runs, then it reports the refusal without running the tool`, async (t) => {
    const site = await serveSearchDebugSite(t, { status });
    const result = await runSearch(t, searchArgs(site.endpoint), { credential: 'test-search-token' });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, status === 500 ? /500/ : /Authentication|access/);
    assert.doesNotMatch(result.stderr, /private-remote-token|test-search-token/);
    assert.deepEqual(site.calls, []);
  });
}

test('Given a redirect to another endpoint, when search connects, then it refuses before forwarding credentials', async (t) => {
  const destination = await serveSearchDebugSite(t);
  const site = await serveSearchDebugSite(t, { redirect: destination.endpoint });
  const result = await runSearch(t, searchArgs(site.endpoint), { credential: 'test-search-token' });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(destination.requests.length, 0);
});

for (const hang of ['server/discover', 'tools/call'] as const) {
  test(`Given a hung ${hang}, when the search deadline passes, then network work stops and the command exits`, { timeout: 5_000 }, async (t) => {
    const site = await serveSearchDebugSite(t, { hang });
    const result = await runSearch(t, [...searchArgs(site.endpoint), '--timeout-ms', '250'], { credential: 'test-search-token' });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /timed out/);
    assert.equal(site.aborted(), 1);
  });
}

test('Given a pending search, when SIGTERM arrives, then the command cancels network work and exits', { timeout: 5_000 }, async (t) => {
  const site = await serveSearchDebugSite(t, { hang: 'tools/call' });
  const result = await runSearch(t, searchArgs(site.endpoint), {
    credential: 'test-search-token', stop: { signal: 'SIGTERM', when: () => site.requests.some(({ method }) => method === 'tools/call') },
  });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /cancelled/);
  assert.equal(site.aborted(), 1);
});

test('Given a credential pipe that stays open, when the search deadline passes, then stdin closes and the command exits', { timeout: 5_000 }, async (t) => {
  const result = await runSearch(t, ['--query', query, '--reason', reason, '--api-key-stdin', '--timeout-ms', '150'], { keepInputOpen: true });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /timed out/);
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
  assert.equal(result.stderr, 'search: Search failed. Check the query and server logs.\n');
});
