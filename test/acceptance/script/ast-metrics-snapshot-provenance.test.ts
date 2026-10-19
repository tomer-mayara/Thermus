import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { repositoryFiles, snapshotDoublesOnPath } from './fixtures/ast-metrics-snapshot-answers.ts';
import { GitRepository } from './fixtures/git-repository.ts';

test('Given a source tree, when a snapshot captures its metrics, then it records source and expected coverage input identities', async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Add files', repositoryFiles);
  const doubles = snapshotDoublesOnPath(t);
  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });
  assert.equal(result.code, 0, result.stderr);
  const snapshot = JSON.parse(readFileSync(join(repository.root, 'ast-report/snapshot.json'), 'utf8'));
  assert.match(snapshot.provenance?.sourceFingerprint ?? '', /^[a-f0-9]{64}$/);
  assert.match(snapshot.provenance?.inputsFingerprint ?? '', /^[a-f0-9]{64}$/);
  assert.equal(snapshot.provenance?.suite, 'unit');
  assert.equal(snapshot.provenance?.measurementVersion, 'own-characters-1');
});

test('Given source inputs that change during analysis, when a snapshot finishes, then it refuses to publish mixed metrics', async (t) => {
  const repository = GitRepository.create(t);
  repository.commit('Add files', repositoryFiles);
  const doubles = snapshotDoublesOnPath(t, { cli: { json: '{"concernedFiles":[]}', delayMs: 500 } });
  const timer = setInterval(() => {
    if (doubles.cli.calls().some(({ argv }) => argv[0] === 'analyze')) writeFileSync(join(repository.root, 'src/auth/session.ts'), 'export const changed = true;\n');
  }, 10);
  t.after(() => clearInterval(timer));
  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });
  clearInterval(timer);
  assert.equal(result.code, 1);
  assert.equal(result.stderr, 'ast-metrics-snapshot: The inputs changed during the snapshot. No snapshot was published.\n');
  assert.equal(existsSync(join(repository.root, 'ast-report/snapshot.json')), false);
});
