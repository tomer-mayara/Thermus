import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { ratchetOutcome } = await import(new URL('ratchet.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/ratchet.ts');

type RawValues = Readonly<Record<string, number | undefined>>;
type Change = { readonly status: string; readonly oldPath?: string; readonly path: string };

const rules = { scopes: { production: ['src/**'], generated: [] }, maintainability: { newFileBelow: 85, existingFileDropReadAt: 5 } };
const newKey = 'ratchet.maintainability_index.new_file_below';
const dropKey = 'ratchet.maintainability_index.existing_file_drop_read_at';
const today = '2026-10-21';

function outcomeOf(changes: readonly Change[], values: { readonly base?: RawValues; readonly head?: RawValues; readonly exceptions?: string } = {}) {
  const snapshots = values.base === undefined ? undefined : { base: new Map(Object.entries(values.base)), head: new Map(Object.entries(values.head ?? {})) };
  return ratchetOutcome({ changes, snapshots, exceptions: values.exceptions, today }, rules);
}

function exceptionsFile(bound: number, expires: string): string {
  return `exceptions:\n  - path: src/new.ts\n    metric: mi\n    bound: ${bound}\n    reason: One table of rules.\n    expires: ${expires}\n`;
}

test('Given no snapshots, when the MI rules run, then the MI section says that they were not checked and no MI reason fires', () => {
  assert.deepEqual(outcomeOf([{ status: 'A', path: 'src/new.ts' }]), { reasons: [], lines: ['not checked: give --base-snapshot and --head-snapshot'] });
});

test('Given new production files around the limit, when the MI rules run, then a raw value below 85 is FIX with the exact value and a value at 85 is no reason', () => {
  const changes = [{ status: 'A', path: 'src/even.ts' }, { status: 'A', path: 'src/low.ts' }, { status: 'A', path: 'src/near.ts' }];
  const outcome = outcomeOf(changes, { base: {}, head: { 'src/even.ts': 85, 'src/low.ts': 84.96, 'src/near.ts': 84.99999999999999 } });

  assert.deepEqual(outcome.reasons, [
    { route: 'FIX', key: newKey, fact: 'src/low.ts: 84.96' },
    { route: 'FIX', key: newKey, fact: 'src/near.ts: 84.99999999999999' },
  ]);
  assert.deepEqual(outcome.lines, ['new: src/even.ts: 85', 'new: src/low.ts: 84.96', 'new: src/near.ts: 84.99999999999999']);
});

test('Given changed production files, when the MI rules run, then a raw drop of five or more is ARCHITECT_REVIEW_NEEDED with both exact values, and a smaller drop or a rise is no reason', () => {
  const changes = ['src/five.ts', 'src/less.ts', 'src/rise.ts', 'src/raw.ts', 'src/decimal.ts'].map((path) => ({ status: 'M', path }));
  const outcome = outcomeOf(changes, {
    base: { 'src/five.ts': 90, 'src/less.ts': 90, 'src/rise.ts': 70, 'src/raw.ts': 61.17474697614129, 'src/decimal.ts': 66.1 },
    head: { 'src/five.ts': 85, 'src/less.ts': 85.1, 'src/rise.ts': 80, 'src/raw.ts': 56.17474697614129, 'src/decimal.ts': 61.1 },
  });

  assert.deepEqual(outcome.reasons, [
    { route: 'ARCHITECT_REVIEW_NEEDED', key: dropKey, fact: 'src/five.ts: 90 to 85' },
    { route: 'ARCHITECT_REVIEW_NEEDED', key: dropKey, fact: 'src/raw.ts: 61.17474697614129 to 56.17474697614129' },
    { route: 'ARCHITECT_REVIEW_NEEDED', key: dropKey, fact: 'src/decimal.ts: 66.1 to 61.1' },
  ]);
  assert.deepEqual(outcome.lines, [
    'changed: src/five.ts: 90 to 85', 'changed: src/less.ts: 90 to 85.1', 'changed: src/rise.ts: 70 to 80', 'changed: src/raw.ts: 61.17474697614129 to 56.17474697614129',
    'changed: src/decimal.ts: 66.1 to 61.1',
  ]);
});

test('Given renames inside, into, and out of the production scope, when the MI rules run, then each compares the old path in the base with the new path in the head', () => {
  const changes = [
    { status: 'R', oldPath: 'src/old.ts', path: 'src/new-name.ts' },
    { status: 'R', oldPath: 'tools/moved.ts', path: 'src/moved.ts' },
    { status: 'R', oldPath: 'src/gone.ts', path: 'tools/gone.ts' },
  ];
  const outcome = outcomeOf(changes, { base: { 'src/old.ts': 90, 'src/gone.ts': 88 }, head: { 'src/new-name.ts': 84, 'src/moved.ts': 70 } });

  assert.deepEqual(outcome.reasons, [{ route: 'ARCHITECT_REVIEW_NEEDED', key: dropKey, fact: 'src/old.ts -> src/new-name.ts: 90 to 84' }]);
  assert.deepEqual(outcome.lines, [
    'changed: src/old.ts -> src/new-name.ts: 90 to 84',
    'not applicable: tools/moved.ts -> src/moved.ts: no raw MI in the base snapshot',
    'not applicable: src/gone.ts -> tools/gone.ts: no raw MI in the head snapshot',
  ]);
});

test('Given files without raw MI in the snapshot that each needs, a deleted file, and files outside the production scope, when the MI rules run, then only the production files that exist at HEAD get a line', () => {
  const changes = [
    { status: 'A', path: 'src/types.ts' }, { status: 'M', path: 'src/a.ts' }, { status: 'M', path: 'src/b.ts' },
    { status: 'D', path: 'src/deleted.ts' }, { status: 'A', path: 'test/new.test.ts' }, { status: 'M', path: 'docs/guide.md' },
  ];
  const outcome = outcomeOf(changes, { base: { 'src/a.ts': 90, 'src/deleted.ts': 40 }, head: { 'src/types.ts': undefined, 'src/b.ts': 60, 'test/new.test.ts': 10 } });

  assert.deepEqual(outcome.reasons, []);
  assert.deepEqual(outcome.lines, [
    'not applicable: src/types.ts: no raw MI in the head snapshot',
    'not applicable: src/a.ts: no raw MI in the head snapshot',
    'not applicable: src/b.ts: no raw MI in the base snapshot',
  ]);
});

test('Given an exception entry for a new file below the limit, when its raw MI is at its bound and today is its expiry date, then the FIX becomes an ARCHITECT_REVIEW_NEEDED reason that names the entry', () => {
  const outcome = outcomeOf([{ status: 'A', path: 'src/new.ts' }], { base: {}, head: { 'src/new.ts': 80 }, exceptions: exceptionsFile(80, today) });

  assert.deepEqual(outcome.reasons, [{ route: 'ARCHITECT_REVIEW_NEEDED', key: 'ratchet.exceptions', fact: 'src/new.ts covered by "One table of rules." until 2026-10-21' }]);
  assert.deepEqual(outcome.lines, ['new: src/new.ts: 80']);
});

test('Given an exception entry with a bound above the raw MI, when the MI rules run, then the FIX stays', () => {
  const outcome = outcomeOf([{ status: 'A', path: 'src/new.ts' }], { base: {}, head: { 'src/new.ts': 79.9 }, exceptions: exceptionsFile(80, '2026-12-31') });

  assert.deepEqual(outcome.reasons, [{ route: 'FIX', key: newKey, fact: 'src/new.ts: 79.9' }]);
});

test('Given an exception entry that expired yesterday, when the MI rules run with or without snapshots, then the expired entry of the changed file is FIX after the MI reasons', () => {
  const changes = [{ status: 'A', path: 'src/new.ts' }];
  const exceptions = exceptionsFile(80, '2026-10-20');

  assert.deepEqual(outcomeOf(changes, { base: {}, head: { 'src/new.ts': 82 }, exceptions }).reasons, [
    { route: 'FIX', key: newKey, fact: 'src/new.ts: 82' },
    { route: 'FIX', key: 'ratchet.exceptions.expired', fact: 'src/new.ts' },
  ]);
  assert.deepEqual(outcomeOf(changes, { exceptions }).reasons, [{ route: 'FIX', key: 'ratchet.exceptions.expired', fact: 'src/new.ts' }]);
  assert.deepEqual(outcomeOf([{ status: 'M', path: 'src/other.ts' }], { exceptions }).reasons, []);
});

test('Given an exceptions file that is not valid, when the MI rules run, then they stop with the diagnostic of the file', () => {
  assert.throws(() => outcomeOf([], { exceptions: 'exceptions: {}\n' }), {
    message: 'The exceptions file .code-quality-exceptions.yaml at HEAD has no valid key exceptions: give a list of entries.',
  });
});
