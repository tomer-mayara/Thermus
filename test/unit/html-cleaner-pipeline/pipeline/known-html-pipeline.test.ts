import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../../../src/pipelines/html-processing/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../../src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HiddenHtmlScanner } from '../../../../src/pipelines/html-processing/prompt-injection-remover/hidden-html-scanner.ts';
import { PromptInjectionRemoverSanitizer } from '../../../../src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { HtmlToMarkdownPipeline, type HtmlTransformation } from '../../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { elementHidingRules } from '../../../support/fixtures/ad-rules.ts';

describe('Known HTML pipeline output', () => {
  test('withholds HTML when the scanner fails before markdown conversion', async (t) => {
    t.mock.method(HiddenHtmlScanner, 'scan', () => {
      throw new RangeError('HTML parser failure');
    });
    let seenHtml: string | undefined;
    const markdowner: HtmlTransformation = {
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
    assert.equal(result.html, '');
    assert.equal(result.markdown, '');
    assert.equal(result.skipped, 0);
    assert.equal(result.found?.includes('hidden-html'), false);
    assert.deepEqual(result.warnings, ['HTML scan failed; remaining HTML withheld']);
  });

  test('withholds HTML with an unsourced hidden body before markdown conversion', async () => {
    let seenHtml: string | undefined;
    const markdowner: HtmlTransformation = {
      async invoke(ctx) {
        seenHtml = ctx.html;
        return { ...ctx, markdown: '' };
      },
    };
    const local = new HtmlToMarkdownPipeline([new PromptInjectionRemoverSanitizer(), markdowner]);
    const threatUrl = `https://attacker.example/?payload=${'a'.repeat(128)}`;
    const html = `<p><a href="${threatUrl}">Visible lead</a></p><body hidden>hidden payload</body>`;

    const result = await local.process({
      requestedUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      html,
    });

    assert.equal(seenHtml, '');
    assert.equal(result.html, '');
    assert.equal(result.markdown, '');
    assert.deepEqual(result.found, ['exfil-urls']);
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.warnings, [
      'Exfil-shaped URLs detected: link to attacker.example: suspicious query parameter',
      'HTML scan failed; remaining HTML withheld',
    ]);
  });

  test('keeps hidden payload out of the next step for deeply nested HTML', async () => {
    const nextStep: HtmlTransformation = { async invoke(ctx) { return { ...ctx, markdown: ctx.html }; } };
    const local = new HtmlToMarkdownPipeline([new PromptInjectionRemoverSanitizer(), nextStep]);
    const opening = '<div>\n'.repeat(6000);
    const closing = '</div>\n'.repeat(6000);

    const result = await local.process({
      requestedUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      html: `${opening}<span hidden>hidden payload</span>${closing}`,
    });

    // Runtime optimization can change the recursion depth at which a scan fails.
    assert.ok(result.html === '' || result.html === opening + closing);
    assert.equal(result.markdown, result.html);
    assert.doesNotMatch(result.markdown, /hidden payload/);
    assert.equal(result.warnings?.includes('HTML scan failed; remaining HTML withheld'), result.html === '');
    const found = result.found ?? [];
    assert.ok(found.every((category) => ['hidden-html', 'exfil-urls'].includes(category)));
    assert.equal(found.includes('hidden-html'),
      result.warnings?.includes('HTML sanitized: 1 hidden element(s) removed'));
    if (result.html) assert.ok(found.includes('hidden-html'));
    assert.equal(result.skipped, 0);
  });

  test('the real pipeline removes fenced hidden HTML from a complete document with few tags', async () => {
    const local = new HtmlToMarkdownPipeline([
      new CleanHtmlAdsAdblockRs(elementHidingRules),
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
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.warnings, [
      'HTML sanitized: 1 hidden element(s) removed',
    ]);
  });

});
