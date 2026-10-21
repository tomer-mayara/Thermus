import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { HtmlProcessingContext } from '../../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../../src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { createContext } from '../fixtures/html-cleaner-context.ts';

function createReportedContext(html: string): HtmlProcessingContext {
  return createContext(html, {
    requestedUrl: 'https://example.com/start',
    finalUrl: 'https://example.com/article/',
    removed: 2,
    skipped: 3,
    found: ['existing-finding'],
    warnings: ['Existing warning'],
  });
}

describe('HTML to Markdown landing regressions', () => {
  for (const html of [
    '<img src="/x" alt="3 < 5" onerror="alert(1)">',
    "<img src='/x' alt='3 < 5' onerror='alert(1)'>",
  ]) {
    test(`converts an image with a less-than sign in its quoted attribute: ${html}`, async () => {
      const input = createReportedContext(html);
      const original = structuredClone(input);

      const result = await new CleanHtmlToMarkdownDefuddle().invoke(Object.freeze(input));

      assert.equal(result.markdown, '![3 < 5](https://example.com/x)');
      assert.deepEqual(input, original);
      assert.deepEqual(result, { ...original, markdown: result.markdown, title: '' });
    });
  }

  test('keeps table cells and code without an internal marker', async () => {
    const html = '<table><tr><th>Example</th><th>Code</th></tr><tr><td>Run</td><td><pre>run()</pre></td></tr></table>';

    const result = await new CleanHtmlToMarkdownDefuddle().invoke(createContext(html));

    assert.doesNotMatch(result.markdown ?? '', /code-start-/);
    assert.match(result.markdown ?? '', /\| Example \| Code \|/);
    assert.match(result.markdown ?? '', /\| Run \|.*run\(\).*\|/);
  });

  for (const escapeSlashes of [false, true]) {
    test(`keeps schema metadata with CSS comment text and ${escapeSlashes ? 'escaped' : 'literal'} slashes`, async () => {
      const headline = 'How to use /* CSS comments */ safely';
      const metadata = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline,
        articleBody: 'Removed schema body. '.repeat(40),
        text: 'Removed schema text. '.repeat(40),
      });
      const schema = escapeSlashes ? metadata.replaceAll('/', '\\/') : metadata;
      const html = `<html><head><script type="application/ld+json">${schema}</script></head><body><p>Visible content.</p></body></html>`;
      const input = createReportedContext(html);
      const original = structuredClone(input);

      const result = await new CleanHtmlToMarkdownDefuddle().invoke(Object.freeze(input));

      assert.equal(result.title, headline);
      assert.equal(result.markdown, 'Visible content.');
      assert.deepEqual(input, original);
      assert.deepEqual(result, { ...original, markdown: result.markdown, title: headline });
    });
  }

  test('keeps a single equals sign as plain text instead of a heading underline', async () => {
    const input = createContext('Visible plain text\n=');

    const result = await new CleanHtmlToMarkdownDefuddle().invoke(input);

    assert.equal(result.markdown, 'Visible plain text\n\\=');
    assert.equal(result.html, input.html);
  });

  test('removes plain-text controls before Markdown escapes and reports each finding once', async () => {
    const input = createReportedContext('\u001b[31m*visible*\u001b[0m\u202e');
    const original = structuredClone(input);
    const converter = new CleanHtmlToMarkdownDefuddle();

    const result = await converter.invoke(Object.freeze(input));
    const repeated = await converter.invoke(Object.freeze({ ...result, html: input.html }));

    assert.equal(result.markdown, '\\*visible\\*');
    assert.equal(result.title, '');
    assert.ok(result.found?.includes('cf-format'));
    assert.ok(original.found);
    assert.ok(result.found);
    assert.ok(result.found.length > original.found.length);
    assert.equal(result.skipped, original.skipped);
    assert.deepEqual(result.found?.slice(0, 1), original.found);
    assert.deepEqual(result.warnings?.slice(0, 1), original.warnings);
    assert.deepEqual(input, original);
    assert.deepEqual(repeated, result);
  });
});
