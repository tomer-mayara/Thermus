import assert from 'node:assert/strict';
import { dirname } from 'node:path';
import { test } from 'node:test';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { legend } from './fixtures/ast-metrics-architecture-snapshots.ts';
import { baseDoublesOnPath, baseRepository, foldersLeftIn, worktreesOf } from './fixtures/ast-metrics-snapshot-base.ts';

// The architecture delta of a repository. Without snapshot files, the command takes the snapshot of the merge base in a
// temporary worktree and the snapshot of the working tree, and git gives the changed files. Both doubles answer each
// snapshot with the answers of fixtures/ast-metrics-snapshot-answers.ts: admin and auth in a cycle, and the shared
// kernel, whose file has no maintainability.
const timeout = 20_000;

test('Given a branch whose working tree changes one src/ file and both doubles on PATH, when the command runs with --base main, then it takes the snapshot of the merge base and of the working tree and prints the graph with the community of that file touched, and no worktree stays', { timeout }, async (t) => {
  const repository = baseRepository(t);
  repository.write({ 'src/auth/session.ts': 'export const value = 2;\n' });
  const doubles = baseDoublesOnPath(t);

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, [
    `## Architecture of src/: base ${repository.git('rev-parse', 'HEAD').slice(0, 8)} → head`,
    '',
    'Modularity 0.42 → 0.42 · cross share 0.33 → 0.33 · cycles 1 → 1 · communities 3 → 3',
    '',
    '```mermaid',
    'flowchart LR',
    '  c_admin["admin<br/>1 file · MI 70.1 · paths 4"]',
    '  c_auth["auth<br/>2 files · MI 70.4 · paths 9"]',
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
  ].join('\n'));
  assert.equal(result.code, 0);
  const calls = doubles.cli.calls().map(({ argv, cwd }) => [argv[0], dirname(cwd) === doubles.temporaryFolder ? 'temporary worktree' : cwd]);
  assert.deepEqual(calls, [['analyze', 'temporary worktree'], ['mcp', 'temporary worktree'], ['analyze', repository.root], ['mcp', repository.root]]);
  assert.deepEqual(worktreesOf(repository), [repository.root]);
  assert.deepEqual(foldersLeftIn(doubles), []);
  assert.deepEqual(await doubles.server.stillRunning(), []);
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
