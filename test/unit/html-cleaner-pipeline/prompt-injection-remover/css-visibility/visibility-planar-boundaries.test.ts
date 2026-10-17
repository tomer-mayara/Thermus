import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './fixtures/css-pipeline.ts';

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

describe('exact rank in accumulated planes', () => {
  const inverse = 'matrix(562949953421313,-562949953421312,-562949953421312,562949953421312,0,0)';
  const planarInverse =
    'matrix3d(562949953421313,-562949953421312,0,0,-562949953421312,562949953421312,0,0,0,0,1,0,0,0,0,1)';
  for (const { name, parentStyle, contents, transform } of [
    { name: 'a preserved identity parent', parentStyle: 'transform-style:preserve-3d',
      contents: false, transform: inverse },
    { name: 'a contents wrapper in a preserved context', parentStyle: 'transform-style:preserve-3d',
      contents: true, transform: inverse },
    { name: 'a planar 3D spelling in a preserved context', parentStyle: 'transform-style:preserve-3d',
      contents: false, transform: planarInverse },
    { name: 'a planar 3D spelling in a flat context', parentStyle: '',
      contents: false, transform: planarInverse },
    { name: 'a 2D spelling in a flat context', parentStyle: '', contents: false, transform: inverse },
  ]) {
    test(`keeps an invertible child under ${name}`, async () => {
      const result = await cleanBody(
        `<div style="${parentStyle}">${contents ? '<div style="display:contents">' : ''}` +
        `<p style="transform:${transform}">Visible child</p>${contents ? '</div>' : ''}</div>`,
      );

      assert.match(result.html, /Visible child/);
      assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }

  test('keeps local text and a flat descendant under a preserved near-singular plane', async () => {
    const result = await cleanBody(
      '<div style="transform-style:preserve-3d;transform:matrix(1,1,1,1.0000000000000018,0,0)">' +
      'Visible parent<p>Visible flat child</p></div>',
    );

    assert.match(result.html, /Visible parent/);
    assert.match(result.html, /Visible flat child/);
    assert.equal(result.markdown, 'Visible parent\n\nVisible flat child\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });

  test('keeps a restored flat subtree nested in a preserved identity context', async () => {
    const result = await cleanBody(
      '<div style="transform-style:preserve-3d">' +
      '<div style="transform:matrix(1,1,1,1.0000000000000018,0,0)">' +
      `<p style="transform:${inverse}">Visible child</p></div></div>`,
    );

    assert.match(result.html, /Visible child/);
    assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });
});
