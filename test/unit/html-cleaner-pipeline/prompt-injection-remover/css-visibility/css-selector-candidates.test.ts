import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'css-tree';
import { createSelectorMatcher } from '../../../../../src/pipelines/html-processing/prompt-injection-remover/css-visibility-selectors.ts';
import { SourceHtmlDocument } from '../../../../../src/pipelines/html-processing/prompt-injection-remover/css-visibility-tree.ts';
import { resolveCssVisibility } from '../../../../../src/pipelines/html-processing/prompt-injection-remover/css-visibility.ts';

for (const { name, selector, html, expected } of [
  { name: 'escaped class whitespace', selector: String.raw`.pay\a0 load`, html: '<p class="pay&nbsp;load" data-key="target"></p><p class="pay load"></p>', expected: ['target'] },
  { name: 'HTML class whitespace', selector: '.payload', html: '<p class="safe&#9;&#10;&#12;&#13; payload" data-key="target"></p><p class="safe&nbsp;payload"></p>', expected: ['target'] },
  { name: 'escaped ID', selector: String.raw`#\31 x`, html: '<p id="1x" data-key="target"></p>', expected: ['target'] },
  { name: 'escaped type', selector: String.raw`\70`, html: '<p data-key="target"></p>', expected: ['target'] },
  { name: 'escaped literal star', selector: String.raw`\*`, html: '<p data-key="control"></p>', expected: [] },
  { name: 'adjacent sibling after an anchor', selector: '.before + *', html: '<p class="before"></p><p data-key="target"></p><p></p>', expected: ['target'] },
  { name: 'later siblings after an anchor', selector: '.before ~ *', html: '<p class="before"></p><p data-key="first"></p><p data-key="second"></p>', expected: ['first', 'second'] },
  { name: 'descendants after a sibling', selector: '.before + section *', html: '<p class="before"></p><section><p data-key="target"></p></section>', expected: ['target'] },
  { name: 'attribute-only target', selector: '[data-key]', html: '<p data-key="target"></p>', expected: ['target'] },
  { name: 'duplicate and nested ID anchors', selector: '#same *', html: '<section id="same"><div id="same" data-key="inner"><p data-key="first"></p></div></section><section id="same"><p data-key="second"></p></section>', expected: ['first', 'inner', 'second'] },
  { name: 'common targets in duplicate and nested ID anchors', selector: '#same ul', html: '<ul></ul>'.repeat(10) + '<section id="same"><div id="same"><ul data-key="first"></ul></div></section><section id="same"><ul data-key="second"></ul></section>', expected: ['first', 'second'] },
]) {
  test(`Given ${name}, when bounded candidates pass through the exact matcher, then every possible match is kept once`, () => {
    const tree = SourceHtmlDocument.parse('<!doctype html>' + html);
    const selectors = createSelectorMatcher(tree.document)(parse(selector, { context: 'selectorList' }));
    assert.ok(selectors);
    const [{ candidates: selectCandidates, query }] = selectors;
    const candidates = selectCandidates();
    assert.equal(new Set(candidates).size, candidates.length);
    const actual = candidates.filter(query).map((element) => element.attribs['data-key']).sort();
    assert.deepEqual(actual, expected);
  });
}

for (const [doctype, selector, value, expected] of [
  ['', '.k', 'K', true],
  ['', '#k', 'K', true],
  ['', '.k', 'K', false],
  ['', '#k', 'K', false],
  ['<!doctype html>', '.k', 'K', false],
  ['<!doctype html>', '#k', 'K', false],
] as const) {
  test(`Given ${doctype ? 'standards' : 'quirks'} mode and ${selector} with ${value}, when candidates are selected, then ASCII matching is preserved`, () => {
    const tree = SourceHtmlDocument.parse(`${doctype}<p class="${value}" id="${value}"></p>`);
    const selectors = createSelectorMatcher(tree.document)(parse(selector, { context: 'selectorList' }));
    assert.ok(selectors);
    assert.equal(selectors[0].candidates().filter(selectors[0].query).length, expected ? 1 : 0);
  });
}

test('Given a completed scan, when the next scan reads changed classes and IDs, then it builds fresh candidates', () => {
  const tree = SourceHtmlDocument.parse('<!doctype html><p class="before" id="before"></p>');
  const element = tree.elements.find((node) => node.name === 'p');
  assert.ok(element);
  const first = createSelectorMatcher(tree.document)(parse('.before#before', { context: 'selectorList' }));
  assert.ok(first);
  assert.deepEqual(first[0].candidates().filter(first[0].query), [element]);
  element.attribs.class = 'after';
  element.attribs.id = 'after';
  const second = createSelectorMatcher(tree.document)(parse('.after#after', { context: 'selectorList' }));
  assert.ok(second);
  assert.deepEqual(second[0].candidates().filter(second[0].query), [element]);
});

test('Given an excessive class attribute, when the candidate index reads it, then construction uses the scan work budget', () => {
  const tree = SourceHtmlDocument.parse(`<p class="${'x'.repeat(1_000_001)}"></p>`);
  assert.throws(() => createSelectorMatcher(tree.document)(parse('.x', { context: 'selectorList' }))?.[0].candidates(), {
    name: 'RangeError', message: 'CSS selector work limit exceeded',
  });
});

test('Given only irrelevant declarations, when CSS visibility is resolved, then unused candidate indexes do not spend the matching budget', () => {
  const tree = SourceHtmlDocument.parse(`<style>.unused{padding:1px}</style><p class="${'x'.repeat(1_000_001)}"></p>`);
  assert.equal(resolveCssVisibility(tree).size, 0);
});

test('Given common targets outside a required ancestor, when many rules match, then the ancestor scope bounds candidate work', () => {
  const rules = '#notice ul{display:block}'.repeat(100);
  const otherLists = ('<section>'.repeat(10) + '<ul><li>Other</li></ul>' + '</section>'.repeat(10)).repeat(500);
  const tree = SourceHtmlDocument.parse(`<style>${rules}</style>${otherLists}<aside id="notice"><ul><li>Notice</li></ul></aside>`);
  assert.equal(resolveCssVisibility(tree).size, 1);
});

test('Given an absent selector term, when cached presence checks repeat, then the scan work limit still applies', () => {
  const tree = SourceHtmlDocument.parse('<p>Visible</p>');
  const selectors = createSelectorMatcher(tree.document)(parse('.absent', { context: 'selectorList' }));
  assert.ok(selectors);
  assert.throws(() => {
    for (let attempt = 0; attempt < 1_000_001; attempt++) selectors[0].candidates();
  }, { name: 'RangeError', message: 'CSS selector work limit exceeded' });
});
