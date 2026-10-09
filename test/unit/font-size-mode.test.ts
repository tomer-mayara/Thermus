import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { sanitizeHtml } from '../helpers/sanitize-html.ts';

describe('Font size and document mode', () => {
  test('keeps unitless font size in a full document without a doctype', async () => {
    const result = await sanitizeHtml(
      '<html><body><main>' +
      '<p style="font-size:0;font-size:16">Visible content</p>' +
      '<p>Visible sibling</p>' +
      '</main></body></html>',
    );

    assert.match(result.html, /Visible content/);
    assert.match(result.html, /Visible sibling/);
    assert.deepEqual(result.found, []);
  });

  test('keeps a pixel font size in a standards document', async () => {
    const result = await sanitizeHtml(
      '<!doctype html><html><body><main>' +
      '<p style="font-size:0;font-size:16px">Visible content</p>' +
      '<p>Visible sibling</p>' +
      '</main></body></html>',
    );

    assert.match(result.html, /Visible content/);
    assert.match(result.html, /Visible sibling/);
  });

  test('keeps the prior zero size when unitless font size is invalid in standards mode', async () => {
    const result = await sanitizeHtml(
      '<!doctype html><html><body><main>' +
      '<p style="font-size:0;font-size:16">Hidden content</p>' +
      '<p>Visible sibling</p>' +
      '</main></body></html>',
    );

    assert.doesNotMatch(result.html, /Hidden content/);
    assert.match(result.html, /Visible sibling/);
  });

  for (const doctype of [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">',
  ]) {
    test(`rejects a unitless font-size in limited quirks mode with ${doctype}`, async () => {
      const result = await sanitizeHtml(doctype + '<html><body><main>' +
        '<p style="font-size:0;font-size:16">Hidden invalid size</p>' +
        '<p>Visible sibling</p></main></body></html>');

      assert.doesNotMatch(result.html, /Hidden invalid size/);
      assert.match(result.html, /Visible sibling/);
    });
  }

  test('keeps a unitless font-size in full quirks mode with a legacy doctype', async () => {
    const result = await sanitizeHtml(
      '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN">' +
      '<html><body><main><p style="font-size:0;font-size:16">Visible content</p>' +
      '<p>Visible sibling</p></main></body></html>',
    );

    assert.match(result.html, /Visible content/);
    assert.match(result.html, /Visible sibling/);
    assert.deepEqual(result.found, []);
  });

  test('keeps a unitless child font size that overrides inherited zero in quirks mode', async () => {
    const result = await sanitizeHtml(
      '<html><body><main><div style="font-size:0">Hidden parent' +
      '<p style="font-size:16">Visible child</p>' +
      '</div><p>Visible sibling</p></main></body></html>',
    );

    assert.doesNotMatch(result.html, /Hidden parent/);
    assert.match(result.html, /Visible child/);
    assert.match(result.html, /Visible sibling/);
  });

  test('resolves zero font size with declaration order and importance', async () => {
    const result = await sanitizeHtml(
      '<html><body><main><div>' +
      '<p style="font-size:0;font-size:16!important">Visible important</p>' +
      '<p style="font-size:0!important;font-size:16">Hidden important</p>' +
      '<p style="font-size:16;font-size:0">Hidden last</p>' +
      '<p style="font-size:0;font-size:16">Visible last</p>' +
      '</div><p>Visible sibling</p></main></body></html>',
    );

    assert.match(result.html, /Visible important/);
    assert.match(result.html, /Visible last/);
    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /Visible sibling/);
  });

  test('ignores negative font sizes and removes text that inherits zero', async () => {
    const result = await sanitizeHtml(
      '<html><body><main><div style="font-size:0">' +
      '<p style="font-size:0">Hidden zero</p>' +
      '<p style="font-size:-1">Hidden invalid negative</p>' +
      '</div><p style="font-size:-1">Visible invalid size</p>' +
      '<p>Visible sibling</p></main></body></html>',
    );

    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /Visible invalid size/);
    assert.match(result.html, /Visible sibling/);
  });

  test('does not accept a unitless size in the font shorthand in quirks mode', async () => {
    const result = await sanitizeHtml(
      '<html><body><main><div style="font-size:0">' +
      '<p style="font:16 serif">Hidden invalid shorthand</p>' +
      '</div><p>Visible sibling</p></main></body></html>',
    );

    assert.doesNotMatch(result.html, /Hidden invalid shorthand/);
    assert.match(result.html, /Visible sibling/);
  });

  test('keeps a display none ancestor hidden when a child sets a visible font size', async () => {
    const result = await sanitizeHtml(
      '<html><body><main><div style="display:none;font-size:0">' +
      '<p style="font-size:16px">Hidden override</p>' +
      '</div><p>Visible sibling</p></main></body></html>',
    );

    assert.doesNotMatch(result.html, /Hidden override/);
    assert.match(result.html, /Visible sibling/);
  });
});

test('the final Markdown keeps quirks mode unitless text and its sibling', async () => {
  const pipeline = new HtmlToMarkdownPipeline([
    new PromptInjectionRemoverSanitizer(), new CleanHtmlToMarkdownDefuddle(),
  ]);
  const html = '<html><body><main>' +
    '<p style="font-size:0;font-size:16">Visible content</p>' +
    '<p style="font-size:0">Hidden content</p>' +
    '<p>Visible sibling</p>' +
    '</main></body></html>';

  const result = await pipeline.process('https://example.com/', html);

  assert.equal(result.markdown, [
    'Visible content', 'Visible sibling',
  ].join('\n\n'));
});
