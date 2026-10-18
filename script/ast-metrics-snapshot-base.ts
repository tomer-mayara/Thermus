// A module, not a part of script/ast-metrics-snapshot.ts, because the later commands of
// docs/implementation/architecture-evolution-plan.md compare the snapshot of the merge base with the snapshot of the head.
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { snapshotOfTree } from './ast-metrics-snapshot-tree.ts';
import type { Snapshot } from './ast-metrics-snapshot-types.ts';
import { CommandError, git, verifyBase } from './repository.ts';

// The analysis runs in a temporary detached worktree of the merge base, so that the working tree of the caller stays
// as it is. The worktree gets no node_modules: ast-metrics parses the files and runs none of them. The snapshot names
// the merge base and its date, because the tree module reads HEAD of the tree that it analyzes. timeoutMs is the
// deadline of the MCP session.
export async function snapshotOfBase(root: string, ref: string, timeoutMs: number): Promise<Snapshot> {
  verifyBase(root, ref);
  const commit = git(root, ['merge-base', ref, 'HEAD'], `The base ref "${ref}" and HEAD have no merge base.`).trim();
  const folder = addWorktree(root, commit);
  let failure: unknown;
  try {
    return await snapshotOfTree(folder, timeoutMs);
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    removeWorktree(root, folder, failure);
  }
}

// mkdtemp makes a new empty folder, and git adds a worktree only to an empty folder. The folder is a real path, the form
// in which git names the root, also where the system temporary folder is a symbolic link, as on macOS.
function addWorktree(root: string, commit: string): string {
  const folder = realpathSync(mkdtempSync(join(tmpdir(), 'thermus-snapshot-base-')));
  try {
    git(root, ['worktree', 'add', '--detach', folder, commit], `git worktree add failed for the merge base ${commit}.`);
  } catch (error) {
    rmSync(folder, { recursive: true, force: true });
    throw error;
  }
  return folder;
}

// A worktree that stays is a failure of the command, also after a snapshot that succeeded, so that the caller knows
// that it stays. The diagnostic then also gives the failure of the analysis, if there was one.
function removeWorktree(root: string, folder: string, failure: unknown): void {
  try {
    git(root, ['worktree', 'remove', '--force', folder], `The temporary worktree ${folder} stays, because git worktree remove failed.`);
  } catch (error) {
    const cause = failure === undefined ? '' : `${messageOf(failure)} `;
    throw new CommandError(`${cause}${messageOf(error)}`);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
