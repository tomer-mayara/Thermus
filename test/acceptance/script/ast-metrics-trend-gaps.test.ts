import assert from 'node:assert/strict';
import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsArchitectureScript, astMetricsBackfillScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { baseDoublesOnPath, baseRepository } from './fixtures/ast-metrics-snapshot-base.ts';
import { baseSnapshot, snapshotArguments } from './fixtures/ast-metrics-architecture-snapshots.ts';
import { emptyStore, writeRecords } from './fixtures/ast-metrics-architecture-trend.ts';

const timeout = 20_000;

test('Given two recorded endpoints and two missing first-parent commits, when architecture renders repository history, then it reports one exact gap', { timeout }, async (t) => {
  const repository = baseRepository(t);
  const first = repository.git('rev-parse', 'HEAD').trim();
  repository.git('switch', '--quiet', 'main');
  for (const value of [2, 3, 4]) repository.commit(`Main ${value}`, { 'src/kernel/ids.ts': `export const value = ${value};\n` });
  const tip = repository.git('rev-parse', 'HEAD').trim();
  repository.git('update-ref', 'refs/remotes/origin/main', tip);
  const doubles = baseDoublesOnPath(t);
  const backfill = await runScript(t, astMetricsBackfillScript, { args: ['--count', '4'], cwd: repository.root, env: doubles.env });
  assert.equal(backfill.code, 0, backfill.stderr);
  const store = join(repository.root, 'docs', 'metrics');
  for (const name of readdirSync(store)) if (!name.includes(first.slice(0, 8)) && !name.includes(tip.slice(0, 8))) rmSync(join(store, name));

  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--no-coverage'], cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 0, result.stderr);
  const lines = result.stdout.split('\n').filter((line) => line.endsWith('have no record.'));
  assert.deepEqual(lines, [`2 commits of main between ${first.slice(0, 8)} and ${tip.slice(0, 8)} have no record.`]);
});

test('Given offline snapshots and a stored record with no Git or tool on PATH, when architecture renders, then it states dates cannot establish gaps', { timeout }, async (t) => {
  const store = emptyStore(t);
  writeRecords(store, [{ version: 1, commit: baseSnapshot.commit, date: baseSnapshot.date, ...baseSnapshot.global, cycles: 0, communities: [] }]);

  const result = await runScript(t, astMetricsArchitectureScript, { args: [...snapshotArguments(t, baseSnapshot, baseSnapshot), '--trend-store', store], cwd: store, env: { PATH: '' } });

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Gap check unavailable: offline snapshot dates cannot prove omitted commits\./u);
  assert.doesNotMatch(result.stdout, /commits of main between/u);
});

for (const history of ['missing origin/main', 'shallow'] as const) {
  test(`Given repository snapshots with ${history} history, when architecture renders, then structural output remains available and gap checks explain their limit`, { timeout }, async (t) => {
    const repository = baseRepository(t);
    if (history === 'shallow') {
      repository.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
      repository.write({ '.git/shallow': `${repository.git('rev-parse', 'HEAD').trim()}\n` });
    }
    const doubles = baseDoublesOnPath(t);

    const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main', '--no-coverage'], cwd: repository.root, env: doubles.env });

    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /## Architecture of src\//u);
    assert.match(result.stdout, history === 'shallow' ? /Gap check unavailable: Git history is shallow/u : /Gap check unavailable: Cannot check gaps without origin\/main/u);
    assert.doesNotMatch(result.stdout, /commits of main between/u);
  });
}
