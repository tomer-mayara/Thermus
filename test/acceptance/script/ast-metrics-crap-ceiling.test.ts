import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';

const root = pathToFileURL(astMetricsCrapScript);
const load = () => import(new URL('assessment/crap-ceiling.ts', root).href) as Promise<typeof import('../../../script/code-quality/assessment/crap-ceiling.ts')>;
const loadAssessment = () => import(new URL('assessment/crap-assessment.ts', root).href) as Promise<typeof import('../../../script/code-quality/assessment/crap-assessment.ts')>;

test('Given reference CRAP 42 and head bounds 6 to 42, when compared with ceiling 42, then the ceiling passes while the ordinary absolute goal stays unknown', async () => {
  const { crapCeilingOf } = await load();
  const { crapAssessmentOf } = await loadAssessment();
  const head = { paths: 6 };
  assert.deepEqual(crapCeilingOf({ head, ceiling: 42 }), {
    observation: { head: { kind: 'missing-coverage', paths: 6, lower: 6, upper: 42 }, ceiling: 42 },
    withinCeiling: { state: 'PASS', reason: 'The upper bound proves CRAP <= the supplied ceiling.' },
  });
  const assessment = crapAssessmentOf({ base: { paths: 6, share: 0 }, acceptedBest: { paths: 6, share: 0 }, head });
  assert.equal(assessment.below30.state, 'UNKNOWN');
  assert.equal(assessment.prDecline.state, 'PASS');
  assert.equal(assessment.cumulativeDecline.state, 'PASS');
});

test('Given three paths without coverage, when supplied ceilings move through the possible range, then each result preserves the uncertainty', async () => {
  const { crapCeilingOf } = await load();
  assert.equal(crapCeilingOf({ head: { paths: 3 }, ceiling: 12 }).withinCeiling.state, 'PASS');
  assert.equal(crapCeilingOf({ head: { paths: 3 }, ceiling: 2.999 }).withinCeiling.state, 'MISS');
  assert.equal(crapCeilingOf({ head: { paths: 3 }, ceiling: 3 }).withinCeiling.state, 'UNKNOWN');
  assert.equal(crapCeilingOf({ head: { paths: 3 }, ceiling: 11.999 }).withinCeiling.state, 'UNKNOWN');
});

test('Given exact decimal CRAP 30, when compared with inclusive ceiling 30 or a smaller ceiling, then exact equality passes and the smaller ceiling misses', async () => {
  const { crapCeilingOf } = await load();
  assert.equal(crapCeilingOf({ head: { paths: 25, share: 0.8 }, ceiling: 30 }).withinCeiling.state, 'PASS');
  assert.equal(crapCeilingOf({ head: { paths: 25, share: 0.8 }, ceiling: 29.999999 }).withinCeiling.state, 'MISS');
});

test('Given exact CRAP above 15 whose display says 15, when compared with ceiling 15, then display rounding cannot prove compliance', async () => {
  const { crapCeilingOf } = await load();
  const result = crapCeilingOf({ head: { paths: 15, share: 0.9999999 }, ceiling: 15 });
  assert.ok(result.observation.head?.kind === 'known-coverage');
  assert.equal(result.observation.head.displayValue, 15);
  assert.deepEqual(result.withinCeiling, { state: 'MISS', reason: 'The operands prove CRAP > the supplied ceiling.' });
});
