import type { CrapDelta } from './crap-delta.ts';
import { goneEdgesOf, headEdgesOf } from './edges.ts';
import { matchingOf, type Matching } from './match.ts';
import { nodeIndexOf } from './nodes.ts';
import { byLabel, byLabels } from './order.ts';
import type { ArchitectureMap, MapSnapshot, MapSources } from './types.ts';

// The head communities come first and the gone ones after them, so that the stable sort puts the head first on a tie.
// A change of a number or of a reference count alone does not change the map.
export function architectureMapOf(sources: MapSources, delta: CrapDelta | undefined): ArchitectureMap {
  const matching = matchingOf(sources.base.communities, sources.head.communities, sources.changes);
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

// A snapshot names the communities of a cycle by their labels. A cycle of the base is the same cycle in the head when the
// head has a cycle of the partners of its communities. A community without a partner gets a name that no label has,
// because a label holds no NUL character.
function cyclesDiffer(base: MapSnapshot, head: MapSnapshot, matching: Matching): boolean {
  const headLabels = new Map(base.communities.map((community) => [community.label, matching.headOf.get(community.id)?.label]));
  const before = new Set(base.global.cycles.map((cycle) => keyOf(cycle.map((label) => headLabels.get(label) ?? `\0${label}`))));
  const after = new Set(head.global.cycles.map(keyOf));
  return before.size !== after.size || [...after].some((key) => !before.has(key));
}

// The order of the communities in a cycle does not matter.
function keyOf(labels: readonly string[]): string {
  return JSON.stringify(labels.toSorted());
}
