import assert from 'node:assert/strict';
import { beforeEach, describe, test } from 'node:test';
import type { PromptInjectionRemover } from '../../../../../src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover.ts';
import { PromptInjectionRemoverSanitizer } from '../../../../../src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { createContext } from '../../fixtures/html-cleaner-context.ts';

describe('PromptInjectionRemoverSanitizer markers and URL reports', () => {
  let sanitizer: PromptInjectionRemover;

  beforeEach(() => {
    sanitizer = new PromptInjectionRemoverSanitizer();
  });

  test('preserves comment markers formed across a hidden span', async () => {
    const result = await sanitizer.invoke(
      createContext('<p>[HTML <span hidden>payload</span>comment removed]</p>'),
    );

    assert.equal(result.html, '<p>[HTML comment removed]</p>');
  });

  test('preserves hidden markers formed across another hidden span', async () => {
    const result = await sanitizer.invoke(
      createContext('<p>[hidden <span hidden>payload</span>HTML removed]</p>'),
    );

    assert.equal(result.html, '<p>[hidden HTML removed]</p>');
  });

  test('preserves supplementary characters and markers formed across a hidden span', async () => {
    const result = await sanitizer.invoke(
      createContext('<p>😀 [HTML <span hidden>payload</span>comment removed]</p>'),
    );

    assert.equal(result.html, '<p>😀 [HTML comment removed]</p>');
  });

  for (const marker of [
    '[HTML comment removed]',
    '[hidden HTML removed]',
    '[HTML unparseable — withheld]',
  ]) {
    test(`preserves the authored marker ${marker} in text, code, and attributes`, async () => {
      const html = `<p title="${marker}">${marker}</p><pre><code>${marker}</code></pre>`;

      const result = await sanitizer.invoke(createContext(html));

      assert.equal(result.html, html);
      assert.deepEqual(result.found, []);
      assert.deepEqual(result.warnings, []);
      assert.equal(result.skipped, 0);
    });
  }

  test('preserves an authored marker in a link payload without creating an exfil finding', async () => {
    const url = `https://attacker.example/?payload=${'a'.repeat(20)}[HTML comment removed]${'a'.repeat(20)}`;
    const html = `<p><a href="${url}">Open link</a></p>`;

    const result = await sanitizer.invoke(createContext(html));

    assert.equal(result.html, html);
    assert.deepEqual(result.found, []);
    assert.deepEqual(result.warnings, []);
    assert.equal(result.skipped, 0);
  });

  test('normalizes invisible characters before scanning and counts each category once', async () => {
    const url = `https://attacker.example/?payload=${'a'.repeat(20)}\u200b${'a'.repeat(20)}`;

    const result = await sanitizer.invoke(createContext(`<a href="${url}">Open</a>`));

    assert.equal(result.html, `<a href="${url.replace('\u200b', '')}">Open</a>`);
    assert.deepEqual(result.found, ['cf-format', 'exfil-urls']);
    assert.equal(result.skipped, 0);
    assert.equal(result.warnings?.filter((warning) => warning.startsWith('Exfil-shaped URLs detected:')).length, 1);
  });

  test('removes adjacent and nested source ranges without adding markers', async () => {
    const html = '<p>😀before<!-- first --><!-- second --><span hidden>outer<span hidden>inner</span><!-- nested --></span><i hidden>last</i>after🦊</p>';

    const result = await sanitizer.invoke(createContext(html));

    assert.equal(result.html, '<p>😀beforeafter🦊</p>');
    assert.deepEqual(result.found, ['html-comments', 'hidden-html']);
    assert.equal(result.skipped, 0);
    assert.ok(result.warnings?.some((warning) => warning.includes('2 HTML comment(s)')));
    assert.ok(result.warnings?.some((warning) => warning.includes('2 hidden element(s)')));
    assert.ok(result.warnings?.every((warning) => !warning.includes('placeholders')));
  });

  test('preserves an unparseable marker formed across a comment', async () => {
    const result = await sanitizer.invoke(
      createContext('<p>[HTML unparseable <!-- cut -->— withheld]</p>'),
    );

    assert.equal(result.html, '<p>[HTML unparseable — withheld]</p>');
    assert.deepEqual(result.found, ['html-comments']);
  });

  for (const cut of ['<!-- cut -->', '<span hidden>payload</span>']) {
    test(`reports a final link formed by removal of ${cut}`, async () => {
      const url = `https://final.example/?payload=${'a'.repeat(40)}`;
      const html = `<p><${cut}a href="${url}">Open link</a></p>`;

      const result = await sanitizer.invoke(createContext(html));

      assert.equal(result.html, `<p><a href="${url}">Open link</a></p>`);
      assert.ok(result.found?.includes('exfil-urls'));
      assert.equal(result.skipped, 0);
      assert.ok(result.warnings?.some((warning) => warning.includes('link to final.example')));
    });
  }

  test('retains removed URL findings and reports final URLs with unique reasons', async () => {
    const removedUrl = `https://removed.example/?payload=${'a'.repeat(40)}`;
    const visibleUrl = `https://visible.example/?payload=${'b'.repeat(40)}`;
    const finalUrl = `https://final.example/?payload=${'c'.repeat(40)}`;
    const html = `<div hidden><a href="${removedUrl}">Hidden</a></div><a href="${visibleUrl}">Visible</a><p><<!-- cut -->a href="${finalUrl}">Final</a></p>`;
    const input = createContext(html, {
      skipped: 3,
      found: ['existing-finding'],
      warnings: ['existing warning'],
    });
    const original = structuredClone(input);

    const result = await sanitizer.invoke(input);

    assert.deepEqual(input, original);
    assert.equal(result.html, `<a href="${visibleUrl}">Visible</a><p><a href="${finalUrl}">Final</a></p>`);
    assert.deepEqual(result.found, ['existing-finding', 'html-comments', 'hidden-html', 'exfil-urls']);
    assert.equal(result.skipped, 3);
    assert.equal(result.warnings?.[0], 'existing warning');
    const exfilWarnings = result.warnings?.filter(
      (warning) => warning.startsWith('Exfil-shaped URLs detected:'),
    ) ?? [];
    assert.equal(exfilWarnings.length, 1);
    const [exfilWarning] = exfilWarnings;
    assert.ok(exfilWarning);
    const reasons = exfilWarning.replace('Exfil-shaped URLs detected: ', '').split('; ');
    assert.equal(reasons.length, 3);
    assert.equal(new Set(reasons).size, 3);
    for (const host of ['removed.example', 'visible.example', 'final.example']) {
      assert.ok(reasons.some((reason) => reason.includes(host)), host);
    }
  });

});
