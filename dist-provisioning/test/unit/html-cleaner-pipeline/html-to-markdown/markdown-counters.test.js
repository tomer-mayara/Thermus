import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CleanHtmlToMarkdownDefuddle } from '../../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.js';
import { createContext } from '../../../support/html-cleaner-context.js';
for (const html of ['', ' \t\r\n ']) {
    test(`keeps inherited evidence unique for empty HTML ${JSON.stringify(html)}`, async () => {
        const input = createContext(html, {
            removed: 4, skipped: 3, markdown: 'Old markdown', title: 'Old title',
            found: Object.freeze(['first', 'first', 'second', 'first']),
            warnings: Object.freeze(['First warning', 'First warning', 'Second warning']),
        });
        const original = structuredClone(input);
        const result = await new CleanHtmlToMarkdownDefuddle().invoke(Object.freeze(input));
        assert.deepEqual(result, {
            ...input, markdown: '', title: null,
            found: ['first', 'second'], warnings: ['First warning', 'Second warning'],
        });
        assert.deepEqual(input, original);
    });
}
test('records entity-decoded findings once and keeps prior counters and context', async () => {
    const input = createContext('<html><head><title>Safe&#8238; title</title></head>'
        + '<body><main><p>Visible&#8203; text</p></main></body></html>', {
        removed: 8, skipped: 3,
        found: Object.freeze(['existing-finding', 'cf-format']),
        warnings: Object.freeze(['Existing warning']),
        markdown: 'Old markdown', title: 'Old title',
    });
    const original = structuredClone(input);
    const converter = new CleanHtmlToMarkdownDefuddle();
    const result = await converter.invoke(Object.freeze(input));
    const repeated = await converter.invoke(Object.freeze(result));
    assert.equal(result.markdown, 'Visible text');
    assert.equal(result.title, 'Safe title');
    assert.equal(result.removed, 8);
    assert.equal(result.skipped, 3);
    assert.deepEqual(result.found, ['existing-finding', 'cf-format']);
    assert.equal(result.warnings?.[0], 'Existing warning');
    assert.ok((result.warnings?.length ?? 0) > 1);
    assert.equal(new Set(result.warnings).size, result.warnings?.length);
    assert.deepEqual(repeated, result);
    assert.deepEqual(input, original);
    assert.equal(result.html, input.html);
    assert.equal(result.requestedUrl, input.requestedUrl);
    assert.equal(result.finalUrl, input.finalUrl);
});
//# sourceMappingURL=markdown-counters.test.js.map