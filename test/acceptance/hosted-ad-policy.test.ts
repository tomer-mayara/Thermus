import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { HtmlToMarkdownPipeline } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { repositoryRoot } from '../support/processes/module-paths.ts';

test('given the hosted EasyList snapshot and an article with an ad banner, when cleaned, then the banner is removed and the article stays', async () => {
  const rules = readFileSync(new URL('docker/hosted-ad-rules.txt', repositoryRoot), 'utf8');
  const pipeline = new HtmlToMarkdownPipeline([new CleanHtmlAdsAdblockRs(rules)]);
  const retained = '<article class="article-body"><h1>Heat and life</h1>'
    + '<p>Microbes live near hot springs.</p>'
    + '<p class="ad-banner-container-story">Article text with a similar class name.</p></article>';

  const result = await pipeline.process({
    requestedUrl: 'https://example.org/article',
    finalUrl: 'https://example.org/article',
    html: '<main><aside class="ad-banner-container">Advertisement</aside>' + retained + '</main>',
  });

  assert.equal(result.html, '<main>' + retained + '</main>');
  assert.equal(result.removed, 1);
  assert.equal(result.skipped, 0);
});
