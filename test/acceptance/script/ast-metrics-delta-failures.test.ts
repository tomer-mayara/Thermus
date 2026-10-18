import assert from 'node:assert/strict';
import { test } from 'node:test';
import { astMetricsCliFakeOnPath, pathWithoutAstMetrics } from '../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import { astMetricsDeltaScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { metricsReportOf } from './fixtures/ast-metrics-report.ts';
import { GitRepository } from './fixtures/git-repository.ts';

// The failures of the delta check, and a caller that comes through a symbolic link.
const timeout = 20_000;
const notInstalled = 'ast-metrics-delta: ast-metrics is not installed or not on PATH. See docs/implementation/ast-metrics-review.md.\n';

// A shell gives PWD the path through the link. ast-metrics, a Go program, then writes paths through the link too,
// unless the command gives it the root in PWD.
test('Given a caller in the repository through a symbolic link, when the check runs, then each score still belongs to its file', { timeout }, async (t) => {
  const repository = GitRepository.withBranchAdding(t, ['src/a.ts']);
  const link = repository.linkToRoot(t);
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 60 }) });

  const result = await runScript(t, astMetricsDeltaScript, { args: ['--base', 'main', '--no-compare'], cwd: link, env: { ...fake.env, PWD: link } });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  60.0  src/a.ts  below 85\nResult: 1 of 1 production file below 85. Goal: 85 or more for each production file.\n');
  assert.equal(result.code, 1);
});

test('Given a PATH without ast-metrics, when the check runs, then it fails with a diagnostic that names ast-metrics', { timeout }, async (t) => {
  const repository = GitRepository.withBranchAdding(t, ['src/a.ts']);

  const result = await runScript(t, astMetricsDeltaScript, { args: ['--base', 'main'], cwd: repository.root, env: { PATH: pathWithoutAstMetrics(t) } });

  assert.equal(result.stderr, notInstalled);
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
});

test('Given ast-metrics that exits 2 with an error text, when the check runs, then the error text reaches the caller and the check fails', { timeout }, async (t) => {
  const repository = GitRepository.withBranchAdding(t, ['src/a.ts']);
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 90 }), stderr: 'The analysis stopped.\n', exitCode: 2 });

  const result = await runScript(t, astMetricsDeltaScript, { args: ['--base', 'main'], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, 'The analysis stopped.\nast-metrics-delta: ast-metrics analyze failed with exit status 2.\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
});

for (const [args, base] of [[['--base', 'no-such-branch'], 'no-such-branch'], [[], 'origin/main']] as const) {
  test(`Given the unknown base ref ${base}, when the check runs, then it fails with a diagnostic and does not run ast-metrics`, { timeout }, async (t) => {
    const repository = GitRepository.withBranchAdding(t, ['src/a.ts']);
    const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 90 }) });

    const result = await runScript(t, astMetricsDeltaScript, { args, cwd: repository.root, env: fake.env });

    assert.equal(result.stderr, `ast-metrics-delta: The base ref "${base}" is not a commit in this repository. Fetch it, or name another ref with --base.\n`);
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
    assert.deepEqual(fake.calls(), []);
  });
}
