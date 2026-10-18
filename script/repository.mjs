// Shared by the ast-metrics commands: the repository root, the base ref, and the expected failures.
import { spawnSync } from 'node:child_process';

// An expected failure. A command prints its message as one diagnostic line on stderr and exits 1.
export class CommandError extends Error {}

export const notInstalled = 'ast-metrics is not installed or not on PATH. See docs/implementation/ast-metrics-review.md.';

const outputLimit = 64 * 1024 * 1024;

export function git(cwd, args, failureMessage) {
  const run = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: outputLimit });
  if (run.error) throw new CommandError(run.error.code === 'ENOENT' ? 'git is not installed or not on PATH.' : `git did not run: ${run.error.message}`);
  if (run.status !== 0) {
    const gitMessage = run.stderr.trim().split('\n')[0];
    throw new CommandError(gitMessage ? `${failureMessage} git: ${gitMessage}` : failureMessage);
  }
  return run.stdout;
}

// The root as git gives it: the physical path, also for a caller that came through a symbolic link.
export function repositoryRoot() {
  return git(process.cwd(), ['rev-parse', '--show-toplevel'], 'Run the command inside a git working tree.').trim();
}

export function verifyBase(root, base) {
  git(root, ['rev-parse', '--verify', '--quiet', `${base}^{commit}`], `The base ref "${base}" is not a commit in this repository. Fetch it, or name another ref with --base.`);
}
