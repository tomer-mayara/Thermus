// The complexity table of docs/implementation/architecture-evolution-plan.md ("The views", view 2), without the columns
// of CRAP, which ticket T6 adds. The table is pure, so that its rules have unit tests without git and ast-metrics.
import { measureCellsOf } from './ast-metrics-architecture-cells.ts';
import { textOrder } from './ast-metrics-architecture-order.ts';
import type { MapSources, TableFile } from './ast-metrics-architecture-types.ts';

const heading = '## Complexity of the changed files';
const columns = ['File', 'Maintainability', 'Decision paths', 'Risk rank'];
const rankedFiles = 10;

// The snapshots hold only src/ files, so a changed file elsewhere, such as a test, gets no row.
export function complexityTableOf({ base, head, touched }: MapSources): string[] {
  const changed = [...new Set(touched.filter((path) => path.startsWith('src/')))].sort();
  if (changed.length === 0) return [heading, '', 'No production file changed.'];
  const [before, after] = [filesByPath(base.files), filesByPath(head.files)];
  const ranks = riskRanksOf(head.files);
  const rows = changed.map((path) => rowOf([path, ...measureCellsOf(before.get(path), after.get(path)), `${ranks.get(path) ?? ''}`]));
  return [heading, '', rowOf(columns), rowOf(columns.map(() => '---')), ...rows];
}

// A tie goes to the first path, so that the rank does not depend on the order of the files in a snapshot file.
function riskRanksOf(files: readonly TableFile[]): ReadonlyMap<string, number> {
  const scored = files.flatMap(({ path, risk }) => (risk === undefined ? [] : [{ path, risk }]));
  scored.sort((first, second) => second.risk - first.risk || textOrder(first.path, second.path));
  return new Map(scored.slice(0, rankedFiles).map(({ path }, index) => [path, index + 1]));
}

function filesByPath(files: readonly TableFile[]): ReadonlyMap<string, TableFile> {
  return new Map(files.map((file) => [file.path, file]));
}

function rowOf(cells: readonly string[]): string {
  return `|${cells.map((cell) => (cell === '' ? ' ' : ` ${cell} `)).join('|')}|`;
}
