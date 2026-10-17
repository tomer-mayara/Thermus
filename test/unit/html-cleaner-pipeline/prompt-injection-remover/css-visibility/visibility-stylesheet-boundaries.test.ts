import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody, createPipeline } from './fixtures/css-pipeline.ts';

describe('content visibility grouping', () => {
  for (const { style, visible } of [
    { style: 'content-visibility:auto', visible: true },
    { style: 'content-visibility:visible', visible: false },
    { style: 'content-visibility:auto;content-visibility:visible', visible: false },
    { style: 'content-visibility:auto!important;content-visibility:visible', visible: true },
    { style: 'content-visibility:auto;content-visibility:visible!important', visible: false },
    { style: 'content-visibility:auto;content-visibility:var(--state)', visible: true },
  ]) {
    test(`${visible ? 'keeps' : 'removes'} a child plane with ${style}`, async () => {
      const result = await cleanBody(
        `<div style="transform-style:preserve-3d;transform:rotateX(45deg);${style}">` +
        '<p style="transform:rotateX(45deg)">Target child</p></div>',
      );

      if (visible) assert.match(result.html, /Target child/);
      else assert.doesNotMatch(result.html, /Target child/);
      assert.equal(result.markdown, visible ? 'Target child\n\nVisible sibling' : 'Visible sibling');
      assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
    });
  }

  test('keeps a child plane flattened by a content visibility class', async () => {
    const result = await cleanBody(
      '<div class="auto" style="transform-style:preserve-3d;transform:rotateX(45deg)">' +
      '<p style="transform:rotateX(45deg)">Target child</p></div>',
      '<style>.auto{content-visibility:auto}</style>',
    );

    assert.match(result.html, /Target child/);
    assert.equal(result.markdown, 'Target child\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });
});

describe('stylesheet characterization controls', () => {
  test('keeps later deferred font and transform declarations from class rules', async () => {
    const result = await cleanBody(
      '<p class="font">Visible font</p><p class="transform">Visible transform</p>',
      '<style>.font{font-size:0;font-size:var(--size)}' +
      '.transform{transform:scale(0);transform:var(--matrix)}</style>',
    );

    assert.match(result.html, /Visible font/);
    assert.match(result.html, /Visible transform/);
    assert.equal(result.markdown, 'Visible font\n\nVisible transform\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });

  for (const { mode, doctype, visible } of [
    { mode: 'quirks', doctype: '', visible: true },
    { mode: 'standards', doctype: '<!doctype html>', visible: false },
    { mode: 'limited quirks', visible: false,
      doctype: '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">' },
  ]) {
    test(`applies a class unitless font size in ${mode} mode`, async () => {
      const result = await createPipeline().process('https://example.com/',
        `${doctype}<html><head><style>.target{font-size:0;font-size:16}</style></head>` +
        '<body><main><p class="target">Target text</p><p>Visible sibling</p></main></body></html>',
      );

      if (visible) assert.match(result.html, /Target text/);
      else assert.doesNotMatch(result.html, /Target text/);
      assert.equal(result.markdown, visible ? 'Target text\n\nVisible sibling' : 'Visible sibling');
      assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
    });
  }

  for (const { style, visible } of [
    { style: 'overflow-x:hidden', visible: true },
    { style: 'overflow-y:hidden', visible: true },
    { style: 'overflow-x:hidden;overflow:visible', visible: false },
    { style: 'overflow-x:hidden!important;overflow:visible', visible: true },
  ]) {
    test(`applies grouping and cascade with ${style}`, async () => {
      const result = await cleanBody(
        '<div class="parent"><p style="transform:rotateX(45deg)">Target child</p></div>',
        `<style>.parent{transform-style:preserve-3d;transform:rotateX(45deg);${style}}</style>`,
      );

      if (visible) assert.match(result.html, /Target child/);
      else assert.doesNotMatch(result.html, /Target child/);
      assert.equal(result.markdown, visible ? 'Target child\n\nVisible sibling' : 'Visible sibling');
      assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
    });
  }
});
