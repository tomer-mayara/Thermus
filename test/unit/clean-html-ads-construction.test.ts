import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';

const url = 'https://example.com/article';

for (const fixture of [
  { name: 'short lines', separator: '\n', retained: '<p data-keep="😀">Story &amp; text</p>' },
  { name: 'minified source', separator: '', retained: '<p>keep</p>' },
  { name: 'long minified gaps', separator: '', retained: ' '.repeat(2048) + '<p>😀𝄞</p>' },
]) {
  test(`given increasing ad matches in ${fixture.name}, removal preserves source with bounded source work`, async (t) => {
    const cleaner = new CleanHtmlAdsAdblockRs('example.com###eh-id');
    for (const matches of [32, 128, 512]) {
      const prefix = '<!doctype html><!-- construction-budget -->' + fixture.separator;
      const html = prefix + ('<div id="eh-id">ad</div>' + fixture.retained + fixture.separator).repeat(matches);
      const expected = prefix + (fixture.retained + fixture.separator).repeat(matches);
      const originalSlice = String.prototype.slice;
      const originalIndexOf = String.prototype.indexOf;
      const originalLastIndexOf = String.prototype.lastIndexOf;
      const originalCharCodeAt = String.prototype.charCodeAt;
      const originalTest = RegExp.prototype.test;
      let scannedUnits = 0;
      String.prototype.indexOf = function (search: string, position?: number): number {
        const result = originalIndexOf.call(this, search, position);
        if (String(this) === html && search === '\n') {
          scannedUnits += (result === -1 ? html.length : result + 1) - (position ?? 0);
        }
        return result;
      };
      String.prototype.lastIndexOf = function (search: string, position?: number): number {
        const result = originalLastIndexOf.call(this, search, position);
        if (String(this) === html && search === '\n') {
          scannedUnits += (position ?? html.length) - result;
        }
        return result;
      };
      String.prototype.charCodeAt = function (index: number): number {
        if (String(this) === html) scannedUnits += 1;
        return originalCharCodeAt.call(this, index);
      };
      RegExp.prototype.test = function (input: string): boolean {
        if (this.source === /^[ \t]*$/.source) {
          for (let index = 0; index < input.length; index++) {
            scannedUnits += 1;
            const code = originalCharCodeAt.call(input, index);
            if (code !== 32 && code !== 9) break;
          }
        }
        return originalTest.call(this, input);
      };
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
        String.prototype.indexOf = originalIndexOf;
        String.prototype.lastIndexOf = originalLastIndexOf;
        String.prototype.charCodeAt = originalCharCodeAt;
        RegExp.prototype.test = originalTest;
      }
      assert.equal(result.html, expected);
      assert.equal(result.removed, matches + 3);
      assert.equal(result.skipped, 5);
      assert.ok(slicedUnits <= html.length * 2,
        `${matches} matches sliced ${slicedUnits} UTF-16 units from ${html.length} source units`);
      assert.ok(scannedUnits <= html.length * 3,
        `${matches} matches inspected ${scannedUnits} source units from ${html.length} source units`);
      assert.ok(sliceCalls <= matches * 3 + 1);
      t.diagnostic(`${matches} matches: ${sliceCalls} slices, ${slicedUnits} sliced units, ${scannedUnits} inspected units, ${html.length} source units`);
    }
  });
}
