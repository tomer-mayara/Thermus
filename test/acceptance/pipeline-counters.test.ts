import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';

test('given hidden siblings and unsupported ad work, the pipeline reports separate counts', async () => {
  const sanitizer = new PromptInjectionRemoverSanitizer();
  const converter = new CleanHtmlToMarkdownDefuddle();
  const pipeline = new HtmlToMarkdownPipeline([
    new CleanHtmlAdsAdblockRs('example.com##.ad\nexample.com##div:has-text(Unsupported)'),
    sanitizer, converter, sanitizer, converter,
  ]);
  const page = Object.freeze({
    requestedUrl: 'https://example.com/start',
    finalUrl: 'https://example.com/final',
    html: '<main><div class="ad">Ad</div><span hidden>Hidden one</span>'
      + '<span hidden><span hidden>Hidden child</span><!-- Covered comment --></span>'
      + '<!-- Independent comment --><p>Visible te&#8203;xt.</p></main>',
  });

  const result = await pipeline.process(page);

  assert.equal(result.removed, 4);
  assert.equal(result.skipped, 1);
  assert.deepEqual(result.found, ['html-comments', 'hidden-html', 'cf-format']);
  assert.equal(new Set(result.found).size, 3);
  assert.equal(new Set(result.warnings).size, result.warnings?.length);
  assert.equal(result.requestedUrl, page.requestedUrl);
  assert.equal(result.finalUrl, page.finalUrl);
  assert.equal(result.markdown, 'Visible text.');
  assert.doesNotMatch(result.html, /Hidden|Independent comment|class="ad"/);
  assert.match(page.html, /Hidden child|&#8203;/);
});
