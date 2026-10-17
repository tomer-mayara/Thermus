import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './fixtures/css-pipeline.ts';

describe('edge-on projection after composed rotations', () => {
  for (const transform of [
    'rotateX(90deg) rotate(45deg)',
    'rotateY(90deg) rotate(45deg)',
    'rotate(30deg) rotateX(90deg) rotate(45deg)',
  ]) {
    test(`removes text and images collapsed by ${transform}`, async () => {
      const result = await cleanBody(
        `<div style="transform:${transform}">` +
        '<p>Hidden edge-on text</p><img src="/edge-on.png" alt="Hidden edge-on image"></div>',
      );

      assert.doesNotMatch(result.html, /Hidden edge-on (?:text|image)/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, ['hidden-html']);
    });
  }

  for (const transform of [
    'rotateX(90deg) rotateX(-90deg)',
    'rotateX(45deg)',
  ]) {
    test(`keeps visible text and images for noncollapsed ${transform}`, async () => {
      const result = await cleanBody(
        `<div style="transform:${transform}">` +
        '<p>Visible rotated text</p><img src="/visible-rotated.png" alt="Visible rotated image"></div>',
      );

      assert.match(result.html, /Visible rotated text/);
      assert.match(result.html, /alt="Visible rotated image"/);
      assert.equal(result.markdown,
        'Visible rotated text\n\n![Visible rotated image](https://example.com/visible-rotated.png)\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }

  test('allows a preserved descendant to restore an edge-on plane', async () => {
    const result = await cleanBody(
      '<div style="transform:rotateX(90deg);transform-style:preserve-3d">' +
      '<div style="transform:rotateX(-90deg)"><p>Visible restored child</p></div></div>',
    );

    assert.match(result.html, /Visible restored child/);
    assert.equal(result.markdown, 'Visible restored child\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });
});
