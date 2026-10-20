import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsArchitectureScript, astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { baseSnapshot, snapshotArguments } from './fixtures/ast-metrics-architecture-snapshots.ts';
import { jsonReport, repositoryFiles, snapshotDoublesOnPath } from './fixtures/ast-metrics-snapshot-answers.ts';
import { GitRepository } from './fixtures/git-repository.ts';

test('Given native file MI 84.96, when the snapshot command runs, then it keeps raw 84.96 and rounded 85 from one analysis and one session', { timeout: 20_000 }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, repositoryFiles);
  const report = JSON.parse(jsonReport);
  report.concernedFiles.find(({ path }: { path: string }) => path === '{root}/src/auth/session.ts').maintainability.maintainabilityIndex = 84.96;
  const doubles = snapshotDoublesOnPath(t, { cli: { json: JSON.stringify(report) } });

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, 'Wrote ast-report/snapshot.json: 3 communities, 4 files, 5 functions.\n');
  const snapshot = JSON.parse(readFileSync(join(repository.root, 'ast-report/snapshot.json'), 'utf8'));
  assert.equal(snapshot.version, 1);
  const file = snapshot.files.find(({ path }: { path: string }) => path === 'src/auth/session.ts');
  assert.equal(file.maintainabilityRaw, 84.96);
  assert.equal(file.maintainability, 85);
  assert.deepEqual(doubles.cli.calls().filter(({ argv }) => argv[0] !== 'version').map(({ argv }) => argv[0]), ['analyze', 'mcp']);
  assert.equal(doubles.server.requests().filter(({ method }) => method === 'initialize').length, 1);
});

test('Given a numeric string for native file MI and an existing capture, when the snapshot command runs, then it names the file and keeps the capture', { timeout: 20_000 }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, repositoryFiles);
  repository.write({ 'ast-report/snapshot.json': 'previous capture\n' });
  const report = JSON.parse(jsonReport);
  report.concernedFiles.find(({ path }: { path: string }) => path === '{root}/src/auth/session.ts').maintainability.maintainabilityIndex = '84.96';
  const doubles = snapshotDoublesOnPath(t, { cli: { json: JSON.stringify(report) } });

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'ast-metrics-snapshot: Invalid file maintainability for src/auth/session.ts: expected an object with an optional finite maintainabilityIndex.\n');
  assert.equal(readFileSync(join(repository.root, 'ast-report/snapshot.json'), 'utf8'), 'previous capture\n');
  assert.deepEqual(doubles.server.requests(), []);
});

test('Given legacy snapshots and copies with raw file MI, when architecture reads each pair, then both complete reports are identical', { timeout: 20_000 }, async (t) => {
  const enriched = {
    ...baseSnapshot,
    files: baseSnapshot.files.map((file) => ({ ...file, ...(file.maintainability === undefined ? {} : { maintainabilityRaw: file.maintainability - 0.04 }) })),
  };

  const legacy = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, baseSnapshot, baseSnapshot), env: { PATH: '' } });
  const raw = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, enriched, enriched), env: { PATH: '' } });

  assert.equal(legacy.code, 0, legacy.stderr);
  assert.equal(raw.code, 0, raw.stderr);
  assert.notEqual(legacy.stdout, '');
  assert.equal(raw.stdout, legacy.stdout);
  assert.equal(raw.stderr, legacy.stderr);
});
