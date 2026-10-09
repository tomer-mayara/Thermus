import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts';
import { sanitizeHtml } from '../helpers/sanitize-html.ts';

test('removes content on a hidden parent plane and keeps visible child planes', async () => {
  const result = await sanitizeHtml(
    '<div style="transform-style:preserve-3d;transform:rotateX(90deg)">' +
    'Hidden parent<span>Hidden same plane</span>' +
    '<img src="/hidden.png" alt="Hidden image">' +
    '<p style="transform:rotateX(45deg)">Visible child</p>' +
    '<img style="transform:rotateX(45deg)" src="/visible.png" alt="Visible image">' +
    'Hidden tail</div><p>Visible sibling</p>',
  );

  assert.doesNotMatch(result.html, /Hidden|hidden.png/);
  assert.match(result.html, /Visible child/);
  assert.match(result.html, /visible.png/);
  assert.match(result.html, /Visible sibling/);
});

test('composes affine child planes within a preserved 3D context', async () => {
  const result = await sanitizeHtml(
    '<div style="transform-style:preserve-3d;transform:rotateX(90deg)">' +
    '<p style="transform:rotateY(45deg)">Hidden child plane</p>' +
    '<p style="transform:rotateX(-90deg)">Visible restored plane</p>' +
    '<p style="transform:matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)">Hidden identity plane</p>' +
    '</div>',
  );

  assert.doesNotMatch(result.html, /Hidden/);
  assert.match(result.html, /Visible restored plane/);
});

test('keeps a restored plane through a wrapper that preserves 3D', async () => {
  const result = await sanitizeHtml(
    '<div style="transform-style:preserve-3d;transform:rotateX(90deg)">' +
    '<section style="transform-style:preserve-3d">Hidden wrapper' +
    '<p style="transform:rotateX(45deg)">Visible grandchild</p></section>' +
    '<section><p style="transform:rotateX(45deg)">Hidden flat grandchild</p></section></div>',
  );

  assert.doesNotMatch(result.html, /Hidden/);
  assert.match(result.html, /Visible grandchild/);
});

test('keeps an unresolved child transform eligible for a visible plane', async () => {
  const result = await sanitizeHtml(
    '<div style="transform-style:preserve-3d;transform:rotateX(90deg)">' +
    'Hidden parent<p style="transform:rotateX(calc(45deg))">Visible unresolved plane</p></div>',
  );

  assert.doesNotMatch(result.html, /Hidden parent/);
  assert.match(result.html, /Visible unresolved plane/);
});

test('the final Markdown excludes hidden local text but keeps the visible plane', async () => {
  const pipeline = new HtmlToMarkdownPipeline([
    new PromptInjectionRemoverSanitizer(), new CleanHtmlToMarkdownDefuddle(),
  ]);
  const result = await pipeline.process('https://example.com/',
    '<!doctype html><html><body><main>' +
    '<div style="transform-style:preserve-3d;transform:rotateX(90deg)">Hidden parent' +
    '<p style="transform:rotateX(45deg)">Visible child</p>' +
    '<p>Hidden same plane</p></div><p>Visible sibling</p></main></body></html>',
  );

  assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
});

test('keeps a preserved plane whose perspective projection needs layout data', async () => {
  const result = await sanitizeHtml(
    '<div style="perspective:500px;perspective-origin:0 0;width:300px;height:100px">' +
    '<div style="transform-style:preserve-3d;transform:rotateX(90deg);width:200px;height:100px">' +
    'Visible perspective text</div></div>',
  );

  assert.match(result.html, /Visible perspective text/);
  assert.deepEqual(result.found, []);
});

for (const style of [
  '--planes:flat;transform-style:var(--planes)',
  'transform-style:var(--missing,flat)',
  'transform-style:inherit',
  'transform-style:preserve-3d;--fade:.5;opacity:var(--fade)',
  'transform-style:preserve-3d;opacity:calc(.5)',
  'transform-style:preserve-3d;--group:blur(0px);filter:var(--group)',
]) {
  test(`keeps a child when its 3D context is unresolved: ${style}`, async () => {
    const result = await sanitizeHtml(
      `<div style="${style};transform:rotateX(45deg)">` +
      '<p style="transform:rotateX(45deg)">Visible child</p></div>',
    );

    assert.match(result.html, /Visible child/);
    assert.deepEqual(result.found, []);
  });
}

test('distinguishes confirmed preserved and flat child planes', async () => {
  const result = await sanitizeHtml(
    '<div style="transform-style:preserve-3d;transform:rotateX(45deg)">' +
    '<p style="transform:rotateX(45deg)">Hidden preserved child</p></div>' +
    '<div style="transform-style:flat;transform:rotateX(45deg)">' +
    '<p style="transform:rotateX(45deg)">Visible flat child</p></div>',
  );

  assert.doesNotMatch(result.html, /Hidden/);
  assert.match(result.html, /Visible flat child/);
});
