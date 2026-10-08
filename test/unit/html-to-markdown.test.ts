import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, test } from 'node:test';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';

const cleanedHtml = readFileSync(
  join(process.cwd(), 'test/unit/fixtures/element-hiding.cleaned.html'),
  'utf8',
);

describe('CleanHtmlToMarkdownDefuddle', () => {
  let converter: CleanHtmlToMarkdownDefuddle;

  beforeEach(() => {
    converter = new CleanHtmlToMarkdownDefuddle();
  });

  test('keeps the surviving content', async () => {
    const markdown = await converter.invoke(cleanedHtml);

    assert.notEqual(markdown, '');
    assert.match(markdown, /Example Content/);
  });

  test('does not resurrect removed nodes', async () => {
    const markdown = await converter.invoke(cleanedHtml);
    const cleanedSections = [
      ['## ID Selector\n', '## ID Selector with double curly braces'],
      ['## Class Selector\n', '## Descendant Selector'],
      ['## Descendant Selector\n', '## Sibling Selector'],
      ['## Sibling Selector\n', '## Attribute Selector 1'],
    ] as const;

    for (const [start, end] of cleanedSections) {
      const from = markdown.indexOf(start);
      const to = markdown.indexOf(end, from + start.length);
      assert.notEqual(from, -1, start);
      assert.notEqual(to, -1, end);
      const section = markdown.slice(from, to);
      assert.match(section, /Example Content/);
      assert.doesNotMatch(section, /\nTarget\n/);
    }
  });

  test('returns a string, not HTML', async () => {
    const markdown = await converter.invoke(cleanedHtml);

    assert.equal(markdown.includes('<div'), false);
    assert.equal(markdown.includes('<script'), false);
  });

  test('empty input', async () => {
    const markdown = await converter.invoke('<html><body></body></html>');

    assert.equal(markdown, '');
  });
});
