import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { micromark } from 'micromark';
import { CleanHtmlToMarkdownDefuddle } from '../../../../src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { createContext } from '../fixtures/html-cleaner-context.ts';

const html = '<html><head><title>Search</title></head><body><main>'
  + '<a href="/result"><div>First <strong>title</strong></div><div>second part</div></a>'
  + '<p>A safe result snippet for this example.</p></main></body></html>';

test('Given a search title with block children, when search link preservation is enabled, then Markdown renders one complete title link without joining words', async () => {
  const converter = new CleanHtmlToMarkdownDefuddle({ preserveSearchResults: true });
  const result = await converter.invoke(createContext(html));
  const { document } = parseHTML(`<html><body>${micromark(result.markdown ?? '')}</body></html>`);
  const link = document.querySelector('a');

  assert.ok(link);
  assert.equal(link.getAttribute('href'), 'https://example.com/result');
  assert.equal(link.textContent.replace(/\s+/g, ' ').trim(), 'First title second part');
  assert.match(result.markdown ?? '', /\*\*title\*\*/);
  assert.match(result.markdown ?? '', /A safe result snippet for this example\./);
});

test('Given the same full page with default fetch conversion, when it converts to Markdown, then the existing extraction stays unchanged', async () => {
  const result = await new CleanHtmlToMarkdownDefuddle().invoke(createContext(html));

  assert.equal(result.markdown, '[\n\nFirst **title**\n\nsecond part\n\n](https://example.com/result)\n\nA safe result snippet for this example.');
});

test('Given format controls in a block title and its destination, when search conversion runs, then sanitized inline words and the safe destination remain', async () => {
  const source = '<a href="/left&#x202e;right"><div>Safe&#x202e; <strong>title</strong></div><div>words</div></a>';
  const result = await new CleanHtmlToMarkdownDefuddle({ preserveSearchResults: true }).invoke(createContext(source));
  const { document } = parseHTML(`<html><body>${micromark(result.markdown ?? '')}</body></html>`);
  const link = document.querySelector('a');

  assert.ok(link);
  assert.equal(link.getAttribute('href'), 'https://example.com/leftright');
  assert.equal(link.textContent.replace(/\s+/g, ' ').trim(), 'Safe title words');
  assert.ok(result.found?.includes('cf-format'));
  assert.doesNotMatch(result.markdown ?? '', /\u202e/);
});
