import type { MapNode, MapSources } from './ast-metrics-architecture-types.ts';

// The snapshot of the head can hold changes that are not committed, so the header names the base commit only.
export function headerOf({ base }: MapSources): string {
  return `## Architecture of src/: base ${base.commit.slice(0, 8)} → head`;
}

// A share keeps two decimals. The communities include the shared kernel, and the count of the new and the gone ones
// follows when there are such.
export function summaryOf({ base, head }: MapSources, nodes: readonly MapNode[]): string {
  const counts = (['new', 'gone'] as const)
    .map((status) => `${nodes.filter((node) => node.status === status).length} ${status}`)
    .filter((count) => !count.startsWith('0 '));
  return [
    `Modularity ${base.global.modularity.toFixed(2)} → ${head.global.modularity.toFixed(2)}`,
    `cross share ${base.global.crossShare.toFixed(2)} → ${head.global.crossShare.toFixed(2)}`,
    `cycles ${base.global.cycles.length} → ${head.global.cycles.length}`,
    `communities ${base.communities.length} → ${head.communities.length}${counts.length === 0 ? '' : ` (${counts.join(', ')})`}`,
  ].join(' · ');
}
