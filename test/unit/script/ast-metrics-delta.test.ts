import assert from 'node:assert/strict';
import { test } from 'node:test';
import { astMetricsDeltaScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';

// An empty PATH has no git and no ast-metrics. Thus these cases also show that the command checks its arguments first.
const noTools = { env: { PATH: '' } };

test('Given --help, when the delta check runs, then it explains the options, the goal, and the report folder', async (t) => {
  const result = await runScript(t, astMetricsDeltaScript, ['--help'], noTools);

  assert.equal(result.stderr, '');
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^Usage: node script\/ast-metrics-delta\.mjs \[--base REF\] \[--min SCORE\] \[--no-compare\] \[--help\]\n/);
  for (const text of ['origin/main', 'default: 85', '--no-compare', 'ast-report/', 'not measured']) {
    assert.ok(result.stdout.includes(text), `The help does not name ${text}.`);
  }
});

for (const value of ['abc', '-1', '129', '8.5', '']) {
  test(`Given --min=${value}, when the delta check runs, then it fails with a diagnostic about --min`, async (t) => {
    const result = await runScript(t, astMetricsDeltaScript, [`--min=${value}`], noTools);

    assert.equal(result.stderr, 'ast-metrics-delta: The --min value must be an integer from 0 to 128.\n');
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}

for (const value of ['', '--output=diff.txt']) {
  test(`Given --base=${value}, when the delta check runs, then it fails with a diagnostic about --base`, async (t) => {
    const result = await runScript(t, astMetricsDeltaScript, [`--base=${value}`], noTools);

    assert.equal(result.stderr, 'ast-metrics-delta: The --base value must name a git ref.\n');
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}

for (const args of [['--maximum', '3'], ['--min'], ['main']]) {
  test(`Given the arguments ${args.join(' ')}, when the delta check runs, then it fails with a diagnostic that points to --help`, async (t) => {
    const result = await runScript(t, astMetricsDeltaScript, args, noTools);

    assert.equal(result.stderr, 'ast-metrics-delta: Invalid arguments. Use --help for the supported options.\n');
    assert.equal(result.stdout, '');
    assert.equal(result.code, 1);
  });
}
