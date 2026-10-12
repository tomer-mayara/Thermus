import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody, createPipeline } from './helpers/css-pipeline.ts';

describe('HTML root font size in foreign content', () => {
  for (const { rootSize, foreignSize, visible } of [
    { rootSize: '16px', foreignSize: '0', visible: true },
    { rootSize: '0', foreignSize: '16px', visible: false },
  ]) {
    test(`${visible ? 'keeps' : 'removes'} rem text from the true HTML root size ${rootSize}`, async () => {
      const result = await createPipeline().process('https://example.com/',
        `<!doctype html><html style="font-size:${rootSize}"><body><main>` +
        `<svg><html style="font-size:${foreignSize}"></html></svg>` +
        '<p style="font-size:1rem">Target text</p>' +
        '<p style="font-size:16px">Visible sibling</p></main></body></html>',
      );

      if (visible) assert.match(result.html, /Target text/);
      else assert.doesNotMatch(result.html, /Target text/);
      assert.equal(result.markdown, visible ? 'Target text\n\nVisible sibling' : 'Visible sibling');
      assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
    });
  }
});

describe('zero-font inputs without a value', () => {
  for (const { name, value } of [
    { name: 'missing', value: '' }, { name: 'empty', value: ' value=""' },
  ]) {
    test(`keeps an input whose value is ${name} without a hidden finding`, async () => {
      const result = await cleanBody(`<input type="text" style="font-size:0"${value}>`);

      assert.match(result.html, /<input\b/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, []);
    });
  }
});
