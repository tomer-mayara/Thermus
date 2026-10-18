import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeStaleWorktrees, worktreePrefix, type Notice } from './ast-metrics-snapshot-sweep.ts';
import { CommandError, git } from './repository.ts';

// A detached worktree of one commit in the system temporary folder, for the time of one run. A worktree that stays is
// a failure of the command, also after a snapshot that succeeded, so that the caller knows that it stays; the
// diagnostic then also gives the failure of the analysis, if there was one.
export interface TemporaryWorktree {
  readonly folder: string;
  remove(failure: unknown): void;
}

// The conventional exit statuses of a command that a signal stops: 128 and the number of the signal.
const stopStatus = { SIGINT: 130, SIGTERM: 143 } as const;
type StopSignal = keyof typeof stopStatus;

// mkdtemp makes a new empty folder, and git adds a worktree only to an empty folder. The folder is a real path, the
// form in which git names the root, also where the system temporary folder is a symbolic link, as on macOS. Its name
// holds the id of the process, so that a later run can tell the worktree of an interrupted run from that of an active
// run. From the add to the removal, SIGINT and SIGTERM remove the worktree and end the process.
export function addTemporaryWorktree(root: string, commit: string, notice: Notice): TemporaryWorktree {
  removeStaleWorktrees(root, notice);
  const folder = realpathSync(mkdtempSync(join(tmpdir(), `${worktreePrefix}${process.pid}-`)));
  const release = onStopSignals((signal) => {
    release();
    notice(`Stopped by ${signal}. ${removalFailure(root, folder) ?? 'The temporary worktree is removed.'}`);
    process.exit(stopStatus[signal]);
  });
  try {
    addWorktree(root, folder, commit);
  } catch (error) {
    release();
    rmSync(folder, { recursive: true, force: true });
    throw error;
  }
  return {
    folder,
    remove: (failure) => {
      release();
      const stays = removalFailure(root, folder);
      if (stays !== undefined) throw new CommandError(failure === undefined ? stays : `${messageOf(failure)} ${stays}`);
    },
  };
}

// No hook of the repository runs, because a hook, such as one that installs packages, has nothing to do in the
// temporary tree.
function addWorktree(root: string, folder: string, commit: string): void {
  git(root, ['-c', 'core.hooksPath=/dev/null', 'worktree', 'add', '--detach', folder, commit], `git worktree add failed for the merge base ${commit}.`);
}

// Gives the function that ends the guard. A signal can come while a synchronous step runs, such as the analysis; the
// handler then runs after that step.
function onStopSignals(stop: (signal: StopSignal) => void): () => void {
  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  process.on('SIGINT', onInterrupt).on('SIGTERM', onTerminate);
  return () => { process.off('SIGINT', onInterrupt).off('SIGTERM', onTerminate); };
}

function removalFailure(root: string, folder: string): string | undefined {
  try {
    git(root, ['worktree', 'remove', '--force', folder], `The temporary worktree ${folder} stays, because git worktree remove failed.`);
    return undefined;
  } catch (error) {
    return messageOf(error);
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
