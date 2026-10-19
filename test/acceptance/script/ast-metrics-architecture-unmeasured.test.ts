import assert from 'node:assert/strict';
import { test } from 'node:test';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { bandedBase, coverageArguments, fn, unitCoverage } from './fixtures/ast-metrics-architecture-coverage.ts';
import { edited, snapshotArguments } from './fixtures/ast-metrics-architecture-snapshots.ts';

const timeout = 20_000;

test('Given an excluded zero-own function at 30 paths, when architecture runs, then its covered share stays unknown and its known violation is a lower bound', { timeout }, async (t) => {
  const head = edited(bandedBase, { files: { 'src/auth/session.ts': { functions: [fn('openSession', 30), fn('(anonymous)', 3), fn('refresh', 30)] } } });
  const coverage = { ...unitCoverage, unmeasuredFunctions: [{ path: 'src/auth/session.ts', name: 'openSession', start: 0, end: 99, reason: 'no-own-characters' }] };
  const args = [...snapshotArguments(t, bandedBase, head), '--touched', 'src/auth/session.ts', ...coverageArguments(t, coverage)];

  const result = await runScript(t, astMetricsArchitectureScript, { args, env: { PATH: '' } });

  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.stdout.includes('▲ warning: 3 fn ≥ 30 (+1); assessment incomplete: 3 unknown'), result.stdout);
  assert.ok(result.stdout.includes('`openSession`: paths 30, covered unknown, CRAP ≥ 30'), result.stdout);
  assert.equal(result.stdout.includes('CRAP 930.0'), false, result.stdout);
  assert.equal(result.stdout.includes('CRAP 30.0'), false, result.stdout);
  assert.ok(result.stdout.includes('Base functions without an estimated covered share: 3.'), result.stdout);
});

test('Given unmatched refresh at 30 paths and an anonymous function at five paths, when architecture runs, then known risk is counted, lower bounds and unmeasured functions are shown, and assessment is incomplete', { timeout }, async (t) => {
  const head = edited(bandedBase, { files: { 'src/auth/session.ts': { functions: [fn('openSession', 4), fn('(anonymous)', 5), fn('refresh', 30)] } } });
  const args = [...snapshotArguments(t, bandedBase, head), '--touched', 'src/auth/session.ts', ...coverageArguments(t)];
  const result = await runScript(t, astMetricsArchitectureScript, { args, env: { PATH: '' } });

  assert.equal(result.code, 0, result.stderr);
  assert.ok(result.stdout.includes('functions ≥ 30: 5 → 5'), result.stdout);
  assert.ok(result.stdout.includes('▲ warning: 2 fn ≥ 30; assessment incomplete: 2 unknown'), result.stdout);
  assert.ok(result.stdout.includes('- `src/auth/session.ts` `(anonymous)`: paths 5, covered unknown, CRAP ≥ 5'), result.stdout);
  assert.ok(result.stdout.includes('- `src/auth/session.ts` `refresh`: paths 30, covered unknown, CRAP ≥ 30'), result.stdout);
});
