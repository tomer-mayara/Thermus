import { executionContextOf } from '../../support/fixtures/execution-context.ts';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createRequestContext } from '../../../src/accounts/identity/access-context.ts';
import { CleanHtmlAdsAdblockRs } from '../../../src/pipelines/html-processing/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline, type HtmlProcessingContext } from '../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { PromptInjectionRemoverSanitizer } from '../../../src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { composeFetchOperation } from '../../support/in-process/fetch-operation.ts';
import type { StepRecord } from '../../../src/pipelines/execution/step-record.ts';
import { HiddenHtmlScanner } from '../../../src/pipelines/html-processing/prompt-injection-remover/hidden-html-scanner.ts';
import { elementHidingRules } from '../../support/fixtures/ad-rules.ts';

const context = createRequestContext({
  user: { authority: 'https://synthetic.example/', subject: 'synthetic-user' },
  tenantId: 'synthetic-workspace',
  grants: [{ role: 'reader', permissions: ['product:access'] }],
});

describe('getURLAsMarkdown with the real HTML pipeline', () => {
  const cases = [
    { label: 'empty source', html: '', warning: undefined, code: undefined },
    { label: 'hidden-only source', html: '<div hidden>Private payload</div>', warning: 'HTML sanitized: 1 hidden element(s) removed', code: undefined },
    { label: 'ad-only source', html: '<p id="eh-id">Ad target</p>', warning: undefined, code: undefined },
    {
      label: 'a failed scan of an unsourced hidden body',
      html: '<p>Visible lead</p><body hidden>Private payload</body>',
      warning: 'HTML scan failed; remaining HTML withheld', code: 'scan_failed',
    },
    {
      label: 'eight HTML removal scans',
      html: hiddenAfterPasses(8),
      warning: 'HTML scan limit reached; remaining HTML withheld', code: 'scan_limit',
    },
  ];

  for (const { label, html, warning, code } of cases) {
    test(`Given ${label}, when the pipeline completes, then the operation preserves exact empty success`, async (t) => {
      const page = { requestedUrl: 'https://source.example/start', finalUrl: 'https://abptestpages.org/article', html };
      const pipeline = new HtmlToMarkdownPipeline([
        new CleanHtmlAdsAdblockRs(elementHidingRules),
        new PromptInjectionRemoverSanitizer(),
        new CleanHtmlToMarkdownDefuddle(),
      ]);
      const process = t.mock.method(pipeline, 'process');
      const scans = t.mock.method(HiddenHtmlScanner, 'scan');
      const entries: StepRecord[] = [];
      const execution = executionContextOf();
      const operation = composeFetchOperation({ fetcher: { async fetchURL() { return page; } }, pipeline, records: { record: (entry) => { entries.push(entry); } } });

      assert.equal(await operation(page.requestedUrl, context, execution), '');

      assert.equal(process.mock.callCount(), 1);
      assert.equal(entries.length, 2);
      assert.deepEqual(entries.map(({ durationMs: _duration, ...entry }) => entry), [
        { event: 'pipeline.step.completed', operationId: execution.operationId, stepId: 'outgoing.observe_request', outcome: 'allowed' },
        { event: 'pipeline.step.completed', operationId: execution.operationId, stepId: 'incoming.process_html', outcome: code ? 'blocked' : 'allowed', ...(code ? { code } : {}) },
      ]);
      if (code === 'scan_limit') assert.equal(scans.mock.callCount(), 8);

      const result = await process.mock.calls[0].result;
      assert.ok(result);
      assert.equal(result.markdown, '');
      assert.equal(result.scanWithholding, code);
      assert.equal(result.requestedUrl, page.requestedUrl);
      assert.equal(result.finalUrl, page.finalUrl);
      if (warning) assert.ok(result.warnings?.includes(warning));
      if (label === 'ad-only source') assert.equal(result.removed, 1);
      assert.equal(page.html, html);
    });
  }

  test('Given a redirect, when the real pipeline removes ads and resolves links, then it uses finalUrl and preserves requestedUrl spelling', async (t) => {
    const page = {
      requestedUrl: 'HTTPS://Source.Example:443/a%2fb?q=%2f#Part',
      finalUrl: 'https://abptestpages.org/directory/article',
      html: '<p id="eh-id">Ad target</p><p>Related <a href="child">article</a>.</p>',
    };
    const original = { ...page };
    const stages = [
      new CleanHtmlAdsAdblockRs(elementHidingRules),
      new PromptInjectionRemoverSanitizer(),
      new CleanHtmlToMarkdownDefuddle(),
    ];
    const order: number[] = [];
    const invocations = stages.map((stage, index) => {
      const invoke = stage.invoke.bind(stage);
      return t.mock.method(stage, 'invoke', async (ctx: HtmlProcessingContext) => { order.push(index); return invoke(ctx); });
    });
    const pipeline = new HtmlToMarkdownPipeline(stages);
    const process = t.mock.method(pipeline, 'process');
    const operation = composeFetchOperation({ fetcher: { async fetchURL() { return page; } }, pipeline, records: { record: () => {} } });

    const markdown = await operation(page.requestedUrl, context, executionContextOf());

    assert.equal(markdown, 'Related [article](https://abptestpages.org/directory/child).');
    const result = await process.mock.calls[0].result;
    assert.ok(result);
    assert.equal(result.requestedUrl, page.requestedUrl);
    assert.equal(result.finalUrl, page.finalUrl);
    assert.equal(result.removed, 1);
    assert.deepEqual(invocations.map((invoke) => invoke.mock.callCount()), [1, 1, 1]);
    assert.deepEqual(order, [0, 1, 2]);
    assert.equal(process.mock.callCount(), 1);
    assert.deepEqual(page, original);
  });

  test('Given oversized HTML containing removable ads, when it is fetched, then the early size guard prevents every pipeline stage', async (t) => {
    const ads = new CleanHtmlAdsAdblockRs(elementHidingRules);
    const invoke = t.mock.method(ads, 'invoke');
    const page = {
      requestedUrl: 'https://source.example/start',
      finalUrl: 'https://abptestpages.org/article',
      html: `<p id="eh-id">${'x'.repeat(10 * 1024 * 1024)}</p>`,
    };
    const pipeline = new HtmlToMarkdownPipeline([ads, new PromptInjectionRemoverSanitizer(), new CleanHtmlToMarkdownDefuddle()]);
    const operation = composeFetchOperation({ fetcher: { async fetchURL() { return page; } }, pipeline, records: { record: () => {} } });

    await assert.rejects(operation(page.requestedUrl, context, executionContextOf()), { message: 'Page processing failed' });
    assert.equal(invoke.mock.callCount(), 0);
  });

  test('Given excessive HTML depth, when the ad stage rejects it, then no partial Markdown escapes the operation', async (t) => {
    const markdown = new CleanHtmlToMarkdownDefuddle();
    const invoke = t.mock.method(markdown, 'invoke');
    const pipeline = new HtmlToMarkdownPipeline([new CleanHtmlAdsAdblockRs(elementHidingRules), new PromptInjectionRemoverSanitizer(), markdown]);
    const page = {
      requestedUrl: 'https://source.example/start', finalUrl: 'https://source.example/final',
      html: '<div>'.repeat(5000) + 'Private source' + '</div>'.repeat(5000),
    };
    const operation = composeFetchOperation({ fetcher: { async fetchURL() { return page; } }, pipeline, records: { record: () => {} } });

    await assert.rejects(operation(page.requestedUrl, context, executionContextOf()), { message: 'Page processing failed' });
    assert.equal(invoke.mock.callCount(), 0);
  });
});

function hiddenAfterPasses(passes: number): string {
  let html = '<span hidden>Private payload</span>';
  for (let pass = 1; pass < passes; pass++) html = `<${html}span hidden>Private payload</span>`;
  return html;
}
