import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { changedPathsOf, changesOf, numstatOf } = await import(new URL('changes.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/changes.ts');

test('Given the output of git diff --name-status -z, when it is read, then each change keeps its status letter and a rename keeps both paths', () => {
  const changes = changesOf('M\0bin.dat\0R083\0src/old name.ts\0src/new.ts\0A\0docs/a.md\0D\0src/gone.ts\0C075\0a.ts\0b.ts\0');

  assert.deepEqual(changes, [
    { status: 'M', path: 'bin.dat' },
    { status: 'R', oldPath: 'src/old name.ts', path: 'src/new.ts' },
    { status: 'A', path: 'docs/a.md' },
    { status: 'D', path: 'src/gone.ts' },
    { status: 'C', oldPath: 'a.ts', path: 'b.ts' },
  ]);
  assert.deepEqual(changedPathsOf(changes), ['bin.dat', 'src/old name.ts', 'src/new.ts', 'docs/a.md', 'src/gone.ts', 'a.ts', 'b.ts']);
  assert.deepEqual(changesOf(''), []);
});

test('Given the output of git diff --numstat -z, when it is read, then a binary file counts no line and a rename keeps both paths', () => {
  assert.deepEqual(numstatOf(['-\t-\tbin.dat', '1\t1\tkeep.md', '1\t0\t', 'src/old.ts', 'src/new.ts', ''].join('\0')), [
    { added: 0, deleted: 0, paths: ['bin.dat'] },
    { added: 1, deleted: 1, paths: ['keep.md'] },
    { added: 1, deleted: 0, paths: ['src/old.ts', 'src/new.ts'] },
  ]);
  assert.deepEqual(numstatOf(''), []);
});

test('Given numstat output that the check cannot read, when it is read, then the diagnostic says so', () => {
  assert.throws(() => numstatOf('one\ttwo\tpath\0'), { message: 'git diff --numstat gave a line that the check cannot read: one\ttwo\tpath' });
});
