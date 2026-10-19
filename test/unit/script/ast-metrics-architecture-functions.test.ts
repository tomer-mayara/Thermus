import type { TableFile as File } from '../../../script/code-quality/architecture/types.ts';
import { mapSnapshotOf } from '../../support/fixtures/ast-metrics-map-snapshot.ts';
import { completeSourceEvidence, functionIdentityOf } from '../../support/fixtures/ast-metrics-function-identity.ts';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { astMetricsArchitectureScript } from '../../support/processes/module-paths.ts';

// These pure table cases check the CRAP count for each side of a changed file and the list of added or worse functions.
// Load the source modules next to the command and pass the CRAP delta to the table, as the command does.
// ast-metrics-architecture-table.test.ts covers the table without coverage.
const scriptFolder = pathToFileURL(astMetricsArchitectureScript);
const { complexityTableOf } = await import(new URL('architecture/table.ts', scriptFolder).href) as typeof import('../../../script/code-quality/architecture/table.ts');
const { crapDeltaOf } = await import(new URL('architecture/crap-delta.ts', scriptFolder).href) as typeof import('../../../script/code-quality/architecture/crap-delta.ts');

type Functions = readonly (readonly [name: string, paths: number])[];

// A file with maintainability 70, 5 decision paths, and its functions as name and decision paths.
function fileOf(path: string, functions: Functions): File {
  return { path, sourceEvidence: completeSourceEvidence, maintainability: 70, paths: 5, functions: functions.map(([name, paths]) => ({ name, paths, identity: functionIdentityOf(name, paths) })) };
}

// The report has no files, so each named function is uncovered: 5 decision paths give CRAP 30, and 4 give 20.
function bandedTableOf(base: readonly File[], head: readonly File[], touched: readonly string[]): string[] {
  const sources = { base: mapSnapshotOf(base), head: mapSnapshotOf(head), touched, coverage: { files: [] } };
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

  assert.deepEqual(cells, ['2 → 1 ↓1', 'not measured → gone', 'not measured → 1', '1 → 2 ↑1', 'new → 1', 'not measured', 'not measured', 'not measured']);
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
    base: mapSnapshotOf([fileOf('src/a.ts', [['grow', 7]])]),
    head: mapSnapshotOf([fileOf('src/a.ts', [['grow', 14]])]),
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
