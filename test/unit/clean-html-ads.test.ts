import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { type CleanHtmlAds } from '../../src/html-cleaner-pipeline/ad-cleaner/clean-html-ads.ts';
import { type Ctx } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';

const fixturesDirectory = join(process.cwd(), 'test/unit/fixtures');

function readFixture(name: string): string {
  return readFileSync(join(fixturesDirectory, name), 'utf8');
}

const elementHidingHtml = readFixture('element-hiding.html');
const elementHidingCleanedHtml = readFixture('element-hiding.cleaned.html');
const elementHidingExceptionHtml = readFixture('element-hiding-exception.html');
const elementHidingExceptionCleanedHtml = readFixture('element-hiding-exception.cleaned.html');

const elementHidingUrl = 'https://abptestpages.org/en/filters/element-hiding';
const elementHidingExceptionUrl = 'https://abptestpages.org/en/exceptions/element-hiding';

describe('CleanHtmlAdsAdblockRs', () => {
  let cleaner: CleanHtmlAds;

  beforeEach(() => {
    cleaner = new CleanHtmlAdsAdblockRs();
  });

  test('hides the documented targets', async () => {
    const result = await cleaner.invoke({
      url: elementHidingUrl,
      html: elementHidingHtml,
      removed: 0,
      skipped: 0,
    });

    assert.equal(result.html, elementHidingCleanedHtml);
    assert.equal(result.removed, 8);
  });

  test('honors the element-hiding exception', async () => {
    const result = await cleaner.invoke({
      url: elementHidingExceptionUrl,
      html: elementHidingExceptionHtml,
      removed: 0,
      skipped: 0,
    });

    assert.equal(result.html, elementHidingExceptionCleanedHtml);
    assert.equal(result.removed, 0);
  });

  test('does nothing without a matching host', async () => {
    const result = await cleaner.invoke({
      url: 'https://example.com/',
      html: elementHidingHtml,
      removed: 0,
      skipped: 0,
    });

    assert.equal(result.html, elementHidingHtml);
    assert.equal(result.removed, 0);
  });

  test('counts unsupported procedural actions as skipped', async () => {
    const result = await cleaner.invoke({
      url: elementHidingUrl,
      html: elementHidingHtml,
      removed: 0,
      skipped: 0,
    });

    assert.equal(result.html, elementHidingCleanedHtml);
    assert.equal(result.skipped, 1);
  });

  const sourceCases = [
    {
      name: 'preserves the next paragraph when the ad paragraph has no end tag',
      html: '<html><body><p id="eh-id">AD<p style="display:none">HIDDEN_PAYLOAD</p><p>Visible text</p></body></html>',
      expected: '<html><body><p style="display:none">HIDDEN_PAYLOAD</p><p>Visible text</p></body></html>',
      removed: 1,
    },
    {
      name: 'preserves the next list item and its attributes when the ad item has no end tag',
      html: '<ul><li id="eh-id">AD<li data-value="keep" class="content">Visible text</li></ul>',
      expected: '<ul><li data-value="keep" class="content">Visible text</li></ul>',
      removed: 1,
    },
    {
      name: 'preserves the parent end tag when it closes an ad list item',
      html: '<ul><li data-value="keep">Visible text<li id="eh-id">AD</ul><p>Control</p>',
      expected: '<ul><li data-value="keep">Visible text</ul><p>Control</p>',
      removed: 1,
    },
    {
      name: 'removes an ad paragraph that ends at the end of the source',
      html: '<p data-value="keep">Visible text</p><p id="eh-id">AD',
      expected: '<p data-value="keep">Visible text</p>',
      removed: 1,
    },
    {
      name: 'preserves source text around an explicitly closed ad',
      html: '<!doctype html>\n<body><P data-value=keep>Visible &amp; text</P> <p id="eh-id">AD</p>\t<p class=content>Control</p></body>',
      expected: '<!doctype html>\n<body><P data-value=keep>Visible &amp; text</P> \t<p class=content>Control</p></body>',
      removed: 1,
    },
    {
      name: 'removes the nested content of an ad paragraph with no end tag',
      html: '<body><p id="eh-id">AD<strong>nested</strong><p data-value="keep">Visible text</p></body>',
      expected: '<body><p data-value="keep">Visible text</p></body>',
      removed: 1,
    },
    {
      name: 'counts adjacent ads with omitted end tags once each',
      html: '<ul><li id="eh-id">AD<li class="eh-class">AD<li data-value="keep">Visible text</ul>',
      expected: '<ul><li data-value="keep">Visible text</ul>',
      removed: 2,
    },
    {
      name: 'counts nested ad matches once each and removes their shared source once',
      html: '<div class="eh-class"><p id="eh-id">AD<p data-value="inside">Inside</p></div><p data-value="keep">Visible text</p>',
      expected: '<p data-value="keep">Visible text</p>',
      removed: 2,
    },
    {
      name: 'counts an ad matched by two selectors once',
      html: '<p id="eh-id" class="eh-class">AD<p data-value="keep">Visible text</p>',
      expected: '<p data-value="keep">Visible text</p>',
      removed: 1,
    },
    {
      name: 'removes a void ad element and preserves the next opening tag',
      html: '<body><img id="eh-id" src="ad.png"><p data-value="keep">Visible text</p></body>',
      expected: '<body><p data-value="keep">Visible text</p></body>',
      removed: 1,
    },
    {
      name: 'removes a self-closing ad element and preserves the next opening tag',
      html: '<svg><rect id="eh-id" width="100"/><text data-value="keep">Visible text</text></svg>',
      expected: '<svg><text data-value="keep">Visible text</text></svg>',
      removed: 1,
    },
  ];

  for (const sourceCase of sourceCases) {
    test(sourceCase.name, async () => {
      const result = await cleaner.invoke({
        url: elementHidingUrl,
        html: sourceCase.html,
        removed: 3,
        skipped: 5,
      });

      assert.equal(result.html, sourceCase.expected);
      assert.equal(result.removed, 3 + sourceCase.removed);
      assert.equal(result.skipped, 6);
    });
  }

  test('preserves context metadata, accumulates counts, and does not mutate input', async () => {
    const input: Ctx = {
      url: elementHidingUrl,
      html: elementHidingHtml,
      markdown: 'existing markdown',
      title: 'Existing title',
      removed: 3,
      skipped: 5,
    };
    const original = { ...input };

    const result = await cleaner.invoke(input);

    assert.deepEqual(input, original);
    assert.notEqual(result, input);
    assert.equal(result.url, input.url);
    assert.equal(result.html, elementHidingCleanedHtml);
    assert.equal(result.markdown, input.markdown);
    assert.equal(result.title, input.title);
    assert.equal(result.removed, 11);
    assert.equal(result.skipped, 6);
  });
});
