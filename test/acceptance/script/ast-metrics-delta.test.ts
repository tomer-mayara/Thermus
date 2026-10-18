import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { astMetricsCliFakeOnPath, pathWithoutAstMetrics } from '../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import { astMetricsDeltaScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { metricsReportOf } from './fixtures/ast-metrics-report.ts';
import { GitRepository } from './fixtures/git-repository.ts';

const timeout = 20_000;
const reportArgs = ['--report-html=./ast-report', '--report-openmetrics=./ast-report/metrics.txt', '--report-summary=false', '.'];
const notInstalled = 'ast-metrics-delta: ast-metrics is not installed or not on PATH. See docs/implementation/ast-metrics-review.md.\n';

function oneChangedFile(t: TestContext): GitRepository {
  const repository = GitRepository.onFeatureBranch(t, { 'src/a.ts': 'export const a = 1;\n' });
  repository.commit('Change the branch', { 'src/a.ts': 'export const a = 2;\n' });
  return repository;
}

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

  const result = await runScript(t, astMetricsDeltaScript, ['--base', 'main'], { cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, [
    '  41.4  src/edited.ts  below 85',
    '  72.3  src/changed.ts  below 85',
    '  88.0  src/untracked.ts',
    '  91.0  src/added.ts',
    'Result: 2 of 4 files below 85. Goal: 85 or more for each file.',
    'Comparison with main: ast-report/compare.html',
    '',
  ].join('\n'));
  assert.equal(result.code, 1);
  assert.deepEqual(fake.calls(), [{ argv: ['analyze', '--compare-with=main', ...reportArgs], cwd: repository.root }]);
});

test('Given each changed file at 85 or more, when the check runs, then the result says that all files are at 85 or more and the check passes', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { 'src/a.ts': 'export const a = 1;\n' });
  repository.commit('Change the branch', { 'src/a.ts': 'export const a = 2;\n', 'src/b.ts': 'export const b = 1;\n' });
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/b.ts': 97.26, 'src/a.ts': 85 }) });

  const result = await runScript(t, astMetricsDeltaScript, ['--base', 'main'], { cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  85.0  src/a.ts\n  97.3  src/b.ts\nResult: all 2 files at 85 or more.\nComparison with main: ast-report/compare.html\n');
  assert.equal(result.code, 0);
});

test('Given a branch that changes no TypeScript file, when the check runs, then it says so, passes, and does not run ast-metrics', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { 'src/a.ts': 'export const a = 1;\n', 'README.md': '# Old\n' });
  repository.commit('Change the branch', { 'README.md': '# New\n' });
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 10 }) });

  const result = await runScript(t, astMetricsDeltaScript, ['--base', 'main'], { cwd: repository.root, env: fake.env });

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

  const result = await runScript(t, astMetricsDeltaScript, ['--base', 'main'], { cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  90.0  src/kept.ts\nResult: all 1 file at 85 or more.\nComparison with main: ast-report/compare.html\n');
  assert.equal(result.code, 0);
});

test('Given a renamed TypeScript file on the branch, when the check runs, then the file appears with its new path', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { 'src/old-name.ts': 'export function renamed(value: number): number {\n  return value * 2;\n}\n' });
  repository.git('mv', 'src/old-name.ts', 'src/new-name.ts');
  repository.commit('Rename the file');
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/new-name.ts': 95 }) });

  const result = await runScript(t, astMetricsDeltaScript, ['--base', 'main'], { cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  95.0  src/new-name.ts\nResult: all 1 file at 85 or more.\nComparison with main: ast-report/compare.html\n');
  assert.equal(result.code, 0);
});

test('Given a changed file that ast-metrics does not measure, when the check runs, then the file is listed as not measured and does not fail the check', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { 'src/a.ts': 'export const a = 1;\n' });
  repository.commit('Change the branch', { 'src/a.ts': 'export const a = 2;\n', 'src/types.ts': 'export type Name = string;\n' });
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 90 }) });

  const result = await runScript(t, astMetricsDeltaScript, ['--base', 'main'], { cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  90.0  src/a.ts\n  not measured  src/types.ts\nResult: all 2 files at 85 or more.\nComparison with main: ast-report/compare.html\n');
  assert.equal(result.code, 0);
});

test('Given --min 50, when the check runs, then the marker, the goal, and the result follow 50', { timeout }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, { 'src/a.ts': 'export const a = 1;\n' });
  repository.commit('Change the branch', { 'src/a.ts': 'export const a = 2;\n', 'src/b.ts': 'export const b = 1;\n' });
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 72, 'src/b.ts': 49.9 }) });

  const result = await runScript(t, astMetricsDeltaScript, ['--base', 'main', '--min', '50'], { cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  49.9  src/b.ts  below 50\n  72.0  src/a.ts\nResult: 1 of 2 files below 50. Goal: 50 or more for each file.\n'
    + 'Comparison with main: ast-report/compare.html\n');
  assert.equal(result.code, 1);
});

test('Given --no-compare, when the check runs, then ast-metrics gets no comparison ref and no comparison line is printed', { timeout }, async (t) => {
  const repository = oneChangedFile(t);
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 90 }) });

  const result = await runScript(t, astMetricsDeltaScript, ['--base', 'main', '--no-compare'], { cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  90.0  src/a.ts\nResult: all 1 file at 85 or more.\n');
  assert.equal(result.code, 0);
  assert.deepEqual(fake.calls(), [{ argv: ['analyze', ...reportArgs], cwd: repository.root }]);
});

test('Given origin/main and no --base, when the check runs, then it compares with origin/main', { timeout }, async (t) => {
  const repository = oneChangedFile(t);
  repository.git('update-ref', 'refs/remotes/origin/main', 'main');
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 90 }) });

  const result = await runScript(t, astMetricsDeltaScript, [], { cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  90.0  src/a.ts\nResult: all 1 file at 85 or more.\nComparison with origin/main: ast-report/compare.html\n');
  assert.equal(result.code, 0);
  assert.deepEqual(fake.calls().map((call) => call.argv), [['analyze', '--compare-with=origin/main', ...reportArgs]]);
});

// A shell gives PWD the path through the link. ast-metrics, a Go program, then writes paths through the link too,
// unless the command gives it the root in PWD.
test('Given a caller in the repository through a symbolic link, when the check runs, then each score still belongs to its file', { timeout }, async (t) => {
  const repository = oneChangedFile(t);
  const link = repository.linkToRoot(t);
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 60 }) });

  const result = await runScript(t, astMetricsDeltaScript, ['--base', 'main', '--no-compare'], { cwd: link, env: { ...fake.env, PWD: link } });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  60.0  src/a.ts  below 85\nResult: 1 of 1 file below 85. Goal: 85 or more for each file.\n');
  assert.equal(result.code, 1);
});

test('Given a PATH without ast-metrics, when the check runs, then it fails with a diagnostic that names ast-metrics', { timeout }, async (t) => {
  const repository = oneChangedFile(t);

  const result = await runScript(t, astMetricsDeltaScript, ['--base', 'main'], { cwd: repository.root, env: { PATH: pathWithoutAstMetrics(t) } });

  assert.equal(result.stderr, notInstalled);
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
});

test('Given ast-metrics that exits 2 with an error text, when the check runs, then the error text reaches the caller and the check fails', { timeout }, async (t) => {
  const repository = oneChangedFile(t);
  const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 90 }), stderr: 'The analysis stopped.\n', exitCode: 2 });

  const result = await runScript(t, astMetricsDeltaScript, ['--base', 'main'], { cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, 'The analysis stopped.\nast-metrics-delta: ast-metrics analyze failed with exit status 2.\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
});

for (const [args, base] of [[['--base', 'no-such-branch'], 'no-such-branch'], [[], 'origin/main']] as const) {
  test(`Given the unknown base ref ${base}, when the check runs, then it fails with a diagnostic and does not run ast-metrics`, { timeout }, async (t) => {
    const repository = oneChangedFile(t);
    const fake = astMetricsCliFakeOnPath(t, { metrics: metricsReportOf({ 'src/a.ts': 90 }) });

    const result = await runScript(t, astMetricsDeltaScript, args, { cwd: repository.root, env: fake.env });

    assert.equal(result.stderr, `ast-metrics-delta: The base ref "${base}" is not a commit in this repository. Fetch it, or name another ref with --base.\n`);
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
    assert.deepEqual(fake.calls(), []);
  });
}
