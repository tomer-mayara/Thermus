import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { CommandError, git } from '../shared/repository.ts';
import type { ProcessOptions, ProcessResult, StageOutcome } from './types.ts';

interface Commits {
  readonly base: string;
  readonly head: string;
}

// The Markdown goes first, so that a failure to write the JSON keeps the saved report.
export function saveProcessReport(root: string, options: ProcessOptions, report: ProcessResult): void {
  const file = options.out === undefined ? join(root, 'ast-report', 'process.md') : resolve(options.out);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, report.text);
  if (options.json !== undefined) writeProcessJson(options.json, processJsonOf(processCommitsOf(root, options.base), report.outcomes));
}

function processJsonOf(commits: Commits, outcomes: readonly StageOutcome[]): string {
  const stages = outcomes.map(({ name, status, text }) => ({ name, status, text }));
  return `${JSON.stringify({ version: 1, base: commits.base, head: commits.head, outcomes: stages }, null, 2)}\n`;
}

// base is the merge base, not the ref, so that a reader can name the commit.
function processCommitsOf(root: string, base: string): Commits {
  const head = git(root, ['rev-parse', '--verify', 'HEAD^{commit}'], 'Cannot resolve HEAD.').trim();
  return { base: git(root, ['merge-base', base, head], `Cannot resolve the merge base of ${base}.`).trim(), head };
}

function writeProcessJson(file: string, text: string): void {
  const path = resolve(file);
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  } catch {
    throw new CommandError(`Cannot write the stage outcomes to ${file}.`);
  }
}
