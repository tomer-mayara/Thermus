import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { astMetricsCliFakeOnPath, pathWithoutAstMetrics } from '../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import { astMetricsReviewScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { GitRepository } from './fixtures/git-repository.ts';

const timeout = 20_000;
const noFinding = '## AST Metrics review\n\nNo new or worsened finding.\n';
const highFinding = '## AST Metrics review\n\n- high: src/a.ts: Cyclomatic complexity too high: got 25 (max: 20)\n';
const noBaseline = 'ast-metrics-review: no .ast-metrics-baseline.yaml; every existing rule violation counts as new.\n';

function reviewArgs(base: string, maxFindings: number): string[] {
  return ['review', '--base', base, '--format', 'markdown', '--max-findings', String(maxFindings), '--report-markdown', './ast-report/review.md', '--report-json', './ast-report/review.json', '--fail-on', 'high'];
}

// The branch feature changes src/a.ts. By default, main also holds a baseline.
function changedBranch(t: TestContext, mainFiles: Readonly<Record<string, string>> = { '.ast-metrics-baseline.yaml': 'ignored: []\n' }): GitRepository {
  const repository = GitRepository.onFeatureBranch(t, { 'src/a.ts': 'export const a = 1;\n', ...mainFiles });
  repository.commit('Change the branch', { 'src/a.ts': 'export const a = 2;\n' });
  return repository;
}

test('Given a branch with a baseline, when the review runs against main, then ast-metrics review gets the agreed arguments at the root and its Markdown reaches stdout', { timeout }, async (t) => {
  const repository = changedBranch(t);
  const fake = astMetricsCliFakeOnPath(t, { review: noFinding });

  const result = await runScript(t, astMetricsReviewScript, { args: ['--base', 'main'], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, noFinding);
  assert.equal(result.code, 0);
  assert.deepEqual(fake.calls(), [{ argv: ['version'], cwd: repository.root }, { argv: reviewArgs('main', 50), cwd: repository.root }]);
});

test('Given a review that finds a high finding and exits 1, when the review runs, then the Markdown and the error text reach the caller and the review fails', { timeout }, async (t) => {
  const repository = changedBranch(t);
  const fake = astMetricsCliFakeOnPath(t, { review: highFinding, stderr: 'Quality gate failed.\n', exitCode: 1 });

  const result = await runScript(t, astMetricsReviewScript, { args: ['--base', 'main'], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, 'Quality gate failed.\n');
  assert.equal(result.stdout, highFinding);
  assert.equal(result.code, 1);
});

test('Given no baseline file at the root, when the review runs, then it warns that each existing violation counts as new and continues', { timeout }, async (t) => {
  const repository = changedBranch(t, {});
  const fake = astMetricsCliFakeOnPath(t, { review: noFinding });

  const result = await runScript(t, astMetricsReviewScript, { args: ['--base', 'main'], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, noBaseline);
  assert.equal(result.stdout, noFinding);
  assert.equal(result.code, 0);
  assert.equal(fake.calls().length, 2);
});

test('Given --max-findings 7, when the review runs, then ast-metrics review gets 7', { timeout }, async (t) => {
  const repository = changedBranch(t);
  const fake = astMetricsCliFakeOnPath(t, { review: noFinding });

  const result = await runScript(t, astMetricsReviewScript, { args: ['--base', 'main', '--max-findings', '7'], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.code, 0);
  assert.deepEqual(fake.calls().map((call) => call.argv), [['version'], reviewArgs('main', 7)]);
});

test('Given origin/main and no --base, when the review runs, then it compares with origin/main', { timeout }, async (t) => {
  const repository = changedBranch(t);
  repository.git('update-ref', 'refs/remotes/origin/main', 'main');
  const fake = astMetricsCliFakeOnPath(t, { review: noFinding });

  const result = await runScript(t, astMetricsReviewScript, { args: [], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, '');
  assert.equal(result.code, 0);
  assert.deepEqual(fake.calls().map((call) => call.argv), [['version'], reviewArgs('origin/main', 50)]);
});

test('Given a PATH without ast-metrics, when the review runs, then it fails with a diagnostic that names ast-metrics', { timeout }, async (t) => {
  const repository = changedBranch(t);

  const result = await runScript(t, astMetricsReviewScript, { args: ['--base', 'main'], cwd: repository.root, env: { PATH: pathWithoutAstMetrics(t) } });

  assert.equal(result.stderr, 'ast-metrics-review: ast-metrics is not installed or not on PATH. See docs/implementation/ast-metrics-review.md.\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
});

test('Given an unknown base ref, when the review runs, then it fails with a diagnostic and does not run ast-metrics', { timeout }, async (t) => {
  const repository = changedBranch(t);
  const fake = astMetricsCliFakeOnPath(t, { review: noFinding });

  const result = await runScript(t, astMetricsReviewScript, { args: ['--base', 'no-such-branch'], cwd: repository.root, env: fake.env });

  assert.equal(result.stderr, 'ast-metrics-review: The base ref "no-such-branch" is not a commit in this repository. Fetch it, or name another ref with --base.\n');
  assert.equal(result.stdout, '');
  assert.equal(result.code, 1);
  assert.deepEqual(fake.calls(), []);
});
