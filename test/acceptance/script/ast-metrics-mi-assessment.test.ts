import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/mi-assessment.ts', pathToFileURL(astMetricsSnapshotScript)).href;
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/mi-assessment.ts')>;

test('Given accepted best 90, base 84 and head 85, when MI is assessed, then meeting the floor and improving in this PR do not clear cumulative decline five', async () => {
  const { miAssessmentOf } = await load();
  assert.deepEqual(miAssessmentOf({ acceptedBest: 90, base: 84, head: 85 }), {
    observation: { base: 84, head: 85, acceptedBest: 90 },
    mi85: { state: 'MEETS', reason: 'Raw MI is at least 85.' },
    prDecline: { state: 'PASS', reason: 'Raw MI decline is below 5.' },
    cumulativeDecline: { state: 'MISS', reason: 'Raw MI decline is at least 5.' },
    noPrDeterioration: { state: 'PASS', reason: 'Raw MI does not deteriorate.' },
  });
});

test('Given accepted best 96, base 93 and head 90, when MI is assessed, then a small PR decline and a six-point cumulative decline remain independent', async () => {
  const { miAssessmentOf } = await load();
  const result = miAssessmentOf({ acceptedBest: 96, base: 93, head: 90 });
  assert.equal(result.mi85.state, 'MEETS');
  assert.equal(result.prDecline.state, 'PASS');
  assert.equal(result.cumulativeDecline.state, 'MISS');
  assert.equal(result.noPrDeterioration.state, 'MISS');
});

test('Given low raw MI that recovers, when MI is assessed, then the low floor state does not create a deterioration miss or a route', async () => {
  const { miAssessmentOf } = await load();
  assert.deepEqual(miAssessmentOf({ acceptedBest: 72, base: 70, head: 71.9 }), {
    observation: { base: 70, head: 71.9, acceptedBest: 72 },
    mi85: { state: 'LOW', reason: 'Raw MI is below 85.' },
    prDecline: { state: 'PASS', reason: 'Raw MI decline is below 5.' },
    cumulativeDecline: { state: 'PASS', reason: 'Raw MI decline is below 5.' },
    noPrDeterioration: { state: 'PASS', reason: 'Raw MI does not deteriorate.' },
  });
});

test('Given one missing reference, when MI is assessed, then only the comparisons needing that reference stay unknown', async () => {
  const { miAssessmentOf } = await load();
  const missingBest = miAssessmentOf({ base: 90, head: 88 });
  assert.equal(missingBest.mi85.state, 'MEETS');
  assert.equal(missingBest.prDecline.state, 'PASS');
  assert.deepEqual(missingBest.cumulativeDecline, { state: 'UNKNOWN', reason: 'Reference raw MI is missing.' });
  const missingBase = miAssessmentOf({ acceptedBest: 90, head: 88 });
  assert.equal(missingBase.cumulativeDecline.state, 'PASS');
  assert.deepEqual(missingBase.prDecline, { state: 'UNKNOWN', reason: 'Reference raw MI is missing.' });
  assert.deepEqual(missingBase.noPrDeterioration, { state: 'UNKNOWN', reason: 'Reference raw MI is missing.' });
});

test('Given decimal or subnormal reference differences, when both comparisons are assessed, then each uses exact operands rather than rounded subtraction', async () => {
  const { miAssessmentOf } = await load();
  const five = miAssessmentOf({ base: 8.2, acceptedBest: 8.2, head: 3.2 });
  assert.equal(five.prDecline.state, 'MISS');
  assert.equal(five.cumulativeDecline.state, 'MISS');
  const smaller = miAssessmentOf({ base: 5, acceptedBest: 5, head: Number.MIN_VALUE });
  assert.equal(smaller.prDecline.state, 'PASS');
  assert.equal(smaller.cumulativeDecline.state, 'PASS');
  assert.equal(smaller.noPrDeterioration.state, 'MISS');
});
