import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { sanitizeHtml } from '../../../../helpers/sanitize-html.ts';
import { createPipeline } from './helpers/css-pipeline.ts';

describe('visibility in parsed HTML source ranges', () => {
  for (const hiddenTail of [true, false]) {
    test(`keeps a visible table formatting copy ${hiddenTail ? 'after hidden tail removal' : 'without a hidden tail'}`, async () => {
      const result = await createPipeline().process('https://example.com/',
        '<!doctype html><html><body><main>' +
        '<style>.x{font-size:16px}.x+.x{font-size:0}</style>' +
        '<div><table><b class="x">VISIBLE<tr><td>Cell</td></tr>' +
        `${hiddenTail ? 'Hidden tail' : ''}</b></table></div>` +
        '<p>Visible sibling</p></main></body></html>',
      );

      assert.match(result.html, /VISIBLE/);
      assert.match(result.html, /Cell/);
      assert.doesNotMatch(result.html, /Hidden tail/);
      assert.equal(result.markdown, 'Cell\n\nVisible sibling');
      assert.deepEqual(result.found, hiddenTail ? ['hidden-html'] : []);
    });
  }

  test('keeps a font override and image in a zero-font-size parent formed by removal', async () => {
    const result = await sanitizeHtml(
      '<<span hidden>Hidden cut</span>div style="font-size:0">Hidden parent' +
      '<span>Hidden inherited</span>' +
      '<p style="font-size:16px">Visible override</p>' +
      '<img src="/visible.png" alt="Visible image">Hidden tail</div>',
    );

    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /Visible override/);
    assert.match(result.html, /src="\/visible.png"/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
    assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
  });

  test('keeps a child plane in a preserved 3D parent formed by removal', async () => {
    const result = await sanitizeHtml(
      '<<span hidden>Hidden cut</span>div style="transform-style:preserve-3d;transform:rotateX(90deg)">' +
      'Hidden parent<span>Hidden same plane</span>' +
      '<p style="transform:rotateX(45deg)">Visible child plane</p>' +
      '<img style="transform:rotateX(45deg)" src="/visible.png" alt="Visible image">' +
      '<img src="/hidden.png" alt="Hidden image">Hidden tail</div>',
    );

    assert.doesNotMatch(result.html, /Hidden|hidden.png/);
    assert.match(result.html, /Visible child plane/);
    assert.match(result.html, /src="\/visible.png"/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
    assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
  });

  test('keeps a visible child fostered outside a hidden table', async () => {
    const visible = '<p style="font-size:16px">Visible fostered child</p>';
    const result = await sanitizeHtml(
      `<table style="display:none">${visible}<tr><td>Hidden cell</td></tr></table>`,
    );

    assert.equal(result.html, '<p style="">Visible fostered child</p>');
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
  });

  test('uses the parsed parent for font inheritance around a table', async () => {
    const result = await sanitizeHtml(
      '<!doctype html><table style="font-size:0">' +
      '<p>Visible fostered child</p><tr><td>Hidden cell' +
      '<span style="font-size:16px">Visible cell override</span></td></tr></table>',
    );

    assert.doesNotMatch(result.html, /Hidden cell/);
    assert.match(result.html, /Visible fostered child/);
    assert.match(result.html, /Visible cell override/);
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('keeps visible table source between hidden text segments with character references', async () => {
    const cell = '<tr><td style="font-size:16px">Visible &amp; &#32; 😀 content</td></tr>';
    const result = await sanitizeHtml(
      '<div style="font-size:0">Hidden &amp;&#32;start<table>' + cell +
      'Hidden &#x1f600; fostered</table>&NotEqualTilde; Hidden tail</div>',
    );

    assert.equal(result.html,
      '<div style=""><table><tr><td style="">Visible &amp; &#32; 😀 content</td></tr></table></div>');
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
    assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
  });

  test('inherits font size through nested template contents and keeps an override', async () => {
    const result = await sanitizeHtml(
      '<!doctype html><div style="font-size:0"><template>Hidden template text' +
      '<template><span>Hidden nested text</span>' +
      '<span style="font-size:16px">Visible nested override</span></template>' +
      '</template></div><p>Visible sibling</p>',
    );

    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /Visible nested override/);
    assert.match(result.html, /Visible sibling/);
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('inherits a preserved transform plane through template contents', async () => {
    const result = await sanitizeHtml(
      '<div style="transform-style:preserve-3d;transform:rotateX(90deg)">' +
      '<template style="transform-style:preserve-3d">Hidden template plane' +
      '<p>Hidden inherited plane</p>' +
      '<p style="transform:rotateX(45deg)">Visible child plane</p></template></div>',
    );

    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /Visible child plane/);
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('keeps a font override under a zero-font-size document body without a doctype', async () => {
    const result = await sanitizeHtml(
      '<html><body style="font-size:0">Hidden body text' +
      '<p>Hidden inherited text</p><p style="font-size:16">Visible quirks override</p>' +
      '<img src="/visible.png" alt="Visible image">Hidden tail</body></html>',
    );

    assert.doesNotMatch(result.html, /Hidden/);
    assert.match(result.html, /Visible quirks override/);
    assert.match(result.html, /src="\/visible.png"/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
  });

  test('removes template overrides and restored planes under display none', async () => {
    const result = await sanitizeHtml(
      '<div style="display:none;font-size:0"><template>' +
      '<p style="font-size:16px">Hidden template override</p></template></div>' +
      '<div style="display:none;transform-style:preserve-3d;transform:rotateX(90deg)">' +
      '<p style="transform:rotateX(45deg)">Hidden child plane</p></div><p>Visible sibling</p>',
    );

    assert.equal(result.html, '<p>Visible sibling</p>');
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
  });
});
