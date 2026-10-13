import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.js';
async function cleanBody(body) {
    return createPipeline().process('https://example.com/', `<!doctype html><html><body><main>${body}<p>Visible sibling</p></main></body></html>`);
}
function assertTarget(result, visible) {
    if (visible)
        assert.match(result.html, /TARGET CONTENT/);
    else
        assert.doesNotMatch(result.html, /TARGET CONTENT/);
    assert.equal(result.markdown, visible ? 'TARGET CONTENT\n\nVisible sibling' : 'Visible sibling');
    assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
}
describe('compound mask grouping', () => {
    const cases = [
        { name: 'compound mask image', style: 'mask:url(mask.svg) center/cover no-repeat', visible: false },
        { name: 'compound mask border source', style: 'mask-border:url(mask.svg) 30 fill / 10', visible: false },
        { name: 'compound mask image on a noncollapsed parent',
            style: 'mask:url(mask.svg) center/cover no-repeat', parentAngle: 45, visible: true },
        { name: 'compound mask border on a noncollapsed parent',
            style: 'mask-border:url(mask.svg) 30 fill / 10', parentAngle: 45, visible: true },
        { name: 'mask none', style: 'mask:none', visible: true },
        { name: 'mask with omitted image', style: 'mask:center/cover no-repeat', visible: true },
        { name: 'mask border with omitted source', style: 'mask-border:30 fill / 10', visible: true },
        { name: 'multiple mask layers', style: 'mask:url(mask.svg) center/cover no-repeat,none', visible: false },
        { name: 'unresolved mask', style: 'mask:var(--mask)', visible: true },
        { name: 'important mask none before a normal compound mask',
            style: 'mask:none!important;mask:url(mask.svg) center/cover no-repeat', visible: true },
        { name: 'important mask border before a normal mask reset',
            style: 'mask-border:url(mask.svg) 30 fill / 10!important;mask:none', visible: false },
        { name: 'mask reset after a compound mask border',
            style: 'mask-border:url(mask.svg) 30 fill / 10;mask:none', visible: true },
        { name: 'important mask border source before a normal border reset',
            style: 'mask-border-source:url(mask.svg)!important;mask-border:none', visible: false },
        { name: 'border reset after a normal mask border source',
            style: 'mask-border-source:url(mask.svg);mask-border:none', visible: true },
    ];
    for (const { name, style, parentAngle = 90, visible } of cases) {
        test(`${visible ? 'keeps' : 'removes'} a child plane with ${name}`, async () => {
            const result = await cleanBody(`<div style="transform-style:preserve-3d;${style};transform:rotateX(${parentAngle}deg);width:300px;height:160px">` +
                '<p style="transform:rotateX(45deg);width:200px;height:100px">TARGET CONTENT</p></div>');
            assertTarget(result, visible);
        });
    }
});
describe('box context through display contents', () => {
    for (const display of ['flex', 'grid']) {
        for (const depth of [1, 2]) {
            test(`removes a zero-scale ${display} item through ${depth} contents wrapper(s)`, async () => {
                const wrappers = '<div style="display:contents">'.repeat(depth);
                const result = await cleanBody(`<div style="display:${display}">${wrappers}` +
                    '<span style="transform:scale(0)">TARGET CONTENT</span>' +
                    '</div>'.repeat(depth) + '</div>');
                assertTarget(result, false);
            });
        }
    }
    test('keeps an invertible rotated flex item through a contents wrapper', async () => {
        const result = await cleanBody('<div style="display:flex"><div style="display:contents">' +
            '<span style="transform:matrix(0,1,-1,0,0,0)">TARGET CONTENT</span></div></div>');
        assertTarget(result, true);
    });
    test('keeps a non-replaced inline span outside flex and grid layout', async () => {
        const result = await cleanBody('<div><div style="display:contents"><span style="transform:scale(0)">' +
            'TARGET CONTENT</span></div></div>');
        assertTarget(result, true);
    });
    test('removes a collapsed preserved child plane through nested contents wrappers', async () => {
        const result = await cleanBody('<div style="transform-style:preserve-3d;transform:rotateX(45deg)">' +
            '<div style="display:contents"><div style="display:contents">' +
            '<p style="transform:rotateX(45deg)">TARGET CONTENT</p></div></div></div>');
        assertTarget(result, false);
    });
    test('removes hidden parent text but keeps a visible preserved child through contents', async () => {
        const result = await cleanBody('<div style="transform-style:preserve-3d;transform:rotateX(90deg)">' +
            '<div style="display:contents">Hidden parent' +
            '<p style="transform:rotateX(45deg)">TARGET CONTENT</p></div></div>');
        assert.doesNotMatch(result.html, /Hidden parent/);
        assert.match(result.html, /TARGET CONTENT/);
        assert.equal(result.markdown, 'TARGET CONTENT\n\nVisible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
    test('keeps an unresolved perspective projection through a contents wrapper', async () => {
        const result = await cleanBody('<div style="perspective:500px;perspective-origin:0 0;width:300px;height:200px">' +
            '<div style="display:contents">' +
            '<div style="transform:matrix3d(1,1,0,0,1,1,1,0,0,1,1,0,0,0,0,1);width:200px;height:100px">' +
            'TARGET CONTENT</div></div></div>');
        assertTarget(result, true);
    });
    test('keeps a translated font override through contents while removing hidden text', async () => {
        const result = await cleanBody('<div style="font-size:0;transform:translateX(-1000000px)">' +
            '<div style="display:contents">Hidden parent' +
            '<p style="font-size:16px;transform:translateX(1000000px)">TARGET CONTENT</p></div></div>');
        assert.doesNotMatch(result.html, /Hidden parent/);
        assert.match(result.html, /TARGET CONTENT/);
        assert.equal(result.markdown, 'TARGET CONTENT\n\nVisible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
    test('keeps a positioned descendant that returns an offscreen ancestor to view', async () => {
        const result = await cleanBody('<div style="transform:translateX(-1000000px)"><div style="display:contents">' +
            '<p style="position:absolute;left:1000000px">TARGET CONTENT</p></div></div>');
        assertTarget(result, true);
    });
    test('ignores box offsets on a contents wrapper while restoring an ancestor translation', async () => {
        const result = await cleanBody('<div style="transform:translateX(-1000000px)">' +
            '<div style="display:contents;position:relative;margin-left:-1000000px;left:-1000000px">' +
            '<p style="transform:translateX(1000000px)">TARGET CONTENT</p></div></div>');
        assertTarget(result, true);
    });
    test('inherits font size from a contents wrapper and keeps a child override', async () => {
        const result = await cleanBody('<div style="font-size:16px"><div style="display:contents;font-size:0">Hidden parent' +
            '<span>Hidden inherited</span><p style="font-size:16px">TARGET CONTENT</p></div></div>');
        assert.doesNotMatch(result.html, /Hidden/);
        assert.match(result.html, /TARGET CONTENT/);
        assert.equal(result.markdown, 'TARGET CONTENT\n\nVisible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
});
describe('projective matrix visibility', () => {
    const matrix = 'matrix3d(1,1,0,0,1,1,1,-.002,0,1,1,-.002,0,0,0,1)';
    test('keeps a projective plane with an unresolved nonzero Z origin', async () => {
        const result = await cleanBody(`<div style="transform:${matrix};transform-origin:0 0 100px;margin-top:200px">` +
            'TARGET CONTENT</div>');
        assertTarget(result, true);
    });
    test('removes a singular full matrix even when the local projection is unresolved', async () => {
        const result = await cleanBody(`<div style="transform:scale(0) ${matrix};transform-origin:0 0 100px;margin-top:200px">` +
            'TARGET CONTENT</div>');
        assertTarget(result, false);
    });
});
//# sourceMappingURL=visibility-final-regressions.test.js.map