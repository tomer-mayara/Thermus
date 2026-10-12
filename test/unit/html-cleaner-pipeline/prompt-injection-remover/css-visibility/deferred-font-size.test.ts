import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { sanitizeHtml } from '../helpers/sanitize-html.ts';
import { createContext } from '../support/html-cleaner-context.ts';

const deferredSizes = [
  ['env fallback', 'env(missing,16px)'],
  ['typed attr fallback', 'attr(data-size type(<length>),16px)'],
  ['px attr fallback', 'attr(data-size px,16px)'],
  ['font shorthand fallback', 'font:env(missing,16px) serif'],
  ['escaped function name', String.raw`e\6e v(missing,16px)`],
  ['escaped typed attr function name', String.raw`a\74 tr(data-size type(<length>),16px)`],
] as const;

for (const [label, declaration] of deferredSizes) {
  test(`keeps a child with a deferred ${label} size`, async () => {
    const property = declaration.startsWith('font:') ? declaration : `font-size:${declaration}`;
    const result = await sanitizeHtml(
      `<div style="font-size:0"><p style="${property}">Visible child</p></div>`,
    );

    assert.match(result.html, /Visible child/);
  });
}

for (const invalidSize of [
  '???', '@unknown', '<16px>', '{16px}', 'env()', 'attr()',
  'env(,16px)', 'attr(,16px)',
]) {
  test(`keeps invalid font-size ${invalidSize} hidden`, async () => {
    const result = await sanitizeHtml(
      `<div style="font-size:0"><p style="font-size:0;font-size:${invalidSize}">Hidden invalid size</p></div>` +
      '<p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden invalid size/);
    assert.match(result.html, /Visible sibling/);
  });
}

test('uses a later deferred size and keeps important zero and display none hidden', async () => {
  const result = await sanitizeHtml(
    '<div style="font-size:0">' +
    '<p style="font-size:0;font-size:env(missing,16px)">Visible later size</p>' +
    '<p style="font-size:0!important;font-size:env(missing,16px)">Hidden important zero</p>' +
    '<p style="font-size:0">Hidden inherited size</p></div>' +
    '<div style="display:none"><p style="font-size:env(missing,16px)">Hidden display none</p></div>',
  );

  assert.match(result.html, /Visible later size/);
  assert.doesNotMatch(result.html, /Hidden/);
});

test('keeps important zero and display none descendants hidden', async () => {
  const result = await sanitizeHtml(
    '<p style="font-size:0!important;font-size:env(missing,16px)">Hidden important zero</p>' +
    '<div style="display:none"><p style="font-size:env(missing,16px)">Hidden display none</p></div>' +
    '<p>Visible control</p>',
  );

  assert.doesNotMatch(result.html, /Hidden/);
  assert.match(result.html, /Visible control/);
});

test('the final Markdown keeps deferred visible descendants in document order', async () => {
  const pipeline = new HtmlToMarkdownPipeline([
    new PromptInjectionRemoverSanitizer(), new CleanHtmlToMarkdownDefuddle(),
  ]);
  const html = '<!doctype html><html><body><main><div style="font-size:0">Hidden parent' +
    '<p style="font-size:env(missing,16px)">Visible env fallback</p>' +
    '<p style="font-size:attr(data-size type(<length>),16px)">Visible typed attr fallback</p>' +
    '<p style="font-size:attr(data-size px,16px)">Visible px attr fallback</p>' +
    '<p style="font:env(missing,16px) serif">Visible shorthand fallback</p>' +
    '<p style="font-size:0;font-size:env(missing,16px)">Visible later fallback</p>' +
    '<p style="font-size:0;font-size:attr(data-size px,16px)">Visible later attr fallback</p>' +
    '<p style="font-size:0!important;font-size:env(missing,16px)">Hidden important zero</p>' +
    '<p style="font-size:0">Hidden inherited size</p></div>' +
    '<div style="display:none"><p style="font-size:env(missing,16px)">Hidden display none</p></div>' +
    '</main></body></html>';

  const result = await pipeline.process(createContext(html));

  assert.equal(result.markdown, [
    'Visible env fallback', 'Visible typed attr fallback',
    'Visible px attr fallback', 'Visible shorthand fallback',
    'Visible later fallback', 'Visible later attr fallback',
  ].join('\n\n'));
});
