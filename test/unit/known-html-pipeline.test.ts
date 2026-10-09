import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HiddenHtmlScanner } from '../../src/html-cleaner-pipeline/prompt-injection-remover/hidden-html-scanner.ts';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { HtmlToMarkdownPipeline, type Step } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';

describe('Known HTML pipeline output', () => {
  test('withholds HTML when the scanner fails before markdown conversion', async (t) => {
    t.mock.method(HiddenHtmlScanner, 'scan', () => {
      throw new RangeError('HTML parser failure');
    });
    let seenHtml: string | undefined;
    const markdowner: Step = {
      async invoke(ctx) {
        seenHtml = ctx.html;
        return { ...ctx, markdown: '' };
      },
    };
    const local = new HtmlToMarkdownPipeline([new PromptInjectionRemoverSanitizer(), markdowner]);
    const html = '<p>Visible content</p>';

    const result = await local.process({
      requestedUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      html,
    });

    assert.equal(seenHtml, '');
    assert.equal(result.skipped, 0);
    assert.equal(result.found?.includes('hidden-html'), false);
    assert.deepEqual(result.warnings, ['HTML scan failed; remaining HTML withheld']);
  });

  test('the real pipeline removes fenced hidden HTML from a complete document with few tags', async () => {
    const local = new HtmlToMarkdownPipeline([
      new CleanHtmlAdsAdblockRs(),
      new PromptInjectionRemoverSanitizer(),
      new CleanHtmlToMarkdownDefuddle(),
    ]);
    const plainLines = Array.from({ length: 20 }, (_, index) => `Visible article line ${index}.`).join('\n');
    const html = [
      '<!doctype html>',
      '<html>',
      '<head><title>Visible article</title></head>',
      '<body>',
      plainLines,
      '',
      '```',
      '<span style="position:absolute;left:-9999px">hidden payload marker</span>',
      '```',
      '<p>Visible final paragraph.</p>',
      '</body>',
      '</html>',
    ].join('\n');

    const result = await local.process({
      requestedUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      html,
    });

    assert.ok(result.markdown);
    assert.match(result.markdown, /Visible article line 0/);
    assert.match(result.markdown, /Visible final paragraph/);
    assert.doesNotMatch(result.markdown, /hidden payload marker|hidden HTML removed|HTML unparseable/);
    assert.doesNotMatch(result.html, /hidden payload marker|left:-9999px/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 1);
    assert.deepEqual(result.warnings, [
      'HTML sanitized: 1 hidden element(s) removed',
    ]);
  });

});
