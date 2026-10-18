import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { HtmlDepthLimitError } from '../../../../src/html-cleaner-pipeline/ad-cleaner/html-depth-limit-error.ts';
import {
  HtmlToMarkdownPipeline,
  type HtmlProcessingContext,
} from '../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { elementHidingRules } from '../../../support/fixtures/ad-rules.ts';

describe('HTML to Markdown pipeline depth limit', () => {
  for (const { label, html } of [
    { label: 'nested elements', html: '<div>'.repeat(5000) + 'text' + '</div>'.repeat(5000) },
    { label: 'unclosed templates', html: '<template>'.repeat(5000) + 'text' },
  ]) {
    test(`an ad cleaner depth failure for ${label} stops all later steps`, async (t) => {
      const later = t.mock.fn(async (ctx: HtmlProcessingContext) => ({ ...ctx, markdown: 'cleaned' }));
      const local = new HtmlToMarkdownPipeline([
        new CleanHtmlAdsAdblockRs(elementHidingRules), { invoke: later }, { invoke: later },
      ]);

      await assert.rejects(local.process({
        requestedUrl: 'https://example.com/',
        finalUrl: 'https://example.com/',
        html,
      }), (error: unknown) => error instanceof HtmlDepthLimitError);
      assert.equal(later.mock.callCount(), 0);
    });
  }
});
