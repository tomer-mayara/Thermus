import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/clean-html-ads-adblock-rs.ts';

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
  let cleaner: CleanHtmlAdsAdblockRs;

  beforeEach(() => {
    cleaner = new CleanHtmlAdsAdblockRs();
  });

  test('hides the documented targets', () => {
    const result = cleaner.invoke(elementHidingUrl, elementHidingHtml);

    assert.equal(result.html, elementHidingCleanedHtml);
    assert.equal(result.removed, 8);
  });

  test('honors the element-hiding exception', () => {
    const result = cleaner.invoke(elementHidingExceptionUrl, elementHidingExceptionHtml);

    assert.equal(result.html, elementHidingExceptionCleanedHtml);
    assert.equal(result.removed, 0);
  });

  test('does nothing without a matching host', () => {
    const result = cleaner.invoke('https://example.com/', elementHidingHtml);

    assert.equal(result.html, elementHidingHtml);
    assert.equal(result.removed, 0);
  });

  test('does not throw on a selector we cannot evaluate', () => {
    const result = cleaner.invoke(elementHidingUrl, elementHidingHtml);

    assert.equal(result.html, elementHidingCleanedHtml);
    assert.ok(result.skipped >= 1);
  });
});
