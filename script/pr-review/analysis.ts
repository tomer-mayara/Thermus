import { evidenceReasons, evidenceRequirements } from './evidence.ts';
import { impactReasons } from './impact.ts';
import { changedPathsOf } from './changes.ts';
import { crapOutcome } from './crap.ts';
import type { Candidate } from './git-reads.ts';
import { metricsOutcome } from './metrics.ts';
import { pathOutcome } from './paths.ts';
import { ratchetOutcome } from './ratchet.ts';
import type { LoadedRules } from './rules.ts';
import { sizeOutcome } from './size.ts';
import { sourceOutcome } from './sources.ts';
import type { Declaration, Fact, Reason } from './types.ts';

export type Analysis = ReturnType<typeof analysisOf>;

// The merge-base policy applies; HEAD lists the candidate's declared dependency facts. Each declaration needs
// human review. A historical policy keeps its higher review requirement.
export function analysisOf(candidate: Candidate, rules: LoadedRules) {
  const paths = changedPathsOf(candidate.changes);
  const required = evidenceRequirements(candidate, rules);
  const located = pathOutcome(candidate.changes, rules.base, rules.path);
  const { facts, surface } = sourceOutcome(candidate, rules, paths);
  const size = sizeOutcome(candidate, rules.base);
  const ratchet = ratchetOutcome(candidate, rules.base);
  const crap = crapOutcome(candidate, rules.base);
  const metrics = metricsOutcome(candidate, rules.base);
  const contracts = surface.length > 0 ? [{ key: 'protected_paths.contracts', question: rules.base.contractsQuestion }] : [];
  const declared = declarationsOf(facts.declared);
  return {
    reasons: [
      ...facts.fix.map(reasonOf), ...located.reasons,
      ...declared.map((entry): Reason => ({ tier: 'T1', key: 'dependency_graph.declared', fact: `${entry.key}: ${entry.value}` })),
      ...surface, ...size.reasons, ...ratchet.reasons, ...crap.reasons, ...metrics.reasons,
      ...impactReasons(candidate.impact), ...evidenceReasons(candidate, rules),
    ].map((reason): Reason => rules.base.historical && reason.tier !== undefined ? { ...reason, tier: 'T2' } : reason),
    questions: [...new Map([...located.questions, ...contracts].map((entry) => [entry.key, entry] as const)).values()],
    counts: size.counts,
    tests: size.tests,
    mi: !required.production && candidate.snapshots === undefined ? ['not applicable: no changed production files'] : ratchet.lines,
    crap: !required.production && candidate.crap === undefined ? ['not applicable: no changed production files'] : crap.lines,
    metrics: !required.process && candidate.metrics === undefined ? ['not applicable: trusted policy selects no metrics process'] : metrics.lines,
    factsToDeclare: declarationsOf(facts.fix),
    declared,
    notes: facts.notes,
    surface: surface.map((reason) => reason.fact),
  };
}

function reasonOf(fact: Fact): Reason {
  return { blocking: true, key: fact.key, fact: fact.source === undefined ? fact.text : `${fact.text}, in ${fact.source}` };
}

function declarationsOf(facts: readonly Fact[]): Declaration[] {
  const declarations = new Map<string, Declaration>();
  for (const { declare } of facts) if (declare) declarations.set(`${declare.key}\0${declare.value}`, declare);
  return [...declarations.values()];
}
