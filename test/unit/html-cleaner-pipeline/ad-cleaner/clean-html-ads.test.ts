import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../../../src/pipelines/html-processing/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { type CleanHtmlAds } from '../../../../src/pipelines/html-processing/ad-cleaner/clean-html-ads.ts';
import { type HtmlProcessingContext } from '../../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { elementHidingRules } from '../../../support/fixtures/ad-rules.ts';
import { readAdFixture } from '../fixtures/ad-pages.ts';

const elementHidingHtml = readAdFixture('element-hiding.html');
const elementHidingCleanedHtml = readAdFixture('element-hiding.cleaned.html');
const elementHidingExceptionHtml = readAdFixture('element-hiding-exception.html');
const elementHidingExceptionCleanedHtml = readAdFixture('element-hiding-exception.cleaned.html');

const elementHidingUrl = 'https://abptestpages.org/en/filters/element-hiding';
const elementHidingExceptionUrl = 'https://abptestpages.org/en/exceptions/element-hiding';

describe('CleanHtmlAdsAdblockRs', () => {
  let cleaner: CleanHtmlAds;

  beforeEach(() => {
    cleaner = new CleanHtmlAdsAdblockRs(elementHidingRules);
  });

  test('hides the documented targets', async () => {
    const result = await cleaner.invoke({
      requestedUrl: elementHidingUrl,
      finalUrl: elementHidingUrl,
      html: elementHidingHtml,
      removed: 0,
      skipped: 0,
    });

    assert.equal(result.html, elementHidingCleanedHtml);
    assert.equal(result.removed, 8);
  });

  test('honors the element-hiding exception', async () => {
    const result = await cleaner.invoke({
      requestedUrl: elementHidingExceptionUrl,
      finalUrl: elementHidingExceptionUrl,
      html: elementHidingExceptionHtml,
      removed: 0,
      skipped: 0,
    });

    assert.equal(result.html, elementHidingExceptionCleanedHtml);
    assert.equal(result.removed, 0);
  });

  test('does nothing without a matching host', async () => {
    const result = await cleaner.invoke({
      requestedUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      html: elementHidingHtml,
      removed: 0,
      skipped: 0,
    });

    assert.equal(result.html, elementHidingHtml);
    assert.equal(result.removed, 0);
  });

  test('counts unsupported procedural actions as skipped', async () => {
    const result = await cleaner.invoke({
      requestedUrl: elementHidingUrl,
      finalUrl: elementHidingUrl,
      html: elementHidingHtml,
      removed: 0,
      skipped: 0,
    });

    assert.equal(result.html, elementHidingCleanedHtml);
    assert.equal(result.skipped, 1);
  });

  test('preserves context metadata, accumulates counts, and does not mutate input', async () => {
    const input: HtmlProcessingContext = {
      requestedUrl: elementHidingUrl,
      finalUrl: elementHidingUrl,
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
    assert.equal(result.requestedUrl, input.requestedUrl);
    assert.equal(result.finalUrl, input.finalUrl);
    assert.equal(result.html, elementHidingCleanedHtml);
    assert.equal(result.markdown, input.markdown);
    assert.equal(result.title, input.title);
    assert.equal(result.removed, 11);
    assert.equal(result.skipped, 6);
  });
});
