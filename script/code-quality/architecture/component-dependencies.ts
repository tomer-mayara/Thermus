import { componentNameOf } from './component-name.ts';
import type { MapSnapshot } from './types.ts';

interface Edge {
  readonly from: string;
  readonly to: string;
  readonly references: number;
  readonly inCycle: boolean;
}

export function componentDependenciesOf(snapshot: MapSnapshot, legacyRoot = 'src'): Map<string, Edge> {
  const edges = [...importingFilesOf(snapshot, legacyRoot)].map(([key, files]): Edge => {
    const [from, to] = JSON.parse(key) as [string, string];
    return { from, to, references: files.size, inCycle: false };
  });
  return new Map(edges.map((edge) => [JSON.stringify([edge.from, edge.to]), { ...edge, inCycle: reaches(edges, edge.to, edge.from) }]));
}

function importingFilesOf(snapshot: MapSnapshot, legacyRoot: string): Map<string, Set<string>> {
  const nameOf = (path: string) => componentNameOf(path, snapshot.ownership, legacyRoot);
  const components = new Set(snapshot.files.map((file) => nameOf(file.path)));
  const measured = (name: string | undefined): name is string => name !== undefined && components.has(name);
  const importing = new Map<string, Set<string>>();
  for (const pair of snapshot.dependencies?.pairs ?? []) {
    const from = nameOf(pair.from);
    const to = nameOf(pair.to);
    if (!measured(from) || !measured(to) || from === to) continue;
    const key = JSON.stringify([from, to]);
    const files = importing.get(key) ?? new Set<string>();
    files.add(pair.from);
    importing.set(key, files);
  }
  return importing;
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
