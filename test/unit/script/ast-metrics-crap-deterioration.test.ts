import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';

const root = pathToFileURL(astMetricsCrapScript);
const moduleUrl = new URL('assessment/crap-deterioration.ts', root).href;
const scoreUrl = new URL('architecture/crap-score.ts', root).href;
type Input = Parameters<typeof import('../../../script/code-quality/assessment/crap-deterioration.ts').crapDeteriorationOf>[0];
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/crap-deterioration.ts')>;
const loadScores = () => import(scoreUrl) as Promise<typeof import('../../../script/code-quality/architecture/crap-score.ts')>;

for (const [head, reference, threshold, comparison] of [
  [15, 10, 5, 0], [14, 10, 5, -1], [16, 10, 5, 1], [10, 10, 0, 0],
  [{ paths: 5, share: 1e-320 }, 25, 5, -1], [30, { paths: 5, share: 1e-320 }, 0, 1],
  [{ paths: 5, share: 1e-320 }, 30, 0, -1],
  [{ paths: 15, share: 1 }, { paths: 10, share: 1 }, 5, 0],
  [{ paths: Number.MAX_SAFE_INTEGER, share: 0 }, { paths: Number.MAX_SAFE_INTEGER, share: 0 }, 0, 0],
  [Number.MAX_SAFE_INTEGER, { paths: Number.MAX_SAFE_INTEGER, share: 1 }, 0, 0],
  [{ paths: Number.MAX_SAFE_INTEGER, share: 0 }, Number.MAX_SAFE_INTEGER, 5, 1],
] as const) {
  test(`Given exact score operands ${JSON.stringify(head)} and ${JSON.stringify(reference)}, when their difference is compared with ${threshold}, then the exact sign is ${comparison}`, async () => {
    const { compareCrapDifference } = await loadScores();
    assert.equal(typeof compareCrapDifference, 'function');
    assert.equal(compareCrapDifference(head, reference, threshold), comparison);
  });
}

for (const [reference, head, belowFive, noDeterioration] of [
  [{ paths: 10, share: 1 }, { paths: 15, share: 1 }, 'MISS', 'MISS'],
  [{ paths: 10, share: 1 }, { paths: 14, share: 1 }, 'PASS', 'MISS'],
  [{ paths: 10, share: 1 }, { paths: 10, share: 1 }, 'PASS', 'PASS'],
  [{ paths: 10, share: 1 }, { paths: 9, share: 1 }, 'PASS', 'PASS'],
  [{ paths: 3 }, { paths: 3 }, 'UNKNOWN', 'UNKNOWN'],
  [{ paths: 6, share: 0 }, { paths: 6 }, 'PASS', 'PASS'],
  [{ paths: 1 }, { paths: 7, share: 1 }, 'MISS', 'MISS'],
  [{ paths: 1, share: 1 }, { paths: 2 }, 'UNKNOWN', 'MISS'],
  [{ paths: 7, share: 0.9999999 }, { paths: 3 }, 'PASS', 'UNKNOWN'],
  [{ paths: 10, share: 1 }, { paths: 1 }, 'PASS', 'PASS'],
  [{ paths: 3 }, { paths: 4, share: 1 }, 'PASS', 'UNKNOWN'],
  [{ paths: 3, share: 1 }, { paths: 3 }, 'UNKNOWN', 'UNKNOWN'],
  [{ paths: 0 }, { paths: 0 }, 'PASS', 'PASS'],
  [{ paths: 0 }, { paths: 5, share: 1 }, 'MISS', 'MISS'],
  [{ paths: 0, share: 0 }, { paths: 0 }, 'PASS', 'PASS'],
  [{ paths: 5, share: 1e-320 }, { paths: 5, share: 0 }, 'PASS', 'MISS'],
  [{ paths: 5, share: 0 }, { paths: 5, share: 1e-320 }, 'PASS', 'PASS'],
] as const) {
  test(`Given reference ${JSON.stringify(reference)} and head ${JSON.stringify(head)}, when deterioration is assessed, then both independent endpoint proofs are retained`, async () => {
    const { crapDeteriorationOf } = await load();
    const result = crapDeteriorationOf({ reference, head });
    assert.equal(result.belowFive.state, belowFive);
    assert.equal(result.noDeterioration.state, noDeterioration);
    assert.ok(result.belowFive.reason.length > 0);
    assert.ok(result.noDeterioration.reason.length > 0);
  });
}

for (const input of [undefined, null, [], 1, 'input', true]) {
  test(`Given invalid shape ${JSON.stringify(input)}, when assessed, then the root input is rejected`, async () => {
    const { crapDeteriorationOf } = await load();
    assert.throws(() => crapDeteriorationOf(input as unknown as Input), { message: 'Invalid CRAP deterioration input at input: expected an object.' });
  });
}

for (const field of ['reference', 'head'] as const) {
  for (const [value, diagnostic] of [
    [null, 'input: expected an object.'], [[], 'input: expected an object.'], [3, 'input: expected an object.'],
    [{}, 'paths: expected a nonnegative safe integer.'], [{ paths: -1 }, 'paths: expected a nonnegative safe integer.'],
    [{ paths: Infinity }, 'paths: expected a nonnegative safe integer.'],
    [{ paths: 0, share: null }, 'share: expected a finite number from 0 to 1.'],
    [{ paths: 0, share: 2 }, 'share: expected a finite number from 0 to 1.'],
    [{ paths: 94906266 }, 'paths: expected a safe integer upper CRAP bound when coverage is missing.'],
  ] as const) {
    test(`Given invalid ${field} ${JSON.stringify(value)} and an absent other side, when assessed, then the supplied side fails with context`, async () => {
      const { crapDeteriorationOf } = await load();
      assert.throws(() => crapDeteriorationOf({ [field]: value } as Input), { message: `Invalid CRAP deterioration input at ${field}: Invalid absolute CRAP input at ${diagnostic}` });
    });
  }
}

test('Given a valid reference and malformed head, when assessed, then validation does not treat the malformed side as missing', async () => {
  const { crapDeteriorationOf } = await load();
  assert.throws(() => crapDeteriorationOf({ reference: { paths: 0 }, head: { paths: 1, share: NaN } }), { message: 'Invalid CRAP deterioration input at head: Invalid absolute CRAP input at share: expected a finite number from 0 to 1.' });
});

test('Given missing sides, when assessed, then observations omit missing operands and each proof is unknown for a specific reason', async () => {
  const { crapDeteriorationOf } = await load();
  for (const [input, observation, reason] of [
    [{}, {}, 'Reference and head CRAP operands are missing.'],
    [{ reference: undefined, head: undefined }, {}, 'Reference and head CRAP operands are missing.'],
    [{ reference: { paths: 0 } }, { reference: { kind: 'proven-zero', paths: 0, value: 0 } }, 'Head CRAP operands are missing.'],
    [{ head: { paths: 0 } }, { head: { kind: 'proven-zero', paths: 0, value: 0 } }, 'Reference CRAP operands are missing.'],
  ] as const) assert.deepEqual(crapDeteriorationOf(input), { observation, belowFive: { state: 'UNKNOWN', reason }, noDeterioration: { state: 'UNKNOWN', reason } });
});

test('Given the largest safe missing bound and large known operands, when assessed, then existing operand limits are preserved without an unused bound cap', async () => {
  const { crapDeteriorationOf } = await load();
  const bounded = crapDeteriorationOf({ reference: { paths: 94906265 }, head: { paths: 0 } });
  assert.deepEqual(bounded.observation.reference, { kind: 'missing-coverage', paths: 94906265, lower: 94906265, upper: 9007199231156490 });
  assert.equal(bounded.belowFive.state, 'PASS');
  assert.equal(bounded.noDeterioration.state, 'PASS');
  const large = crapDeteriorationOf({ reference: { paths: Number.MAX_SAFE_INTEGER, share: 0 }, head: { paths: Number.MAX_SAFE_INTEGER, share: 0 } });
  assert.equal(large.belowFive.state, 'PASS');
  assert.equal(large.noDeterioration.state, 'PASS');
});

test('Given frozen operands, when assessed, then supplied data stays unchanged and no numeric difference or invented share is returned', async () => {
  const { crapDeteriorationOf } = await load();
  const input = Object.freeze({ reference: Object.freeze({ paths: 6, share: 0 }), head: Object.freeze({ paths: 6 }) });
  const result = crapDeteriorationOf(input);
  assert.deepEqual(input, { reference: { paths: 6, share: 0 }, head: { paths: 6 } });
  assert.deepEqual(Object.keys(result).sort(), ['belowFive', 'noDeterioration', 'observation']);
  assert.deepEqual(result.observation.head, { kind: 'missing-coverage', paths: 6, lower: 6, upper: 42 });
});
