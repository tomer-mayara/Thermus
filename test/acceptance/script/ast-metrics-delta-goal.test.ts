import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { astMetricsCliFakeOnPath } from '../../support/doubles/ast-metrics/ast-metrics-cli-path.ts';
import { astMetricsDeltaScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { metricsReportOf } from './fixtures/ast-metrics-report.ts';
import { GitRepository } from './fixtures/git-repository.ts';

// The goal applies to the production files under src/ only. Every other file has no goal.
const timeout = 20_000;
const args = ['--base', 'main', '--no-compare'];

// A branch that adds each scored file and each file without a measurement. ast-metrics gives the scores.
function branchWithScores(t: TestContext, scores: Readonly<Record<string, number>>, unmeasured: readonly string[] = []) {
  const repository = GitRepository.withBranchAdding(t, [...Object.keys(scores), ...unmeasured]);
  return { cwd: repository.root, env: astMetricsCliFakeOnPath(t, { metrics: metricsReportOf(scores) }).env };
}

test('Given each production file at 85 or more as the line shows it, when the check runs, then the result says so and the check passes', { timeout }, async (t) => {
  const result = await runScript(t, astMetricsDeltaScript, { args, ...branchWithScores(t, { 'src/b.ts': 97.26, 'src/a.ts': 84.96 }) });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  85.0  src/a.ts\n  97.3  src/b.ts\nResult: all 2 production files at 85 or more.\n');
  assert.equal(result.code, 0);
});

for (const [score, line, goal, code] of [
  [90, '  90.0  src/a.ts', 'all 1 production file at 85 or more.', 0],
  [60, '  60.0  src/a.ts  below 85', '1 of 1 production file below 85. Goal: 85 or more for each production file.', 1],
] as const) {
  test(`Given a test file below 85 and a production file at ${score}, when the check runs, then the test file has no goal and only the production file decides the result`, { timeout }, async (t) => {
    const result = await runScript(t, astMetricsDeltaScript, { args, ...branchWithScores(t, { 'test/unit/a.test.ts': 40, 'src/a.ts': score }) });

    assert.equal(result.stderr, '');
    assert.equal(result.stdout, `${line}\n  40.0  test/unit/a.test.ts  no goal\nResult: ${goal} 1 other file without a goal.\n`);
    assert.equal(result.code, code);
  });
}

test('Given a delta with test files only, when the check runs, then it lists them without a goal, says that no production file is in the delta, and passes', { timeout }, async (t) => {
  const result = await runScript(t, astMetricsDeltaScript, { args, ...branchWithScores(t, { 'test/support/b.ts': 70, 'test/unit/a.test.ts': 40 }) });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, [
    '  40.0  test/unit/a.test.ts  no goal',
    '  70.0  test/support/b.ts  no goal',
    'Result: no production file in the delta. 2 other files without a goal.',
    '',
  ].join('\n'));
  assert.equal(result.code, 0);
});

test('Given production files, other files, and files without a measurement, when the check runs, then it lists the production files first, then the other files, each group lowest score first, and then the files without a measurement', { timeout }, async (t) => {
  const scores = { 'test/src/helper.ts': 95, 'src/b.ts': 90, 'docker/check.ts': 30, 'src/a.ts': 70 };

  const result = await runScript(t, astMetricsDeltaScript, { args, ...branchWithScores(t, scores, ['test/types.ts', 'src/types.ts']) });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, [
    '  70.0  src/a.ts  below 85',
    '  90.0  src/b.ts',
    '  30.0  docker/check.ts  no goal',
    '  95.0  test/src/helper.ts  no goal',
    '  not measured  src/types.ts',
    '  not measured  test/types.ts',
    'Result: 1 of 2 production files below 85. Goal: 85 or more for each production file. 2 other files without a goal. 2 files not measured.',
    '',
  ].join('\n'));
  assert.equal(result.code, 1);
});

test('Given a production file that ast-metrics does not measure, when the check runs, then the file is listed as not measured and does not fail the check', { timeout }, async (t) => {
  const result = await runScript(t, astMetricsDeltaScript, { args, ...branchWithScores(t, { 'src/a.ts': 90 }, ['src/types.ts']) });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, '  90.0  src/a.ts\n  not measured  src/types.ts\nResult: all 1 production file at 85 or more. 1 file not measured.\n');
  assert.equal(result.code, 0);
});

test('Given --min 50, when the check runs, then the marker, the goal, and the result of the production files follow 50, and a test file below 50 has no goal', { timeout }, async (t) => {
  const result = await runScript(t, astMetricsDeltaScript, {
    args: [...args, '--min', '50'], ...branchWithScores(t, { 'src/a.ts': 72, 'src/b.ts': 49.9, 'test/c.test.ts': 20 }),
  });

  assert.equal(result.stderr, '');
  assert.equal(result.stdout, [
    '  49.9  src/b.ts  below 50',
    '  72.0  src/a.ts',
    '  20.0  test/c.test.ts  no goal',
    'Result: 1 of 2 production files below 50. Goal: 50 or more for each production file. 1 other file without a goal.',
    '',
  ].join('\n'));
  assert.equal(result.code, 1);
});
