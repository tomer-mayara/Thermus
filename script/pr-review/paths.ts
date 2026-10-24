import { changedPathsOf, type NumstatRow } from './changes.ts';
import { anyGlobMatches } from './globs.ts';
import type { Rules } from './rules.ts';
import type { Change, Question, Reason } from './types.ts';

type PathRules = Pick<Rules, 'protectedPaths' | 'policyQuestion' | 'readPaths' | 'readRemovalPaths'>;

interface PathInput {
  readonly changes: readonly Change[];
  readonly numstat: readonly NumstatRow[];
}

interface PathOutcome {
  readonly reasons: Reason[];
  readonly questions: Question[];
  readonly notes: string[];
}

// Both paths of a rename count. A change to the rules file is always a policy change, also when no group lists the
// file: the facts that it declares need a human.
export function pathOutcome(input: PathInput, rules: PathRules, rulesPath: string): PathOutcome {
  const paths = changedPathsOf(input.changes);
  const located = protectedOutcome(paths, rules.protectedPaths);
  if (paths.includes(rulesPath)) addPolicyChange(located, rulesPath, rules.policyQuestion);
  const read = matching(paths, rules.readPaths, { tier: 'T1', key: 'read_paths' });
  const removal = removalOutcome(input, rules.readRemovalPaths);
  return { reasons: [...located.reasons, ...read, ...removal.reasons], questions: located.questions, notes: removal.notes };
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
  return { reasons, questions, notes: [] };
}

function addPolicyChange(outcome: PathOutcome, rulesPath: string, question: string): void {
  const key = 'protected_paths.policy';
  if (!outcome.reasons.some((reason) => reason.key === key && reason.fact === rulesPath)) outcome.reasons.push({ tier: 'T1', key, fact: rulesPath });
  if (!outcome.questions.some((entry) => entry.key === key)) outcome.questions.push({ key, question });
}

function matching(paths: readonly string[], patterns: readonly string[], reason: Omit<Reason, 'fact'>): Reason[] {
  return paths.filter((path) => anyGlobMatches(patterns, path)).map((path) => ({ ...reason, fact: path }));
}

// A feature adds its gate section, and a weaker gate removes text. Thus a document of read_paths.removal_paths needs
// T1 Team review only when the diff removes lines from it, deletes it, or moves it away.
function removalOutcome(input: PathInput, patterns: readonly string[]): Pick<PathOutcome, 'reasons' | 'notes'> {
  const paths = changedPathsOf(input.changes).filter((path) => anyGlobMatches(patterns, path));
  const removing = paths.filter((path) => removesLines(input, path));
  return {
    reasons: removing.map((path) => ({ tier: 'T1', key: 'read_paths', fact: path })),
    notes: paths.filter((path) => !removing.includes(path)).map((path) => `read_paths.removal_paths: the diff removes no lines from ${path}`),
  };
}

function removesLines(input: PathInput, path: string): boolean {
  const change = input.changes.find((entry) => entry.path === path || entry.oldPath === path);
  const deleted = input.numstat.find((row) => row.paths.includes(path))?.deleted ?? 0;
  return change?.status === 'D' || change?.oldPath === path || deleted > 0;
}
