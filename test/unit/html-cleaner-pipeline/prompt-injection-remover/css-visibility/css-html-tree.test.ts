import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { describe, test } from 'node:test';
import { createPipeline } from './fixtures/css-pipeline.ts';

describe('CSS selectors on the browser HTML tree', () => {
  const cases = [
    { selector: 'table > tbody > tr', hidden: true },
    { selector: 'table > tr', hidden: false },
    { selector: 'table > tbody', hidden: true },
  ];

  for (const { selector, hidden } of cases) {
    test(`matches ${selector} with an implied table body`, async (t) => {
      const calls: string[] = [];
      const failIfCalled = (name: string) => () => {
        calls.push(name);
        throw new Error(`${name} must not be called`);
      };
      t.mock.method(globalThis, 'fetch', failIfCalled('fetch'));
      t.mock.method(http, 'get', failIfCalled('http.get'));
      t.mock.method(http, 'request', failIfCalled('http.request'));
      t.mock.method(https, 'get', failIfCalled('https.get'));
      t.mock.method(https, 'request', failIfCalled('https.request'));
      const html = [
        '<!doctype html><html><head><title>Table visibility</title>',
        '<link rel="stylesheet" href="https://example.net/external.css">',
        `<style>${selector}{display:none}</style>`,
        '</head><body><main><table><tr><td>Order total: $123.45</td></tr></table>',
        '<p>Visible table control</p></main></body></html>',
      ].join('');

      const result = await createPipeline().process('https://example.com/table', html);

      assert.equal(result.html.includes('Order total: $123.45'), !hidden);
      assert.equal(result.markdown?.includes('Order total: $123.45'), !hidden);
      assert.match(result.html, /Visible table control/);
      assert.match(result.markdown ?? '', /Visible table control/);
      assert.deepEqual(result.found, hidden ? ['hidden-html'] : []);
      assert.equal(result.skipped, 0);
      assert.deepEqual(calls, []);
    });
  }

  test('removes direct text in a hidden implied body', async () => {
    const html = '<!doctype html><style>body{display:none}</style>Hidden direct body text';

    const result = await createPipeline().process('https://example.com/implied-body', html);

    assert.doesNotMatch(result.html, /Hidden direct body text/);
    assert.doesNotMatch(result.markdown ?? '', /Hidden direct body text/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
  });

  test('removes hidden text moved out of a table', async () => {
    const html = '<!doctype html><style>body{display:none}</style>'
      + 'Leading text<table>Moved text<tr><td>Cell text</td></tr></table>';

    const result = await createPipeline().process('https://example.com/moved-text', html);

    assert.doesNotMatch(result.html, /Leading text|Moved text|Cell text/);
    assert.doesNotMatch(result.markdown ?? '', /Leading text|Moved text|Cell text/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
  });

  for (const hiddenFirst of [true, false]) {
    test(`keeps separate visibility for reconstructed formatting when hiddenFirst=${hiddenFirst}`, async () => {
      const html = [
        '<!doctype html><html><head><title>Reconstructed formatting</title><style>',
        `.x{display:${hiddenFirst ? 'none' : 'block'}}`,
        `p+p b.x{display:${hiddenFirst ? 'block' : 'none'}}`,
        '</style></head><body><main><p><b class="x" data-value="kept">',
        hiddenFirst ? 'HIDDEN PAYLOAD' : 'VISIBLE CONTROL',
        '<p>',
        hiddenFirst ? 'VISIBLE CONTROL' : 'HIDDEN PAYLOAD',
        '</b></p><p>OTHER CONTROL</p></main></body></html>',
      ].join('');

      const result = await createPipeline().process('https://example.com/reconstructed', html);

      assert.doesNotMatch(result.html, /HIDDEN PAYLOAD/);
      assert.doesNotMatch(result.markdown ?? '', /HIDDEN PAYLOAD/);
      assert.match(result.html, /VISIBLE CONTROL/);
      assert.match(result.markdown ?? '', /VISIBLE CONTROL/);
      assert.match(result.html, /OTHER CONTROL/);
      assert.match(result.markdown ?? '', /OTHER CONTROL/);
      assert.match(result.html, /data-value="kept"/);
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 0);
    });
  }

  test('removes attributes when every reconstructed copy is hidden', async () => {
    const html = '<!doctype html><html><head><style>.x{display:none}</style></head><body><main>'
      + '<p><a class="x" href="https://example.net/?q=HIDDEN_URL" title="HIDDEN TITLE">'
      + 'HIDDEN ONE<p>HIDDEN TWO</a></p><p>VISIBLE CONTROL</p></main></body></html>';

    const result = await createPipeline().process('https://example.com/hidden-copies', html);

    assert.doesNotMatch(result.html, /HIDDEN/);
    assert.doesNotMatch(result.markdown ?? '', /HIDDEN/);
    assert.match(result.html, /VISIBLE CONTROL/);
    assert.match(result.markdown ?? '', /VISIBLE CONTROL/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
  });

  for (const formatting of ['<b class="x">', '<b class="x"><i>']) {
    test(`keeps visible text after locationless copies of ${formatting}`, async () => {
      const html = '<!doctype html><html><head><style>.x{display:none}</style></head><body><main>'
        + formatting + 'HIDDEN PAYLOAD<p></b>VISIBLE CONTROL</main></body></html>';

      const result = await createPipeline().process('https://example.com/locationless-copies', html);

      assert.doesNotMatch(result.html, /HIDDEN PAYLOAD/);
      assert.doesNotMatch(result.markdown ?? '', /HIDDEN PAYLOAD/);
      assert.match(result.html, /VISIBLE CONTROL/);
      assert.match(result.markdown ?? '', /VISIBLE CONTROL/);
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 0);
    });
  }

  for (const copiedText of ['', 'HIDDEN SECOND']) {
    test(`keeps source tag structure around hidden copies with text=${copiedText}`, async () => {
      const html = '<!doctype html><html><head><style>.x{display:none}</style></head><body>'
        + `<main><p><b class="x"><b class="x"><div>HIDDEN FIRST<p>${copiedText}</b></div>`
        + 'HIDDEN PAYLOAD</main></body></html>';

      const result = await createPipeline().process('https://example.com/hidden-closing-tags', html);

      assert.doesNotMatch(result.html, /HIDDEN/);
      assert.equal(result.markdown, '');
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 0);
    });
  }
});
