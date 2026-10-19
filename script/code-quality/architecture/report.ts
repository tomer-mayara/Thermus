// The Markdown of the architecture delta and of the complexity table, for the body of a pull request. The report is pure,
// so that its rules have unit tests without git and ast-metrics.
import { totalCountOf } from './bands.ts';
import type { CrapDelta } from './crap-delta.ts';
import { architectureMapOf } from './map.ts';
import { mermaidOf } from './mermaid.ts';
import { complexityTableOf, rowOf } from './table.ts';
import type { TrendNumbers } from './trend-record.ts';
import type { MapNode, MapSources } from './types.ts';

const legendParts = {
  start: 'Legend: thick border = a community this pull request touched; `· new` and `· gone` = a community or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency;',
  bands: 'border color = the CRAP band of the community (● good: no function at CRAP 30 or more; ▲ warning: some, none added or worse by this pull request; ■ critical: one added or worse);',
  end: 'numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base.',
};

const bandsNeedTheCoverage = 'Bands need the coverage: run pnpm exec node script/code-quality/ast-metrics-coverage.ts first.';

// Every report includes the graph and its legend. An unchanged map keeps its note above the graph. Without coverage,
// the line after the summary says how to get the bands.
export function architectureReportOf(sources: MapSources, delta: CrapDelta | undefined): string {
  const map = architectureMapOf(sources, delta);
  const legend = [legendParts.start, ...(delta === undefined ? [] : [legendParts.bands]), legendParts.end].join(' ');
  const picture = [...(map.changed ? [] : ['The map did not change.', '']), ...mermaidOf(map), '', legend];
  const coverageNote = delta === undefined ? ['', bandsNeedTheCoverage] : [];
  return `${[headerOf(sources), '', summaryOf(sources, map.nodes, delta), ...coverageNote, '', ...picture, '', ...complexityTableOf(sources, delta)].join('\n')}\n`;
}

// The snapshot of the head can hold changes that are not committed, so the header names the base commit only.
function headerOf({ base }: MapSources): string {
  return `## Architecture of src/: base ${base.commit.slice(0, 8)} → head`;
}

// A share keeps two decimals. The communities include the shared kernel, and the count of the new and the gone ones
// follows when there are such. With coverage, the count of the functions at CRAP 30 or more in all of src/ comes last.
function summaryOf({ base, head }: MapSources, nodes: readonly MapNode[], delta: CrapDelta | undefined): string {
  const counts = (['new', 'gone'] as const)
    .map((status) => `${nodes.filter((node) => node.status === status).length} ${status}`)
    .filter((count) => !count.startsWith('0 '));
  const functions = delta === undefined ? [] : [`functions ≥ 30: ${totalCountOf(delta.base)} → ${totalCountOf(delta.head)}`];
  return [
    `Modularity ${base.global.modularity.toFixed(2)} → ${head.global.modularity.toFixed(2)}`,
    `cross share ${base.global.crossShare.toFixed(2)} → ${head.global.crossShare.toFixed(2)}`,
    `cycles ${base.global.cycles.length} → ${head.global.cycles.length}`,
    `communities ${base.communities.length} → ${head.communities.length}${counts.length === 0 ? '' : ` (${counts.join(', ')})`}`,
    ...functions,
  ].join(' · ');
}

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
  return [heading, '', rowOf(columns), rowOf(columns.map(() => '---')), ...rows, rowOf(['this pull request', '', ...numbersOf(head)])];
}

// A share keeps two decimals and a score one, as in the summary line and in the map.
function numbersOf({ modularity, crossShare, cycles, maintainability, functionsOver30 }: TrendNumbers): string[] {
  return [modularity.toFixed(2), crossShare.toFixed(2), `${cycles}`, maintainability?.toFixed(1) ?? noValue, `${functionsOver30 ?? noValue}`];
}
