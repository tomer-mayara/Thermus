import { factsOf } from './dependency-facts.ts';
import type { SourceGraph, UnresolvedImport } from './graph.ts';
import type { Rules } from './rules.ts';
import type { Fact } from './types.ts';

type GraphView = Pick<Rules, 'graph' | 'surface'>;

export interface FactOutcome {
  readonly fix: readonly Fact[];
  readonly declared: readonly Fact[];
  readonly notes: readonly string[];
}

export function dependencyOutcome(graph: SourceGraph, rules: { readonly base: GraphView; readonly head: GraphView }, changed: ReadonlySet<string>): FactOutcome {
  const { fix, declared } = splitFacts(factsOf(graph, rules.base, changed), factsOf(graph, rules.head, changed));
  const unresolved = unresolvedOutcome(graph.unresolved, changed);
  return { fix: [...unresolved.fix, ...fix], declared, notes: unresolved.notes };
}

// A fact that the rules of the merge base lack and the rules of HEAD list is declared: the pull request lists it in
// the rules file, a protected path. Each fact that the rules of HEAD lack is FIX, because the merge would bring it to
// main unlisted. A forbidden edge of the merge base stays FIX: no listing can allow it.
function splitFacts(base: readonly Fact[], head: readonly Fact[]): { readonly fix: Fact[]; readonly declared: Fact[] } {
  const atHead = new Set(head.map(identityOf));
  return {
    fix: uniqueFacts([...head, ...base.filter((fact) => fact.declare === undefined)]),
    declared: uniqueFacts(base.filter((fact) => fact.declare !== undefined && !atHead.has(identityOf(fact)))),
  };
}

// An import that does not resolve hides a dependency. It is FIX in a changed file and a note in an unchanged file.
function unresolvedOutcome(unresolved: readonly UnresolvedImport[], changed: ReadonlySet<string>): { readonly fix: Fact[]; readonly notes: string[] } {
  const key = 'dependency_graph.counting.unresolved_relative_import';
  return {
    fix: unresolved.filter((entry) => changed.has(entry.file)).map((entry) => ({ key, text: `${entry.file}: ${entry.detail}` })),
    notes: unresolved.filter((entry) => !changed.has(entry.file)).map((entry) => `Unresolved import in an unchanged file: ${entry.file}: ${entry.detail}`),
  };
}

// Facts with the same entry to declare are one fact, also under another trigger.
function identityOf(fact: Fact): string {
  return fact.declare ? `${fact.declare.key}\0${fact.declare.value}` : `${fact.key}\0${fact.text}`;
}

function uniqueFacts(facts: readonly Fact[]): Fact[] {
  const kept = new Map<string, Fact>();
  for (const fact of facts) if (!kept.has(identityOf(fact))) kept.set(identityOf(fact), fact);
  return [...kept.values()];
}
