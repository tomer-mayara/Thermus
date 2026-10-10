import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { cleanBody } from './helpers/css-pipeline.ts';

const payload = 'Target text<img src="/target.png" alt="Target image">';
const offsets = ['1208925819614629174706176', '-100000000', '-1208925819614629174706176', '100000000'];
const overflowOffsets = ['-1e308', '-1e308', '1e308', '1e308'];
const matrix = (offset: string, axis = 'X') =>
  `matrix(1,0,0,1,${axis === 'X' ? offset : '0'},${axis === 'Y' ? offset : '0'})`;
const nested = (values: string[], axis = 'X', content = payload) =>
  values.reduceRight((body, offset) => `<div style="transform:${matrix(offset, axis)}">${body}</div>`, content);

describe('translation uncertainty and exact cancellation', () => {
  for (const axis of ['X', 'Y']) {
    for (const inherited of [false, true]) {
      test(`keeps text and an image after ${inherited ? 'nested' : 'local'} ${axis} offset cancellation`, async () => {
        const body = inherited ? nested(offsets, axis)
          : `<div style="transform:${offsets.map(offset => matrix(offset, axis)).join(' ')}">${payload}</div>`;
        const result = await cleanBody(body);

        assert.match(result.html, /Target text/);
        assert.match(result.html, /src="\/target\.png"/);
        assert.equal(result.markdown,
          'Target text ![Target image](https://example.com/target.png)\n\nVisible sibling');
        assert.deepEqual(result.found, []);
      });
    }
  }

  for (const { name, body, head = '', visible } of [
    { name: 'an equivalent translateX list', visible: true,
      body: `<div style="transform:${offsets.map(offset => `translateX(${offset}px)`).join(' ')}">${payload}</div>` },
    { name: 'a cancelling matrix list from a class rule', visible: true,
      body: `<div class="target">${payload}</div>`,
      head: `<style>.target{transform:${offsets.map(offset => matrix(offset, 'Y')).join(' ')}}</style>` },
    { name: 'nested offsets that overflow before cancellation', visible: true, body: nested(overflowOffsets) },
    { name: 'a local offset list that overflows before cancellation', visible: true,
      body: `<div style="transform:${overflowOffsets.map(offset => matrix(offset)).join(' ')}">${payload}</div>` },
    { name: 'a positive parent offset that rounds to zero before a relative child', visible: true,
      body: `<div style="transform:${[offsets[0], '1000000', offsets[2]].map(offset => matrix(offset)).join(' ')}">` +
        `<div style="transform:translateX(-100vw)">${payload}</div></div>` },
    { name: 'a contents wrapper between cancelling ancestors', visible: true,
      body: nested(offsets.slice(0, 3), 'X', `<div style="display:contents">${nested(offsets.slice(3))}</div>`) },
    { name: 'a genuinely negative X offset', visible: false,
      body: `<div style="transform:${matrix('-1000000')}">${payload}</div>` },
    { name: 'a genuinely negative Y offset', visible: false,
      body: `<div style="transform:${matrix('-1000000', 'Y')}">${payload}</div>` },
    { name: 'a child that restores a negative ancestor offset', visible: true,
      body: nested(['-1000000', '1000000']) },
    { name: 'a relative offscreen translation under a proven identity ancestor', visible: false,
      body: `<div style="transform:matrix(1,0,0,1,0,0)">` +
        `<div style="transform:translateX(-100vw)">${payload}</div></div>` },
    { name: 'a relative translation under an unknown parent offset', visible: true,
      body: `<div style="transform:translateX(1em)"><div style="transform:translateX(-100vw)">${payload}</div></div>` },
  ]) {
    test(`${visible ? 'keeps' : 'removes'} text and an image with ${name}`, async () => {
      const result = await cleanBody(body, head);

      if (visible) {
        assert.match(result.html, /Target text/);
        assert.match(result.html, /src="\/target\.png"/);
      } else {
        assert.doesNotMatch(result.html, /Target text|src="\/target\.png"/);
      }
      assert.equal(result.markdown, visible
        ? 'Target text ![Target image](https://example.com/target.png)\n\nVisible sibling'
        : 'Visible sibling');
      assert.deepEqual(result.found, visible ? [] : ['hidden-html']);
    });
  }
});
