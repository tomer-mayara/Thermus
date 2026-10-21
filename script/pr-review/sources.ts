import { componentOf, componentOwnersOf } from '../component-ownership.ts';
import { dependencyOutcome } from './facts.ts';
import type { Candidate } from './git-reads.ts';
import { sourceGraphOf } from './graph.ts';
import type { Rules } from './rules.ts';
import { surfaceReasons } from './surface.ts';

type SourcePolicy = Pick<Rules, 'graph' | 'surface'>;

export function sourceOutcome(candidate: Pick<Candidate, 'sourcePaths' | 'sources'> & Partial<Pick<Candidate, 'changes'>>, rules: { readonly base: SourcePolicy; readonly head: SourcePolicy }, changed: readonly string[]) {
  const owners = componentOwnersOf(candidate.sourcePaths, rules.head.graph.components);
  const ownerOf = (path: string) => owners.get(path) ?? componentOf(path, rules.head.graph.components) ?? path;
  const graph = sourceGraphOf(candidate.sourcePaths, candidate.sources, ownerOf);
  const moves = new Map((candidate.changes ?? []).flatMap((change) => change.status.startsWith('R') && change.oldPath !== undefined ? [[change.oldPath, change.path] as const] : []));
  const oldPaths = new Map([...moves].map(([before, after]) => [after, before]));
  const baseOwnerOf = (path: string) => componentOf(oldPaths.get(path) ?? path, rules.base.graph.components) ?? ownerOf(path);
  const baseGraph = sourceGraphOf(candidate.sourcePaths, candidate.sources, baseOwnerOf);
  const base = { ...rules.base, surface: { ...rules.base.surface, modules: rules.base.surface.modules.map((path) => moves.get(path) ?? path) } };
  const dependencyChanged = new Set([...changed, ...candidate.sourcePaths.filter((path) => ownerOf(path) !== baseOwnerOf(path))]);
  const surfaces = [...surfaceReasons(base.surface, baseGraph, changed), ...surfaceReasons(rules.head.surface, graph, changed)];
  return { facts: dependencyOutcome({ base: { graph: baseGraph, rules: base }, head: { graph, rules: rules.head } }, dependencyChanged),
    surface: [...new Map(surfaces.map((reason) => [reason.fact, reason])).values()] };
}
