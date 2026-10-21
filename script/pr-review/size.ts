import type { NumstatRow } from './changes.ts';
import { anyGlobMatches } from './globs.ts';
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
  readonly limits: LineCounts;
}

export function sizeOutcome(input: SizeInput, rules: SizeRules) {
  const counts = {
    production: linesOf(input.productionNumstat),
    total: linesOf(input.numstat.filter((row) => !row.paths.some((path) => anyGlobMatches(rules.scopes.generated, path)))),
  };
  const tests = testCountsOf(input.testDiff);
  return { counts, tests, reasons: [...limitReasons(counts, rules.limits), ...testReasons(tests), ...snoozeReasons(input.snooze)] };
}

function linesOf(rows: readonly NumstatRow[]): number {
  return rows.reduce((sum, row) => sum + row.added + row.deleted, 0);
}

function limitReasons(counts: LineCounts, limits: LineCounts): Reason[] {
  const reasons: Reason[] = [];
  const read = (key: string, fact: string) => reasons.push({ route: 'ARCHITECT_REVIEW_NEEDED', key: `size.${key}`, fact });
  if (counts.production > limits.production) read('production_lines_read_above', `${counts.production} production lines, above the limit of ${limits.production}`);
  if (counts.total > limits.total) read('total_lines_read_above', `${counts.total} lines without generated files, above the limit of ${limits.total}`);
  return reasons;
}

// No snooze file is the same as an empty list.
function snoozeReasons(text: string | undefined): Reason[] {
  if (text === undefined || isEmptyList(text)) return [];
  return [{ route: 'FIX', key: 'size.habit_hooks_snooze_non_empty', fact: '.habit-hooks/snooze.json is not []' }];
}

function isEmptyList(text: string): boolean {
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) && value.length === 0;
  } catch {
    return false;
  }
}
