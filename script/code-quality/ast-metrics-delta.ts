#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { runDelta, type DeltaOptions } from './delta/run.ts';
import { CommandError, repositoryRoot } from './shared/repository.ts';

const help = `Usage: node script/code-quality/ast-metrics-delta.ts [--base REF] [--min SCORE] [--no-compare] [--allow-tool-version] [--help]

Check the maintainability score of each TypeScript file that is added or changed
against REF. The delta holds the changes from the merge base of REF and HEAD to
the working tree: committed, staged, and unstaged changes, and the new files that
git does not ignore. Deleted files are not in the delta.

The goal applies to the production files only: the files under src/. The command
runs ast-metrics analyze at the repository root and prints one line for each
delta file: first the production files, lowest score first, then the other
files, such as tests, lowest score first and marked "no goal". A file that
ast-metrics does not measure, such as a file with types only, comes last and is
marked "not measured". The reports go to ast-report/.

Options:
  --base REF      Git ref to compare with (default: origin/main)
  --min SCORE     Goal for each production file (integer 0..128; default: 85)
  --no-compare    Do not add the comparison with REF to the HTML report
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h      Show this help

Exit status 0: each measured production file is at the goal or more. Exit
status 1: a production file is below the goal, or the command failed. A file
with "no goal" or "not measured" never fails the check.
`;

const optionShape = {
  base: { type: 'string', default: 'origin/main' }, min: { type: 'string', default: '85' },
  'allow-tool-version': { type: 'boolean' }, 'no-compare': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
} as const;

function parsedValues(args: readonly string[]) {
  try {
    return parseArgs({ args, options: optionShape }).values;
  } catch {
    throw new CommandError('Invalid arguments. Use --help for the supported options.');
  }
}

function optionsOf(args: readonly string[]): DeltaOptions | { readonly help: true } {
  const values = parsedValues(args);
  if (values.help) return { help: true };
  if (!/^\d+$/.test(values.min) || Number(values.min) > 128) throw new CommandError('The --min value must be an integer from 0 to 128.');
  // git and ast-metrics would take a ref that starts with a dash as an option.
  if (values.base === '' || values.base.startsWith('-')) throw new CommandError('The --base value must name a git ref.');
  return { allowToolVersion: values['allow-tool-version'] === true, base: values.base, min: Number(values.min), compare: values['no-compare'] !== true };
}

function main(args: readonly string[]): number {
  const options = optionsOf(args);
  if ('help' in options) {
    process.stdout.write(help);
    return 0;
  }
  const report = runDelta(repositoryRoot(), options);
  process.stdout.write(report.text);
  return report.passed ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof CommandError)) throw error;
  process.stderr.write(`ast-metrics-delta: ${error.message}\n`);
  process.exitCode = 1;
}
