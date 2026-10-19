import type { DependencyPair } from '../dependencies/types.ts';
import { textOrder } from '../shared/order.ts';
import { matchingOf } from './match.ts';
import type { Matching } from './match.ts';
import type { ArchitectureMap, MapCommunity, MapEdge, MapNode, MapSources } from './types.ts';

export interface CommunityEdgeEvidence {
  readonly edge: MapEdge;
  readonly side: 'base' | 'head';
  readonly pairs: readonly DependencyPair[];
}

interface CommunityComparison {
  readonly sources: MapSources;
  readonly matching: Matching;
}

export function changedCommunityEdgesOf(sources: MapSources, map: ArchitectureMap): CommunityEdgeEvidence[] {
  const comparison = { sources, matching: matchingOf(sources.base.communities, sources.head.communities, sources.changes) };
  return map.edges.filter((edge) => edge.status !== 'kept').map((edge) => {
    const side = edge.status === 'gone' ? 'base' : 'head';
    return { edge, side, pairs: edgePairsOf(comparison, edge, side) };
  });
}

function edgePairsOf(comparison: CommunityComparison, edge: MapEdge, side: 'base' | 'head'): DependencyPair[] {
  const from = communityForNode(comparison, edge.from, side);
  const to = communityForNode(comparison, edge.to, side);
  if (from === undefined || to === undefined) return [];
  const pairs = comparison.sources[side].dependencies?.pairs.filter((pair) => from.members.includes(pair.from) && to.members.includes(pair.to)) ?? [];
  const unique = new Map(pairs.map((pair) => [JSON.stringify([pair.from, pair.to]), pair]));
  return [...unique.values()].sort((first, second) => textOrder(first.from, second.from) || textOrder(first.to, second.to));
}

function communityForNode({ sources, matching }: CommunityComparison, node: MapNode, side: 'base' | 'head'): MapCommunity | undefined {
  if (side === 'head') return sources.head.communities.find((community) => community.label === node.label);
  if (node.status === 'gone') return sources.base.communities.find((community) => community.label === node.label);
  const head = sources.head.communities.find((community) => community.label === node.label);
  return head === undefined ? undefined : matching.baseOf.get(head.id);
}
