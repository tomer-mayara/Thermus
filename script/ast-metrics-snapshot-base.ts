// A module, not a part of script/ast-metrics-snapshot.ts, because the later commands of
// docs/implementation/architecture-evolution-plan.md compare the snapshot of the merge base with the snapshot of the head.
import type { Notice } from './ast-metrics-snapshot-sweep.ts';
import { snapshotOfTree } from './ast-metrics-snapshot-tree.ts';
import type { Snapshot } from './ast-metrics-snapshot-types.ts';
import { addTemporaryWorktree } from './ast-metrics-snapshot-worktree.ts';
import { git, verifyBase } from './repository.ts';

export interface BaseRun {
  readonly root: string;
  readonly ref: string;
  // The deadline of the MCP session.
  readonly timeoutMs: number;
  // Gets the line about the stale worktrees that the run removed, or about the signal that stopped the run.
  readonly notice: Notice;
}

// The analysis runs in a temporary detached worktree of the merge base, so that the working tree of the caller stays
// as it is. The worktree gets no node_modules: ast-metrics parses the files and runs none of them. The snapshot names
// the merge base and its date, because the tree module reads HEAD of the tree that it analyzes.
export async function snapshotOfBase(run: BaseRun): Promise<Snapshot> {
  verifyBase(run.root, run.ref);
  const commit = git(run.root, ['merge-base', run.ref, 'HEAD'], `The base ref "${run.ref}" and HEAD have no merge base.`).trim();
  const worktree = addTemporaryWorktree(run.root, commit, run.notice);
  let failure: unknown;
  try {
    return await snapshotOfTree(worktree.folder, run.timeoutMs);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    worktree.remove(failure);
  }
}
