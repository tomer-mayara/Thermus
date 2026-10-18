import type { CrapDelta } from './ast-metrics-architecture-crap-delta.ts';
import { cyclesDiffer } from './ast-metrics-architecture-cycles.ts';
import { goneEdgesOf, headEdgesOf } from './ast-metrics-architecture-edges.ts';
import { matchingOf } from './ast-metrics-architecture-match.ts';
import { nodeIndexOf } from './ast-metrics-architecture-nodes.ts';
import { byLabel, byLabels } from './ast-metrics-architecture-order.ts';
import type { ArchitectureMap, MapSources } from './ast-metrics-architecture-types.ts';

// The head communities come first and the gone ones after them, so that the stable sort puts the head first on a tie.
// A change of a number or of a reference count alone does not change the map.
export function architectureMapOf(sources: MapSources, delta: CrapDelta | undefined): ArchitectureMap {
  const matching = matchingOf(sources.base.communities, sources.head.communities);
  const index = nodeIndexOf(sources, matching, delta);
  const nodes = [...new Set([...index.head.values(), ...index.base.values()])].sort(byLabel);
  const edges = [...headEdgesOf(sources.head, matching, index), ...goneEdgesOf(sources.base, matching, index)].sort(byLabels);
  const changed = nodesChanged(nodes) || edges.some((edge) => edge.status !== 'kept') || cyclesDiffer(sources.base, sources.head, matching);
  return { nodes, edges, changed };
}

// A community is new, gone, or touched, or its band is not the band of its base, as the plan says ("The views", view 1).
function nodesChanged(nodes: ArchitectureMap['nodes']): boolean {
  return nodes.some((node) => node.status !== 'kept' || node.touched || node.band?.band !== node.band?.before);
}
