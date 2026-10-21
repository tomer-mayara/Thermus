import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsCrapScript } from '../../support/processes/module-paths.ts';

const moduleUrl = new URL('assessment/crap-assessment.ts', pathToFileURL(astMetricsCrapScript)).href;
const load = () => import(moduleUrl) as Promise<typeof import('../../../script/code-quality/assessment/crap-assessment.ts')>;

test('Given best CRAP 8, base 11 and head 13, when assessed, then passing absolute and PR goals do not clear cumulative deterioration five', async () => {
  const { crapAssessmentOf } = await load();
  const result = crapAssessmentOf({ acceptedBest: { paths: 8, share: 1 }, base: { paths: 11, share: 1 }, head: { paths: 13, share: 1 } });
  assert.deepEqual(result.observation, {
    base: { kind: 'known-coverage', paths: 11, share: 1, displayValue: 11 },
    head: { kind: 'known-coverage', paths: 13, share: 1, displayValue: 13 },
    acceptedBest: { kind: 'known-coverage', paths: 8, share: 1, displayValue: 8 },
  });
  assert.equal(result.atMost15.state, 'PASS');
  assert.equal(result.below30.state, 'PASS');
  assert.deepEqual(result.prDecline, { state: 'PASS', reason: 'The operands prove CRAP deterioration <5.' });
  assert.deepEqual(result.cumulativeDecline, { state: 'MISS', reason: 'The operands prove CRAP deterioration >=5.' });
  assert.deepEqual(result.noPrDeterioration, { state: 'MISS', reason: 'The operands prove CRAP deterioration >0.' });
  const improvement = crapAssessmentOf({ acceptedBest: { paths: 8, share: 1 }, base: { paths: 14, share: 1 }, head: { paths: 13, share: 1 } });
  assert.equal(improvement.prDecline.state, 'PASS');
  assert.equal(improvement.noPrDeterioration.state, 'PASS');
  assert.equal(improvement.cumulativeDecline.state, 'MISS');
});

test('Given three paths on every side without coverage, when assessed, then absolute bounds pass while both deterioration comparisons stay unknown', async () => {
  const { crapAssessmentOf } = await load();
  const result = crapAssessmentOf({ base: { paths: 3 }, head: { paths: 3 }, acceptedBest: { paths: 3 } });
  assert.deepEqual(result.observation, {
    base: { kind: 'missing-coverage', paths: 3, lower: 3, upper: 12 },
    head: { kind: 'missing-coverage', paths: 3, lower: 3, upper: 12 },
    acceptedBest: { kind: 'missing-coverage', paths: 3, lower: 3, upper: 12 },
  });
  assert.equal(result.atMost15.state, 'PASS');
  assert.equal(result.below30.state, 'PASS');
  assert.equal(result.prDecline.state, 'UNKNOWN');
  assert.equal(result.cumulativeDecline.state, 'UNKNOWN');
  assert.equal(result.noPrDeterioration.state, 'UNKNOWN');
});

test('Given supplied references 42 and head bounds 6 to 42, when assessed, then unknown absolute goals coexist with passing deterioration arithmetic without an exception decision', async () => {
  const { crapAssessmentOf } = await load();
  const result = crapAssessmentOf({ base: { paths: 6, share: 0 }, acceptedBest: { paths: 6, share: 0 }, head: { paths: 6 } });
  assert.equal(result.atMost15.state, 'UNKNOWN');
  assert.equal(result.below30.state, 'UNKNOWN');
  assert.deepEqual(result.prDecline, { state: 'PASS', reason: 'The upper bound proves CRAP deterioration <5.' });
  assert.deepEqual(result.cumulativeDecline, { state: 'PASS', reason: 'The upper bound proves CRAP deterioration <5.' });
  assert.equal(result.noPrDeterioration.state, 'PASS');
});

test('Given head CRAP 20 without references, when assessed, then both absolute goals remain separate and no applicable rule is selected', async () => {
  const { crapAssessmentOf } = await load();
  const result = crapAssessmentOf({ head: { paths: 4, share: 0 } });
  assert.equal(result.atMost15.state, 'MISS');
  assert.equal(result.below30.state, 'PASS');
  assert.equal(result.prDecline.state, 'UNKNOWN');
  assert.equal(result.cumulativeDecline.state, 'UNKNOWN');
  assert.equal(result.noPrDeterioration.state, 'UNKNOWN');
});

test('Given tiny coverage whose display hides strict differences, when assessed against either reference, then exact absolute and deterioration decisions are preserved', async () => {
  const { crapAssessmentOf } = await load();
  const smaller = crapAssessmentOf({ base: { paths: 25, share: 1 }, acceptedBest: { paths: 25, share: 1 }, head: { paths: 5, share: 1e-320 } });
  assert.ok(smaller.observation.head?.kind === 'known-coverage');
  assert.equal(smaller.observation.head.displayValue, 30);
  assert.equal(smaller.below30.state, 'PASS');
  assert.equal(smaller.prDecline.state, 'PASS');
  assert.equal(smaller.cumulativeDecline.state, 'PASS');
  const positive = crapAssessmentOf({ base: { paths: 5, share: 1e-320 }, acceptedBest: { paths: 5, share: 1e-320 }, head: { paths: 5, share: 0 } });
  assert.ok(positive.observation.base?.kind === 'known-coverage');
  assert.ok(positive.observation.head?.kind === 'known-coverage');
  assert.equal(positive.observation.base.displayValue, 30);
  assert.equal(positive.observation.head.displayValue, 30);
  assert.equal(positive.below30.state, 'MISS');
  assert.equal(positive.noPrDeterioration.state, 'MISS');
});
