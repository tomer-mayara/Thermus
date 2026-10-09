import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import type { Ctx } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';

const threatUrl = `https://attacker.example/?payload=${'a'.repeat(128)}`;
const scanLimitWarning = 'HTML scan limit reached; remaining HTML withheld';

function createContext(html: string, overrides: Partial<Ctx> = {}): Ctx {
  return { url: 'https://example.com/', html, removed: 0, skipped: 0, ...overrides };
}

function hiddenAfterPasses(removalPasses: number): string {
  let html = '<span hidden>secret</span>';
  for (let pass = 1; pass < removalPasses; pass++) {
    html = `<${html}span hidden>secret</span>`;
  }
  return html;
}

describe('hidden HTML removal passes', () => {
  test('removes a hidden element formed by an earlier removal', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext('<p><<span hidden>cut</span>span hidden>secret</span></p>'),
    );

    assert.equal(result.html, '<p></p>');
  });

  test('removes a comment formed by an earlier removal', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext('<p><<!-- cut -->!-- secret --></p>'),
    );

    assert.equal(result.html, '<p></p>');
  });

  test('removes successive hidden elements formed over three removal passes', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext(`<p>${hiddenAfterPasses(3)}</p>`),
    );

    assert.equal(result.html, '<p></p>');
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 1);
  });

  test('keeps a threat warning for a URL formed before a later removal', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext(
        `<p><<span hidden>cut</span>span hidden><<span hidden>cut</span>a href="${threatUrl}">Open</a></span></p>`,
      ),
    );

    assert.equal(result.html, '<p></p>');
    assert.deepEqual([...result.found ?? []].sort(), ['exfil-urls', 'hidden-html']);
    assert.equal(result.skipped, 2);
    assert.match(result.warnings?.join('\n') ?? '', /link to attacker\.example: suspicious query parameter/);
  });

  test('preserves authored markers, supplementary characters, and visible flagged URLs', async () => {
    const markers = '[HTML comment removed] [hidden HTML removed] [HTML unparseable — withheld]';
    const visible = `<p>😀 ${markers} <a href="${threatUrl}">Open</a> 𐐀 text</p>`;
    const input = createContext(
      `${visible.replace('text', 'te\u200bxt')}<p>${hiddenAfterPasses(3)}</p><p><<!-- cut -->!-- secret --></p>`,
      {
        found: ['existing-finding'],
        warnings: ['existing warning'],
        skipped: 4,
        removed: 2,
        markdown: 'Existing markdown',
        title: 'Existing title',
      },
    );
    const original = { ...input };

    const result = await new PromptInjectionRemoverSanitizer().invoke(input);

    assert.equal(result.html, `${visible}<p></p><p></p>`);
    assert.deepEqual(input, original);
    assert.equal(result.url, input.url);
    assert.equal(result.markdown, input.markdown);
    assert.equal(result.title, input.title);
    assert.equal(result.removed, 2);
    assert.equal(result.skipped, 8);
    assert.equal(result.found?.[0], 'existing-finding');
    assert.deepEqual([...result.found ?? []].slice(1).sort(), [
      'cf-format', 'exfil-urls', 'hidden-html', 'html-comments',
    ]);
    assert.equal(result.warnings?.[0], 'existing warning');
    const warnings = result.warnings?.join('\n') ?? '';
    assert.equal(warnings.match(/link to attacker\.example: suspicious query parameter/g)?.length, 1);
    assert.equal(new Set(result.warnings).size, result.warnings?.length);
  });

  test('accepts seven removal passes followed by a clean eighth scan', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext(`<p>${hiddenAfterPasses(7)}</p>`),
    );

    assert.equal(result.html, '<p></p>');
    assert.equal(result.warnings?.includes(scanLimitWarning), false);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 1);
  });

  test('withholds HTML when the eighth scan still removes content', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext(`<p>${hiddenAfterPasses(8)}</p>`),
    );

    assert.equal(result.html, '');
    assert.equal(result.warnings?.filter((warning) => warning === scanLimitWarning).length, 1);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 1);
  });

  test('withholds an unchecked remainder and keeps threat reports at the scan limit', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext(
        `<div hidden><a href="${threatUrl}">Hidden link</a></div><p>${hiddenAfterPasses(64)}</p>`,
      ),
    );

    assert.equal(result.html, '');
    assert.equal(result.warnings?.filter((warning) => warning === scanLimitWarning).length, 1);
    assert.deepEqual([...result.found ?? []].sort(), ['exfil-urls', 'hidden-html']);
    assert.equal(result.skipped, 2);
    const warnings = result.warnings?.join('\n') ?? '';
    assert.equal(warnings.match(/link to attacker\.example: suspicious query parameter/g)?.length, 1);
  });
});
