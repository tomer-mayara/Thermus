import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sanitizeHtml } from '../../../../helpers/sanitize-html.js';
describe('Matrix visibility', () => {
    for (const transform of [
        'matrix(0,1,-1,0,0,0)',
        'matrix(0,2,3,0,10,20)',
        'matrix(1,2,3,4,0,0)',
        'matrix(0.05,0,0,0.05,0,0)',
        'matrix3d(0,1,0,0,-1,0,0,0,0,0,1,0,0,0,0,1)',
        'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
    ]) {
        test(`keeps visible content with ${transform}`, async () => {
            const result = await sanitizeHtml(`<div style="transform:${transform}">Visible content</div>`);
            assert.match(result.html, /Visible content/);
            assert.deepEqual(result.found, []);
        });
    }
    for (const transform of [
        'matrix(0,0,0,1,0,0)',
        'matrix(1,0,0,0,0,0)',
        'matrix(1,2,2,4,0,0)',
        'matrix(0.001,0.3,0.003,0.9,0,0)',
        'matrix(0.3,0.2,0.9,0.6,0,0)',
        'matrix(0,0,0,0,10,20)',
        'matrix(0.001,0,0,1,0,0)',
        'matrix3d(1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1)',
        'matrix3d(1,2,0,0,2,4,0,0,0,0,1,0,0,0,0,1)',
        'matrix3d(0.001,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)',
        'matrix3d(1,0,0,0,0,0.3,0.2,0,0,0.9,0.6,0,0,0,0,1)',
        'matrix3d(0.3,0.2,0,0,0.9,0.6,1,0,0,1,0,0,0,0,0,1)',
        // CSS does not render a singular transform, including a zero Z scale.
        // https://www.w3.org/TR/css-transforms-1/#transform-function-lists
        'matrix3d(1,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1)',
        'matrix3d(0,0,-1,0,0,1,0,0,1,0,0,0,0,0,0,1)',
        'matrix(0,1,-1,0,0,0) scale(0)',
    ]) {
        test(`removes collapsed content with ${transform}`, async () => {
            const result = await sanitizeHtml(`<div style="transform:${transform}"><p style="font-size:16px">Hidden content</p></div>` +
                '<p>Visible sibling</p>');
            assert.doesNotMatch(result.html, /Hidden content/);
            assert.match(result.html, /Visible sibling/);
            assert.deepEqual(result.found, ['hidden-html']);
        });
    }
});
//# sourceMappingURL=matrix-visibility.test.js.map