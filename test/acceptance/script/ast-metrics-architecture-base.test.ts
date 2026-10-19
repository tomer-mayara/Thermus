import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { repositoryMarkdownOf, coveredRepositoryMarkdown, coverageReport, riskyServerAnswers } from './fixtures/ast-metrics-architecture-repository-goldens.ts';
import { verifiedCoverageFor } from './fixtures/ast-metrics-verified-coverage.ts';
import { missingOriginMainGapNotice } from './fixtures/ast-metrics-architecture-goldens.ts';
import { baseDoublesOnPath, baseRepository, foldersLeftIn, forkedRepository, forkedServerAnswers, worktreesOf } from './fixtures/ast-metrics-snapshot-base.ts';

// The architecture delta of a repository. Without snapshot files, the command takes the snapshot of the merge base in a
// temporary worktree and the snapshot of the working tree, and git gives the changed files. Both doubles answer each
// snapshot with the answers of fixtures/ast-metrics-snapshot-answers.ts: admin and auth in a cycle, and the shared
// kernel, whose file has no maintainability. A test repository has no ast-report/coverage.json unless a case writes it,
// so the line after the summary says that coverage is missing. These exploratory runs leave the trend store empty.
const timeout = 20_000;

function withEmptyTrend(report: string): string {
  return `${report}\n## Trend of src/ on main\n\nNo snapshot of main in the trend store yet.\n\n${missingOriginMainGapNotice}\n`;
}

// The output up to the trend when the changed files touch auth: the graph with the node of auth, and the complexity
// table with the rows of the changed files.
// The report of the tree gives session.ts the same numbers as the merge base. Its risk score is the highest of the head.
test('Given a branch whose working tree changes one src/ file and both doubles on PATH, when the command runs with --base main, then it takes the snapshot of the merge base and of the working tree, prints the graph with the community of that file touched and the complexity table with the row of that file, and no worktree stays', { timeout }, async (t) => {
  const repository = baseRepository(t);
  repository.write({ 'src/auth/session.ts': 'export const value = 2;\n' });
  const doubles = baseDoublesOnPath(t);

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, withEmptyTrend(repositoryMarkdownOf({ baseCommit: repository.git('rev-parse', 'HEAD'), unknownIdentity: 5 }, '  c_auth["auth<br/>2 files · MI 70.4 · paths 9"]', [
    '| src/auth/session.ts | 61.2 → 61.2 | 6 → 6 | 1 |',
  ])));
  assert.equal(result.code, 0);
  assert.ok(!readdirSync(repository.root).includes('docs'));
  const calls = doubles.cli.calls().filter(({ argv }) => argv[0] !== 'version').map(({ argv, cwd }) => [argv[0], dirname(cwd) === doubles.temporaryFolder ? 'temporary worktree' : cwd]);
  assert.deepEqual(calls, [['analyze', 'temporary worktree'], ['mcp', 'temporary worktree'], ['analyze', repository.root], ['mcp', repository.root]]);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
  assert.deepEqual(foldersLeftIn(doubles), []);
  assert.deepEqual(await doubles.server.stillRunning(), []);
});

// After the fork, the branch changes session.ts and adds audit.ts, and main changes ids.ts. The working tree also changes
// a test file. The delta rule takes the TypeScript files that differ between the merge base and the working tree, and
// the table keeps those under src/.
test('Given a branch that changes one src/ file and adds one, a working tree that changes a test file, and a change of main after the fork, when the command runs with --base main, then the complexity table has a row for the changed and for the added file, from the merge base to the working tree, and none for the test file or for the file of main', { timeout }, async (t) => {
  const { repository, mergeBase } = forkedRepository(t);
  repository.write({ 'test/session.test.ts': 'export const value = 3;\n' });
  const doubles = baseDoublesOnPath(t, {}, forkedServerAnswers);

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, withEmptyTrend(repositoryMarkdownOf({ baseCommit: mergeBase, unknownIdentity: 6, authComponent: '  c_auth["auth<br/>3 files ↑1 · MI 68.4 ↓2.0 · paths 14 ↑5"]' }, '  c_auth["auth<br/>2 files · MI 64.8 ↓5.6 · paths 12 ↑3"]', [
    '| src/auth/audit.ts | new → 90.0 | new → 2 | |',
    '| src/auth/session.ts | 61.2 → 55.5 ↓5.7 | 6 → 9 ↑3 | 1 |',
  ])));
  assert.equal(result.code, 0);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
});

// The server gives openSession 6 decision paths in both trees. The coverage report of the working tree gives it the
// covered share 0, so its CRAP is 6² + 6 = 42.0 on both sides: auth has one function at 30 or more and none added or
// worse. src/admin/pages/account.ts is not in the report, so renderAccount counts as uncovered: 4² + 4 = 20.0.
test('Given a repository with ast-report/coverage.json in its root and both doubles on PATH, when the command runs with --base main, then the bands come from that report: the summary line counts the functions at CRAP 30 or more, each node has its band and band class, the table has the CRAP column, and the list follows the table', { timeout }, async (t) => {
  const repository = baseRepository(t);
  repository.write({ 'src/auth/session.ts': 'export const value = 2;\n' });
  repository.write({ 'ast-report/coverage.json': `${JSON.stringify(verifiedCoverageFor(repository, coverageReport), null, 2)}\n` });
  const doubles = baseDoublesOnPath(t, {}, riskyServerAnswers);

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, coveredRepositoryMarkdown(repository));
  assert.equal(result.code, 0);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
});

test('Given an analysis of the merge base that exits 2 with an error text, when the command runs with --base main, then it fails with the one diagnostic line of the snapshot, removes the temporary worktree, and prints no Markdown', { timeout }, async (t) => {
  const repository = baseRepository(t);
  const doubles = baseDoublesOnPath(t, { stderr: 'The analysis stopped.\nNo report.\n', exitCode: 2 });

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, 'ast-metrics-architecture: ast-metrics analyze failed with exit status 2. Its stderr: The analysis stopped. No report.\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  const [, analysis, ...otherCalls] = doubles.cli.calls();
  assert.deepEqual([dirname(analysis.cwd), otherCalls], [doubles.temporaryFolder, []]);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
  assert.deepEqual(foldersLeftIn(doubles), []);
});

test('Given an unknown base ref, when the command runs, then it fails with the diagnostic of the shared repository helper and runs no ast-metrics', { timeout }, async (t) => {
  const repository = baseRepository(t);
  const doubles = baseDoublesOnPath(t);

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'no-such-branch'], cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, 'ast-metrics-architecture: The base ref "no-such-branch" is not a commit in this repository. Fetch it, or name another ref with --base.\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.deepEqual(doubles.cli.calls(), []);
});
