import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { pathWithoutAstMetrics } from '../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { fileMetricsAnswers, jsonReport, repositoryFiles, serverAnswers, snapshotDoublesOnPath } from './fixtures/ast-metrics-snapshot-answers.ts';
import { GitRepository } from './fixtures/git-repository.ts';

// The failures of the snapshot. Each one gives exit status 1 and one diagnostic line, and the command writes no
// snapshot: ast-report/ stays absent, because only the write of the snapshot makes it in a repository without a
// configuration of ast-metrics.
const timeout = 20_000;

function committedRepository(t: TestContext): GitRepository {
  const repository = GitRepository.create(t);
  repository.commit('Add the files', repositoryFiles);
  return repository;
}

test('Given a PATH without ast-metrics, when the snapshot runs, then it fails with a diagnostic that names ast-metrics and its guide, and writes no snapshot', { timeout }, async (t) => {
  const repository = committedRepository(t);

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: { PATH: pathWithoutAstMetrics(t) } });

  assert.equal(result.stderr, 'ast-metrics-snapshot: ast-metrics is not installed or not on PATH. See docs/implementation/ast-metrics-review.md.\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.equal(existsSync(join(repository.root, 'ast-report')), false);
});

test('Given an analysis that exits 2 with an error text, when the snapshot runs, then it fails with one diagnostic line that holds the text, starts no server, and writes no snapshot', { timeout }, async (t) => {
  const repository = committedRepository(t);
  const doubles = snapshotDoublesOnPath(t, { cli: { json: jsonReport, stderr: 'The analysis stopped.\nNo report.\n', exitCode: 2 } });

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, 'ast-metrics-snapshot: ast-metrics analyze failed with exit status 2. Its stderr: The analysis stopped. No report.\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.deepEqual(doubles.cli.calls().map(({ argv }) => argv[0]), ['analyze']);
  assert.deepEqual(doubles.server.requests(), []);
  assert.equal(existsSync(join(repository.root, 'ast-report')), false);
});

test('Given a server that has no metrics for one src/ file, when the snapshot runs, then it fails with the text of the server, stops the server, and writes no snapshot', { timeout }, async (t) => {
  const repository = committedRepository(t);
  const { 'src/auth/tokens.ts': _missing, ...otherFiles } = fileMetricsAnswers;
  const doubles = snapshotDoublesOnPath(t, { server: { ...serverAnswers, get_file_metrics: otherFiles } });

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });

  assert.equal(result.stderr, 'ast-metrics-snapshot: get_file_metrics failed: File not found in analysis: src/auth/tokens.ts\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.deepEqual(doubles.server.calls().map(({ arguments: values }) => values), [
    { with_members: true }, { path: 'src/admin/pages/account.ts' }, { path: 'src/auth/session.ts' }, { path: 'src/auth/tokens.ts' },
  ]);
  assert.deepEqual(await doubles.server.stillRunning(), []);
  assert.equal(existsSync(join(repository.root, 'ast-report')), false);
});
