import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createRequestContext } from '../../../src/auth/access-context.ts';
import { CleanHtmlAdsAdblockRs } from '../../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { PromptInjectionRemoverSanitizer } from '../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { createGetURLAsMarkdown } from '../../../src/mcp/get-url-as-markdown.ts';
import { elementHidingRules } from '../../support/ad-rules.ts';

const context = createRequestContext({
  user: { authority: 'https://synthetic.example/', subject: 'synthetic-user' },
  tenantId: 'synthetic-workspace',
  grants: [{ role: 'reader', permissions: ['product:access'] }],
});

describe('getURLAsMarkdown with the real HTML pipeline', () => {
  const cases = [
    { label: 'empty source', html: '', warning: undefined },
    { label: 'hidden-only source', html: '<div hidden>Private payload</div>', warning: 'HTML sanitized: 1 hidden element(s) removed' },
    { label: 'ad-only source', html: '<p id="eh-id">Ad target</p>', warning: undefined },
    {
      label: 'a failed scan of an unsourced hidden body',
      html: '<p>Visible lead</p><body hidden>Private payload</body>',
      warning: 'HTML scan failed; remaining HTML withheld',
    },
    {
      label: 'eight HTML removal scans',
      html: hiddenAfterPasses(8),
      warning: 'HTML scan limit reached; remaining HTML withheld',
    },
  ];

  for (const { label, html, warning } of cases) {
    test(`Given ${label}, when the pipeline completes, then the operation preserves exact empty success`, async (t) => {
      const page = { requestedUrl: 'https://source.example/start', finalUrl: 'https://abptestpages.org/article', html };
      const pipeline = new HtmlToMarkdownPipeline([
        new CleanHtmlAdsAdblockRs(elementHidingRules),
        new PromptInjectionRemoverSanitizer(),
        new CleanHtmlToMarkdownDefuddle(),
      ]);
      const process = t.mock.method(pipeline, 'process');
      const operation = createGetURLAsMarkdown({ fetcher: { async fetchURL() { return page; } }, pipeline });

      assert.equal(await operation(page.requestedUrl, context, new AbortController().signal), '');

      const result = await process.mock.calls[0].result;
      assert.ok(result);
      assert.equal(result.markdown, '');
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
    const pipeline = new HtmlToMarkdownPipeline([
      new CleanHtmlAdsAdblockRs(elementHidingRules),
      new PromptInjectionRemoverSanitizer(),
      new CleanHtmlToMarkdownDefuddle(),
    ]);
    const process = t.mock.method(pipeline, 'process');
    const operation = createGetURLAsMarkdown({ fetcher: { async fetchURL() { return page; } }, pipeline });

    const markdown = await operation(page.requestedUrl, context, new AbortController().signal);

    assert.equal(markdown, 'Related [article](https://abptestpages.org/directory/child).');
    const result = await process.mock.calls[0].result;
    assert.ok(result);
    assert.equal(result.requestedUrl, page.requestedUrl);
    assert.equal(result.finalUrl, page.finalUrl);
    assert.equal(result.removed, 1);
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
    const operation = createGetURLAsMarkdown({ fetcher: { async fetchURL() { return page; } }, pipeline });

    await assert.rejects(operation(page.requestedUrl, context, new AbortController().signal), { message: 'Page processing failed' });
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
    const operation = createGetURLAsMarkdown({ fetcher: { async fetchURL() { return page; } }, pipeline });

    await assert.rejects(operation(page.requestedUrl, context, new AbortController().signal), { message: 'Page processing failed' });
    assert.equal(invoke.mock.callCount(), 0);
  });
});

function hiddenAfterPasses(passes: number): string {
  let html = '<span hidden>Private payload</span>';
  for (let pass = 1; pass < passes; pass++) html = `<${html}span hidden>Private payload</span>`;
  return html;
}
