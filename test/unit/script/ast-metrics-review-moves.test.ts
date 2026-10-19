import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsReviewScript } from '../../support/processes/module-paths.ts';

const { reviewMoves } = await import(new URL('review/moves.ts', pathToFileURL(astMetricsReviewScript)).href) as typeof import('../../../script/code-quality/review/moves.ts');

test('A unique exact deleted/added source body proves an unstaged move', () => {
  const moves = reviewMoves([{ status: 'D', path: 'src/old.ts' }, { status: 'A', path: 'src/new.ts' }], () => 'same body', () => 'same body');
  assert.deepEqual([...moves], [['src/old.ts', 'src/new.ts']]);
});

test('Ambiguous identical additions or deletions prove no move', () => {
  assert.equal(reviewMoves([{ status: 'D', path: 'src/old.ts' }, { status: 'A', path: 'src/new1.ts' }, { status: 'A', path: 'src/new2.ts' }], () => 'same', () => 'same').size, 0);
  assert.equal(reviewMoves([{ status: 'D', path: 'src/old1.ts' }, { status: 'D', path: 'src/old2.ts' }, { status: 'A', path: 'src/new.ts' }], () => 'same', () => 'same').size, 0);
});

test('Changed bodies do not prove unstaged moves and non-source changes do not enter the correspondence', () => {
  assert.equal(reviewMoves([{ status: 'D', path: 'src/old.ts' }, { status: 'A', path: 'src/new.ts' }], () => 'old', () => 'new').size, 0);
  assert.equal(reviewMoves([{ status: 'D', path: 'test/old.ts' }, { status: 'A', path: 'test/new.ts' }], () => 'same', () => 'same').size, 0);
});

test('Explicit Git rename evidence keeps correspondence for a changed body', () => {
  assert.deepEqual([...reviewMoves([{ status: 'R', oldPath: 'src/old.ts', path: 'src/new.ts' }], () => assert.fail('No body comparison needed'), () => assert.fail('No body comparison needed'))], [['src/old.ts', 'src/new.ts']]);
});
