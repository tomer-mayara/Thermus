import assert from 'node:assert/strict';
import { test } from 'node:test';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { crapFixture } from './fixtures/ast-metrics-crap.ts';

for (const [paths, share, score, instruction, code] of [
  [20, 0.5, '70', 'cover ≥ 71%', 1],
  [35, 1, '35', 'split', 1],
  [4, 0, '20', 'for 15: cover ≥ 12%', 1],
  [15, 1, '15', 'ok', 0],
  [5, 0, '30', 'cover ≥ 1%', 1],
  [25, 0.8, '30', 'cover ≥ 81%', 1],
  [25, 0.81, '29', 'ok', 1],
  [0, 0, '0', 'ok', 0],
] as const) {
  test(`Given a new function with ${paths} paths and share ${share}, when goals run, then the table shows ${instruction} and the required goal result`, async (t) => {
    const { repository, fake, file } = crapFixture(t, [{ name: 'run', paths, share }]);
    const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', file], cwd: repository.root, env: fake.env });
    assert.equal(result.stderr, '');
    assert.equal(result.code, code, result.stdout);
    assert.match(result.stdout, /\| File \| Function \| Change \| Paths \| Coverage \| CRAP \| To do \|/);
    assert.ok(result.stdout.includes(instruction), result.stdout);
    assert.ok(result.stdout.includes(score), result.stdout);
    assert.match(result.stdout, /\| new \|/);
    assert.equal(new Set(fake.requests().map(({ pid }) => pid)).size, 1);
    assert.deepEqual(fake.calls().map(({ tool }) => tool), ['get_file_metrics']);
  });
}

test('Given an unchanged high function explicitly selected against HEAD, when goals run, then its retained reason is visible and known limit violation fails', async (t) => {
  const { repository, fake, file, coverage } = crapFixture(t, [{ name: 'run', paths: 35, share: 1 }]);
  repository.commit('Add current function');
  coverage();
  const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'HEAD', '--coverage', file, 'src/a.ts'], cwd: repository.root, env: fake.env });
  assert.equal(result.code, 1, result.stderr);
  assert.match(result.stdout, /\| unchanged \|/);
  assert.match(result.stdout, /unchanged by this PR/);
});

test('Given a changed four-path function, when goals run, then the new-function target is advisory and the strict limit passes', async (t) => {
  const { repository, fake, file } = crapFixture(t, [{ name: 'run', paths: 4, share: 0 }], 'export function run() { return 99; }');
  const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', file], cwd: repository.root, env: fake.env });
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /\| changed \|/);
  assert.match(result.stdout, /ok; for 15: cover ≥ 12%/);
});

test('Given a measured function missing from valid coverage, when goals run, then it shows an unknown bound and fails its required goal', async (t) => {
  const { repository, fake, file } = crapFixture(t, [{ name: 'run', paths: 8 }]);
  const result = await runScript(t, astMetricsCrapScript, { args: ['--base', 'main', '--coverage', file], cwd: repository.root, env: fake.env });
  assert.equal(result.code, 1, result.stderr);
  assert.match(result.stdout, /≥ 8/);
  assert.match(result.stdout, /no coverage data/);
});
