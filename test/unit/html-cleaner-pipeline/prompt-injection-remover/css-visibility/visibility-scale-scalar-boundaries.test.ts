import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './fixtures/css-pipeline.ts';

describe('scale factors with scalar math wrappers', () => {
  for (const { transform, hidden } of [
    { transform: 'scale(0,calc(1))', hidden: true },
    { transform: 'scale(calc(1),0)', hidden: true },
    { transform: 'scale(0,calc(100%))', hidden: true },
    { transform: 'scale(0%,calc(1))', hidden: true },
    { transform: 'scale3d(0,calc(1),calc(1))', hidden: true },
    { transform: 'scale3d(calc(1),0,calc(1))', hidden: true },
    { transform: 'scale3d(calc(1),calc(1),0)', hidden: true },
    { transform: 'scale(0,calc(calc(1)))', hidden: true },
    { transform: 'scale(0,calc((1)))', hidden: true },
    { transform: 'scale(calc(0),1)', hidden: true },
    { transform: 'scale(1,calc(1))', hidden: false },
    { transform: 'scale3d(calc(1),1,1)', hidden: false },
  ]) {
    test(`${hidden ? 'removes' : 'keeps'} text with ${transform}`, async () => {
      const result = await cleanBody(`<p style="transform:${transform}">Target text</p>`);

      if (hidden) assert.doesNotMatch(result.html, /Target text/);
      else assert.match(result.html, /Target text/);
      assert.equal(result.markdown, hidden ? 'Visible sibling' : 'Target text\n\nVisible sibling');
      assert.deepEqual(result.found, hidden ? ['hidden-html'] : []);
    });
  }
});

describe('invalid and unresolved scale math', () => {
  for (const factor of ['calc()', 'calc(bogus)', 'calc(1px)', 'calc(1 +)', 'var(--factor)', 'calc(1 + 1)']) {
    test(`keeps text when the second scale factor is ${factor}`, async () => {
      const result = await cleanBody(`<p style="transform:scale(0,${factor})">Visible text</p>`);

      assert.match(result.html, /Visible text/);
      assert.equal(result.markdown, 'Visible text\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }
});
