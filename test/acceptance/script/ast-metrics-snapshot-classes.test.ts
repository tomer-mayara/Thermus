import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { astMetricsArchitectureScript, astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { baseSnapshot, snapshotArguments } from './fixtures/ast-metrics-architecture-snapshots.ts';
import { fileMetricsAnswers, repositoryFiles, serverAnswers, snapshotDoublesOnPath, sourceFiles } from './fixtures/ast-metrics-snapshot-answers.ts';
import { GitRepository } from './fixtures/git-repository.ts';

test('Given partial native class observations, when the snapshot command runs, then it preserves their labels, order, duplicates and raw MI from the existing file requests', { timeout: 20_000 }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, repositoryFiles);
  const classes = [
    { name: 'src/admin::Same', maintainability: { maintainability_index: 65.43822959731905 } },
    { name: '', maintainability: { maintainability_index: 0 } },
    { name: 'src/admin::Same' },
    { name: 'Empty', maintainability: {} },
  ];
  const doubles = snapshotDoublesOnPath(t, { server: { ...serverAnswers, get_file_metrics: {
    ...fileMetricsAnswers,
    'src/admin/pages/account.ts': { ...fileMetricsAnswers['src/admin/pages/account.ts'], classes },
    'src/auth/tokens.ts': { ...fileMetricsAnswers['src/auth/tokens.ts'], classes: [] },
  } } });

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, 'Wrote ast-report/snapshot.json: 3 communities, 4 files, 5 functions.\n');
  const snapshot = JSON.parse(readFileSync(join(repository.root, 'ast-report/snapshot.json'), 'utf8'));
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.files[0].maintainabilityRaw, 70.06);
  assert.equal(snapshot.files[0].maintainability, 70.1);
  assert.equal(snapshot.files[0].functions[0].maintainability, 59);
  assert.equal(snapshot.communities[0].maintainability, 70.1);
  assert.equal(snapshot.global.maintainability, 70.3);
  assert.deepEqual(snapshot.files.map(({ path, classObservations }: { path: string; classObservations?: unknown }) => [path, classObservations]), [
    ['src/admin/pages/account.ts', [{ name: 'src/admin::Same', maintainabilityRaw: 65.43822959731905 }, { name: '', maintainabilityRaw: 0 }, { name: 'src/admin::Same' }, { name: 'Empty' }]],
    ['src/auth/session.ts', undefined], ['src/auth/tokens.ts', []], ['src/kernel/ids.ts', undefined],
  ]);
  assert.equal(Object.hasOwn(snapshot.files[1], 'classObservations'), false);
  assert.equal(Object.hasOwn(snapshot.files[3], 'classObservations'), false);
  assert.deepEqual(doubles.cli.calls().filter(({ argv }) => argv[0] !== 'version').map(({ argv }) => argv[0]), ['analyze', 'mcp']);
  assert.equal(doubles.server.requests().filter(({ method }) => method === 'initialize').length, 1);
  assert.deepEqual(doubles.server.calls(), [
    { tool: 'get_communities', arguments: { with_members: true }, cwd: repository.root },
    ...sourceFiles.map((path) => ({ tool: 'get_file_metrics', arguments: { path }, cwd: repository.root })),
  ]);
  assert.deepEqual(await doubles.server.stillRunning(), []);
});

test('Given malformed native class MI and an existing capture, when the snapshot command runs, then it names the field and preserves the capture', { timeout: 20_000 }, async (t) => {
  const repository = GitRepository.onFeatureBranch(t, repositoryFiles);
  repository.write({ 'ast-report/snapshot.json': 'previous capture\n' });
  const doubles = snapshotDoublesOnPath(t, { server: { ...serverAnswers, get_file_metrics: {
    ...fileMetricsAnswers,
    'src/auth/session.ts': { ...fileMetricsAnswers['src/auth/session.ts'], classes: [{ name: 'Session', maintainability: { maintainability_index: '84.96' } }] },
  } } });

  const result = await runScript(t, astMetricsSnapshotScript, { cwd: repository.root, env: doubles.env });

  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'ast-metrics-snapshot: Invalid class observation for src/auth/session.ts at classes[0].maintainability.maintainability_index: expected a finite number.\n');
  assert.equal(readFileSync(join(repository.root, 'ast-report/snapshot.json'), 'utf8'), 'previous capture\n');
  assert.deepEqual(await doubles.server.stillRunning(), []);
});

test('Given legacy snapshots and copies with native class observations, when architecture reads each pair, then both complete reports are identical', { timeout: 20_000 }, async (t) => {
  const enriched = { ...baseSnapshot, files: baseSnapshot.files.map((file) => ({ ...file, classObservations: [{ name: 'Native::Same', maintainabilityRaw: 0 }, { name: 'Native::Same' }] })) };

  const legacy = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, baseSnapshot, baseSnapshot), env: { PATH: '' } });
  const observed = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, enriched, enriched), env: { PATH: '' } });

  assert.equal(legacy.code, 0, legacy.stderr);
  assert.equal(observed.code, 0, observed.stderr);
  assert.notEqual(legacy.stdout, '');
  assert.equal(observed.stdout, legacy.stdout);
  assert.equal(observed.stderr, legacy.stderr);
});
