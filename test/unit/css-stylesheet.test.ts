import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import { describe, test } from 'node:test';
import { applyCssVisibility } from '../../src/html-cleaner-pipeline/prompt-injection-remover/css-visibility.ts';
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
    assert.equal(result.skipped, 1);
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
    assert.equal(result.skipped, 1);
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

  test('limits output growth from irrelevant stylesheet declarations', () => {
    const html = [
      '<!doctype html><html><head><style>*{--unused:',
      'x'.repeat(4096),
      '}</style></head><body><main>',
      '<p>Visible</p>'.repeat(100),
      '</main></body></html>',
    ].join('');

    const rewritten = applyCssVisibility(html);

    assert.ok(rewritten.length <= html.length + 100 * 40);
    assert.equal((rewritten.match(/<p>Visible<\/p>/g) ?? []).length, 100);
  });
});
