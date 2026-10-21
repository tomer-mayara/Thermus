import type { CrapRow as Row } from '../../../script/pr-review/crap-rows.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { crapOutcome } = await import(new URL('crap.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/crap.ts');

type Change = { readonly status: string; readonly oldPath?: string; readonly path: string };

const rules = { scopes: { production: ['src/**'], generated: [] }, crap: { newFunctionAbove: 15, changedLegacyFunctionAtOrAbove: 30 } };
const newKey = 'ratchet.crap.new_function_above';
const changedKey = 'ratchet.crap.changed_legacy_function_at_or_above';
const today = '2026-10-21';
const added: Change[] = [{ status: 'A', path: 'src/a.ts' }];

function outcomeOf(rows: readonly Row[] | undefined, values: { readonly changes?: readonly Change[]; readonly exceptions?: string } = {}) {
  return crapOutcome({ changes: values.changes ?? added, crap: rows, exceptions: values.exceptions, today }, rules);
}

function exceptionsFile(bound: number, expires: string): string {
  return `exceptions:\n  - function: src/a.ts#run\n    metric: crap\n    bound: ${bound}\n    reason: A large switch.\n    expires: ${expires}\n`;
}

function row(change: Row['change'], paths: number, share?: number): Row {
  return share === undefined ? { file: 'src/a.ts', function: 'run', change, paths } : { file: 'src/a.ts', function: 'run', change, paths, share };
}

test('Given no CRAP rows, when the CRAP rules run, then the CRAP section says that they were not checked and no CRAP reason fires', () => {
  assert.deepEqual(outcomeOf(undefined), { reasons: [], lines: ['not checked: give --crap'] });
});

for (const [paths, line, fact] of [
  [0, 'src/a.ts: run: pass from the bound [0, 0]', undefined],
  [3, 'src/a.ts: run: pass from the bound [3, 12]', undefined],
  [4, undefined, 'src/a.ts: run: [4, 20]'],
  [16, undefined, 'src/a.ts: run: [16, 272]'],
] as const) {
  test(`Given a new function with ${paths} paths and no covered share, when the CRAP rules run, then the bounds decide the goal of 15`, () => {
    assert.deepEqual(outcomeOf([row('new', paths)]), { reasons: fact === undefined ? [] : [{ route: 'FIX', key: newKey, fact }], lines: line === undefined ? [] : [line] });
  });
}

for (const [paths, line, fact] of [
  [4, 'src/a.ts: run: pass from the bound [4, 20]', undefined],
  [5, undefined, 'src/a.ts: run: [5, 30]'],
  [30, undefined, 'src/a.ts: run: [30, 930]'],
] as const) {
  test(`Given a changed function with ${paths} paths and no covered share, when the CRAP rules run, then the bounds decide the goal below 30`, () => {
    assert.deepEqual(outcomeOf([row('changed', paths)]), { reasons: fact === undefined ? [] : [{ route: 'FIX', key: changedKey, fact }], lines: line === undefined ? [] : [line] });
  });
}

test('Given functions with known coverage near their goals, when the CRAP rules run, then the exact operands decide and the value shows the side of the goal', () => {
  const outcome = outcomeOf([
    row('new', 15, 1), row('new', 15, 0.9999999), row('unknown', 4, 0),
    row('changed', 5, 0.0000133), row('changed', 5, 1e-320), row('changed', 5, 0),
  ]);

  assert.deepEqual(outcome.reasons, [
    { route: 'FIX', key: newKey, fact: 'src/a.ts: run: > 15' },
    { route: 'FIX', key: newKey, fact: 'src/a.ts: run: 20.0' },
    { route: 'FIX', key: changedKey, fact: 'src/a.ts: run: 30.0' },
  ]);
  assert.deepEqual(outcome.lines, ['src/a.ts: run: 15.0', 'src/a.ts: run: 29.999002513266692', 'src/a.ts: run: < 30']);
});

test('Given rows of unchanged functions, of unchanged and deleted files, and of files outside the production scope, when the CRAP rules run, then only the new or changed functions of changed production files count', () => {
  const changes = [
    { status: 'M', path: 'src/a.ts' }, { status: 'D', path: 'src/deleted.ts' }, { status: 'M', path: 'tools/x.ts' },
    { status: 'R', oldPath: 'src/old.ts', path: 'src/moved.ts' },
  ];
  const rows: Row[] = [
    { file: 'src/a.ts', function: 'old', change: 'unchanged', paths: 35, share: 1 },
    { file: 'src/deleted.ts', function: 'gone', change: 'new', paths: 20 },
    { file: 'src/b.ts', function: 'other', change: 'new', paths: 20 },
    { file: 'tools/x.ts', function: 'tool', change: 'new', paths: 20 },
    { file: 'src/old.ts', function: 'before', change: 'changed', paths: 40 },
    { file: 'src/moved.ts', function: 'after', change: 'changed', paths: 40 },
  ];

  assert.deepEqual(outcomeOf(rows, { changes }), { reasons: [{ route: 'FIX', key: changedKey, fact: 'src/moved.ts: after: [40, 1640]' }], lines: [] });
});

for (const [name, rows, exceptions, route] of [
  ['an upper bound at the bound of the entry', [row('new', 4)], exceptionsFile(20, '2026-12-31'), 'ARCHITECT_REVIEW_NEEDED'],
  ['an upper bound above the bound of the entry', [row('new', 4)], exceptionsFile(19.5, '2026-12-31'), 'FIX'],
  ['an entry that expires today', [row('new', 4)], exceptionsFile(20, today), 'ARCHITECT_REVIEW_NEEDED'],
  ['an entry that expired yesterday', [row('new', 4)], exceptionsFile(20, '2026-10-20'), 'FIX'],
  ['an exact value just above the bound of the entry', [row('new', 15, 0.9999999)], exceptionsFile(15, '2026-12-31'), 'FIX'],
  ['an exact value just below the bound of the entry', [row('new', 15, 0.9999999)], exceptionsFile(15.000001, '2026-12-31'), 'ARCHITECT_REVIEW_NEEDED'],
  ['an entry of another function', [{ ...row('new', 4), function: 'other' }], exceptionsFile(20, '2026-12-31'), 'FIX'],
] as const) {
  test(`Given a CRAP miss and ${name}, when the CRAP rules run, then the route of the reason is ${route}`, () => {
    const [reason] = outcomeOf(rows, { exceptions }).reasons;

    assert.equal(reason.route, route);
    if (route === 'ARCHITECT_REVIEW_NEEDED') assert.match(reason.fact, /^src\/a\.ts#run: \S.* covered by "A large switch\." until \d{4}-\d{2}-\d{2}$/);
  });
}

test('Given an exception entry that covers a miss of four paths, when the CRAP rules run, then the ARCHITECT_REVIEW_NEEDED reason names the entry and the range', () => {
  assert.deepEqual(outcomeOf([row('new', 4)], { exceptions: exceptionsFile(20, '2026-12-31') }).reasons, [
    { route: 'ARCHITECT_REVIEW_NEEDED', key: 'ratchet.exceptions', fact: 'src/a.ts#run: [4, 20] covered by "A large switch." until 2026-12-31' },
  ]);
});
