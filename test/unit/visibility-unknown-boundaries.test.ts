import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody, createPipeline } from './helpers/css-pipeline.ts';

describe('HTML root transforms with unresolved display', () => {
  for (const display of ['inherit', 'revert', 'var(--missing,inline)', 'var(--missing,none)']) {
    for (const scale of [0, 1]) {
      test(`${scale ? 'keeps' : 'removes'} root text with display ${display} and scale ${scale}`, async () => {
        const result = await createPipeline().process('https://example.com/',
          `<!doctype html><html style="display:${display};transform:scale(${scale})">` +
          '<body><main><p>Target text</p></main></body></html>',
        );

        if (scale) assert.match(result.html, /Target text/);
        else assert.doesNotMatch(result.html, /Target text/);
        assert.equal(result.markdown, scale ? 'Target text' : '');
        assert.deepEqual(result.found, scale ? [] : ['hidden-html']);
      });
    }
  }

  test('removes an explicit display none root despite an identity transform', async () => {
    const result = await createPipeline().process('https://example.com/',
      '<!doctype html><html style="display:none;transform:scale(1)">' +
      '<body><main><p>Hidden payload</p></main></body></html>',
    );

    assert.doesNotMatch(result.html, /Hidden payload/);
    assert.equal(result.markdown, '');
    assert.deepEqual(result.found, ['hidden-html']);
  });
});

describe('uncertain contents flattening boundary', () => {
  for (const { name, display, visible, extraContents = false } of [
    { name: 'an unresolved contents fallback', display: 'var(--missing,contents)', visible: true },
    { name: 'a known contents wrapper', display: 'contents', visible: true },
    { name: 'a known block wrapper', display: 'block', visible: false },
    { name: 'an unresolved boundary followed by a contents wrapper',
      display: 'var(--missing,contents)', visible: true, extraContents: true },
  ]) {
    test(`${visible ? 'keeps' : 'removes'} a restored child through ${name}`, async () => {
      const result = await cleanBody(
        '<div style="transform-style:preserve-3d;transform:rotateX(45deg) rotateX(45deg)">' +
        `<div style="display:${display}">${extraContents ? '<div style="display:contents">' : ''}` +
        '<p style="transform:rotateX(-45deg)">Target child</p>' +
        (extraContents ? '</div>' : '') + '</div></div>',
      );

      if (visible) assert.match(result.html, /Target child/);
      else assert.doesNotMatch(result.html, /Target child/);
      assert.equal(result.markdown, visible ? 'Target child\n\nVisible sibling' : 'Visible sibling');
      assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
    });
  }

  test('ignores a local collapsed transform on a contents wrapper', async () => {
    const result = await cleanBody(
      '<div style="display:contents;transform:scale(0)"><p>Visible child</p></div>',
    );

    assert.match(result.html, /Visible child/);
    assert.equal(result.markdown, 'Visible child\n\nVisible sibling');
    assert.deepEqual(result.found, []);
  });
});
