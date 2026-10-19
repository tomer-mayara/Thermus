import type { MainHistory } from './main-history.ts';

interface RecordIdentity { readonly commit: string }

// Check only the interval between displayed first-parent records. All stored records count,
// including rows omitted from the table by its display limit or date ordering.
export function trendGapLinesOf(history: MainHistory | undefined, displayed: readonly RecordIdentity[], stored = displayed): string[] {
  if (history === undefined) return ['Gap check unavailable: offline snapshot dates cannot prove omitted commits.'];
  if (history.kind === 'unavailable') return [`Gap check unavailable: ${history.reason}`];
  const positions = displayed.map(({ commit }) => history.commits.indexOf(commit)).filter((index) => index >= 0);
  const lines: string[] = [];
  const absent = displayed.length - positions.length;
  if (absent > 0) lines.push(`Gap check cannot place ${absent} displayed record${absent === 1 ? '' : 's'} on first-parent origin/main.`);
  if (positions.length < 2) return lines;
  const known = new Set(stored.map(({ commit }) => commit));
  const oldest = Math.max(...positions);
  const newest = Math.min(...positions);
  let previous = oldest;
  for (let index = oldest - 1; index >= newest; index--) {
    if (!known.has(history.commits[index])) continue;
    const missing = previous - index - 1;
    if (missing > 0) lines.push(`${missing} commits of main between ${history.commits[previous].slice(0, 8)} and ${history.commits[index].slice(0, 8)} have no record.`);
    previous = index;
  }
  return lines;
}
