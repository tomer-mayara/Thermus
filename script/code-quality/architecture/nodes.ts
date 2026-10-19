import { bandRuleOf } from './bands.ts';
import type { CrapDelta } from './crap-delta.ts';
import type { Matching } from './match.ts';
import type { CommunityNumbers, MapCommunity, MapNode, MapSources } from './types.ts';

// The node of each community, by its id in each snapshot. A matched base community has the node of its head community,
// so that a dependency of the base finds the node that the graph shows.
export interface NodeIndex {
  readonly head: ReadonlyMap<string, MapNode>;
  readonly base: ReadonlyMap<string, MapNode>;
}

type NodeMarks = Pick<MapNode, 'touched' | 'band'>;

// Without coverage, a node has no band.
export function nodeIndexOf(sources: MapSources, matching: Matching, delta: CrapDelta | undefined): NodeIndex {
  const touched = new Set(sources.touched);
  const bandOf = bandRuleOf(delta);
  const marksOf = (community: MapCommunity, band: MapNode['band']) => ({ touched: community.members.some((member) => touched.has(member)), band });
  const head = new Map(sources.head.communities.map((community): [string, MapNode] => {
    const before = matching.baseOf.get(community.id);
    return [community.id, headNodeOf(community, before, marksOf(community, bandOf(community, before)))];
  }));
  const nodeOfPartner = (community: MapCommunity) => {
    const partner = matching.headOf.get(community.id);
    return partner && head.get(partner.id);
  };
  const base = new Map(sources.base.communities.map((community): [string, MapNode] => [community.id, nodeOfPartner(community) ?? goneNodeOf(community, marksOf(community, bandOf(undefined, community)))]));
  return { head, base };
}

function headNodeOf(community: MapCommunity, before: MapCommunity | undefined, marks: NodeMarks): MapNode {
  return { label: community.label, status: before === undefined ? 'new' : 'kept', ...marks, numbers: community, change: before && changeOf(community, before) };
}

function goneNodeOf(community: MapCommunity, marks: NodeMarks): MapNode {
  return { label: community.label, status: 'gone', ...marks, numbers: community };
}

function changeOf(after: CommunityNumbers, before: CommunityNumbers): CommunityNumbers {
  const maintainability = after.maintainability === undefined || before.maintainability === undefined ? undefined : after.maintainability - before.maintainability;
  return { files: after.files - before.files, maintainability, paths: after.paths - before.paths };
}
