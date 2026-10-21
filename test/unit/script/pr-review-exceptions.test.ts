import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { prReviewCheckScript } from '../../support/processes/module-paths.ts';

const { coveringCrapException, coveringException, exceptionsOf, expiredReasons } = await import(new URL('exceptions.ts', pathToFileURL(prReviewCheckScript)).href) as typeof import('../../../script/pr-review/exceptions.ts');

const where = 'The exceptions file .code-quality-exceptions.yaml at HEAD';
const entry = { path: 'src/a.ts', bound: 80, reason: 'One table of rules.', expires: '2026-12-31' };

function fileOf(fields: Readonly<Record<string, unknown>>): string {
  const lines = Object.entries(fields).map(([name, value], index) => `${index === 0 ? '  - ' : '    '}${name}: ${JSON.stringify(value)}`);
  return ['exceptions:', ...lines, ''].join('\n');
}

test('Given no exceptions file, when it is read, then there is no entry', () => {
  assert.deepEqual(exceptionsOf(undefined), []);
});

test('Given entries with every field and an unknown field, when the file is read, then each entry keeps its path, bound, reason, and expiry', () => {
  const text = [
    'exceptions:',
    '  - path: src/a.ts', '    metric: mi', '    bound: 80', '    reason: One table of rules.', '    expires: 2026-12-31', '    owner: someone',
    '  - path: src/b.ts', '    metric: mi', '    bound: 72.5', '    reason: A generated parser.', '    expires: 2024-02-29',
    '',
  ].join('\n');

  assert.deepEqual(exceptionsOf(text), [entry, { path: 'src/b.ts', bound: 72.5, reason: 'A generated parser.', expires: '2024-02-29' }]);
  assert.deepEqual(exceptionsOf('exceptions: []\n'), []);
});

for (const [name, text, message] of [
  ['an empty file', '', 'exceptions: give a list of entries'],
  ['a map of entries', 'exceptions:\n  a: 1\n', 'exceptions: give a list of entries'],
  ['an entry that is a text', 'exceptions:\n  - src/a.ts\n', 'exceptions[0].path: give a non-empty text'],
  ['an empty path', fileOf({ path: '', metric: 'mi', bound: 80, reason: 'r', expires: '2026-12-31' }), 'exceptions[0].path: give a non-empty text'],
  ['another metric', fileOf({ path: 'src/a.ts', metric: 'crap', bound: 80, reason: 'r', expires: '2026-12-31' }), 'exceptions[0].metric: give mi'],
  ['a bound that is a text', fileOf({ path: 'src/a.ts', metric: 'mi', bound: '80', reason: 'r', expires: '2026-12-31' }), 'exceptions[0].bound: give a finite number'],
  ['a reason of spaces', fileOf({ path: 'src/a.ts', metric: 'mi', bound: 80, reason: '  ', expires: '2026-12-31' }), 'exceptions[0].reason: give a non-empty text'],
  ['no expiry', fileOf({ path: 'src/a.ts', metric: 'mi', bound: 80, reason: 'r' }), 'exceptions[0].expires: give a date as YYYY-MM-DD'],
  ['an expiry with a time', fileOf({ path: 'src/a.ts', metric: 'mi', bound: 80, reason: 'r', expires: '2026-12-31T00:00' }), 'exceptions[0].expires: give a date as YYYY-MM-DD'],
  ['an expiry that is not a calendar date', fileOf({ path: 'src/a.ts', metric: 'mi', bound: 80, reason: 'r', expires: '2025-02-29' }), 'exceptions[0].expires: give a date as YYYY-MM-DD'],
  ['an expiry month of 13', fileOf({ path: 'src/a.ts', metric: 'mi', bound: 80, reason: 'r', expires: '2026-13-01' }), 'exceptions[0].expires: give a date as YYYY-MM-DD'],
  ['a function and a path', fileOf({ function: 'src/a.ts#run', path: 'src/a.ts', metric: 'crap', bound: 20, reason: 'r', expires: '2026-12-31' }), 'exceptions[0]: give path or function, not both'],
  ['a function without a file', fileOf({ function: 'run', metric: 'crap', bound: 20, reason: 'r', expires: '2026-12-31' }), 'exceptions[0].function: give a text of the form <file>#<function>'],
  ['a function without a name', fileOf({ function: 'src/a.ts#', metric: 'crap', bound: 20, reason: 'r', expires: '2026-12-31' }), 'exceptions[0].function: give a text of the form <file>#<function>'],
  ['a function with the metric mi', fileOf({ function: 'src/a.ts#run', metric: 'mi', bound: 20, reason: 'r', expires: '2026-12-31' }), 'exceptions[0].metric: give crap'],
  ['a function with a bound that is a text', fileOf({ function: 'src/a.ts#run', metric: 'crap', bound: '20', reason: 'r', expires: '2026-12-31' }), 'exceptions[0].bound: give a finite number'],
  ['a function without an expiry', fileOf({ function: 'src/a.ts#run', metric: 'crap', bound: 20, reason: 'r' }), 'exceptions[0].expires: give a date as YYYY-MM-DD'],
] as const) {
  test(`Given an exceptions file with ${name}, when it is read, then the diagnostic names the entry and the field`, () => {
    assert.throws(() => exceptionsOf(text), { message: `${where} has no valid key ${message}.` });
  });
}

test('Given entries for a file and for functions, when the file is read, then each function entry keeps its function, bound, reason, and expiry', () => {
  const text = [
    'exceptions:',
    '  - path: src/a.ts', '    metric: mi', '    bound: 80', '    reason: One table of rules.', '    expires: 2026-12-31',
    '  - function: src/a.ts#Parser.#read', '    metric: crap', '    bound: 20.5', '    reason: A large switch.', '    expires: 2026-11-30',
    '',
  ].join('\n');

  assert.deepEqual(exceptionsOf(text), [entry, { function: 'src/a.ts#Parser.#read', bound: 20.5, reason: 'A large switch.', expires: '2026-11-30' }]);
});

test('Given an exceptions file with a bound of infinity in the second entry, when it is read, then the diagnostic names that entry', () => {
  const text = `${fileOf({ path: 'src/a.ts', metric: 'mi', bound: 80, reason: 'r', expires: '2026-12-31' })}  - path: src/b.ts\n    metric: mi\n    bound: .inf\n`;

  assert.throws(() => exceptionsOf(text), { message: `${where} has no valid key exceptions[1].bound: give a finite number.` });
});

test('Given text that is not valid YAML, when the exceptions file is read, then the diagnostic says so', () => {
  assert.throws(() => exceptionsOf('exceptions: [a\n'), (error: Error) => {
    assert.match(error.message, /^The exceptions file \.code-quality-exceptions\.yaml at HEAD is not valid YAML: \S/);
    return true;
  });
});

test('Given an entry for a file, when a raw MI is compared with it, then it covers a value at or above its bound up to and on its expiry date', () => {
  const second = { ...entry, bound: 70, expires: '2027-06-30' };

  assert.equal(coveringException([entry], { path: 'src/a.ts', raw: 80, today: '2026-12-31' }), entry);
  assert.equal(coveringException([entry], { path: 'src/a.ts', raw: 79.99, today: '2026-10-21' }), undefined);
  assert.equal(coveringException([entry], { path: 'src/a.ts', raw: 84, today: '2027-01-01' }), undefined);
  assert.equal(coveringException([entry], { path: 'src/b.ts', raw: 84, today: '2026-10-21' }), undefined);
  assert.equal(coveringException([entry, second], { path: 'src/a.ts', raw: 75, today: '2026-10-21' }), second);
});

test('Given a function entry, when a CRAP value is compared with it, then it covers a value within its bound up to and on its expiry date, and an entry for a file covers no function', () => {
  const crapEntry = { function: 'src/a.ts#run', bound: 20, reason: 'A large switch.', expires: '2026-12-31' };
  const within = (limit: number) => (bound: number) => limit <= bound;

  assert.equal(coveringCrapException([entry, crapEntry], { function: 'src/a.ts#run', today: '2026-12-31', within: within(20) }), crapEntry);
  assert.equal(coveringCrapException([crapEntry], { function: 'src/a.ts#run', today: '2026-10-21', within: within(20.5) }), undefined);
  assert.equal(coveringCrapException([crapEntry], { function: 'src/a.ts#run', today: '2027-01-01', within: within(12) }), undefined);
  assert.equal(coveringCrapException([crapEntry], { function: 'src/a.ts#other', today: '2026-10-21', within: within(12) }), undefined);
  assert.equal(coveringCrapException([entry], { function: 'src/a.ts', today: '2026-10-21', within: within(12) }), undefined);
  assert.equal(coveringException([crapEntry], { path: 'src/a.ts#run', raw: 84, today: '2026-10-21' }), undefined);
});

test('Given an expired function entry, when the changed paths are compared, then it is FIX when the file of its function changed', () => {
  const crapEntry = { function: 'src/a.ts#run', bound: 20, reason: 'A large switch.', expires: '2026-12-31' };

  assert.deepEqual(expiredReasons([crapEntry, entry], ['src/a.ts'], '2027-01-01'), [
    { route: 'FIX', key: 'ratchet.exceptions.expired', fact: 'src/a.ts#run' },
    { route: 'FIX', key: 'ratchet.exceptions.expired', fact: 'src/a.ts' },
  ]);
  assert.deepEqual(expiredReasons([crapEntry], ['src/b.ts'], '2027-01-01'), []);
});

test('Given entries that expired before today, when the changed paths are compared, then each expired entry of a changed path is FIX once', () => {
  const entries = [entry, { ...entry, bound: 70 }, { ...entry, path: 'src/b.ts' }, { ...entry, path: 'src/c.ts', expires: '2027-01-01' }];

  assert.deepEqual(expiredReasons(entries, ['src/a.ts', 'src/c.ts', 'docs/x.md'], '2027-01-01'), [{ route: 'FIX', key: 'ratchet.exceptions.expired', fact: 'src/a.ts' }]);
  assert.deepEqual(expiredReasons(entries, ['src/a.ts'], '2026-12-31'), []);
});
