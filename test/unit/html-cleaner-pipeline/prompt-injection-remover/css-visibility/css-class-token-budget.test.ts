import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'css-tree';
import { createSelectorMatcher } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-selectors.ts';
import { SourceHtmlDocument } from '../../../../../src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-tree.ts';

test('Given a long class list, when several selectors repeatedly match its tokens, then class parsing does not exhaust the work budget', () => {
  const tree = SourceHtmlDocument.parse(`<p class="${'ordinary '.repeat(500)}payload">Visible</p>`);
  const element = tree.elements.find((node) => node.name === 'p');
  assert.ok(element);
  const matcher = createSelectorMatcher(tree.document);
  for (const selector of ['.payload', '.payload.payload', '.ordinary.payload']) {
    const queries = matcher(parse(selector, { context: 'selectorList' }));
    assert.ok(queries);
    for (let attempt = 0; attempt < 300; attempt++) {
      assert.equal(queries[0].query(element), true);
    }
  }
});

test('Given a cached class list, when matching continues past the work budget, then token lookups still fail at the limit', () => {
  const tree = SourceHtmlDocument.parse('<p class="payload">Visible</p>');
  const element = tree.elements.find((node) => node.name === 'p');
  assert.ok(element);
  const queries = createSelectorMatcher(tree.document)(parse('.payload', { context: 'selectorList' }));
  assert.ok(queries);

  assert.throws(() => {
    for (let attempt = 0; attempt < 1_000_001; attempt++) queries[0].query(element);
  }, { name: 'RangeError', message: 'CSS selector work limit exceeded' });

  const nextScan = createSelectorMatcher(tree.document)(parse('.payload', { context: 'selectorList' }));
  assert.ok(nextScan);
  assert.equal(nextScan[0].query(element), true);
});

test('Given successive document scans, when the same class selector runs in each authored mode, then each scan uses its own class tokens and ASCII case rules', () => {
  for (const [doctype, selector, className, expected] of [
    ['<!doctype html>', '.payload', 'PAYLOAD', false],
    ['', '.payload', 'PAYLOAD', true],
    ['', '.k', 'K', false],
    ['<!doctype html>', '.payload', 'payload', true],
  ] as const) {
    const tree = SourceHtmlDocument.parse(`${doctype}<p class="${className}">Visible</p>`);
    const element = tree.elements.find((node) => node.name === 'p');
    assert.ok(element);
    const queries = createSelectorMatcher(tree.document)(parse(selector, { context: 'selectorList' }));
    assert.ok(queries);
    assert.equal(queries[0].query(element), expected);
  }
});
