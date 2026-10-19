import assert from 'node:assert/strict';
import { test } from 'node:test';
import { astMetricsReviewScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// An empty PATH has no git and no ast-metrics. Thus these cases also show that the command checks its arguments first.
const noTools = { env: { PATH: '' } };

test('Given --help, when the review runs, then it explains the options, the report file, and the exit status', async (t) => {
  const result = await runScript(t, astMetricsReviewScript, { args: ['--help'], ...noTools });

  assert.equal(result.stderr, '');
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^Usage: node script\/code-quality\/ast-metrics-review\.ts \[--base REF\] \[--max-findings N\] \[--allow-tool-version\] \[--help\]\n/);
  for (const text of ['origin/main', 'default: 50', 'ast-report/review.md', 'ast-report/review.json', '.ast-metrics-baseline.yaml', 'high', 'inconsistent review results']) {
    assert.ok(result.stdout.includes(text), `The help does not name ${text}.`);
  }
});

for (const value of ['0', '1001', 'abc', '2.5', '-3', '']) {
  test(`Given --max-findings=${value}, when the review runs, then it fails with a diagnostic about --max-findings`, async (t) => {
    const result = await runScript(t, astMetricsReviewScript, { args: [`--max-findings=${value}`], ...noTools });

    assert.equal(result.stderr, 'ast-metrics-review: The --max-findings value must be an integer from 1 to 1000.\n');
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}

for (const value of ['', '--output=review.txt']) {
  test(`Given --base=${value}, when the review runs, then it fails with a diagnostic about --base`, async (t) => {
    const result = await runScript(t, astMetricsReviewScript, { args: [`--base=${value}`], ...noTools });

    assert.equal(result.stderr, 'ast-metrics-review: The --base value must name a git ref.\n');
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}

for (const args of [['--fail-on', 'any'], ['--max-findings'], ['main']]) {
  test(`Given the arguments ${args.join(' ')}, when the review runs, then it fails with a diagnostic that points to --help`, async (t) => {
    const result = await runScript(t, astMetricsReviewScript, { args, ...noTools });

    assert.equal(result.stderr, 'ast-metrics-review: Invalid arguments. Use --help for the supported options.\n');
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}
