import { spawnSync } from 'node:child_process';
import type { MapSnapshot } from './types.ts';
import { sourceFingerprintOf } from '../provenance/inputs.ts';
import { CommandError, git, repositoryRoot } from '../shared/repository.ts';
import { addTemporaryWorktree } from '../snapshot/worktree.ts';

export function recordBaseIfRequested(requested: boolean | undefined, store: string | undefined, base: MapSnapshot): boolean {
  if (!requested) return false;
  if (store === undefined) throw new CommandError('Cannot record without a trend store; use --trend-store.');
  if (canRecordBase(repositoryRoot(), base)) return true;
  process.stderr.write(`No record: ${base.commit.slice(0, 8)} is not on origin/main.\n`);
  return false;
}

// Identity and ancestry must be known before a caller can request any store mutation.
function canRecordBase(root: string, base: MapSnapshot): boolean {
  verifyCommit(root, base.commit);
  const date = git(root, ['show', '-s', '--format=%cI', base.commit], 'Cannot verify the base commit date.').trim();
  if (date !== base.date) throw new CommandError('Cannot record: the base snapshot date does not match its commit.');
  const ancestor = onMain(root, base.commit);
  if (ancestor) verifySource(root, base);
  return ancestor;
}

function verifyCommit(root: string, commit: string): void {
  if (!/^[a-f0-9]{40}$/u.test(commit)) throw new CommandError('Cannot record: the base snapshot needs a full 40-character commit.');
  const resolved = git(root, ['rev-parse', '--verify', `${commit}^{commit}`], 'Cannot verify the base snapshot commit.').trim();
  if (resolved !== commit) throw new CommandError('Cannot record: the base snapshot commit is not exact.');
  git(root, ['rev-parse', '--verify', 'origin/main^{commit}'], 'Cannot record without origin/main.');
}

function onMain(root: string, commit: string): boolean {
  const run = spawnSync('git', ['merge-base', '--is-ancestor', commit, 'origin/main'], { cwd: root, encoding: 'utf8' });
  if (run.status === 0) return true;
  if (run.status === 1) return false;
  throw new CommandError(`Cannot verify the base ancestry on origin/main. ${run.error?.message ?? run.stderr.trim()}`);
}

function verifySource(root: string, base: MapSnapshot): void {
  if (base.provenance === undefined) throw new CommandError('Cannot record: the base snapshot has no source fingerprint.');
  const tree = addTemporaryWorktree(root, base.commit, (message) => process.stderr.write(`${message}\n`));
  let failure: unknown;
  try {
    if (sourceFingerprintOf(tree.folder) !== base.provenance.sourceFingerprint) {
      throw new CommandError('Cannot record: the base snapshot source does not match its commit.');
    }
  } catch (error) { failure = error; throw error; }
  finally { tree.remove(failure); }
}
