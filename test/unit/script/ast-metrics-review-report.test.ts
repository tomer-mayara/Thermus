import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsReviewScript } from '../../support/processes/module-paths.ts';

const { reviewPassed } = await import(new URL('review/report.ts', pathToFileURL(astMetricsReviewScript)).href) as typeof import('../../../script/code-quality/review/report.ts');

function report(high = 0) {
  const finding = { kind: 'regression', severity: 'high', rule: 'complexity-regression', file: 'src/a.ts', message: 'Too many paths', suggestion: 'Simplify' };
  return { methodologyVersion: '1.1', baseRef: 'main', baseSha: 'a'.repeat(40), headSha: 'b'.repeat(40), summary: { filesChanged: 1, filesAdded: 0, filesDeleted: 0, high, medium: 0, low: 0, improvements: 0 }, regressions: Array.from({ length: high }, () => finding), improvements: [], gate: high > 0 ? 'failed' : 'passed' };
}

test('A completed review returns its structured quality outcome', () => {
  assert.equal(reviewPassed(JSON.stringify(report()), { base: 'main', status: 0 }), true);
  assert.equal(reviewPassed(JSON.stringify(report(2)), { base: 'main', status: 1 }), false);
});

for (const [name, change] of [
  ['incomplete', () => ({ gate: 'failed' })],
  ['wrong count', () => ({ ...report(1), regressions: [] })],
  ['wrong base', () => ({ ...report(), baseRef: 'other' })],
  ['inconsistent gate', () => ({ ...report(), gate: 'failed' })],
  ['invalid finding', () => ({ ...report(1), regressions: [{ severity: 'high' }] })],
] as const) {
  test(`The review rejects ${name} JSON as an operational failure`, () => {
    assert.throws(() => reviewPassed(JSON.stringify(change()), { base: 'main', status: 0 }), /review.*JSON/);
  });
}

for (const status of [1, 2, null]) {
  test(`The review rejects status ${status} without a corresponding quality outcome`, () => {
    assert.throws(() => reviewPassed(JSON.stringify(report()), { base: 'main', status }), /review.*status|review.*signal/);
  });
}

test('A completed improvement report can omit a suggestion', () => {
  const clean = report();
  const improved = { ...clean, summary: { ...clean.summary, improvements: 1 }, improvements: [{ kind: 'improvement', severity: 'low', rule: 'complexity-improvement', file: 'src/a.ts', message: 'Fewer paths' }] };
  assert.equal(reviewPassed(JSON.stringify(improved), { base: 'main', status: 0 }), true);
});
