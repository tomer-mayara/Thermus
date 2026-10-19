import { componentNameOf } from './component-name.ts';
import type { MapSnapshot } from './types.ts';

interface Edge {
  readonly from: string;
  readonly to: string;
  readonly references: number;
  readonly inCycle: boolean;
}

export function componentDependenciesOf(snapshot: MapSnapshot): Map<string, Edge> {
  const importing = new Map<string, Set<string>>();
  const components = new Set(snapshot.files.map((file) => componentNameOf(file.path)));
  for (const pair of snapshot.dependencies?.pairs ?? []) {
    const from = componentNameOf(pair.from);
    const to = componentNameOf(pair.to);
    if (from === undefined || to === undefined || from === to || !components.has(from) || !components.has(to)) continue;
    const key = JSON.stringify([from, to]);
    const files = importing.get(key) ?? new Set<string>();
    files.add(pair.from);
    importing.set(key, files);
  }
  const edges = [...importing].map(([key, files]): Edge => {
    const [from, to] = JSON.parse(key) as [string, string];
    return { from, to, references: files.size, inCycle: false };
  });
  return new Map(edges.map((edge) => [JSON.stringify([edge.from, edge.to]), { ...edge, inCycle: reaches(edges, edge.to, edge.from) }]));
}

function reaches(edges: readonly Edge[], start: string, target: string): boolean {
  const pending = [start];
  const seen = new Set<string>();
  while (pending.length > 0) {
    const node = pending.pop();
    if (node === undefined) break;
    if (node === target) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    pending.push(...edges.filter((edge) => edge.from === node).map((edge) => edge.to));
  }
  return false;
}
