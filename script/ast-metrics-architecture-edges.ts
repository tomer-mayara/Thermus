import type { Matching } from './ast-metrics-architecture-match.ts';
import type { NodeIndex } from './ast-metrics-architecture-nodes.ts';
import type { MapCommunity, MapEdge, MapSnapshot } from './ast-metrics-architecture-types.ts';

type SnapshotEdge = MapCommunity['edges'][number];

// Each dependency of the head: kept when the base has it between the partners of its two communities, else new. A
// dependency on a community that the snapshot does not have is not on the map.
export function headEdgesOf(head: MapSnapshot, matching: Matching, nodes: NodeIndex): MapEdge[] {
  return head.communities.flatMap((community) => community.edges.flatMap((edge): MapEdge[] => {
    const [from, to] = [nodes.head.get(community.id), nodes.head.get(edge.to)];
    if (from === undefined || to === undefined) return [];
    const before = partnerEdgeOf(matching.baseOf, community.id, edge.to);
    const change = before === undefined ? 0 : edge.references - before.references;
    return [{ from, to, status: before === undefined ? 'new' : 'kept', references: edge.references, change, inCycle: edge.inCycle }];
  }));
}

// A dependency of the base is gone when the head does not have it between the partners of its two communities. An end
// that is a gone community is the node of that community, so that the graph shows where the dependency was.
export function goneEdgesOf(base: MapSnapshot, matching: Matching, nodes: NodeIndex): MapEdge[] {
  return base.communities.flatMap((community) => community.edges.flatMap((edge): MapEdge[] => {
    const [from, to] = [nodes.base.get(community.id), nodes.base.get(edge.to)];
    if (from === undefined || to === undefined || partnerEdgeOf(matching.headOf, community.id, edge.to) !== undefined) return [];
    return [{ from, to, status: 'gone', references: edge.references, change: 0, inCycle: false }];
  }));
}

function partnerEdgeOf(partners: Matching['baseOf'], from: string, to: string): SnapshotEdge | undefined {
  const target = partners.get(to);
  return target && partners.get(from)?.edges.find((edge) => edge.to === target.id);
}
