import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/crap-absolute.ts', pathToFileURL(astMetricsCrapScript)).href;
type Operands = Parameters<typeof import('../../../script/code-quality/assessment/crap-absolute.ts').crapAbsoluteOf>[0];
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/crap-absolute.ts')>;

for (const input of [undefined, null, [], 1, 'input', true]) {
  test(`Given invalid input shape ${JSON.stringify(input)}, when CRAP goals are assessed, then the input is rejected`, async () => {
    const { crapAbsoluteOf } = await load();
    assert.throws(() => crapAbsoluteOf(input as unknown as Operands), { message: 'Invalid absolute CRAP input at input: expected an object.' });
  });
}
for (const paths of [undefined, null, '3', true, -1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
  test(`Given invalid paths ${String(paths)}, when CRAP goals are assessed, then the count is rejected`, async () => {
    const { crapAbsoluteOf } = await load();
    assert.throws(() => crapAbsoluteOf({ paths } as Operands), { message: 'Invalid absolute CRAP input at paths: expected a nonnegative safe integer.' });
  });
}
for (const share of [null, '0.5', true, [], {}, -0.01, 1.01, NaN, Infinity, -Infinity]) {
  test(`Given invalid share ${JSON.stringify(share)}, when CRAP goals are assessed, then the share is rejected`, async () => {
    const { crapAbsoluteOf } = await load();
    assert.throws(() => crapAbsoluteOf({ paths: 0, share } as Operands), { message: 'Invalid absolute CRAP input at share: expected a finite number from 0 to 1.' });
  });
}
for (const [paths, low, high, target, limit] of [
  [1, 1, 2, 'PASS', 'PASS'], [3, 3, 12, 'PASS', 'PASS'], [4, 4, 20, 'UNKNOWN', 'PASS'],
  [5, 5, 30, 'UNKNOWN', 'UNKNOWN'], [15, 15, 240, 'UNKNOWN', 'UNKNOWN'],
  [16, 16, 272, 'MISS', 'UNKNOWN'], [29, 29, 870, 'MISS', 'UNKNOWN'], [30, 30, 930, 'MISS', 'MISS'],
] as const) {
  test(`Given ${paths} paths without coverage, when assessed, then exact bounds retain the two independent goal results`, async () => {
    const { crapAbsoluteOf } = await load();
    const result = crapAbsoluteOf({ paths });
    assert.deepEqual(result.observation, { kind: 'missing-coverage', paths, lower: low, upper: high });
    assert.equal(result.atMost15.state, target);
    assert.equal(result.below30.state, limit);
    assert.equal(result.atMost15.reason, target === 'PASS' ? 'The upper bound proves CRAP <=15.' : target === 'MISS' ? 'The lower bound proves CRAP >15.' : 'The possible CRAP range crosses 15.');
    assert.equal(result.below30.reason, limit === 'PASS' ? 'The upper bound proves CRAP <30.' : limit === 'MISS' ? 'The lower bound proves CRAP >=30.' : 'The possible CRAP range reaches or crosses 30.');
  });
}

test('Given the largest safe missing-coverage upper bound and one count more, when assessed, then only the safe returned interval is accepted', async () => {
  const { crapAbsoluteOf } = await load();
  assert.deepEqual(crapAbsoluteOf({ paths: 94906265 }).observation, { kind: 'missing-coverage', paths: 94906265, lower: 94906265, upper: 9007199231156490 });
  assert.throws(() => crapAbsoluteOf({ paths: 94906266 }), { message: 'Invalid absolute CRAP input at paths: expected a safe integer upper CRAP bound when coverage is missing.' });
});

test('Given large safe path counts with known coverage, when assessed, then no unused bound cap rejects the input', async () => {
  const { crapAbsoluteOf } = await load();
  for (const share of [0, 1, 1e-320]) {
    const result = crapAbsoluteOf({ paths: Number.MAX_SAFE_INTEGER, share });
    assert.ok(result.observation.kind === 'known-coverage');
    assert.equal(result.observation.paths, Number.MAX_SAFE_INTEGER);
    assert.equal(result.observation.share, share);
    assert.ok(Number.isFinite(result.observation.displayValue));
    assert.equal(result.atMost15.state, 'MISS');
    assert.equal(result.below30.state, 'MISS');
  }
});

test('Given zero paths with missing or known coverage, when assessed, then missing coverage proves zero and supplied shares remain supplied', async () => {
  const { crapAbsoluteOf } = await load();
  assert.deepEqual(crapAbsoluteOf({ paths: 0, share: undefined }).observation, { kind: 'proven-zero', paths: 0, value: 0 });
  for (const share of [0, 1]) assert.deepEqual(crapAbsoluteOf({ paths: 0, share }).observation, { kind: 'known-coverage', paths: 0, share, displayValue: 0 });
});

test('Given frozen operands, when both goals are assessed, then the supplied input stays unchanged', async () => {
  const { crapAbsoluteOf } = await load();
  const input = Object.freeze({ paths: 5, share: 1e-320 });
  crapAbsoluteOf(input);
  assert.deepEqual(input, { paths: 5, share: 1e-320 });
});
