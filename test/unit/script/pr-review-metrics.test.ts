import type { MetricsFiles, ReviewFinding } from '../../../script/pr-review/metrics-files.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { metricsOutcome } = await import(new URL('metrics.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/metrics.ts');

type Status = MetricsFiles['outcomes'][number]['status'];

const rules = { scopes: { production: ['src/**'], generated: [] } };
const changes = [{ status: 'M', path: 'src/a.ts' }, { status: 'R', oldPath: 'src/old.ts', path: 'src/b.ts' }, { status: 'A', path: 'test/a.test.ts' }];
const unchangedLine = (count: string) => `${count} on unchanged files, reason unchanged by this PR`;
const lowMi = 'Maintainability too low: got 63 (min: 85)';

function outcomesOf(...statuses: Status[]): MetricsFiles['outcomes'] {
  return (['Delta', 'Review', 'CRAP', 'Architecture'] as const).map((name, index) => ({ name, status: statuses[index] }));
}

function findingsOutcome(findings: readonly ReviewFinding[]) {
  return metricsOutcome({ changes, metrics: { outcomes: outcomesOf('passed', 'goal miss', 'passed', 'passed'), findings } }, rules);
}

test('Given no metrics files, when the metrics step runs, then the Metrics section says that it was not checked and no reason fires', () => {
  assert.deepEqual(metricsOutcome({ changes }, rules), { reasons: [], lines: ['not checked: give --process and --review'] });
});

test('Given goal misses of Delta, Review, and CRAP and no finding, when the metrics step runs, then a goal miss alone is no reason and each stage keeps its status', () => {
  const outcome = metricsOutcome({ changes, metrics: { outcomes: outcomesOf('goal miss', 'goal miss', 'goal miss', 'passed'), findings: [] } }, rules);

  assert.deepEqual(outcome, {
    reasons: [],
    lines: ['Delta: goal miss', 'Review: goal miss', 'CRAP: goal miss', 'Architecture: passed', unchangedLine('0 findings')],
  });
});

test('Given a failed CRAP stage and an unavailable Architecture stage, when the metrics step runs, then each is a blocked reason of the required checks with its status', () => {
  const outcome = metricsOutcome({ changes, metrics: { outcomes: outcomesOf('passed', 'passed', 'failed', 'unavailable'), findings: [] } }, rules);

  assert.deepEqual(outcome.reasons, [
    { blocking: true, key: 'required_checks', fact: 'CRAP failed' },
    { blocking: true, key: 'required_checks', fact: 'Architecture unavailable' },
  ]);
  assert.deepEqual(outcome.lines.slice(2), ['CRAP: failed', 'Architecture: unavailable', unchangedLine('0 findings')]);
});

test('Given a Review stage that did not complete, when the metrics step runs, then the section says that the findings were not read', () => {
  const outcome = metricsOutcome({ changes, metrics: { outcomes: outcomesOf('passed', 'failed', 'unavailable', 'unavailable') } }, rules);

  assert.deepEqual(outcome.reasons.map((reason) => reason.fact), ['Review failed', 'CRAP unavailable', 'Architecture unavailable']);
  assert.deepEqual(outcome.lines, ['Delta: passed', 'Review: failed', 'CRAP: unavailable', 'Architecture: unavailable', 'findings not read: the Review stage did not complete']);
});

test('Given high findings on a changed and on a renamed production file, when the metrics step runs, then each is an T1 reason with its file and message', () => {
  const outcome = findingsOutcome([
    { severity: 'high', file: 'src/a.ts', message: lowMi },
    { severity: 'high', file: 'src/b.ts', message: 'Maintainability index: 90 -> 80 (below 85 is hard to maintain)' },
  ]);

  assert.deepEqual(outcome.reasons, [
    { tier: 'T1', key: 'ratchet.review_findings', fact: `src/a.ts: ${lowMi}` },
    { tier: 'T1', key: 'ratchet.review_findings', fact: 'src/b.ts: Maintainability index: 90 -> 80 (below 85 is hard to maintain)' },
  ]);
  assert.deepEqual(outcome.lines.slice(4), [unchangedLine('0 findings')]);
});

test('Given medium and low findings on a changed production file, when the metrics step runs, then they give no reason and no count', () => {
  const outcome = findingsOutcome([
    { severity: 'medium', file: 'src/a.ts', message: 'Too many Lines of code (198 > 150)' },
    { severity: 'low', file: 'src/zzz.ts', message: 'Efferent coupling too high: got 11 (max: 10)' },
  ]);

  assert.deepEqual(outcome, { reasons: [], lines: ['Delta: passed', 'Review: goal miss', 'CRAP: passed', 'Architecture: passed', unchangedLine('0 findings')] });
});

test('Given high findings on a changed test file and on unchanged files, when the metrics step runs, then the test file has a line without a reason and the unchanged files are counted', () => {
  const outcome = findingsOutcome([
    { severity: 'high', file: 'test/a.test.ts', message: lowMi },
    { severity: 'high', file: 'src/c.ts', message: lowMi },
    { severity: 'high', file: 'src/d.ts', message: lowMi },
  ]);

  assert.deepEqual(outcome.reasons, []);
  assert.deepEqual(outcome.lines.slice(4), [`outside scopes.production: test/a.test.ts: ${lowMi}`, unchangedLine('2 findings')]);
});

test('Given one high finding on an unchanged file, when the metrics step runs, then the count names one finding', () => {
  assert.deepEqual(findingsOutcome([{ severity: 'high', file: 'src/c.ts', message: lowMi }]).lines.at(-1), unchangedLine('1 finding'));
});
