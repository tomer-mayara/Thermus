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

  describe('fragment code formatting', () => {
    for (const html of [
      '<main><code style="white-space: pre">if ready:\n    run()\nelse:\n    stop()</code></main>',
      '<pre>if ready:\n    run()\nelse:\n    stop()</pre>',
      '<p>Visible before.</p><pre>if ready:\n    run()\nelse:\n    stop()</pre><h2>Visible after.</h2>',
    ]) {
      test(`keeps fenced code and visible content in fragments: ${html}`, async () => {
        const result = await converter.invoke(createContext(html));

        assert.match(result.markdown ?? '', /```\nif ready:\n    run\(\)\nelse:\n    stop\(\)\n```/);
        if (html.includes('Visible before.')) {
          assert.match(result.markdown ?? '', /Visible before\./);
          assert.match(result.markdown ?? '', /## Visible after\./);
        }
      });
    }

    test('keeps text around a nested code element in a preformatted fragment', async () => {
      const result = await converter.invoke(createContext('<pre>before\n<code>  middle</code>\nafter</pre>'));

      assert.equal(result.markdown, '```\nbefore\n  middle\nafter\n```');
    });

    for (const style of ['white-space: pre !important', 'WHITE-SPACE: PRE !IMPORTANT']) {
      test(`keeps code fences for CSS whitespace with priority: ${style}`, async () => {
        const result = await converter.invoke(createContext(`<code style="${style}">if ready:\n    run()</code>`));

        assert.equal(result.markdown, '```\nif ready:\n    run()\n```');
      });
    }
  });

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
      assert.deepEqual(result, { ...original, markdown: '', title: '' });
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
