import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import type { Ctx } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { createContextForUrl as createContext } from '../support/html-cleaner-context.ts';

let converter: CleanHtmlToMarkdownDefuddle;
beforeEach(() => {
  converter = new CleanHtmlToMarkdownDefuddle();
});

describe('HTML to Markdown input shapes', () => {
  for (const [html, markdown] of [
    ['', ''],
    [' \n\t ', ''],
    ['<html><head><title>Empty title</title></head><body></body></html>', ''],
    ['<html><head><title>Empty title</title></head><body><div><!-- Removed --></div></body></html>', ''],
    ['Visible plain text', 'Visible plain text'],
    ['<p>Hello world</p>', 'Hello world'],
  ]) {
    test(`uses supplied content at a YouTube URL: ${html}`, async () => {
      const input: Ctx = {
        ...createContext(html, 'https://www.youtube.com/watch?v=abcdef12345'),
        removed: 2,
        skipped: 3,
        found: ['hidden-html'],
        warnings: ['Existing warning'],
      };
      const original = structuredClone(input);

      const result = await converter.invoke(Object.freeze(input));

      assert.equal(result.markdown, markdown);
      assert.equal(result.title, html.includes('<title>') ? 'Empty title' : '');
      assert.deepEqual(input, original);
      assert.deepEqual(result, { ...original, markdown, title: result.title });
    });
  }

  test('keeps fragment metadata and relative links at a YouTube URL', async () => {
    const html = '<title>Local title</title><p>Visible <a href="/local">link</a></p>';

    const result = await converter.invoke(
      createContext(html, 'https://www.youtube.com/watch?v=abcdef12345'),
    );

    assert.equal(result.title, 'Local title');
    assert.equal(result.markdown, 'Visible [link](https://www.youtube.com/local)');
  });

  test('keeps fragment metadata from meta tags', async () => {
    const html = '<meta property="og:title" content="Local metadata"><p>Visible text</p>';

    const result = await converter.invoke(createContext(html));

    assert.equal(result.title, 'Local metadata');
    assert.equal(result.markdown, 'Visible text');
  });

  test('uses visible fragment text instead of generic extractor configuration', async () => {
    const event = JSON.stringify({ announcement_body: { body: 'Remote replacement', headline: 'Replacement title' } });
    const html = `<div id="application_config" data-partnereventstore='${event}'>Visible text</div>`;

    const result = await converter.invoke(createContext(html));

    assert.equal(result.markdown, 'Visible text');
    assert.equal(result.title, '');
    assert.equal(result.html, html);
  });

  test('does not recover fragment text from schema data', async () => {
    const html = '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Article","articleBody":"Removed payload from schema data"}</script><p>Visible text</p>';

    const result = await converter.invoke(createContext(html));

    assert.equal(result.markdown, 'Visible text');
    assert.equal(result.html, html);
  });

  test('uses the supplied base for relative fragment links and images', async () => {
    const html = '<base href="https://assets.example/"><p><a href="guide">link</a></p><img src="visible.png" alt="Image">';

    const result = await converter.invoke(createContext(html, 'https://www.youtube.com/watch?v=abcdef12345'));

    assert.equal(result.markdown, '[link](https://assets.example/guide)\n\n![Image](https://assets.example/visible.png)');
  });

  test('keeps the order of implied and explicit body content', async () => {
    const html = '<html><head><title>Title</title><p>First</p><body><p>Second</p>';

    const result = await converter.invoke(createContext(html));

    assert.equal(result.title, 'Title');
    assert.equal(result.markdown, 'First\n\nSecond');
  });

  for (const html of [
    '<!doctype html><head><title>Title</title><p>Hello world</p>',
    '<!doctype html><html><head><title>Title</title><p>Hello world</p></html>',
    '<!doctype html><head><title>Title</title><p>Hello world</p><p><a href="relative">link</a></p>',
    '<!doctype html><head><title>Title</title>Visible plain text<p><a href="relative">link</a></p>',
  ]) {
    test(`keeps content after an omitted head closing tag: ${html}`, async () => {
      const result = await converter.invoke(createContext(html, 'https://example.com/base/'));

      assert.equal(result.title, 'Title');
      assert.match(result.markdown ?? '', /Hello world|Visible plain text/);
      if (html.includes('<a')) {
        assert.match(result.markdown ?? '', /\[link\]\(https:\/\/example\.com\/base\/relative\)/);
      }
    });
  }

});
