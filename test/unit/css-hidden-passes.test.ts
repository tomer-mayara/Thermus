import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.ts';

describe('CSS visibility across hidden HTML removal passes', () => {
  for (const style of ['display:none', String.raw`d\69 splay:none`]) {
    test(`removes a CSS-hidden element formed after a removal with ${style}`, async () => {
      const html = `<style>.payload{${style}}</style><main>`
        + '<<span hidden>cut</span>p class="payload">HIDDEN PAYLOAD</p>'
        + '<p>VISIBLE CONTROL</p></main>';

      const result = await createPipeline().process('https://example.com/formed-css', html);

      assert.doesNotMatch(result.html, /HIDDEN PAYLOAD/);
      assert.doesNotMatch(result.markdown ?? '', /HIDDEN PAYLOAD/);
      assert.match(result.html, /VISIBLE CONTROL/);
      assert.match(result.markdown ?? '', /VISIBLE CONTROL/);
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 0);
      assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
    });
  }

  test('keeps inline visible overrides through later CSS scans', async () => {
    const html = '<style>.payload{display:none}</style><main>'
      + '<p class="payload" style="display:block!important;display:none">VISIBLE CONTROL</p>'
      + '<<span hidden>cut</span>p class="payload">HIDDEN PAYLOAD</p></main>';

    const result = await createPipeline().process('https://example.com/formed-css-override', html);

    assert.doesNotMatch(result.html, /HIDDEN PAYLOAD/);
    assert.doesNotMatch(result.markdown ?? '', /HIDDEN PAYLOAD/);
    assert.match(result.html, /VISIBLE CONTROL/);
    assert.match(result.markdown ?? '', /VISIBLE CONTROL/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
  });

  const sourceTagCases = [
    {
      name: 'a reconstructed formatting tag after hidden whitespace',
      html: '<style>body{display:none}.x{display:none}</style><body>\n'
        + '<b class="x" title="SECRET TITLE">HIDDEN<p>x</b>',
    },
    {
      name: 'a reconstructed link after hidden whitespace',
      html: '<style>body{display:none}.x{display:none}</style><body>\n'
        + '<a class="x" href="https://example.net/SECRET_URL" title="SECRET TITLE">HIDDEN<p>x</a>',
    },
    {
      name: 'a nested reconstructed link',
      html: '<style>.x{display:none}</style><b class="x">\n'
        + '<a class="x" href="https://example.net/SECRET_URL">HIDDEN<p>x</b></a>',
    },
  ];

  for (const { name, html } of sourceTagCases) {
    test(`removes hidden attributes from ${name}`, async () => {
      const result = await createPipeline().process('https://example.com/source-edit', html);

      assert.doesNotMatch(result.html, /SECRET|HIDDEN/);
      assert.doesNotMatch(result.markdown ?? '', /SECRET|HIDDEN/);
      assert.equal(result.markdown, '');
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 0);
      assert.doesNotMatch(result.warnings?.join('\n') ?? '', /scan failed|scan limit/);
    });
  }
});
