import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/crap-assessment.ts', pathToFileURL(astMetricsCrapScript)).href;
type Input = Parameters<typeof import('../../../script/code-quality/assessment/crap-assessment.ts').crapAssessmentOf>[0];
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/crap-assessment.ts')>;

for (const input of [undefined, null, [], 1, 'input', true]) {
  test(`Given invalid shape ${JSON.stringify(input)}, when CRAP is assessed, then the root object is rejected`, async () => {
    const { crapAssessmentOf } = await load();
    assert.throws(() => crapAssessmentOf(input as unknown as Input), { message: 'Invalid CRAP assessment input at input: expected an object.' });
  });
}

for (const field of ['base', 'head', 'acceptedBest'] as const) {
  for (const [value, diagnostic] of [
    [null, 'input: expected an object.'], [[], 'input: expected an object.'],
    [{}, 'paths: expected a nonnegative safe integer.'],
    [{ paths: 0, share: null }, 'share: expected a finite number from 0 to 1.'],
    [{ paths: 94906266 }, 'paths: expected a safe integer upper CRAP bound when coverage is missing.'],
  ] as const) {
    test(`Given invalid ${field} ${JSON.stringify(value)} with other observations absent, when assessed, then that supplied label fails`, async () => {
      const { crapAssessmentOf } = await load();
      assert.throws(() => crapAssessmentOf({ [field]: value } as Input), { message: `Invalid CRAP assessment input at ${field}: Invalid absolute CRAP input at ${diagnostic}` });
    });
  }
}

for (const field of ['base', 'acceptedBest'] as const) {
  test(`Given passing head zero and invalid ${field}, when assessed, then supplied data is validated before returning passing goals`, async () => {
    const { crapAssessmentOf } = await load();
    assert.throws(() => crapAssessmentOf({ head: { paths: 0 }, [field]: { paths: 1, share: Infinity } }), { message: `Invalid CRAP assessment input at ${field}: Invalid absolute CRAP input at share: expected a finite number from 0 to 1.` });
  });
}

test('Given no observations, when assessed, then every independent goal is unknown and no observation is invented', async () => {
  const { crapAssessmentOf } = await load();
  const expected = {
    observation: {},
    atMost15: { state: 'UNKNOWN', reason: 'Head CRAP operands are missing.' },
    below30: { state: 'UNKNOWN', reason: 'Head CRAP operands are missing.' },
    prDecline: { state: 'UNKNOWN', reason: 'Reference and head CRAP operands are missing.' },
    cumulativeDecline: { state: 'UNKNOWN', reason: 'Reference and head CRAP operands are missing.' },
    noPrDeterioration: { state: 'UNKNOWN', reason: 'Reference and head CRAP operands are missing.' },
  };
  assert.deepEqual(crapAssessmentOf({}), expected);
  assert.deepEqual(crapAssessmentOf({ base: undefined, head: undefined, acceptedBest: undefined }), expected);
});

test('Given references without a head, when assessed, then missing head keeps both absolute and comparison results unknown', async () => {
  const { crapAssessmentOf } = await load();
  assert.deepEqual(crapAssessmentOf({ base: { paths: 0 }, acceptedBest: { paths: 0 } }), {
    observation: { base: { kind: 'proven-zero', paths: 0, value: 0 }, acceptedBest: { kind: 'proven-zero', paths: 0, value: 0 } },
    atMost15: { state: 'UNKNOWN', reason: 'Head CRAP operands are missing.' },
    below30: { state: 'UNKNOWN', reason: 'Head CRAP operands are missing.' },
    prDecline: { state: 'UNKNOWN', reason: 'Head CRAP operands are missing.' },
    cumulativeDecline: { state: 'UNKNOWN', reason: 'Head CRAP operands are missing.' },
    noPrDeterioration: { state: 'UNKNOWN', reason: 'Head CRAP operands are missing.' },
  });
});

test('Given one missing reference, when assessed, then only its dependent comparisons stay unknown', async () => {
  const { crapAssessmentOf } = await load();
  const missingBest = crapAssessmentOf({ base: { paths: 3, share: 1 }, head: { paths: 4, share: 1 } });
  assert.equal(missingBest.prDecline.state, 'PASS');
  assert.equal(missingBest.noPrDeterioration.state, 'MISS');
  assert.deepEqual(missingBest.cumulativeDecline, { state: 'UNKNOWN', reason: 'Reference CRAP operands are missing.' });
  const missingBase = crapAssessmentOf({ acceptedBest: { paths: 3, share: 1 }, head: { paths: 4, share: 1 } });
  assert.equal(missingBase.cumulativeDecline.state, 'PASS');
  assert.deepEqual(missingBase.prDecline, { state: 'UNKNOWN', reason: 'Reference CRAP operands are missing.' });
  assert.deepEqual(missingBase.noPrDeterioration, { state: 'UNKNOWN', reason: 'Reference CRAP operands are missing.' });
});

for (const [headPaths, referencePaths, target, limit] of [[15, 10, 'PASS', 'PASS'], [30, 25, 'MISS', 'MISS']] as const) {
  test(`Given exact head CRAP ${headPaths} and five-point differences in both references, when assessed, then exact absolute and decline boundaries remain separate`, async () => {
    const { crapAssessmentOf } = await load();
    const result = crapAssessmentOf({ base: { paths: referencePaths, share: 1 }, acceptedBest: { paths: referencePaths, share: 1 }, head: { paths: headPaths, share: 1 } });
    assert.equal(result.atMost15.state, target);
    assert.equal(result.below30.state, limit);
    assert.equal(result.prDecline.state, 'MISS');
    assert.equal(result.cumulativeDecline.state, 'MISS');
    assert.equal(result.noPrDeterioration.state, 'MISS');
  });
}

test('Given bounded accepted-best operands, when assessed, then the lower difference bound can prove a cumulative miss while PR improves', async () => {
  const { crapAssessmentOf } = await load();
  const result = crapAssessmentOf({ base: { paths: 8, share: 1 }, acceptedBest: { paths: 1 }, head: { paths: 7, share: 1 } });
  assert.equal(result.atMost15.state, 'PASS');
  assert.equal(result.prDecline.state, 'PASS');
  assert.equal(result.noPrDeterioration.state, 'PASS');
  assert.deepEqual(result.cumulativeDecline, { state: 'MISS', reason: 'The lower bound proves CRAP deterioration >=5.' });
  assert.deepEqual(result.observation.acceptedBest, { kind: 'missing-coverage', paths: 1, lower: 1, upper: 2 });
});

test('Given supplied references in any order, when assessed, then no best-selection or ordering rule changes the labeled calculations', async () => {
  const { crapAssessmentOf } = await load();
  const result = crapAssessmentOf({ base: { paths: 1, share: 1 }, acceptedBest: { paths: 10, share: 1 }, head: { paths: 5, share: 1 } });
  assert.equal(result.prDecline.state, 'PASS');
  assert.equal(result.cumulativeDecline.state, 'PASS');
  assert.equal(result.noPrDeterioration.state, 'MISS');
  assert.deepEqual(result.observation.acceptedBest, { kind: 'known-coverage', paths: 10, share: 1, displayValue: 10 });
});

test('Given head zero without coverage and absent references, when assessed, then proven zero does not supply missing base or accepted best', async () => {
  const { crapAssessmentOf } = await load();
  const result = crapAssessmentOf({ head: { paths: 0 } });
  assert.deepEqual(result.observation, { head: { kind: 'proven-zero', paths: 0, value: 0 } });
  assert.equal(result.atMost15.state, 'PASS');
  assert.equal(result.below30.state, 'PASS');
  assert.equal(result.prDecline.state, 'UNKNOWN');
  assert.equal(result.cumulativeDecline.state, 'UNKNOWN');
});

test('Given the safe missing-bound limit and large known observations, when assessed, then delegated limits stay unchanged', async () => {
  const { crapAssessmentOf } = await load();
  const bounded = crapAssessmentOf({ base: { paths: 94906265 }, acceptedBest: { paths: 94906265 }, head: { paths: 0 } });
  assert.equal(bounded.prDecline.state, 'PASS');
  assert.equal(bounded.cumulativeDecline.state, 'PASS');
  assert.deepEqual(bounded.observation.acceptedBest, { kind: 'missing-coverage', paths: 94906265, lower: 94906265, upper: 9007199231156490 });
  const large = crapAssessmentOf({ base: { paths: Number.MAX_SAFE_INTEGER, share: 0 }, acceptedBest: { paths: Number.MAX_SAFE_INTEGER, share: 0 }, head: { paths: Number.MAX_SAFE_INTEGER, share: 0 } });
  assert.equal(large.atMost15.state, 'MISS');
  assert.equal(large.below30.state, 'MISS');
  assert.equal(large.prDecline.state, 'PASS');
  assert.equal(large.cumulativeDecline.state, 'PASS');
  assert.equal(large.noPrDeterioration.state, 'PASS');
});

test('Given frozen raw observations, when assessed, then input is unchanged and no aggregate pass, route or numeric difference is returned', async () => {
  const { crapAssessmentOf } = await load();
  const input = Object.freeze({ base: Object.freeze({ paths: 6, share: 0 }), acceptedBest: Object.freeze({ paths: 6, share: 0 }), head: Object.freeze({ paths: 6 }) });
  const result = crapAssessmentOf(input);
  assert.deepEqual(input, { base: { paths: 6, share: 0 }, acceptedBest: { paths: 6, share: 0 }, head: { paths: 6 } });
  assert.deepEqual(Object.keys(result).sort(), ['atMost15', 'below30', 'cumulativeDecline', 'noPrDeterioration', 'observation', 'prDecline']);
  assert.deepEqual(result.observation.head, { kind: 'missing-coverage', paths: 6, lower: 6, upper: 42 });
});
