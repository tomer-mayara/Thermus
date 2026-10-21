import { textOrder } from '../shared/order.ts';
import { componentDependenciesOf } from './component-dependencies.ts';
import type { MapEdge, MapNode, MapSources } from './types.ts';

export function dependencyNoticeOf({ base, head }: MapSources): string | undefined {
  if (base.dependencies === undefined || head.dependencies === undefined) return 'Legacy snapshot data: component edges and cycles are unavailable because dependency data is absent.';
  if (base.dependencies.issues.length + head.dependencies.issues.length > 0) return 'Component dependency evidence is incomplete: known head dependencies and proven cycles are shown; edge and cycle changes are withheld. Additional dependencies or cycles may exist.';
  return undefined;
}

export function componentEdgesOf(sources: MapSources, nodes: readonly MapNode[]): MapEdge[] {
  if (sources.base.dependencies === undefined || sources.head.dependencies === undefined) return [];
  const legacyRoot = sources.base.ownership?.app || sources.head.ownership?.app ? 'app' : 'src';
  const after = componentDependenciesOf(sources.head, legacyRoot);
  const before = dependencyNoticeOf(sources) === undefined ? componentDependenciesOf(sources.base, legacyRoot) : after;
  const nodeOf = new Map(nodes.map((node) => [node.label, node]));
  return [...new Map([...before, ...after])].flatMap(([key, edge]): MapEdge[] => {
    const from = nodeOf.get(edge.from);
    const to = nodeOf.get(edge.to);
    if (from === undefined || to === undefined) return [];
    const prior = before.get(key);
    const current = after.get(key);
    return [{ from, to, references: edge.references,
      status: current === undefined ? 'gone' : prior === undefined ? 'new' : 'kept',
      change: current === undefined || prior === undefined ? 0 : current.references - prior.references,
      inCycle: current?.inCycle ?? false,
    }];
  }).sort((first, second) => textOrder(first.from.label, second.from.label) || textOrder(first.to.label, second.to.label));
}
