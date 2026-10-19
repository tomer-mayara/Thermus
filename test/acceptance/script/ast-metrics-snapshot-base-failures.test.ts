import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { baseDoublesOnPath, baseRepository, foldersLeftIn, pathWithGitThatKeepsWorktrees, worktreesOf } from './fixtures/ast-metrics-snapshot-base.ts';
import { GitRepository } from './fixtures/git-repository.ts';

// The failures of the snapshot of the merge base. Each one gives exit status 1 and one diagnostic line, and the command
// writes no snapshot: ast-report/ stays absent, because only the write of the snapshot makes it in a repository without
// a configuration of ast-metrics.
const timeout = 20_000;

test('Given an analysis of the merge base that exits 2 with an error text, when the snapshot runs with --base main, then it fails with one diagnostic line, removes the temporary worktree, and writes no snapshot', { timeout }, async (t) => {
  const repository = baseRepository(t);
  const doubles = baseDoublesOnPath(t, { stderr: 'The analysis stopped.\nNo report.\n', exitCode: 2 });

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, 'ast-metrics-snapshot: ast-metrics analyze failed with exit status 2. Its stderr: The analysis stopped. No report.\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  const [, analysis, ...otherCalls] = doubles.cli.calls();
  assert.deepEqual([dirname(analysis.cwd), otherCalls], [doubles.temporaryFolder, []]);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
  assert.deepEqual(foldersLeftIn(doubles), []);
  assert.equal(existsSync(join(repository.root, 'ast-report')), false);
});

test('Given an unknown base ref, when the snapshot runs, then it fails with the diagnostic of the shared repository helper, adds no worktree, and runs no ast-metrics', { timeout }, async (t) => {
  const repository = baseRepository(t);
  const doubles = baseDoublesOnPath(t);

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--base', 'no-such-branch'], cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, 'ast-metrics-snapshot: The base ref "no-such-branch" is not a commit in this repository. Fetch it, or name another ref with --base.\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.deepEqual(doubles.cli.calls(), []);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
  assert.deepEqual(foldersLeftIn(doubles), []);
});

test('Given a branch without a commit in common with main, when the snapshot runs with --base main, then it fails with one diagnostic line, adds no worktree, and runs no ast-metrics', { timeout }, async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Start main', { 'README.md': '# Test\n' });
  repository.git('switch', '--quiet', '--orphan', 'unrelated');
  repository.commit('Start again', { 'src/a.ts': 'export const value = 1;\n' });
  const doubles = baseDoublesOnPath(t);

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, 'ast-metrics-snapshot: The base ref "main" and HEAD have no merge base.\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.deepEqual(doubles.cli.calls(), []);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
  assert.deepEqual(foldersLeftIn(doubles), []);
});

// The removal is a part of the command, so a worktree that stays is a failure, also after a snapshot that succeeded.
for (const [analysis, cli, cause] of [
  ['an analysis that succeeds', {}, ''],
  ['an analysis that exits 2', { exitCode: 2 }, 'ast-metrics analyze failed with exit status 2. It wrote nothing to stderr. '],
] as const) {
  test(`Given ${analysis} and a git that cannot remove the worktree, when the snapshot runs with --base main, then it fails with one diagnostic line that names the worktree that stays, and writes no snapshot`, { timeout }, async (t) => {
    const repository = baseRepository(t);
    const doubles = baseDoublesOnPath(t, cli);

    const result = await runScript(t, astMetricsSnapshotScript, { args: ['--base', 'main'], cwd: repository.root, env: { ...doubles.env, PATH: pathWithGitThatKeepsWorktrees(t, doubles.env.PATH) } });

    const folders = foldersLeftIn(doubles);
    assert.equal(folders.length, 1, folders.join(', '));
    assert.equal(result.stderr, `ast-metrics-snapshot: ${cause}The temporary worktree ${folders[0]} stays, because git worktree remove failed. git: fatal: the test keeps the worktree\n`);
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
    assert.deepEqual(worktreesOf(repository), [repository.root, folders[0]]);
    assert.equal(existsSync(join(repository.root, 'ast-report')), false);
  });
}
