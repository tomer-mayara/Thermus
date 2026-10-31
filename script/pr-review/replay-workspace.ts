import { spawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isJsonObject, jsonOf, type JsonObject } from '../code-quality/shared/json.ts';
import { CommandError, git } from '../code-quality/shared/repository.ts';
import { deletionFailure, failureOf, folderPrefix, folderRemovalFailure, messageOf, refsFolder, removalFailure, removeStale, type Notice } from './replay-sweep.ts';

export const networkLimitMs = 120_000;

// The conventional exit statuses of a command that a signal stops: 128 and the number of the signal.
const stopStatus = { SIGINT: 130, SIGTERM: 143 } as const;
type StopSignal = keyof typeof stopStatus;

export type Stage = 'resolve' | 'install' | 'snapshots' | 'check';

export class StageFailure extends CommandError {
  readonly stage: Stage;

  constructor(stage: Stage, message: string) {
    super(message);
    this.stage = stage;
  }
}

interface RunOptions { readonly cwd: string; readonly limitMs: number; readonly env?: Readonly<Record<string, string>> }

interface ProcessRun { readonly status: number | null; readonly signal: NodeJS.Signals | null; readonly timedOut: boolean; readonly stdout: string; readonly stderr: string; readonly error?: Error }

// The temporary folder, worktree, refs, files, and child process of one replay run. A child process runs
// asynchronously, so that SIGINT and SIGTERM can stop the run while it waits: the handler stops the child, removes
// the rest, and ends the process. close removes the rest at the end of a run.
export class Workspace {
  readonly root: string;
  readonly folder: string;
  readonly #notice: Notice;
  readonly #refs: string[] = [];
  readonly #files: string[] = [];
  readonly #release: () => void;
  #worktree: string | undefined;
  #child: ChildProcess | undefined;

  // The folder is a real path, the form in which git names a worktree, also where the system temporary folder is a
  // symbolic link, as on macOS.
  constructor(root: string, notice: Notice) {
    this.root = root;
    this.#notice = notice;
    removeStale(root, notice);
    this.folder = realpathSync(mkdtempSync(join(tmpdir(), `${folderPrefix}${process.pid}-`)));
    this.#release = onStopSignals((signal) => this.#stop(signal));
  }

  run(command: string, args: readonly string[], options: RunOptions): Promise<ProcessRun> {
    const started = Date.now();
    const child = spawn(command, args, { cwd: options.cwd, env: { ...process.env, ...options.env }, stdio: ['ignore', 'pipe', 'pipe'], timeout: options.limitMs });
    this.#child = child;
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk));
    return new Promise((resolve) => {
      const finish = (status: number | null, signal: NodeJS.Signals | null, error?: Error) => {
        if (this.#child === child) this.#child = undefined;
        const timedOut = signal !== null && Date.now() - started >= options.limitMs;
        resolve({ status, signal, timedOut, error, stdout: Buffer.concat(stdout).toString('utf8'), stderr: Buffer.concat(stderr).toString('utf8') });
      };
      child.once('error', (error) => finish(null, null, error));
      child.once('close', (status, signal) => finish(status, signal));
    });
  }

  // Fetches source from origin into a temporary ref, so that git keeps its commit while the run uses it.
  async fetchRef(source: string, name: string): Promise<string> {
    const ref = `${refsFolder}/${process.pid}/${name}`;
    this.#refs.push(ref);
    outputOf(await this.run('git', ['fetch', '--quiet', '--no-tags', 'origin', `+${source}:${ref}`], { cwd: this.root, limitMs: networkLimitMs }), `git fetch origin ${source}`);
    return git(this.root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], `git fetch origin ${source} gave no commit.`).trim();
  }

  // Runs work in a temporary detached worktree of commit. A worktree that stays stops the run, so its error is not a
  // StageFailure, and inStage must not wrap a call of this method.
  async inWorktree<T>(commit: string, work: (folder: string) => Promise<T>): Promise<T> {
    const folder = this.#added(commit);
    const outcome = await settled(() => {
      linkPackages(this.root, folder);
      return work(folder);
    });
    this.#worktree = undefined;
    const stays = removalFailure(this.root, folder);
    if (stays !== undefined) throw new CommandError('error' in outcome ? `${messageOf(outcome.error)} ${stays}` : stays);
    if ('error' in outcome) throw outcome.error;
    return outcome.value;
  }

  // A file of the run outside each worktree, so that the check sees a clean tree.
  temporaryFile(name: string, text: string): string {
    const path = join(this.folder, name);
    this.#files.push(path);
    writeFileSync(path, text);
    return path;
  }

  close(): void {
    this.#release();
    const stays = this.#removeAll();
    if (stays !== undefined) throw new CommandError(stays);
  }

  // mkdtemp makes a new empty folder, and git adds a worktree only to an empty folder. No hook of the repository runs,
  // because a hook, such as one that installs packages, has nothing to do there.
  #added(commit: string): string {
    const folder = mkdtempSync(join(this.folder, 'worktree-'));
    try {
      git(this.root, ['-c', 'core.hooksPath=/dev/null', 'worktree', 'add', '--quiet', '--detach', folder, commit], `git worktree add failed for the commit ${commit}.`);
    } catch (error) {
      rmSync(folder, { recursive: true, force: true });
      throw error instanceof CommandError ? new StageFailure('install', error.message) : error;
    }
    this.#worktree = folder;
    return folder;
  }

  #stop(signal: StopSignal): void {
    this.#release();
    this.#child?.kill('SIGTERM');
    this.#notice(`Stopped by ${signal}. ${this.#removeAll() ?? 'The temporary folder, worktree, and refs are removed.'}`);
    process.exit(stopStatus[signal]);
  }

  #removeAll(): string | undefined {
    const worktree = this.#worktree;
    this.#worktree = undefined;
    const failures = [
      worktree === undefined ? undefined : removalFailure(this.root, worktree),
      ...this.#refs.splice(0).map((ref) => deletionFailure(this.root, ref)),
      failureOf(() => git(this.root, ['worktree', 'prune'], 'git worktree prune failed.')),
      folderRemovalFailure(this.folder, this.#files.splice(0)),
    ].filter((failure) => failure !== undefined);
    return failures.length === 0 ? undefined : failures.join(' ');
  }
}

export function outputOf(run: ProcessRun, what: string): string {
  if (run.error !== undefined) throw new CommandError(`${what} did not start: ${run.error.message}`);
  if (run.signal !== null) throw new CommandError(`${what} stopped with ${run.signal}${run.timedOut ? ' at its time limit' : ''}.`);
  if (run.status !== 0) throw new CommandError(`${what} failed with exit status ${run.status}: ${lastLine(run.stderr) || lastLine(run.stdout) || 'no diagnostic'}`);
  return run.stdout;
}

export function recordOf(text: string, what: string): JsonObject {
  const value = jsonOf(text);
  if (!isJsonObject(value)) throw new CommandError(`${what} is not a JSON object.`);
  return value;
}

// A diagnostic of the step becomes a failure of the pull request. Another error stops the run.
export async function inStage<T>(stage: Stage, work: () => T | Promise<T>, side?: string): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof StageFailure || !(error instanceof CommandError)) throw error;
    throw new StageFailure(stage, side === undefined ? error.message : `At the ${side}: ${error.message}`);
  }
}

// git ignores node_modules/ as a folder only. A link in place of the folder would be an untracked file, and the check
// refuses a dirty tree. So the worktree gets a real folder with a link to each entry of the node_modules of the root:
// the snapshot command runs the compiler from the node_modules of the worktree.
function linkPackages(root: string, folder: string): void {
  const packages = join(root, 'node_modules');
  const links = join(folder, 'node_modules');
  mkdirSync(links);
  for (const name of readdirSync(packages)) symlinkSync(join(packages, name), join(links, name));
}

async function settled<T>(work: () => Promise<T>): Promise<{ readonly value: T } | { readonly error: unknown }> {
  try {
    return { value: await work() };
  } catch (error) {
    return { error };
  }
}

function onStopSignals(stop: (signal: StopSignal) => void): () => void {
  const onInterrupt = () => stop('SIGINT');
  const onTerminate = () => stop('SIGTERM');
  process.on('SIGINT', onInterrupt).on('SIGTERM', onTerminate);
  return () => { process.off('SIGINT', onInterrupt).off('SIGTERM', onTerminate); };
}

// A command writes its notes first and its diagnostic last, so the last line names the failure.
function lastLine(text: string): string {
  return text.trim().split('\n').at(-1)?.trim() ?? '';
}
