import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

// The rules of the complexity table: the cells of a row, the risk rank, the section without a production file, and,
// with coverage, the CRAP column and the list of the functions after the table. The table is pure, so the cases call it
// in the test process. Its module runs from source next to the command, as the command runs it. The types give the
// parts of the contract that the cases use.
interface File {
  readonly path: string;
  readonly maintainability?: number;
  readonly paths?: number;
  readonly risk?: number;
  readonly functions?: readonly { readonly name: string; readonly paths: number }[];
}

interface Sources {
  readonly base: { readonly files: readonly File[] };
  readonly head: { readonly files: readonly File[] };
  readonly touched: readonly string[];
  readonly coverage?: { readonly files: readonly { readonly path: string; readonly functions: readonly { readonly name: string; readonly coveredShare: number }[] }[] };
}

// The delta of the CRAP of the two snapshots, which the table gets from the report.
type CrapDelta = object;

const scriptFolder = pathToFileURL(astMetricsArchitectureScript);
const { complexityTableOf } = await import(new URL('ast-metrics-architecture-table.ts', scriptFolder).href) as {
  complexityTableOf(sources: Sources, delta?: CrapDelta): string[];
};
const { crapDeltaOf } = await import(new URL('ast-metrics-architecture-crap-delta.ts', scriptFolder).href) as {
  crapDeltaOf(sources: Sources): CrapDelta | undefined;
};

// The rows of the table, without its heading and its two head rows.
function rowsOf(base: readonly File[], head: readonly File[], touched: readonly string[]): string[] {
  return complexityTableOf({ base: { files: base }, head: { files: head }, touched }).slice(4);
}

test('Given a changed file under src/, when the table is made, then the section is the heading, an empty line, the head row, the separator row, and one row with a cell for each column', () => {
  const lines = complexityTableOf({ base: { files: [{ path: 'src/a.ts', maintainability: 70, paths: 5 }] }, head: { files: [{ path: 'src/a.ts', maintainability: 70, paths: 5 }] }, touched: ['src/a.ts'] });

  assert.deepEqual(lines, [
    '## Complexity of the changed files',
    '',
    '| File | Maintainability | Decision paths | Risk rank |',
    '| --- | --- | --- | --- |',
    '| src/a.ts | 70.0 → 70.0 | 5 → 5 | |',
  ]);
});

test('Given changes of maintainability and decision paths, when the table is made, then each cell is base → head with one decimal for maintainability and an integer for paths, and the arrow and the size of a change that does not round to zero', () => {
  const base = [
    { path: 'src/fell.ts', maintainability: 72, paths: 12 },
    { path: 'src/rose.ts', maintainability: 70, paths: 7 },
    { path: 'src/small.ts', maintainability: 55.5, paths: 3 },
    { path: 'src/tiny.ts', maintainability: 60.04, paths: 3 },
  ];
  const head = [
    { path: 'src/fell.ts', maintainability: 60, paths: 15 },
    { path: 'src/rose.ts', maintainability: 72.25, paths: 5 },
    { path: 'src/small.ts', maintainability: 55.1, paths: 3 },
    { path: 'src/tiny.ts', maintainability: 60, paths: 3 },
  ];

  const rows = rowsOf(base, head, base.map((file) => file.path));

  assert.deepEqual(rows, [
    '| src/fell.ts | 72.0 → 60.0 ↓12.0 | 12 → 15 ↑3 | |',
    '| src/rose.ts | 70.0 → 72.3 ↑2.3 | 7 → 5 ↓2 | |',
    '| src/small.ts | 55.5 → 55.1 ↓0.4 | 3 → 3 | |',
    '| src/tiny.ts | 60.0 → 60.0 | 3 → 3 | |',
  ]);
});

test('Given a file that only the head has and a file that only the base has, when the table is made, then the first says new before the values of the head and the second gone after the values of the base', () => {
  const rows = rowsOf([{ path: 'src/gone.ts', maintainability: 55, paths: 20 }], [{ path: 'src/new.ts', maintainability: 70.2, paths: 8 }], ['src/new.ts', 'src/gone.ts']);

  assert.deepEqual(rows, ['| src/gone.ts | 55.0 → gone | 20 → gone | |', '| src/new.ts | new → 70.2 | new → 8 | |']);
});

// A file without a maintainability index has no code, and its 0 decision paths are not a measurement.
test('Given files without a value on one side, when the table is made, then a head without maintainability is not measured in both columns, a head without paths in the paths column, a base without maintainability before the arrow, and a file that neither side has in both columns', () => {
  const base = [
    { path: 'src/emptied.ts', maintainability: 64, paths: 12 },
    { path: 'src/grown.ts', paths: 0 },
    { path: 'src/odd.ts', maintainability: 72, paths: 6 },
    { path: 'src/types-gone.ts', paths: 0 },
    { path: 'src/types.ts', paths: 0 },
  ];
  const head = [
    { path: 'src/emptied.ts', paths: 0 },
    { path: 'src/grown.ts', maintainability: 64, paths: 9 },
    { path: 'src/odd.ts', maintainability: 70 },
    { path: 'src/types-new.ts', paths: 0 },
    { path: 'src/types.ts', paths: 0 },
  ];

  const rows = rowsOf(base, head, ['src/emptied.ts', 'src/grown.ts', 'src/odd.ts', 'src/types-gone.ts', 'src/types-new.ts', 'src/types.ts', 'src/unknown.ts']);

  assert.deepEqual(rows, [
    '| src/emptied.ts | not measured | not measured | |',
    '| src/grown.ts | not measured → 64.0 | not measured → 9 | |',
    '| src/odd.ts | 72.0 → 70.0 ↓2.0 | not measured | |',
    '| src/types-gone.ts | not measured → gone | not measured → gone | |',
    '| src/types-new.ts | not measured | not measured | |',
    '| src/types.ts | not measured | not measured | |',
    '| src/unknown.ts | not measured | not measured | |',
  ]);
});

// Twelve files with the risk scores 1.2, 1.1, and so on down to 0.1: f01 is the riskiest and f12 the least risky.
const twelve = Array.from({ length: 12 }, (_, index) => ({ path: `src/f${String(index + 1).padStart(2, '0')}.ts`, maintainability: 70, paths: 5, risk: (12 - index) / 10 }));

test('Given twelve files of the head with a risk score, when the table is made, then a changed file among the ten riskiest has its position from 1, and the eleventh has no rank', () => {
  const rows = rowsOf(twelve, twelve, ['src/f01.ts', 'src/f03.ts', 'src/f10.ts', 'src/f11.ts']);

  assert.deepEqual(rows.map((row) => row.split(' | ').at(-1)), ['1 |', '3 |', '10 |', '|']);
});

test('Given files of the head with an equal risk score, when the table is made, then the first path ranks first, whatever the order of the snapshot', () => {
  const head = [{ path: 'src/b.ts', paths: 1, maintainability: 70, risk: 0.5 }, { path: 'src/a.ts', paths: 1, maintainability: 70, risk: 0.5 }, { path: 'src/c.ts', paths: 1, maintainability: 70, risk: 0.7 }];

  const rows = rowsOf(head, head, ['src/a.ts', 'src/b.ts', 'src/c.ts']);

  assert.deepEqual(rows.map((row) => row.split(' | ').at(-1)), ['2 |', '3 |', '1 |']);
});

test('Given a changed file without a risk score in the head, and a gone file with the highest risk score of the base, when the table is made, then neither has a rank, also when fewer than ten files have a score', () => {
  const base = [{ path: 'src/gone.ts', maintainability: 50, paths: 9, risk: 0.9 }, { path: 'src/plain.ts', maintainability: 70, paths: 5, risk: 0.4 }, { path: 'src/risky.ts', maintainability: 60, paths: 8, risk: 0.2 }];
  const head = [{ path: 'src/plain.ts', maintainability: 70, paths: 5 }, { path: 'src/risky.ts', maintainability: 60, paths: 8, risk: 0.2 }];

  const rows = rowsOf(base, head, ['src/gone.ts', 'src/plain.ts', 'src/risky.ts']);

  assert.deepEqual(rows.map((row) => row.split(' | ').at(-1)), ['|', '|', '1 |']);
});

for (const [name, touched] of [
  ['no changed file', []],
  ['changed files outside src/ only', ['test/unit/a.test.ts', 'script/b.ts', 'README.md', 'src', 'srcx/c.ts']],
] as const) {
  test(`Given ${name}, when the table is made, then the section is the heading and the line that no production file changed`, () => {
    const lines = complexityTableOf({ base: { files: twelve }, head: { files: twelve }, touched });

    assert.deepEqual(lines, ['## Complexity of the changed files', '', 'No production file changed.']);
  });
}

test('Given changed files out of order, twice, and outside src/, when the table is made, then each file under src/ has one row, sorted by the code units of its path', () => {
  const files = ['src/b.ts', 'src/a/z.ts', 'src/B.ts', 'src/a.ts'].map((path) => ({ path, maintainability: 70, paths: 5 }));

  const rows = rowsOf(files, files, ['src/b.ts', 'test/a.test.ts', 'src/a/z.ts', 'src/b.ts', 'src/B.ts', 'src/a.ts']);

  assert.deepEqual(rows.map((row) => row.split(' | ')[0]), ['| src/B.ts', '| src/a.ts', '| src/a/z.ts', '| src/b.ts']);
});

type Functions = readonly (readonly [name: string, paths: number])[];

// A file with maintainability 70, 5 decision paths, and its functions as name and decision paths.
function fileOf(path: string, functions: Functions): File {
  return { path, maintainability: 70, paths: 5, functions: functions.map(([name, paths]) => ({ name, paths })) };
}

// The coverage report has no file, so each named function is uncovered: 5 decision paths give the CRAP 30, and 4 give 20.
function bandedTableOf(base: readonly File[], head: readonly File[], touched: readonly string[]): string[] {
  const sources = { base: { files: base }, head: { files: head }, touched, coverage: { files: [] } };
  return complexityTableOf(sources, crapDeltaOf(sources));
}

test('Given a coverage report and a changed file, when the table is made, then the CRAP column follows the decision paths in the head row, and a line, the heading of the list, and the list follow the table', () => {
  const files = [fileOf('src/a.ts', [['run', 4]])];

  assert.deepEqual(bandedTableOf(files, files, ['src/a.ts']), [
    '## Complexity of the changed files',
    '',
    '| File | Maintainability | Decision paths | CRAP ≥ 30 | Risk rank |',
    '| --- | --- | --- | --- | --- |',
    '| src/a.ts | 70.0 → 70.0 | 5 → 5 | 0 → 0 | |',
    '',
    '### Functions at CRAP 30 or more, added or worse',
    '',
    'None.',
    '',
    'Unmatched functions: 0 (anonymous, duplicate, or not in the coverage).',
  ]);
});

// A file without functions, such as a file of types, or with unmatched functions only, has no function with a CRAP.
test('Given changed files of each kind with a coverage report, when the table is made, then the CRAP cell gives the count at 30 or more of each side with the arrow of a change, new and gone for a side without the file, and not measured for a side without a function with a CRAP', () => {
  const base = [
    fileOf('src/fewer.ts', [['first', 5], ['second', 6]]),
    fileOf('src/gone.ts', [['old', 5]]),
    fileOf('src/grown.ts', []),
    fileOf('src/more.ts', [['first', 5]]),
    fileOf('src/types.ts', []),
    fileOf('src/vague.ts', [['(anonymous)', 9]]),
  ];
  const head = [
    fileOf('src/fewer.ts', [['first', 5], ['second', 4]]),
    fileOf('src/grown.ts', [['fresh', 7]]),
    fileOf('src/more.ts', [['first', 5], ['second', 6]]),
    fileOf('src/new.ts', [['fresh', 5]]),
    fileOf('src/types.ts', []),
    fileOf('src/vague.ts', [['(anonymous)', 9], ['(anonymous)', 3]]),
  ];
  const touched = ['src/fewer.ts', 'src/gone.ts', 'src/grown.ts', 'src/more.ts', 'src/new.ts', 'src/types.ts', 'src/unknown.ts', 'src/vague.ts'];

  const cells = bandedTableOf(base, head, touched).slice(4, 4 + touched.length).map((row) => row.split(' | ')[3]);

  assert.deepEqual(cells, ['2 → 1 ↓1', '1 → gone', 'not measured → 1', '1 → 2 ↑1', 'new → 1', 'not measured', 'not measured', 'not measured']);
});

// startServer and stopServer are new, run went from 20 to 42, and big stays at 72.0. The module prefix of a method of
// ast-metrics names its file, so the list leaves it out.
test('Given added and worse functions in changed files out of order, and one in a file that did not change, when the table is made, then the list names those of the changed files, sorted by path and name, with the decision paths, the covered share, the CRAP, and the base, and the unmatched count covers the changed files only', () => {
  const base = [fileOf('src/b.ts', [['run', 4], ['big', 8]]), fileOf('src/other.ts', [['quiet', 1]])];
  const head = [
    fileOf('src/a.ts', [['a\\Server.stopServer', 5], ['startServer', 6], ['(anonymous)', 2]]),
    fileOf('src/b.ts', [['run', 6], ['big', 8], ['(anonymous)', 1]]),
    fileOf('src/other.ts', [['quiet', 1], ['loud', 9], ['(anonymous)', 1]]),
  ];

  const lines = bandedTableOf(base, head, ['src/b.ts', 'src/a.ts']);

  assert.deepEqual(lines.slice(lines.indexOf('### Functions at CRAP 30 or more, added or worse')), [
    '### Functions at CRAP 30 or more, added or worse',
    '',
    '- `src/a.ts` `Server.stopServer`: paths 5, covered 0.00, CRAP 30.0 (base new)',
    '- `src/a.ts` `startServer`: paths 6, covered 0.00, CRAP 42.0 (base new)',
    '- `src/b.ts` `run`: paths 6, covered 0.00, CRAP 42.0 (base 20.0)',
    '',
    'Unmatched functions: 2 (anonymous, duplicate, or not in the coverage).',
  ]);
});

test('Given a worse function with a covered share, when the table is made, then its line gives the share with two decimals and each CRAP with one', () => {
  const sources = {
    base: { files: [fileOf('src/a.ts', [['grow', 7]])] },
    head: { files: [fileOf('src/a.ts', [['grow', 14]])] },
    touched: ['src/a.ts'],
    coverage: { files: [{ path: 'src/a.ts', functions: [{ name: 'grow', coveredShare: 0.5 }] }] },
  };

  const lines = complexityTableOf(sources, crapDeltaOf(sources));

  assert.ok(lines.includes('- `src/a.ts` `grow`: paths 14, covered 0.50, CRAP 38.5 (base 13.1)'), lines.join('\n'));
});

test('Given a coverage report and no changed file under src/, when the table is made, then the section is the heading and the line that no production file changed, without a list', () => {
  const files = [fileOf('src/a.ts', [['fresh', 9]])];

  assert.deepEqual(bandedTableOf([], files, ['test/a.test.ts']), ['## Complexity of the changed files', '', 'No production file changed.']);
});
