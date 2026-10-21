import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsSnapshotScript } from '../../support/processes/module-paths.ts';

const root = pathToFileURL(astMetricsSnapshotScript);
const load = () => import(new URL('assessment/mi-floor.ts', root).href) as Promise<typeof import('../../../script/code-quality/assessment/mi-floor.ts')>;
const loadAssessment = () => import(new URL('assessment/mi-assessment.ts', root).href) as Promise<typeof import('../../../script/code-quality/assessment/mi-assessment.ts')>;

test('Given best MI 96, base and head 90 and supplied floor 90, when calculated, then floor equality passes while cumulative decline stays a miss', async () => {
  const { miFloorOf } = await load();
  const { miAssessmentOf } = await loadAssessment();
  assert.deepEqual(miFloorOf({ head: 90, floor: 90 }), {
    observation: { head: 90, floor: 90 },
    meetsFloor: { state: 'PASS', reason: 'Raw MI is at least the supplied floor.' },
  });
  const assessment = miAssessmentOf({ acceptedBest: 96, base: 90, head: 90 });
  assert.equal(assessment.mi85.state, 'MEETS');
  assert.equal(assessment.prDecline.state, 'PASS');
  assert.equal(assessment.cumulativeDecline.state, 'MISS');
  assert.deepEqual(miFloorOf({ head: 89.9, floor: 90 }).meetsFloor, {
    state: 'MISS', reason: 'Raw MI is below the supplied floor.',
  });
});

test('Given raw MI 84.96 that displays 85, when compared with supplied floor 85, then rounding cannot prove compliance', async () => {
  const { miFloorOf } = await load();
  assert.deepEqual(miFloorOf({ head: 84.96, floor: 85 }), {
    observation: { head: 84.96, floor: 85 },
    meetsFloor: { state: 'MISS', reason: 'Raw MI is below the supplied floor.' },
  });
});

test('Given head MI 72 and supplied floor 70, when calculated, then that floor passes while the ordinary MI85 warning remains', async () => {
  const { miFloorOf } = await load();
  const { miAssessmentOf } = await loadAssessment();
  assert.equal(miFloorOf({ head: 72, floor: 70 }).meetsFloor.state, 'PASS');
  assert.equal(miAssessmentOf({ head: 72 }).mi85.state, 'LOW');
});

test('Given a supplied MI floor without a head measurement, when calculated, then the result remains unknown without inventing a score', async () => {
  const { miFloorOf } = await load();
  assert.deepEqual(miFloorOf({ floor: 90 }), {
    observation: { floor: 90 },
    meetsFloor: { state: 'UNKNOWN', reason: 'Head raw MI is missing.' },
  });
});
