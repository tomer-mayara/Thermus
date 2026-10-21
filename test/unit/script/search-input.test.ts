import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateSearchText } from '../../../script/search/helper/search-input.ts';

test('Given search text at each limit, when it is checked, then scalar query and code point reason counts are accepted', () => {
  for (const query of ['a', '🐼'.repeat(512), ' a ']) {
    for (const reason of ['a', '🐼'.repeat(2000), '\ud800']) assert.doesNotThrow(() => validateSearchText(query, reason));
  }
});

test('Given invalid query text, when it is checked, then blank, oversized and lone surrogate values are refused', () => {
  for (const query of [undefined, '', ' \t\n', '🐼'.repeat(513), '\ud800', '\udc00']) {
    assert.throws(() => validateSearchText(query, 'Find documentation'), /query/);
  }
});

test('Given invalid reason text, when it is checked, then blank and oversized values are refused', () => {
  for (const reason of [undefined, '', ' \t\n', '🐼'.repeat(2001)]) {
    assert.throws(() => validateSearchText('Browser', reason), /reason/);
  }
});
