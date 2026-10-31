import { cliToolVersion, type CheckedToolVersion } from '../shared/tool-version.ts';
import { CommandError, git } from '../shared/repository.ts';
import type { Notice } from './sweep.ts';
import { snapshotOfTree } from './tree.ts';
import type { Snapshot } from './types.ts';
import { addTemporaryWorktree } from './worktree.ts';

interface CommitRun {
  readonly root: string;
  readonly commit: string;
  readonly timeoutMs: number;
  readonly notice: Notice;
  readonly toolVersion?: CheckedToolVersion;
  readonly allowToolVersion?: boolean;
}

export async function snapshotOfCommit(run: CommitRun): Promise<Snapshot> {
  if (!/^[a-f0-9]{40}$/u.test(run.commit)) throw new CommandError('An exact snapshot needs a full 40-character commit.');
  const resolved = git(run.root, ['rev-parse', '--verify', `${run.commit}^{commit}`], 'Cannot verify the snapshot commit.').trim();
  if (resolved !== run.commit) throw new CommandError('The snapshot commit is not exact.');
  const checked = run.toolVersion ?? cliToolVersion(run.root, run.allowToolVersion);
  const worktree = addTemporaryWorktree(run.root, run.commit, run.notice);
  let failure: unknown;
  try {
    const snapshot = await snapshotOfTree(worktree.folder, run.timeoutMs, checked);
    if (snapshot.commit !== run.commit) throw new CommandError('The analyzed tree does not match the requested commit.');
    return snapshot;
  } catch (error) { failure = error; throw error; }
  finally { worktree.remove(failure); }
}
