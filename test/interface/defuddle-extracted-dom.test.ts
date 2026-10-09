import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Defuddle } from 'defuddle/node';
import { parseHTML } from 'linkedom';

const bodyHtml = '<p><a href="/left&#x202e;right">left&#x202e;right</a></p>';
const preloadData = JSON.stringify({
  feedData: { initialPost: { post: { body_html: bodyHtml } } },
});
const pages = [
  {
    name: 'selector-based Substack',
    url: 'https://example.substack.com/p/test',
    html: '<html><head><title>Test</title></head><body>'
      + `<script>window._preloads = JSON.parse(${JSON.stringify(preloadData)});</script>`
      + '</body></html>',
    markdown: '[leftright](https://example.substack.com/leftright)',
  },
  {
    name: 'generated Discourse HTML',
    url: 'https://example.com/t/test/1',
    html: '<html><head><meta name="generator" content="Discourse"></head><body>'
      + `<div class="topic-post topic-owner"><div class="cooked">${bodyHtml}</div></div>`
      + '</body></html>',
    markdown: '[leftright](https://example.com/leftright)',
  },
];

for (const page of pages) {
  test(`Defuddle checks ${page.name} after decoding and before URL conversion`, async () => {
    const { document } = parseHTML(page.html);
    const observed: { href: string; text: string }[] = [];

    const result = await Defuddle(document, page.url, {
      markdown: true,
      useAsync: false,
      processExtractedDom(root) {
        const link = root.querySelector('a');
        assert.ok(link);
        const href = link.getAttribute('href') ?? '';
        const text = link.textContent ?? '';
        observed.push({ href, text });
        link.setAttribute('href', href.replaceAll('\u202e', ''));
        link.textContent = text.replaceAll('\u202e', '');
      },
    });

    assert.deepEqual(observed[0], { href: '/left\u202eright', text: 'left\u202eright' });
    assert.equal(result.content, page.markdown);
  });
}
