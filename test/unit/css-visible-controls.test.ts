import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.ts';

describe('visible CSS controls', () => {
  const invalidCssCases = [
    {
      name: 'invalid escaped scale function arguments',
      element: `<p style="${String.raw`transform:\73 cale(0,garbage)`}">Visible invalid transform</p>`,
      visibleText: 'Visible invalid transform',
    },
    {
      name: 'invalid escaped opacity function arguments',
      element: `<p style="${String.raw`filter:\6f pacity(0,garbage)`}">Visible invalid filter</p>`,
      visibleText: 'Visible invalid filter',
    },
    {
      name: 'unknown escaped length unit',
      element: String.raw`<p style="position:absolute;left:-9999\67 arbage">Visible unknown unit</p>`,
      visibleText: 'Visible unknown unit',
    },
    {
      name: 'invalid display priority',
      element: '<p style="display:none!foo">Visible invalid priority</p>',
      visibleText: 'Visible invalid priority',
    },
    {
      name: 'unresolved display variable',
      element: '<p style="display:none;display:var(--show)">Visible unresolved display</p>',
      visibleText: 'Visible unresolved display',
    },
    {
      name: 'unresolved transform variable',
      element: '<p style="transform:scale(0);transform:scale(var(--scale))">Visible unresolved transform</p>',
      visibleText: 'Visible unresolved transform',
    },
    {
      name: 'unresolved background image with matching foreground and background colors',
      element: '<p style="color:red;background-color:red;background-image:var(--image)">Visible unresolved image</p>',
      visibleText: 'Visible unresolved image',
    },
    {
      name: 'unresolved background shorthand with matching foreground and background colors',
      element: '<p style="color:#fff;background-color:#fff;background:var(--hero)">Visible unresolved background</p>',
      visibleText: 'Visible unresolved background',
    },
    {
      name: 'unresolved background color over a matching background shorthand',
      element: '<p style="color:#fff;background:#fff;background-color:var(--tone)">Visible unresolved background color</p>',
      visibleText: 'Visible unresolved background color',
    },
    {
      name: 'unresolved background environment value',
      element: '<p style="color:#fff;background-color:#fff;background:env(--hero)">Visible unresolved background environment</p>',
      visibleText: 'Visible unresolved background environment',
    },
    {
      name: 'invalid blur before escaped zero opacity',
      element: `<p style="${String.raw`filter:blur(garbage) \6f pacity(0)`}">Visible invalid blur filter</p>`,
      visibleText: 'Visible invalid blur filter',
    },
    {
      name: 'unknown filter function before escaped zero opacity',
      element: `<p style="${String.raw`filter:notafilter() \6f pacity(0)`}">Visible unknown filter</p>`,
      visibleText: 'Visible unknown filter',
    },
    {
      name: 'negative blur before escaped zero opacity',
      element: `<p style="${String.raw`filter:blur(-1px) \6f pacity(0)`}">Visible negative blur filter</p>`,
      visibleText: 'Visible negative blur filter',
    },
  ];

  for (const invalidCase of invalidCssCases) {
    test(`keeps visible text for ${invalidCase.name}`, async () => {
      const html = [
        '<!doctype html><html><head><title>Invalid CSS values</title></head><body><main>',
        invalidCase.element,
        '</main></body></html>',
      ].join('');
      const result = await createPipeline().process('https://example.com/invalid-css', html);
      const markdown = result.markdown ?? '';

      assert.ok(result.html.includes(invalidCase.visibleText), invalidCase.visibleText);
      assert.ok(markdown.includes(invalidCase.visibleText), invalidCase.visibleText);
      assert.deepEqual(result.found, []);
      assert.equal(result.skipped, 0);
    });
  }

  test('does not report visible-only content and preserves unrelated attributes', async () => {
    const html = [
      '<!doctype html><html><head><title>Visible CSS</title>',
      '<style>.payload { display: block; color: red; }</style>',
      '</head><body><main>',
      '<p class="payload" id="keep" data-value="A&amp;B" title="Keep this" style="color: blue">Visible safe content &amp; text</p>',
      '<p class="other">Visible nonmatching content</p>',
      '</main></body></html>',
    ].join('');

    const result = await createPipeline().process('https://example.com/visible-css', html);
    const markdown = result.markdown ?? '';

    assert.deepEqual(result.found, []);
    assert.equal(result.skipped, 0);
    assert.match(result.html, /class="payload"/);
    assert.match(result.html, /id="keep"/);
    assert.match(result.html, /data-value="A&amp;B"/);
    assert.match(result.html, /title="Keep this"/);
    assert.match(result.html, /Visible safe content &amp; text/);
    assert.match(markdown, /Visible safe content & text/);
    assert.match(result.html, /Visible nonmatching content/);
    assert.match(markdown, /Visible nonmatching content/);
  });

  test('cleans formatting characters before checking inline CSS visibility', async () => {
    const html = [
      '<!doctype html><html><head><title>Formatting in CSS</title></head><body><main>',
      '<p style="dis\u200bplay:none">Hidden formatting payload</p>',
      '<p>Visible control</p>',
      '</main></body></html>',
    ].join('');

    const result = await createPipeline().process('https://example.com/formatting-css', html);
    const markdown = result.markdown ?? '';

    assert.ok(!result.html.includes('Hidden formatting payload'));
    assert.ok(!markdown.includes('Hidden formatting payload'));
    assert.match(result.html, /Visible control/);
    assert.match(markdown, /Visible control/);
    assert.deepEqual(result.found, ['cf-format', 'hidden-html']);
    assert.equal(result.skipped, 2);
  });

  test('keeps independent hiding rules when the background paint is unresolved', async () => {
    const html = [
      '<!doctype html><html><head><title>Unknown background hiding controls</title></head><body><main>',
      '<p style="display:none;color:#fff;background-color:#fff;background:var(--hero)">Hidden by display</p>',
      '<p style="opacity:0;color:#fff;background-color:#fff;background:var(--hero)">Hidden by opacity</p>',
      '<p style="color:transparent;background-color:#fff;background:var(--hero)">Hidden by transparent text</p>',
      '<p style="transform:scale(0);color:#fff;background-color:#fff;background:var(--hero)">Hidden by transform</p>',
      '<p style="font-size:0;color:#fff;background-color:#fff;background:var(--hero)">Hidden by font size</p>',
      '<p>Visible background control</p>',
      '</main></body></html>',
    ].join('');

    const result = await createPipeline().process('https://example.com/unknown-background-controls', html);
    const markdown = result.markdown ?? '';

    assert.doesNotMatch(result.html, /Hidden by display|Hidden by opacity|Hidden by transparent text|Hidden by transform|Hidden by font size/);
    assert.doesNotMatch(markdown, /Hidden by display|Hidden by opacity|Hidden by transparent text|Hidden by transform|Hidden by font size/);
    assert.match(result.html, /Visible background control/);
    assert.match(markdown, /Visible background control/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 1);
  });

  test('preserves attributes after a Unicode tag name in the source', async () => {
    const html = [
      '<!doctype html><html><head><title>Unicode tag source</title>',
      '<style>.payload { display: block; }</style>',
      '</head><body><main>',
      '<x-İİİ class="payload" data-value="kept">Visible unicode tag</x-İİİ>',
      '</main></body></html>',
    ].join('');

    const result = await createPipeline().process('https://example.com/unicode-tag', html);
    const markdown = result.markdown ?? '';

    assert.match(result.html, /class="payload"/);
    assert.match(result.html, /data-value="kept"/);
    assert.match(result.html, /Visible unicode tag/);
    assert.match(markdown, /Visible unicode tag/);
    assert.deepEqual(result.found, []);
    assert.equal(result.skipped, 0);
  });
});
