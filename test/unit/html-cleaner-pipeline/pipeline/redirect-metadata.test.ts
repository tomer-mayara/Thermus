import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HtmlToMarkdownPipeline } from '../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { CleanHtmlAdsAdblockRs } from '../../../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { elementHidingRules } from '../../../support/fixtures/ad-rules.ts';

const html = '<html><head><title>Links</title></head><body><main><p>Links to related content: <a href="child">Child</a>, <a href="/root">Root</a>, <a href="//other.example/page">Other host</a>.</p></main></body></html>';

for (const finalUrl of [
  'https://source.example/directory/page',
  'https://destination.example:8443/directory/page',
]) {
  test(`resolves links with the final URL ${finalUrl}`, async () => {
    const page = { requestedUrl: 'https://source.example/redirect', finalUrl, html };
    const original = { ...page };
    const pipeline = new HtmlToMarkdownPipeline([new CleanHtmlToMarkdownDefuddle()]);

    const result = await pipeline.process(page);

    assert.ok(result.markdown?.includes(`[Child](${new URL('child', finalUrl).href})`));
    assert.ok(result.markdown?.includes(`[Root](${new URL('/root', finalUrl).href})`));
    assert.ok(result.markdown?.includes('[Other host](https://other.example/page)'));
    assert.equal(result.requestedUrl, page.requestedUrl);
    assert.equal(result.finalUrl, finalUrl);
    assert.deepEqual(page, original);
  });
}

test('uses the final host for domain rules after a cross-host redirect', async () => {
  const page = {
    requestedUrl: 'https://source.example/redirect',
    finalUrl: 'https://abptestpages.org/directory/page',
    html: '<html><body><main><p id="eh-id">Ad target</p><p>Visible content</p></main></body></html>',
  };
  const pipeline = new HtmlToMarkdownPipeline([new CleanHtmlAdsAdblockRs(elementHidingRules), new CleanHtmlToMarkdownDefuddle()]);

  const result = await pipeline.process(page);

  assert.doesNotMatch(result.html, /Ad target/);
  assert.doesNotMatch(result.markdown ?? '', /Ad target/);
  assert.match(result.markdown ?? '', /Visible content/);
  assert.equal(result.removed, 1);
  assert.equal(result.requestedUrl, page.requestedUrl);
  assert.equal(result.finalUrl, page.finalUrl);
});

test('does not use the requested host for domain rules', async () => {
  const page = {
    requestedUrl: 'https://abptestpages.org/redirect',
    finalUrl: 'https://destination.example/directory/page',
    html: '<html><body><p id="eh-id">Visible content</p></body></html>',
  };

  const result = await new HtmlToMarkdownPipeline([new CleanHtmlAdsAdblockRs(elementHidingRules)]).process(page);

  assert.equal(result.html, page.html);
  assert.equal(result.removed, 0);
});

test('preserves content behavior without a redirect', async () => {
  const url = 'https://example.com/directory/page';
  const page = { requestedUrl: url, finalUrl: url, html };

  const result = await new HtmlToMarkdownPipeline([new CleanHtmlToMarkdownDefuddle()]).process(page);

  assert.equal(result.title, 'Links');
  assert.equal(result.markdown, 'Links to related content: [Child](https://example.com/directory/child), [Root](https://example.com/root), [Other host](https://other.example/page).');
  assert.equal(result.html, html);
  assert.equal(result.requestedUrl, url);
  assert.equal(result.finalUrl, url);
});
