import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HtmlToMarkdownPipeline } from '../../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.js';
import { CleanHtmlToMarkdownDefuddle } from '../../../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.js';
import { PromptInjectionRemoverSanitizer } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.js';
import { createContext } from '../../../../support/html-cleaner-context.js';
async function cleanDocument(body) {
    const pipeline = new HtmlToMarkdownPipeline([
        new PromptInjectionRemoverSanitizer(), new CleanHtmlToMarkdownDefuddle(),
    ]);
    return pipeline.process(createContext(`<!doctype html><html><body><main>${body}</main></body></html>`));
}
describe('visibility review regressions', () => {
    test('keeps visible table markup between merged hidden text segments', async () => {
        const cell = '<table><tr><td style="">VISIBLE CONTENT</td></tr></table>';
        const result = await cleanDocument('<div style="font-size:0">Hidden start<table><tr>' +
            '<td style="font-size:16px">VISIBLE CONTENT</td></tr>' +
            'Hidden fostered</table>Hidden tail</div><p>Visible sibling</p>');
        assert.equal(result.html, '<!doctype html><html><body><main><div style="">' +
            `${cell}</div><p>Visible sibling</p></main></body></html>`);
        assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
    for (const mask of ['mask:linear-gradient(white,white)', 'mask-image:linear-gradient(white,white)']) {
        test(`keeps a child plane flattened by ${mask}`, async () => {
            const result = await cleanDocument(`<div style="transform-style:preserve-3d;${mask};transform:rotateX(45deg);width:300px;height:160px">` +
                '<p style="transform:rotateX(45deg);width:200px;height:100px">VISIBLE CONTENT</p>' +
                '</div><p>Visible sibling</p>');
            assert.match(result.html, /VISIBLE CONTENT/);
            assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
            assert.deepEqual(result.found, []);
        });
    }
    test('keeps a child plane flattened by an important mask image before a shorthand reset', async () => {
        const result = await cleanDocument('<div style="transform-style:preserve-3d;mask-image:linear-gradient(white,white)!important;' +
            'mask:none;transform:rotateX(45deg);width:300px;height:160px">' +
            '<p style="transform:rotateX(45deg);width:200px;height:100px">VISIBLE CONTENT</p>' +
            '</div><p>Visible sibling</p>');
        assert.match(result.html, /VISIBLE CONTENT/);
        assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
        assert.deepEqual(result.found, []);
    });
    test('removes a collapsed child plane when a later mask shorthand resets the mask image', async () => {
        const result = await cleanDocument('<div style="transform-style:preserve-3d;mask-image:linear-gradient(white,white);' +
            'mask:none;transform:rotateX(45deg);width:300px;height:160px">' +
            '<p style="transform:rotateX(45deg);width:200px;height:100px">Hidden child plane</p>' +
            '</div><p>Visible sibling</p>');
        assert.doesNotMatch(result.html, /Hidden child plane/);
        assert.equal(result.markdown, 'Visible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
    test('keeps a flat child plane whose parent perspective needs layout data', async () => {
        const result = await cleanDocument('<div style="perspective:500px;perspective-origin:0 0;width:300px;height:200px">' +
            '<div style="transform:matrix3d(1,1,0,0,1,1,1,0,0,1,1,0,0,0,0,1);width:200px;height:100px">' +
            'VISIBLE CONTENT</div></div><p>Visible sibling</p>');
        assert.match(result.html, /VISIBLE CONTENT/);
        assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
        assert.deepEqual(result.found, []);
    });
    test('removes offscreen local text and descendants in a preserved 3D context', async () => {
        const result = await cleanDocument('<div style="width:100px;height:100px;transform-style:preserve-3d;transform:translateX(-1000000px)">' +
            'Hidden text<p>Hidden child</p></div><p>Visible sibling</p>');
        assert.doesNotMatch(result.html, /Hidden/);
        assert.match(result.html, /Visible sibling/);
        assert.equal(result.markdown, 'Visible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
    test('keeps a restored descendant while removing an offscreen preserved parent plane', async () => {
        const result = await cleanDocument('<div style="width:200px;height:100px;transform-style:preserve-3d;transform:translateX(-1000000px)">' +
            'Hidden parent<span>Hidden child</span>' +
            '<p style="transform:translateX(1000000px)">VISIBLE CONTENT</p>' +
            'Hidden tail</div><p>Visible sibling</p>');
        assert.doesNotMatch(result.html, /Hidden/);
        assert.match(result.html, /VISIBLE CONTENT/);
        assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
    test('removes an offscreen image and keeps an image whose transform restores its offset', async () => {
        const result = await cleanDocument('<div style="width:200px;height:100px;transform-style:preserve-3d;transform:translateX(-1000000px)">' +
            '<img src="/hidden.png" alt="Hidden image" width="100" height="100">' +
            '<img style="transform:translateX(1000000px)" src="/visible.png" alt="Visible image" width="100" height="100">' +
            '</div><p>Visible sibling</p>');
        assert.doesNotMatch(result.html, /hidden.png/);
        assert.match(result.html, /src="\/visible.png"/);
        assert.equal(result.markdown, '![Visible image](https://example.com/visible.png)\n\nVisible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
    test('keeps a font override whose transform returns an offscreen matrix to view', async () => {
        const result = await cleanDocument('<div style="font-size:0;width:200px;transform:matrix(1,0,0,1,-1000,0)">' +
            'Hidden parent<p style="font-size:16px;transform:translateX(1000px)">VISIBLE CONTENT</p>' +
            '</div><p>Visible sibling</p>');
        assert.doesNotMatch(result.html, /Hidden parent/);
        assert.match(result.html, /VISIBLE CONTENT/);
        assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
    test('keeps a child with a positive margin inside a wide translated parent', async () => {
        const result = await cleanDocument('<div style="width:2000px;transform:matrix(1,0,0,1,-1000,0)">' +
            '<p style="margin-left:1200px">VISIBLE CONTENT</p></div><p>Visible sibling</p>');
        assert.match(result.html, /VISIBLE CONTENT/);
        assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
        assert.deepEqual(result.found, []);
    });
});
//# sourceMappingURL=visibility-review-regressions.test.js.map