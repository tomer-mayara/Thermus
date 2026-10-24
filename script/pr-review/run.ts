import { CommandError } from '../code-quality/shared/command-error.ts';
import { verifyBase } from '../code-quality/shared/repository.ts';
import type { CheckOptions } from './command-line.ts';
import { crapRowsOf } from './crap-rows.ts';
import { architectureFilesOf, candidateOf, isDirty, revisionsOf, type Revisions } from './git-reads.ts';
import { metricsFilesOf } from './metrics-files.ts';
import { impactOf } from './impact.ts';
import { resultOf } from './result.ts';
import { rulesAt } from './rules-source.ts';
import type { LoadedRules } from './rules.ts';
import { snapshotPairOf } from './snapshots.ts';
import { snapshotOutcome, type SnapshotOutcome } from './surface-snapshot.ts';
import type { CheckResult } from './types.ts';

// The rules come first: the rules of the merge base name the files of the candidate that the check reads.
export function runCheck(root: string, options: CheckOptions): CheckResult {
  verifyBase(root, options.base);
  const dirty = isDirty(root);
  if (dirty && !options.allowDirty) {
    throw new CommandError('The working tree has uncommitted changes. Commit them, or run with --allow-dirty to check HEAD alone.');
  }
  const revisions = revisionsOf(root, options.base);
  const rules = rulesAt(root, revisions, options.rules);
  const snapshots = options.snapshots === undefined ? undefined : snapshotPairOf(options.snapshots, revisions);
  const crap = options.crap === undefined ? undefined : crapRowsOf(options.crap, revisions);
  const metrics = options.metrics === undefined ? undefined : metricsFilesOf(options.metrics, revisions.head);
  const impact = options.impact === undefined ? undefined : impactOf(options.impact, revisions);
  const candidate = { ...candidateOf(root, revisions, rules.base.scopes.production), ...architectureFilesOf(root, revisions, rules.base), dirty };
  const declarationSnapshots = declarationSnapshotsOf(root, rules, { revisions, dirty });
  return resultOf({ ...candidate, snapshots, crap, metrics, impact, declarationSnapshots }, rules, options.repository);
}

// The rules of HEAD name the snapshot folder that HEAD must keep current. Without one, the check compares nothing.
function declarationSnapshotsOf(root: string, rules: LoadedRules, state: { readonly revisions: Revisions; readonly dirty: boolean }): SnapshotOutcome | undefined {
  if (rules.head.surface.snapshots === undefined) return undefined;
  return snapshotOutcome({
    root, dirty: state.dirty,
    base: { commit: state.revisions.mergeBase, folder: rules.base.surface.snapshots, modules: rules.base.surface.modules },
    head: { commit: state.revisions.head, folder: rules.head.surface.snapshots, modules: rules.head.surface.modules },
  });
}
