import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

import type { CoverageReport } from '../../../script/code-quality/architecture/coverage.ts';
import type { InputIdentity } from '../../../script/code-quality/provenance/types.ts';

const { coverageForHead } = await import(new URL('architecture/coverage-compatibility.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/architecture/coverage-compatibility.ts');

const identity: InputIdentity = { sourceFingerprint: 'a'.repeat(64), inputsFingerprint: 'b'.repeat(64), runtime: 'node:test', compiler: 'typescript:test', measurementVersion: 'own-characters-1', suite: 'unit' };
const capture = '1234567890abcdef1234567890abcdef12345678';
const report: CoverageReport = { commit: capture, suite: 'unit', measurementVersion: 'own-characters-1', provenance: { ...identity, status: 'verified', capturedCommit: capture, buildFingerprint: 'c'.repeat(64), captureManifestFingerprint: 'd'.repeat(64) }, files: [] };

test('Given verified coverage from an older commit with the same inputs, when matched to a snapshot identity, then all coverage metadata stays available', () => {
  assert.equal(coverageForHead(report, identity).coverage, report);
});

for (const key of ['sourceFingerprint', 'inputsFingerprint', 'runtime', 'compiler'] as const) {
  test(`Given a different ${key}, when coverage is matched, then the result withholds it`, () => {
    const result = coverageForHead(report, { ...identity, [key]: 'different' });
    assert.equal(result.coverage, undefined);
    assert.match(result.coverageNotice ?? '', /another tree \(12345678\)/);
  });
}

for (const changes of [{ suite: 'acceptance' }, { measurementVersion: 'old' }, { commit: 'f'.repeat(40) }] as const) {
  test(`Given invalid report metadata ${JSON.stringify(changes)}, when coverage is matched, then the result withholds it`, () => {
    assert.equal(coverageForHead({ ...report, ...changes }, identity).coverage, undefined);
  });
}

const { coverageOriginOf } = await import(new URL('provenance/captures.ts', pathToFileURL(astMetricsArchitectureScript)).href) as typeof import('../../../script/code-quality/provenance/captures.ts');
const unit = { ...identity, status: 'verified', capturedCommit: capture, buildFingerprint: 'c'.repeat(64), captureManifestFingerprint: 'd'.repeat(64), comparisonIdentity: identity } as const;
const acceptance = { ...unit, suite: 'acceptance', inputsFingerprint: 'e'.repeat(64), captureManifestFingerprint: 'f'.repeat(64) } as const;
for (const captures of [[acceptance], [unit, acceptance]]) {
  test(`Given selected ${captures.map(({ suite }) => suite).join(' and ')} captures from this input tree, when compared with the unit snapshot identity, then the true suite set is compatible`, () => {
    const provenance = coverageOriginOf(captures, identity);
    const combined = { ...report, suite: provenance.suite, provenance };
    assert.equal(coverageForHead(combined, identity).coverage, combined);
    assert.equal(coverageForHead(combined, { ...identity, inputsFingerprint: '9'.repeat(64) }).coverage, undefined);
  });
}
