import type { DependencyPair } from '../dependencies/types.ts';
import { fileMappingOf } from './file-correspondence.ts';
import { matchingOf } from './match.ts';
import type { Matching } from './match.ts';
import type { MapCommunity, MapSources } from './types.ts';

interface PairCommunities {
  readonly before: ReadonlyMap<string, MapCommunity>;
  readonly after: ReadonlyMap<string, MapCommunity>;
  readonly matching: Matching;
}

export function communityPairDescriptionsOf(sources: MapSources): (pair: DependencyPair) => string {
  const moved = fileMappingOf(sources.changes).after;
  const communities: PairCommunities = {
    before: new Map(sources.base.communities.flatMap((community) => community.members.map((path) => [moved.get(path) ?? path, community] as const))),
    after: new Map(sources.head.communities.flatMap((community) => community.members.map((path) => [path, community] as const))),
    matching: matchingOf(sources.base.communities, sources.head.communities, sources.changes),
  };
  return (pair) => {
    const ends = [pair.from, pair.to].map((path) => endpointStatusOf(communities, path));
    if (ends.includes('unmatched')) return 'unchanged import; community identity unmatched';
    return ends.includes('regrouped') ? 'unchanged import; community regrouping' : 'unchanged import pair';
  };
}

function endpointStatusOf(communities: PairCommunities, path: string): 'unmatched' | 'regrouped' | 'same' {
  const before = communities.before.get(path);
  const after = communities.after.get(path);
  if (before === undefined || after === undefined) return 'unmatched';
  const matched = communities.matching.headOf.get(before.id);
  if (matched === undefined || !communities.matching.baseOf.has(after.id)) return 'unmatched';
  return matched.id === after.id ? 'same' : 'regrouped';
}
