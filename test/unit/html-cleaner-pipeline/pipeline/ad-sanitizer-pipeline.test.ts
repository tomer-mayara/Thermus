import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { PromptInjectionRemoverSanitizer } from '../../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { elementHidingRules } from '../../../support/fixtures/ad-rules.ts';

test('removes hidden content after an ad with an omitted paragraph end tag', async () => {
  const pipeline = new HtmlToMarkdownPipeline([
    new CleanHtmlAdsAdblockRs(elementHidingRules),
    new PromptInjectionRemoverSanitizer(),
    new CleanHtmlToMarkdownDefuddle(),
  ]);
  const html = '<html><body><p id="eh-id">AD<p style="display:none">HIDDEN_PAYLOAD</p><p>Visible text</p></body></html>';

  const result = await pipeline.process({ requestedUrl: 'https://abptestpages.org/', finalUrl: 'https://abptestpages.org/', html });

  assert.doesNotMatch(result.markdown ?? '', /HIDDEN_PAYLOAD/);
  assert.match(result.markdown ?? '', /Visible text/);
  assert.doesNotMatch(result.html, /HIDDEN_PAYLOAD/);
  assert.deepEqual(result.found, ['hidden-html']);
  assert.equal(result.removed, 2);
  assert.equal(result.skipped, 1);
});
