import '../../support/deny-network.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ApplicationLogger } from '../../../src/application.ts';
import type { RequestContext } from '../../../src/auth/access-context.ts';
import type { FetchOperation } from '../../../src/mcp/get-url-as-markdown.ts';
import { MARKDOWN_LOG_LIMIT, observeFetches } from '../../acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.ts';

const url = 'https://news.example/story?page=2';
const context: RequestContext = {
  user: { authority: 'https://synthetic-auth.thermus.invalid', subject: 'synthetic-user' },
  tenantId: 'synthetic-workspace',
  grants: [{ role: 'user', permissions: ['product:access'] }],
  permissions: ['product:access'],
};
const startedLine = `INFO work-slice fetch started: ${url}`;
const operationRuns = 'operation runs';

interface ObservedFetch {
  readonly operation: FetchOperation;
  readonly timeline: string[];
  readonly calls: { url: string; context: RequestContext; signal: AbortSignal }[];
}

function observedFetch(outcome: () => Promise<string>, limit?: number): ObservedFetch {
  const timeline: string[] = [];
  const calls: ObservedFetch['calls'] = [];
  const log: ApplicationLogger = {
    info: (message) => { timeline.push(`INFO ${message}`); },
    error: (message) => { timeline.push(`ERROR ${message}`); },
  };
  const operation = observeFetches(async (requestedUrl, requestContext, signal) => {
    calls.push({ url: requestedUrl, context: requestContext, signal });
    timeline.push(operationRuns);
    return outcome();
  }, log, limit);
  return { operation, timeline, calls };
}

function completedLine(count: number, markdown: string): string {
  return `INFO work-slice fetch completed: ${url} gave ${count} characters of Markdown:\n${markdown}`;
}

function anySignal(): AbortSignal {
  return new AbortController().signal;
}

test('Given an operation that gives Markdown below the limit, when the observed fetch runs, then the started line comes before the operation, and the completed line has the count and the whole Markdown', async () => {
  const markdown = '# Story\n\nThe first paragraph.';
  const { operation, timeline } = observedFetch(async () => markdown, 2_000);

  const result = await operation(url, context, anySignal());

  assert.equal(result, markdown);
  assert.deepEqual(timeline, [startedLine, operationRuns, completedLine(29, markdown)]);
});

test('Given an operation that gives 2,000 emoji, when the observed fetch runs with the limit 2,000, then the completed line counts 2,000 code points, not 4,000 UTF-16 units, and has the whole Markdown without a cut marker', async () => {
  const markdown = '😀'.repeat(2_000);
  const { operation, timeline } = observedFetch(async () => markdown, 2_000);

  await operation(url, context, anySignal());

  assert.deepEqual(timeline, [startedLine, operationRuns, completedLine(2_000, markdown)]);
});

const cutSamples = [
  { name: '2,001 emoji', markdown: '😀'.repeat(2_001), kept: '😀'.repeat(2_000) },
  { name: 'one letter and 2,000 emoji', markdown: `a${'😀'.repeat(2_000)}`, kept: `a${'😀'.repeat(1_999)}` },
];
for (const { name, markdown, kept } of cutSamples) {
  test(`Given an operation that gives ${name}, which are 2,001 code points, when the observed fetch runs with the limit 2,000, then the completed line counts 2,001 characters, keeps the first 2,000 code points without a split surrogate pair, and names the 1 more character, and the caller gets the whole Markdown`, async () => {
    const { operation, timeline } = observedFetch(async () => markdown, 2_000);

    const result = await operation(url, context, anySignal());

    assert.equal(result, markdown);
    assert.deepEqual(timeline, [startedLine, operationRuns, `${completedLine(2_001, kept)}\n[cut: 1 more characters]`]);
    assert.ok(timeline[2].isWellFormed(), 'The completed line must not contain a lone surrogate.');
  });
}

test('Given no limit, when the operation gives MARKDOWN_LOG_LIMIT code points or one code point more, then the limit is 64 Ki code points and only the longer Markdown is cut', async () => {
  const atLimit = 'x'.repeat(MARKDOWN_LOG_LIMIT);
  const whole = observedFetch(async () => atLimit);
  const cut = observedFetch(async () => `${atLimit}😀`);

  await whole.operation(url, context, anySignal());
  await cut.operation(url, context, anySignal());

  assert.equal(MARKDOWN_LOG_LIMIT, 65_536);
  assert.equal(whole.timeline[2], completedLine(65_536, atLimit));
  assert.equal(cut.timeline[2], `${completedLine(65_537, atLimit)}\n[cut: 1 more characters]`);
});

const failures: ReadonlyArray<{ kind: string; failure: unknown; message: string }> = [
  { kind: 'an Error', failure: new Error('Page fetch failed'), message: 'Page fetch failed' },
  { kind: 'the cancellation DOMException', failure: new DOMException('Request cancelled', 'AbortError'), message: 'Request cancelled' },
  { kind: 'a value that is not an Error', failure: 'renderer stopped', message: 'renderer stopped' },
];
for (const { kind, failure, message } of failures) {
  test(`Given an operation that fails with ${kind}, when the observed fetch runs, then the log has the started line and an ERROR line with the message "${message}", and the fetch fails with the same value`, async () => {
    const { operation, timeline } = observedFetch(() => Promise.reject(failure));

    const thrown = await operation(url, context, anySignal()).then(
      () => assert.fail('The observed fetch must fail.'),
      (error: unknown) => error,
    );

    assert.equal(thrown, failure);
    assert.deepEqual(timeline, [startedLine, operationRuns, `ERROR work-slice fetch failed: ${url}: ${message}`]);
  });
}

test('Given an observed fetch, when it runs, then the operation gets the same URL, request context, and signal', async () => {
  const { operation, calls } = observedFetch(async () => 'Markdown');
  const signal = anySignal();

  await operation(url, context, signal);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, url);
  assert.equal(calls[0].context, context);
  assert.equal(calls[0].signal, signal);
});
