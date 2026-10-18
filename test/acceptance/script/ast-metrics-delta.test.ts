import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsCliFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import { astMetricsDeltaScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { metricsReportOf } from './fixtures/ast-metrics-report.ts';
import { GitRepository } from './fixtures/git-repository.ts';

// The files of the delta and the call of ast-metrics. ast-metrics-delta-goal.test.ts specifies the goal and the result,
// and ast-metrics-delta-failures.test.ts the failures.
const timeout = 20_000;
const reportArgs = ['--report-html=./ast-report', '--report-openmetrics=./ast-report/metrics.txt', '--report-summary=false', '.'];

test('Given a branch with a committed change, a committed new file, an edit without a commit, and an untracked new file, when the check runs against main, then it lists the four files lowest score first, marks each file below 85, and fails', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, {
    'src/changed.ts': 'export const changed = 1;\n',
    'src/edited.ts': 'export const edited = 1;\n',
    'src/same.ts': 'export const same = 1;\n',
  });
  repository.commit('Change the branch', { 'src/changed.ts': 'export const changed = 2;\n', 'src/added.ts': 'export const added = 1;\n' });
  repository.write({ 'src/edited.ts': 'export const edited = 2;\n', 'src/untracked.ts': 'export const untracked = 1;\n' });
  const fake = astMetricsCliFakeOnPath(t, {
    metrics: metricsReportOf({ 'src/same.ts': 10, 'src/added.ts': 91.04, 'src/changed.ts': 72.31, 'src/edited.ts': 41.44, 'src/untracked.ts': 88 }),
  });

  const result = await runScript(t, astMetricsDeltaScript, { args: ['--base', 'main'], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, [
    '  41.4  src/edited.ts  below 85',
    '  72.3  src/changed.ts  below 85',
    '  88.0  src/untracked.ts',
    '  91.0  src/added.ts',
    'Result: 2 of 4 production files below 85. Goal: 85 or more for each production file.',
    'Comparison with main: ast-report/compare.html',
    '',
  ].join('\n'));
  assert.equal(result.code, 1);
  assert.deepEqual(fake.calls(), [{ argv: ['analyze', '--compare-with=main', ...reportArgs], cwd: repository.root }]);
});

test('Given a branch that changes no TypeScript file, when the check runs, then it says so, passes, and does not run ast-metrics', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { 'src/a.ts': 'export const a = 1;\n', 'README.md': '# Old\n' });
  repository.commit('Change the branch', { 'README.md': '# New\n' });
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 10 }) });

  const result = await runScript(t, astMetricsDeltaScript, { args: ['--base', 'main'], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, 'No TypeScript file is added or changed against main.\n');
  assert.equal(result.code, 0);
  assert.deepEqual(fake.calls(), []);
  assert.equal(existsSync(join(repository.root, 'ast-report')), false);
});

test('Given a deleted TypeScript file and a changed Markdown file on the branch, when the check runs, then neither file appears', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { 'src/kept.ts': 'export const kept = 1;\n', 'src/deleted.ts': 'export const deleted = 1;\n', 'README.md': '# Old\n' });
  repository.git('rm', '--quiet', 'src/deleted.ts');
  repository.commit('Change the branch', { 'src/kept.ts': 'export const kept = 2;\n', 'README.md': '# New\n' });
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/kept.ts': 90 }) });

  const result = await runScript(t, astMetricsDeltaScript, { args: ['--base', 'main'], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  90.0  src/kept.ts\nResult: all 1 production file at 85 or more.\nComparison with main: ast-report/compare.html\n');
  assert.equal(result.code, 0);
});

test('Given a renamed TypeScript file on the branch, when the check runs, then the file appears with its new path', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { 'src/old-name.ts': 'export function renamed(value: number): number {\n  return value * 2;\n}\n' });
  repository.git('mv', 'src/old-name.ts', 'src/new-name.ts');
  repository.commit('Rename the file');
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/new-name.ts': 95 }) });

  const result = await runScript(t, astMetricsDeltaScript, { args: ['--base', 'main'], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  95.0  src/new-name.ts\nResult: all 1 production file at 85 or more.\nComparison with main: ast-report/compare.html\n');
  assert.equal(result.code, 0);
});

test('Given --no-compare, when the check runs, then ast-metrics gets no comparison ref and no comparison line is printed', { timeout }, async (t) => {
  const repository = GitRepository.withBranchAdding(t, ['src/a.ts']);
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 90 }) });

  const result = await runScript(t, astMetricsDeltaScript, { args: ['--base', 'main', '--no-compare'], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  90.0  src/a.ts\nResult: all 1 production file at 85 or more.\n');
  assert.equal(result.code, 0);
  assert.deepEqual(fake.calls(), [{ argv: ['analyze', ...reportArgs], cwd: repository.root }]);
});

test('Given origin/main and no --base, when the check runs, then it compares with origin/main', { timeout }, async (t) => {
  const repository = GitRepository.withBranchAdding(t, ['src/a.ts']);
  repository.git('update-ref', 'refs/remotes/origin/main', 'main');
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 90 }) });

  const result = await runScript(t, astMetricsDeltaScript, { args: [], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  90.0  src/a.ts\nResult: all 1 production file at 85 or more.\nComparison with origin/main: ast-report/compare.html\n');
  assert.equal(result.code, 0);
  assert.deepEqual(fake.calls().map((call) => call.argv), [['analyze', '--compare-with=origin/main', ...reportArgs]]);
});
