import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { type CleanHtmlAds } from '../../src/html-cleaner-pipeline/ad-cleaner/clean-html-ads.ts';
import { elementHidingRules } from '../support/ad-rules.ts';

const elementHidingUrl = 'https://abptestpages.org/en/filters/element-hiding';

describe('CleanHtmlAdsAdblockRs source ranges', () => {
  let cleaner: CleanHtmlAds;

  beforeEach(() => {
    cleaner = new CleanHtmlAdsAdblockRs(elementHidingRules);
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
      name: 'preserves the next list item after an ad item with an open paragraph',
      html: '<ul><li id="eh-id"><p>AD<li data-value="keep">Visible text</ul>',
      expected: '<ul><li data-value="keep">Visible text</ul>',
      removed: 1,
    },
    {
      name: 'preserves the next dialog after an ad paragraph with no end tag',
      html: '<div><p id="eh-id">AD<dialog open data-value="keep">Visible text</dialog></div>',
      expected: '<div><dialog open data-value="keep">Visible text</dialog></div>',
      removed: 1,
    },
    {
      name: 'preserves search after an ad paragraph with no end tag',
      html: '<div><p id="eh-id">AD<search data-value="keep">Visible text</search></div>',
      expected: '<div><search data-value="keep">Visible text</search></div>',
      removed: 1,
    },
    {
      name: 'preserves menu after an ad paragraph with no end tag',
      html: '<div><p id="eh-id">AD<menu data-value="keep"><li>Visible text</li></menu></div>',
      expected: '<div><menu data-value="keep"><li>Visible text</li></menu></div>',
      removed: 1,
    },
    {
      name: 'preserves hgroup after an ad paragraph with no end tag',
      html: '<div><p id="eh-id">AD<hgroup data-value="keep"><h2>Visible text</h2></hgroup></div>',
      expected: '<div><hgroup data-value="keep"><h2>Visible text</h2></hgroup></div>',
      removed: 1,
    },
    {
      name: 'preserves Unicode and comments around an ad list item with an omitted end tag',
      html: "<UL data-X='pré'><LI data-value=\"前\">前<!-- lead --><LI ID='eh-id'>AD<!-- remove --><LI data-value='後'>後</UL>",
      expected: "<UL data-X='pré'><LI data-value=\"前\">前<!-- lead --><LI data-value='後'>後</UL>",
      removed: 1,
    },
    {
      name: 'counts nested ad list and paragraph matches and preserves the next item',
      html: '<ul><li id="eh-id"><p class="eh-class">AD<li data-value="keep">Visible text</ul>',
      expected: '<ul><li data-value="keep">Visible text</ul>',
      removed: 2,
    },
    {
      name: 'retains a nested list when its ad item has a non-ad sibling',
      html: '<ul><li data-value="parent">Parent<ul><li id="eh-id">AD</li><li data-value="keep">Visible text</li></ul></li></ul>',
      expected: '<ul><li data-value="parent">Parent<ul><li data-value="keep">Visible text</li></ul></li></ul>',
      removed: 1,
    },
    {
      name: 'removes an ad item and its nested list but preserves the next item',
      html: '<ul><li id="eh-id">AD<ul><li>Nested content</li></ul><li data-value="keep">Visible text</ul>',
      expected: '<ul><li data-value="keep">Visible text</ul>',
      removed: 1,
    },
    {
      name: 'preserves a paragraph before an ad list item and the next item',
      html: '<p data-value="before">Before</p><ul><li id="eh-id">AD<li data-value="keep">Visible text</ul>',
      expected: '<p data-value="before">Before</p><ul><li data-value="keep">Visible text</ul>',
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
    {
      name: 'merges nested adjacent and duplicate matches between supplementary Unicode',
      html: '<body>😀<div id="eh-id" class="eh-class"><p class="eh-class">AD</p></div><p class="eh-class">AD</p>𝄞<!-- keep --></body>',
      expected: '<body>😀𝄞<!-- keep --></body>',
      removed: 3,
    },
    {
      name: 'removes adjacent ranges at both source boundaries',
      html: '<p id="eh-id">AD</p><p class="eh-class">AD</p>',
      expected: '',
      removed: 2,
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
