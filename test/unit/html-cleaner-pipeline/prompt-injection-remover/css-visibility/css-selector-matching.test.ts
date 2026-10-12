import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.ts';

describe('CSS selector token matching', () => {
  const matchingCases = [
    {
      name: 'keeps a nonbreaking space inside an escaped class name',
      style: String.raw`.pay\a0 load{display:none}`,
      body: '<p class="pay&nbsp;load">HIDDEN TARGET</p><p class="pay load">VISIBLE CONTROL</p>',
    },
    {
      name: 'splits class names only at HTML whitespace',
      style: '.payload{display:none}',
      body: '<p class="safe&#9;&#10;&#12;&#13; payload">HIDDEN TARGET</p>'
        + '<p class="safe&nbsp;payload">VISIBLE CONTROL</p>',
    },
    {
      name: 'keeps a nonbreaking space inside an attribute word',
      style: String.raw`[data-words~="pay\a0 load"]{display:none}`,
      body: '<p data-words="pay&nbsp;load">HIDDEN TARGET</p>'
        + '<p data-words="pay load">VISIBLE CONTROL</p>',
    },
    {
      name: 'splits attribute words only at HTML whitespace',
      style: '[data-words~="payload"]{display:none}',
      body: '<p data-words="safe&#9;&#10;&#12;&#13; payload">HIDDEN TARGET</p>'
        + '<p data-words="safe&nbsp;payload">VISIBLE CONTROL</p>',
    },
    {
      name: 'accepts an escaped leading digit in an ID selector',
      style: String.raw`#\31 x{display:none}`,
      body: '<p id="1x">HIDDEN TARGET</p><p id="other">VISIBLE CONTROL</p>',
    },
    {
      name: 'keeps different accented letters distinct with the insensitive flag',
      style: '[data-city="QUÉBEC" i]{display:none}',
      body: '<p data-city="quÉbec">HIDDEN TARGET</p><p data-city="Québec">VISIBLE CONTROL</p>',
    },
    {
      name: 'keeps the sensitive flag on a normally insensitive attribute',
      style: '[rel="NEXT" s]{display:none}',
      body: '<p rel="NEXT">HIDDEN TARGET</p><p rel="next">VISIBLE CONTROL</p>',
    },
    {
      name: 'keeps the default ASCII insensitive matching for rel',
      style: '[rel~="NEXT"]{display:none}',
      body: '<p rel="next">HIDDEN TARGET</p><p rel="NéXT">VISIBLE CONTROL</p>',
    },
  ];
  for (const { name, style, body } of matchingCases) {
    test(name, async () => {
      const html = '<!doctype html><html><head><title>Selector matching</title>'
        + `<style>${style}</style></head><body><main>${body}</main></body></html>`;

      const result = await createPipeline().process('https://example.com/selectors', html);

      assert.doesNotMatch(result.html, /HIDDEN TARGET/);
      assert.doesNotMatch(result.markdown ?? '', /HIDDEN TARGET/);
      assert.match(result.html, /VISIBLE CONTROL/);
      assert.match(result.markdown ?? '', /VISIBLE CONTROL/);
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 0);
    });
  }

  for (const operator of ['=', '^=', '$=', '*=', '~=', '|=']) {
    test(`uses only ASCII case folding for the ${operator} attribute operator`, async () => {
      const html = '<!doctype html><html><head><title>Attribute matching</title>'
        + `<style>[data-x${operator}"k" i]{display:none}</style></head><body><main>`
        + '<p data-x="K">HIDDEN ASCII</p><p data-x="K">VISIBLE KELVIN</p>'
        + '</main></body></html>';

      const result = await createPipeline().process('https://example.com/selectors', html);

      assert.doesNotMatch(result.html, /HIDDEN ASCII/);
      assert.doesNotMatch(result.markdown ?? '', /HIDDEN ASCII/);
      assert.match(result.html, /VISIBLE KELVIN/);
      assert.match(result.markdown ?? '', /VISIBLE KELVIN/);
      assert.deepEqual(result.found, ['hidden-html']);
      assert.equal(result.skipped, 0);
    });
  }

  for (const invalidSelector of ['#1x', '#-1x', '#-', '[data-x=1]', '[data-x i]']) {
    test(`rejects the complete selector list when ${invalidSelector} is invalid`, async () => {
      const html = '<!doctype html><html><head><title>Invalid identifier</title>'
        + `<style>.payload,${invalidSelector}{display:none}</style></head><body><main>`
        + '<p class="payload">VISIBLE CONTROL</p></main></body></html>';

      const result = await createPipeline().process('https://example.com/selectors', html);

      assert.match(result.html, /VISIBLE CONTROL/);
      assert.match(result.markdown ?? '', /VISIBLE CONTROL/);
      assert.deepEqual(result.found, []);
      assert.equal(result.skipped, 0);
    });
  }

  test('treats an escaped star as a type name and makes no stylesheet request', async (t) => {
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
    const html = '<!doctype html><html><head><title>Escaped type name</title>'
      + '<link rel="stylesheet" href="https://example.net/external.css">'
      + String.raw`<style>\*{display:none}</style></head><body><main>`
      + '<p>VISIBLE CONTROL</p></main></body></html>';

    const result = await createPipeline().process('https://example.com/selectors', html);

    assert.deepEqual(calls, []);
    assert.match(result.html, /VISIBLE CONTROL/);
    assert.match(result.markdown ?? '', /VISIBLE CONTROL/);
    assert.deepEqual(result.found, []);
    assert.equal(result.skipped, 0);
  });
});
