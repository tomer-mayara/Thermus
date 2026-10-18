import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { test } from 'node:test';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { sourceFiles } from './fixtures/ast-metrics-snapshot-answers.ts';
import { baseDoublesOnPath, baseRepository, foldersLeftIn, forkedRepository, worktreePrefix, worktreesOf, type BaseSnapshotDoubles } from './fixtures/ast-metrics-snapshot-base.ts';

// The snapshot of the merge base with --base. ast-metrics-snapshot-base-failures.test.ts specifies its failures.
const timeout = 20_000;

// The parts of the snapshot that the cases read.
interface SnapshotParts {
  readonly commit: string;
  readonly date: string;
  readonly files: readonly { readonly path: string; readonly maintainability?: number; readonly paths: number; readonly loc: number }[];
}

function snapshotIn(path: string): SnapshotParts {
  return JSON.parse(readFileSync(path, 'utf8')) as SnapshotParts;
}

function workingFoldersOfAllCalls(doubles: BaseSnapshotDoubles): string[] {
  return [...new Set([...doubles.cli.calls().map(({ cwd }) => cwd), ...doubles.server.requests().map(({ cwd }) => cwd)])];
}

test('Given a branch that changes one src/ file and adds one, and a main that moved on after the fork, when the snapshot runs with --base main, then ast-report/snapshot-base.json holds the files of the merge base with their numbers and names the merge base and its date, from the calls in a temporary worktree', { timeout }, async (t) => {
  const { repository, mergeBase } = forkedRepository(t);
  const doubles = baseDoublesOnPath(t);

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, 'Wrote ast-report/snapshot-base.json: 3 communities, 4 files, 5 functions.\n');
  assert.equal(result.code, 0);
  const snapshot = snapshotIn(join(repository.root, 'ast-report', 'snapshot-base.json'));
  assert.deepEqual({ commit: snapshot.commit, date: snapshot.date }, { commit: mergeBase, date: repository.git('show', '-s', '--format=%cI', mergeBase).trim() });
  // On the branch, src/auth/session.ts has 9 paths and 130 lines, and src/auth/audit.ts is new. On main after the fork,
  // src/kernel/ids.ts has 12 lines.
  assert.deepEqual(snapshot.files.map(({ path, maintainability, paths, loc }) => [path, maintainability, paths, loc]), [
    ['src/admin/pages/account.ts', 70.1, 4, 50],
    ['src/auth/session.ts', 61.2, 6, 100],
    ['src/auth/tokens.ts', 88.8, 3, 50],
    ['src/kernel/ids.ts', undefined, 0, 10],
  ]);
  const folders = workingFoldersOfAllCalls(doubles);
  assert.equal(folders.length, 1, folders.join(', '));
  assert.deepEqual([dirname(folders[0]), basename(folders[0]).startsWith(worktreePrefix)], [doubles.temporaryFolder, true], folders[0]);
  assert.deepEqual(doubles.cli.calls().map(({ argv }) => argv[0]), ['analyze', 'mcp']);
  assert.deepEqual(doubles.server.calls().map(({ tool, arguments: values }) => [tool, values]), [
    ['get_communities', { with_members: true }],
    ...sourceFiles.map((path) => ['get_file_metrics', { path }]),
  ]);
  assert.deepEqual(await doubles.server.stillRunning(), []);
});

test('Given --base main and --out with a path in a new folder, when the snapshot runs from a subfolder, then the snapshot of the merge base goes to that path, relative to the current folder, and not to ast-report/', { timeout }, async (t) => {
  const { repository, mergeBase } = forkedRepository(t);
  const doubles = baseDoublesOnPath(t);

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--base', 'main', '--out', '../reports/new/base.json'], cwd: join(repository.root, 'src'), env: doubles.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, 'Wrote ../reports/new/base.json: 3 communities, 4 files, 5 functions.\n');
  assert.equal(result.code, 0);
  assert.equal(snapshotIn(join(repository.root, 'reports', 'new', 'base.json')).commit, mergeBase);
  assert.equal(existsSync(join(repository.root, 'ast-report')), false);
});

test('Given a snapshot of the merge base that succeeds, when the command ends, then git lists only the main worktree, and the temporary worktree and its folder are gone', { timeout }, async (t) => {
  const { repository } = forkedRepository(t);
  const doubles = baseDoublesOnPath(t);

  const result = await runScript(t, astMetricsSnapshotScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 0, result.stderr);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
  assert.deepEqual(foldersLeftIn(doubles), []);
  const [analysis] = doubles.cli.calls();
  assert.equal(dirname(analysis.cwd), doubles.temporaryFolder);
  assert.equal(existsSync(analysis.cwd), false, `The worktree ${analysis.cwd} stays.`);
});

test('Given a branch without a commit of its own, when the snapshot runs with --base main, then the snapshot of the merge base is the snapshot of HEAD', { timeout }, async (t) => {
  const repository = baseRepository(t);
  const doubles = baseDoublesOnPath(t);

  const head = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });
  const base = await runScript(t, astMetricsSnapshotScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.deepEqual([head.code, base.code], [0, 0], `${head.stderr}${base.stderr}`);
  const snapshot = snapshotIn(join(repository.root, 'ast-report', 'snapshot-base.json'));
  assert.deepEqual(snapshot, snapshotIn(join(repository.root, 'ast-report', 'snapshot.json')));
  assert.equal(snapshot.commit, repository.git('rev-parse', 'HEAD').trim());
});
