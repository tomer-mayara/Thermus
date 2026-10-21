import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { sizeOutcome } = await import(new URL('size.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/size.ts');

const rules = { scopes: { generated: ['docs/metrics/**', 'pnpm-lock.yaml'] }, limits: { production: 400, total: 1500 } };
const nothing = { numstat: [], productionNumstat: [], testDiff: '' };

test('Given the numstat of the whole tree and the numstat of the production scope, when the lines are counted, then production sums its own numstat and the total leaves out generated files', () => {
  const numstat = [
    { added: 10, deleted: 2, paths: ['src/a.ts'] },
    { added: 0, deleted: 0, paths: ['tools/moved.ts', 'src/moved.ts'] },
    { added: 200, deleted: 0, paths: ['docs/metrics/2026-10-20-x.json'] },
    { added: 50, deleted: 50, paths: ['pnpm-lock.yaml'] },
    { added: 4, deleted: 1, paths: ['test/a.test.ts'] },
  ];
  const productionNumstat = [{ added: 10, deleted: 2, paths: ['src/a.ts'] }, { added: 30, deleted: 0, paths: ['src/moved.ts'] }];

  assert.deepEqual(sizeOutcome({ ...nothing, numstat, productionNumstat }, rules).counts, { production: 42, total: 17 });
});

test('Given counts above the limits, when the size reasons are made, then each is ARCHITECT_REVIEW_NEEDED with the count and the limit, and a count at the limit is no reason', () => {
  const above = sizeOutcome({ ...nothing, productionNumstat: [{ added: 401, deleted: 0, paths: ['src/a.ts'] }], numstat: [{ added: 1501, deleted: 0, paths: ['src/a.ts'] }] }, rules);
  const at = sizeOutcome({ ...nothing, productionNumstat: [{ added: 400, deleted: 0, paths: ['src/a.ts'] }], numstat: [{ added: 1500, deleted: 0, paths: ['src/a.ts'] }] }, rules);

  assert.deepEqual(above.reasons, [
    { route: 'ARCHITECT_REVIEW_NEEDED', key: 'size.production_lines_read_above', fact: '401 production lines, above the limit of 400' },
    { route: 'ARCHITECT_REVIEW_NEEDED', key: 'size.total_lines_read_above', fact: '1501 lines without generated files, above the limit of 1500' },
  ]);
  assert.deepEqual(at.reasons, []);
});

test('Given a test diff with a removed case, when the size outcome is made, then it holds the test counts and their reasons', () => {
  const testDiff = ['diff --git test/a.test.ts test/a.test.ts', '--- test/a.test.ts', '+++ test/a.test.ts', '@@ -1 +0,0 @@', "-test('one', () => {});", ''].join('\n');
  const outcome = sizeOutcome({ ...nothing, testDiff }, rules);

  assert.deepEqual(outcome.tests, { added: 0, removedCases: ["test/a.test.ts: test('one', () => {});"], skippedOrTodo: [] });
  assert.deepEqual(outcome.reasons, [{ route: 'ARCHITECT_REVIEW_NEEDED', key: 'size.test_counts', fact: "test/a.test.ts: test('one', () => {});" }]);
});

test('Given the snooze file of habit-hooks, when it is not an empty list, then the reason is FIX', () => {
  const fix = [{ route: 'FIX', key: 'size.habit_hooks_snooze_non_empty', fact: '.habit-hooks/snooze.json is not []' }];
  const reasonsFor = (snooze?: string) => sizeOutcome({ ...nothing, snooze }, rules).reasons;

  assert.deepEqual(reasonsFor('[]\n'), []);
  assert.deepEqual(reasonsFor(undefined), []);
  assert.deepEqual(reasonsFor('[{"rule": "complexity"}]'), fix);
  assert.deepEqual(reasonsFor('not json'), fix);
  assert.deepEqual(reasonsFor('{}'), fix);
});
