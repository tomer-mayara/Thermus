import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { fileMetricsAnswers, jsonReport, repositoryFiles, serverAnswers, snapshotDoublesOnPath } from './fixtures/ast-metrics-snapshot-answers.ts';
import { GitRepository } from './fixtures/git-repository.ts';

test('Given captured native observations, when read offline for the expected revision and tool, then raw values and unavailable fields survive without display fallback', { timeout: 20_000 }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, repositoryFiles);
  const report = JSON.parse(jsonReport);
  report.concernedFiles.find(({ path }: { path: string }) => path === '{root}/src/auth/session.ts').maintainability.maintainabilityIndex = 84.96;
  const doubles = snapshotDoublesOnPath(t, { cli: { json: JSON.stringify(report) }, server: { ...serverAnswers, get_file_metrics: {
    ...fileMetricsAnswers,
    'src/admin/pages/account.ts': { ...fileMetricsAnswers['src/admin/pages/account.ts'], classes: [{ name: '', maintainability: { maintainability_index: 0 } }, { name: 'Same' }, { name: 'Same', maintainability: { maintainability_index: 65.43822959731905 } }] },
    'src/auth/tokens.ts': { ...fileMetricsAnswers['src/auth/tokens.ts'], classes: [] },
  } } });
  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });
  assert.equal(result.code, 0, result.stderr);
  const text = readFileSync(join(repository.root, 'ast-report/snapshot.json'), 'utf8');
  const snapshot = JSON.parse(text);
  const { snapshotObservationsIn } = await import(new URL('snapshot/observations.ts', pathToFileURL(astMetricsSnapshotScript)).href);
  const expected = { commit: repository.git('rev-parse', 'HEAD').trim(), tool: '0.43.1' };
  assert.equal(snapshot.files[1].maintainability, 85);
  const observed = snapshotObservationsIn(text, expected);
  assert.equal(observed.files[1].maintainabilityRaw, 84.96);
  assert.equal(Object.hasOwn(observed.files[1], 'maintainability'), false);
  assert.deepEqual(observed.files[0].classObservations, [{ name: '', maintainabilityRaw: 0 }, { name: 'Same' }, { name: 'Same', maintainabilityRaw: 65.43822959731905 }]);
  assert.deepEqual(observed.files[2].classObservations, []);
  assert.equal(Object.hasOwn(observed.files[1], 'classObservations'), false);
  const legacy = { ...snapshot, files: snapshot.files.map(({ path, maintainability }: { path: string; maintainability?: number }) => ({ path, maintainability })) };
  assert.deepEqual(snapshotObservationsIn(JSON.stringify(legacy), expected).files, snapshot.files.map(({ path }: { path: string }) => ({ path })));
  assert.throws(() => snapshotObservationsIn(text, { ...expected, commit: '0'.repeat(40) }));
  assert.throws(() => snapshotObservationsIn(text, { ...expected, tool: 'other-tool' }));
});
