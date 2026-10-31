import { readdirSync, realpathSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { git } from '../code-quality/shared/repository.ts';

// The temporary folder of a run is this prefix, the id of the process of the run, a dash, and a random part; it holds
// the worktrees and the files of the run. The refs of a run are under refs/replay/<id of the process>/. The id lets a
// later run tell what an ended run left from what an active run uses.
export const folderPrefix = 'thermus-replay-';
export const refsFolder = 'refs/replay';

export type Notice = (line: string) => void;

// A run that SIGKILL or a crash stopped leaves its folder, its worktree, and its refs. Each run thus removes those of
// the runs whose process has ended. What git cannot remove stays, with the folder that holds it, and the run goes on,
// so that a leftover never stops a run.
export function removeStale(root: string, notice: Notice): void {
  git(root, ['worktree', 'prune'], 'git worktree prune failed.');
  const temporary = realpathSync(tmpdir());
  const worktrees = removedWorktrees(root, temporary);
  const refs = removedRefs(root);
  const folders = staleFoldersOf(temporary).filter((folder) => !worktrees.kept.some((kept) => kept === folder || kept.startsWith(`${folder}/`)));
  for (const folder of folders) rmSync(folder, { recursive: true, force: true });
  const kept = [...worktrees.kept, ...refs.kept];
  const removed = worktrees.removed + refs.removed + folders.length;
  if (removed + kept.length > 0) notice(`Removed ${removed} stale temporary folders, worktrees, and refs of interrupted runs.${kept.length === 0 ? '' : ` These stay: ${kept.join(', ')}.`}`);
}

export function removalFailure(root: string, folder: string): string | undefined {
  return failureOf(() => git(root, ['worktree', 'remove', '--force', folder], `The temporary worktree ${folder} stays, because git worktree remove failed.`));
}

export function deletionFailure(root: string, ref: string): string | undefined {
  return failureOf(() => git(root, ['update-ref', '-d', ref], `The temporary ref ${ref} stays, because git update-ref -d failed.`));
}

// rmdir removes an empty folder only, so the folder of a run stays with a worktree that git could not remove.
export function folderRemovalFailure(folder: string, files: readonly string[]): string | undefined {
  try {
    for (const file of files) rmSync(file, { force: true });
    rmdirSync(folder);
    return undefined;
  } catch (error) {
    return `The temporary folder ${folder} stays: ${messageOf(error)}`;
  }
}

export function failureOf(action: () => unknown): string | undefined {
  try {
    action();
    return undefined;
  } catch (error) {
    return messageOf(error);
  }
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// git locks a new worktree until its add is complete, so the worktree of a run that stopped in the add needs the
// second --force.
function removedWorktrees(root: string, temporary: string): { readonly removed: number; readonly kept: readonly string[] } {
  const lines = git(root, ['worktree', 'list', '--porcelain'], 'git worktree list failed.').split('\n');
  const stale = lines.filter((line) => line.startsWith('worktree ')).map((line) => line.slice('worktree '.length)).filter((folder) => isStale(relative(temporary, folder)));
  const kept = stale.filter((folder) => failureOf(() => git(root, ['worktree', 'remove', '--force', '--force', folder], 'git worktree remove failed.')) !== undefined);
  return { removed: stale.length - kept.length, kept };
}

// A ref under refs/replay without the id of a process belongs to no run, so it stays.
function removedRefs(root: string): { readonly removed: number; readonly kept: readonly string[] } {
  const refs = git(root, ['for-each-ref', '--format=%(refname)', `${refsFolder}/`], 'git for-each-ref failed.').split('\n');
  const stale = refs.filter((ref) => /^refs\/replay\/\d+\//u.test(ref) && !runIsActive(Number(ref.split('/')[2])));
  const kept = stale.filter((ref) => deletionFailure(root, ref) !== undefined);
  return { removed: stale.length - kept.length, kept };
}

function staleFoldersOf(temporary: string): string[] {
  return readdirSync(temporary).filter(isStale).map((name) => join(temporary, name));
}

function isStale(path: string): boolean {
  if (!path.startsWith(folderPrefix)) return false;
  return !runIsActive(Number(/^(\d+)-/u.exec(path.slice(folderPrefix.length))?.[1]));
}

function runIsActive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // The process exists, but it belongs to another user.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}
