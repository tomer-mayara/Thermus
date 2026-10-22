import { analysisOf, type Analysis } from './analysis.ts';
import type { Candidate } from './git-reads.ts';
import { labelCommand, orderedReasons, tierOf } from './tier.ts';
import type { LoadedRules } from './rules.ts';
import { tierNames, type CheckResult } from './types.ts';

const dirtyNote = 'Uncommitted changes are not part of the candidate: the check reads the commit HEAD only.';
const surfaceNote = 'The check does not compare declarations: compare the exported declarations of each module under "Surface differences" before and after the change, and record the result in the architecture impact.';
const manualNote = 'Local eligibility is preliminary. The manager or Delamain session must verify current local checks, holds, and required independent human approval.';

// Without a repository, the label command applies to the repository of the current folder.
export function resultOf(candidate: Candidate, rules: LoadedRules, repository: string | undefined): CheckResult {
  const analysis = analysisOf(candidate, rules);
  const reasons = orderedReasons(analysis.reasons);
  const tier = tierOf(reasons);
  const blockers = reasons.filter((reason) => reason.blocking);
  const { counts, tests } = analysis;
  return {
    tier, tierName: tierNames[tier], eligibility: blockers.length === 0 ? 'eligible' : 'blocked', blockers,
    candidate: candidate.head,
    mergeBase: candidate.mergeBase,
    reasons,
    questions: analysis.questions,
    changedPaths: candidate.changes,
    lineCounts: { production: counts.production, productionLimit: rules.base.limits.production, total: counts.total, totalLimit: rules.base.limits.total },
    tests: { added: tests.added, removed: tests.removedCases.length, skippedOrTodo: tests.skippedOrTodo },
    mi: analysis.mi,
    crap: analysis.crap,
    metrics: analysis.metrics,
    factsToDeclare: analysis.factsToDeclare,
    declaredFacts: analysis.declared,
    surfaceDifferences: analysis.surface,
    notes: notesOf(candidate, rules, analysis),
    label: labelCommand(tier, repository),
  };
}

function notesOf(candidate: Candidate, rules: LoadedRules, analysis: Analysis): string[] {
  return [
    ...(candidate.dirty ? [dirtyNote] : []),
    ...rules.notes,
    ...analysis.notes,
    ...(analysis.surface.length > 0 ? [surfaceNote] : []),
    manualNote,
  ];
}
