import type { DependencyPair } from '../dependencies/types.ts';
import { communityPairDescriptionsOf } from './community-pair-identity.ts';
import { fileMappingOf } from './file-correspondence.ts';
import type { MapSources } from './types.ts';

type DependencySide = 'base' | 'head';

export function dependencyDescriptionsOf(sources: MapSources): (pair: DependencyPair, side: DependencySide) => string {
  const paths = fileMappingOf(sources.changes).after;
  const afterPair = (pair: DependencyPair): DependencyPair => ({ ...pair, from: paths.get(pair.from) ?? pair.from, to: paths.get(pair.to) ?? pair.to });
  const identityDescription = communityPairDescriptionsOf(sources);
  const basePairs = new Set((sources.base.dependencies?.pairs ?? []).map((pair) => pairKeyOf(afterPair(pair))));
  const headPairs = new Set((sources.head.dependencies?.pairs ?? []).map(pairKeyOf));
  return (pair, side) => {
    const canonical = side === 'base' ? afterPair(pair) : pair;
    const other = side === 'base' ? headPairs : basePairs;
    if (other.has(pairKeyOf(canonical))) return identityDescription(canonical);
    const snapshot = side === 'base' ? sources.head : sources.base;
    if (snapshot.dependencies === undefined || snapshot.dependencies.issues.length > 0) return 'comparison incomplete; import change unknown';
    return side === 'base' ? 'import removed' : 'import added';
  };
}

function pairKeyOf(pair: Pick<DependencyPair, 'from' | 'to'>): string {
  return JSON.stringify([pair.from, pair.to]);
}
