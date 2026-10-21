import { dependencyOutcome } from './facts.ts';
import type { Candidate } from './git-reads.ts';
import { sourceGraphOf } from './graph.ts';
import type { LoadedRules } from './rules.ts';
import { surfaceReasons } from './surface.ts';

export function sourceOutcome(candidate: Pick<Candidate, 'sourcePaths' | 'sources'>, rules: LoadedRules, changed: readonly string[]) {
  const graph = sourceGraphOf(candidate.sourcePaths, candidate.sources);
  return { facts: dependencyOutcome(graph, rules, new Set(changed)), surface: surfaceReasons(rules.base.surface, graph.imports, changed) };
}
