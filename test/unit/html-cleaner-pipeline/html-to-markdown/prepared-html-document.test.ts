import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyLayer1 } from 'agent-input-sanitizer';
import { PreparedHtmlDocument } from '../../../../src/pipelines/html-processing/html-to-markdown/prepare-html-document.ts';
import type { SanitizeText } from '../../../../src/pipelines/html-processing/html-to-markdown/sanitize-html-document.ts';

const keepText: SanitizeText = (text) => text;
const url = 'https://example.com/base/article';

test('extracts a fragment heading and code without removing authored marker-like text', async () => {
  const html = '<h1>Fragment title</h1><pre>    first();\n      code-start-authored:</pre>';
  const result = await PreparedHtmlDocument.fromHtml(html, url).extract(keepText);

  assert.deepEqual(result, {
    content: '## Fragment title\n\n```\n    first();\n      code-start-authored:\n```',
    title: 'Fragment title',
  });
});

test('keeps fragment metadata and supplied base links at a host-specific URL', async () => {
  const html = '<meta property="og:title" content="Local title"><base href="/assets/"><p><a href="guide">Link</a></p>';
  const result = await PreparedHtmlDocument.fromHtml(html, 'https://www.youtube.com/watch?v=abcdef12345').extract(keepText);

  assert.deepEqual(result, { content: '[Link](https://www.youtube.com/assets/guide)', title: 'Local title' });
});

test('keeps the schema headline while discarding schema body for an empty document', async () => {
  const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: 'Schema title', articleBody: 'Discarded body', text: 'Discarded text' });
  const html = `<html><head><script type="application/ld+json">${schema}</script></head><body></body></html>`;
  const result = await PreparedHtmlDocument.fromHtml(html, url).extract(keepText);

  assert.deepEqual(result, { content: '', title: 'Schema title' });
});

test('uses the supplied sanitizer for source text, title, and link attributes', async () => {
  const observed: string[] = [];
  const sanitizeText: SanitizeText = (text, onDelete) => {
    observed.push(text);
    return applyLayer1(' ' + text, onDelete).cleaned.slice(1);
  };
  const html = '<title>Source&#x202e; title</title><p><a href="/left&#x202e;right">left&#x202e;right</a></p>';
  const result = await PreparedHtmlDocument.fromHtml(html, url).extract(sanitizeText);

  assert.deepEqual(result, { content: '[leftright](https://example.com/leftright)', title: 'Source title' });
  assert.ok(observed.includes('Source\u202e title'));
  assert.ok(observed.includes('/left\u202eright'));
  assert.ok(observed.includes('left\u202eright'));
});

function substackHtml(body: string): string {
  const data = JSON.stringify({ feedData: { initialPost: { post: { body_html: body } } } });
  return '<html><head><title>Source title</title></head><body>'
    + `<script>window._preloads = JSON.parse(${JSON.stringify(data)});</script></body></html>`;
}

test('sanitizes freshly decoded extracted text and attributes with the same callback', async () => {
  const observed: string[] = [];
  const sanitizeText: SanitizeText = (text, onDelete) => {
    observed.push(text);
    return applyLayer1(' ' + text, onDelete).cleaned.slice(1);
  };
  const html = substackHtml('<p><a href="/left&#x202e;right">left&#x202e;right</a></p>');
  const result = await PreparedHtmlDocument.fromHtml(html, 'https://example.substack.com/p/test').extract(sanitizeText);

  assert.deepEqual(result, { content: '[leftright](https://example.substack.com/leftright)', title: 'Source title' });
  assert.ok(observed.includes('/left\u202eright'));
  assert.ok(observed.includes('left\u202eright'));
});

test('rejects with the source sanitizer error', async () => {
  const error = new Error('Source sanitation failed');
  const prepared = PreparedHtmlDocument.fromHtml('<p>Source text</p>', url);

  await assert.rejects(prepared.extract(() => { throw error; }), (actual) => actual === error);
});

test('preserves Defuddle fallback when the extracted sanitizer fails', async (t) => {
  t.mock.method(console, 'error', () => {});
  let failed = false;
  const prepared = PreparedHtmlDocument.fromHtml(substackHtml('<p>Decoded content</p>'), 'https://example.substack.com/p/test');
  const result = await prepared.extract((text) => {
    if (text === 'Decoded content') {
      failed = true;
      throw new Error('Extracted sanitation failed');
    }
    return text;
  });

  assert.equal(failed, true);
  assert.deepEqual(result, { content: 'Decoded content', title: 'Source title' });
});
