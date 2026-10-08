import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, test } from 'node:test';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { type CleanHtmlToMarkdown } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown.ts';
import { type Ctx } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';

const cleanedHtml = readFileSync(
  join(process.cwd(), 'test/unit/fixtures/element-hiding.cleaned.html'),
  'utf8',
);

describe('CleanHtmlToMarkdownDefuddle', () => {
  let converter: CleanHtmlToMarkdown;

  beforeEach(() => {
    converter = new CleanHtmlToMarkdownDefuddle();
  });

  function createContext(html: string, url = 'https://example.com/'): Ctx {
    return {
      url,
      html,
      removed: 0,
      skipped: 0,
    };
  }

  test('keeps the surviving content', async () => {
    const result = await converter.invoke(createContext(cleanedHtml));

    assert.notEqual(result.markdown, '');
    assert.match(result.markdown ?? '', /Example Content/);
  });

  test('does not resurrect removed nodes', async () => {
    const result = await converter.invoke(createContext(cleanedHtml));
    const markdown = result.markdown ?? '';
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
    const result = await converter.invoke(createContext(cleanedHtml));

    assert.ok(typeof result.markdown === 'string');
    assert.equal(result.markdown.includes('<div'), false);
    assert.equal(result.markdown.includes('<script'), false);
  });

  test('returns empty markdown for a complete empty HTML document', async () => {
    const result = await converter.invoke(createContext('<html><body></body></html>'));

    assert.equal(result.markdown, '');
  });

  test('uses local HTML for X posts without making network requests', async (t) => {
    const fetchCalls: string[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
      fetchCalls.push(String(input));
      return Response.json({
        tweet: {
          author: { screen_name: 'remote_author' },
          text: 'Remote replacement from FxTwitter',
          created_at: '2024-01-01T00:00:00Z',
        },
      });
    });
    const html = '<html><head><title>Local post title</title></head><body><main><p>Local X post content.</p><p><a href="/local">Local relative link</a></p></main></body></html>';

    const result = await converter.invoke(
      createContext(html, 'https://x.com/example/status/123456789'),
    );

    assert.deepEqual(fetchCalls, []);
    assert.equal(result.title, 'Local post title');
    assert.match(result.markdown ?? '', /Local X post content\./);
    assert.match(result.markdown ?? '', /\[Local relative link\]\(https:\/\/x\.com\/local\)/);
    assert.doesNotMatch(result.markdown ?? '', /Remote replacement from FxTwitter/);
  });

  test('returns an empty result for an empty Reddit comments document without network requests', async (t) => {
    const fetchCalls: string[] = [];
    t.mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
      fetchCalls.push(String(input));
      return new Response('', { status: 503 });
    });

    const result = await converter.invoke(
      createContext(
        '<html><head><title></title></head><body></body></html>',
        'https://www.reddit.com/r/example/comments/abc123/post_title/',
      ),
    );

    assert.deepEqual(fetchCalls, []);
    assert.equal(result.markdown, '');
    assert.equal(result.title, '');
  });

  test('preserves context and converts relative links using its URL', async () => {
    const input: Ctx = {
      url: 'https://example.com/base/',
      html: '<html><head><title>Relative</title></head><body><main><p><a href="/docs/page">Relative link</a></p></main></body></html>',
      markdown: 'old markdown',
      title: 'Old title',
      removed: 2,
      skipped: 3,
    };
    const original = { ...input };

    const result = await converter.invoke(input);

    assert.deepEqual(input, original);
    assert.notEqual(result, input);
    assert.equal(result.url, input.url);
    assert.equal(result.html, input.html);
    assert.equal(result.removed, input.removed);
    assert.equal(result.skipped, input.skipped);
    assert.equal(result.title, 'Relative');
    assert.equal(result.markdown, '[Relative link](https://example.com/docs/page)');
  });
});
