import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { parseHTML as parseHtmlEsm } from 'linkedom';
const require = createRequire(import.meta.url);
const parseHtmlCjs = require('linkedom').parseHTML;
const html = '<img'
    + ' alt="Example: &amp;#x202e; &amp; &copy; &quot;quote&quot;"'
    + ' title="Example: &amp;#8238; &amp; &#169; &quot;quoted&quot;"'
    + ' src="/search?q=a&amp;b=c&amp;copyright=%C2%A9">';
const expectedAttributes = {
    alt: 'Example: &#x202e; & © "quote"',
    title: 'Example: &#8238; & © "quoted"',
    src: '/search?q=a&b=c&copyright=%C2%A9',
};
for (const [entryPoint, parseHtml] of [['ESM', parseHtmlEsm], ['CommonJS', parseHtmlCjs]]) {
    test(`${entryPoint} LinkeDOM preserves visible attribute values after serialization roundtrip`, () => {
        const firstImage = parseHtml(html).document.querySelector('img');
        assert.ok(firstImage);
        assert.deepEqual({
            alt: firstImage.getAttribute('alt'),
            title: firstImage.getAttribute('title'),
            src: firstImage.getAttribute('src'),
        }, expectedAttributes);
        const serialized = firstImage.outerHTML;
        const secondImage = parseHtml(serialized).document.querySelector('img');
        assert.ok(secondImage);
        assert.deepEqual({
            alt: secondImage.getAttribute('alt'),
            title: secondImage.getAttribute('title'),
            src: secondImage.getAttribute('src'),
        }, expectedAttributes);
    });
}
//# sourceMappingURL=linkedom-serialization.test.js.map