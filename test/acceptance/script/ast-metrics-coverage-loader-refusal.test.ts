import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { capturedLoader, lifecyclePreload } from './fixtures/ast-metrics-coverage-loader-harness.ts';
import { refusedLoaderFiles } from './fixtures/ast-metrics-coverage-loader-refusal.ts';

for (const refusal of ['default SIGTERM', 'Worker.terminate', 'stalled loader', 'thrown exit listener', 'synchronous tsx worker'] as const) {
  const behavior = refusal === 'synchronous tsx worker' ? 'the synchronous tsx esbuild worker and the require capture preload' : refusal;
  test(`Given verified coverage and a real tsx entry with ${behavior}, when capture cannot prove loader completion, then it fails within the deadline and preserves the known-good report`, { timeout: 30_000 }, async (t) => {
    const { repository } = await capturedLoader(t);
    const reportFile = join(repository.root, 'ast-report/coverage.json');
    const original = readFileSync(reportFile);
    const archives = readdirSync(join(repository.root, 'ast-report/coverage-captures'));
    repository.write(refusedLoaderFiles(lifecyclePreload(refusal === 'synchronous tsx worker' ? 'require' : 'import'), refusal));
    writeFileSync(join(repository.root, 'ast-report/loader-events.log'), '');
    const started = performance.now();

    const result = await runScript(t, astMetricsCoverageScript, { cwd: repository.root });

    assert.ok(performance.now() - started < 15_000, 'The incomplete loader capture exceeded its deadline.');
    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stderr, /Incomplete captures are unverified/);
    assert.deepEqual(readFileSync(reportFile), original);
    assert.deepEqual(readdirSync(join(repository.root, 'ast-report/coverage-captures')), archives);
    if (refusal === 'stalled loader') {
      assert.match(readFileSync(join(repository.root, 'ast-report/loader-events.log'), 'utf8'), /loader-blocked/);
    }
    if (refusal === 'thrown exit listener') {
      assert.match(readFileSync(join(repository.root, 'ast-report/loader-child-stderr.log'), 'utf8'), /Error: loader-exit-original/);
    }
  });
}
