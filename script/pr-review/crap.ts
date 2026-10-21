import { crapTextOf } from '../code-quality/architecture/crap-format.ts';
import { compareCrap } from '../code-quality/architecture/crap-score.ts';
import { crapAbsoluteOf } from '../code-quality/assessment/crap-absolute.ts';
import type { CrapRow } from './crap-rows.ts';
import { coveringCrapException, exceptionsOf, type CodeQualityException } from './exceptions.ts';
import { anyGlobMatches } from './globs.ts';
import type { Rules } from './rules.ts';
import type { Change, Reason } from './types.ts';

type Goals = ReturnType<typeof crapAbsoluteOf>;
type KnownCoverage = Extract<Goals['observation'], { kind: 'known-coverage' }>;

// A function of unknown identity has the goal of a new function. crapAbsoluteOf computes the goals 15 and 30 only, and
// the rules reader accepts no other values.
const goalOf = {
  new: { key: 'ratchet.crap.new_function_above', result: (goals: Goals) => goals.atMost15 },
  unknown: { key: 'ratchet.crap.new_function_above', result: (goals: Goals) => goals.atMost15 },
  changed: { key: 'ratchet.crap.changed_legacy_function_at_or_above', result: (goals: Goals) => goals.below30 },
} as const;

type AssessedRow = CrapRow & { readonly change: keyof typeof goalOf };

// today is the committer date of HEAD, so that a rerun of the same candidate gives the same route.
interface CrapInput {
  readonly changes: readonly Change[];
  readonly crap?: readonly CrapRow[];
  readonly exceptions?: string;
  readonly today: string;
}

// thresholds are the goals, so that a shown value keeps the side of each goal.
interface Context {
  readonly entries: readonly CodeQualityException[];
  readonly today: string;
  readonly thresholds: readonly number[];
}

interface RowOutcome {
  readonly line?: string;
  readonly reason?: Reason;
}

export function crapOutcome(input: CrapInput, rules: Pick<Rules, 'scopes' | 'crap'>): { reasons: Reason[]; lines: string[] } {
  if (input.crap === undefined) return { reasons: [], lines: ['not checked: give --crap'] };
  const changed = new Set(input.changes.filter((change) => change.status !== 'D' && anyGlobMatches(rules.scopes.production, change.path)).map((change) => change.path));
  const context = { entries: exceptionsOf(input.exceptions), today: input.today, thresholds: [rules.crap.changedLegacyFunctionAtOrAbove, rules.crap.newFunctionAbove] };
  const assessed = input.crap.filter((row): row is AssessedRow => row.change !== 'unchanged' && changed.has(row.file));
  const outcomes = assessed.map((row) => rowOutcomeOf(row, context));
  return { reasons: outcomes.flatMap(({ reason }) => reason ?? []), lines: outcomes.flatMap(({ line }) => line ?? []) };
}

function rowOutcomeOf(row: AssessedRow, context: Context): RowOutcome {
  const goals = crapAbsoluteOf(row.share === undefined ? { paths: row.paths } : { paths: row.paths, share: row.share });
  const goal = goalOf[row.change];
  const value = valueText(goals, context);
  if (goal.result(goals).state !== 'PASS') return { reason: missReason({ row, goals, value }, goal.key, context) };
  return { line: `${row.file}: ${row.function}: ${goals.observation.kind === 'known-coverage' ? value : `pass from the bound ${value}`}` };
}

function missReason(miss: { readonly row: AssessedRow; readonly goals: Goals; readonly value: string }, key: string, context: Context): Reason {
  const unit = `${miss.row.file}#${miss.row.function}`;
  const entry = coveringCrapException(context.entries, { function: unit, today: context.today, within: (bound) => withinBound(miss.goals, bound) });
  if (entry === undefined) return { route: 'FIX', key, fact: `${miss.row.file}: ${miss.row.function}: ${miss.value}` };
  return { route: 'ARCHITECT_REVIEW_NEEDED', key: 'ratchet.exceptions', fact: `${unit}: ${miss.value} covered by "${entry.reason}" until ${entry.expires}` };
}

// Without a covered share, p paths bound CRAP from p to p² + p, and zero paths prove 0.
function valueText(goals: Goals, context: Context): string {
  const seen = goals.observation;
  if (seen.kind === 'known-coverage') return crapTextOf(functionCrapOf(seen), context.thresholds);
  return seen.kind === 'missing-coverage' ? `[${seen.lower}, ${seen.upper}]` : '[0, 0]';
}

// The exact operands decide, so that a rounded value cannot hide a value above the bound.
function withinBound(goals: Goals, bound: number): boolean {
  const seen = goals.observation;
  if (seen.kind === 'known-coverage') return compareCrap(functionCrapOf(seen), bound) <= 0;
  return (seen.kind === 'missing-coverage' ? seen.upper : 0) <= bound;
}

function functionCrapOf(seen: KnownCoverage) {
  return { name: '', paths: seen.paths, share: seen.share, crap: seen.displayValue };
}
