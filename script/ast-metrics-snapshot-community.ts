import type { ServerCommunity } from './ast-metrics-snapshot-communities.ts';
import type { CommunityMap } from './ast-metrics-snapshot-map.ts';
import { sumOf, weightedMaintainability } from './ast-metrics-snapshot-numbers.ts';
import type { FileMeasurement, SnapshotCommunity, SnapshotEdge } from './ast-metrics-snapshot-types.ts';

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
