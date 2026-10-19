import assert from 'node:assert/strict';
import { test } from 'node:test';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { coverageArguments, coverageIdentity } from './fixtures/ast-metrics-architecture-coverage.ts';
import { baseSnapshot, edited, snapshotArguments } from './fixtures/ast-metrics-architecture-snapshots.ts';

test('Given legacy snapshots with an unrelated same-name function, when the offline report runs, then identity is unknown and the removed base has no estimated CRAP', async (t) => {
  const fn = { name: 'run', paths: 8 };
  const base = edited(baseSnapshot, { files: { 'src/application.ts': { functions: [fn] } } });
  const head = edited(base, { files: { 'src/application.ts': null }, addedFiles: [{ path: 'src/new.ts', community: null, functions: [fn], paths: 8, loc: 8 }] });
  const result = await runScript(t, astMetricsArchitectureScript, { args: [...snapshotArguments(t, base, head), '--touched', 'src/application.ts,src/new.ts'], env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Unknown function identity: 1/u);
  assert.doesNotMatch(result.stdout, /`run`:.*base new/u);
});


test('Given a deleted base function without a head partner, when compatible coverage is supplied, then its estimated share remains unknown', async (t) => {
  const base = edited({ ...baseSnapshot, provenance: coverageIdentity }, { files: { 'src/application.ts': { functions: [{ name: 'removed', paths: 8 }] } } });
  const head = edited(base, { files: { 'src/application.ts': null } });
  const result = await runScript(t, astMetricsArchitectureScript, { args: [...snapshotArguments(t, base, head), '--touched', 'src/application.ts', ...coverageArguments(t)], env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Base functions without an estimated covered share: 1\./u);
  assert.match(result.stdout, /52\.0 → gone \| 30 → gone \| not measured → gone \| gone/u);
});
