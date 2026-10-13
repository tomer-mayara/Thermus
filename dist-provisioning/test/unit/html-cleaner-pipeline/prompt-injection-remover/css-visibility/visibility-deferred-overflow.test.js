import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './helpers/css-pipeline.js';
describe('deferred overflow shorthand boundaries', () => {
    for (const { name, overflow, visible, child = 'rotateX(-90deg)' } of [
        { name: 'a variable after a hidden token', overflow: 'overflow:hidden var(--missing)', visible: true },
        { name: 'a variable before a hidden token', overflow: 'overflow:var(--missing) hidden', visible: true },
        { name: 'a deferred environment value', overflow: 'overflow:hidden env(missing)', visible: true },
        { name: 'a deferred typed attribute',
            overflow: 'overflow:hidden attr(data-overflow type(*))', visible: true },
        { name: 'known hidden overflow', overflow: 'overflow:hidden', visible: false },
        { name: 'known hidden and visible axes', overflow: 'overflow:hidden visible', visible: false },
        { name: 'known visible overflow', overflow: 'overflow:visible', visible: true },
        { name: 'a hidden axis replaced by an unknown shorthand',
            overflow: 'overflow-x:hidden;overflow:hidden var(--missing)', visible: true },
        { name: 'an important unknown shorthand followed by a normal hidden axis',
            overflow: 'overflow:hidden var(--missing)!important;overflow-y:hidden', visible: true },
        { name: 'an important hidden axis followed by a normal unknown shorthand',
            overflow: 'overflow-x:hidden!important;overflow:hidden var(--missing)', visible: false },
        { name: 'a later hidden axis at the same priority',
            overflow: 'overflow:hidden var(--missing);overflow-y:hidden', visible: false },
        { name: 'one visible axis after an unknown shorthand',
            overflow: 'overflow:hidden var(--missing);overflow-y:visible', visible: true },
        { name: 'both visible axes after an unknown shorthand',
            overflow: 'overflow:hidden var(--missing);overflow-x:visible;overflow-y:visible',
            visible: false, child: 'none' },
    ]) {
        test(`${visible ? 'keeps' : 'removes'} child text with ${name}`, async () => {
            const result = await cleanBody('<div style="transform-style:preserve-3d;transform:rotateX(90deg);transform-origin:0 0 0;' +
                `${overflow}"><p style="transform:${child};transform-origin:0 0 0">Target child</p></div>`);
            if (visible)
                assert.match(result.html, /Target child/);
            else
                assert.doesNotMatch(result.html, /Target child/);
            assert.equal(result.markdown, visible ? 'Target child\n\nVisible sibling' : 'Visible sibling');
            assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
        });
    }
    test('keeps a restored child under a deferred overflow class rule', async () => {
        const result = await cleanBody('<div class="parent"><p style="transform:rotateX(-90deg);transform-origin:0 0 0">Target child</p></div>', '<style>.parent{transform-style:preserve-3d;transform:rotateX(90deg);transform-origin:0 0 0;' +
            'overflow:hidden var(--missing)}</style>');
        assert.match(result.html, /Target child/);
        assert.equal(result.markdown, 'Target child\n\nVisible sibling');
        assert.deepEqual(result.found, []);
    });
});
//# sourceMappingURL=visibility-deferred-overflow.test.js.map