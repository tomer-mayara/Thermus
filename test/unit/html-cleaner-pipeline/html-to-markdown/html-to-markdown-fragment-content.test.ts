import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import type { Ctx } from '../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { createContextForUrl as createContext } from '../../../support/html-cleaner-context.ts';

let converter: CleanHtmlToMarkdownDefuddle;
beforeEach(() => {
  converter = new CleanHtmlToMarkdownDefuddle();
});

describe('HTML to Markdown fragment content', () => {
  test('keeps image-only fragments', async () => {
    const result = await converter.invoke(createContext('<img src="/visible.png" alt="Visible image">'));

    assert.equal(result.markdown, '![Visible image](https://example.com/visible.png)');
  });

  for (const html of ['', ' \n\t ']) {
    test(`returns empty markdown for ${html === '' ? 'empty' : 'whitespace'} input`, async () => {
      const input: Ctx = {
        ...createContext(html),
        markdown: 'Old content',
        title: 'Old title',
        removed: 2,
        skipped: 3,
        found: ['html-comments'],
        warnings: ['Existing warning'],
      };
      const original = structuredClone(input);

      const result = await converter.invoke(Object.freeze(input));

      assert.deepEqual(input, original);
      assert.notEqual(result, input);
      assert.deepEqual(result, { ...original, markdown: '', title: null });
    });
  }

  for (const [html, markdown] of [
    ['Visible plain text', 'Visible plain text'],
    ['3 < 5 & 7 > 4', '3 < 5 & 7 > 4'],
    ['*literal* [text] # heading', '\\*literal\\* \\[text\\] # heading'],
    ['<p>Visible paragraph</p>', 'Visible paragraph'],
  ]) {
    test(`converts visible input: ${html}`, async () => {
      const result = await converter.invoke(createContext(html));

      assert.equal(result.markdown, markdown);
      assert.equal(result.html, html);
    });
  }

  test('keeps a heading fragment in markdown and title', async () => {
    const result = await converter.invoke(createContext('<h1>Fragment heading</h1>'));

    assert.equal(result.title, 'Fragment heading');
    assert.match(result.markdown ?? '', /^#{1,6}\s+Fragment heading$/m);
  });

  test('keeps text that follows a heading fragment', async () => {
    const result = await converter.invoke(
      createContext('<h1>Fragment heading</h1><p>Fragment text.</p>'),
    );

    assert.equal(result.title, 'Fragment heading');
    assert.match(result.markdown ?? '', /^#{1,6}\s+Fragment heading$/m);
    assert.match(result.markdown ?? '', /Fragment text\./);
  });

  for (const html of [
    '<body><h1>Visible heading</h1></body>',
    '<html><h1>Visible heading</h1></html>',
    '<body><h1>Visible heading</h1><p>Visible text.</p></body>',
    '<html><h1>Visible heading</h1><p>Visible text.</p></html>',
  ]) {
    test(`keeps headings with omitted document tags: ${html}`, async () => {
      const result = await converter.invoke(createContext(html));

      assert.equal(result.title, 'Visible heading');
      assert.match(result.markdown ?? '', /^#{1,6}\s+Visible heading$/m);
      if (html.includes('<p>')) {
        assert.match(result.markdown ?? '', /Visible text\./);
      }
    });
  }

  test('keeps the supplied title and visible heading when the body tag is omitted', async () => {
    const html = '<html><head><title>Document title</title></head><h1>Visible heading</h1><p>Visible text.</p></html>';

    const result = await converter.invoke(createContext(html));

    assert.equal(result.title, 'Document title');
    assert.match(result.markdown ?? '', /^#{1,6}\s+Visible heading$/m);
    assert.match(result.markdown ?? '', /Visible text\./);
  });

  for (const html of [
    '<h1 id="title">Visible heading</h1>',
    '<p id="title">Visible paragraph</p>',
    '<p class="sidebar">Visible paragraph</p>',
    '<p class="ad-container">Visible paragraph</p>',
  ]) {
    test(`keeps visible fragments with article cleanup attributes: ${html}`, async () => {
      const result = await converter.invoke(createContext(html));

      if (html.startsWith('<h1')) {
        assert.match(result.markdown ?? '', /^#{1,6}\s+Visible heading$/m);
      } else {
        assert.equal(result.markdown, 'Visible paragraph');
      }
    });
  }

  test('keeps attributed text in a long fragment', async () => {
    const html = `<p>${'Visible body text. '.repeat(80)}</p><p class="post-title">Visible attributed paragraph.</p>`;

    const result = await converter.invoke(createContext(html));

    assert.match(result.markdown ?? '', /Visible body text\./);
    assert.match(result.markdown ?? '', /Visible attributed paragraph\./);
  });

  test('keeps visible fragment text outside the main element', async () => {
    const html = '<p>Visible before.</p><main><p>Visible main.</p></main><p>Visible after.</p>';

    const result = await converter.invoke(createContext(html));

    assert.equal(result.markdown, 'Visible before.\n\nVisible main.\n\nVisible after.');
  });

  for (const html of [
    '<head><title>Omitted tags</title></head><body><main><p>Visible <a href="relative">link</a></p></main></body>',
    '<html><head><title>Omitted tags</title></head><main><p>Visible <a href="relative">link</a></p></main></html>',
    '<title>Omitted tags</title><main><p>Visible <a href="relative">link</a></p></main>',
  ]) {
    test(`keeps metadata and content with omitted document tags: ${html}`, async () => {
      const result = await converter.invoke(createContext(html, 'https://example.com/base/'));

      assert.equal(result.title, 'Omitted tags');
      assert.equal(result.markdown, 'Visible [link](https://example.com/base/relative)');
    });
  }

});
