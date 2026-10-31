import { spawnSync } from 'node:child_process';
import { CommandError } from './command-error.ts';
import { outputLimit } from './subprocess.ts';
export { CommandError, notInstalled } from './command-error.ts';

export function git(cwd: string, args: readonly string[], failureMessage: string): string {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: outputLimit });
  if (run.error) {
    const { code, message } = run.error as NodeJS.ErrnoException;
    throw new CommandError(code === 'ENOENT' ? 'git is not installed or not on PATH.' : `git did not run: ${message}`);
  }
  if (run.status !== 0) {
    const gitMessage = run.stderr.trim().split('\n')[0];
    throw new CommandError(gitMessage ? `${failureMessage} git: ${gitMessage}` : failureMessage);
  }
  return run.stdout;
}

// The root as git gives it: the physical path, also for a caller that came through a symbolic link.
export function repositoryRoot(): string {
  return git(process.cwd(), ['rev-parse', '--show-toplevel'], 'Run the command inside a git working tree.').trim();
}

export function verifyBase(root: string, base: string): void {
  git(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`], `The base ref "${base}" is not a commit in this repository. Fetch it, or name another ref with --base.`);
}
