import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SearchQuery } from '../../../src/pipelines/search/search-query.ts';

test('Given the search query contract, when its public bound is read, then it permits at most 512 Unicode scalar values', () => {
  assert.equal(SearchQuery.MAX_SCALARS, 512);
});

for (const [description, value] of [
  ['one scalar', 'a'],
  ['512 basic scalars', 'x'.repeat(512)],
  ['512 supplementary scalars', '😀'.repeat(512)],
  ['512 mixed scalars', 'é😀'.repeat(256)],
  ['surrounding whitespace', ' \t café 😀\n '],
  ['decomposed Unicode', 'e\u0301'],
] as const) {
  test(`Given ${description}, when a search query is constructed, then it retains the exact supplied text`, () => {
    assert.equal(new SearchQuery(value).value, value);
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
  test(`Given ${description}, when a search query is constructed, then it throws the fixed safe TypeError`, () => {
    assert.throws(() => new SearchQuery(value), {
      name: 'TypeError',
      message: 'Invalid search query',
    });
  });
}

test('Given a validated search query, when its public value is replaced, then the write fails and its text stays unchanged', () => {
  const query = new SearchQuery('original query');

  assert.equal(Reflect.set(query, 'value', 'replacement query'), false);
  assert.equal(query.value, 'original query');
});
