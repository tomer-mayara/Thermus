import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { sanitizeHtml } from '../helpers/sanitize-html.ts';

describe('Composed transform visibility', () => {
  for (const transform of [
    'rotateY(90deg) matrix(1,0,0,1,0,0)',
    'matrix(1,0,0,1,0,0) rotateY(90deg)',
    'rotateX(90deg) translateX(0px)',
    'translateX(10px) rotateX(90deg)',
    'rotateX(0.25turn) scale(2)',
    'rotateY(100grad) scaleX(2)',
    'rotateY(1.5707963267948966rad) scaleY(2)',
    'rotateY(45deg) rotateY(45deg)',
    'scale(0.001) matrix(2,0,0,2,0,0)',
    'scale3d(1,1,0) matrix(1000,0,0,1000,0,0)',
    'translateX(-2000000px) translateX(1000000px)',
    'matrix(1,0,0,1,0,-1000000)',
    'translateY(-10000em)',
  ]) {
    test(`removes the collapsed composition ${transform}`, async () => {
      const result = await sanitizeHtml(
        `<div style="transform:${transform}"><p>Hidden content</p></div><p>Visible sibling</p>`,
      );

      assert.doesNotMatch(result.html, /Hidden content/);
      assert.match(result.html, /Visible sibling/);
      assert.deepEqual(result.found, ['hidden-html']);
    });
  }

  for (const transform of [
    'scale(0.001) matrix(1000,0,0,1000,0,0)',
    'matrix(1000,0,0,1000,0,0) scale(0.001)',
    'scaleX(0.001) matrix(1000,0,0,1,0,0)',
    'scaleY(0.1%) matrix(1,0,0,1000,0,0)',
    'scale3d(0.001,0.001,1) matrix(1000,0,0,1000,0,0)',
    'scale(0.001) scale(1000)',
    'matrix(1,1,1,1.0000000000000018,0,0) ' +
      'matrix(562949953421313,-562949953421312,-562949953421312,562949953421312,0,0)',
    'rotateY(90deg) rotateY(-90deg) matrix(1,0,0,1,0,0)',
    'rotateX(90deg) matrix3d(1,0,0,0,0,0,-1,0,0,1,0,0,0,0,0,1)',
    'scale(0.001) scale(calc(1000))',
    'translateX(1000000px) translateX(-1000000px)',
    'translateX(-1000000px) translateX(1000000px)',
    'translateY(-1000000px) translateY(1000000px)',
    'matrix(1,0,0,1,1000000,0) translateX(-1000000px)',
    'translateX(-10000em) translateX(10000em)',
  ]) {
    test(`keeps the visible or unresolved composition ${transform}`, async () => {
      const result = await sanitizeHtml(`<div style="transform:${transform}">Visible content</div>`);

      assert.match(result.html, /Visible content/);
      assert.deepEqual(result.found, []);
    });
  }
});

test('keeps text when the transform origin places a mirrored plane in view', async () => {
  const result = await sanitizeHtml(
    '<div style="width:2000px;transform:matrix(-1,0,0,1,-1000,0)">' +
    '<span>Visible content</span></div><p>Visible sibling</p>',
  );

  assert.match(result.html, /Visible content/);
  assert.match(result.html, /Visible sibling/);
  assert.deepEqual(result.found, []);
});

test('the final Markdown uses the combined transform', async () => {
  const pipeline = new HtmlToMarkdownPipeline([
    new PromptInjectionRemoverSanitizer(), new CleanHtmlToMarkdownDefuddle(),
  ]);
  const html = '<!doctype html><html><body><main>' +
    '<p style="transform:scale(0.001) matrix(1000,0,0,1000,0,0)">Visible content</p>' +
    '<p style="transform:translateX(1000000px) translateX(-1000000px)">Visible translation</p>' +
    '<p style="transform:rotateY(90deg) matrix(1,0,0,1,0,0)">Hidden rotation</p>' +
    '<p style="transform:rotateX(90deg) translateX(0px)">Hidden translation</p>' +
    '<p style="transform:translateX(-2000000px) translateX(1000000px)">Hidden offscreen</p>' +
    '<p>Visible sibling</p></main></body></html>';

  const result = await pipeline.process('https://example.com/', html);

  assert.equal(result.markdown, 'Visible content\n\nVisible translation\n\nVisible sibling');
});
