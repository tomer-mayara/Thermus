import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { dataDirectory } from '../../support/isolation/data-directory.ts';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';
import { runScript } from '../../support/processes/script-command.ts';
import { offlineProvenanceMarkdown } from './fixtures/ast-metrics-provenance-goldens.ts';
import { baseSnapshot, snapshotArguments } from './fixtures/ast-metrics-architecture-snapshots.ts';

const identity = { sourceFingerprint: 'a'.repeat(64), inputsFingerprint: 'b'.repeat(64), runtime: 'node:test', compiler: 'typescript:test', measurementVersion: 'own-characters-1', suite: 'unit' };
const capture = '1234567890abcdef1234567890abcdef12345678';
const verified = { ...identity, status: 'verified', capturedCommit: capture, buildFingerprint: 'c'.repeat(64), captureManifestFingerprint: 'd'.repeat(64) };
const report = { version: 2, commit: capture, suite: 'unit', measurementVersion: 'own-characters-1', provenance: verified, files: [] };

function argumentsWith(t: TestContext, coverage: object, head: object = { ...baseSnapshot, provenance: identity }): string[] {
  const path = join(dataDirectory(t), 'coverage.json');
  writeFileSync(path, JSON.stringify(coverage));
  return [...snapshotArguments(t, baseSnapshot, head as typeof baseSnapshot), '--coverage', path];
}

for (const version of [1, 2]) {
test(`Given version ${version} coverage with matching provenance from an older capture commit, when architecture renders offline without Git, then it names the original commit after complexity`, async (t) => {
  const result = await runScript(t, astMetricsArchitectureScript, { args: argumentsWith(t, { ...report, version }), env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, offlineProvenanceMarkdown({ commit: capture }));
});
}

test('Given coverage that does not match the supplied offline head, when architecture renders, then it withholds bands and gives the stale notice in stderr and after the summary', async (t) => {
  const head = { ...baseSnapshot, provenance: { ...identity, sourceFingerprint: 'f'.repeat(64) } };
  const result = await runScript(t, astMetricsArchitectureScript, { args: argumentsWith(t, report, head), env: { PATH: '' } });
  const notice = 'The coverage report is of another tree (12345678): the bands are withheld. Run the coverage command again when the test selection permits it.';
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, `ast-metrics-architecture: ${notice}\n`);
  assert.equal(result.stdout, offlineProvenanceMarkdown({ notice }));
  assert.ok(result.stdout.includes(notice));
  assert.ok(!result.stdout.includes('functions ≥ 30:'));
  assert.ok(result.stdout.includes('```mermaid'));
});

for (const [name, coverage, head, notice] of [
  ['legacy coverage', { ...report, version: 1, measurementVersion: undefined, provenance: undefined }, { ...baseSnapshot, provenance: identity }, 'The coverage report has no verified provenance: the bands are withheld.'],
  ['legacy head', report, baseSnapshot, 'The head snapshot has no verified provenance: the bands are withheld.'],
  ['unverified coverage', { ...report, commit: null, provenance: { status: 'unverified', reason: 'No original manifest.' } }, { ...baseSnapshot, provenance: identity }, 'The coverage report has no verified provenance: the bands are withheld.'],
] as const) {
  test(`Given ${name}, when architecture renders offline, then structure succeeds with its distinct diagnostic`, async (t) => {
    const result = await runScript(t, astMetricsArchitectureScript, { args: argumentsWith(t, coverage, head), env: { PATH: '' } });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stderr, `ast-metrics-architecture: ${notice}\n`);
    assert.equal(result.stdout, offlineProvenanceMarkdown({ notice }));
    assert.ok(!result.stdout.includes('functions ≥ 30:'));
  });
}

test('Given --no-coverage and an explicit coverage path, when the command parses options, then it rejects their conflict before reading files', async (t) => {
  const result = await runScript(t, astMetricsArchitectureScript, { args: ['--no-coverage', '--coverage', 'missing'], env: { PATH: '' } });
  assert.equal(result.code, 1);
  assert.equal(result.stderr, 'ast-metrics-architecture: Give --coverage or --no-coverage, not both.\n');
});

for (const [name, changes] of [
  ['another suite', { suite: 'acceptance' }],
  ['another measurement version', { measurementVersion: 'legacy' }],
  ['a malformed provenance fingerprint', { provenance: { ...verified, inputsFingerprint: 'invalid' } }],
  ['a relabeled capture commit', { commit: 'f'.repeat(40) }],
] as const) {
  test(`Given coverage with ${name}, when architecture renders offline, then it withholds every assessment and preserves structural output`, async (t) => {
    const result = await runScript(t, astMetricsArchitectureScript, { args: argumentsWith(t, { ...report, ...changes }), env: { PATH: '' } });
    assert.equal(result.code, 0, result.stderr);
    assert.ok(!result.stdout.includes('functions ≥ 30:'));
    assert.ok(!result.stdout.includes('CRAP ≥ 30 |'));
    assert.ok(!result.stdout.includes('### Functions at CRAP'));
    assert.ok(result.stdout.includes('```mermaid'));
    assert.match(result.stderr, /the bands are withheld/);
  });
}

test('Given offline snapshots and no coverage file, when architecture renders, then it names missing data without asking for a broader suite', async (t) => {
  const result = await runScript(t, astMetricsArchitectureScript, { args: snapshotArguments(t, baseSnapshot, baseSnapshot), env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.equal(result.stdout, offlineProvenanceMarkdown({ notice: 'No coverage report: the bands are withheld. Run the coverage command when the test selection permits it.' }));
});

test('Given explicit skip with offline snapshots, when architecture renders, then its distinct notice explains the absent bands', async (t) => {
  const result = await runScript(t, astMetricsArchitectureScript, { args: [...snapshotArguments(t, baseSnapshot, baseSnapshot), '--no-coverage'], env: { PATH: '' } });
  assert.equal(result.code, 0, result.stderr);
  assert.equal(result.stdout, offlineProvenanceMarkdown({ notice: 'Coverage was skipped with --no-coverage: the bands are withheld.' }));
  assert.equal(result.stderr, 'ast-metrics-architecture: Coverage was skipped with --no-coverage: the bands are withheld.\n');
});
