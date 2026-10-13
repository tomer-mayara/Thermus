import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './helpers/css-pipeline.js';
describe('visible matrix composition after floating point cancellation', () => {
    const parent = 'matrix(10000000000000000,10000000000000002,10000000000000002,10000000000000004,0,0)';
    const child = 'matrix(10000000000000002,-10000000000000000,0,1,0,0)';
    for (const rotation of ['', ' rotate(0deg)']) {
        for (const context of ['local list', 'preserved parent']) {
            test(`keeps text in a ${context}${rotation ? ' with a neighboring rotation' : ''}`, async () => {
                const body = context === 'local list'
                    ? `<p style="transform:${parent} ${child}${rotation};transform-origin:0 0 0">Visible text</p>`
                    : `<div style="transform-style:preserve-3d;transform:${parent};transform-origin:0 0 0">` +
                        `<p style="transform:${child}${rotation};transform-origin:0 0 0">Visible text</p></div>`;
                const result = await cleanBody(body);
                assert.match(result.html, /Visible text/);
                assert.equal(result.markdown, 'Visible text\n\nVisible sibling');
                assert.deepEqual(result.found, []);
            });
        }
    }
});
//# sourceMappingURL=visibility-matrix-precision.test.js.map