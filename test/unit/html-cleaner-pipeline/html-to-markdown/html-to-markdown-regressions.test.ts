import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import type { Ctx } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';

function createContext(html: string): Ctx {
  return {
    requestedUrl: 'https://example.com/start',
    finalUrl: 'https://example.com/article',
    html,
    removed: 2,
    skipped: 3,
    found: ['existing-finding'],
    warnings: ['Existing warning'],
  };
}

describe('HTML to Markdown regressions', () => {
  for (const [bodyKey, visible] of [
    ['articleBody', '<p>Visible paragraph.</p>'],
    ['articleBody', ''],
    ['text', '<p>Visible paragraph.</p>'],
    ['text', ''],
  ]) {
    test(`keeps cleaned body content when schema ${bodyKey} repeats removed text: ${visible || 'empty body'}`, async () => {
      const removedText = 'Removed hidden payload. '.repeat(30).trim();
      const schema = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: 'Schema headline',
        [bodyKey]: removedText,
      });
      const html = `<html><head><script type="application/ld+json">${schema}</script></head><body><div hidden>${removedText}</div>${visible}</body></html>`;
      const input = createContext(html);
      const original = structuredClone(input);
      const cleaned = await new PromptInjectionRemoverSanitizer().invoke(Object.freeze(input));
      const cleanedOriginal = structuredClone(cleaned);

      const result = await new CleanHtmlToMarkdownDefuddle().invoke(Object.freeze(cleaned));

      assert.deepEqual(input, original);
      assert.deepEqual(cleaned, cleanedOriginal);
      assert.ok(cleaned.found?.includes('hidden-html'));
      assert.doesNotMatch(cleaned.html, /<div hidden/);
      assert.equal(result.markdown, visible ? 'Visible paragraph.' : '');
      assert.equal(result.title, 'Schema headline');
      assert.deepEqual(result, { ...cleanedOriginal, markdown: result.markdown, title: result.title });
    });
  }

  const article = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Empty schema headline',
    articleBody: 'Schema body must not restore removed content. '.repeat(20),
  };
  for (const [shape, schema] of [
    ['article', article],
    ['graph', { '@context': 'https://schema.org', '@graph': [article] }],
    ['array', [article]],
  ] as const) {
    for (const title of ['', '<title>Document title</title>']) {
      test(`keeps ${shape} metadata for an empty document ${title ? 'with' : 'without'} a title element`, async () => {
        const html = `<html><head>${title}<script type="application/ld+json">${JSON.stringify(schema)}</script></head><body></body></html>`;
        const input = createContext(html);
        const original = structuredClone(input);

        const result = await new CleanHtmlToMarkdownDefuddle().invoke(Object.freeze(input));

        assert.deepEqual(input, original);
        assert.notEqual(result, input);
        assert.deepEqual(result, { ...original, markdown: '', title: 'Empty schema headline' });
      });
    }
  }

  for (const [text, markdown] of [
    ['Contact <alice@example.com> for help.', 'Contact \\<alice@example.com\\> for help.'],
    ['Use List<T> in this example.', 'Use List\\<T\\> in this example.'],
    ['Use List<T\nclass="example"> in this example.', 'Use List\\<T\nclass="example"\\> in this example.'],
    ['Use List<T\r\nclass="example"> in this example.', 'Use List\\<T\r\nclass="example"\\> in this example.'],
    ['See <https://example.com> for details.', 'See \\<https://example.com\\> for details.'],
    ['Rock & roll &amp; literal.', 'Rock & roll \\&amp; literal.'],
    ['# Literal heading', '\\# Literal heading'],
    ['- Literal list item', '\\- Literal list item'],
    ['1. Literal list item', '1\\. Literal list item'],
    ['>quoted text', '\\>quoted text'],
    ['`literal` \\ path', '\\`literal\\` \\\\ path'],
  ]) {
    test(`keeps plain text tokens: ${text}`, async () => {
      const input = createContext(text);
      const original = structuredClone(input);

      const result = await new CleanHtmlToMarkdownDefuddle().invoke(Object.freeze(input));

      assert.deepEqual(input, original);
      assert.deepEqual(result, { ...original, markdown, title: '' });
    });
  }

  for (const [html, markdown] of [
    ['<!-- Removed comment -->', ''],
    ['<script>Removed script</script>', ''],
    ['<p>Visible paragraph.</p>', 'Visible paragraph.'],
    ['<custom-element>Visible custom element.</custom-element>', 'Visible custom element.'],
    ['<unknown>Visible unknown element.</unknown>', 'Visible unknown element.'],
  ]) {
    test(`processes markup as HTML: ${html}`, async () => {
      const result = await new CleanHtmlToMarkdownDefuddle().invoke(createContext(html));

      assert.equal(result.markdown, markdown);
      assert.equal(result.html, html);
    });
  }

  for (const [name, html, originalCode, dedentedCode] of [
    [
      'pre fragment',
      '<pre><code>    first();\n    second();</code></pre>',
      '    first();\n    second();',
      'first();\nsecond();',
    ],
    [
      'body wrapper',
      '<body><pre><code>    first();\n    second();</code></pre></body>',
      '    first();\n    second();',
      'first();\nsecond();',
    ],
    [
      'styled code',
      '<code style="white-space: pre-wrap">    first();\n    second();</code>',
      '    first();\n    second();',
      'first();\nsecond();',
    ],
    [
      'nested indentation',
      '<pre><code>    if (ready) {\n        first();\n    }\n    second();</code></pre>',
      '    if (ready) {\n        first();\n    }\n    second();',
      'if (ready) {\n    first();\n}\nsecond();',
    ],
    [
      'tab indentation',
      '<pre><code>\tif (ready) {\n\t\tfirst();\n\t}\n\tsecond();</code></pre>',
      '\tif (ready) {\n\t\tfirst();\n\t}\n\tsecond();',
      'if (ready) {\n\tfirst();\n}\nsecond();',
    ],
    [
      'decreasing indentation',
      '<pre>        run()\n    stop()</pre>',
      '        run()\n    stop()',
      '    run()\nstop()',
    ],
    [
      'bare pre body wrapper',
      '<body><pre>    first()\n    second()</pre></body>',
      '    first()\n    second()',
      'first()\nsecond()',
    ],
  ]) {
    test(`keeps relative indentation in ${name}`, async () => {
      const input = createContext(html);
      const original = structuredClone(input);

      const result = await new CleanHtmlToMarkdownDefuddle().invoke(Object.freeze(input));

      const fence = result.markdown?.match(/^```[^\n]*\n([\s\S]*?)\n```$/);
      assert.ok(fence, 'Code must use a fenced block');
      assert.ok(
        fence[1] === originalCode || fence[1] === dedentedCode,
        `Code lines must keep their relative indentation: ${JSON.stringify(fence[1])}`,
      );
      assert.deepEqual(input, original);
      assert.deepEqual(result, { ...original, markdown: result.markdown, title: '' });
    });
  }

  test('uses a longer fence when code starts with backticks', async () => {
    const html = '<pre>```\nexample</pre>';

    const result = await new CleanHtmlToMarkdownDefuddle().invoke(createContext(html));

    assert.equal(result.markdown, '````\n```\nexample\n````');
    assert.equal(result.html, html);
  });

  for (const [html, markdown] of [
    ['<blockquote><pre><code>    first();\n      second();</code></pre></blockquote>', '> ```\n>     first();\n>       second();\n> ```'],
    ['<ul><li>Item<pre><code>    first();\n      second();</code></pre></li></ul>', '- Item\n\t```\n\t    first();\n\t      second();\n\t```'],
  ]) {
    test(`keeps code indentation in its container: ${html}`, async () => {
      const result = await new CleanHtmlToMarkdownDefuddle().invoke(createContext(html));

      assert.equal(result.markdown, markdown);
      assert.equal(result.html, html);
    });
  }
});
