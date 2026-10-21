import { analysisOf, type Analysis } from './analysis.ts';
import type { Candidate } from './git-reads.ts';
import { labelCommand, orderedReasons, routeOf } from './route.ts';
import type { LoadedRules } from './rules.ts';
import type { CheckResult } from './types.ts';

const dirtyNote = 'Uncommitted changes are not part of the candidate: the check reads the commit HEAD only.';
const surfaceNote = 'The check does not compare declarations: compare the exported declarations of each module under "Surface differences" before and after the change, as the step "Declare or remove facts" says.';
const manualNote = 'The steps "Metrics" and "Decision" of the review route are manual: do them before Ready, as AGENTS.md says.';

// Without a repository, the label command applies to the repository of the current folder.
export function resultOf(candidate: Candidate, rules: LoadedRules, repository: string | undefined): CheckResult {
  const analysis = analysisOf(candidate, rules);
  const reasons = orderedReasons(analysis.reasons);
  const route = routeOf(reasons);
  const { counts, tests } = analysis;
  return {
    route,
    candidate: candidate.head,
    mergeBase: candidate.mergeBase,
    reasons,
    questions: analysis.questions,
    changedPaths: candidate.changes,
    lineCounts: { production: counts.production, productionLimit: rules.base.limits.production, total: counts.total, totalLimit: rules.base.limits.total },
    tests: { added: tests.added, removed: tests.removedCases.length, skippedOrTodo: tests.skippedOrTodo },
    mi: analysis.mi,
    crap: analysis.crap,
    factsToDeclare: analysis.factsToDeclare,
    declaredFacts: analysis.declared,
    surfaceDifferences: analysis.surface,
    notes: notesOf(candidate, rules, analysis),
    label: labelCommand(route, repository),
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
