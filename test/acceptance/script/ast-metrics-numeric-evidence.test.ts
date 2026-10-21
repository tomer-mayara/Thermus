import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const root = pathToFileURL(astMetricsSnapshotScript);
const load = () => import(new URL('assessment/numeric-evidence.ts', root).href) as Promise<typeof import('../../../script/code-quality/assessment/numeric-evidence.ts')>;
const expected = { unit: { id: 'unit-1', kind: 'file' as const }, basis: 'a'.repeat(64), base: 'b'.repeat(40), head: 'c'.repeat(40) };
const missing = { state: 'missing', reason: 'Independent capture is unavailable.' };

test('Given raw head MI and an explicit base measurement gap, when numeric evidence is read, then its binding and gap survive while only known operands reach calculation', async () => {
  const { numericEvidenceIn } = await load();
  const input = { unit: expected.unit, basis: expected.basis, metric: 'MI', base: { revision: expected.base, evidence: missing }, head: { revision: expected.head, evidence: { state: 'known', raw: 84.96 } }, acceptedBest: { state: 'missing', reason: 'The selected history reference is unavailable.' } };
  const result = numericEvidenceIn(input, expected);
  assert.ok(result.metric === 'MI');
  assert.deepEqual(result, { ...input, operands: { head: 84.96 } });
  const { miAssessmentOf } = await import(new URL('assessment/mi-assessment.ts', root).href) as typeof import('../../../script/code-quality/assessment/mi-assessment.ts');
  assert.equal(miAssessmentOf(result.operands).mi85.state, 'LOW');
  assert.equal(miAssessmentOf(result.operands).prDecline.state, 'UNKNOWN');
});

test('Given known CRAP paths with missing coverage and a separate history gap, when read and calculated, then bounds can settle an absolute goal without creating a score or anchor', async () => {
  const { numericEvidenceIn } = await load();
  const binding = { ...expected, unit: { id: 'function-1', kind: 'function' as const } };
  const input = { unit: binding.unit, basis: binding.basis, metric: 'CRAP', base: { revision: binding.base, evidence: missing }, head: { revision: binding.head, evidence: { state: 'known', paths: 3, coverage: missing } }, acceptedBest: { state: 'missing', reason: 'History has an unresolved gap.' } };
  const result = numericEvidenceIn(input, binding);
  assert.ok(result.metric === 'CRAP');
  assert.deepEqual(result, { ...input, operands: { head: { paths: 3 } } });
  const { crapAssessmentOf } = await import(new URL('assessment/crap-assessment.ts', root).href) as typeof import('../../../script/code-quality/assessment/crap-assessment.ts');
  const assessment = crapAssessmentOf(result.operands);
  assert.equal(assessment.atMost15.state, 'PASS');
  assert.equal(assessment.cumulativeDecline.state, 'UNKNOWN');
});

test('Given selected best revision with unavailable MI, when read, then that revision remains bound and the measurement gap stays explicit', async () => {
  const { numericEvidenceIn } = await load();
  const binding = { ...expected, acceptedBest: 'd'.repeat(40) };
  const input = { unit: binding.unit, basis: binding.basis, metric: 'MI', base: { revision: binding.base, evidence: missing }, head: { revision: binding.head, evidence: { state: 'known', raw: 90 } }, acceptedBest: { revision: binding.acceptedBest, evidence: missing } };
  assert.deepEqual(numericEvidenceIn(input, binding), { ...input, operands: { head: 90 } });
});

test('Given an unrelated history gap and corrupt supplied head evidence, when read, then invalid evidence is rejected rather than converted into another gap', async () => {
  const { numericEvidenceIn } = await load();
  const input = { unit: expected.unit, basis: expected.basis, metric: 'MI', base: { revision: expected.base, evidence: missing }, head: { revision: expected.head, evidence: { state: 'known', raw: null } }, acceptedBest: missing };
  assert.throws(() => numericEvidenceIn(input, expected), { message: 'Invalid numeric evidence at input.head.evidence.raw: expected a finite number.' });
});
