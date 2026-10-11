import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { createContext } from '../support/html-cleaner-context.ts';

const formatWarning = 'Stripped: Format chars (Cf) — inspect the removed bytes with a hex dump (xxd / od -c), which survives sanitization';
const emoji = '👩<span>\u200d</span>💻';

test('keeps the exact source and prior context when inline HTML splits a valid literal emoji', async () => {
  const html = `<!doctype html>\r\n<MAIN data-note='&amp; &#65533;'> <p>${emoji} &amp; &#x1F600; �</p></MAIN>`;
  const input = createContext(html, {
    removed: 2, skipped: 3, found: Object.freeze(['existing']),
    warnings: Object.freeze(['Existing warning']), markdown: 'Previous', title: 'Previous title',
  });
  const original = structuredClone(input);
  Object.freeze(input);

  const result = await new PromptInjectionRemoverSanitizer().invoke(input);

  assert.equal(result.html, html);
  assert.deepEqual(result.found, ['existing']);
  assert.deepEqual(result.warnings, ['Existing warning']);
  assert.equal(result.removed, 2);
  assert.equal(result.skipped, 3);
  assert.equal(result.markdown, input.markdown);
  assert.equal(result.title, input.title);
  assert.deepEqual(input, original);
});

for (const [name, body, expected] of [
  ['literal and encoded replacement characters', `�&#65533;${emoji}&#xFFFD;�`, `�&#65533;${emoji}&#xFFFD;�`],
  ['entity-decoded emoji neighbors', '&#128105;<span>\u200d</span>&#x1F4BB;', '&#128105;<span>\u200d</span>&#x1F4BB;'],
  ['ANSI before the joiner', `\u001b[31m${emoji}`, emoji],
  ['ANSI inside a joiner span', '👩<span>\u001b[31m\u200d</span>💻', emoji],
] as const) {
  test(`keeps source offsets correct with ${name}`, async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(`<p>${body}</p>`));

    assert.equal(result.html, `<p>${expected}</p>`);
    assert.deepEqual(result.found, name.startsWith('ANSI') ? ['ansi'] : []);
  });
}

for (const [name, body] of [
  ['ASCII text', 'left<span>\u200d</span>right'],
  ['an isolated joiner', '<span>\u200d</span>'],
  ['a line break', '👩<br><span>\u200d</span>💻'],
  ['an image', '👩<img src="/image.png"><span>\u200d</span>💻'],
  ['a block element', '<div>👩</div><span>\u200d</span>💻'],
  ['a CSS block span', '<span style="display:block">👩</span><span>\u200d</span>💻'],
  ['a hidden neighbor', '<span hidden>👩</span><span>\u200d</span>💻'],
  ['a CSS-hidden neighbor', '<span style="display:none">👩</span><span>\u200d</span>💻'],
  ['a comment neighbor', '<!-- 👩 --><span>\u200d</span>💻'],
  ['a script neighbor', '<script>👩</script><span>\u200d</span>💻'],
  ['a style neighbor', '<style>👩</style><span>\u200d</span>💻'],
  ['a template neighbor', '<template>👩</template><span>\u200d</span>💻'],
] as const) {
  test(`does not borrow joiner context from ${name}`, async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(`<p>${body}</p>`));

    assert.doesNotMatch(result.html, /\u200d/);
    assert.ok(result.found?.includes('cf-format'));
    assert.ok(result.warnings?.includes(formatWarning));
  });
}

for (const [name, body] of [
  ['an attribute', `<span title="left\u200dright">${emoji}</span>`],
  ['a control-split hidden attribute', `<span hid\u200bden>${emoji}</span>`],
  ['hidden content', `<span hidden>${emoji}</span>`],
  ['a control-split script name', `<scr\u200bipt>${emoji}</scr\u200bipt>`],
  ['a joiner-split hidden attribute', `<span hid\u200dden>${emoji}</span>`],
  ['a joiner-split script name', `<scr\u200dipt>${emoji}</scr\u200dipt>`],
  ['bidi controls', `${emoji} left\u202eright`],
] as const) {
  test(`keeps control findings from ${name}`, async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(`<p>${body}</p>`));

    assert.ok(result.found?.includes('cf-format'));
    if (name.includes('hidden')) {
      assert.ok(result.found?.includes('hidden-html'));
      assert.doesNotMatch(result.html, /👩|💻|\u200d/);
    }
    if (name.includes('script')) assert.doesNotMatch(result.html, /\u200d|\u200b/);
    if (name === 'an attribute' || name === 'bidi controls') assert.ok(result.html.includes(emoji));
  });
}

test('keeps the original scatter gate before other raw controls are removed', async () => {
  const html = `<p>${emoji}</p><p>${'x\u200b'.repeat(30)}</p>`;
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

  assert.doesNotMatch(result.html, /\u200d|\u200b/);
  assert.deepEqual(result.found, ['cf-format']);
});

test('applies one document budget to inline joiners across separate blocks', async () => {
  const html = `<p>${'ordinary visible cover text '.repeat(30)}</p>` + `<p>${emoji}</p>`.repeat(65);
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

  assert.equal(result.html.match(/\u200d/g)?.length, 64);
  assert.deepEqual(result.found, ['cf-format']);
});

test('counts original payload controls in comments toward the scatter gate', async () => {
  const html = `<p>${emoji}</p><!-- ${'x\u200b'.repeat(30)} -->`;
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

  assert.doesNotMatch(result.html, /\u200d|\u200b/);
  assert.deepEqual(result.found, ['cf-format', 'html-comments']);
});

test('shares the document budget with permitted raw attribute joiners', async () => {
  const html = `<p data-cover="${'plain text '.repeat(100)}" title="${'👩\u200d💻 '.repeat(60)}">`
    + emoji.repeat(5) + '</p>';
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

  assert.equal(result.html.match(/\u200d/g)?.length, 64);
  assert.deepEqual(result.found, ['cf-format']);
});

test('rejects a stale permit when ANSI removal forms a hidden element', async () => {
  const html = `<p><\u001b]0;ignored\u0007span hidden>${emoji}</span>Visible</p>`;
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

  assert.equal(result.html, '<p>Visible</p>');
  assert.ok(result.found?.includes('ansi'));
  assert.ok(result.found?.includes('cf-format'));
  assert.ok(result.found?.includes('hidden-html'));
});

test('keeps the cluster cap when spans split an uninterrupted emoji chain', async () => {
  const html = `<p>👩${'<span>\u200d</span>💻'.repeat(9)}</p>`;
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

  assert.equal(result.html.match(/\u200d/g)?.length, 8);
  assert.deepEqual(result.found, ['cf-format']);
});

test('does not reset the cluster cap by masking permitted contiguous joiners', async () => {
  const html = `<p>👩${'\u200d💻'.repeat(9)}</p>`;
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

  assert.equal(result.html.match(/\u200d/g)?.length, 8);
  assert.deepEqual(result.found, ['cf-format']);
});

for (const [name, cover, joiners, selectors] of [
  ['floor', '', 8, 12],
  ['proportional', 'x'.repeat(64), 8, 12],
  ['hard cap', 'x'.repeat(1000), 64, 64],
] as const) {
  test(`shares the ${name} budget with variation selectors`, async () => {
    const body = cover + emoji + ' ' + '👩\u200d💻 '.repeat(joiners - 1) + '☀\ufe0f '.repeat(selectors);
    const html = `<p>${body}</p>`;
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));
    const expected = name === 'floor' ? 16 : name === 'proportional' ? 17 : 64;

    assert.equal(Array.from(result.html).filter((value) => value === '\u200d' || value === '\ufe0f').length, expected);
    assert.ok(result.found?.includes('variation-selectors'));
    assert.equal(result.html.match(/\u200d/g)?.length, Math.min(joiners, expected));
  });
}

test('does not add visible-text allowance for synthetic run boundaries', async () => {
  const html = `<p>${'x'.repeat(91)}${emoji}</p><p>${'☀\ufe0f '.repeat(20)}</p>`;
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

  // Authored syntax plus decoded text has 160 visible code points: allowance 20.
  assert.equal(Array.from(result.html).filter((value) => value === '\u200d' || value === '\ufe0f').length, 20);
  assert.deepEqual(result.found, ['variation-selectors']);
});

test('keeps supplementary control widths when the shared budget rejects them', async () => {
  const flag = '🏴' + Array.from('gbeng', (letter) => String.fromCodePoint(0xe0000 + letter.charCodeAt(0))).join('')
    + String.fromCodePoint(0xe007f);
  const body = 'x'.repeat(1000) + emoji + ' ' + '👩\u200d💻 '.repeat(62) + flag + '漢\u{e0100}';
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(`<p>${body}</p>`));

  assert.equal(result.html, `<p>${'x'.repeat(1000)}${emoji} ${'👩\u200d💻 '.repeat(62)}🏴漢\u{e0100}</p>`);
  assert.deepEqual(result.found, ['cf-format']);
  assert.doesNotMatch(result.html, /[\ud800-\udfff](?![\udc00-\udfff])/u);
});

for (const [name, prefix, expected, found] of [
  ['source-leading BOM', '\ufeff', '\ufeff', []],
  ['BOM promoted by ANSI cleanup', '\u001b[m\ufeff', '', ['ansi', 'cf-format']],
] as const) {
  test(`keeps the provider policy for a ${name}`, async () => {
    const html = `${prefix}<p>${emoji} &amp; &#x1F600;</p>`;
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

    assert.equal(result.html, `${expected}<p>${emoji} &amp; &#x1F600;</p>`);
    assert.deepEqual(result.found, found);
  });
}

test('maps literal CRLF without changing decoded CR references or authored spelling', async () => {
  const html = `<!doctype html>\r\n<p>&#13;${emoji}&#xD;\r\n &#65533;</p>`;
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

  assert.equal(result.html, html);
  assert.deepEqual(result.found, []);
});

test('does not reorder ANSI-aborted payload controls out of the scatter gate', async () => {
  const html = '<p title="\u001b]0;">\u001b[m</p><p title="'
    + 'x\u200b'.repeat(30) + `\u0007">${emoji}</p>`;
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

  assert.doesNotMatch(result.html, /\u200d|\u200b|\u001b/);
  assert.ok(result.found?.includes('cf-format'));
  assert.ok(result.found?.includes('ansi'));
});

test('maps dense candidates in a text node within a practical time', { timeout: 5000 }, async () => {
  const html = `<p>${'left\r\n\u200dright '.repeat(150000)}</p>`;
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

  assert.equal(result.html, html.replace(/\u200d/g, ''));
  assert.deepEqual(result.found, ['cf-format']);
});

for (const [name, sequence, control, category] of [
  ['ZWNJ', 'ب\u200cب ', '\u200c', 'cf-format'],
  ['blank fillers', '⠁\u2800 ', '\u2800', 'blank-fillers'],
] as const) {
  test(`shares the allowance with permitted ${name}`, async () => {
    const html = `<p>${'x'.repeat(1000)}${emoji} ${'👩\u200d💻 '.repeat(62)}${sequence.repeat(3)}</p>`;
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

    assert.equal(result.html.match(/\u200d/g)?.length, 63);
    assert.equal(Array.from(result.html).filter((value) => value === control).length, 1);
    assert.deepEqual(result.found, [category]);
  });
}

test('uses the raw policy when decoded source text cannot be mapped', async () => {
  const html = `<p>\u0000${emoji}</p>`;
  const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(html));

  assert.equal(result.html, html.replace(/\u200d/g, ''));
  assert.deepEqual(result.found, ['cf-format']);
});
