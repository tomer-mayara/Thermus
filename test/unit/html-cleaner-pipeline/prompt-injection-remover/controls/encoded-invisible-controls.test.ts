import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { CleanHtmlToMarkdownDefuddle } from '../../../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import type { HtmlProcessingContext } from '../../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { processHtml } from '../../../../support/in-process/process-html.ts';

const formatWarning = 'Stripped: Format chars (Cf) — inspect the removed bytes with a hex dump (xxd / od -c), which survives sanitization';
const controls = [0x202e, 0x202c, 0x2066, 0x2069];

function documentHtml(body: string, title = 'Safe title'): string {
  return `<html><head><title>${title}</title></head><body><main>${body}</main></body></html>`;
}

describe('Invisible controls after HTML entity decoding', () => {
  for (const codePoint of controls) {
    const encodings = {
      literal: String.fromCodePoint(codePoint),
      decimal: `&#${codePoint};`,
      hexadecimal: `&#x${codePoint.toString(16)};`,
      decimalWithoutSemicolon: `&#${codePoint}`,
      hexadecimalWithoutSemicolon: `&#x${codePoint.toString(16)}`,
    };

    for (const [encoding, control] of Object.entries(encodings)) {
      test(`removes U+${codePoint.toString(16)} in ${encoding} form from body and title`, async () => {
        const result = await processHtml(documentHtml(`<p>left${control}right.</p>`, `left${control}right`));

        assert.equal(result.markdown, 'leftright.');
        assert.equal(result.title, 'leftright');
        assert.equal(result.removed, 0);
        assert.equal(result.skipped, 0);
        assert.deepEqual(result.found, ['cf-format']);
        assert.deepEqual(result.warnings, [formatWarning]);
      });
    }

    test(`reports U+${codePoint.toString(16)} when only the title has a numeric entity`, async () => {
      const result = await processHtml(documentHtml('<p>Visible paragraph.</p>', `left&#${codePoint};right`));

      assert.equal(result.markdown, 'Visible paragraph.');
      assert.equal(result.title, 'leftright');
      assert.equal(result.skipped, 0);
      assert.deepEqual(result.found, ['cf-format']);
      assert.deepEqual(result.warnings, [formatWarning]);
    });
  }

  test('counts a mixed literal and encoded category once across all stages and outputs', async () => {
    const result = await processHtml(documentHtml(
      '<p>left\u202e&#8236;&#x2066;right&#8297;.</p>',
      'left&#x202e;\u202c&#8294;right&#x2069;',
    ));

    assert.equal(result.markdown, 'leftright.');
    assert.equal(result.title, 'leftright');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, ['cf-format']);
    assert.deepEqual(result.warnings, [formatWarning]);
  });

  test('cleans link labels, image text, and link titles after conversion', async () => {
    const result = await processHtml(documentHtml(
      '<p><a href="/docs" title="left&#x202e;right">left&#8236;right</a></p>'
      + '<p><img src="/image.png" alt="left&#8294;right" title="left&#x2069;right"></p>',
    ));

    assert.equal(result.markdown, '[leftright](https://example.com/docs "leftright")\n\n![leftright](https://example.com/image.png "leftright")');
    assert.equal(result.title, 'Safe title');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, ['cf-format']);
    assert.deepEqual(result.warnings, [formatWarning]);
  });

  test('keeps ordinary entities and supplementary characters', async () => {
    const result = await processHtml(documentHtml(
      '<p>Text &amp; &copy; &#x1F600;.</p>',
      'Title &amp; &copy; &#128512; &#x1F469;&#x200D;&#x1F4BB;',
    ));

    assert.equal(result.markdown, 'Text & © 😀.');
    assert.equal(result.title, 'Title & © 😀 👩‍💻');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
  });

  test('keeps escaped numeric examples in prose, code, and title without another decode', async () => {
    const result = await processHtml(documentHtml(
      '<p>Example: &amp;#8238; and &amp;#x202E;.</p><pre><code>&amp;#8238; &amp;#x202E;</code></pre>',
      '&amp;#8238; &amp;#x202E;',
    ));

    assert.equal(result.markdown, 'Example: &#8238; and &#x202E;.\n\n```\n&#8238; &#x202E;\n```');
    assert.equal(result.title, '&#8238; &#x202E;');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
  });

  test('keeps the parser behavior for malformed entities and invalid code points', async () => {
    const result = await processHtml(documentHtml(
      '<p>Invalid: &#xZZ; &#; &#x110000; &#xD800; &unknown;.</p>',
      'Invalid: &#xZZ; &#; &#x110000; &#xD800; &unknown;',
    ));

    assert.equal(result.markdown, 'Invalid: &#xZZ; &#; � � &unknown;.');
    assert.equal(result.title, 'Invalid: &#xZZ; &#; � � &unknown;');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
  });

  test('keeps escaped HTML code and repeated entity escapes as visible text', async () => {
    const result = await processHtml(documentHtml(
      '<p><code>&lt;span hidden&gt;Example&lt;/span&gt;</code></p><p>&amp;amp;#x202E;</p>',
      '&amp;amp;#x202E;',
    ));

    assert.equal(result.markdown, '`<span hidden>Example</span>`\n\n&amp;#x202E;');
    assert.equal(result.title, '&amp;#x202E;');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
  });

  test('preserves prior findings, warnings, counts, and input without mutation', async () => {
    const input: HtmlProcessingContext = {
      requestedUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      html: documentHtml('<p>left&#8238;right.</p>', 'left&#x2069;right'),
      removed: 2,
      skipped: 3,
      found: Object.freeze(['existing-finding']),
      warnings: Object.freeze(['existing warning']),
      markdown: 'Old markdown',
      title: 'Old title',
    };
    const original = { ...input };

    const result = await new CleanHtmlToMarkdownDefuddle().invoke(input);

    assert.deepEqual(input, original);
    assert.notEqual(result, input);
    assert.equal(result.html, input.html);
    assert.equal(result.requestedUrl, input.requestedUrl);
    assert.equal(result.finalUrl, input.finalUrl);
    assert.equal(result.markdown, 'leftright.');
    assert.equal(result.title, 'leftright');
    assert.equal(result.removed, 2);
    assert.equal(result.skipped, 3);
    assert.deepEqual(result.found, ['existing-finding', 'cf-format']);
    assert.deepEqual(result.warnings, ['existing warning', formatWarning]);
  });

  const documentsWithoutTitles = [
    ['a visible body', '<html><body><p>Visible paragraph.</p></body></html>', 'Visible paragraph.'],
    ['an empty body', '<html><body></body></html>', ''],
  ] as const;

  for (const [name, html, markdown] of documentsWithoutTitles) {
    test(`returns an empty title for ${name} and preserves prior reports`, async () => {
      const input: HtmlProcessingContext = {
        requestedUrl: 'https://example.com/',
        finalUrl: 'https://example.com/',
        html,
        removed: 2,
        skipped: 3,
        found: Object.freeze(['existing-finding']),
        warnings: Object.freeze(['existing warning']),
      };
      const original = { ...input };

      const result = await new CleanHtmlToMarkdownDefuddle().invoke(input);

      assert.equal(result.markdown, markdown);
      assert.equal(result.title, '');
      assert.equal(result.removed, 2);
      assert.equal(result.skipped, 3);
      assert.deepEqual(result.found, ['existing-finding']);
      assert.deepEqual(result.warnings, ['existing warning']);
      assert.deepEqual(input, original);
    });
  }
});
