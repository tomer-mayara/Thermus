import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './helpers/css-pipeline.ts';

describe('deferred declaration grammar', () => {
  for (const value of [
    'env(name garbage)', 'env(name 0 nope)', 'var(--x garbage)', 'var(--,16px)',
    'attr(data-size garbage,16px)', 'attr(|foo,16px)',
  ]) {
    for (const { property, hidden } of [
      { property: 'font-size', hidden: '0' }, { property: 'transform', hidden: 'scale(0)' },
    ]) {
      test(`keeps ${property} hidden after malformed ${value}`, async () => {
        const result = await cleanBody(`<p style="${property}:${hidden};${property}:${value}">Hidden payload</p>`);

        assert.doesNotMatch(result.html, /Hidden payload/);
        assert.equal(result.markdown, 'Visible sibling');
        assert.deepEqual(result.found, ['hidden-html']);
      });
    }
  }

  for (const value of [
    'env(viewport-segment-width 0 1,16px)', 'env(missing,var(--x,16px))', 'env(missing,)',
    'var(--x,)', 'var(\\2d \\2d x,16px)', 'attr(data-size type(<length>),16px)',
    'attr(data-size px,16px)',
  ]) {
    test(`keeps valid deferred declarations unknown with ${value}`, async () => {
      const result = await cleanBody(
        `<p style="font-size:0;font-size:${value}">Visible font</p>` +
        `<p style="transform:scale(0);transform:${value}">Visible transform</p>`,
      );

      assert.match(result.html, /Visible font/);
      assert.match(result.html, /Visible transform/);
      assert.equal(result.markdown, 'Visible font\n\nVisible transform\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }
});
