import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.ts';

async function cleanBody(body: string, head = '') {
  return createPipeline().process('https://example.com/',
    `<!doctype html><html><head>${head}</head><body><main>${body}` +
    '<p>Visible sibling</p></main></body></html>');
}

test('keeps a flat child whose inverse restores a near-singular parent', async () => {
  const result = await cleanBody(
    '<div style="transform:matrix(1,1,1,1.0000000000000018,0,0)">' +
    '<p style="transform:matrix(562949953421313,-562949953421312,-562949953421312,562949953421312,0,0)">' +
    'Visible child</p></div>',
  );

  assert.match(result.html, /Visible child/);
  assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
  assert.deepEqual(result.found, []);
});

test('keeps a restored child when a long matrix coefficient exceeds the exact proof budget', async () => {
  const coefficient = `1.0000000000000018${'0'.repeat(130)}`;
  const result = await cleanBody(
    `<div style="transform:matrix(1,1,1,${coefficient},0,0)">` +
    '<p style="transform:matrix(562949953421313,-562949953421312,-562949953421312,562949953421312,0,0)">' +
    'Visible child</p></div>',
  );

  assert.match(result.html, /Visible child/);
  assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
  assert.deepEqual(result.found, []);
});

describe('zero-font input values', () => {
  for (const type of [undefined, 'TEXT', 'invalid-type', 'search', 'tel', 'url', 'email', 'password']) {
    test(`removes the zero-font value from ${type ?? 'default'} input`, async () => {
      const attribute = type === undefined ? '' : ` type="${type}"`;
      const result = await cleanBody(`<input${attribute} style="font-size:0" value="Hidden payload">`);

      assert.doesNotMatch(result.html, /Hidden payload/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, ['hidden-html']);
    });
  }

  test('removes an input value with a zero-font class', async () => {
    const result = await cleanBody(
      '<input type="text" class="zero" value="Hidden payload">',
      '<style>.zero{font-size:0}</style>',
    );

    assert.doesNotMatch(result.html, /Hidden payload/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('removes an input value that explicitly inherits zero font size', async () => {
    const result = await cleanBody(
      '<div style="font-size:0"><input style="font-size:inherit" value="Hidden payload">' +
      '<p style="font-size:16px">Visible child</p></div>',
    );

    assert.doesNotMatch(result.html, /Hidden payload/);
    assert.match(result.html, /Visible child/);
    assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  for (const { name, style } of [
    { name: 'the user agent font', style: '' },
    { name: 'a visible local override', style: 'font-size:16px' },
    { name: 'an unresolved local font', style: 'font-size:var(--size)' },
  ]) {
    test(`keeps an input value under a zero-font parent with ${name}`, async () => {
      const attribute = style ? ` style="${style}"` : '';
      const result = await cleanBody(
        `<div style="font-size:0"><input${attribute} value="Visible value"></div>`,
      );

      assert.match(result.html, /<input\b[^>]*value="Visible value"/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, []);
    });
  }

  test('keeps images and non-text controls with zero font size', async () => {
    const result = await cleanBody(
      '<p><img style="font-size:0" src="https://example.com/visible.png" alt="Visible image"></p>' +
      '<input type="image" style="font-size:0" src="https://example.com/control.png" alt="Image control">' +
      '<input type="checkbox" style="font-size:0" value="Checkbox value">' +
      '<input type="range" style="font-size:0" value="50">' +
      '<input type="button" style="font-size:0" value="Button value">',
    );

    assert.match(result.html, /<img\b[^>]*visible\.png/);
    assert.match(result.html, /<input\b[^>]*control\.png/);
    assert.match(result.html, /<input\b[^>]*value="Checkbox value"/);
    assert.match(result.html, /<input\b[^>]*value="50"/);
    assert.match(result.html, /<input\b[^>]*value="Button value"/);
    assert.equal(result.markdown, '![Visible image](https://example.com/visible.png)\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });
});

describe('inherited visibility without a local transform', () => {
  for (const transform of ['none', 'initial', 'unset']) {
    test(`removes inherited offscreen text through a fieldset with transform ${transform}`, async () => {
      const result = await cleanBody(
        '<div style="transform:translateX(-1000000px)">' +
        `<fieldset style="transform:${transform}">Hidden payload</fieldset></div>`,
      );

      assert.doesNotMatch(result.html, /Hidden payload/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, ['hidden-html']);
    });
  }

  for (const tag of ['fieldset', 'x-control']) {
    test(`removes offscreen text through an unstyled ${tag}`, async () => {
      const result = await cleanBody(
        `<div style="transform:translateX(-1000000px)"><${tag}>Hidden payload</${tag}></div>`,
      );

      assert.doesNotMatch(result.html, /Hidden payload/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, ['hidden-html']);
    });

    test(`removes a preserved hidden plane through an unstyled ${tag}`, async () => {
      const result = await cleanBody(
        '<div style="transform-style:preserve-3d;transform:rotateX(90deg)">' +
        `<${tag}>Hidden payload</${tag}></div>`,
      );

      assert.doesNotMatch(result.html, /Hidden payload/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, ['hidden-html']);
    });
  }

  test('keeps an ordinary visible fieldset in HTML', async () => {
    const result = await cleanBody('<fieldset>Visible fieldset</fieldset>');

    assert.match(result.html, /Visible fieldset/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, []);
  });

  test('keeps a positioned fieldset that restores an offscreen ancestor', async () => {
    const result = await cleanBody(
      '<div style="transform:translateX(-1000000px)">' +
      '<fieldset style="position:relative;left:1000000px">Visible fieldset</fieldset></div>',
    );

    assert.match(result.html, /Visible fieldset/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, []);
  });
});

describe('replaced image display', () => {
  test('removes an HTML image suppressed by display contents', async () => {
    const result = await cleanBody(
      '<img style="display:contents" src="https://example.com/hidden.png" alt="Hidden image">',
    );

    assert.doesNotMatch(result.html, /<img\b|hidden\.png|Hidden image/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  for (const { name, style } of [
    { name: 'default display', style: '' },
    { name: 'unresolved display', style: 'display:var(--box)' },
  ]) {
    test(`keeps an image with ${name}`, async () => {
      const attribute = style ? ` style="${style}"` : '';
      const result = await cleanBody(
        `<img${attribute} src="https://example.com/visible.png" alt="Visible image">`,
      );

      assert.match(result.html, /<img\b[^>]*visible\.png/);
      assert.equal(result.markdown, '![Visible image](https://example.com/visible.png)\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }
});
