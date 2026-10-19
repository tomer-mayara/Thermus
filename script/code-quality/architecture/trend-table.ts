import { trendToolNoticeOf } from './tool-notice.ts';
import { rowOf } from './table.ts';
import type { TrendNumbers } from './trend-record.ts';

const heading = '## Trend of src/ on main';
const columns = ['Commit', 'Date', 'Modularity', 'Cross share', 'Cycles', 'Maintainability', 'Functions ≥ 30'];

// An en dash (U+2013) shows a value that a row does not have, such as the count of the functions at CRAP 30 or more of
// a record without coverage.
const noValue = '–';

// stored: the records of the store, oldest first; undefined means no store. Without a record, the section has one
// line and no row of the head, because there is nothing to compare the head with.
export function trendSectionOf(stored: readonly TrendNumbers[] | undefined, head: TrendNumbers): string[] {
  if (stored === undefined) return [heading, '', 'No trend store.'];
  if (stored.length === 0) return [heading, '', 'No snapshot of main in the trend store yet.'];
  const rows = stored.map((record) => rowOf([record.commit.slice(0, 8), record.date.slice(0, 10), ...numbersOf(record)]));
  const note = stored.some((record) => record.crap?.kind === 'head-derived-estimate')
    ? ['', 'Historical estimates use head coverage from the first recording pull request. Later estimates for the same base can differ. Counts include known lower-bound violations; other unknown functions are not counted.'] : [];
  return [heading, '', rowOf(columns), rowOf(columns.map(() => '---')), ...rows, rowOf(['this pull request', '', ...numbersOf(head)]), ...note, ...trendToolNoticeOf([...stored, { ...head, commit: undefined }])];
}

// A share keeps two decimals and a score one, as in the summary line and in the map.
function numbersOf(record: TrendNumbers): string[] {
  const { modularity, crossShare, cycles, maintainability } = record;
  return [modularity.toFixed(2), crossShare.toFixed(2), `${cycles}`, maintainability?.toFixed(1) ?? noValue, countOf(record)];
}

function countOf({ functionsOver30, crap }: TrendNumbers): string {
  if (functionsOver30 === undefined) return noValue;
  const basis = crap === undefined ? 'legacy unknown' : crap.kind === 'measured' ? 'measured' : 'estimate';
  return `${functionsOver30} (${basis})`;
}
