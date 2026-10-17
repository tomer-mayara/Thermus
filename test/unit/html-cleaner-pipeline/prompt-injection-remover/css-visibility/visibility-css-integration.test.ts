import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './fixtures/css-pipeline.ts';

async function cleanCssDocument(css: string, body: string) {
  const html = '<!doctype html><html><head>' +
    `<style>${css}</style></head><body><main>${body}</main></body></html>`;
  return createPipeline().process('https://example.com/', html);
}

describe('CSS rules with descendant visibility state', () => {
  test('keeps a class font override and image inside a zero-font-size class', async () => {
    const result = await cleanCssDocument(
      '.zero{font-size:0}.readable{font-size:16px}',
      '<div class="zero">Hidden parent<p>Hidden inherited</p>' +
      '<p class="readable">VISIBLE CONTENT</p>' +
      '<img src="/photo.png" alt="Visible photo" width="200" height="200">' +
      'Hidden tail</div><p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /VISIBLE CONTENT/);
    assert.match(result.html, /src="\/photo.png"/);
    assert.equal(result.markdown,
      'VISIBLE CONTENT\n\n![Visible photo](https://example.com/photo.png)\n\nVisible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('uses an important CSS display override while retaining inline font inheritance', async () => {
    const result = await cleanCssDocument(
      '.shown{display:block!important}',
      '<div class="shown" style="display:none;font-size:0">Hidden parent' +
      '<p style="font-size:16px">VISIBLE CONTENT</p><p>Hidden inherited</p>' +
      '<img src="/photo.png" alt="Visible photo" width="200" height="200">' +
      '</div><p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /VISIBLE CONTENT/);
    assert.match(result.html, /src="\/photo.png"/);
    assert.equal(result.markdown,
      'VISIBLE CONTENT\n\n![Visible photo](https://example.com/photo.png)\n\nVisible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('keeps a rotated class font override and removes a collapsed class subtree', async () => {
    const result = await cleanCssDocument(
      '.zero{font-size:0}.readable{font-size:16px}' +
      '.turn{transform:matrix(0,1,-1,0,0,0)}.collapsed{transform:matrix(1,2,2,4,0,0)}',
      '<div class="zero turn">Hidden parent<p class="readable">VISIBLE CONTENT</p></div>' +
      '<div class="collapsed"><p class="readable">Hidden collapsed override</p></div>' +
      '<p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /VISIBLE CONTENT/);
    assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('keeps exact visible table source between merged hidden text segments with class font sizes', async () => {
    const css = '.zero{font-size:0}.readable{font-size:16px}';
    const table = '<table><tr><td class="readable">VISIBLE CONTENT</td></tr></table>';
    const result = await cleanCssDocument(css,
      '<div class="zero">Hidden start<table><tr><td class="readable">VISIBLE CONTENT</td></tr>' +
      'Hidden fostered</table>Hidden tail</div><p>Visible sibling</p>',
    );

    assert.equal(result.html, '<!doctype html><html><head>' +
      `<style>${css}</style></head><body><main><div class="zero">${table}</div>` +
      '<p>Visible sibling</p></main></body></html>');
    assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('retains a preserved parent transform after CSS visibility and a removal scan', async () => {
    const result = await cleanCssDocument(
      '.shown{display:block!important}',
      '<div class="shown" style="display:none;transform-style:preserve-3d;transform:rotateX(90deg)">' +
      'Hidden parent<p>Hidden same plane</p>' +
      '<p style="transform:rotateX(45deg)">VISIBLE CONTENT</p>' +
      'Hidden tail</div><p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /VISIBLE CONTENT/);
    assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('retains inline mask grouping when CSS overrides the parent display', async () => {
    const result = await cleanCssDocument(
      '.shown{display:block!important}',
      '<div class="shown" style="display:none;transform-style:preserve-3d;' +
      'mask:linear-gradient(white,white);transform:rotateX(45deg);width:300px;height:160px">' +
      '<p style="transform:rotateX(45deg);width:200px;height:100px">VISIBLE CONTENT</p>' +
      '</div><p>Visible sibling</p>',
    );

    assert.match(result.html, /VISIBLE CONTENT/);
    assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });

  test('retains inline parent perspective when CSS overrides the parent display', async () => {
    const result = await cleanCssDocument(
      '.shown{display:block!important}',
      '<div class="shown" style="display:none;perspective:500px;perspective-origin:0 0;width:300px;height:200px">' +
      '<div style="transform:matrix3d(1,1,0,0,1,1,1,0,0,1,1,0,0,0,0,1);width:200px;height:100px">' +
      'VISIBLE CONTENT</div></div><p>Visible sibling</p>',
    );

    assert.match(result.html, /VISIBLE CONTENT/);
    assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });

  test('checks a formed zero-font-size class parent without losing a retained child override', async () => {
    const result = await cleanCssDocument(
      '.zero{font-size:0}.readable{font-size:16px}',
      '<<span hidden>Hidden cut</span>div class="zero">Hidden formed parent' +
      '<p class="readable">VISIBLE CONTENT</p><p>Hidden inherited</p>' +
      '</div><p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /VISIBLE CONTENT/);
    assert.equal(result.markdown, 'VISIBLE CONTENT\n\nVisible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
    assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
  });

  test('ranks font shorthand and font-size overrides across CSS and inline declarations', async () => {
    const result = await cleanCssDocument(
      '.size{font-size:0!important;font:0px Arial!important}' +
      '.shorthand{font:0px Arial!important;font-size:0!important}',
      '<p class="size" style="font-size:16px!important">Visible longhand override</p>' +
      '<p class="shorthand" style="font:16px Arial!important">Visible shorthand override</p>' +
      '<p class="size" style="font-size:16px">Hidden normal override</p><p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden normal override/);
    assert.match(result.html, /Visible longhand override/);
    assert.match(result.html, /Visible shorthand override/);
    assert.equal(result.markdown,
      'Visible longhand override\n\nVisible shorthand override\n\nVisible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('keeps visible reconstructed text when a shared source tag has a hidden copy', async () => {
    const result = await cleanCssDocument(
      '.x{font-size:16px}p+p .x{font-size:0}',
      '<p><b class="x">VISIBLE COPY<p>Hidden copy</b></p><p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden copy/);
    assert.match(result.html, /VISIBLE COPY/);
    assert.equal(result.markdown, '**VISIBLE COPY**\n\nVisible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
    assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
  });

  test('keeps visible nested reconstructed text when its shared source tag has a hidden copy', async () => {
    const result = await cleanCssDocument(
      '.x{font-size:16px}p+p .x{font-size:0}',
      '<p><b><i class="x">VISIBLE COPY<p>Hidden copy</i></b></p><p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden copy/);
    assert.match(result.html, /VISIBLE COPY/);
    assert.equal(result.markdown, '***VISIBLE COPY***\n\nVisible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
    assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
  });

  for (const value of ['env()', 'attr()']) {
    test(`keeps a valid hiding transform before an invalid empty ${value} declaration`, async () => {
      const result = await cleanCssDocument('',
        `<div style="transform:scale(0);transform:${value}">Hidden content</div>` +
        '<p>Visible sibling</p>',
      );

      assert.doesNotMatch(result.html, /Hidden content/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, ['hidden-html']);
    });
  }
});
