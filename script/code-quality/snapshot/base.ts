import type { CheckedToolVersion } from '../shared/tool-version.ts';
import type { Notice } from './sweep.ts';
import { snapshotOfCommit } from './commit.ts';
import type { Snapshot } from './types.ts';
import { git, verifyBase } from '../shared/repository.ts';

export interface BaseRun {
  readonly toolVersion?: CheckedToolVersion;
  readonly allowToolVersion?: boolean;
  readonly root: string;
  readonly ref: string;
  readonly timeoutMs: number;
  readonly notice: Notice;
}

// The analysis runs in a temporary detached worktree of the merge base, so that the working tree of the caller stays
// as it is. The worktree gets no node_modules: ast-metrics parses the files and runs none of them. The snapshot names
// the merge base and its date, because the tree module reads HEAD of the tree that it analyzes.
export async function snapshotOfBase(run: BaseRun): Promise<Snapshot> {
  verifyBase(run.root, run.ref);
  const commit = git(run.root, ['merge-base', run.ref, 'HEAD'], `The base ref "${run.ref}" and HEAD have no merge base.`).trim();
  return snapshotOfCommit({ ...run, commit });
}
