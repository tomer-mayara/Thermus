import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../../../src/pipelines/html-processing/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { type CleanHtmlAds } from '../../../../src/pipelines/html-processing/ad-cleaner/clean-html-ads.ts';
import { elementHidingRules } from '../../../support/fixtures/ad-rules.ts';

const elementHidingUrl = 'https://abptestpages.org/';

describe('CleanHtmlAdsAdblockRs adjacent HTML recovery', () => {
  let cleaner: CleanHtmlAds;

  beforeEach(() => {
    cleaner = new CleanHtmlAdsAdblockRs(elementHidingRules);
  });

  const sourceCases = [
    {
      name: 'preserves a table and following paragraph after an ad paragraph with an omitted end tag',
      html: '<p id="eh-id">AD<table data-keep="yes"><tr><td>Visible text</td></tr></table><p>Control</p>',
      expected: '<table data-keep="yes"><tr><td>Visible text</td></tr></table><p>Control</p>',
      removed: 1,
    },
    {
      name: 'preserves a doctype, table, and following paragraph after an ad paragraph with an omitted end tag',
      html: '<!doctype html><p id="eh-id">AD<table data-keep="yes"><tr><td>Visible text</td></tr></table><p>Control</p>',
      expected: '<!doctype html><table data-keep="yes"><tr><td>Visible text</td></tr></table><p>Control</p>',
      removed: 1,
    },
    {
      name: 'preserves a table and following ad paragraph after formatting reconstruction',
      html: '<p><b id="eh-id">AD</p><table><tr><td>Visible</td></tr></table><p>AD2</p>',
      expected: '<p></p><table><tr><td>Visible</td></tr></table><p></p>',
      removed: 2,
    },
    {
      name: 'counts nested reconstructed formatting matches and duplicate selectors while preserving the table',
      html: '<p><b id="eh-id" class="eh-class"><i class="eh-class">AD</p><table><tr><td>Visible</td></tr></table><p>AD2</p>',
      expected: '<p></p><table><tr><td>Visible</td></tr></table><p></p>',
      removed: 4,
    },
    {
      name: 'preserves tables and paragraph tags across repeated formatting reconstruction',
      html: '<p><b id="eh-id">AD</p><table><tr><td>First</td></tr></table><p>AD2</p><table><tr><td>Second</td></tr></table><p>AD3</b>Control</p>',
      expected: '<p></p><table><tr><td>First</td></tr></table><p></p><table><tr><td>Second</td></tr></table><p>Control</p>',
      removed: 3,
    },
    {
      name: 'preserves the head when an ad body reaches end of source after a doctype',
      html: '<!doctype html><head><title>Page</title></head><body class="eh-class">AD_PAYLOAD',
      expected: '<!doctype html><head><title>Page</title></head>',
      removed: 1,
    },
    {
      name: 'preserves the head and trailing comment when an ad body has an explicit close',
      html: '<!doctype html><head><title>Page</title></head><body class="eh-class">AD_PAYLOAD</body></html><!-- trailing -->',
      expected: '<!doctype html><head><title>Page</title></head></html><!-- trailing -->',
      removed: 1,
    },
    {
      name: 'preserves the head when an ad body reaches end of source without a doctype',
      html: '<head><title>Page</title></head><body class="eh-class">AD_PAYLOAD',
      expected: '<head><title>Page</title></head>',
      removed: 1,
    },
  ];

  for (const sourceCase of sourceCases) {
    test(sourceCase.name, async () => {
      const result = await cleaner.invoke({
        requestedUrl: elementHidingUrl,
        finalUrl: elementHidingUrl,
        html: sourceCase.html,
        removed: 3,
        skipped: 5,
      });

      assert.equal(result.html, sourceCase.expected);
      assert.equal(result.removed, 3 + sourceCase.removed);
      assert.equal(result.skipped, 6);
    });
  }
});
