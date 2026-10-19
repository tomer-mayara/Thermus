import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCoverageScript } from '../../support/processes/module-paths.ts';
const { coverageProvenanceIn, inputIdentityIn } = await import(new URL('provenance/read.ts', pathToFileURL(astMetricsCoverageScript)).href) as typeof import('../../../script/code-quality/provenance/read.ts');

const identity = { sourceFingerprint: 'a'.repeat(64), inputsFingerprint: 'b'.repeat(64), runtime: 'node-24.20.0', compiler: 'typescript-7.0.2', measurementVersion: 'own-characters-1', suite: 'unit' } as const;
const provenance = { ...identity, status: 'verified', capturedCommit: 'c'.repeat(40), buildFingerprint: 'd'.repeat(64), captureManifestFingerprint: 'e'.repeat(64) };
test('Given the implemented provenance contract, when read, then every verified identity is retained', () => {
  assert.deepEqual(inputIdentityIn(identity), identity);
  assert.deepEqual(coverageProvenanceIn(provenance), provenance);
});
for (const changed of [{ suite: 'invalid' }, { measurementVersion: 'legacy' }, { capturedCommit: 'bad' }, { inputsFingerprint: 'bad' }, { buildFingerprint: null }, { captureManifestFingerprint: 1 }, { runtime: '' }, { compiler: null }]) {
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

const { coverageOriginOf } = await import(new URL('provenance/captures.ts', pathToFileURL(astMetricsCoverageScript)).href) as typeof import('../../../script/code-quality/provenance/captures.ts');
const comparisonIdentity = { ...identity, suite: 'unit' } as const;
const unit = { ...provenance, ...comparisonIdentity, status: 'verified', comparisonIdentity } as const;
const acceptance = { ...unit, suite: 'acceptance', inputsFingerprint: 'f'.repeat(64), captureManifestFingerprint: '9'.repeat(64) } as const;
const combined = coverageOriginOf([unit, acceptance], comparisonIdentity);

test('Given verified unit and acceptance capture identities, when read, then the exact selected order and true fingerprints remain', () => {
  assert.deepEqual(coverageProvenanceIn(combined), combined);
  assert.deepEqual(combined.suite, ['unit', 'acceptance']);
  assert.notEqual(combined.captures?.[0].inputsFingerprint, combined.captures?.[1].inputsFingerprint);
});
for (const [index, changed] of [
  { ...unit, captures: [acceptance] },
  { captures: [{ ...unit, inputsFingerprint: '9'.repeat(64) }, acceptance] },
  { suite: ['acceptance', 'unit'] }, { suite: ['unit', 'unit'] }, { captures: [unit] }, { captures: [] },
  { captures: [unit, { ...acceptance, capturedCommit: 'f'.repeat(40) }] },
  { captures: [unit, { ...acceptance, buildFingerprint: 'f'.repeat(64) }] },
  { captures: [unit, { ...acceptance, sourceFingerprint: 'f'.repeat(64) }] },
  { captures: [unit, { ...acceptance, runtime: 'node-other' }] },
  { captures: [unit, { ...acceptance, compiler: 'compiler-other' }] },
  { captures: [unit, { ...acceptance, measurementVersion: 'legacy' }] },
  { captures: [unit, { ...acceptance, comparisonIdentity: { ...comparisonIdentity, inputsFingerprint: 'f'.repeat(64) } }] },
  { comparisonIdentity: undefined }, { comparisonIdentity: { ...comparisonIdentity, inputsFingerprint: 'f'.repeat(64) } },
].entries()) {
  test(`Given mismatched selected capture evidence ${index + 1}, when read, then it cannot become verified`, () => {
    assert.equal(coverageProvenanceIn({ ...combined, ...changed }), undefined);
  });
}
test('Given only acceptance capture evidence, when combined and read, then it truthfully names only acceptance', () => {
  const only = coverageOriginOf([acceptance], comparisonIdentity);
  assert.deepEqual(only.suite, ['acceptance']);
  assert.deepEqual(coverageProvenanceIn(only), only);
});
