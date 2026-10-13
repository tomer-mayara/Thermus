import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody, createPipeline } from './helpers/css-pipeline.js';
describe('HTML input type matching', () => {
    for (const { type, hidden } of [
        { type: 'checKbox', hidden: true }, { type: 'CHECKBOX', hidden: false },
    ]) {
        test(`${hidden ? 'removes' : 'keeps'} a zero-font value for type ${type}`, async () => {
            const result = await cleanBody(`<input type="${type}" style="font-size:0" value="Control value">`);
            if (hidden)
                assert.doesNotMatch(result.html, /Control value/);
            else
                assert.match(result.html, /Control value/);
            assert.equal(result.markdown, 'Visible sibling');
            assert.deepEqual(result.found, hidden ? ['hidden-html'] : []);
        });
    }
});
describe('HTML root transform applicability', () => {
    for (const display of ['table-column', 'table-column-group']) {
        test(`removes a collapsed HTML root with display ${display}`, async () => {
            const result = await createPipeline().process('https://example.com/', `<!doctype html><html style="display:${display};transform:scale(0)">` +
                '<body><main><p>Hidden payload</p></main></body></html>');
            assert.doesNotMatch(result.html, /Hidden payload/);
            assert.equal(result.markdown, '');
            assert.deepEqual(result.found, ['hidden-html']);
        });
    }
    for (const display of ['inline', 'initial', 'unset', 'contents']) {
        test(`removes a collapsed HTML root with display ${display}`, async () => {
            const result = await createPipeline().process('https://example.com/', `<!doctype html><html style="display:${display};transform:scale(0)">` +
                '<body><main><p>Hidden payload</p></main></body></html>');
            assert.doesNotMatch(result.html, /Hidden payload/);
            assert.equal(result.markdown, '');
            assert.deepEqual(result.found, ['hidden-html']);
        });
        test(`keeps an identity HTML root with display ${display}`, async () => {
            const result = await createPipeline().process('https://example.com/', `<!doctype html><html style="display:${display};transform:scale(1)">` +
                '<body><main><p>Visible payload</p></main></body></html>');
            assert.match(result.html, /Visible payload/);
            assert.equal(result.markdown, 'Visible payload');
            assert.deepEqual(result.found, []);
        });
    }
    test('keeps an ordinary non-replaced inline descendant with an inapplicable transform', async () => {
        const result = await cleanBody('<span style="display:inline;transform:scale(0)">Visible payload</span>');
        assert.match(result.html, /Visible payload/);
        assert.equal(result.markdown, 'Visible payload\n\nVisible sibling');
        assert.deepEqual(result.found, []);
    });
});
test('keeps a button label when display contents removes the button box', async () => {
    const result = await cleanBody('<button style="display:contents">Visible label</button>');
    assert.match(result.html, /Visible label/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, []);
});
//# sourceMappingURL=visibility-element-boundaries.test.js.map