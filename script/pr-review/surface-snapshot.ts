import { CommandError } from '../code-quality/shared/command-error.ts';
import { committedFiles, committedSnapshots, lineCountOf, lineCountsOf, snapshotDiff, type SnapshotTree, type SnapshotTrees } from './declaration-commits.ts';
import { emitDeclarations, ignoredNote, snapshotPathOf } from './declaration-emit.ts';
import type { Reason } from './types.ts';

interface SnapshotRevision {
  readonly commit: string;
  readonly folder?: string;
  readonly modules: readonly string[];
}

// dirty: the working tree differs from HEAD, so a regeneration from the working tree cannot prove the committed files.
export interface SnapshotInput {
  readonly root: string;
  readonly base: SnapshotRevision;
  readonly head: SnapshotRevision;
  readonly dirty: boolean;
}

export interface SnapshotDifference {
  readonly module: string;
  readonly status: 'changed' | 'added' | 'removed';
  readonly added: number;
  readonly removed: number;
  readonly diff: string;
}

// reasons holds blocking reasons only: a stale, missing, or orphan snapshot at HEAD, or a failed regeneration. The
// engine selects the tier of a difference. lines are report lines: the counts, and the skipped comparison when the
// merge base has no snapshots.
export interface SnapshotOutcome {
  readonly reasons: Reason[];
  readonly differences: readonly SnapshotDifference[];
  readonly lines: string[];
}

const remedy = 'run node script/pr-review/api-surface.ts and commit';
const unverified = 'public_surface.snapshots.unverified';

export function snapshotOutcome(input: SnapshotInput): SnapshotOutcome {
  const { root, base, head } = input;
  if (head.folder === undefined) return { reasons: [], differences: [], lines: ['no declaration snapshots: public_surface.snapshots is not set at HEAD'] };
  const headTree = { commit: head.commit, folder: head.folder };
  const modules = [...new Set(head.modules)];
  const reasons = input.dirty
    ? [{ blocking: true as const, key: unverified, fact: 'the working tree differs from HEAD, so the snapshots of HEAD cannot be regenerated; commit first' }]
    : verificationReasons(root, headTree, modules);
  if (base.folder === undefined) return { reasons, differences: [], lines: ['the merge base has no declaration snapshots: no declaration comparison'] };
  const trees = { base: { commit: base.commit, folder: base.folder }, head: headTree };
  const differences = differencesOf(root, trees, [...new Set([...modules, ...base.modules])]);
  return { reasons, differences, lines: [countLine(modules.length, differences)] };
}

// A clean working tree is HEAD, so its regeneration proves the committed files of HEAD.
function verificationReasons(root: string, tree: SnapshotTree, modules: readonly string[]): Reason[] {
  const committed = committedSnapshots(root, tree, modules);
  const owned = new Set(modules.map((module) => snapshotPathOf(tree.folder, module)));
  return [
    ...modules.filter((module) => !committed.has(module)).map((module) => snapshotReason('missing', module)),
    ...staleReasons(root, committed, modules),
    ...committedFiles(root, tree).filter((path) => !owned.has(path)).map((path) => snapshotReason('orphan', path)),
  ];
}

function staleReasons(root: string, committed: ReadonlyMap<string, string>, modules: readonly string[]): Reason[] {
  let emitted: ReadonlyMap<string, string>;
  try {
    emitted = regenerated(root, modules);
  } catch (error) {
    if (!(error instanceof CommandError)) throw error;
    return [{ blocking: true, key: unverified, fact: `the snapshots of HEAD could not be regenerated: ${error.message}` }];
  }
  return [...committed].filter(([module, text]) => emitted.get(module) !== text).map(([module]) => snapshotReason('stale', module));
}

function regenerated(root: string, modules: readonly string[]): ReadonlyMap<string, string> {
  const declarations = emitDeclarations(root, modules);
  const note = ignoredNote(declarations.ignored);
  if (note !== undefined) process.stderr.write(`pr-review-check: ${note}\n`);
  return declarations.texts;
}

function snapshotReason(kind: 'stale' | 'missing' | 'orphan', subject: string): Reason {
  return { blocking: true, key: `public_surface.snapshots.${kind}`, fact: `${subject}: ${remedy}` };
}

function differencesOf(root: string, trees: SnapshotTrees, modules: readonly string[]): SnapshotDifference[] {
  const before = committedSnapshots(root, trees.base, modules);
  const after = committedSnapshots(root, trees.head, modules);
  return modules.flatMap((module) => differenceOf(module, { before: before.get(module), after: after.get(module) }, () => snapshotDiff(root, trees, module)));
}

function differenceOf(module: string, texts: { readonly before?: string; readonly after?: string }, diffOf: () => string): SnapshotDifference[] {
  const { before, after } = texts;
  if (before === undefined) return after === undefined ? [] : [{ module, status: 'added', added: lineCountOf(after), removed: 0, diff: '' }];
  if (after === undefined) return [{ module, status: 'removed', added: 0, removed: lineCountOf(before), diff: '' }];
  if (before === after) return [];
  const diff = diffOf();
  return [{ module, status: 'changed', ...lineCountsOf(diff), diff }];
}

function countLine(modules: number, differences: readonly SnapshotDifference[]): string {
  const count = (status: SnapshotDifference['status']) => differences.filter((difference) => difference.status === status).length;
  const others = (['added', 'removed'] as const).filter((status) => count(status) > 0).map((status) => `${count(status)} ${status}`);
  return [counted(modules, 'public module'), `${counted(count('changed'), 'snapshot')} changed`, ...others].join(', ');
}

function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}
