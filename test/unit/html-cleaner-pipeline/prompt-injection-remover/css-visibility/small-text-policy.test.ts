import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { createContext } from '../../../../support/html-cleaner-context.ts';

describe('small text cutoff', () => {
  test('removes text below the default cutoff and keeps larger children and images', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(
      '<div style="font-size:11px">Small parent<span>Small inherited</span>'
      + '<span style="font-size:12px">At cutoff</span><span style="font-size:13px">Larger child</span>'
      + '<img src="/image.png" alt="Image"></div>',
    ));
    assert.doesNotMatch(result.html, /Small/);
    assert.match(result.html, /At cutoff/);
    assert.match(result.html, /Larger child/);
    assert.match(result.html, /<img/);
  });

  test('keeps unknown font sizes', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(
      '<p>Default size</p><div style="font-size:11px">Small parent'
      + '<span style="font-size:var(--size)">Unknown variable</span>'
      + '<span style="font-size:calc(16px)">Unknown calculation</span>'
      + '<span style="font-size:small">Unknown keyword</span></div>',
    ));
    assert.doesNotMatch(result.html, /Small parent/);
    for (const text of ['Default size', 'Unknown variable', 'Unknown calculation', 'Unknown keyword']) {
      assert.ok(result.html.includes(text), text);
    }
  });

  test('uses independent configurable cutoffs and retains old hiding rules when disabled', async () => {
    const input = createContext('<p style="font-size:9px">Nine pixels</p>'
      + '<p style="font-size:0.001px">Near zero</p><p hidden>Hidden attribute</p>');
    const custom = new PromptInjectionRemoverSanitizer({ minTextFontSizePx: 8 });
    const disabled = new PromptInjectionRemoverSanitizer({ minTextFontSizePx: 0 });
    const normal = new PromptInjectionRemoverSanitizer();
    for (const sanitizer of [custom, disabled, custom]) {
      const result = await sanitizer.invoke(input);
      assert.match(result.html, /Nine pixels/);
      assert.doesNotMatch(result.html, /Near zero|Hidden attribute/);
    }
    assert.doesNotMatch((await normal.invoke(input)).html, /Nine pixels/);
  });

  test('rejects negative and nonfinite cutoff values', () => {
    for (const minTextFontSizePx of [-1, NaN, Infinity, -Infinity]) {
      assert.throws(() => new PromptInjectionRemoverSanitizer({ minTextFontSizePx }), RangeError);
    }
  });
});

describe('small text in native controls', () => {
  for (const type of ['', 'text', 'search', 'tel', 'url', 'email', 'password', 'TEXT', 'invalid']) {
    test(`removes a small author-font input value in the ${type || 'missing'} state`, async () => {
      const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(
        `<input${type ? ` type="${type}"` : ''} style="font-size:11px" value="Small input">`
        + `<input${type ? ` type="${type}"` : ''} style="font-size:6px;transform:scale(2)" value="At cutoff">`,
      ));
      assert.doesNotMatch(result.html, /Small input/);
      assert.match(result.html, /At cutoff/);
    });
  }

  test('keeps native defaults, unresolved fonts, and other input states', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(
      '<div style="font-size:11px"><input value="Native default"><button>Native label</button>'
      + '<input style="font-size:var(--size)" value="Unknown font">'
      + '<input type="number" style="font-size:11px" value="Other state"></div>',
    ));
    for (const text of ['Native default', 'Native label', 'Unknown font', 'Other state']) {
      assert.ok(result.html.includes(text), text);
    }
  });
});

describe('small text box context', () => {
  test('ignores an inline box transform but applies an inline-block transform', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(
      '<span style="font-size:6px;transform:scale(2)">Small inline</span>'
      + '<span style="display:inline-block;font-size:6px;transform:scale(2)">At cutoff</span>',
    ));
    assert.doesNotMatch(result.html, /Small inline/);
    assert.match(result.html, /At cutoff/);
  });

  test('keeps larger children of a small contents wrapper', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(
      '<div style="display:contents;font-size:11px;transform:scale(4)">Small wrapper'
      + '<span style="font-size:12px">At cutoff</span></div>',
    ));
    assert.doesNotMatch(result.html, /Small wrapper/);
    assert.match(result.html, /At cutoff/);
  });

  test('keeps text when transform error cannot be bounded', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(
      '<p style="font-size:11px;transform:scaleX(1e308) scaleX(1e308)">Unknown geometry</p>',
    ));
    assert.match(result.html, /Unknown geometry/);
  });

  test('uses the custom cutoff to preserve logical emoji joiners', async () => {
    const result = await new PromptInjectionRemoverSanitizer({ minTextFontSizePx: 8 }).invoke(createContext(
      '<p><span style="font-size:9px">👩</span><span>\u200d</span>💻</p>',
    ));
    assert.match(result.html, /👩/);
    assert.match(result.html, /\u200d/);
    assert.match(result.html, /💻/);
    assert.equal(result.found?.includes('cf-format'), false);
  });
});

describe('apparent text size', () => {
  for (const { size, transform, kept } of [
    { size: 4, transform: 'scale(4)', kept: true },
    { size: 16, transform: 'scale(.5)', kept: false },
    { size: 6, transform: 'scale(2)', kept: true },
    { size: 5.999, transform: 'scale(2)', kept: false },
    { size: 24, transform: 'scale(.5)', kept: true },
    { size: 23.998, transform: 'scale(.5)', kept: false },
    { size: 12, transform: 'rotate(45deg)', kept: true },
    { size: 11, transform: 'var(--transform)', kept: true },
    { size: 11, transform: 'perspective(500px)', kept: true },
  ]) {
    test(`${kept ? 'keeps' : 'removes'} ${size}px text with ${transform}`, async () => {
      const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(
        `<p style="font-size:${size}px;transform:${transform}">Target text</p>`,
      ));
      assert.equal(result.html.includes('Target text'), kept);
    });
  }

  test('uses composed inherited transforms and preserves restored children', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(createContext(
      '<div style="font-size:16px;transform:scale(.5)">Small parent'
      + '<p style="transform:scale(2)">Restored child</p>'
      + '<p style="transform:scale(1)">Small child</p></div>',
    ));
    assert.doesNotMatch(result.html, /Small/);
    assert.match(result.html, /Restored child/);
  });
});
