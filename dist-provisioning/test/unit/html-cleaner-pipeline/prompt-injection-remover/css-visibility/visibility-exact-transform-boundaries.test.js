import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './helpers/css-pipeline.js';
const underflowedProjective = 'matrix3d(1,0,0,1e-400,0,1,0,0,0,0,1,0,-1e100,0,0,1)';
const identityMatrix3d = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
describe('authored projective transform boundaries', () => {
    for (const { context, body, markdown } of [
        {
            context: 'local text and image transforms',
            body: `<p style="transform:${underflowedProjective}">Visible local text</p>` +
                `<img style="transform:${underflowedProjective}" src="/local.png" alt="Visible local image">`,
            markdown: 'Visible local text\n\n![Visible local image](https://example.com/local.png)\n\nVisible sibling',
        },
        {
            context: 'inherited text and image transforms',
            body: `<div style="transform:${underflowedProjective}">` +
                '<p>Visible inherited text</p>' +
                '<img src="/inherited.png" alt="Visible inherited image">' +
                '</div>',
            markdown: 'Visible inherited text\n\n![Visible inherited image](https://example.com/inherited.png)\n\nVisible sibling',
        },
    ]) {
        test(`keeps visible text and images for ${context}`, async () => {
            const result = await cleanBody(body);
            assert.match(result.html, /Visible (?:local|inherited) text/);
            assert.match(result.html, /alt="Visible (?:local|inherited) image"/);
            assert.equal(result.markdown, markdown);
            assert.deepEqual(result.found, []);
        });
    }
    test('still removes a truly singular projective transform', async () => {
        const singularProjective = 'matrix3d(1,0,0,1e-400,0,0,0,0,0,0,1,0,-1e100,0,0,1)';
        const result = await cleanBody(`<div style="transform:${singularProjective}">` +
            '<p>Hidden singular text</p><img src="/singular.png" alt="Hidden singular image"></div>');
        assert.doesNotMatch(result.html, /Hidden singular (?:text|image)/);
        assert.equal(result.markdown, 'Visible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
    test('keeps an unknown transform boundary fail-open under a known offscreen ancestor', async () => {
        for (const transform of [
            'matrix3d(1,0,0,1e-400,0,1,0,0,0,0,1,0,0,0,0,1)',
            'matrix(1.00000000000000001,0,0,1,0,0)',
            'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,-1e100,0,0,1.00000000000000001)',
        ]) {
            const result = await cleanBody('<div style="transform:translateX(-1000000px)">' +
                `<x-widget style="transform:${transform}">Visible unknown boundary</x-widget></div>`);
            assert.match(result.html, /Visible unknown boundary/);
            assert.equal(result.markdown, 'Visible unknown boundary\n\nVisible sibling');
            assert.deepEqual(result.found, []);
        }
    });
});
describe('authored linear transforms with large offsets', () => {
    for (const { name, transform } of [
        {
            name: 'a rounded near-identity matrix',
            transform: 'matrix(1.00000000000000001,0,0,1,-1e100,0)',
        },
        {
            name: 'a rounded near-identity matrix followed by translation',
            transform: 'matrix(1.00000000000000001,0,0,1,0,0) translateX(-1e100px)',
        },
    ]) {
        test(`keeps text and image for ${name}`, async () => {
            const result = await cleanBody(`<p style="transform:${transform}">Visible text` +
                '<img src="/target.png" alt="Visible image"></p>');
            assert.match(result.html, /Visible text/);
            assert.match(result.html, /alt="Visible image"/);
            assert.equal(result.markdown, 'Visible text ![Visible image](https://example.com/target.png)\n\nVisible sibling');
            assert.deepEqual(result.found, []);
        });
    }
    test('still hides an exact identity-linear pure translation', async () => {
        const result = await cleanBody('<p style="transform:matrix(1,0,0,1,-1e100,0)">Hidden text' +
            '<img src="/target.png" alt="Hidden image"></p>');
        assert.doesNotMatch(result.html, /Hidden (?:text|image)/);
        assert.equal(result.markdown, 'Visible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
});
describe('exact identity transforms at unknown box boundaries', () => {
    for (const transform of [
        'matrix(1,0,0,1,0,0)',
        identityMatrix3d,
        'scale(1)',
        'scale3d(1,1,1)',
        'translate(0px)',
        'translateX(0px)',
        'translateX(0px) scale(1)',
        'scale(2) scale(0.5)',
        'matrix(2,0,0,2,0,0) matrix(0.5,0,0,0.5,0,0)',
    ]) {
        test(`preserves inherited offscreen state through identity ${transform}`, async () => {
            const result = await cleanBody('<div style="transform:translateX(-1000000px)">' +
                `<x-widget style="transform:${transform}">Hidden identity child</x-widget></div>`);
            assert.doesNotMatch(result.html, /Hidden identity child/);
            assert.equal(result.markdown, 'Visible sibling');
            assert.deepEqual(result.found, ['hidden-html']);
        });
    }
    test('preserves inherited collapsed-plane state through an identity transform', async () => {
        const result = await cleanBody('<div style="transform:scale(0)">' +
            '<x-widget style="transform:matrix(1,0,0,1,0,0)">Hidden plane child</x-widget></div>');
        assert.doesNotMatch(result.html, /Hidden plane child/);
        assert.equal(result.markdown, 'Visible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
    test('preserves inherited edge-on state through an identity transform', async () => {
        const result = await cleanBody('<div style="transform:rotateX(90deg)">' +
            '<x-widget style="transform:matrix(1,0,0,1,0,0)">Hidden edge-on child</x-widget></div>');
        assert.doesNotMatch(result.html, /Hidden edge-on child/);
        assert.equal(result.markdown, 'Visible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
    });
    test('keeps descendants visible when a nonidentity unknown transform may restore them', async () => {
        const result = await cleanBody('<div style="transform:translateX(-1000000px)">' +
            '<x-widget style="transform:translateX(1000000px)">' +
            '<div>Visible unknown descendant</div></x-widget></div>');
        assert.match(result.html, /Visible unknown descendant/);
        assert.equal(result.markdown, 'Visible unknown descendant\n\nVisible sibling');
        assert.deepEqual(result.found, []);
    });
    test('keeps descendant transforms unknown below an identity unknown box', async () => {
        const cases = [
            {
                ancestor: 'transform:translateX(-1000000px)',
                restore: 'transform:translateX(1000000px)',
            },
            {
                ancestor: 'transform:rotateX(90deg);transform-style:preserve-3d',
                restore: 'transform:rotateX(-90deg)',
            },
        ];
        for (const { ancestor, restore } of cases) {
            const result = await cleanBody(`<div style="${ancestor}">` +
                '<x-widget style="transform:matrix(1,0,0,1,0,0)">' +
                `<y-widget style="${restore}"><div>Visible unknown descendant</div></y-widget>` +
                '</x-widget></div>');
            assert.match(result.html, /Visible unknown descendant/);
            assert.equal(result.markdown, 'Visible unknown descendant\n\nVisible sibling');
            assert.deepEqual(result.found, []);
        }
    });
});
//# sourceMappingURL=visibility-exact-transform-boundaries.test.js.map