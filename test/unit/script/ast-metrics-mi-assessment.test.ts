import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/mi-assessment.ts', pathToFileURL(astMetricsSnapshotScript)).href;
type Input = Parameters<typeof import('../../../script/code-quality/assessment/mi-assessment.ts').miAssessmentOf>[0];
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/mi-assessment.ts')>;

for (const [head, state] of [[84.96, 'LOW'], [85, 'MEETS'], [0, 'LOW'], [-9.5, 'LOW'], [128.00000001, 'MEETS']] as const) {
  test(`Given raw head MI ${head}, when assessed without references, then the floor is ${state} and missing references stay unknown`, async () => {
    const { miAssessmentOf } = await load();
    const result = miAssessmentOf({ head });
    assert.deepEqual(result.observation, { head });
    assert.deepEqual(result.mi85, { state, reason: state === 'MEETS' ? 'Raw MI is at least 85.' : 'Raw MI is below 85.' });
    assert.deepEqual(result.prDecline, { state: 'UNKNOWN', reason: 'Reference raw MI is missing.' });
    assert.deepEqual(result.cumulativeDecline, { state: 'UNKNOWN', reason: 'Reference raw MI is missing.' });
    assert.deepEqual(result.noPrDeterioration, { state: 'UNKNOWN', reason: 'Reference raw MI is missing.' });
  });
}

for (const input of [undefined, null, [], 1, 'input', true]) {
  test(`Given invalid input shape ${JSON.stringify(input)}, when assessed, then the root object is rejected`, async () => {
    const { miAssessmentOf } = await load();
    assert.throws(() => miAssessmentOf(input as unknown as Input), { message: 'Invalid MI assessment input at input: expected an object.' });
  });
}

for (const field of ['base', 'head', 'acceptedBest'] as const) {
  for (const value of [null, '85', true, [], {}, NaN, Infinity, -Infinity]) {
    test(`Given invalid ${field} ${String(value)} with other operands absent, when assessed, then validation names that supplied operand`, async () => {
      const { miAssessmentOf } = await load();
      assert.throws(() => miAssessmentOf({ [field]: value } as Input), { message: `Invalid MI assessment input at ${field}: Invalid MI decline input at head: expected a finite number.` });
    });
  }
}

for (const field of ['base', 'acceptedBest'] as const) {
  test(`Given head MI 90 and invalid ${field}, when assessed, then a known passing floor does not hide invalid supplied data`, async () => {
    const { miAssessmentOf } = await load();
    assert.throws(() => miAssessmentOf({ base: 92, head: 90, [field]: null } as unknown as Input), { message: `Invalid MI assessment input at ${field}: Invalid MI decline input at head: expected a finite number.` });
  });
}

test('Given all operands missing, when assessed, then observation stays empty and every independent result remains unknown', async () => {
  const { miAssessmentOf } = await load();
  const expected = {
    observation: {},
    mi85: { state: 'UNKNOWN', reason: 'Head raw MI is missing.' },
    prDecline: { state: 'UNKNOWN', reason: 'Reference and head raw MI are missing.' },
    cumulativeDecline: { state: 'UNKNOWN', reason: 'Reference and head raw MI are missing.' },
    noPrDeterioration: { state: 'UNKNOWN', reason: 'Reference and head raw MI are missing.' },
  };
  assert.deepEqual(miAssessmentOf({}), expected);
  assert.deepEqual(miAssessmentOf({ base: undefined, head: undefined, acceptedBest: undefined }), expected);
});

test('Given missing head and supplied references, when assessed, then references are retained without supplying a head floor or comparison result', async () => {
  const { miAssessmentOf } = await load();
  assert.deepEqual(miAssessmentOf({ base: 90, acceptedBest: 96 }), {
    observation: { base: 90, acceptedBest: 96 },
    mi85: { state: 'UNKNOWN', reason: 'Head raw MI is missing.' },
    prDecline: { state: 'UNKNOWN', reason: 'Head raw MI is missing.' },
    cumulativeDecline: { state: 'UNKNOWN', reason: 'Head raw MI is missing.' },
    noPrDeterioration: { state: 'UNKNOWN', reason: 'Head raw MI is missing.' },
  });
});

for (const [base, acceptedBest, head, pr, cumulative, noDeterioration] of [
  [96, 90, 93, 'PASS', 'PASS', 'MISS'],
  [-12.5, -12.5, -12.5, 'PASS', 'PASS', 'PASS'],
  [Number.MAX_VALUE, -Number.MAX_VALUE, 0, 'MISS', 'PASS', 'MISS'],
  [-Number.MAX_VALUE, Number.MAX_VALUE, 0, 'PASS', 'MISS', 'PASS'],
  [Number.MIN_VALUE, 0, 0, 'PASS', 'PASS', 'MISS'],
] as const) {
  test(`Given supplied base ${base}, best ${acceptedBest} and head ${head}, when assessed, then references remain independent without ordering or overflow assumptions`, async () => {
    const { miAssessmentOf } = await load();
    const result = miAssessmentOf({ base, acceptedBest, head });
    assert.deepEqual(result.observation, { base, acceptedBest, head });
    assert.equal(result.prDecline.state, pr);
    assert.equal(result.cumulativeDecline.state, cumulative);
    assert.equal(result.noPrDeterioration.state, noDeterioration);
  });
}

test('Given exact-five decimal and subnormal precision cases in either reference position, when assessed, then neither comparison uses rounded subtraction', async () => {
  const { miAssessmentOf } = await load();
  for (const reference of [8.2, 5]) {
    const head = reference === 8.2 ? 3.2 : Number.MIN_VALUE;
    const state = reference === 8.2 ? 'MISS' : 'PASS';
    assert.equal(miAssessmentOf({ base: reference, head }).prDecline.state, state);
    assert.equal(miAssessmentOf({ acceptedBest: reference, head }).cumulativeDecline.state, state);
  }
});

test('Given frozen raw inputs, when assessed, then labels and values are retained without mutating inputs or returning a combined pass or route', async () => {
  const { miAssessmentOf } = await load();
  const input = Object.freeze({ base: 84, head: 85, acceptedBest: 90 });
  const result = miAssessmentOf(input);
  assert.deepEqual(input, { base: 84, head: 85, acceptedBest: 90 });
  assert.deepEqual(Object.keys(result).sort(), ['cumulativeDecline', 'mi85', 'noPrDeterioration', 'observation', 'prDecline']);
  assert.deepEqual(result.observation, input);
});
