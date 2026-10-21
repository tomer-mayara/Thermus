import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathToFileURL } from 'node:url';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { snapshotPairOf } = await import(new URL('snapshots.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/snapshots.ts');

const revisions = { mergeBase: 'a'.repeat(40), head: 'b'.repeat(40) };
const validBase = { version: 1, commit: revisions.mergeBase, files: [] };

function writeSnapshotFiles(t: TestContext, base: unknown, head: unknown) {
  const folder = dataDirectory(t);
  const paths = { base: join(folder, 'snapshot-base.json'), head: join(folder, 'snapshot.json') };
  writeFileSync(paths.base, typeof base === 'string' ? base : JSON.stringify(base));
  writeFileSync(paths.head, typeof head === 'string' ? head : JSON.stringify(head));
  return paths;
}

test('Given two snapshots of the merge base and of HEAD, when they are read, then each gives the raw MI of its files by path, exactly, and other fields do not count', (t) => {
  const paths = writeSnapshotFiles(t, { ...validBase, tool: '0.43.1', files: [{ path: 'src/a.ts', maintainabilityRaw: 90, maintainability: 90 }] }, {
    version: 1, commit: revisions.head, date: '2026-10-21T10:00:00Z',
    files: [{ path: 'src/a.ts', maintainabilityRaw: 56.17474697614129, functions: [] }, { path: 'src/types.ts', maintainability: 100 }, { path: 'src/zero.ts', maintainabilityRaw: 0 }],
  });

  const pair = snapshotPairOf(paths, revisions);

  assert.deepEqual(pair.base, new Map([['src/a.ts', 90]]));
  assert.deepEqual(pair.head, new Map([['src/a.ts', 56.17474697614129], ['src/types.ts', undefined], ['src/zero.ts', 0]]));
});

test('Given a head snapshot of another commit, when it is read, then the diagnostic names the snapshot and both commits', (t) => {
  const paths = writeSnapshotFiles(t, validBase, { version: 1, commit: revisions.mergeBase, files: [] });

  assert.throws(() => snapshotPairOf(paths, revisions), {
    message: `The head snapshot ${paths.head} is of commit ${revisions.mergeBase}, but the candidate is ${revisions.head}. Take the snapshot again after the last commit.`,
  });
});

test('Given a base snapshot of another commit, when it is read, then the diagnostic names the snapshot, both commits, and the base ref', (t) => {
  const paths = writeSnapshotFiles(t, { ...validBase, commit: revisions.head }, { version: 1, commit: revisions.head, files: [] });

  assert.throws(() => snapshotPairOf(paths, revisions), {
    message: `The base snapshot ${paths.base} is of commit ${revisions.head}, but the merge base is ${revisions.mergeBase}. Take the snapshot again with the same --base as the check.`,
  });
});

for (const [name, head, message] of [
  ['that is not JSON', 'not json', 'version: give 1'],
  ['of version 2', { version: 2, commit: revisions.head, files: [] }, 'version: give 1'],
  ['without a commit', { version: 1, files: [] }, 'commit: give a text'],
  ['without files', { version: 1, commit: revisions.head }, 'files: give a list'],
  ['with a file that is a text', { version: 1, commit: revisions.head, files: ['src/a.ts'] }, 'files[0].path: give a text'],
  ['with a file without a path', { version: 1, commit: revisions.head, files: [{ path: 'src/a.ts' }, { maintainabilityRaw: 90 }] }, 'files[1].path: give a text'],
  ['with a raw MI that is a text', { version: 1, commit: revisions.head, files: [{ path: 'src/a.ts', maintainabilityRaw: '84.96' }] }, 'files[0].maintainabilityRaw: give a finite number'],
  ['with a raw MI of null', { version: 1, commit: revisions.head, files: [{ path: 'src/a.ts', maintainabilityRaw: null }] }, 'files[0].maintainabilityRaw: give a finite number'],
  ['with an infinite raw MI', '{"version":1,"commit":"' + revisions.head + '","files":[{"path":"src/a.ts","maintainabilityRaw":1e999}]}', 'files[0].maintainabilityRaw: give a finite number'],
] as const) {
  test(`Given a head snapshot ${name}, when it is read, then the diagnostic names the snapshot and the key`, (t) => {
    const paths = writeSnapshotFiles(t, validBase, head);

    assert.throws(() => snapshotPairOf(paths, revisions), { message: `The head snapshot ${paths.head} has no valid key ${message}.` });
  });
}

test('Given a snapshot path that does not exist, when it is read, then the diagnostic names the file', (t) => {
  const paths = { ...writeSnapshotFiles(t, validBase, validBase), base: join(dataDirectory(t), 'missing.json') };

  assert.throws(() => snapshotPairOf(paths, revisions), { message: `Cannot read the base snapshot file ${paths.base}.` });
});
