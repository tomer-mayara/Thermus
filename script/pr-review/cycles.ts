import { textOrder } from '../code-quality/shared/order.ts';
import type { PackageEdge } from './graph.ts';
import { allowsEdge, type GraphRules, type KnownCycle } from './rules-graph.ts';
import type { Fact } from './types.ts';

type CycleKind = KnownCycle['kind'];

// The package cycles, on the runtime edges and on all edges. A cycle passes when all its packages are members of one
// known cycle, so a known cycle may shrink. A runtime cycle needs a known runtime cycle. A cycle of all edges may
// match a known cycle of either kind; when it has the same packages as a runtime cycle, it is that cycle. No listing
// can declare a new cycle or a known cycle that grows, as no listing can allow a forbidden edge.
export function cycleFacts(edges: readonly PackageEdge[], rules: Pick<GraphRules, 'knownCycles' | 'allowedEdges'>): Fact[] {
  const known = rules.knownCycles;
  const runtime = componentsOf(edges.filter((edge) => edge.kind === 'runtime'));
  const all = componentsOf(edges).filter((members) => !runtime.some((other) => sameMembers(other, members)));
  return [...judged(runtime, known.filter((cycle) => cycle.kind === 'runtime'), 'runtime'), ...judged(all, known, 'all'), ...cycleEdgeFacts(edges, rules)];
}

function componentsOf(edges: readonly Pick<PackageEdge, 'from' | 'to'>[]): string[][] {
  const next = new Map<string, Set<string>>();
  for (const { from, to } of edges) {
    next.set(from, (next.get(from) ?? new Set()).add(to));
    if (!next.has(to)) next.set(to, new Set());
  }
  const reach = new Map([...next.keys()].map((node) => [node, reachableFrom(node, next)] as const));
  const components: string[][] = [];
  for (const node of [...next.keys()].sort(textOrder)) {
    const members = [...(reach.get(node) ?? [])].filter((other) => reach.get(other)?.has(node)).sort(textOrder);
    if (members.length > 1 && members[0] === node) components.push(members);
  }
  return components;
}

function reachableFrom(start: string, next: ReadonlyMap<string, ReadonlySet<string>>): Set<string> {
  const seen = new Set<string>();
  const stack = [...(next.get(start) ?? [])];
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    if (seen.has(node)) continue;
    seen.add(node);
    stack.push(...(next.get(node) ?? []));
  }
  return seen;
}

// A known cycle also grows when it gains an edge between two of its members that allowed_edges does not cover.
function cycleEdgeFacts(edges: readonly PackageEdge[], rules: Pick<GraphRules, 'knownCycles' | 'allowedEdges'>): Fact[] {
  return edges.filter((edge) => !allowsEdge(rules.allowedEdges, edge)).flatMap((edge) => {
    const cycle = rules.knownCycles.find(({ members }) => members.includes(edge.from) && members.includes(edge.to));
    if (!cycle) return [];
    const text = `${edge.from} -> ${edge.to} (${edge.kind}) inside the known cycle ${cycle.members.join(', ')}`;
    return [{ key: 'dependency_graph.triggers.known_cycle_grows', text, source: edge.source }];
  });
}

function judged(components: readonly string[][], known: readonly KnownCycle[], kind: CycleKind): Fact[] {
  return components.filter((members) => !known.some((cycle) => within(members, cycle.members))).map((members) => ({
    key: `dependency_graph.triggers.${known.some((cycle) => within(cycle.members, members)) ? 'known_cycle_grows' : 'cycle_not_listed'}`,
    text: `${members.join(', ')} (${kind})`,
  }));
}

function within(part: readonly string[], whole: readonly string[]): boolean {
  return part.every((member) => whole.includes(member));
}

function sameMembers(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && within(first, second);
}
