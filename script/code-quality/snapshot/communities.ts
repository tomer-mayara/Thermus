import type { Namespace, ServerCommunity } from './input.ts';
import type { CommunityMap } from './map.ts';
import { sumOf, weightedMaintainability } from '../shared/numbers.ts';
import type { FileMeasurement, SnapshotCommunity, SnapshotEdge } from './types.ts';

// Sorted by label, so that the order does not depend on the ids, which change from analysis to analysis.
export function snapshotCommunitiesOf(map: CommunityMap, files: readonly FileMeasurement[]): SnapshotCommunity[] {
  return map.communities
    .map((community) => communityOf(community, map, files.filter((file) => map.communityOf(file.path) === community.id)))
    .sort((first, second) => (first.label < second.label ? -1 : 1));
}

function communityOf(community: ServerCommunity, map: CommunityMap, members: readonly FileMeasurement[]): SnapshotCommunity {
  return {
    id: community.id,
    label: labelOf(map, community.id),
    hub: community.hubs[0] ?? '',
    members: members.map((file) => file.path),
    files: members.length,
    loc: sumOf(members.map((file) => file.loc)),
    maintainability: weightedMaintainability(members),
    paths: sumOf(members.map((file) => file.paths)),
    references: community.references,
    edges: edgesFrom(map, community.id),
  };
}

function edgesFrom(map: CommunityMap, id: string): SnapshotEdge[] {
  return map.edges
    .filter((edge) => edge.from === id)
    .map(({ to, references, inCycle }) => ({ to, references, inCycle }))
    .sort((first, second) => (labelOf(map, first.to) < labelOf(map, second.to) ? -1 : 1));
}

function labelOf(map: CommunityMap, id: string): string {
  return map.labels.get(id) ?? id;
}

// The labels of the src/ communities. ast-metrics regroups and renames its communities when code grows elsewhere, so a
// label comes from the members, not from the generated name: the largest namespace in src/ by member count, without
// the src/ prefix. The files at the top of src/ give the label src.
export function labelsOf(communities: readonly ServerCommunity[]): ReadonlyMap<string, string> {
  const named = communities.map((community) => ({ community, label: namespaceLabel(community) }));
  const uses = new Map<string, number>();
  for (const { label } of named) uses.set(label, (uses.get(label) ?? 0) + 1);
  return new Map(named.map(({ community, label }) => [community.id, (uses.get(label) ?? 0) > 1 ? `${label} (${hubName(community)})` : label]));
}

function namespaceLabel(community: ServerCommunity): string {
  if (community.id === 'shared') return 'shared kernel';
  const [largest] = community.namespaces.filter(isSourceNamespace).toSorted(byCountThenName);
  return largest === undefined ? 'src' : largest.namespace.replace(/^src\//, '');
}

// A community can hold files of other folders too, such as script/.
function isSourceNamespace({ namespace }: Namespace): boolean {
  return namespace === 'src' || namespace.startsWith('src/');
}

// A tie goes to the first name, so that the label does not depend on the order of the answer.
function byCountThenName(first: Namespace, second: Namespace): number {
  return second.count - first.count || (first.namespace < second.namespace ? -1 : 1);
}

// A hub is a file without its extension or a folder.
function hubName({ id, hubs }: ServerCommunity): string {
  const hub = hubs[0] ?? id;
  return hub.slice(hub.lastIndexOf('/') + 1);
}
