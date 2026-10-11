import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';

const url = 'https://example.com/article';

for (const fixture of [
  { name: 'short lines', separator: '\n', retained: '<p data-keep="😀">Story &amp; text</p>' },
  { name: 'minified source', separator: '', retained: '<p>keep</p>' },
]) {
  test(`given increasing ad matches in ${fixture.name}, removal preserves source with bounded slice calls`, async (t) => {
    const cleaner = new CleanHtmlAdsAdblockRs('example.com###eh-id');
    for (const matches of [32, 128, 512]) {
      const prefix = '<!doctype html><!-- construction-budget -->' + fixture.separator;
      const html = prefix + ('<div id="eh-id">ad</div>' + fixture.retained + fixture.separator).repeat(matches);
      const expected = prefix + (fixture.retained + fixture.separator).repeat(matches);
      const originalSlice = String.prototype.slice;
      let slicedUnits = 0;
      let sliceCalls = 0;
      String.prototype.slice = function (start?: number, end?: number): string {
        const result = originalSlice.call(this, start, end);
        if (String(this).startsWith(prefix)) {
          slicedUnits += result.length;
          sliceCalls += 1;
        }
        return result;
      };
      let result;
      try {
        result = await cleaner.invoke({ requestedUrl: url, finalUrl: url, html, removed: 3, skipped: 5 });
      } finally {
        String.prototype.slice = originalSlice;
      }
      assert.equal(result.html, expected);
      assert.equal(result.removed, matches + 3);
      assert.equal(result.skipped, 5);
      if (fixture.separator === '\n') {
        assert.ok(slicedUnits <= html.length * 2,
          `${matches} matches sliced ${slicedUnits} UTF-16 units from ${html.length} source units`);
      }
      assert.ok(sliceCalls <= matches * 3 + 1);
      t.diagnostic(`${matches} matches: ${sliceCalls} slices, ${slicedUnits} sliced units, ${html.length} source units`);
    }
  });
}
