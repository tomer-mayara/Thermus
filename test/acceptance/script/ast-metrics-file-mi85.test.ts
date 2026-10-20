import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { jsonReport, repositoryFiles, snapshotDoublesOnPath } from './fixtures/ast-metrics-snapshot-answers.ts';
import { GitRepository } from './fixtures/git-repository.ts';

test('Given captured raw file MI, when the selected files are assessed offline, then raw 84.96 is LOW despite displayed 85 and missing evidence stays unknown', { timeout: 20_000 }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, repositoryFiles);
  const report = JSON.parse(jsonReport);
  report.concernedFiles.find(({ path }: { path: string }) => path === '{root}/src/auth/session.ts').maintainability.maintainabilityIndex = 84.96;
  report.concernedFiles.find(({ path }: { path: string }) => path === '{root}/src/auth/tokens.ts').maintainability.maintainabilityIndex = 85;
  const doubles = snapshotDoublesOnPath(t, { cli: { json: JSON.stringify(report) } });
  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });
  assert.equal(result.code, 0, result.stderr);
  const text = readFileSync(join(repository.root, 'ast-report/snapshot.json'), 'utf8');
  const snapshot = JSON.parse(text);
  assert.equal(snapshot.files.find(({ path }: { path: string }) => path === 'src/auth/session.ts').maintainability, 85);
  const { fileMi85Of } = await import(new URL('assessment/file-mi85.ts', pathToFileURL(astMetricsSnapshotScript)).href);
  const expected = { commit: repository.git('rev-parse', 'HEAD').trim(), tool: '0.43.1' };
  assert.deepEqual(fileMi85Of(text, expected, ['src/auth/tokens.ts', 'src/auth/session.ts', 'src/kernel/ids.ts', 'src/missing.ts']), [
    { path: 'src/auth/tokens.ts', state: 'MEETS', maintainabilityRaw: 85, reason: 'Raw file MI is at least 85.' },
    { path: 'src/auth/session.ts', state: 'LOW', maintainabilityRaw: 84.96, reason: 'Raw file MI is below 85.' },
    { path: 'src/kernel/ids.ts', state: 'UNKNOWN', reason: 'The snapshot row has no raw file MI.' },
    { path: 'src/missing.ts', state: 'UNKNOWN', reason: 'The snapshot has no row for this file.' },
  ]);
});
