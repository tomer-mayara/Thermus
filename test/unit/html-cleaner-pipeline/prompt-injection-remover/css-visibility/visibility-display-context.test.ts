import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './helpers/css-pipeline.ts';

describe('inline list item transform applicability', () => {
  for (const { display, visible } of [
    { display: 'inline list-item', visible: true },
    { display: 'inline flow list-item', visible: true },
    { display: 'list-item inline flow', visible: true },
    { display: 'run-in flow', visible: true },
    { display: 'run-in flow list-item', visible: true },
    { display: 'inline flow-root list-item', visible: false },
  ]) {
    test(`${visible ? 'keeps' : 'removes'} a collapsed element with display ${display}`, async () => {
      const result = await cleanBody(`<div style="display:${display};transform:scale(0)">Target text</div>`);

      if (visible) assert.match(result.html, /Target text/);
      else assert.doesNotMatch(result.html, /Target text/);
      assert.equal(result.markdown, visible ? 'Target text\n\nVisible sibling' : 'Visible sibling');
      assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
    });
  }
});

describe('unknown box context for identity transforms', () => {
  for (const transform of ['', 'none', 'initial', 'unset']) {
    test(`keeps a child plane through an unknown display with ${transform || 'no local transform'}`, async () => {
      const result = await cleanBody(
        '<div style="transform-style:preserve-3d;transform:rotateX(45deg)">' +
        '<div style="display:var(--missing,inline);transform-style:preserve-3d;' +
        `${transform ? `transform:${transform}` : ''}">` +
        '<p style="transform:rotateX(45deg)">Visible child</p></div></div>',
      );

      assert.match(result.html, /Visible child/);
      assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
      assert.deepEqual(result.found, []);
    });
  }

  for (const { display, visible } of [
    { display: 'inline', visible: true }, { display: 'block', visible: false },
  ]) {
    test(`${visible ? 'keeps' : 'removes'} a child plane through a known ${display} box`, async () => {
      const result = await cleanBody(
        '<div style="transform-style:preserve-3d;transform:rotateX(45deg)">' +
        `<div style="display:${display};transform-style:preserve-3d">` +
        '<p style="transform:rotateX(45deg)">Target child</p></div></div>',
      );

      if (visible) assert.match(result.html, /Target child/);
      else assert.doesNotMatch(result.html, /Target child/);
      assert.equal(result.markdown, visible ? 'Target child\n\nVisible sibling' : 'Visible sibling');
      assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
    });
  }

  test('keeps unknown box context through a contents wrapper', async () => {
    const result = await cleanBody(
      '<div style="transform-style:preserve-3d;transform:rotateX(45deg)">' +
      '<div style="display:var(--missing,inline);transform-style:preserve-3d">' +
      '<div style="display:contents"><p style="transform:rotateX(45deg)">Visible child</p></div></div></div>',
    );

    assert.match(result.html, /Visible child/);
    assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });
});
