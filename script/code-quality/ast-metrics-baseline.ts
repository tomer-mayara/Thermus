#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkAstMetricsStarted } from './shared/subprocess.ts';
import { reportCommandError } from './shared/command-error.ts';
import { parseCommandArguments } from './shared/command-line.ts';
import { ignoredEntryCount } from './baseline/ignored-count.ts';
import { CommandError, repositoryRoot } from './shared/repository.ts';
import { cliToolVersion } from './shared/tool-version.ts';

const help = `Usage: node script/code-quality/ast-metrics-baseline.ts [--allow-tool-version] [--help]

Run ast-metrics baseline from the repository root and report the ignored entry
counts before and after. A missing .ast-metrics-baseline.yaml starts at zero.

This command adds no permission to change .ast-metrics-baseline.yaml. Use it
only for a retained high finding or a change to .ast-metrics.yaml rules, under
the baseline policy in AGENTS.md.

Options:
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h            Show this help before Git or tool access

Exit status: 0 after a successful refresh and valid counts; 1 on failure.
`;

function optionsOf(args: readonly string[]) {
  return parseCommandArguments({ args, options: { 'allow-tool-version': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } }).values;
}

function baselineCount(root: string, allowMissing = false): number {
  let text: string;
  try {
    text = readFileSync(join(root, '.ast-metrics-baseline.yaml'), 'utf8');
  } catch (error) {
    if (allowMissing && (error as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw new CommandError(`Cannot read .ast-metrics-baseline.yaml: ${(error as Error).message}`);
  }
  return ignoredEntryCount(text);
}

function refresh(root: string): void {
  const run = spawnSync('ast-metrics', ['baseline'], { cwd: root, stdio: ['ignore', 'inherit', 'inherit'], timeout: 60_000 });
  checkAstMetricsStarted(run.error);
  if (run.status === null) throw new CommandError(`ast-metrics baseline stopped on signal ${run.signal}.`);
  if (run.status !== 0) throw new CommandError(`ast-metrics baseline failed with exit status ${run.status}.`);
}

function main(args: readonly string[]): void {
  const options = optionsOf(args);
  if (options.help) {
    process.stdout.write(help);
    return;
  }
  const root = repositoryRoot();
  const before = baselineCount(root, true);
  cliToolVersion(root, options['allow-tool-version']);
  refresh(root);
  const after = baselineCount(root);
  process.stdout.write(`Ignored entries before: ${before}.\nIgnored entries after: ${after}.\n`);
}

try {
  main(process.argv.slice(2));
} catch (error) {
  reportCommandError('ast-metrics-baseline', error);
}
