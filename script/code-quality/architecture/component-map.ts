import { componentNodesOf } from './component-nodes.ts';
import { componentEdgesOf, dependencyNoticeOf } from './component-edges.ts';
import type { CrapDelta } from './crap-delta.ts';
import { componentDependenciesOf } from './component-dependencies.ts';
import type { ArchitectureMap, MapSnapshot, MapSources } from './types.ts';

export function componentMapOf(sources: MapSources, delta: CrapDelta | undefined): ArchitectureMap {
  const nodes = componentNodesOf(sources, delta);
  const edges = componentEdgesOf(sources, nodes);
  const changed = nodes.some((node) => node.status !== 'kept' || node.touched || node.band?.band !== node.band?.before)
    || edges.some((edge) => edge.status !== 'kept') || componentCyclesChanged(sources);
  return { nodes, edges, changed };
}

function componentCyclesChanged(sources: MapSources): boolean {
  if (dependencyNoticeOf(sources) !== undefined) return false;
  const cycles = (snapshot: MapSnapshot) => [...componentDependenciesOf(snapshot)].filter(([, edge]) => edge.inCycle).map(([key]) => key).sort();
  return JSON.stringify(cycles(sources.base)) !== JSON.stringify(cycles(sources.head));
}
