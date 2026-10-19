import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';

test('Given an ordinary page with many class rules and paragraphs, when the production pipeline converts it, then it returns all visible text and removes hidden text', async () => {
  const pipeline = new HtmlToMarkdownPipeline([
    new CleanHtmlAdsAdblockRs(''),
    new PromptInjectionRemoverSanitizer(),
    new CleanHtmlToMarkdownDefuddle(),
  ]);
  const paragraphs = Array.from({ length: 1_000 }, () => 'Visible story.');
  const rules = Array.from({ length: 39 }, (_, index) => `.rule${index}{display:block}`).join('');
  const html = `<style>${rules}.payload{display:none}</style><main>`
    + paragraphs.map((text) => `<p class="ordinary-long-class-name">${text}</p>`).join('')
    + '<p class="payload">Hidden instruction.</p></main>';

  const result = await pipeline.process({
    requestedUrl: 'https://example.com/search?q=story',
    finalUrl: 'https://example.com/search?q=story',
    html,
  });

  assert.equal(result.markdown, paragraphs.join('\n\n'));
  assert.doesNotMatch(result.html, /Hidden instruction/);
  assert.deepEqual(result.found, ['hidden-html']);
  assert.equal(result.scanWithholding, undefined);
});

test('Given a page that reveals its body with a delayed opacity animation, when the production pipeline converts it without an animation clock, then it keeps the visible story and links while removing hidden content', async () => {
  const pipeline = new HtmlToMarkdownPipeline([
    new CleanHtmlAdsAdblockRs(''),
    new PromptInjectionRemoverSanitizer(),
    new CleanHtmlToMarkdownDefuddle(),
  ]);
  const html = '<!doctype html><html><head><style>'
    + '@keyframes reveal{0%{opacity:0}to{opacity:1}}'
    + 'body{opacity:0;animation-name:reveal;animation-duration:0s;'
    + 'animation-delay:3s;animation-fill-mode:forwards}.payload{display:none}'
    + '</style></head><body><main><h2>Paris results</h2>'
    + '<p>Read <a href="/paris">Paris</a>.</p>'
    + '<!-- Remove this comment. --><p class="payload">Hidden instruction.</p></main></body></html>';

  const result = await pipeline.process({
    requestedUrl: 'https://example.com/search?q=paris',
    finalUrl: 'https://example.com/search?q=paris',
    html,
  });

  assert.equal(result.markdown, '## Paris results\n\nRead [Paris](https://example.com/paris).');
  assert.doesNotMatch(result.html, /Hidden instruction/);
  assert.deepEqual(result.found, ['html-comments', 'hidden-html']);
  assert.equal(result.scanWithholding, undefined);
});
