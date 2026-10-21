import { changedPathsOf } from './changes.ts';
import { crapOutcome } from './crap.ts';
import type { Candidate } from './git-reads.ts';
import { pathOutcome } from './paths.ts';
import { ratchetOutcome } from './ratchet.ts';
import type { LoadedRules } from './rules.ts';
import { sizeOutcome } from './size.ts';
import { sourceOutcome } from './sources.ts';
import type { Declaration, Fact, Reason } from './types.ts';

export type Analysis = ReturnType<typeof analysisOf>;

// The rules of the merge base apply. The rules of HEAD only tell which dependency facts the candidate declares. Each
// declared fact is ASK, so that a human reads it also when the change of the rules file is the only other reason.
export function analysisOf(candidate: Candidate, rules: LoadedRules) {
  const paths = changedPathsOf(candidate.changes);
  const located = pathOutcome(candidate.changes, rules.base, rules.path);
  const { facts, surface } = sourceOutcome(candidate, rules, paths);
  const size = sizeOutcome(candidate, rules.base);
  const ratchet = ratchetOutcome(candidate, rules.base);
  const crap = crapOutcome(candidate, rules.base);
  const contracts = surface.length > 0 ? [{ key: 'protected_paths.contracts', question: rules.base.contractsQuestion }] : [];
  const declared = declarationsOf(facts.declared);
  return {
    reasons: [
      ...facts.fix.map(reasonOf), ...located.reasons,
      ...declared.map((entry): Reason => ({ route: 'ASK', key: 'dependency_graph.declared', fact: `${entry.key}: ${entry.value}` })),
      ...surface, ...size.reasons, ...ratchet.reasons, ...crap.reasons,
    ],
    questions: [...new Map([...located.questions, ...contracts].map((entry) => [entry.key, entry] as const)).values()],
    counts: size.counts,
    tests: size.tests,
    mi: ratchet.lines,
    crap: crap.lines,
    factsToDeclare: declarationsOf(facts.fix),
    declared,
    notes: facts.notes,
    surface: surface.map((reason) => reason.fact),
  };
}

function reasonOf(fact: Fact): Reason {
  return { route: 'FIX', key: fact.key, fact: fact.source === undefined ? fact.text : `${fact.text}, in ${fact.source}` };
}

function declarationsOf(facts: readonly Fact[]): Declaration[] {
  const declarations = new Map<string, Declaration>();
  for (const { declare } of facts) if (declare) declarations.set(`${declare.key}\0${declare.value}`, declare);
  return [...declarations.values()];
}
