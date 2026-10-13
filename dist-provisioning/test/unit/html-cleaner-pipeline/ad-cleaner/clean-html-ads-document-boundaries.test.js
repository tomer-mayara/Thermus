import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import { CleanHtmlAdsAdblockRs } from '../../../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.js';
import {} from '../../../../src/html-cleaner-pipeline/ad-cleaner/clean-html-ads.js';
import { elementHidingRules } from '../../../support/ad-rules.js';
import { createContext } from '../../../support/html-cleaner-context.js';
const elementHidingUrl = 'https://abptestpages.org/en/filters/element-hiding';
describe('CleanHtmlAdsAdblockRs leading text acceptance', () => {
    for (const { name, html, expected, removed } of [
        {
            name: 'leading text with an implied head',
            html: 'plain<div id="eh-id">ad</div>',
            expected: 'plain',
            removed: 1,
        },
        {
            name: 'a doctype and leading text with an implied head',
            html: '<!doctype html>plain<div id="eh-id">ad</div>',
            expected: '<!doctype html>plain',
            removed: 1,
        },
        {
            name: 'leading non-breaking space with an implied head',
            html: '\u00a0plain<div id="eh-id">ad</div>',
            expected: '\u00a0plain',
            removed: 1,
        },
        {
            name: 'a doctype and leading non-breaking space with an implied head',
            html: '<!doctype html>\u00a0plain<div id="eh-id">ad</div>',
            expected: '<!doctype html>\u00a0plain',
            removed: 1,
        },
        {
            name: 'leading text with no matching element',
            html: 'plain<div id="keep">ad</div>',
            expected: 'plain<div id="keep">ad</div>',
            removed: 0,
        },
        {
            name: 'leading text in an explicit body',
            html: '<body>plain<div id="eh-id">ad</div></body>',
            expected: '<body>plain</body>',
            removed: 1,
        },
    ]) {
        test(`Given ${name}, when an ad rule runs, then it preserves the retained source`, async () => {
            const cleaner = new CleanHtmlAdsAdblockRs('example.com###eh-id');
            const result = await cleaner.invoke({
                requestedUrl: 'https://example.com/',
                finalUrl: 'https://example.com/',
                html,
                removed: 0,
                skipped: 0,
            });
            assert.equal(result.html, expected);
            assert.equal(result.removed, removed);
            assert.equal(result.skipped, 0);
        });
    }
    for (const prefix of ['plain', '<!doctype html>plain', '\u00a0plain', '<!doctype html>\u00a0plain']) {
        test(`Given ${JSON.stringify(prefix)} and no ad match, when a rule runs, then source and counts stay unchanged`, async () => {
            const cleaner = new CleanHtmlAdsAdblockRs('example.com###eh-id');
            const input = createContext(`${prefix}<div id="keep">ad</div>`, {
                requestedUrl: 'https://example.com/',
                finalUrl: 'https://example.com/',
                removed: 3,
                skipped: 5,
            });
            const result = await cleaner.invoke(input);
            assert.equal(result.html, input.html);
            assert.equal(result.removed, 3);
            assert.equal(result.skipped, 5);
        });
    }
});
describe('CleanHtmlAdsAdblockRs document boundaries', () => {
    let cleaner;
    beforeEach(() => {
        cleaner = new CleanHtmlAdsAdblockRs(elementHidingRules);
    });
    const sourceCases = [
        {
            name: 'preserves explicit html and body end tags and a trailing comment after an ad paragraph',
            html: '<html><body><p id="eh-id">AD</body></html><!-- trailing -->',
            expected: '<html><body></body></html><!-- trailing -->',
            removed: 1,
        },
        {
            name: 'preserves the body end tag after an ad paragraph in a body-only source',
            html: '<body><p id="eh-id">AD</body>',
            expected: '<body></body>',
            removed: 1,
        },
        {
            name: 'preserves an explicit html end tag and following comment when the body end tag is omitted',
            html: '<html><body><p id="eh-id">AD</html><!-- trailing -->',
            expected: '<html><body></html><!-- trailing -->',
            removed: 1,
        },
        {
            name: 'preserves explicit body and html end tags when both opening tags are omitted',
            html: '<p id="eh-id">AD</body></html><!--after-->',
            expected: '</body></html><!--after-->',
            removed: 1,
        },
        {
            name: 'preserves body and html end tags when only the body opening tag is omitted',
            html: '<html><p id="eh-id">AD</body></html>',
            expected: '<html></body></html>',
            removed: 1,
        },
        {
            name: 'preserves the html end tag when an ad paragraph follows the body end tag',
            html: '<body></body><p id="eh-id">AD</p></html>',
            expected: '<body></body></html>',
            removed: 1,
        },
        {
            name: 'preserves the html end tag when an unclosed ad paragraph follows the body end tag',
            html: '<body></body><p id="eh-id">AD</html>',
            expected: '<body></body></html>',
            removed: 1,
        },
        {
            name: 'preserves a repeated body end tag and trailing comment after an ad div',
            html: '<body><div id="eh-id">AD</body>Visible</body><!-- keep -->',
            expected: '<body></body>Visible</body><!-- keep -->',
            removed: 1,
        },
        {
            name: 'preserves text after the first explicit close of an ad body element',
            html: '<body id="eh-id">AD</body>Visible</body><!-- keep -->',
            expected: 'Visible</body><!-- keep -->',
            removed: 1,
        },
        {
            name: 'preserves text after the first explicit close of an ad html element',
            html: '<html id="eh-id"><body>AD</body></html>Visible</html><!-- keep -->',
            expected: 'Visible</html><!-- keep -->',
            removed: 1,
        },
        {
            name: 'removes an ad html element and its body content',
            html: '<html id="eh-id"><body>AD</body></html><!-- keep -->',
            expected: '<!-- keep -->',
            removed: 1,
        },
        {
            name: 'removes an ad body element and its content',
            html: '<body id="eh-id">AD</body><!-- keep -->',
            expected: '<!-- keep -->',
            removed: 1,
        },
        {
            name: 'preserves a body end tag after an ad paragraph when an earlier close precedes it',
            html: '<body></body><p id="eh-id">AD</body><!-- keep -->',
            expected: '<body></body></body><!-- keep -->',
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
        });
    }
});
test('removes a matching body after nested template EOF recovery', async () => {
    const cleaner = new CleanHtmlAdsAdblockRs('example.com###ad');
    const result = await cleaner.invoke(createContext('<body id="ad"><svg><template><title><template>text', { finalUrl: 'https://example.com/' }));
    assert.equal(result.html, '');
    assert.equal(result.removed, 1);
});
//# sourceMappingURL=clean-html-ads-document-boundaries.test.js.map