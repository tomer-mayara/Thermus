import { CommandError } from '../code-quality/shared/command-error.ts';
import { verifyBase } from '../code-quality/shared/repository.ts';
import type { CheckOptions } from './command-line.ts';
import { crapRowsOf } from './crap-rows.ts';
import { candidateOf, isDirty, revisionsOf } from './git-reads.ts';
import { resultOf } from './result.ts';
import { rulesAt } from './rules-source.ts';
import { snapshotPairOf } from './snapshots.ts';
import type { CheckResult } from './types.ts';

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
  return resultOf({ ...candidateOf(root, revisions, rules.base.scopes.production), dirty, snapshots, crap }, rules, options.repository);
}
