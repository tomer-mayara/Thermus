// The trend table of docs/implementation/architecture-evolution-plan.md ("The views", view 3): the global numbers of the
// last records of main, and the numbers of the head as the last row. The table is pure, so that its rules have unit
// tests without git and ast-metrics.
import { rowOf } from './ast-metrics-architecture-table.ts';
import type { TrendNumbers } from './ast-metrics-architecture-trend-record.ts';

const heading = '## Trend of src/ on main';
const columns = ['Commit', 'Date', 'Modularity', 'Cross share', 'Cycles', 'Maintainability', 'Functions ≥ 30'];

// An en dash (U+2013) shows a value that a row does not have, such as the count of the functions at CRAP 30 or more of
// a record without coverage.
const noValue = '–';

// stored: the records of the store, oldest first. Without a record, the section has one line and no row of the head,
// because there is nothing to compare the head with.
export function trendSectionOf(stored: readonly TrendNumbers[], head: TrendNumbers): string[] {
  if (stored.length === 0) return [heading, '', 'No snapshot of main in docs/metrics yet.'];
  const rows = stored.map((record) => rowOf([record.commit.slice(0, 8), record.date.slice(0, 10), ...numbersOf(record)]));
  return [heading, '', rowOf(columns), rowOf(columns.map(() => '---')), ...rows, rowOf(['this pull request', '', ...numbersOf(head)])];
}

// A share keeps two decimals and a score one, as in the summary line and in the map.
function numbersOf({ modularity, crossShare, cycles, maintainability, functionsOver30 }: TrendNumbers): string[] {
  return [modularity.toFixed(2), crossShare.toFixed(2), `${cycles}`, maintainability?.toFixed(1) ?? noValue, `${functionsOver30 ?? noValue}`];
}
