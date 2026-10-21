import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/crap-ceiling.ts', pathToFileURL(astMetricsCrapScript)).href;
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/crap-ceiling.ts')>;
type Input = Parameters<typeof import('../../../script/code-quality/assessment/crap-ceiling.ts').crapCeilingOf>[0];

for (const input of [undefined, null, [], 1, 'input', true]) {
  test(`Given invalid input shape ${JSON.stringify(input)}, when compared with a CRAP ceiling, then the object contract is enforced`, async () => {
    const { crapCeilingOf } = await load();
    assert.throws(() => crapCeilingOf(input as unknown as Input), { message: 'Invalid CRAP ceiling input at input: expected an object.' });
  });
}

for (const ceiling of [undefined, null, NaN, Infinity, -Infinity, -1, -Number.MIN_VALUE, '42', true]) {
  test(`Given invalid ceiling ${String(ceiling)} and missing head, when compared, then the ceiling is still validated`, async () => {
    const { crapCeilingOf } = await load();
    assert.throws(() => crapCeilingOf({ ceiling } as Input), { message: 'Invalid CRAP ceiling input at ceiling: expected a finite nonnegative number.' });
  });
}

test('Given missing or explicitly undefined head, when compared with a valid ceiling, then no head observation is invented', async () => {
  const { crapCeilingOf } = await load();
  const expected = { observation: { ceiling: 42 }, withinCeiling: { state: 'UNKNOWN', reason: 'Head CRAP operands are missing.' } };
  assert.deepEqual(crapCeilingOf({ ceiling: 42 }), expected);
  assert.deepEqual(crapCeilingOf({ head: undefined, ceiling: 42 }), expected);
});

for (const [head, diagnostic] of [
  [null, 'input: expected an object.'], [[], 'input: expected an object.'],
  [{}, 'paths: expected a nonnegative safe integer.'],
  [{ paths: -1 }, 'paths: expected a nonnegative safe integer.'],
  [{ paths: Infinity }, 'paths: expected a nonnegative safe integer.'],
  [{ paths: Number.MAX_SAFE_INTEGER + 1, share: 1 }, 'paths: expected a nonnegative safe integer.'],
  [{ paths: 1, share: null }, 'share: expected a finite number from 0 to 1.'],
  [{ paths: 1, share: NaN }, 'share: expected a finite number from 0 to 1.'],
  [{ paths: 1, share: 1.1 }, 'share: expected a finite number from 0 to 1.'],
  [{ paths: 94906266 }, 'paths: expected a safe integer upper CRAP bound when coverage is missing.'],
] as const) {
  test(`Given invalid supplied head ${JSON.stringify(head)}, when compared with a generous ceiling, then the head diagnostic is retained`, async () => {
    const { crapCeilingOf } = await load();
    assert.throws(() => crapCeilingOf({ head, ceiling: Number.MAX_VALUE } as Input), { message: `Invalid CRAP ceiling input at head: Invalid absolute CRAP input at ${diagnostic}` });
  });
}

test('Given known zero and proven zero without coverage, when the ceiling is zero, then both pass without inventing a share', async () => {
  const { crapCeilingOf } = await load();
  assert.deepEqual(crapCeilingOf({ head: { paths: 0 }, ceiling: 0 }), {
    observation: { head: { kind: 'proven-zero', paths: 0, value: 0 }, ceiling: 0 },
    withinCeiling: { state: 'PASS', reason: 'Zero paths prove CRAP <= the supplied ceiling.' },
  });
  const known = crapCeilingOf({ head: { paths: 0, share: 0 }, ceiling: 0 });
  assert.deepEqual(known.observation.head, { kind: 'known-coverage', paths: 0, share: 0, displayValue: 0 });
  assert.equal(known.withinCeiling.state, 'PASS');
});

for (const [ceiling, state, reason] of [
  [12, 'PASS', 'The upper bound proves CRAP <= the supplied ceiling.'],
  [2.999, 'MISS', 'The lower bound proves CRAP > the supplied ceiling.'],
  [3, 'UNKNOWN', 'The possible CRAP range crosses the supplied ceiling.'],
  [11.999, 'UNKNOWN', 'The possible CRAP range crosses the supplied ceiling.'],
] as const) {
  test(`Given CRAP bounds 3 to 12 and ceiling ${ceiling}, when compared, then the whole range determines ${state}`, async () => {
    const { crapCeilingOf } = await load();
    assert.deepEqual(crapCeilingOf({ head: { paths: 3 }, ceiling }), {
      observation: { head: { kind: 'missing-coverage', paths: 3, lower: 3, upper: 12 }, ceiling },
      withinCeiling: { state, reason },
    });
  });
}

test('Given no coverage and the largest supported path bound, when the ceiling exceeds safe integers, then the valid ceiling has no artificial integer cap', async () => {
  const { crapCeilingOf } = await load();
  const result = crapCeilingOf({ head: { paths: 94906265 }, ceiling: Number.MAX_SAFE_INTEGER + 1 });
  assert.equal(result.withinCeiling.state, 'PASS');
  assert.equal(result.observation.ceiling, Number.MAX_SAFE_INTEGER + 1);
});

test('Given the largest safe path count with known coverage, when ceilings are finite extremes, then unused missing-coverage bounds do not limit the operands', async () => {
  const { crapCeilingOf } = await load();
  assert.equal(crapCeilingOf({ head: { paths: Number.MAX_SAFE_INTEGER, share: 0 }, ceiling: Number.MAX_VALUE }).withinCeiling.state, 'PASS');
  assert.equal(crapCeilingOf({ head: { paths: Number.MAX_SAFE_INTEGER, share: 0 }, ceiling: Number.MAX_SAFE_INTEGER }).withinCeiling.state, 'MISS');
  assert.equal(crapCeilingOf({ head: { paths: 0 }, ceiling: Number.MIN_VALUE }).withinCeiling.state, 'PASS');
  assert.equal(crapCeilingOf({ head: { paths: 1, share: 1 }, ceiling: Number.MIN_VALUE }).withinCeiling.state, 'MISS');
});

test('Given frozen operands with tiny coverage, when compared, then operands stay unchanged and the display remains separate from the proof', async () => {
  const { crapCeilingOf } = await load();
  const head = Object.freeze({ paths: 5, share: 1e-320 });
  const input = Object.freeze({ head, ceiling: 30 });
  const result = crapCeilingOf(input);
  assert.deepEqual(input, { head: { paths: 5, share: 1e-320 }, ceiling: 30 });
  assert.deepEqual(result.observation, { head: { kind: 'known-coverage', paths: 5, share: 1e-320, displayValue: 30 }, ceiling: 30 });
  assert.deepEqual(result.withinCeiling, { state: 'PASS', reason: 'The operands prove CRAP <= the supplied ceiling.' });
});
