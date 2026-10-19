import { fileMappingOf } from './file-correspondence.ts';
// ast-metrics renumbers and renames its communities when code grows elsewhere, so a head community is the base
// community that has most of the same files (docs/implementation/architecture-evolution-plan.md, "Community identity").
import type { FileChange } from '../delta/changes.ts';
import { textOrder } from '../shared/order.ts';
import type { MapCommunity } from './types.ts';

const minimumOverlap = 0.5;

// The partner of each matched community in the other snapshot, by the id of the community.
export interface Matching {
  readonly baseOf: ReadonlyMap<string, MapCommunity>;
  readonly headOf: ReadonlyMap<string, MapCommunity>;
}

interface Candidate {
  readonly head: MapCommunity;
  readonly base: MapCommunity;
  readonly overlap: number;
}

// Greedy: the pairs with the largest overlap match first, and a community that has a partner takes no other one. So each
// base community matches one head community at most.
export function matchingOf(base: readonly MapCommunity[], head: readonly MapCommunity[], changes: readonly FileChange[] = []): Matching {
  const baseOf = new Map<string, MapCommunity>();
  const headOf = new Map<string, MapCommunity>();
  const paths = fileMappingOf(changes).after;
  for (const candidate of candidatesOf(base, head, paths)) {
    if (baseOf.has(candidate.head.id) || headOf.has(candidate.base.id)) continue;
    baseOf.set(candidate.head.id, candidate.base);
    headOf.set(candidate.base.id, candidate.head);
  }
  return { baseOf, headOf };
}

function candidatesOf(base: readonly MapCommunity[], head: readonly MapCommunity[], paths: ReadonlyMap<string, string>): Candidate[] {
  const pairs = head.flatMap((after) => base.map((before) => ({ head: after, base: before, overlap: overlapOf(after.members, before.members.map((path) => paths.get(path) ?? path)) })));
  return pairs.filter(({ overlap }) => overlap >= minimumOverlap).sort(byOverlapThenLabels);
}

// The Jaccard overlap: the files that both communities have, over all files of the two. Two communities without files
// have no overlap.
function overlapOf(first: readonly string[], second: readonly string[]): number {
  const firstFiles = new Set(first);
  const all = new Set([...first, ...second]);
  const shared = new Set(second.filter((file) => firstFiles.has(file)));
  return all.size === 0 ? 0 : shared.size / all.size;
}

// A tie goes to the first head label, then to the first base label, so that the match does not depend on the order of
// the snapshots.
function byOverlapThenLabels(first: Candidate, second: Candidate): number {
  return second.overlap - first.overlap || textOrder(first.head.label, second.head.label) || textOrder(first.base.label, second.base.label);
}
