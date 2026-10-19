import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { loaderCaptureFiles } from './fixtures/ast-metrics-coverage-loader.ts';
import { asynchronousRequireLoaderFiles } from './fixtures/ast-metrics-coverage-loader-async.ts';
import { capturedLoader, lifecyclePreload, loaderParticipants, type CoverageReport } from './fixtures/ast-metrics-coverage-loader-harness.ts';

for (const mode of ['import', 'require'] as const) {
  const loader = mode === 'import' ? 'default tsx async loader with the import capture preload' : 'public namespaced tsx async loader with the require capture preload';
  test(`Given real pnpm and the ${loader}, when its typed entry emits exit and later imports shutdown work, then collection and strict import verify every loader participant and retain its provenance`, { timeout: 30_000 }, async (t) => {
    const preload = lifecyclePreload(mode);
    const files = mode === 'import' ? loaderCaptureFiles(preload) : asynchronousRequireLoaderFiles(preload);
    const { repository, report, archive } = await capturedLoader(t, files);
    assert.equal(readFileSync(join(repository.root, 'ast-report/loader-events.log'), 'utf8'), 'early\nafter-emitted-exit\ncleanup\n');
    const sample = report.files.find(({ path }) => path === 'src/sample.ts');
    for (const name of ['early', 'afterEmittedExit', 'cleanup']) {
      assert.ok(sample?.functions.some((entry) => entry.name === name && entry.called > 0), JSON.stringify(sample));
    }

    loaderParticipants(archive);

    const imported = await runScript(t, astMetricsCoverageScript, { cwd: repository.root, args: ['--from', archive, '--out', 'ast-report/imported-coverage.json'] });
    assert.equal(imported.code, 0, imported.stderr);
    const retained = JSON.parse(readFileSync(join(repository.root, 'ast-report/imported-coverage.json'), 'utf8')) as CoverageReport;
    assert.deepEqual(retained.provenance, report.provenance);
    assert.equal(retained.commit, report.commit);
    assert.equal(retained.suite, report.suite);
  });
}
