import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './fixtures/css-pipeline.ts';

describe('non-planar rank proof', () => {
  const largeMatrix = 'matrix(10000000000000000,10000000000000000,1,2,0,0)';
  const nearMatrix = 'matrix(1,1,1,1.0000000000000018,0,0) translateZ(1px)';
  for (const { name, start, transform, end } of [
    { name: 'a finite local composition', start: '', transform: `${largeMatrix} ${nearMatrix}`, end: '' },
    { name: 'a finite preserved composition',
      start: `<div style="transform-style:preserve-3d;transform:${largeMatrix};transform-origin:0 0 0">`,
      transform: nearMatrix, end: '</div>' },
  ]) {
    test(`keeps visible text under ${name} with a nonzero exact determinant`, async () => {
      const result = await cleanBody(start +
        `<p style="transform:${transform};transform-origin:0 0 0">Visible text</p>` + end,
      );

      assert.match(result.html, /Visible text/);
      assert.equal(result.markdown, 'Visible text\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }

  const inverse = 'matrix(562949953421313,-562949953421312,-562949953421312,562949953421312,0,0)';
  for (const { name, transform } of [
    { name: 'a Z translation', transform: 'matrix(1,1,1,1.0000000000000018,0,0) translateZ(1px)' },
    { name: 'a non-planar matrix',
      transform: 'matrix3d(1,1,0,0,1,1.0000000000000018,1,0,0,0,1,0,0,0,0,1)' },
  ]) {
    for (const { context, start, end } of [
      { context: 'flat', start: '', end: '' },
      { context: 'preserved identity', start: '<div style="transform-style:preserve-3d">', end: '</div>' },
      { context: 'preserved contents',
        start: '<div style="transform-style:preserve-3d"><div style="display:contents">', end: '</div></div>' },
    ]) {
      test(`keeps a restored child with ${name} in a ${context} context`, async () => {
        const result = await cleanBody(start +
          `<div style="transform:${transform};transform-origin:0 0 0">` +
          `<p style="transform:${inverse};transform-origin:0 0 0">Visible child</p></div>` + end,
        );

        assert.match(result.html, /Visible child/);
        assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
        assert.deepEqual(result.found, []);
      });
    }
  }
});
