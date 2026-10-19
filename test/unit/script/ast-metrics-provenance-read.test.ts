import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
const { coverageProvenanceIn, inputIdentityIn } = await import(new URL('provenance/read.ts', pathToFileURL(astMetricsCoverageScript)).href) as typeof import('../../../script/code-quality/provenance/read.ts');

const identity = { sourceFingerprint: 'a'.repeat(64), inputsFingerprint: 'b'.repeat(64), runtime: 'node-24.20.0', compiler: 'typescript-7.0.2', measurementVersion: 'own-characters-1', suite: 'unit' };
const provenance = { ...identity, status: 'verified', capturedCommit: 'c'.repeat(40), buildFingerprint: 'd'.repeat(64), captureManifestFingerprint: 'e'.repeat(64) };
test('Given the implemented provenance contract, when read, then every verified identity is retained', () => {
  assert.deepEqual(inputIdentityIn(identity), identity);
  assert.deepEqual(coverageProvenanceIn(provenance), provenance);
});
for (const changed of [{ suite: 'integration' }, { measurementVersion: 'legacy' }, { capturedCommit: 'bad' }, { inputsFingerprint: 'bad' }, { buildFingerprint: null }, { captureManifestFingerprint: 1 }, { runtime: '' }, { compiler: null }]) {
  test(`Given malformed provenance ${JSON.stringify(changed)}, when read, then it cannot become verified`, () => {
    assert.equal(coverageProvenanceIn({ ...provenance, ...changed }), undefined);
  });
}
test('Given explicit unverified inspection, when read, then the reason and original data are retained', () => {
  const unverified = { status: 'unverified', reason: 'The manifest is missing.', original: { commit: 'legacy' } };
  assert.deepEqual(coverageProvenanceIn(unverified), unverified);
  assert.equal(coverageProvenanceIn({ status: 'unverified', reason: '' }), undefined);
  assert.equal(coverageProvenanceIn(undefined), undefined);
});
