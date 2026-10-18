import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import {
  baseDoublesOnPath, baseRepository, endedProcessId, foldersLeftIn, installCheckoutHook, pathWithGitThatKeepsWorktrees, runFolderOf, worktreesOf,
} from './fixtures/ast-metrics-snapshot-base.ts';

// The temporary worktree of the snapshot of the merge base, when a run stops before its end: the worktrees that
// interrupted runs left, the signals SIGINT and SIGTERM, and the hooks of the repository.
const timeout = 20_000;
const args = ['--base', 'main'];

for (const [worktree, lock] of [['a stale temporary worktree', false], ['a stale temporary worktree that git locked', true]] as const) {
  test(`Given ${worktree} of an interrupted run, when the snapshot runs with --base main, then it removes that worktree, says so in one line, and writes the snapshot`, { timeout }, async (t) => {
    const repository = baseRepository(t);
    const doubles = baseDoublesOnPath(t);
    const stale = runFolderOf(doubles, endedProcessId());
    repository.git('worktree', 'add', '--detach', stale, 'HEAD');
    // git locks a new worktree until the add is complete, so an add that stopped leaves a locked worktree.
    if (lock) repository.git('worktree', 'lock', stale);

    const result = await runScript(t, astMetricsSnapshotScript, { args, cwd: repository.root, env: doubles.env });

    assert.equal(result.stderr, 'ast-metrics-snapshot: Removed 1 stale temporary worktree of an interrupted run.\n');
    assert.equal(result.code, 0);
    assert.deepEqual(worktreesOf(repository), [repository.root]);
    assert.deepEqual(foldersLeftIn(doubles), []);
    assert.equal(existsSync(join(repository.root, 'ast-report', 'snapshot-base.json')), true);
  });
}

test('Given the temporary worktree of a run that is still active, when the snapshot runs with --base main, then that worktree stays', { timeout }, async (t) => {
  const repository = baseRepository(t);
  const doubles = baseDoublesOnPath(t);
  const active = runFolderOf(doubles, process.pid);
  repository.git('worktree', 'add', '--detach', active, 'HEAD');

  const result = await runScript(t, astMetricsSnapshotScript, { args, cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, '');
  assert.equal(result.code, 0);
  assert.deepEqual(worktreesOf(repository), [repository.root, active]);
});

test('Given a stale temporary worktree that git cannot remove, when the snapshot runs with --base main, then the snapshot is still written, and the line about stale worktrees names the one that stays', { timeout }, async (t) => {
  const repository = baseRepository(t);
  const doubles = baseDoublesOnPath(t);
  const stale = runFolderOf(doubles, endedProcessId());
  repository.git('worktree', 'add', '--detach', stale, 'HEAD');

  const result = await runScript(t, astMetricsSnapshotScript, { args, cwd: repository.root, env: { ...doubles.env, PATH: pathWithGitThatKeepsWorktrees(t, doubles.env.PATH, stale) } });

  assert.equal(result.stderr, `ast-metrics-snapshot: Removed 0 stale temporary worktrees of interrupted runs. git worktree remove failed for ${stale}.\n`);
  assert.equal(result.code, 0);
  assert.deepEqual(worktreesOf(repository), [repository.root, stale]);
  assert.equal(existsSync(join(repository.root, 'ast-report', 'snapshot-base.json')), true);
});

// The fake of analyze writes its call log when it starts, so the signal comes while the analysis of the merge base runs.
for (const [signal, status] of [['SIGTERM', 143], ['SIGINT', 130]] as const) {
  test(`Given a slow analysis of the merge base, when the command gets ${signal}, then it removes the temporary worktree, says so in one line, and exits ${status}`, { timeout }, async (t) => {
    const repository = baseRepository(t);
    const doubles = baseDoublesOnPath(t, { delayMs: 1_500 });

    const result = await runScript(t, astMetricsSnapshotScript, { args, cwd: repository.root, env: doubles.env, stop: { signal, when: () => doubles.cli.calls().length > 0 } });

    assert.equal(result.stderr, `ast-metrics-snapshot: Stopped by ${signal}. The temporary worktree is removed.\n`);
    assert.equal(result.stdout, '');
    assert.equal(result.code, status);
    assert.deepEqual(worktreesOf(repository), [repository.root]);
    assert.deepEqual(foldersLeftIn(doubles), []);
    assert.equal(existsSync(join(repository.root, 'ast-report')), false);
    assert.deepEqual(await doubles.server.stillRunning(), []);
  });
}

test('Given a post-checkout hook in the repository, when the snapshot runs with --base main, then the hook does not run for the temporary worktree', { timeout }, async (t) => {
  const repository = baseRepository(t);
  const marker = join(dataDirectory(t), 'hook-ran');
  installCheckoutHook(repository, marker);
  const doubles = baseDoublesOnPath(t);

  const result = await runScript(t, astMetricsSnapshotScript, { args, cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(existsSync(marker), false, 'The post-checkout hook ran.');
});
