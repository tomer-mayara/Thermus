import { changedPathsOf } from './changes.ts';
import { anyGlobMatches } from './globs.ts';
import type { Rules } from './rules.ts';
import type { Change, Question, Reason } from './types.ts';

type PathRules = Pick<Rules, 'protectedPaths' | 'policyQuestion' | 'readPaths' | 'scopes'>;

interface PathOutcome {
  readonly reasons: Reason[];
  readonly questions: Question[];
}

// Both paths of a rename count. A change to the rules file is always a policy change, also when no group lists the
// file: the facts that it declares need a human. The changed paths list the executable files, so one SHOW reason
// counts them.
export function pathOutcome(changes: readonly Change[], rules: PathRules, rulesPath: string): PathOutcome {
  const paths = changedPathsOf(changes);
  const located = protectedOutcome(paths, rules.protectedPaths);
  if (paths.includes(rulesPath)) addPolicyChange(located, rulesPath, rules.policyQuestion);
  const read = matching(paths, rules.readPaths, { route: 'READ', key: 'read_paths' });
  return { reasons: [...located.reasons, ...read, ...showReasons(changes, rules.scopes.executable)], questions: located.questions };
}

function showReasons(changes: readonly Change[], executable: readonly string[]): Reason[] {
  const count = changes.filter((change) => changedPathsOf([change]).some((path) => anyGlobMatches(executable, path))).length;
  return count > 0 ? [{ route: 'SHOW', key: 'scopes.executable', fact: `${count} changed ${count === 1 ? 'file' : 'files'}` }] : [];
}

function protectedOutcome(paths: readonly string[], groups: Rules['protectedPaths']): PathOutcome {
  const reasons: Reason[] = [];
  const questions: Question[] = [];
  for (const group of groups) {
    const key = `protected_paths.${group.name}`;
    const matched = matching(paths, group.paths, { route: 'ASK', key });
    reasons.push(...matched);
    if (matched.length > 0) questions.push({ key, question: group.question });
  }
  return { reasons, questions };
}

function addPolicyChange(outcome: PathOutcome, rulesPath: string, question: string): void {
  const key = 'protected_paths.policy';
  if (!outcome.reasons.some((reason) => reason.key === key && reason.fact === rulesPath)) outcome.reasons.push({ route: 'ASK', key, fact: rulesPath });
  if (!outcome.questions.some((entry) => entry.key === key)) outcome.questions.push({ key, question });
}

function matching(paths: readonly string[], patterns: readonly string[], reason: Omit<Reason, 'fact'>): Reason[] {
  return paths.filter((path) => anyGlobMatches(patterns, path)).map((path) => ({ ...reason, fact: path }));
}
