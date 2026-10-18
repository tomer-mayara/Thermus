import type { Matching } from './ast-metrics-architecture-match.ts';
import type { CommunityNumbers, MapCommunity, MapNode, MapSources } from './ast-metrics-architecture-types.ts';

// The node of each community, by its id in each snapshot. A matched base community has the node of its head community,
// so that a dependency of the base finds the node that the graph shows.
export interface NodeIndex {
  readonly head: ReadonlyMap<string, MapNode>;
  readonly base: ReadonlyMap<string, MapNode>;
}

export function nodeIndexOf(sources: MapSources, matching: Matching): NodeIndex {
  const touched = new Set(sources.touched);
  const isTouched = (community: MapCommunity) => community.members.some((member) => touched.has(member));
  const head = new Map(sources.head.communities.map((community): [string, MapNode] => [community.id, headNodeOf(community, matching.baseOf.get(community.id), isTouched(community))]));
  const nodeOfPartner = (community: MapCommunity) => {
    const partner = matching.headOf.get(community.id);
    return partner && head.get(partner.id);
  };
  const base = new Map(sources.base.communities.map((community): [string, MapNode] => [community.id, nodeOfPartner(community) ?? goneNodeOf(community, isTouched(community))]));
  return { head, base };
}

function headNodeOf(community: MapCommunity, before: MapCommunity | undefined, touched: boolean): MapNode {
  return { label: community.label, status: before === undefined ? 'new' : 'kept', touched, numbers: community, change: before && changeOf(community, before) };
}

function goneNodeOf(community: MapCommunity, touched: boolean): MapNode {
  return { label: community.label, status: 'gone', touched, numbers: community };
}

function changeOf(after: CommunityNumbers, before: CommunityNumbers): CommunityNumbers {
  const maintainability = after.maintainability === undefined || before.maintainability === undefined ? undefined : after.maintainability - before.maintainability;
  return { files: after.files - before.files, maintainability, paths: after.paths - before.paths };
}
