import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../../../../src/pipelines/html-processing/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { CleanHtmlToMarkdownDefuddle } from '../../../../../src/pipelines/html-processing/html-to-markdown/clean-html-to-markdown-defuddle.ts';
import { HtmlToMarkdownPipeline } from '../../../../../src/pipelines/html-processing/html-to-markdown-pipeline.ts';
import { sanitizeHtml } from '../../fixtures/sanitize-html.ts';
import { createContext } from '../../fixtures/html-cleaner-context.ts';

const collapsedParentPlane = 'matrix3d(1,1,0,0,1,1,1,0,0,1,1,0,0,0,0,1)';

describe('Preserved 3D descendants', () => {
  for (const transform of [collapsedParentPlane, 'rotateX(90deg)']) {
    test(`keeps the visible child plane below ${transform}`, async () => {
      const result = await sanitizeHtml(
        `<div style="transform-style:preserve-3d;transform:${transform}">` +
        '<p style="transform:rotateX(45deg)">Visible child</p>' +
        '<img style="transform:rotateX(45deg)" src="/visible.png" alt="Visible image">' +
        '</div><p>Visible sibling</p>',
      );

      assert.match(result.html, /Visible child/);
      assert.match(result.html, /src="\/visible.png"/);
      assert.match(result.html, /Visible sibling/);
      assert.deepEqual(result.found, []);
    });
  }

  test('keeps a child whose local edge-on plane is restored by its parent', async () => {
    const result = await sanitizeHtml(
      '<div style="transform-style:preserve-3d;transform:rotateX(45deg)">' +
      '<p style="transform:rotateX(90deg)">Visible child</p></div>',
    );

    assert.match(result.html, /Visible child/);
    assert.deepEqual(result.found, []);
  });

  for (const style of [
    'transform:scale(0)',
    'transform:scaleZ(0)',
    'transform:matrix(1,2,2,4,0,0)',
    `display:none;transform:${collapsedParentPlane}`,
    `opacity:0;transform:${collapsedParentPlane}`,
  ]) {
    test(`removes a hidden 3D subtree with ${style}`, async () => {
      const result = await sanitizeHtml(
        `<div style="transform-style:preserve-3d;${style}">` +
        '<p style="font-size:16px;transform:rotateX(45deg)">Hidden child</p>' +
        '</div><p>Visible sibling</p>',
      );

      assert.doesNotMatch(result.html, /Hidden child/);
      assert.match(result.html, /Visible sibling/);
    });
  }

  for (const style of [
    'transform-style:flat',
    'transform-style:initial',
    'transform-style:unset',
    'transform-style:flat!important;transform-style:preserve-3d',
    'transform-style:preserve-3d;transform-style:flat',
    'transform-style:preserve-3d;opacity:.5',
    'transform-style:preserve-3d;opacity:50%',
    'transform-style:preserve-3d;overflow:hidden',
    'transform-style:preserve-3d;filter:blur(0px)',
    'transform-style:preserve-3d;isolation:isolate',
    'transform-style:preserve-3d;contain:paint',
    'transform-style:preserve-3d;clip-path:inset(0px)',
    'transform-style:preserve-3d;opacity:.5!important;opacity:1',
    'transform-style:preserve-3d;position:absolute;clip:rect(0px,300px,100px,0px)',
    'transform-style:preserve-3d;position:absolute!important;position:relative;clip:rect(0px,300px,100px,0px)',
    'transform-style:preserve-3d;mask-image:url(mask.svg)',
    'transform-style:preserve-3d;mask-border-source:url(mask.svg)',
    'transform-style:preserve-3d;mix-blend-mode:multiply',
  ]) {
    test(`removes a collapsed flat subtree with ${style}`, async () => {
      const result = await sanitizeHtml(
        `<div style="${style};transform:${collapsedParentPlane}">` +
        '<p style="transform:rotateX(45deg)">Hidden child</p></div><p>Visible sibling</p>',
      );

      assert.doesNotMatch(result.html, /Hidden child/);
      assert.match(result.html, /Visible sibling/);
    });
  }

  for (const style of [
    'transform-style:preserve-3d!important;transform-style:flat',
    'transform-style:preserve-3d;transform-style:invalid',
    'transform-style:flat;transform-style:var(--plane)',
    String.raw`transform-style:preserve-\33 d`,
    'transform-style:preserve-3d;opacity:1',
    'transform-style:preserve-3d;overflow:clip',
    'transform-style:preserve-3d;filter:none',
    'transform-style:preserve-3d;filter:bogus',
    'transform-style:preserve-3d;opacity:1!important;opacity:.5',
    'transform-style:preserve-3d;clip:rect(0px,300px,100px,0px)',
    'transform-style:preserve-3d;position:relative;clip:rect(0px,300px,100px,0px)',
    'transform-style:preserve-3d;position:relative!important;position:absolute;clip:rect(0px,300px,100px,0px)',
    'transform-style:preserve-3d;mask-image:none,none',
  ]) {
    test(`keeps visible or unresolved child planes with ${style}`, async () => {
      const result = await sanitizeHtml(
        `<div style="${style};transform:${collapsedParentPlane}">` +
        '<p style="transform:rotateX(45deg)">Visible child</p></div>',
      );

      assert.match(result.html, /Visible child/);
      assert.deepEqual(result.found, []);
    });
  }
});

test('the final Markdown retains a visible child in another plane', async () => {
  const pipeline = new HtmlToMarkdownPipeline([
    new PromptInjectionRemoverSanitizer(), new CleanHtmlToMarkdownDefuddle(),
  ]);
  const html = '<!doctype html><html><body><main>' +
    `<div style="transform-style:preserve-3d;transform:${collapsedParentPlane}">` +
    '<p style="transform:rotateX(45deg)">Visible child</p></div>' +
    '<p>Visible sibling</p></main></body></html>';

  const result = await pipeline.process(createContext(html));

  assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
});
