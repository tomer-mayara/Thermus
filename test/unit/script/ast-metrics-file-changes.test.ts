import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateChanges } from '../../../script/code-quality/delta/changes.ts';
import { changesInDiff } from '../../../script/code-quality/delta/status.ts';
import { changesInSource } from '../../../script/code-quality/delta/source.ts';

test('Given NUL records with similarity scores and unusual names, when statuses are read, then rename pairs and exact paths survive', () => {
  assert.deepEqual(changesInDiff('R087\0src/old\tname.ts\0src/new\nname.ts\0M100\0test/a.tsx\0D\0src/gone.mts\0A\0src/new.cts\0'), [
    { status: 'R', oldPath: 'src/old\tname.ts', path: 'src/new\nname.ts' },
    { status: 'M', path: 'test/a.tsx' }, { status: 'D', path: 'src/gone.mts' }, { status: 'A', path: 'src/new.cts' },
  ]);
});

for (const text of ['R100\0src/old.ts\0', 'M\0src/a.ts', 'C100\0src/a.ts\0src/b.ts\0', 'U\0src/a.ts\0', 'R101\0src/a.ts\0src/b.ts\0']) {
  test(`Given an incomplete or unsupported Git record ${JSON.stringify(text)}, when statuses are read, then it fails visibly`, () => {
    assert.throws(() => changesInDiff(text), /Git change/);
  });
}

test('Given conflicting destination or predecessor claims, when file changes are checked, then no mapping is silently chosen', () => {
  assert.throws(() => validateChanges([{ status: 'R', oldPath: 'src/a.ts', path: 'src/x.ts' }, { status: 'R', oldPath: 'src/a.ts', path: 'src/y.ts' }]), /Conflicting file changes/);
  assert.throws(() => validateChanges([{ status: 'A', path: 'src/x.ts' }, { status: 'M', path: 'src/x.ts' }]), /Conflicting file changes/);
});

test('Given renames across the production source boundary, when source changes are selected, then the source side is added or deleted', () => {
  assert.deepEqual(changesInSource([
    { status: 'R', oldPath: 'test/a.ts', path: 'src/a.ts' },
    { status: 'R', oldPath: 'src/b.ts', path: 'test/b.ts' },
    { status: 'M', path: 'test/c.ts' },
  ]), [{ status: 'A', path: 'src/a.ts' }, { status: 'D', path: 'src/b.ts' }]);
});
