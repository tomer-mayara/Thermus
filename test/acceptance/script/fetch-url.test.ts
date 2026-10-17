import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serveFetchUrlDebugSite } from '../../support/in-process/fetch-url-debug-site.ts';
import { runFetchUrl } from '../../support/processes/fetch-url-command.ts';

const pageUrl = 'https://example.com/article?item=1';
const reason = 'Debug the page conversion';

test('Given an accepted Bearer credential, when the command fetches a URL with a reason, then it prints exact Markdown', { timeout: 10_000 }, async (t) => {
  const site = await serveFetchUrlDebugSite(t);
  const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', pageUrl, '--reason', reason], { credential: 'test-debug-token' });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, '# Page\n\nExact Markdown.\n');
  assert.equal(result.stderr, '');
  assert.deepEqual(site.calls, [{ url: pageUrl, reason }]);
  assert.ok(site.requests.every((request) => request.authorization === 'Bearer test-debug-token'));
});

for (const mode of ['json', 'sse'] as const) {
  test(`Given a modern endpoint with ${mode} responses, when a credential comes from stdin, then the command negotiates and prints exact Markdown`, { timeout: 10_000 }, async (t) => {
    const site = await serveFetchUrlDebugSite(t, { responseMode: mode });
    const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', pageUrl, '--reason', reason, '--api-key-stdin'], { input: 'test-debug-token\n', credential: 'wrong-env-token' });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout, '# Page\n\nExact Markdown.\n');
    assert.equal(result.stderr, '');
    assert.ok(site.requests.some((request) => request.method === 'server/discover'));
    assert.ok(site.requests.some((request) => request.version === '2026-07-28'));
  });
}

test('Given a legacy endpoint and empty Markdown, when the command fetches, then negotiation succeeds with empty stdout', { timeout: 10_000 }, async (t) => {
  const site = await serveFetchUrlDebugSite(t, { legacy: true, result: { content: [{ type: 'text', text: '' }] } });
  const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', pageUrl, '--reason', reason], { credential: 'test-debug-token' });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, '');
  assert.deepEqual(site.calls, [{ url: pageUrl, reason }]);
  assert.ok(site.requests.some((request) => request.version === '2025-11-25'));
});

for (const status of [401, 403, 500]) {
  test(`Given HTTP ${status} with an echoed credential, when the command runs, then it fails without printing credentials`, { timeout: 10_000 }, async (t) => {
    const site = await serveFetchUrlDebugSite(t, { status, credential: 'private-debug-token' });
    const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', pageUrl, '--reason', reason], { credential: 'private-debug-token' });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, status === 500 ? /500/ : /Authentication|access/);
    assert.doesNotMatch(result.stderr, /private-debug-token/);
    assert.deepEqual(site.calls, []);
  });
}

test('Given a rejected credential, when the command fetches, then it reports authentication failure without running the tool', { timeout: 10_000 }, async (t) => {
  const site = await serveFetchUrlDebugSite(t);
  const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', pageUrl, '--reason', reason], { credential: 'private-wrong-token' });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Authentication|access/);
  assert.doesNotMatch(result.stderr, /private-wrong-token/);
  assert.deepEqual(site.calls, []);
});

for (const toolResult of [
  { isError: true, content: [{ type: 'text' as const, text: 'private-debug-token' }] },
  { content: [] },
  { content: [{ type: 'image' as const, data: 'YWJj', mimeType: 'image/png' }] },
]) {
  test(`Given ${toolResult.isError ? 'a failed tool' : toolResult.content.length ? 'an image result' : 'no text item'}, when the command fetches, then it prints no Markdown or credentials`, { timeout: 10_000 }, async (t) => {
    const site = await serveFetchUrlDebugSite(t, { result: toolResult, credential: 'private-debug-token' });
    const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', pageUrl, '--reason', reason], { credential: 'private-debug-token' });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /failed|Unexpected tool result/);
    assert.doesNotMatch(result.stderr, /private-debug-token/);
  });
}

for (const hang of ['server/discover', 'initialize', 'tools/call'] as const) {
  test(`Given a hung ${hang}, when the deadline passes, then the command aborts the connection and exits`, { timeout: 5_000 }, async (t) => {
    const site = await serveFetchUrlDebugSite(t, { hang, legacy: hang === 'initialize' });
    const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', pageUrl, '--reason', reason, '--timeout-ms', '300'], { credential: 'test-debug-token' });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /timed out/i);
    assert.equal(site.aborted(), 1);
  });
}

for (const crossOrigin of [false, true]) {
  test(`Given a ${crossOrigin ? 'cross-origin' : 'same-origin'} redirect, when the command connects, then it refuses to follow with the credential`, { timeout: 10_000 }, async (t) => {
    const target = await serveFetchUrlDebugSite(t);
    const site = await serveFetchUrlDebugSite(t, { redirect: crossOrigin ? target.endpoint : '/redirected' });
    const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', pageUrl, '--reason', reason], { credential: 'test-debug-token' });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /connection|HTTP/);
    assert.equal(target.requests.length, 0);
    assert.equal(site.requests.length, 1);
  });
}

test('Given a malformed MCP response, when the command connects, then it fails with a protocol diagnostic', { timeout: 10_000 }, async (t) => {
  const site = await serveFetchUrlDebugSite(t, { malformed: true });
  const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', pageUrl, '--reason', reason], { credential: 'test-debug-token' });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /protocol/);
});

test('Given an unreachable endpoint, when the command connects, then it exits with a transport diagnostic', { timeout: 5_000 }, async (t) => {
  const result = await runFetchUrl(t, ['--endpoint', 'http://127.0.0.1:0/mcp', '--url', pageUrl, '--reason', reason, '--timeout-ms', '500'], { credential: 'private-debug-token' });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /connection|timed out/);
  assert.doesNotMatch(result.stderr, /private-debug-token/);
});

test('Given a URL with caller spelling, when the command fetches, then it sends the original URL unchanged', { timeout: 10_000 }, async (t) => {
  const suppliedUrl = 'HTTPS://EXAMPLE.COM:443/a/%7evalue?x=%2f';
  const site = await serveFetchUrlDebugSite(t);
  const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', suppliedUrl, '--reason', reason], { credential: 'test-debug-token' });
  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(site.calls, [{ url: suppliedUrl, reason }]);
});
