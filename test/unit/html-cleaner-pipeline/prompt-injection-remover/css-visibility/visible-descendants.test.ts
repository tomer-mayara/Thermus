import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { sanitizeHtml } from '../../../../support/sanitize-html.ts';
import { createContext } from '../../../../support/html-cleaner-context.ts';

describe('Visible descendants', () => {
  for (const tag of ['div', 'span', 'body']) {
    test(`keeps font overrides inside a zero-font-size ${tag}`, async () => {
      const result = await sanitizeHtml(
        `<${tag} style="font-size:0">Hidden parent` +
        '<span>Hidden inherited<span style="font-size:16px">Visible nested</span></span>' +
        '<span style="font-size:0">Hidden zero</span>' +
        '<span style="font-size:16px">Visible sibling<span>Visible inherited</span></span>' +
        `Hidden tail</${tag}>`,
      );

      assert.doesNotMatch(result.html, /Hidden/);
      assert.match(result.html, /Visible nested/);
      assert.match(result.html, /Visible sibling/);
      assert.match(result.html, /Visible inherited/);
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 0);
    });
  }

  for (const size of ['inherit', 'unset', '0px', '2em', '150%', 'larger', '2ex']) {
    test(`removes hidden text when the child font size is ${size}`, async () => {
      const result = await sanitizeHtml(
        `<div style="font-size:0"><span style="font-size:${size}">Hidden text</span></div>` +
        '<p>Visible control</p>',
      );

      assert.doesNotMatch(result.html, /Hidden text/);
      assert.match(result.html, /Visible control/);
    });
  }

  for (const size of ['16px', '1rem', 'medium', 'initial']) {
    test(`keeps a visible child font size of ${size}`, async () => {
      const result = await sanitizeHtml(
        `<div style="font-size:0"><span style="font-size:${size}">Visible child</span></div>`,
      );

      assert.match(result.html, /Visible child/);
      assert.deepEqual(result.found, []);
      assert.equal(result.skipped, 0);
    });
  }

  test('keeps visible images while removing zero-font-size text and hidden images', async () => {
    const result = await sanitizeHtml(
      '<div style="font-size:0">Hidden text' +
      '<img src="/visible.png" alt="Visible image" width="100" height="100">' +
      '<img style="font-size:0" src="/own-zero.png" alt="Visible zero-font image">' +
      '<img hidden src="/hidden.png" alt="Hidden image"></div>',
    );

    assert.match(result.html, /src="\/visible.png"/);
    assert.match(result.html, /src="\/own-zero.png"/);
    assert.doesNotMatch(result.html, /Hidden|src="\/hidden.png"/);
  });

  for (const style of [
    'display:none', 'opacity:0', 'content-visibility:hidden',
    'transform:scale(0)', 'overflow:hidden;height:0',
  ]) {
    test(`keeps the whole subtree hidden with ${style}`, async () => {
      const result = await sanitizeHtml(
        `<div style="font-size:0;${style}">` +
        '<p style="font-size:16px">Hidden override</p>' +
        '<img src="/hidden.png" alt="Hidden image"></div><p>Visible control</p>',
      );

      assert.doesNotMatch(result.html, /Hidden|hidden.png/);
      assert.match(result.html, /Visible control/);
    });
  }

  test('handles font shorthand overrides and hidden shorthand text', async () => {
    const result = await sanitizeHtml(
      '<div style="font:0px serif">Hidden parent' +
      '<span style="font:16px serif">Visible shorthand</span>' +
      '<span style="font-size:16px">Visible longhand</span>' +
      '<span style="font:0px serif">Hidden shorthand</span></div>',
    );

    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /Visible shorthand/);
    assert.match(result.html, /Visible longhand/);
  });

  test('decodes CSS escapes before it resolves a child font size', async () => {
    const result = await sanitizeHtml(String.raw`<div style="font-size:0">
      <span style="font-size:\6d edium">Visible keyword</span>
      <span style="font-s\69ze:16\70x">Visible length</span>
      <span style="font-size:v\61r(--size)">Unresolved size</span>
      <span style="font-size:\69nherit">Hidden inherited</span>
    </div>`);

    assert.match(result.html, /Visible keyword/);
    assert.match(result.html, /Visible length/);
    assert.match(result.html, /Unresolved size/);
    assert.doesNotMatch(result.html, /Hidden inherited/);
  });

  test('resolves shorthand order and important font declarations', async () => {
    const result = await sanitizeHtml('<div style="font-size:0">' +
      '<span style="font:0px serif;font-size:16px">Visible last</span>' +
      '<span style="font-size:16px!important;font:0px serif">Visible important</span>' +
      '<span style="font-size:16px;font-size:invalid">Visible valid</span>' +
      '<span style="font-size:16px;font:0px serif">Hidden last</span>' +
      '<span style="font:0px serif!important;font-size:16px">Hidden important</span></div>');

    assert.match(result.html, /Visible last/);
    assert.match(result.html, /Visible important/);
    assert.match(result.html, /Visible valid/);
    assert.doesNotMatch(result.html, /Hidden/);
  });

  test('resolves relative font sizes from the parent and root', async () => {
    const result = await sanitizeHtml('<html style="font-size:0"><body>' +
      '<p style="font-size:1rem">Hidden root size</p>' +
      '<div style="font-size:0.001px">Hidden small text' +
      '<span style="font-size:16000em">Visible scaled text</span></div>' +
      '<p style="font-size:16px">Visible absolute size</p></body></html>');

    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /Visible scaled text/);
    assert.match(result.html, /Visible absolute size/);
  });

  test('resolves root-relative font sizes inside a zero-font-size parent', async () => {
    const result = await sanitizeHtml('<!doctype html><html style="font-size:16px"><body>' +
      '<div style="font-size:0">Hidden parent text' +
      '<p style="font-size:1rem">Visible child</p></div>' +
      '<p>Visible sibling</p></body></html>');

    assert.doesNotMatch(result.html, /Hidden parent text/);
    assert.match(result.html, /Visible child/);
    assert.match(result.html, /Visible sibling/);
  });
});

test('the final Markdown contains the visible descendants, image, and rotation', async () => {
  const pipeline = new HtmlToMarkdownPipeline([
    new PromptInjectionRemoverSanitizer(), new CleanHtmlToMarkdownDefuddle(),
  ]);
  const html = '<html><body><main>' +
    '<div style="font-size:0">Hidden parent<p style="font-size:16px">VISIBLE CONTENT</p>' +
    '<p>Hidden inherited</p><img src="/photo.png" alt="Visible photo" width="200" height="200"></div>' +
    '<p style="transform:matrix(0,1,-1,0,0,0)">Visible rotation</p>' +
    '<div style="transform:matrix(1,2,2,4,0,0)">Hidden collapse</div>' +
    '<div style="display:none"><p style="font-size:16px">Hidden override</p></div>' +
    '<p>Visible sibling</p></main></body></html>';

  const result = await pipeline.process(createContext(html));

  assert.equal(result.markdown, [
    'VISIBLE CONTENT', '![Visible photo](https://example.com/photo.png)',
    'Visible rotation', 'Visible sibling',
  ].join('\n\n'));
});
