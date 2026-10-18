import { cyclesDiffer } from './ast-metrics-architecture-cycles.ts';
import { goneEdgesOf, headEdgesOf } from './ast-metrics-architecture-edges.ts';
import { matchingOf } from './ast-metrics-architecture-match.ts';
import { nodeIndexOf } from './ast-metrics-architecture-nodes.ts';
import type { ArchitectureMap, MapEdge, MapNode, MapSources } from './ast-metrics-architecture-types.ts';

// The head communities come first and the gone ones after them, so that the stable sort puts the head first on a tie.
// A change of a number or of a reference count alone does not change the map.
export function architectureMapOf(sources: MapSources): ArchitectureMap {
  const matching = matchingOf(sources.base.communities, sources.head.communities);
  const index = nodeIndexOf(sources, matching);
  const nodes = [...new Set([...index.head.values(), ...index.base.values()])].sort(byLabel);
  const edges = [...headEdgesOf(sources.head, matching, index), ...goneEdgesOf(sources.base, matching, index)].sort(byLabels);
  const changed = nodes.some((node) => node.status !== 'kept' || node.touched) || edges.some((edge) => edge.status !== 'kept')
    || cyclesDiffer(sources.base, sources.head, matching);
  return { nodes, edges, changed };
}

function byLabel(first: MapNode, second: MapNode): number {
  return textOrder(first.label, second.label);
}

function byLabels(first: MapEdge, second: MapEdge): number {
  return textOrder(first.from.label, second.from.label) || textOrder(first.to.label, second.to.label);
}

// The order of the code units, as the snapshot sorts its labels.
function textOrder(first: string, second: string): number {
  return Number(first > second) - Number(first < second);
}
