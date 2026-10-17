import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './fixtures/css-pipeline.ts';

async function cleanBody(body: string) {
  return createPipeline().process('https://example.com/',
    `<!doctype html><html><body><main>${body}<p>Visible sibling</p></main></body></html>`);
}

describe('offscreen replaced content', () => {
  test('removes an offscreen input and its value', async () => {
    const result = await cleanBody(
      '<input style="transform:translateX(-1000000px)" value="Hidden payload">',
    );

    assert.doesNotMatch(result.html, /<input\b|Hidden payload/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('removes an inherited offscreen input while keeping a restored child', async () => {
    const result = await cleanBody(
      '<div style="transform:translateX(-1000000px)"><input value="Hidden payload">' +
      '<p style="transform:translateX(1000000px)">Visible child</p></div>',
    );

    assert.doesNotMatch(result.html, /<input\b|Hidden payload/);
    assert.match(result.html, /Visible child/);
    assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
    assert.deepEqual(result.found, ['hidden-html']);
  });

  test('keeps a visible input and its value', async () => {
    const result = await cleanBody('<input value="Visible value">');

    assert.match(result.html, /<input\b[^>]*value="Visible value"/);
    assert.equal(result.markdown, 'Visible sibling');
    assert.deepEqual(result.found, []);
  });
});

describe('singularity boundaries with unresolved transforms', () => {
  const nearSingular = 'matrix(1,1,1,1.0000000000000018,0,0)';
  const inverse = 'matrix(562949953421313,-562949953421312,-562949953421312,562949953421312,0,0)';
  const unresolvedInverse =
    'matrix(calc(562949953421313),-562949953421312,-562949953421312,562949953421312,0,0)';

  test('keeps a preserved child whose inverse restores a near-singular parent', async () => {
    const result = await cleanBody(
      `<div style="transform-style:preserve-3d;transform:${nearSingular}">` +
      `<p style="transform:${inverse}">Visible child</p></div>`,
    );

    assert.match(result.html, /Visible child/);
    assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });

  for (const { name, transform, visible } of [
    { name: 'a resolved inverse', transform: `${nearSingular} ${inverse}`, visible: true },
    { name: 'an unresolved inverse', transform: `${nearSingular} ${unresolvedInverse}`, visible: true },
    { name: 'a truly singular operand and unresolved inverse',
      transform: `matrix(1,1,1,1,0,0) ${unresolvedInverse}`, visible: false },
  ]) {
    test(`${visible ? 'keeps' : 'removes'} content with ${name}`, async () => {
      const result = await cleanBody(`<div style="transform:${transform}">Target content</div>`);

      if (visible) assert.match(result.html, /Target content/);
      else assert.doesNotMatch(result.html, /Target content/);
      assert.equal(result.markdown, visible ? 'Target content\n\nVisible sibling' : 'Visible sibling');
      assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
    });
  }
});
