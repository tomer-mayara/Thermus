import { realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { git } from '../shared/repository.ts';

// The folder of a temporary worktree is this prefix, the id of the process of its run, a dash, and a random part.
export const worktreePrefix = 'thermus-snapshot-base-';

export type Notice = (line: string) => void;

// A run that SIGKILL or a crash stopped leaves its temporary worktree. Each run thus removes the worktrees with the
// prefix in the system temporary folder whose process has ended. A worktree that git cannot remove stays, and the run
// goes on, so that a stale worktree never stops a later run.
export function removeStaleWorktrees(root: string, notice: Notice): void {
  git(root, ['worktree', 'prune'], 'git worktree prune failed.');
  const stale = temporaryWorktreesOf(root).filter((folder) => !runIsActive(folder));
  if (stale.length === 0) return;
  const kept = stale.filter((folder) => !removed(root, folder));
  notice(sweepLine(stale.length - kept.length, kept));
}

function temporaryWorktreesOf(root: string): string[] {
  const start = `worktree ${join(realpathSync(tmpdir()), worktreePrefix)}`;
  const lines = git(root, ['worktree', 'list', '--porcelain'], 'git worktree list failed.').split('\n');
  return lines.filter((line) => line.startsWith(start)).map((line) => line.slice('worktree '.length));
}

function runIsActive(folder: string): boolean {
  const pid = Number(new RegExp(`^${worktreePrefix}(\\d+)-`).exec(basename(folder))?.[1]);
  if (!Number.isInteger(pid) || pid === 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // The process exists, but it belongs to another user.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

// git locks a new worktree until its add is complete, so the worktree of a run that stopped in the add needs the
// second --force.
function removed(root: string, folder: string): boolean {
  try {
    git(root, ['worktree', 'remove', '--force', '--force', folder], 'git worktree remove failed.');
    return true;
  } catch {
    return false;
  }
}

function sweepLine(count: number, kept: readonly string[]): string {
  const line = `Removed ${count} stale temporary ${count === 1 ? 'worktree of an interrupted run' : 'worktrees of interrupted runs'}.`;
  return kept.length === 0 ? line : `${line} git worktree remove failed for ${kept.join(', ')}.`;
}
