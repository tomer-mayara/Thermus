import { isDeclarationFile, isTypeScript } from './code-files.ts';
import { changedPathsOf } from './changes.ts';
import { coveringException, exceptionsOf, expiredReasons, type CodeQualityException } from './exceptions.ts';
import { anyGlobMatches } from './globs.ts';
import type { Rules } from './rules.ts';
import type { SnapshotPair } from './snapshots.ts';
import type { Change, Reason } from './types.ts';

const key = 'ratchet.maintainability_index';

// today is the committer date of HEAD, so that a rerun of the same candidate gives the same tier.
interface RatchetInput {
  readonly changes: readonly Change[];
  readonly snapshots?: SnapshotPair;
  readonly exceptions?: string;
  readonly today: string;
}

interface Context {
  readonly production: readonly string[];
  readonly snapshots: SnapshotPair;
  readonly limits: Rules['maintainability'];
  readonly entries: readonly CodeQualityException[];
  readonly today: string;
}

interface FileOutcome {
  readonly line: string;
  readonly reasons: readonly Reason[];
}

interface RatchetOutcome {
  readonly reasons: Reason[];
  readonly lines: string[];
}

export function ratchetOutcome(input: RatchetInput, rules: Pick<Rules, 'scopes' | 'maintainability'>): RatchetOutcome {
  const entries = exceptionsOf(input.exceptions);
  const expired = expiredReasons(entries, changedPathsOf(input.changes), input.today);
  if (input.snapshots === undefined) return { reasons: expired, lines: ['not checked: give --base-snapshot and --head-snapshot'] };
  const context = { production: rules.scopes.production, snapshots: input.snapshots, limits: rules.maintainability, entries, today: input.today };
  const files = productionChanges(input.changes, rules.scopes.production).map((change) => fileOutcomeOf(change, context));
  return { reasons: [...files.flatMap((file) => file.reasons), ...expired], lines: files.map((file) => file.line) };
}

// Both paths of a rename count. A deleted file has nothing to measure at HEAD.
function productionChanges(changes: readonly Change[], production: readonly string[]): Change[] {
  return changes.filter((change) => change.status !== 'D' && changedPathsOf([change]).some((path) => anyGlobMatches(production, path)));
}

function fileOutcomeOf(change: Change, context: Context): FileOutcome {
  return change.status === 'A' ? newFileOutcome(change, context) : changedFileOutcome(change, context);
}

function newFileOutcome(change: Change, context: Context): FileOutcome {
  const path = change.path;
  const raw = context.snapshots.head.get(path);
  if (raw === undefined) return missingMi(change, 'head', context);
  return { line: `new: ${path}: ${raw}`, reasons: raw < context.limits.newFileBelow ? [belowReason(path, raw, context)] : [] };
}

function belowReason(path: string, raw: number, context: Context): Reason {
  const entry = coveringException(context.entries, { path, raw, today: context.today });
  if (entry === undefined) return { blocking: true, key: `${key}.new_file_below`, fact: `${path}: ${raw}` };
  return { tier: 'T1', key: 'ratchet.exceptions', fact: `${path} covered by "${entry.reason}" until ${entry.expires}` };
}

// A renamed file continues its old path: the base value of the old path meets the head value of the new path.
function changedFileOutcome(change: Change, context: Context): FileOutcome {
  const shown = change.oldPath === undefined ? change.path : `${change.oldPath} -> ${change.path}`;
  const base = context.snapshots.base.get(change.oldPath ?? change.path);
  const head = context.snapshots.head.get(change.path);
  if (base === undefined) return missingMi(change, 'base', context);
  if (head === undefined) return missingMi(change, 'head', context);
  const values = `${shown}: ${base} to ${head}`;
  const dropped = dropOf(base, head) >= context.limits.existingFileDropReadAt;
  return { line: `changed: ${values}`, reasons: dropped ? [{ tier: 'T1', key: `${key}.existing_file_drop_read_at`, fact: values }] : [] };
}

// Binary subtraction of decimal values can give 4.999999999999993 for a drop of five, so the drop keeps six decimals.
function dropOf(base: number, head: number): number {
  return Math.round((base - head) * 1e6) / 1e6;
}

function missingMi(change: Change, snapshot: 'base' | 'head', context: Context): FileOutcome {
  const path = snapshot === 'base' ? change.oldPath ?? change.path : change.path;
  const shown = change.oldPath === undefined ? change.path : `${change.oldPath} -> ${change.path}`;
  const fact = `${shown}: no raw MI in the ${snapshot} snapshot`;
  const notApplicable = !isTypeScript(path) || isDeclarationFile(path) || !anyGlobMatches(context.production, path) || context.snapshots.notApplicable?.[snapshot].has(path);
  return notApplicable ? { line: `not applicable: ${fact}`, reasons: [] }
    : { line: `unavailable: ${fact}`, reasons: [{ blocking: true, key: `${key}.missing`, fact }] };
}
