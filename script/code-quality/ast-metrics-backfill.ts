#!/usr/bin/env node
import { writeSync } from 'node:fs';
import { commandOf } from './backfill/command-line.ts';
import { backfillMain } from './backfill/run.ts';
import { reportFailure } from './shared/command-error.ts';
import { repositoryRoot } from './shared/repository.ts';

const help = `Usage: node script/code-quality/ast-metrics-backfill.ts [--count N] [--allow-tool-version] [--help]

Write missing structural trend records for the latest N first-parent commits of
origin/main to docs/metrics. Each analysis uses a detached temporary worktree of
that exact commit. Existing records are immutable. Backfill collects no coverage
and starts no test suite. Git history must be complete and origin/main available.
Worktrees are removed on success, failure, SIGINT, and SIGTERM.

Options:
  --count N             Positive safe integer commit count (default: 10)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h            Show this help

Exit status 0: selected records exist. Exit status 1: the command failed; records
already written remain. Exit status 130 or 143: SIGINT or SIGTERM stopped analysis.
`;

try {
  const command = commandOf(process.argv.slice(2));
  process.stdout.write(command.kind === 'help' ? help : await backfillMain({
    root: repositoryRoot(), count: command.count, allowToolVersion: command.allowToolVersion,
    notice: (line) => writeSync(process.stderr.fd, `ast-metrics-backfill: ${line}\n`),
  }));
} catch (error) { reportFailure('ast-metrics-backfill', error); }
