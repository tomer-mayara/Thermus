import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

const root = pathToFileURL(astMetricsArchitectureScript);
const { crapValueOf } = await import(new URL('architecture/crap-score.ts', root).href) as typeof import('../../../script/code-quality/architecture/crap-score.ts');
const { coverageNeeded } = await import(new URL('crap/goals.ts', root).href) as typeof import('../../../script/code-quality/crap/goals.ts');
const { crapReportOf } = await import(new URL('crap/report.ts', root).href) as typeof import('../../../script/code-quality/crap/report.ts');

for (const [paths, strict, inclusive] of [[0, 0, 0], [4, 0, 12], [5, 1, 27], [10, 42, 64], [15, 60, 100], [20, 71, undefined], [25, 81, undefined], [30, undefined, undefined], [35, undefined, undefined]] as const) {
  test(`Given ${paths} paths, when coverage advice is requested, then it respects strict and inclusive boundaries`, () => {
    assert.equal(coverageNeeded(paths, { value: 30, inclusive: false }), strict);
    assert.equal(coverageNeeded(paths, { value: 15, inclusive: true }), inclusive);
  });
}

test('Given exact and fractional scores, when CRAP is calculated, then decimal equality is retained without display rounding', () => {
  assert.equal(crapValueOf(25, 0.8), 30);
  assert.equal(crapValueOf(5, 0), 30);
  assert.equal(crapValueOf(15, 1), 15);
  assert.equal(crapValueOf(12, 0.25), 72.75);
  assert.equal(crapValueOf(7, 0.5), 13.125);
  assert.equal(crapValueOf(9, 0.1), 68.049);
  assert.equal(crapValueOf(2, 1e-7), 5.99999880000012);
  assert.equal(crapValueOf(5, 1e-320), 30);
  assert.equal(crapValueOf(0, 1e-320), 0);
});

function reportOf(change: 'new' | 'changed' | 'unchanged' | 'unknown', score: number, unmeasured = false) {
  const paths = score === 15 ? 15 : score >= 20 ? 5 : score === 1 ? 1 : 4;
  const share = unmeasured ? undefined : 1 - Math.cbrt((score - paths) / paths ** 2);
  return crapReportOf([{ file: 'src/a.ts', name: 'f', paths, share, crap: score, change, identity: '1' }], { limit: 30, target: 15 });
}

test('Given scores near both goals, when displayed and assessed, then the display cannot hide the result', () => {
  assert.match(reportOf('changed', 29.96).text, /29\.96 \| ok; for 15:/u);
  assert.equal(reportOf('changed', 29.96).passed, true);
  assert.match(reportOf('new', 15.04).text, /15\.04.*required new target missed/u);
  assert.equal(reportOf('new', 15.04).passed, false);
  assert.equal(reportOf('new', 15).passed, true);
  assert.equal(reportOf('changed', 30).passed, false);
});

test('Given measured or unmeasured unknown identity, when assessed, then the required classification is unresolved', () => {
  assert.equal(reportOf('unknown', 1).passed, false);
  assert.equal(reportOf('changed', 4, true).passed, false);
  assert.equal(reportOf('unchanged', 4, true).passed, true);
  assert.equal(reportOf('unchanged', 30).passed, false);
});

test('Given custom thresholds, when advice is requested, then equality obeys the selected inequality', () => {
  assert.equal(coverageNeeded(4, { value: 20, inclusive: false }), 1);
  assert.equal(coverageNeeded(4, { value: 20, inclusive: true }), 0);
  assert.equal(coverageNeeded(4, { value: 4, inclusive: false }), undefined);
  assert.equal(coverageNeeded(4, { value: 4, inclusive: true }), 100);
});

test('Given a score too close to the limit for Number, when compared, then the decimal inequality remains exact', async () => {
  const { compareCrap } = await import(new URL('architecture/crap-score.ts', root).href) as typeof import('../../../script/code-quality/architecture/crap-score.ts');
  const { isOver } = await import(new URL('architecture/crap.ts', root).href) as typeof import('../../../script/code-quality/architecture/crap.ts');
  const { crapTextOf } = await import(new URL('architecture/crap-format.ts', root).href) as typeof import('../../../script/code-quality/architecture/crap-format.ts');
  const entry = { name: 'barelyCovered', paths: 5, share: 1e-320, crap: crapValueOf(5, 1e-320) };
  assert.equal(compareCrap(entry, 30), -1);
  assert.equal(isOver(entry), false);
  assert.equal(crapTextOf(entry), '< 30');
});
