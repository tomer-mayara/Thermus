import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { describe, test } from 'node:test';
import { applyCssVisibility } from '../../src/html-cleaner-pipeline/prompt-injection-remover/css-visibility.ts';
import { createPipeline } from './helpers/css-pipeline.ts';

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
      assert.equal(result.skipped, Number(hidden));
      assert.deepEqual(calls, []);
    });
  }

  test('removes direct text in a hidden implied body', async () => {
    const html = '<!doctype html><style>body{display:none}</style>Hidden direct body text';

    const result = await createPipeline().process('https://example.com/implied-body', html);

    assert.doesNotMatch(result.html, /Hidden direct body text/);
    assert.doesNotMatch(result.markdown ?? '', /Hidden direct body text/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 1);
  });

  test('does not duplicate source text moved out of a table', () => {
    const html = '<!doctype html><style>body{display:none}</style>'
      + 'Leading text<table>Moved text<tr><td>Cell text</td></tr></table>';

    const rewritten = applyCssVisibility(html);

    assert.equal(rewritten.split('Leading text').length, 2);
    assert.equal(rewritten.split('Moved text').length, 2);
    assert.equal(rewritten.split('Cell text').length, 2);
    assert.equal(rewritten.split('<table').length, 2);
  });
});
