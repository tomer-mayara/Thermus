import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { test } from 'node:test';
import type { AstMetricsMcpAnswers } from '../../support/doubles/ast-metrics/ast-metrics-mcp-fake-path.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { bandedLegend, bandedTableHead, functionsSection } from './fixtures/ast-metrics-architecture-coverage.ts';
import { bandsNeedTheCoverage, complexityHeading, legend, tableHead } from './fixtures/ast-metrics-architecture-snapshots.ts';
import { fileMetricsAnswers, serverAnswers } from './fixtures/ast-metrics-snapshot-answers.ts';
import { baseDoublesOnPath, baseRepository, foldersLeftIn, forkedRepository, forkedServerAnswers, worktreesOf } from './fixtures/ast-metrics-snapshot-base.ts';

// The architecture delta of a repository. Without snapshot files, the command takes the snapshot of the merge base in a
// temporary worktree and the snapshot of the working tree, and git gives the changed files. Both doubles answer each
// snapshot with the answers of fixtures/ast-metrics-snapshot-answers.ts: admin and auth in a cycle, and the shared
// kernel, whose file has no maintainability. A test repository has no ast-report/coverage.json unless a case writes it,
// so the line after the summary says that the bands need the coverage.
const timeout = 20_000;

// The complete output when the changed files touch auth: the graph with the node of auth, and the complexity table with
// the rows of the changed files.
function markdownOf(baseCommit: string, authNode: string, rows: readonly string[]): string {
  return [
    `## Architecture of src/: base ${baseCommit.slice(0, 8)} → head`,
    '',
    'Modularity 0.42 → 0.42 · cross share 0.33 → 0.33 · cycles 1 → 1 · communities 3 → 3',
    '',
    bandsNeedTheCoverage,
    '',
    '```mermaid',
    'flowchart LR',
    '  c_admin["admin<br/>1 file · MI 70.1 · paths 4"]',
    authNode,
    '  c_shared_kernel["shared kernel<br/>1 file · paths 0"]',
    '  c_admin -. "1 · cycle" .-> c_auth',
    '  c_admin -- "1" --> c_shared_kernel',
    '  c_auth -. "2 · cycle" .-> c_admin',
    '  c_auth -- "2" --> c_shared_kernel',
    '  linkStyle 0 stroke:#d03b3b,stroke-width:2px',
    '  linkStyle 2 stroke:#d03b3b,stroke-width:2px',
    '  classDef touched stroke-width:3px',
    '  classDef gone stroke-dasharray:4 4,color:#999999',
    '  class c_auth touched',
    '```',
    '',
    legend,
    '',
    complexityHeading,
    '',
    ...tableHead,
    ...rows,
    '',
  ].join('\n');
}

// The report of the tree gives session.ts the same numbers as the merge base. Its risk score is the highest of the head.
test('Given a branch whose working tree changes one src/ file and both doubles on PATH, when the command runs with --base main, then it takes the snapshot of the merge base and of the working tree, prints the graph with the community of that file touched and the complexity table with the row of that file, and no worktree stays', { timeout }, async (t) => {
  const repository = baseRepository(t);
  repository.write({ 'src/auth/session.ts': 'export const value = 2;\n' });
  const doubles = baseDoublesOnPath(t);

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, markdownOf(repository.git('rev-parse', 'HEAD'), '  c_auth["auth<br/>2 files · MI 70.4 · paths 9"]', [
    '| src/auth/session.ts | 61.2 → 61.2 | 6 → 6 | 1 |',
  ]));
  assert.equal(result.code, 0);
  const calls = doubles.cli.calls().map(({ argv, cwd }) => [argv[0], dirname(cwd) === doubles.temporaryFolder ? 'temporary worktree' : cwd]);
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
  assert.equal(result.stdout, markdownOf(mergeBase, '  c_auth["auth<br/>2 files · MI 64.8 ↓5.6 · paths 12 ↑3"]', [
    '| src/auth/audit.ts | new → 90.0 | new → 2 | |',
    '| src/auth/session.ts | 61.2 → 55.5 ↓5.7 | 6 → 9 ↑3 | 1 |',
  ]));
  assert.equal(result.code, 0);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
});

// The server gives openSession 6 decision paths in both trees. The coverage report of the working tree gives it the
// covered share 0, so its CRAP is 6² + 6 = 42.0 on both sides: auth has one function at 30 or more and none added or
// worse. src/admin/pages/account.ts is not in the report, so renderAccount counts as uncovered: 4² + 4 = 20.0.
const riskyServerAnswers: AstMetricsMcpAnswers = {
  ...serverAnswers,
  get_file_metrics: {
    ...fileMetricsAnswers,
    'src/auth/session.ts': {
      path: 'src/auth/session.ts', language: 'TypeScript', cyclomatic_complexity: 6, risk_score: 0.5,
      functions: [
        { name: 'openSession', cyclomatic_complexity: 6, maintainability: { comment_weight: 0, maintainability_index: 60.5 }, volume: { loc: 20, lloc: 16 } },
        { name: '', cyclomatic_complexity: 1, maintainability: { comment_weight: 0, maintainability_index: 88.88 }, volume: { loc: 3, lloc: 1 } },
        { name: 'closeSession', cyclomatic_complexity: 1, volume: { loc: 2, lloc: 0 } },
      ],
    },
  },
};

const coverageReport = {
  version: 1, suite: 'unit', commit: 'c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00', processes: 2, scripts: 3,
  files: [
    { path: 'src/auth/session.ts', functions: [{ name: '(anonymous)', start: 0, end: 300, called: 1, coveredShare: 1 }, { name: 'openSession', start: 20, end: 120, called: 0, coveredShare: 0 }, { name: 'closeSession', start: 130, end: 160, called: 2, coveredShare: 1 }] },
    { path: 'src/auth/tokens.ts', functions: [{ name: '(anonymous)', start: 0, end: 200, called: 1, coveredShare: 1 }, { name: 'issueToken', start: 10, end: 90, called: 3, coveredShare: 0.5 }] },
    { path: 'src/kernel/ids.ts', functions: [{ name: '(anonymous)', start: 0, end: 40, called: 1, coveredShare: 1 }] },
  ],
};

test('Given a repository with ast-report/coverage.json in its root and both doubles on PATH, when the command runs with --base main, then the bands come from that report: the summary line counts the functions at CRAP 30 or more, each node has its band and band class, the table has the CRAP column, and the list follows the table', { timeout }, async (t) => {
  const repository = baseRepository(t);
  repository.write({ 'src/auth/session.ts': 'export const value = 2;\n', 'ast-report/coverage.json': `${JSON.stringify(coverageReport, null, 2)}\n` });
  const doubles = baseDoublesOnPath(t, {}, riskyServerAnswers);

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, [
    `## Architecture of src/: base ${repository.git('rev-parse', 'HEAD').slice(0, 8)} → head`,
    '',
    'Modularity 0.42 → 0.42 · cross share 0.33 → 0.33 · cycles 1 → 1 · communities 3 → 3 · functions ≥ 30: 1 → 1',
    '',
    '```mermaid',
    'flowchart LR',
    '  c_admin["admin<br/>1 file · MI 70.1 · paths 4<br/>● good: 0 fn ≥ 30"]',
    '  c_auth["auth<br/>2 files · MI 70.4 · paths 9<br/>▲ warning: 1 fn ≥ 30"]',
    '  c_shared_kernel["shared kernel<br/>1 file · paths 0<br/>● good: 0 fn ≥ 30"]',
    '  c_admin -. "1 · cycle" .-> c_auth',
    '  c_admin -- "1" --> c_shared_kernel',
    '  c_auth -. "2 · cycle" .-> c_admin',
    '  c_auth -- "2" --> c_shared_kernel',
    '  linkStyle 0 stroke:#d03b3b,stroke-width:2px',
    '  linkStyle 2 stroke:#d03b3b,stroke-width:2px',
    '  classDef touched stroke-width:3px',
    '  classDef gone stroke-dasharray:4 4,color:#999999',
    '  classDef good stroke:#0ca30c',
    '  classDef warning stroke:#fab219',
    '  class c_auth touched',
    '  class c_admin,c_shared_kernel good',
    '  class c_auth warning',
    '```',
    '',
    bandedLegend,
    '',
    complexityHeading,
    '',
    ...bandedTableHead,
    '| src/auth/session.ts | 61.2 → 61.2 | 6 → 6 | 1 → 1 | 1 |',
    '',
    ...functionsSection([], 1),
    '',
  ].join('\n'));
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
  const [analysis, ...otherCalls] = doubles.cli.calls();
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
