import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsBackfillScript } from '../../support/processes/module-paths.ts';

const moduleAt = (path: string) => new URL(path, pathToFileURL(astMetricsBackfillScript)).href;
const { commandOf } = await import(moduleAt('backfill/command-line.ts')) as typeof import('../../../script/code-quality/backfill/command-line.ts');
const { trendGapLinesOf } = await import(moduleAt('architecture/trend-gaps.ts')) as typeof import('../../../script/code-quality/architecture/trend-gaps.ts');
const commit = (value: number) => value.toString(16).repeat(40);

test('Given a backfill command, when arguments are parsed, then count is a positive safe integer and help is resolved before count validation', () => {
  assert.deepEqual(commandOf([]), { kind: 'backfill', count: 10, allowToolVersion: false });
  assert.deepEqual(commandOf(['--count', '3', '--allow-tool-version']), { kind: 'backfill', count: 3, allowToolVersion: true });
  assert.deepEqual(commandOf(['--help', '--count', '0']), { kind: 'help' });
  for (const count of ['0', '-1', '1.5', '1e2', '9007199254740992', '']) assert.throws(() => commandOf([`--count=${count}`]), /positive safe integer/u);
  assert.throws(() => commandOf(['--unknown']), /Invalid arguments/u);
});

test('Given records out of date order, when first-parent history proves two separate gaps, then each gap has one line and full identities determine membership', () => {
  const history = { kind: 'available', commits: [7, 6, 5, 4, 3, 2, 1].map(commit) } as const;
  const lines = trendGapLinesOf(history, [7, 2, 5, 1].map((value) => ({ commit: commit(value) })));
  assert.deepEqual(lines, [
    '2 commits of main between 22222222 and 55555555 have no record.',
    '1 commits of main between 55555555 and 77777777 have no record.',
  ]);
});

test('Given unavailable history or offline snapshot input, when gaps are requested, then the report states why omitted commits cannot be checked', () => {
  assert.deepEqual(trendGapLinesOf({ kind: 'unavailable', reason: 'origin/main is missing.' }, []), ['Gap check unavailable: origin/main is missing.']);
  assert.deepEqual(trendGapLinesOf(undefined, []), ['Gap check unavailable: offline snapshot dates cannot prove omitted commits.']);
});

test('Given a record omitted by display date ordering, when gaps are checked, then its full identity prevents a false gap', () => {
  const history = { kind: 'available', commits: [5, 4, 3, 2, 1].map(commit) } as const;
  const displayed = [1, 5].map((value) => ({ commit: commit(value) }));
  const stored = [1, 2, 3, 4, 5].map((value) => ({ commit: commit(value) }));
  assert.deepEqual(trendGapLinesOf(history, displayed, stored), []);
});

test('Given full identities with the same eight-character prefix, when a record has the wrong suffix, then it does not fill a first-parent gap', () => {
  const middle = `${'a'.repeat(8)}${'b'.repeat(32)}`;
  const history = { kind: 'available', commits: [commit(3), middle, commit(1)] } as const;
  const records = [{ commit: commit(1) }, { commit: commit(3) }, { commit: `${'a'.repeat(8)}${'c'.repeat(32)}` }];
  assert.deepEqual(trendGapLinesOf(history, records), [
    'Gap check cannot place 1 displayed record on first-parent origin/main.',
    '1 commits of main between 11111111 and 33333333 have no record.',
  ]);
});

test('Given unrecorded commits outside displayed endpoints, when gaps render, then the check is bounded to those endpoints', () => {
  const history = { kind: 'available', commits: [5, 4, 3, 2, 1].map(commit) } as const;
  assert.deepEqual(trendGapLinesOf(history, [{ commit: commit(4) }, { commit: commit(2) }]), ['1 commits of main between 22222222 and 44444444 have no record.']);
});
