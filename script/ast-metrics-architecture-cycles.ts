import type { Matching } from './ast-metrics-architecture-match.ts';
import type { MapSnapshot } from './ast-metrics-architecture-types.ts';

// A snapshot names the communities of a cycle by their labels. A cycle of the base is the same cycle in the head when the
// head has a cycle of the partners of its communities. A community without a partner gets a name that no label has,
// because a label holds no NUL character.
export function cyclesDiffer(base: MapSnapshot, head: MapSnapshot, matching: Matching): boolean {
  const headLabels = new Map(base.communities.map((community) => [community.label, matching.headOf.get(community.id)?.label]));
  const before = new Set(base.global.cycles.map((cycle) => keyOf(cycle.map((label) => headLabels.get(label) ?? `\0${label}`))));
  const after = new Set(head.global.cycles.map(keyOf));
  return before.size !== after.size || [...after].some((key) => !before.has(key));
}

// The order of the communities in a cycle does not matter.
function keyOf(labels: readonly string[]): string {
  return JSON.stringify(labels.toSorted());
}
