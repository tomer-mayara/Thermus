import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
import { test } from 'node:test';
import { coverageReport } from './fixtures/ast-metrics-architecture-repository-goldens.ts';
import { processFixture, recordsIn } from './fixtures/ast-metrics-process.ts';
import { verifiedCoverageFor } from './fixtures/ast-metrics-verified-coverage.ts';

test('Given compatible coverage from an older capture commit, when only prose changes, then the process reuses its coverage and records labeled estimates', { timeout: 20_000 }, async (t) => {
  const { repository, doubles, run } = processFixture(t);
  repository.write({ 'ast-report/coverage.json': JSON.stringify(verifiedCoverageFor(repository, coverageReport)) });
  repository.commit('Change prose', { 'README.md': '# Revised prose\n' });

  const result = await run();

  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Reused verified compatible unit coverage\./);
  assert.match(result.stdout, /Historical estimates use head coverage/);
  assert.equal((recordsIn(repository)[0].crap as { kind: string }).kind, 'head-derived-estimate');
  assert.equal(doubles.cli.calls().filter(({ argv }) => argv[0] === 'mcp').length, 2);
});

for (const mode of ['missing', 'stale', 'skip'] as const) {
  test(`Given required source changes and ${mode} coverage, when the process runs, then CRAP remains unavailable, structure renders, and history stays empty`, { timeout: 20_000 }, async (t) => {
    const { repository, doubles, run } = processFixture(t);
    if (mode !== 'missing') repository.write({ 'ast-report/coverage.json': JSON.stringify(verifiedCoverageFor(repository, coverageReport)) });
    repository.write({ 'src/auth/session.ts': 'export const value = 2;\n' });

    const result = await run(mode === 'skip' ? ['--skip-coverage'] : []);

    assert.equal(result.code, 1, result.stderr);
    assert.match(result.stdout, /## CRAP\n\nStatus: unavailable\./);
    assert.match(result.stdout, /Required CRAP goals are unresolved/);
    assert.match(result.stdout, /```mermaid/);
    assert.doesNotMatch(result.stdout, /classDef (good|warning|critical)/);
    assert.equal(recordsIn(repository).length, 0);
    assert.equal(doubles.cli.calls().filter(({ argv }) => argv[0] === 'mcp').length, 2);
    if (mode === 'stale') assert.match(result.stdout, /another tree/);
    if (mode === 'skip') assert.match(result.stdout, /Coverage was skipped with --skip-coverage/);
  });
}

test('Given a malformed available report, when skip is explicit, then the process ignores the report and records a document-only structural result', { timeout: 20_000 }, async (t) => {
  const { repository, run } = processFixture(t);
  repository.write({ 'ast-report/coverage.json': 'malformed' });
  const result = await run(['--skip-coverage']);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(recordsIn(repository).length, 1);
});

test('Given explicit report and output paths from a nested caller, when the process runs, then both paths resolve from that caller and defaults stay at root', { timeout: 20_000 }, async (t) => {
  const { repository, run } = processFixture(t);
  repository.write({ 'ast-report/custom.json': JSON.stringify(verifiedCoverageFor(repository, coverageReport)) });
  mkdirSync(join(repository.root, 'nested'));
  const result = await run(['--coverage', '../ast-report/custom.json', '--out', 'result.md'], join(repository.root, 'nested'));
  assert.equal(result.code, 0, result.stderr);
  assert.equal(readFileSync(join(repository.root, 'nested/result.md'), 'utf8'), result.stdout);
  assert.match(result.stdout, /Reused verified compatible unit coverage/);
});

const { coverageOriginOf } = await import(new URL('provenance/captures.ts', pathToFileURL(astMetricsCoverageScript)).href) as typeof import('../../../script/code-quality/provenance/captures.ts');
const { inputIdentityIn } = await import(new URL('provenance/read.ts', pathToFileURL(astMetricsCoverageScript)).href) as typeof import('../../../script/code-quality/provenance/read.ts');

test('Given compatible selected-suite coverage and forbidden suite commands, when the default process runs, then it reuses every capture identity without launching a suite', { timeout: 20_000 }, async (t) => {
  const { repository, run } = processFixture(t);
  repository.write({ 'package.json': JSON.stringify({ scripts: { build: 'exit 9', 'test:unit': 'exit 9', 'test:acceptance': 'exit 9', 'test:integration': 'exit 9' } }) });
  const original = verifiedCoverageFor(repository, coverageReport);
  const identity = inputIdentityIn(original.provenance);
  assert.ok(identity !== undefined);
  const unit = { ...identity, status: 'verified', capturedCommit: original.commit, buildFingerprint: 'd'.repeat(64), captureManifestFingerprint: 'e'.repeat(64), comparisonIdentity: identity } as const;
  const acceptance = { ...unit, suite: 'acceptance', inputsFingerprint: 'f'.repeat(64), captureManifestFingerprint: '9'.repeat(64) } as const;
  const provenance = coverageOriginOf([unit, acceptance], identity);
  repository.write({ 'ast-report/coverage.json': JSON.stringify({ ...original, suite: provenance.suite, provenance }) });
  const result = await run();
  assert.equal(result.code, 0, result.stderr);
  assert.match(result.stdout, /Reused verified compatible unit \+ acceptance coverage/);
  assert.match(result.stdout, /Coverage: unit \+ acceptance suites at/);
  const record = recordsIn(repository)[0];
  assert.deepEqual((record.crap as { captureProvenance: unknown }).captureProvenance, provenance);
});
