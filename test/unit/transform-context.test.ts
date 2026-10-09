import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';

const matrixA = 'matrix3d(0,0,-1,0,0,1,0,0,1,0,0,0,0,0,0,1)';
const matrixB = 'matrix3d(0,1,0,0,0,0,-1,0,-1,0,0,0,0,0,0,1)';
const matrixC = 'matrix3d(1,0,-1,0,0,1,0,0,1,0,1,0,0,0,0,1)';
const matrixD = 'matrix3d(1,1,0,0,1,1,1,0,0,1,1,0,0,0,0,1)';
const singularMatrix = 'matrix3d(1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1)';
const identityMatrix3d = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';

async function sanitizeHtml(html: string) {
  return new PromptInjectionRemoverSanitizer().invoke({
    url: 'https://example.com/', html, removed: 0, skipped: 0,
  });
}

describe('Transform list context', () => {
  for (const transform of [
    `${matrixA} ${matrixB}`,
    `${matrixC}, ${matrixC}`,
    `${matrixC} + ${matrixC}`,
    `${singularMatrix}, ${identityMatrix3d}`,
    `${singularMatrix} + ${identityMatrix3d}`,
    `${singularMatrix} matrix(1,0,0,1,0)`,
    `${singularMatrix} rotateX(bogus)`,
    `rotateY(90deg) ${matrixA}`,
    `${matrixA} rotateY(90deg)`,
    `rotateX(45deg) ${matrixD}`,
    `${matrixD} rotateX(45deg)`,
    'rotateX(90deg) rotateX(-90deg)',
    'scaleZ(0.001)',
    'scale3d(1,1,0.001)',
    'scaleZ(0.1%)',
    'scale3d(100%,100%,0.1%)',
    'scaleZ(1)',
    'matrix(0.001,0,0,1,0,0) matrix(1000,0,0,1,0,0)',
    'matrix(0,1,-1,0,0,0)',
    String.raw`\6d atrix(0,1,-1,0,0,0)`,
    `matrix(0,1,-1,0,0,0) ${identityMatrix3d}`,
  ]) {
    test(`keeps visible content with ${transform}`, async () => {
      const result = await sanitizeHtml(`<div style="transform:${transform}">Visible content</div>`);

      assert.match(result.html, /Visible content/);
      assert.deepEqual(result.found, []);
      assert.equal(result.skipped, 0);
    });
  }

  for (const transform of [
    `${matrixC} ${matrixC}`,
    `${matrixB} ${matrixA}`,
    `rotateX(45deg) ${singularMatrix}`,
    'scaleZ(0)',
    'scale3d(1,1,0)',
    'scaleZ(0%)',
    'scale3d(1,1,0%)',
    'scaleZ(0) matrix(0,1,-1,0,0,0)',
    'rotateX(90deg)',
    'rotateY(90deg)',
    'matrix(1,2,2,4,0,0)',
    String.raw`\6d atrix(1,2,2,4,0,0)`,
    `matrix(1,2,2,4,0,0) ${identityMatrix3d}`,
  ]) {
    test(`removes collapsed content with ${transform}`, async () => {
      const result = await sanitizeHtml(
        `<div style="transform:${transform}"><p>Hidden content</p></div><p>Visible sibling</p>`,
      );

      assert.doesNotMatch(result.html, /Hidden content/);
      assert.match(result.html, /Visible sibling/);
      assert.deepEqual(result.found, ['hidden-html']);
    });
  }
});

describe('Transform declaration cascade', () => {
  for (const style of [
    'transform:scale(0);transform:scale(0,1,1)',
    'transform:matrix(1,2,2,4,0,0);transform:matrix(1,2,2,4,0,0) rotateX(bogus)',
    'transform:scale(0)!important;transform:matrix(1,0,0,1,0,0)',
    'transform:scale(0);transform:matrix(1,0,0,1,0,0), matrix(1,0,0,1,0,0)',
  ]) {
    test(`keeps the effective hiding transform for ${style}`, async () => {
      const result = await sanitizeHtml(
        `<div style="${style}">Hidden content</div><p>Visible sibling</p>`,
      );

      assert.doesNotMatch(result.html, /Hidden content/);
      assert.match(result.html, /Visible sibling/);
      assert.deepEqual(result.found, ['hidden-html']);
    });
  }

  for (const style of [
    'transform:scale(0);transform:matrix(1,0,0,1,0,0)',
    'transform:matrix(1,0,0,1,0,0)!important;transform:scale(0)',
    'transform:scale(0);transform:var(--unknown)',
    'transform:scale(0);transform:env(missing, scale(1))',
    'transform:scale(0);transform:attr(data-transform type(<transform-list>), scale(1))',
    'transform:scale(0);transform:scale(attr(data-number number, 1))',
  ]) {
    test(`keeps visible content for ${style}`, async () => {
      const result = await sanitizeHtml(
        `<div style="${style}">Visible content</div><p>Visible sibling</p>`,
      );

      assert.match(result.html, /Visible content/);
      assert.match(result.html, /Visible sibling/);
      assert.deepEqual(result.found, []);
      assert.equal(result.skipped, 0);
    });
  }
});

test('the final Markdown keeps visible transform-list content and its sibling', async () => {
  const pipeline = new HtmlToMarkdownPipeline([
    new PromptInjectionRemoverSanitizer(), new CleanHtmlToMarkdownDefuddle(),
  ]);
  const html = `<html><body><main>` +
    `<p style="transform:${matrixA} ${matrixB}">Visible rotation</p>` +
    `<p style="transform:rotateX(45deg) ${matrixD}">Visible context</p>` +
    `<p style="transform:${matrixC} ${matrixC}">Hidden collapse</p>` +
    `<p>Visible sibling</p>` +
    `</main></body></html>`;

  const result = await pipeline.process('https://example.com/', html);

  assert.equal(result.markdown, [
    'Visible rotation', 'Visible context', 'Visible sibling',
  ].join('\n\n'));
});
