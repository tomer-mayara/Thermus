import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './helpers/css-pipeline.ts';

describe('native control and form box transform applicability', () => {
  for (const tag of ['button', 'meter', 'progress', 'fieldset']) {
    const keepsContents = tag === 'button' || tag === 'fieldset';
    for (const { name, style, visible } of [
      { name: 'a default box with a collapsed transform', style: 'transform:scale(0)', visible: false },
      { name: 'a default box with an identity transform', style: 'transform:scale(1)', visible: true },
      { name: 'explicit display none', style: 'display:none;transform:scale(1)', visible: false },
      { name: 'explicit block display with a collapsed transform',
        style: 'display:block;transform:scale(0)', visible: false },
      { name: 'explicit inline display with a collapsed transform',
        style: 'display:inline;transform:scale(0)', visible: !keepsContents },
      { name: 'display contents with a local collapsed transform',
        style: 'display:contents;transform:scale(0)', visible: keepsContents },
    ]) {
      test(`${visible ? 'keeps' : 'removes'} ${tag} text with ${name}`, async () => {
        const attributes = keepsContents ? '' : ' max="10" value="5"';
        const result = await cleanBody(`<${tag}${attributes} style="${style}">Target text</${tag}>`);

        if (visible) assert.match(result.html, /Target text/);
        else assert.doesNotMatch(result.html, /Target text/);
        assert.equal(result.markdown,
          visible && !keepsContents ? 'Target text\n\nVisible sibling' : 'Visible sibling');
        assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
      });
    }
  }
});

describe('native button font defaults with an identity transform', () => {
  for (const { name, font, visible } of [
    { name: 'an independent default font', font: '', visible: true },
    { name: 'explicit zero-font inheritance', font: ';font-size:inherit', visible: false },
  ]) {
    test(`${visible ? 'keeps' : 'removes'} a button label with ${name}`, async () => {
      const result = await cleanBody(
        `<div style="font-size:0"><button style="transform:scale(1)${font}">Target label</button></div>`,
      );

      if (visible) assert.match(result.html, /Target label/);
      else assert.doesNotMatch(result.html, /Target label/);
      assert.equal(result.markdown, 'Visible sibling');
      assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
    });
  }
});
