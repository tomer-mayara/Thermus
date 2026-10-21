import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { test, type TestContext } from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { createRequestContext } from '../../../src/accounts/identity/access-context.ts';
import { CleanHtmlAdsAdblockRs } from '../../../src/pipelines/html-processing/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline, type HtmlProcessingContext } from '../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { PromptInjectionRemoverSanitizer } from '../../../src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { createFetchToolServer } from '../../../src/interfaces/mcp/fetch-tool-server.ts';
import { composeFetchOperation } from '../../support/in-process/fetch-operation.ts';
import { completionLinesIn } from '../../support/drivers/operator-log.ts';
import { generatedOperationIdPattern } from '../../support/fixtures/execution-context.ts';
import type { WebsiteFetchResult } from '../../../src/pipelines/providers/website-fetcher/website-fetcher.ts';
import { elementHidingRules } from '../../support/fixtures/ad-rules.ts';

const context = createRequestContext({
  user: { authority: 'https://synthetic.example/', subject: 'synthetic-user' },
  tenantId: 'synthetic-workspace',
  grants: [{ role: 'reader', permissions: ['product:access'] }],
});
const requestedUrl = 'HTTPS://Source.Example:443/a%2fb?private-query=secret#private-fragment';
const finalUrl = 'https://abptestpages.org/directory/article';
const reason = 'Read the related article.\nCompare its details.';

test('Given the real MCP operation and pipeline, when the client calls the fetch tool, then exact Markdown and one safe completion are returned', { timeout: 5_000 }, async (t) => {
  const page = { requestedUrl, finalUrl, html: '<p id="eh-id">Private ad source</p><p>Related <a href="child">article</a>.</p>' };
  const { pipeline } = realPipeline();
  const site = await connect(t, page, pipeline);

  const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: { url: requestedUrl, reason } });

  assert.deepEqual(result, { content: [{ type: 'text', text: 'Related [article](https://abptestpages.org/directory/child).' }] });
  assert.equal(site.fetchURL.mock.callCount(), 1);
  assert.equal(site.fetchURL.mock.calls[0].arguments[0], requestedUrl);
  assert.ok(site.fetchURL.mock.calls[0].arguments[1] instanceof AbortSignal);
  assert.equal(site.records.length, 1);
  const record = JSON.parse(site.records[0]);
  assert.match(record.operationId, generatedOperationIdPattern);
  assert.deepEqual(record, {
    event: 'mcp.tool.completed',
    operationId: record.operationId,
    authority: context.user.authority,
    subject: context.user.subject,
    tenantId: context.tenantId,
    tool: 'getURLAsMarkdown',
    url: 'https://source.example/a%2fb',
    urlStatus: 'valid',
    reason,
    reasonStatus: 'valid',
    status: 'success',
    durationMs: record.durationMs,
  });
  assert.ok(Number.isFinite(record.durationMs) && record.durationMs >= 0);
  assert.doesNotMatch(site.records[0], /private-query|private-fragment|Private ad source|Related \[article\]|\n/);
  assert.equal(site.error.mock.callCount(), 0);
});

let scanExhaustionHtml = '<span hidden>Private payload</span>';
for (let pass = 1; pass < 8; pass++) scanExhaustionHtml = `<${scanExhaustionHtml}span hidden>Private payload</span>`;

for (const { label, html, warning } of [
  { label: 'a failed HTML scan', html: '<p>Visible lead</p><body hidden>Private payload</body>', warning: 'HTML scan failed; remaining HTML withheld' },
  { label: 'scan exhaustion', html: scanExhaustionHtml, warning: 'HTML scan limit reached; remaining HTML withheld' },
]) {
  test(`Given ${label}, when the real MCP operation and sanitizer finish, then exact empty success has one success record`, { timeout: 5_000 }, async (t) => {
    const { pipeline, sanitizer } = realPipeline();
    const invoke = t.mock.method(sanitizer, 'invoke');
    const site = await connect(t, { requestedUrl, finalUrl, html }, pipeline);

    const result = await site.client.callTool({ name: 'getURLAsMarkdown', arguments: { url: requestedUrl, reason } });

    assert.deepEqual(result, { content: [{ type: 'text', text: '' }] });
    const sanitized = await invoke.mock.calls[0].result;
    assert.ok(sanitized);
    assert.equal(sanitized.html, '');
    assert.ok(sanitized.warnings?.includes(warning));
    assert.equal(site.records.length, 1);
    assert.equal(JSON.parse(site.records[0]).status, 'success');
    assert.doesNotMatch(site.records[0], /Private payload|remaining HTML withheld|private-query|private-fragment/);
    assert.equal(site.error.mock.callCount(), 0);
  });
}

test('Given a real sanitizer stage in progress, when the MCP client cancels, then Markdown conversion stops and one cancellation is recorded', { timeout: 5_000 }, async (t) => {
  const { pipeline, ads, sanitizer, markdown } = realPipeline();
  const adsInvoke = t.mock.method(ads, 'invoke');
  const markdownInvoke = t.mock.method(markdown, 'invoke');
  const stageEvents = new EventEmitter();
  const started = once(stageEvents, 'started', { signal: t.signal });
  const invoke = sanitizer.invoke.bind(sanitizer);
  const sanitizerInvoke = t.mock.method(sanitizer, 'invoke', (ctx: HtmlProcessingContext) => {
    const result = invoke(ctx);
    stageEvents.emit('started');
    return result;
  });
  const site = await connect(t, {
    requestedUrl, finalUrl,
    html: '<p id="eh-id">Private ad source</p><p>Visible article.</p><span hidden>Private payload</span>',
  }, pipeline);
  const controller = new AbortController();
  const rejected = assert.rejects(site.client.callTool(
    { name: 'getURLAsMarkdown', arguments: { url: requestedUrl, reason } },
    { signal: AbortSignal.any([controller.signal, t.signal]) },
  ));
  await started;
  const completed = once(site.events, 'completed', { signal: t.signal });

  controller.abort();
  await Promise.all([rejected, completed]);

  assert.equal(adsInvoke.mock.callCount(), 1);
  assert.equal(sanitizerInvoke.mock.callCount(), 1);
  assert.equal(markdownInvoke.mock.callCount(), 0);
  const sanitized = await sanitizerInvoke.mock.calls[0].result;
  assert.ok(sanitized);
  assert.equal(sanitized.html, '<p>Visible article.</p>');
  assert.equal(site.fetchURL.mock.calls[0].arguments[1]?.aborted, true);
  assert.equal(site.records.length, 1);
  assert.equal(JSON.parse(site.records[0]).status, 'cancelled');
  assert.doesNotMatch(site.records[0], /Private payload|Private ad source|Visible article|private-query|private-fragment/);
  assert.equal(site.error.mock.callCount(), 0);
});

function realPipeline() {
  const ads = new CleanHtmlAdsAdblockRs(elementHidingRules);
  const sanitizer = new PromptInjectionRemoverSanitizer();
  const markdown = new CleanHtmlToMarkdownDefuddle();
  return { ads, sanitizer, markdown, pipeline: new HtmlToMarkdownPipeline([ads, sanitizer, markdown]) };
}

async function connect(t: TestContext, page: WebsiteFetchResult, pipeline: HtmlToMarkdownPipeline) {
  const records: string[] = [];
  const events = new EventEmitter();
  const fetchURL = t.mock.fn(async (_url: string, _signal?: AbortSignal) => page);
  const error = t.mock.fn((_entry: string) => {});
  const server = createFetchToolServer(context, {
    operations: { fetch: composeFetchOperation({ fetcher: { fetchURL }, pipeline, records: { record: () => {} } }), search: async () => ({ status: 'released', markdown: 'test search' }) },
    logger: { info(entry) {
      if (completionLinesIn(entry).length === 1) { records.push(entry); events.emit('completed'); }
    }, error },
  });
  const client = new Client({ name: 'real-pipeline-integration', version: '0.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  t.after(async () => { await client.close(); await server.close(); });
  await server.connect(serverTransport);
  await client.connect(clientTransport, { signal: t.signal });
  return { client, fetchURL, records, error, events };
}
