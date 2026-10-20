import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isValidSearchQuery, SEARCH_QUERY_MAX_SCALARS } from '../../../src/search-pipeline/search-query.ts';

test('Given the search query contract, when its public bound is read, then it permits at most 512 Unicode scalar values', () => {
  assert.equal(SEARCH_QUERY_MAX_SCALARS, 512);
});

for (const [description, value] of [
  ['one scalar', 'a'],
  ['512 basic scalars', 'x'.repeat(512)],
  ['512 supplementary scalars', '😀'.repeat(512)],
  ['512 mixed scalars', 'é😀'.repeat(256)],
  ['surrounding whitespace', ' \t café 😀\n '],
  ['decomposed Unicode', 'e\u0301'],
] as const) {
  test(`Given ${description}, when the query is checked, then the exact supplied text is accepted`, () => {
    assert.equal(isValidSearchQuery(value), true);
  });
}

for (const [description, value] of [
  ['undefined', undefined],
  ['null', null],
  ['a number', 42],
  ['a boolean', true],
  ['an array', ['query']],
  ['an object', { query: 'query' }],
  ['a boxed string', new String('query')],
  ['an empty string', ''],
  ['only whitespace', ' \t\n\r\u00a0\u2003\uFEFF'],
  ['513 basic scalars', 'x'.repeat(513)],
  ['513 supplementary scalars', '😀'.repeat(513)],
  ['513 mixed scalars', 'é😀'.repeat(256) + 'x'],
  ['a large string', 'x'.repeat(100_000)],
  ['a lone high surrogate', '\uD800'],
  ['a lone low surrogate', '\uDFFF'],
  ['an embedded high surrogate', 'before\uD800after'],
  ['an embedded low surrogate', 'before\uDFFFafter'],
  ['reversed surrogates', '\uDC00\uD800'],
  ['a high surrogate after a valid pair', '😀\uD800'],
  ['a low surrogate after a valid pair', '😀\uDC00'],
] as const) {
  test(`Given ${description}, when the query is checked, then it is refused`, () => {
    assert.equal(isValidSearchQuery(value), false);
  });
}
