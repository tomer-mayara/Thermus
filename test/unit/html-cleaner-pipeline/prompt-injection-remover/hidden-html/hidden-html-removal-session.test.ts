import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { HiddenHtmlRemovalSession } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/hidden-html-removal-session.ts';
import { HiddenHtmlScanner } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/hidden-html-scanner.ts';
import { CssSelectorLimitError } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-selectors.ts';
import { PromptInjectionRemoverSanitizer } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { createContext } from '../../fixtures/html-cleaner-context.ts';

const threatUrl = `https://attacker.example/?payload=${'a'.repeat(128)}`;

function hiddenAfterPasses(passes: number): string {
  let html = '<span hidden>secret</span>';
  for (let pass = 1; pass < passes; pass++) html = `<${html}span hidden>secret</span>`;
  return html;
}

describe('hidden HTML removal session', () => {
  test('removes formed hidden markup and clears visible styles after the clean scan', () => {
    const result = new HiddenHtmlRemovalSession('<style>.payload{display:none}</style>'
      + '<p class="payload" style="display:block!important;display:none">visible</p>'
      + '<<span hidden>cut</span>p class="payload">secret</p><!-- cut -->').run();

    assert.equal(result.html, '<style>.payload{display:none}</style><p class="payload" style="">visible</p>');
    assert.deepEqual(result.removed, { comments: 1, hidden: 2 });
    assert.deepEqual(result.visibleStyleValues, ['display:block!important;display:none']);
    assert.equal(result.withholdWarning, undefined);
  });

  for (const passes of [7, 8]) {
    test(`bounds removal with ${passes} removal passes`, () => {
      const result = new HiddenHtmlRemovalSession(`<p>${hiddenAfterPasses(passes)}</p>`).run();

      assert.equal(result.html, passes === 7 ? '<p></p>' : '');
      assert.equal(result.removed.hidden, passes);
      assert.equal(result.withholdWarning, passes === 7 ? undefined
        : 'HTML scan limit reached; remaining HTML withheld');
    });
  }

  test('keeps earlier counts and parsed URL reports when a later scan fails', (t) => {
    const scan = HiddenHtmlScanner.scan;
    let scans = 0;
    t.mock.method(HiddenHtmlScanner, 'scan', (...args: Parameters<typeof scan>) => {
      if (++scans === 2) throw new Error('parse failed');
      return scan(...args);
    });
    const result = new HiddenHtmlRemovalSession(
      `<template><span hidden><a href="${threatUrl}">secret</a></span></template><p>visible</p><script>code</script>`,
    ).run();

    assert.equal(result.html, '');
    assert.deepEqual(result.removed, { comments: 0, hidden: 1 });
    assert.deepEqual(result.warned.tags, { script: 1 });
    assert.equal(result.exfilReasons.size, 1);
    assert.match([...result.exfilReasons][0] ?? '', /link to attacker\.example/);
    assert.deepEqual(result.visibleStyleValues, []);
    assert.equal(result.withholdWarning, 'HTML scan failed; remaining HTML withheld');
  });

  test('records raw URL findings before a failed scan', (t) => {
    t.mock.method(HiddenHtmlScanner, 'scan', () => { throw new Error('parse failed'); });
    const result = new HiddenHtmlRemovalSession(`<a href="${threatUrl}">open</a>`).run();

    assert.equal(result.exfilReasons.size, 1);
    assert.equal(result.html, '');
    assert.deepEqual(result.removed, { comments: 0, hidden: 0 });
  });

  test('propagates the selector limit error', (t) => {
    const error = new CssSelectorLimitError('work');
    t.mock.method(HiddenHtmlScanner, 'scan', () => { throw error; });

    assert.throws(() => new HiddenHtmlRemovalSession('<p>visible</p>').run(), (caught) => caught === error);
  });

  test('uses warning maxima and retains first-seen reasons across overlapping removals', (t) => {
    let scans = 0;
    t.mock.method(HiddenHtmlScanner, 'scan', () => {
      const first = ++scans === 1;
      return {
        ranges: first ? [{ start: 2, end: 4 }, { start: 1, end: 3 }] : [],
        removed: { comments: first ? 1 : 0, hidden: first ? 1 : 0 },
        warned: { tags: first ? { script: 2, template: 1 } : { script: 1, template: 3 }, dataSrc: first ? 2 : 1 },
        urlSource: `<a href="https://${first ? 'first' : 'second'}.example/?payload=${'a'.repeat(128)}">open</a>`,
        visibleStyles: first ? [] : [{ start: 1, end: 2 }],
        visibleStyleValues: first ? ['discarded'] : ['retained'],
        textRuns: [],
      };
    });
    const result = new HiddenHtmlRemovalSession('abcdef').run();

    assert.equal(result.html, 'astyle=""f');
    assert.deepEqual(result.warned, { tags: { script: 2, template: 3 }, dataSrc: 2 });
    assert.deepEqual(result.removed, { comments: 1, hidden: 1 });
    assert.deepEqual(result.visibleStyleValues, ['retained']);
    assert.match([...result.exfilReasons][0] ?? '', /first\.example/);
    assert.match([...result.exfilReasons][1] ?? '', /second\.example/);
  });

  test('isolates repeated and concurrent calls on one sanitizer', async () => {
    const firstContext = createContext('<style>.x{display:none}</style><p class="x" style="display:block!important">visible</p>'
      + '<<span hidden>cut</span>p class="x">secret</p>', { removed: 4, warnings: ['first'] });
    const contexts = [
      firstContext,
      createContext('<p><b hidden>secret<p>secret</b>visible\u200b</p><script>code</script>',
        { found: ['existing'], skipped: 2 }),
      createContext(`<template><a href="${threatUrl}">open</a></template><p style="color:red&#x200b;">visible</p>`),
    ];
    const isolated = await Promise.all(contexts.map((ctx) => new PromptInjectionRemoverSanitizer().invoke(ctx)));
    const sanitizer = new PromptInjectionRemoverSanitizer();

    for (const [index, ctx] of contexts.entries()) assert.deepEqual(await sanitizer.invoke(ctx), isolated[index]);
    assert.deepEqual(await Promise.all(contexts.map((ctx) => sanitizer.invoke(ctx))), isolated);
    assert.deepEqual(await sanitizer.invoke(firstContext), isolated[0]);
  });
});
