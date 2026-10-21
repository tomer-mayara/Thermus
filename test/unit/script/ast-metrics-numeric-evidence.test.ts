import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/numeric-evidence.ts', pathToFileURL(astMetricsSnapshotScript)).href;
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/numeric-evidence.ts')>;
const expected = { unit: { id: 'unit-1', kind: 'file' as const }, basis: 'a'.repeat(64), base: 'b'.repeat(40), head: 'c'.repeat(40) };
const missing = { state: 'missing', reason: 'Capture is unavailable.' };
const fragment = () => ({ unit: { ...expected.unit }, basis: expected.basis, metric: 'MI', base: { revision: expected.base, evidence: { state: 'known', raw: 96 } }, head: { revision: expected.head, evidence: { state: 'known', raw: 90 } }, acceptedBest: { ...missing } });

for (const [binding, field] of [
  [null, 'expected'], [{ ...expected, extra: true }, 'expected.extra'],
  [{ ...expected, unit: { id: ' ', kind: 'file' } }, 'expected.unit.id'],
  [{ ...expected, unit: { id: 'unit-1', kind: 'package' } }, 'expected.unit.kind'],
  [{ ...expected, basis: 'A'.repeat(64) }, 'expected.basis'],
  [{ ...expected, base: 'B'.repeat(40) }, 'expected.base'],
  [{ ...expected, head: 'short' }, 'expected.head'],
  [{ ...expected, acceptedBest: null }, 'expected.acceptedBest'],
  [{ ...expected, acceptedBest: '' }, 'expected.acceptedBest'],
] as const) {
  test(`Given invalid binding at ${field}, when numeric evidence is read, then the caller expectation is rejected`, async () => {
    const { numericEvidenceIn } = await load();
    assert.throws(() => numericEvidenceIn(fragment(), binding as Parameters<typeof numericEvidenceIn>[1]), (error: unknown) => error instanceof Error && error.message.startsWith(`Invalid numeric evidence at ${field}:`));
  });
}

for (const [input, field] of [
  [null, 'input'], [[], 'input'],
  [{ ...fragment(), phase: 'PREPARATION' }, 'input.phase'],
  [{ ...fragment(), unit: { id: 'different', kind: 'file' } }, 'input.unit'],
  [{ ...fragment(), unit: { ...expected.unit, kind: 'class' } }, 'input.unit'],
  [{ ...fragment(), basis: 'd'.repeat(64) }, 'input.basis'],
  [{ ...fragment(), metric: 'CRAP' }, 'input.metric'],
  [{ ...fragment(), base: undefined }, 'input.base'],
  [{ ...fragment(), head: { revision: expected.base, evidence: missing } }, 'input.head.revision'],
  [{ ...fragment(), acceptedBest: undefined }, 'input.acceptedBest'],
  [{ ...fragment(), acceptedBest: { revision: expected.head, evidence: missing } }, 'input.acceptedBest.revision'],
  [{ ...fragment(), head: { revision: expected.head, evidence: { state: 'missing', reason: ' ' } } }, 'input.head.evidence.reason'],
  [{ ...fragment(), head: { revision: expected.head, evidence: { ...missing, raw: 90 } } }, 'input.head.evidence.raw'],
  [{ ...fragment(), head: { revision: expected.head, evidence: { state: 'known', raw: 90, reason: 'contradiction' } } }, 'input.head.evidence.reason'],
  [{ ...fragment(), head: { revision: expected.head, evidence: { state: 'unknown' } } }, 'input.head.evidence.state'],
  [{ ...fragment(), head: { revision: expected.head, evidence: { state: 'known', raw: Infinity } } }, 'input.head.evidence.raw'],
] as const) {
  test(`Given invalid fragment data at ${field}, when read with other data available, then invalid input cannot become a gap`, async () => {
    const { numericEvidenceIn } = await load();
    assert.throws(() => numericEvidenceIn(input, expected), (error: unknown) => error instanceof Error && error.message.startsWith(`Invalid numeric evidence at ${field}:`));
  });
}

test('Given all mandatory slots as explicit gaps, when read, then the gaps remain and no operand is invented', async () => {
  const { numericEvidenceIn } = await load();
  const input = { ...fragment(), base: { revision: expected.base, evidence: missing }, head: { revision: expected.head, evidence: missing } };
  assert.deepEqual(numericEvidenceIn(input, expected), { ...input, operands: {} });
});

test('Given a selected best revision, when absent, mismatched or explicitly unmeasured, then the revision requirement remains independent of measurement availability', async () => {
  const { numericEvidenceIn } = await load();
  const binding = { ...expected, acceptedBest: 'd'.repeat(40) };
  assert.throws(() => numericEvidenceIn(fragment(), binding), /input.acceptedBest/);
  assert.throws(() => numericEvidenceIn({ ...fragment(), acceptedBest: { revision: expected.head, evidence: missing } }, binding), /input.acceptedBest.revision/);
  const input = { ...fragment(), acceptedBest: { revision: binding.acceptedBest, evidence: missing } };
  assert.deepEqual(numericEvidenceIn(input, binding).acceptedBest, input.acceptedBest);
});

for (const raw of [-Number.MAX_VALUE, 0, Number.MIN_VALUE, 84.96, Number.MAX_VALUE]) {
  test(`Given finite class MI ${raw}, when read, then raw precision is retained in every selected operand`, async () => {
    const { numericEvidenceIn } = await load();
    const binding = { ...expected, unit: { id: 'class-1', kind: 'class' as const }, acceptedBest: 'd'.repeat(40) };
    const input = { ...fragment(), unit: binding.unit, head: { revision: binding.head, evidence: { state: 'known', raw } }, acceptedBest: { revision: binding.acceptedBest, evidence: { state: 'known', raw } } };
    assert.deepEqual(numericEvidenceIn(input, binding).operands, { base: 96, head: raw, acceptedBest: raw });
  });
}

const functionBinding = { ...expected, unit: { id: 'function-1', kind: 'function' as const } };
const crapFragment = () => ({ ...fragment(), unit: functionBinding.unit, metric: 'CRAP', base: { revision: expected.base, evidence: missing }, head: { revision: expected.head, evidence: { state: 'known', paths: 3, coverage: missing } } });
for (const [evidence, field] of [
  [{ state: 'known', paths: -1, coverage: missing }, 'input.head.evidence'],
  [{ state: 'known', paths: 94906266, coverage: missing }, 'input.head.evidence'],
  [{ state: 'known', paths: 3 }, 'input.head.evidence.coverage'],
  [{ state: 'known', paths: 3, coverage: { state: 'known', share: null } }, 'input.head.evidence.coverage.share'],
  [{ state: 'known', paths: 3, coverage: { ...missing, share: 0 } }, 'input.head.evidence.coverage.share'],
  [{ state: 'known', paths: 3, coverage: missing, upper: 12 }, 'input.head.evidence.upper'],
  [{ state: 'known', paths: 3, coverage: missing, score: 12 }, 'input.head.evidence.score'],
] as const) {
  test(`Given invalid CRAP evidence at ${field}, when read, then supplied values are rejected without substituting bounds`, async () => {
    const { numericEvidenceIn } = await load();
    assert.throws(() => numericEvidenceIn({ ...crapFragment(), head: { revision: expected.head, evidence } }, functionBinding), (error: unknown) => error instanceof Error && error.message.startsWith(`Invalid numeric evidence at ${field}:`));
  });
}

test('Given a selected CRAP anchor without coverage, when paths are positive or zero, then only proven zero may supply an exact anchor operand', async () => {
  const { numericEvidenceIn } = await load();
  const binding = { ...functionBinding, acceptedBest: 'd'.repeat(40) };
  const input = { ...crapFragment(), acceptedBest: { revision: binding.acceptedBest, evidence: { state: 'known', paths: 3, coverage: missing } } };
  assert.throws(() => numericEvidenceIn(input, binding), /input.acceptedBest.evidence.coverage/);
  const zero = { ...input, acceptedBest: { ...input.acceptedBest, evidence: { ...input.acceptedBest.evidence, paths: 0 } } };
  assert.deepEqual(numericEvidenceIn(zero, binding).operands, { head: { paths: 3 }, acceptedBest: { paths: 0 } });
});

test('Given large known path operands and tiny coverage, when read, then no unused missing-share bound cap or display rounding changes the operands', async () => {
  const { numericEvidenceIn } = await load();
  const input = { ...crapFragment(), head: { revision: expected.head, evidence: { state: 'known', paths: Number.MAX_SAFE_INTEGER, coverage: { state: 'known', share: 1e-320 } } } };
  assert.deepEqual(numericEvidenceIn(input, functionBinding).operands, { head: { paths: Number.MAX_SAFE_INTEGER, share: 1e-320 } });
});

test('Given frozen input, when copied numeric evidence is returned, then the returned nested records do not alias the supplied records', async () => {
  const { numericEvidenceIn } = await load();
  const input = fragment();
  Object.freeze(input.unit); Object.freeze(input.base.evidence); Object.freeze(input.base); Object.freeze(input.head.evidence); Object.freeze(input.head); Object.freeze(input.acceptedBest); Object.freeze(input);
  const result = numericEvidenceIn(input, expected);
  assert.deepEqual(result, { ...input, operands: { base: 96, head: 90 } });
  assert.notEqual(result.unit, input.unit); assert.notEqual(result.base, input.base); assert.notEqual(result.base.evidence, input.base.evidence); assert.notEqual(result.acceptedBest, input.acceptedBest);
});


test('Given inherited mandatory fields, when numeric evidence is read, then only own fields can satisfy the fragment and binding', async () => {
  const { numericEvidenceIn } = await load();
  assert.throws(() => numericEvidenceIn(Object.create(fragment()), expected), /input.unit/);
  assert.throws(() => numericEvidenceIn(fragment(), Object.create(expected)), /expected.unit/);
  assert.throws(() => numericEvidenceIn({ ...fragment(), head: { revision: expected.head, evidence: Object.create({ state: 'known', raw: 90 }) } }, expected), /input.head.evidence.state/);
});

for (const [field, value] of [['base', expected.base + '\n'], ['head', expected.head + '\n'], ['basis', expected.basis + '\n']] as const) {
  test(`Given trailing newline in expected ${field}, when read, then the exact hash length rejects it`, async () => {
    const { numericEvidenceIn } = await load();
    assert.throws(() => numericEvidenceIn(fragment(), { ...expected, [field]: value }), (error: unknown) => error instanceof Error && error.message.startsWith(`Invalid numeric evidence at expected.${field}:`));
  });
}

test('Given known zero coverage and a selected exact CRAP reference, when copied, then zero share and tiny reference share remain distinct from missing coverage', async () => {
  const { numericEvidenceIn } = await load();
  const binding = { ...functionBinding, acceptedBest: 'd'.repeat(40) };
  const coverage = Object.freeze({ state: 'known', share: 0 });
  const head = Object.freeze({ revision: binding.head, evidence: Object.freeze({ state: 'known', paths: 5, coverage }) });
  const input = Object.freeze({ ...crapFragment(), head, acceptedBest: { revision: binding.acceptedBest, evidence: { state: 'known', paths: 5, coverage: { state: 'known', share: 1e-320 } } } });
  const result = numericEvidenceIn(input, binding);
  assert.ok(result.metric === 'CRAP');
  assert.deepEqual(result.operands, { head: { paths: 5, share: 0 }, acceptedBest: { paths: 5, share: 1e-320 } });
  assert.ok(result.head.evidence.state === 'known');
  assert.deepEqual(result.head.evidence.coverage, coverage);
  assert.notEqual(result.head.evidence.coverage, coverage);
});
