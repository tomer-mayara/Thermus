import { changedPathsOf } from './changes.ts';
import { anyGlobMatches } from './globs.ts';
import type { Rules } from './rules.ts';
import type { Change, Question, Reason } from './types.ts';

type PathRules = Pick<Rules, 'protectedPaths' | 'policyQuestion' | 'readPaths'>;

interface PathOutcome {
  readonly reasons: Reason[];
  readonly questions: Question[];
}

// Both paths of a rename count. A change to the rules file is always a policy change, also when no group lists the
// file: the facts that it declares need a human.
export function pathOutcome(changes: readonly Change[], rules: PathRules, rulesPath: string): PathOutcome {
  const paths = changedPathsOf(changes);
  const located = protectedOutcome(paths, rules.protectedPaths);
  if (paths.includes(rulesPath)) addPolicyChange(located, rulesPath, rules.policyQuestion);
  const read = matching(paths, rules.readPaths, { tier: 'T1', key: 'read_paths' });
  return { reasons: [...located.reasons, ...read], questions: located.questions };
}

function protectedOutcome(paths: readonly string[], groups: Rules['protectedPaths']): PathOutcome {
  const reasons: Reason[] = [];
  const questions: Question[] = [];
  for (const group of groups) {
    const key = `protected_paths.${group.name}`;
    const matched = matching(paths, group.paths, { tier: group.tier, key });
    reasons.push(...matched);
    if (matched.length > 0) questions.push({ key, question: group.question });
  }
  return { reasons, questions };
}

function addPolicyChange(outcome: PathOutcome, rulesPath: string, question: string): void {
  const key = 'protected_paths.policy';
  if (!outcome.reasons.some((reason) => reason.key === key && reason.fact === rulesPath)) outcome.reasons.push({ tier: 'T1', key, fact: rulesPath });
  if (!outcome.questions.some((entry) => entry.key === key)) outcome.questions.push({ key, question });
}

function matching(paths: readonly string[], patterns: readonly string[], reason: Omit<Reason, 'fact'>): Reason[] {
  return paths.filter((path) => anyGlobMatches(patterns, path)).map((path) => ({ ...reason, fact: path }));
}
