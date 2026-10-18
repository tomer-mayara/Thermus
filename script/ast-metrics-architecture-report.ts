// The Markdown of the architecture delta and of the complexity table, for the body of a pull request. The report is pure,
// so that its rules have unit tests without git and ast-metrics.
import { architectureMapOf } from './ast-metrics-architecture-map.ts';
import { mermaidOf } from './ast-metrics-architecture-mermaid.ts';
import { headerOf, summaryOf } from './ast-metrics-architecture-summary.ts';
import { complexityTableOf } from './ast-metrics-architecture-table.ts';
import type { MapSources } from './ast-metrics-architecture-types.ts';

const legend = 'Legend: thick border = a community this pull request touched; `· new` and `· gone` = a community or dependency that appeared or disappeared; red dashed edge = part of a cycle; thick edge = a new dependency; numbers = files · maintainability (LOC-weighted) · decision paths, with the change against the base.';

// The graph and its legend appear only when the map changed, so that a pull request that keeps the structure gets one
// line.
export function architectureReportOf(sources: MapSources): string {
  const map = architectureMapOf(sources);
  const picture = map.changed ? [...mermaidOf(map), '', legend] : ['The map did not change.'];
  return `${[headerOf(sources), '', summaryOf(sources, map.nodes), '', ...picture, '', ...complexityTableOf(sources)].join('\n')}\n`;
}
