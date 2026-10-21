import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CleanHtmlToMarkdownDefuddle } from '../../../../src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { createContext } from '../fixtures/html-cleaner-context.ts';

describe('HTML to Markdown noscript fragments', () => {
  for (const html of [
    '<p>Before</p><noscript>Fallback text</noscript><p>After</p>',
    '<html><p>Before</p><noscript>Fallback text</noscript><p>After</p></html>',
  ]) {
    test(`keeps fallback text in fragment order: ${html}`, async () => {
      const input = createContext(html);
      const original = structuredClone(input);

      const result = await new CleanHtmlToMarkdownDefuddle().invoke(Object.freeze(input));

      assert.equal(result.markdown, 'Before\n\nFallback text\n\nAfter');
      assert.deepEqual(input, original);
    });
  }

  for (const [html, markdown] of [
    ['<noscript>Fallback text</noscript>', 'Fallback text'],
    ['<noscript>&lt;img src="/example.png"&gt;</noscript>', '\\<img src="/example.png">'],
  ]) {
    test(`keeps a standalone fallback fragment: ${html}`, async () => {
      const result = await new CleanHtmlToMarkdownDefuddle().invoke(createContext(html));

      assert.equal(result.markdown, markdown);
    });
  }

  for (const headEnd of ['</head><body>', '']) {
    test(`keeps head noscript metadata when the head end tag is ${headEnd ? 'present' : 'omitted'}`, async () => {
      const html = '<html><head><noscript><meta property="og:title" content="Fallback title"></noscript>'
        + `${headEnd}<p>Before</p><noscript>Fallback text</noscript><p>After</p></html>`;

      const result = await new CleanHtmlToMarkdownDefuddle().invoke(createContext(html));

      assert.equal(result.title, 'Fallback title');
      assert.equal(result.markdown, 'Before\n\nFallback text\n\nAfter');
    });
  }
});
