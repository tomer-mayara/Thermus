import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { serveFetchUrlDebugSite } from '../../support/in-process/fetch-url-debug-site.ts';
import { runFetchUrl } from '../../support/processes/fetch-url-command.ts';
import { forcedGarbageCollection } from '../../support/processes/module-paths.ts';

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

for (const message of [
  'Page processing failed',
  'Page fetch failed',
  'Page fetch failed: HTTP 429',
  'Page fetch failed: HTTP request failed (status unavailable)',
  'Page fetch failed: Renderer readiness timed out',
  'Page fetch failed: DNS lookup failed',
  'Page fetch failed: Renderer could not start (ENOENT)',
  'Server busy. Try again later.',
  'Request cancelled',
  'Invalid tool arguments',
  'Access denied',
]) {
  test(`Given the public failure "${message}", when the command fetches, then it preserves the diagnosis on stderr`, { timeout: 10_000 }, async (t) => {
    const site = await serveFetchUrlDebugSite(t, { result: {
      isError: true,
      content: [{ type: 'text', text: message, _meta: { detail: 'private-debug-token' } }],
      structuredContent: { detail: 'private-debug-token' },
    }, credential: 'private-debug-token' });
    const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', pageUrl, '--reason', reason], { credential: 'private-debug-token' });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, `fetch-url: ${message}\n`);
  });
}

for (const [name, toolResult] of [
  ['unknown text', { isError: true, content: [{ type: 'text', text: 'private-debug-token' }] }],
  ['an unapproved HTTP status', { isError: true, content: [{ type: 'text', text: 'Page fetch failed: HTTP 200' }] }],
  ['a detailed diagnosis with private text appended', { isError: true, content: [{ type: 'text', text: 'Page fetch failed: HTTP 429 private-debug-token' }] }],
  ['a detailed diagnosis with a line break', { isError: true, content: [{ type: 'text', text: 'Page fetch failed: HTTP 429\nprivate-debug-token' }] }],
  ['a detailed diagnosis with terminal control characters', { isError: true, content: [{ type: 'text', text: '\u001b[31mPage fetch failed: HTTP 429\u001b[0m' }] }],
  ['a detailed diagnosis and a second text item', { isError: true, content: [{ type: 'text', text: 'Page fetch failed: HTTP 429' }, { type: 'text', text: 'private-debug-token' }] }],
  ['a detailed diagnosis and an image', { isError: true, content: [{ type: 'text', text: 'Page fetch failed: HTTP 429' }, { type: 'image', data: 'YWJj', mimeType: 'image/png' }] }],
  ['a diagnosis only in metadata', { isError: true, content: [{ type: 'text', text: 'private-debug-token' }], structuredContent: { message: 'Page fetch failed: HTTP 429' } }],
  ['a public message with private text appended', { isError: true, content: [{ type: 'text', text: 'Page processing failed: private-debug-token' }] }],
  ['a public message with a line break', { isError: true, content: [{ type: 'text', text: 'Page processing failed\nprivate-debug-token' }] }],
  ['a public message with terminal control characters', { isError: true, content: [{ type: 'text', text: '\u001b[31mPage processing failed\u001b[0m' }] }],
  ['a second text item', { isError: true, content: [{ type: 'text', text: 'Page processing failed' }, { type: 'text', text: 'private-debug-token' }] }],
  ['an extra image', { isError: true, content: [{ type: 'text', text: 'Page processing failed' }, { type: 'image', data: 'YWJj', mimeType: 'image/png' }] }],
  ['no error text', { isError: true, content: [] }],
  ['an error image', { isError: true, content: [{ type: 'image', data: 'YWJj', mimeType: 'image/png' }] }],
] satisfies [string, CallToolResult][]) {
  test(`Given a tool error with ${name}, when the command fetches, then it uses the generic diagnosis without exposing content`, { timeout: 10_000 }, async (t) => {
    const site = await serveFetchUrlDebugSite(t, { result: toolResult, credential: 'private-debug-token' });
    const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', pageUrl, '--reason', reason], { credential: 'private-debug-token' });
    assert.equal(result.code, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr, 'fetch-url: getURLAsMarkdown failed. Check the page URL and server logs.\n');
  });
}

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
    assert.ok(site.requests.some(({ method }) => method === hang), 'The timed-out request must reach the site');
    await site.abortObserved;
    assert.equal(site.aborted(), 1);
    if (hang === 'tools/call') assert.equal(site.requests.filter(({ method }) => method === 'tools/call').length, 1, 'An uncertain tool outcome must not be repeated');
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


test('Given no credential in a non-interactive process, when hosted fetch runs, then it requests login without starting a tool', async (t) => {
  const result = await runFetchUrl(t, ['--url', pageUrl, '--reason', reason, '--non-interactive']);
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /--login/);
});

test('Given an explicit environment credential, when login is requested, then it explains how to select OAuth without exposing the credential', async (t) => {
  const result = await runFetchUrl(t, ['--login'], { credential: 'private-explicit-token' });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /unset THERMUS_API_KEY/);
  assert.doesNotMatch(result.stderr, /private-explicit-token/);
});

test('Given a custom endpoint without an explicit credential, when fetch runs, then it refuses OAuth for that endpoint', async (t) => {
  const site = await serveFetchUrlDebugSite(t);
  const result = await runFetchUrl(t, ['--endpoint', site.endpoint, '--url', pageUrl, '--reason', reason]);
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /explicit Bearer/);
  assert.equal(site.requests.length, 0);
});

test('Given garbage collection during hung requests, when deadlines pass, then all three aborts remain observable', { timeout: 20_000 }, async (t) => {
  const environment = { ...process.env };
  delete environment.NODE_TEST_CONTEXT;
  const result = await promisify(execFile)(process.execPath, [
    '--expose-gc', '--import', forcedGarbageCollection, '--test', '--test-concurrency=1', '--test-reporter=tap',
    '--test-name-pattern=^Given a hung ', fileURLToPath(import.meta.url),
  ], { timeout: 18_000, killSignal: 'SIGKILL', signal: t.signal, env: environment }).catch((error: Error & { stdout?: string; stderr?: string }) => {
    assert.fail(JSON.stringify({ message: error.message, stdout: error.stdout, stderr: error.stderr }));
  });
  assert.match(result.stdout, /^# tests 3$/m);
  assert.match(result.stdout, /^# pass 3$/m);
  assert.match(result.stdout, /^# cancelled 0$/m);
  assert.match(result.stdout, /^# skipped 0$/m);
});
