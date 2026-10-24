import type { NumstatRow } from './changes.ts';
import { anyGlobMatches } from './globs.ts';
import type { Rules } from './rules.ts';
import { signalsOf, type SignalOutcomes } from './signals.ts';
import { testCountsOf, testReasons } from './test-counts.ts';
import type { Reason } from './types.ts';

interface LineCounts {
  readonly production: number;
  readonly total: number;
}

// productionNumstat comes from a diff that git limits to scopes.production, so a file that moves into that scope
// counts all its lines. testDiff is the output of git diff -U0 --no-prefix for the files under test/.
interface SizeInput {
  readonly numstat: readonly NumstatRow[];
  readonly productionNumstat: readonly NumstatRow[];
  readonly testDiff: string;
  readonly snooze?: string;
}

interface SizeRules {
  readonly scopes: { readonly generated: readonly string[] };
  readonly limits: Rules['limits'];
  readonly skippedOrTodo: Rules['skippedOrTodo'];
}

export function sizeOutcome(input: SizeInput, rules: SizeRules) {
  const counts = {
    production: linesOf(input.productionNumstat),
    total: linesOf(input.numstat.filter((row) => !row.paths.some((path) => anyGlobMatches(rules.scopes.generated, path)))),
  };
  const tests = testCountsOf(input.testDiff);
  const limits = limitOutcome(counts, rules.limits);
  return { counts, tests, reasons: [...limits.reasons, ...testReasons(tests, rules.skippedOrTodo), ...snoozeReasons(input.snooze)], notes: limits.notes };
}

function linesOf(rows: readonly NumstatRow[]): number {
  return rows.reduce((sum, row) => sum + row.added + row.deleted, 0);
}

function limitOutcome(counts: LineCounts, limits: Rules['limits']): SignalOutcomes {
  const production = signalsOf(limits.outcome, { T1: 'size.production_lines_read_above', note: 'size.production_lines_note_above' },
    counts.production > limits.production ? [`${counts.production} production lines, above the limit of ${limits.production}`] : []);
  const total = signalsOf(limits.outcome, { T1: 'size.total_lines_read_above', note: 'size.total_lines_note_above' },
    counts.total > limits.total ? [`${counts.total} lines without generated files, above the limit of ${limits.total}`] : []);
  return { reasons: [...production.reasons, ...total.reasons], notes: [...production.notes, ...total.notes] };
}

// No snooze file is the same as an empty list.
function snoozeReasons(text: string | undefined): Reason[] {
  if (text === undefined || isEmptyList(text)) return [];
  return [{ blocking: true, key: 'size.habit_hooks_snooze_non_empty', fact: '.habit-hooks/snooze.json is not []' }];
}

function isEmptyList(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) && value.length === 0;
  } catch {
    return false;
  }
}
