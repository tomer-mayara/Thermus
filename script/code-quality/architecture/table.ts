import { changedFilesOf, type FileComparison } from './file-correspondence.ts';
// The complexity table of docs/implementation/ast-metrics-review.md, "Show the architecture delta". With coverage, it has
// the column of the functions at CRAP 30 or more, and the list of the functions follows it. The table is pure, so that
// its rules have unit tests without git and ast-metrics.
import { measureCellsOf } from './format.ts';
import type { CrapDelta } from './crap-delta.ts';
import { crapCellOf, functionListOf } from './functions.ts';
import { riskRanksOf } from './order.ts';
import type { MapSources, TableFile } from './types.ts';

const heading = '## Complexity of the changed files';

// The snapshots hold only src/ files, so a changed file elsewhere, such as a test, gets no row.
export function complexityTableOf({ base, head, touched, changes }: MapSources, delta: CrapDelta | undefined): string[] {
  const changed = changedFilesOf(touched, changes);
  if (changed.length === 0) return [heading, '', 'No production file changed.'];
  const [before, after] = [filesByPath(base.files), filesByPath(head.files)];
  const context = { before, after, ranks: riskRanksOf(head.files) };
  const rows = changed.map((path) => rowOf(rowCellsOf(path, context, delta)));
  const columns = ['File', 'Maintainability', 'Decision paths', ...(delta === undefined ? [] : ['CRAP ≥ 30']), 'Risk rank'];
  const list = delta === undefined ? [] : ['', ...functionListOf(delta, changed.map(({ path }) => path))];
  return [heading, '', rowOf(columns), rowOf(columns.map(() => '---')), ...rows, ...list];
}

interface TableContext {
  readonly before: ReadonlyMap<string, TableFile>;
  readonly after: ReadonlyMap<string, TableFile>;
  readonly ranks: ReadonlyMap<string, number>;
}

function rowCellsOf({ path, basePath, label }: FileComparison, context: TableContext, delta: CrapDelta | undefined): string[] {
  const before = context.before.get(basePath), after = context.after.get(path);
  const crapCells = delta === undefined ? [] : [crapCellOf(delta, path, basePath)];
  const rank = after === undefined && before !== undefined ? 'gone' : `${context.ranks.get(path) ?? ''}`;
  return [label, ...measureCellsOf(before, after), ...crapCells, rank];
}

function filesByPath(files: readonly TableFile[]): ReadonlyMap<string, TableFile> {
  return new Map(files.map((file) => [file.path, file]));
}

// A row of a Markdown table. An empty cell keeps one space, as in | |.
export function rowOf(cells: readonly string[]): string {
  return `|${cells.map((cell) => (cell === '' ? ' ' : ` ${cell} `)).join('|')}|`;
}
