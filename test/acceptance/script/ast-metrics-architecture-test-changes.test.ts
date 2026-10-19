import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { coverageForChanges, changesRepository, functionSource, oldPath } from './fixtures/ast-metrics-repository-changes-harness.ts';
import { coveredTestChanges, sourceAndTestChanges, sourceAndTypeScriptTestChanges, testChangeSection, unavailableTestChanges } from './fixtures/ast-metrics-test-change-goldens.ts';
import { bandedBase, coverageArguments } from './fixtures/ast-metrics-architecture-coverage.ts';
import { snapshotArguments } from './fixtures/ast-metrics-architecture-snapshots.ts';

for (const [name, files, covered, golden] of [
  ['only a test', { 'test/unit/work.test.ts': 'export const tested = true;\n' }, true, coveredTestChanges],
  ['only a JSON fixture', { 'test/support/fixtures/work.json': '{"value":2}\n' }, true, coveredTestChanges],
  ['a source asset and a fixture', { 'src/core/template.html': '<p>Changed</p>\n', 'test/support/fixtures/work.json': '{}\n' }, true, sourceAndTestChanges],
  ['TypeScript source and a test', { [oldPath]: `${functionSource}\n`, 'test/unit/work.test.ts': 'export const tested = true;\n' }, true, sourceAndTypeScriptTestChanges],
  ['a fixture without coverage', { 'test/support/fixtures/work.csv': 'value\n2\n' }, false, unavailableTestChanges],
] as const) {
  test(`Given changes to ${name}, when architecture compares the repository, then the complexity section explains the available test comparison`, { timeout: 20_000 }, async (t) => {
    const { repository, doubles } = changesRepository(t);
    repository.write(files);
    if (covered) repository.write({ 'ast-report/coverage.json': JSON.stringify(coverageForChanges(repository)) });

    const result = await runScript(t, astMetricsArchitectureScript, { args: ['--base', 'main'], cwd: repository.root, env: doubles.env });

    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, '');
    assert.equal(testChangeSection(result.stdout), golden);
  });
}

test('Given offline snapshots and a declared fixture change, when architecture runs without tools, then it prints the head-coverage warning below complexity', async (t) => {
  const result = await runScript(t, astMetricsArchitectureScript, {
    args: [...snapshotArguments(t, bandedBase, bandedBase), ...coverageArguments(t), '--touched', 'test/fixtures/example.txt'], env: { PATH: '' },
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(testChangeSection(result.stdout), coveredTestChanges);
});

test('Given offline snapshots without declared changes, when architecture runs in a checkout with changed tests, then it makes no test-change claim', async (t) => {
  const result = await runScript(t, astMetricsArchitectureScript, {
    args: snapshotArguments(t, bandedBase, bandedBase), env: { PATH: '' },
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(testChangeSection(result.stdout), sourceAndTestChanges);
});

test('Given a declared fixture change and skipped coverage, when architecture runs offline, then it says no coverage comparison was made', async (t) => {
  const result = await runScript(t, astMetricsArchitectureScript, {
    args: [...snapshotArguments(t, bandedBase, bandedBase), '--touched', 'test/fixtures/example.txt', '--no-coverage'], env: { PATH: '' },
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, 'ast-metrics-architecture: Coverage was skipped with --no-coverage: the bands are withheld.\n');
  assert.equal(testChangeSection(result.stdout), unavailableTestChanges);
});

test('Given offline source-change evidence and a touched fixture, when architecture runs without tools, then the touched override cannot claim test-only changes', async (t) => {
  const changes = join(dataDirectory(t), 'changes.json');
  const identity = { commit: bandedBase.commit, sourceFingerprint: bandedBase.provenance?.sourceFingerprint };
  writeFileSync(changes, JSON.stringify({ version: 1, base: identity, head: identity, files: [{ status: 'M', path: 'src/application.ts' }] }));
  const result = await runScript(t, astMetricsArchitectureScript, {
    args: [...snapshotArguments(t, bandedBase, bandedBase), ...coverageArguments(t), '--changes', changes, '--touched', 'test/fixtures/example.txt'], env: { PATH: '' },
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(testChangeSection(result.stdout), sourceAndTestChanges);
});

test('Given offline snapshots with different source fingerprints and a touched fixture, when architecture runs without tools, then it cannot claim test-only changes', async (t) => {
  assert.ok(bandedBase.provenance);
  const base = { ...bandedBase, provenance: { ...bandedBase.provenance, sourceFingerprint: 'c'.repeat(64) } };
  const result = await runScript(t, astMetricsArchitectureScript, {
    args: [...snapshotArguments(t, base, bandedBase), ...coverageArguments(t), '--touched', 'test/fixtures/example.txt'], env: { PATH: '' },
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(testChangeSection(result.stdout), sourceAndTestChanges);
});

test('Given an offline base snapshot with missing provenance and a touched fixture, when architecture runs without tools, then it cannot claim test-only changes', async (t) => {
  const base = { ...bandedBase, provenance: undefined };
  const result = await runScript(t, astMetricsArchitectureScript, {
    args: [...snapshotArguments(t, base, bandedBase), ...coverageArguments(t), '--touched', 'test/fixtures/example.txt'], env: { PATH: '' },
  });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(testChangeSection(result.stdout), sourceAndTestChanges);
});
