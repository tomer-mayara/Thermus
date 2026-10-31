import { trendChartsOf } from './trend-charts.ts';
import { componentTrendTableOf } from './component-trend-table.ts';
import { countCellOf, markdownCellOf, prCellOf } from './trend-cells.ts';
import { trendToolNoticeOf } from './tool-notice.ts';
import { rowOf } from './table.ts';
import type { TrendNumbers } from './trend-record.ts';

const heading = '## Trend of src/ on main';
const columns = ['Commit', 'PR', 'Date', 'Modularity', 'Cross share', 'Cycles', 'Maintainability', 'Functions ≥ 30'];

const noValue = '–';

// stored: the records of the store, oldest first; undefined means no store. Without a record, the section has one
// line and no row of the head, because there is nothing to compare the head with.
export function trendSectionOf(stored: readonly TrendNumbers[] | undefined, head: TrendNumbers): string[] {
  if (stored === undefined) return [heading, '', 'No trend store.'];
  if (stored.length === 0) return [heading, '', 'No snapshot of main in the trend store yet.'];
  const rows = stored.map((record) => rowOf([markdownCellOf(record.commit.slice(0, 8)), prCellOf(record.title), record.date.slice(0, 10), ...numbersOf(record)]));
  const note = stored.some((record) => record.crap?.kind === 'head-derived-estimate' || record.components?.some((component) => component.crap?.kind === 'head-derived-estimate'))
    ? ['', 'Historical estimates use head coverage from the first recording pull request. Later estimates for the same base can differ. Counts include known lower-bound violations; other unknown functions are not counted.'] : [];
  return [heading, '', rowOf(columns), rowOf(columns.map(() => '---')), ...rows,
    rowOf(['this pull request', prCellOf(head.title), '', ...numbersOf(head)]),
    ...note, ...trendToolNoticeOf([...stored, { ...head, commit: undefined }]),
    ...trendChartsOf(stored, head), ...componentTrendTableOf(stored, head)];
}

function numbersOf(record: TrendNumbers): string[] {
  const { modularity, crossShare, cycles, maintainability } = record;
  return [modularity.toFixed(2), crossShare.toFixed(2), `${cycles}`, maintainability?.toFixed(1) ?? noValue, countCellOf(record)];
}
