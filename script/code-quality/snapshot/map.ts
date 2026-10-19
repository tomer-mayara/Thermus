import type { ServerCommunities, ServerCommunity, ServerEdge } from './input.ts';
import { labelsOf } from './communities.ts';

// The communities of the answer that have a member in src/, with their labels and the edges and cycles between them.
export interface CommunityMap {
  readonly communities: readonly ServerCommunity[];
  readonly labels: ReadonlyMap<string, string>;
  readonly edges: readonly ServerEdge[];
  // The sorted labels of the communities in each cycle.
  readonly cycles: readonly (readonly string[])[];
  communityOf(path: string): string | null;
}

// The map covers src/ only (decision 4 of docs/implementation/architecture-evolution-plan.md), so an edge or a cycle
// through a community outside src/ is not on it.
export function communityMapOf(answer: ServerCommunities): CommunityMap {
  const communities = answer.communities.filter((community) => community.members.some(isSourcePath));
  const labels = labelsOf(communities);
  const units = new Map(communities.flatMap((community) => community.members.map((member) => [member, community.id] as const)));
  return {
    communities,
    labels,
    edges: answer.edges.filter((edge) => labels.has(edge.from) && labels.has(edge.to)),
    cycles: cycleLabels(answer.cycles, labels),
    communityOf: (path) => communityOfUnit(units, path),
  };
}

function isSourcePath(member: string): boolean {
  return member.startsWith('src/');
}

// The labels in a cycle are sorted, and so are the cycles, so that the file diffs well. Without a compare function,
// sort() compares the labels of two cycles as joined text.
function cycleLabels(cycles: ServerCommunities['cycles'], labels: ReadonlyMap<string, string>): string[][] {
  return cycles.filter((cycle) => cycle.every((id) => labels.has(id)))
    .map((cycle) => cycle.map((id) => labels.get(id) ?? id).sort())
    .sort();
}

// ast-metrics names a file without its extension, and it groups the files of a deep folder into one unit that has the
// name of the folder. So the unit of a file is the file itself or the nearest folder above it that is a member.
function communityOfUnit(units: ReadonlyMap<string, string>, path: string): string | null {
  for (let unit = path.replace(/\.[^./]+$/, ''); unit !== ''; unit = unit.slice(0, Math.max(unit.lastIndexOf('/'), 0))) {
    const id = units.get(unit);
    if (id !== undefined) return id;
  }
  return null;
}
