import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deltaChanges, deltaFiles } from '../../../script/code-quality/delta/files.ts';
import { GitRepository } from './fixtures/git-repository.ts';

test('Given committed and working changes, deletions, renames, and untracked TypeScript files, when Git changes are read, then status and exact paths stay available while scores use current files only', (t) => {
  const oldPath = 'src/old\tname.ts';
  const path = 'src/new\nname.ts';
  const repository = GitRepository.onFeatureBranch(t, {
    [oldPath]: 'export function unchanged(value: number) { return value + 1; }\n',
    'src/deleted.mts': 'export const deleted = 1;\n',
    'src/modified.tsx': 'export const modified = 1;\n',
  });
  repository.git('mv', oldPath, path);
  repository.git('rm', '--quiet', 'src/deleted.mts');
  repository.commit('Rename and delete');
  repository.write({ 'src/modified.tsx': 'export const modified = 2;\n', 'src/untracked.cts': 'export const added = 1;\n', 'src/ignored.js': 'ignored' });

  assert.deepEqual(deltaChanges(repository.root, 'main'), [
    { status: 'D', path: 'src/deleted.mts' },
    { status: 'M', path: 'src/modified.tsx' },
    { status: 'R', oldPath, path },
    { status: 'A', path: 'src/untracked.cts' },
  ]);
  assert.deepEqual(deltaFiles(repository.root, 'main'), ['src/modified.tsx', path, 'src/untracked.cts']);
});

test('Given renames to and from unsupported file types, when TypeScript changes are read, then each supported endpoint retains its addition or deletion', (t) => {
  const repository = GitRepository.onFeatureBranch(t, { 'src/old.ts': 'const old = 1;\n', 'src/incoming.js': 'const incoming = 1;\n' });
  repository.git('mv', 'src/old.ts', 'src/old.js');
  repository.git('mv', 'src/incoming.js', 'src/incoming.ts');
  repository.commit('Change file extensions');
  assert.deepEqual(deltaChanges(repository.root, 'main'), [{ status: 'A', path: 'src/incoming.ts' }, { status: 'D', path: 'src/old.ts' }]);
});
