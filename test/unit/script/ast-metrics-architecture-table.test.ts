import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

// The rules of the complexity table: the cells of a row, the risk rank, and the section without a production file. The
// table is pure, so the cases call it in the test process. Its module runs from source next to the command, as the
// command runs it. The types give the parts of the contract that the cases use. Without the CRAP delta, the table has no
// CRAP column; ast-metrics-architecture-functions.test.ts specifies that column and the list after the table.
interface File {
  readonly path: string;
  readonly maintainability?: number;
  readonly paths?: number;
  readonly risk?: number;
}

interface Sources {
  readonly base: { readonly files: readonly File[] };
  readonly head: { readonly files: readonly File[] };
  readonly touched: readonly string[];
}

const { complexityTableOf } = await import(new URL('architecture/table.ts', pathToFileURL(astMetricsArchitectureScript)).href) as {
  complexityTableOf(sources: Sources): string[];
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
