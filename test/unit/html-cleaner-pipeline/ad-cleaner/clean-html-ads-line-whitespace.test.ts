import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts';
import { elementHidingRules } from '../../../support/fixtures/ad-rules.ts';

const url = 'https://abptestpages.org/en/filters/element-hiding';

for (const fixture of [
  {
    name: 'removes a lone multiline ad and the LF after its end tag',
    html: '\t <div id="eh-id">\n<p>AD</p>\n</div> \t\n\n<p>😀𝄞</p>',
    expected: '\n<p>😀𝄞</p>',
    removed: 1,
  },
  {
    name: 'removes a lone ad with spaces and tabs at the end of the source',
    html: '<p>😀</p>\n \t<div id="eh-id">AD</div>\t ',
    expected: '<p>😀</p>\n',
    removed: 1,
  },
  {
    name: 'removes a source-start lone ad and keeps the empty final LF line',
    html: '<div id="eh-id">AD</div>\n\n',
    expected: '\n',
    removed: 1,
  },
  {
    name: 'keeps text beside the first and last lines of a multiline ad',
    html: '<body>😀 <div id="eh-id">\nAD\n</div> 𝄞\n</body>',
    expected: '<body>😀  𝄞\n</body>',
    removed: 1,
  },
  {
    name: 'keeps non-space whitespace beside an ad',
    html: '<body>\u00a0<div id="eh-id">AD</div>\t\n</body>',
    expected: '<body>\u00a0\t\n</body>',
    removed: 1,
  },
  {
    name: 'preserves CRLF and whitespace around ads on CRLF lines',
    html: '<body>\r\n \t<p id="eh-id">AD</p>\t \r\n\r\n<p>😀 &amp; 𝄞</p>\r\n</body>',
    expected: '<body>\r\n \t\t \r\n\r\n<p>😀 &amp; 𝄞</p>\r\n</body>',
    removed: 1,
  },
  {
    name: 'removes lone LF ad lines and keeps unrelated whitespace-only lines',
    html: '<body>\n \t\n \t<p id="eh-id">AD</p>\t \n\t\n<p>😀</p>\n</body>',
    expected: '<body>\n \t\n\t\n<p>😀</p>\n</body>',
    removed: 1,
  },
]) {
  test(fixture.name, async () => {
    const cleaner = new CleanHtmlAdsAdblockRs(elementHidingRules);
    const result = await cleaner.invoke({
      requestedUrl: url, finalUrl: url, html: fixture.html, removed: 3, skipped: 5,
    });
    assert.equal(result.html, fixture.expected);
    assert.equal(result.removed, 3 + fixture.removed);
    assert.equal(result.skipped, 6);
  });
}
