import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Ctx } from '../../../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { processHtml } from '../../../../support/in-process/process-html.ts';

const formatWarning = 'Stripped: Format chars (Cf) — inspect the removed bytes with a hex dump (xxd / od -c), which survives sanitization';
const encodings = (codePoint: number) => [
  ['literal', String.fromCodePoint(codePoint)],
  ['decimal', `&#${codePoint};`],
  ['hexadecimal', `&#x${codePoint.toString(16)};`],
] as const;

function documentHtml(body: string): string {
  return `<html><head><title>Safe title</title></head><body><main>${body}</main></body></html>`;
}

function assertControlFinding(result: Ctx): void {
  assert.equal(result.skipped, 0);
  assert.deepEqual(result.found, ['cf-format']);
  assert.deepEqual(result.warnings, [formatWarning]);
}

describe('Controls around entity decoding boundaries', () => {
  test('preserves strong text after an ANSI color sequence in every encoding', async () => {
    const sequences = [
      ['literal', '\u001b[31m'],
      ['decimal', '&#27;[31m'],
      ['hexadecimal', '&#x1b;[31m'],
    ] as const;
    const results: Ctx[] = [];

    for (const [, sequence] of sequences) {
      const result = await processHtml(documentHtml(
        `<p>${sequence}<strong>main</strong></p>`,
      ));

      results.push(result);
    }

    assert.deepEqual(results.map(({ markdown }) => markdown), [
      '**main**',
      '**main**',
      '**main**',
    ]);
    const reports = results.map(({ found, warnings, skipped }) => ({
      found,
      warnings,
      skipped,
    }));
    assert.deepEqual(reports[1], reports[0]);
    assert.deepEqual(reports[2], reports[0]);
  });

  test('does not attach an OSC-only link to the same visible text that follows it', async () => {
    const result = await processHtml(documentHtml(
      '<p><a href="/unexpected">&#27;]0;hello&#7;</a>hello</p>',
    ));

    assert.equal(result.markdown, 'hello');
    assert.doesNotMatch(result.markdown ?? '', /\]\(/);
  });

  const bodyControls = [0x200b, 0x200d, 0x200e, 0x200f, 0xfeff];

  for (const codePoint of bodyControls) {
    for (const [encoding, value] of encodings(codePoint)) {
      test(`detects body-only U+${codePoint.toString(16)} in ${encoding} form`, async () => {
        const result = await processHtml(documentHtml(`<p>left${value}right.</p>`));

        assert.equal(result.markdown, 'leftright.');
        assert.equal(result.title, 'Safe title');
        assertControlFinding(result);
      });
    }
  }

  const urlControls = [0x202e, 0x202c, 0x2066, 0x2069];

  for (const codePoint of urlControls) {
    for (const [encoding, value] of encodings(codePoint)) {
      test(`removes U+${codePoint.toString(16)} from link and image destinations in ${encoding} form`, async () => {
        const result = await processHtml(documentHtml(
          `<p><a href="/left${value}right">link</a></p><p><img src="/left${value}right" alt="image"></p>`,
        ));

        assert.equal(result.markdown, '[link](https://example.com/leftright)\n\n![image](https://example.com/leftright)');
        assert.equal(result.title, 'Safe title');
        assertControlFinding(result);
      });
    }
  }

  test('keeps escaped control examples and normal entities in attributes', async () => {
    const result = await processHtml(documentHtml(
      '<p><a href="/docs" title="&amp;#x202e; &amp;#8238; &amp; &copy; &#x1F600; &amp;amp;#x202e; &#xZZ;">link</a></p>'
      + '<p><img src="/image.png" alt="&amp;#x202e; &amp;#8238; &amp; &copy; &#x1F469;&#x200D;&#x1F4BB; &amp;amp;#x8238; &#xZZ;" title="&amp;#8238; &amp; &copy; &#128512;"></p>',
    ));

    assert.equal(result.markdown, '[link](https://example.com/docs "&#x202e; &#8238; & © 😀 &amp;#x202e; &#xZZ;")\n\n![&#x202e; &#8238; & © 👩‍💻 &amp;#x8238; &#xZZ;](https://example.com/image.png "&#8238; & © 😀")');
    assert.equal(result.title, 'Safe title');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
  });

  test('reports a BOM at the start of a decoded text node', async () => {
    const result = await processHtml(documentHtml('<p>&#xfeff;Visible content.</p>'));

    assert.equal(result.markdown, 'Visible content.');
    assertControlFinding(result);
  });

  test('keeps query separators and escaped entity text in destinations', async () => {
    const result = await processHtml(documentHtml(
      '<p><a href="/docs?one=1&amp;copy=2&amp;amp;literal=3">link</a></p>'
      + '<p><img src="/image.png?one=1&amp;copy=2&amp;amp;literal=3" alt="&amp;quot;example&amp;quot;"></p>',
    ));

    assert.equal(result.markdown, '[link](https://example.com/docs?one=1&copy=2&amp;literal=3)\n\n![&quot;example&quot;](https://example.com/image.png?one=1&copy=2&amp;literal=3)');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
  });

  test('keeps escaped entity and HTML examples in a metadata title', async () => {
    const result = await processHtml(
      '<html><head><meta property="og:title" content="Example: &amp;#8238; &amp;#x202e; &amp;lt;span&amp;gt;"></head>'
      + '<body><p>Visible content.</p></body></html>',
    );

    assert.equal(result.title, 'Example: &#8238; &#x202e; &lt;span&gt;');
    assert.equal(result.markdown, 'Visible content.');
    assert.equal(result.skipped, 0);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
  });

  test('removes and reports encoded controls in a metadata title', async () => {
    const result = await processHtml(
      '<html><head><meta property="og:title" content="left&#x202e;right&#8203;"></head>'
      + '<body><p>Visible content.</p></body></html>',
    );

    assert.equal(result.title, 'leftright');
    assert.equal(result.markdown, 'Visible content.');
    assertControlFinding(result);
  });

  test('keeps entity-encoded tag names visible in body text for each control encoding', async () => {
    for (const [, value] of encodings(0x202e)) {
      const result = await processHtml(documentHtml(
        `<p>Example: &lt;sp${value}an hidden&gt;Visible content&lt;/sp${value}an&gt;</p>`,
      ));

      assert.equal(result.markdown, 'Example: \\<span hidden>Visible content\\</span>');
      assert.equal(result.title, 'Safe title');
      assertControlFinding(result);
    }
  });

  test('uses a longer fence when escaped code contains a backtick and a control', async () => {
    const outputs: string[] = [];

    for (const [, value] of encodings(0x202e)) {
      const result = await processHtml(documentHtml(
        `<pre><code>before\n\`${value}\`\`\n&lt;span hidden&gt;Visible content&lt;/span&gt;\nafter</code></pre>`,
      ));

      outputs.push(result.markdown ?? '');
      assert.equal(result.title, 'Safe title');
      assertControlFinding(result);
    }

    assert.deepEqual(outputs, [
      '````\nbefore\n```\n<span hidden>Visible content</span>\nafter\n````',
      '````\nbefore\n```\n<span hidden>Visible content</span>\nafter\n````',
      '````\nbefore\n```\n<span hidden>Visible content</span>\nafter\n````',
    ]);
  });
});
