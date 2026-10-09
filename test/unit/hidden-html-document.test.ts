import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { PromptInjectionRemoverSanitizer } from '../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts';
import { createContext } from '../support/html-cleaner-context.ts';

const threatUrl = `https://attacker.example/?payload=${'a'.repeat(128)}`;

describe('hidden HTML document and template handling', () => {
  test('removes a body or html element formed as a hidden element', async () => {
    const sanitizer = new PromptInjectionRemoverSanitizer();
    const results: string[] = [];

    for (const tag of ['body', 'html']) {
      const result = await sanitizer.invoke(
        createContext(`<<span hidden>cut</span>${tag} hidden>secret</${tag}>`),
      );

      results.push(result.html);
    }

    assert.deepEqual(results, ['', '']);
  });

  test('removes a hidden body without a closing tag', async () => {
    const sanitizer = new PromptInjectionRemoverSanitizer();
    const inputs = [
      '<body hidden>secret',
      '<<span hidden>cut</span>body hidden>secret',
    ];
    const results: string[] = [];

    for (const html of inputs) {
      const result = await sanitizer.invoke(createContext(html));

      results.push(result.html);
    }

    assert.deepEqual(results, ['', '']);
  });

  test('removes body and html elements with inline hidden styles', async () => {
    const sanitizer = new PromptInjectionRemoverSanitizer();
    const inputs = [
      '<body style="display:none">secret</body>',
      '<html style="display:none">secret</html>',
    ];
    const results: string[] = [];

    for (const html of inputs) {
      const result = await sanitizer.invoke(createContext(html));

      results.push(result.html);
    }

    assert.deepEqual(results, ['', '']);
  });

  test('preserves a table after a hidden paragraph before it', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext(
        '<p hidden>secret<table><tr><td>visible</td></tr></table><p>tail</p>',
      ),
    );

    assert.equal(result.html, '<table><tr><td>visible</td></tr></table><p>tail</p>');
  });

  test('removes comments and hidden content from template content', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext('<template><!-- secret --><span hidden>secret</span></template><p>visible</p>'),
    );

    assert.equal(result.html, '<template></template><p>visible</p>');
  });

  test('removes hidden content from a template formed by an earlier removal', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext(
        '<p><<span hidden>cut</span>template><<span hidden>cut</span>span hidden>secret</span></template></p>',
      ),
    );

    assert.equal(result.html, '<p><template></template></p>');
  });

  test('keeps source offsets after nested template content with supplementary characters', async () => {
    const authoredMarker = '[hidden HTML removed]';
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext(
        `😀 ${authoredMarker} <template>𐐀<!-- secret --><template><span hidden>secret</span></template></template><p>visible</p>`,
      ),
    );

    assert.equal(
      result.html,
      `😀 ${authoredMarker} <template>𐐀<template></template></template><p>visible</p>`,
    );
  });

  test('does not expose visible template content from a hidden root', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext('<div hidden><template><p>secret</p></template></div><p>visible</p>'),
    );

    assert.equal(result.html, '<p>visible</p>');
  });

  test('reports a threat URL formed in template content before a later removal', async () => {
    const result = await new PromptInjectionRemoverSanitizer().invoke(
      createContext(
        `<template><<span hidden>cut</span>span hidden><<span hidden>cut</span>a href="${threatUrl}">Open</a></span></template><p>visible</p>`,
      ),
    );

    assert.equal(result.html, '<template></template><p>visible</p>');
    assert.deepEqual([...result.found ?? []].sort(), ['exfil-urls', 'hidden-html']);
    const warnings = result.warnings?.join('\n') ?? '';
    assert.equal(warnings.match(/link to attacker\.example: suspicious query parameter/g)?.length, 1);
    assert.equal(new Set(result.warnings).size, result.warnings?.length);
  });
});
