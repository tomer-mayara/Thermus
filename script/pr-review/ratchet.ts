import { changedPathsOf } from './changes.ts';
import { coveringException, exceptionsOf, expiredReasons, type MiException } from './exceptions.ts';
import { anyGlobMatches } from './globs.ts';
import type { Rules } from './rules.ts';
import type { SnapshotPair } from './snapshots.ts';
import type { Change, Reason } from './types.ts';

const key = 'ratchet.maintainability_index';

// today is the committer date of HEAD, so that a rerun of the same candidate gives the same route.
interface RatchetInput {
  readonly changes: readonly Change[];
  readonly snapshots?: SnapshotPair;
  readonly exceptions?: string;
  readonly today: string;
}

interface Context {
  readonly snapshots: SnapshotPair;
  readonly limits: Rules['maintainability'];
  readonly entries: readonly MiException[];
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
  const context = { snapshots: input.snapshots, limits: rules.maintainability, entries, today: input.today };
  const files = productionChanges(input.changes, rules.scopes.production).map((change) => fileOutcomeOf(change, context));
  return { reasons: [...files.flatMap((file) => file.reasons), ...expired], lines: files.map((file) => file.line) };
}

// Both paths of a rename count. A deleted file has nothing to measure at HEAD.
function productionChanges(changes: readonly Change[], production: readonly string[]): Change[] {
  return changes.filter((change) => change.status !== 'D' && changedPathsOf([change]).some((path) => anyGlobMatches(production, path)));
}

function fileOutcomeOf(change: Change, context: Context): FileOutcome {
  return change.status === 'A' ? newFileOutcome(change.path, context) : changedFileOutcome(change, context);
}

function newFileOutcome(path: string, context: Context): FileOutcome {
  const raw = context.snapshots.head.get(path);
  if (raw === undefined) return notApplicable(path, 'head');
  return { line: `new: ${path}: ${raw}`, reasons: raw < context.limits.newFileBelow ? [belowReason(path, raw, context)] : [] };
}

function belowReason(path: string, raw: number, context: Context): Reason {
  const entry = coveringException(context.entries, { path, raw, today: context.today });
  if (entry === undefined) return { route: 'FIX', key: `${key}.new_file_below`, fact: `${path}: ${raw}` };
  return { route: 'READ', key: 'ratchet.exceptions', fact: `${path} covered by "${entry.reason}" until ${entry.expires}` };
}

// A renamed file continues its old path: the base value of the old path meets the head value of the new path.
function changedFileOutcome(change: Change, context: Context): FileOutcome {
  const shown = change.oldPath === undefined ? change.path : `${change.oldPath} -> ${change.path}`;
  const base = context.snapshots.base.get(change.oldPath ?? change.path);
  const head = context.snapshots.head.get(change.path);
  if (base === undefined) return notApplicable(shown, 'base');
  if (head === undefined) return notApplicable(shown, 'head');
  const values = `${shown}: ${base} to ${head}`;
  const dropped = dropOf(base, head) >= context.limits.existingFileDropReadAt;
  return { line: `changed: ${values}`, reasons: dropped ? [{ route: 'READ', key: `${key}.existing_file_drop_read_at`, fact: values }] : [] };
}

// Binary subtraction of decimal values can give 4.999999999999993 for a drop of five, so the drop keeps six decimals.
function dropOf(base: number, head: number): number {
  return Math.round((base - head) * 1e6) / 1e6;
}

function notApplicable(shown: string, snapshot: 'base' | 'head'): FileOutcome {
  return { line: `not applicable: ${shown}: no raw MI in the ${snapshot} snapshot`, reasons: [] };
}
