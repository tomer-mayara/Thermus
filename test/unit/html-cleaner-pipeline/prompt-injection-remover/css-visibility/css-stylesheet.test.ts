import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { describe, test } from 'node:test';
import { createPipeline } from './helpers/css-pipeline.ts';

describe('stylesheet CSS visibility rules', () => {
  test('does not fetch linked stylesheets or CSS imports', async (t) => {
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
      '<!doctype html>',
      '<html><head><title>Local visibility test</title>',
      '<link rel="stylesheet" href="https://example.net/external.css">',
      '<style>@import url("https://example.org/imported.css"); .payload { display: none; }</style>',
      '</head><body><main><p class="payload">Hidden local style payload</p>',
      '<p>Visible local style control</p></main></body></html>',
    ].join('');

    const result = await createPipeline().process('https://example.com/visibility', html);
    const markdown = result.markdown ?? '';

    assert.deepEqual(calls, []);
    assert.doesNotMatch(result.html, /Hidden local style payload/);
    assert.doesNotMatch(markdown, /Hidden local style payload/);
    assert.match(result.html, /Visible local style control/);
    assert.match(markdown, /Visible local style control/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
  });

  test('matches type, attribute, and combinator selectors', async () => {
    const html = [
      '<!doctype html><html><head><title>Compound selectors</title>',
      '<style>main.content[data-kind="article"] > *.payload { display: none; }</style>',
      '</head><body><main class="content" data-kind="article">',
      '<p class="payload">Hidden compound selector target</p>',
      '<section><p class="payload">Visible nested selector control</p></section>',
      '<p class="other">Visible class selector control</p>',
      '</main></body></html>',
    ].join('');

    const result = await createPipeline().process('https://example.com/selectors', html);
    const markdown = result.markdown ?? '';

    assert.ok(!result.html.includes('Hidden compound selector target'));
    assert.ok(!markdown.includes('Hidden compound selector target'));
    assert.match(result.html, /Visible nested selector control/);
    assert.match(markdown, /Visible nested selector control/);
    assert.match(result.html, /Visible class selector control/);
    assert.match(markdown, /Visible class selector control/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
  });

  test('skips selector lists with unsupported namespaced attributes', async () => {
    const html = [
      '<!doctype html><html><head><title>Unsupported selectors</title>',
      '<style>',
      '.payload, [foo|bar] { display: none; }',
      '.other, [*|bar] { display: none; }',
      '.attribute, [data-x=a q] { display: none; }',
      '.relative, >.x { display: none; }',
      ':hover { display: none; }',
      '</style>',
      '<style media="print">.print-only { display: none; }</style>',
      '</head><body><main>',
      '<p class="payload">Visible named namespace selector control</p>',
      '<p class="other">Visible wildcard namespace selector control</p>',
      '<p class="attribute">Visible invalid attribute selector control</p>',
      '<p class="relative">Visible relative selector control</p>',
      '<p class="hover">Visible pseudo selector control</p>',
      '<p class="print-only">Visible inactive media control</p>',
      '</main></body></html>',
    ].join('');

    const result = await createPipeline().process('https://example.com/unsupported-selectors', html);
    const markdown = result.markdown ?? '';

    assert.match(result.html, /Visible named namespace selector control/);
    assert.match(markdown, /Visible named namespace selector control/);
    assert.match(result.html, /Visible wildcard namespace selector control/);
    assert.match(markdown, /Visible wildcard namespace selector control/);
    assert.match(result.html, /Visible invalid attribute selector control/);
    assert.match(markdown, /Visible invalid attribute selector control/);
    assert.match(result.html, /Visible relative selector control/);
    assert.match(markdown, /Visible relative selector control/);
    assert.match(result.html, /Visible pseudo selector control/);
    assert.match(markdown, /Visible pseudo selector control/);
    assert.match(result.html, /Visible inactive media control/);
    assert.match(markdown, /Visible inactive media control/);
    assert.deepEqual(result.found, []);
    assert.equal(result.skipped, 0);
  });

  test('limits output growth from a selected shared background image', async () => {
    const gradient = Array.from({ length: 128 }, (_, index) => {
      const color = index.toString(16).padStart(6, '0');
      return `#${color} ${index}%`;
    }).join(',');
    const html = [
      '<!doctype html><html><head><style>',
      `.painted{background-image:linear-gradient(${gradient})}`,
      '</style></head><body><main>',
      Array.from({ length: 100 }, (_, index) => `<p class="painted">Visible paragraph ${index}</p>`).join(''),
      '</main></body></html>',
    ].join('');

    const result = await createPipeline().process('https://example.com/shared-style', html);
    const markdown = result.markdown ?? '';

    assert.ok(Buffer.byteLength(result.html, 'utf8') <= Buffer.byteLength(html, 'utf8') + 100 * 40);
    for (let index = 0; index < 100; index++) {
      assert.ok(markdown.includes(`Visible paragraph ${index}`));
    }
    assert.deepEqual(result.found, []);
    assert.equal(result.skipped, 0);
  });

  test('normalizes inline visibility declarations in template content and nested templates', async () => {
    const html = [
      '<!doctype html><html><head><title>Template CSS</title></head><body><main>',
      '<style>.external-hide { display: none; }</style>',
      '<template><p style="display:none!important;display:block">Hidden important template text</p>',
      '<template><p style="position:absolute;left:-9999PX">Hidden offscreen nested template text</p></template>',
      '<p style="display:none;display:block!important">Visible template control</p></template>',
      '<template><style>.inner-hide { display: none; }</style>',
      '<p class="external-hide">Visible template selector control</p>',
      '<p class="inner-hide">Visible template stylesheet control</p></template>',
      '<p class="inner-hide">Visible template stylesheet document control</p>',
      '<p>Visible document control</p>',
      '</main></body></html>',
    ].join('');

    const result = await createPipeline().process('https://example.com/template-css', html);
    const markdown = result.markdown ?? '';

    assert.doesNotMatch(result.html, /Hidden important template text|Hidden offscreen nested template text/);
    assert.doesNotMatch(markdown, /Hidden important template text|Hidden offscreen nested template text/);
    assert.match(result.html, /Visible template control/);
    assert.match(result.html, /Visible template selector control/);
    assert.match(result.html, /Visible template stylesheet control/);
    assert.match(result.html, /Visible template stylesheet document control/);
    assert.match(markdown, /Visible template stylesheet document control/);
    assert.match(result.html, /Visible document control/);
    assert.match(markdown, /Visible document control/);
    assert.deepEqual(result.found, ['hidden-html']);
    assert.equal(result.skipped, 0);
  });
});
