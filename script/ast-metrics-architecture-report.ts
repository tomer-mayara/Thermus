// The Markdown of the architecture delta and of the complexity table, for the body of a pull request. The report is pure,
// so that its rules have unit tests without git and ast-metrics.
import { crapDeltaOf } from './ast-metrics-architecture-crap-delta.ts';
import { architectureMapOf } from './ast-metrics-architecture-map.ts';
import { mermaidOf } from './ast-metrics-architecture-mermaid.ts';
import { headerOf, summaryOf } from './ast-metrics-architecture-summary.ts';
import { complexityTableOf } from './ast-metrics-architecture-table.ts';
import type { MapSources } from './ast-metrics-architecture-types.ts';

const legendParts = {
  start: 'Legend: thick border = a community this pull request touched; `· new` and `· gone` = a community or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency;',
  bands: 'border color = the CRAP band of the community (● good: no function at CRAP 30 or more; ▲ warning: some, none added or worse by this pull request; ■ critical: one added or worse);',
  end: 'numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base.',
};

const bandsNeedTheCoverage = 'Bands need the coverage: run pnpm exec node script/ast-metrics-coverage.ts first.';

// The graph and its legend appear only when the map changed, so that a pull request that keeps the structure gets one
// line. Without coverage, the line after the summary says how to get the bands.
export function architectureReportOf(sources: MapSources): string {
  const delta = crapDeltaOf(sources);
  const map = architectureMapOf(sources, delta);
  const legend = [legendParts.start, ...(delta === undefined ? [] : [legendParts.bands]), legendParts.end].join(' ');
  const picture = map.changed ? [...mermaidOf(map), '', legend] : ['The map did not change.'];
  const coverageNote = delta === undefined ? ['', bandsNeedTheCoverage] : [];
  return `${[headerOf(sources), '', summaryOf(sources, map.nodes, delta), ...coverageNote, '', ...picture, '', ...complexityTableOf(sources, delta)].join('\n')}\n`;
}
