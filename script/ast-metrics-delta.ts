#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { analyzeDelta, reportFolder } from './ast-metrics-delta-analysis.ts';
import { deltaReportOf } from './ast-metrics-delta-report.ts';
import { CommandError, git, repositoryRoot, verifyBase } from './repository.ts';

const help = `Usage: node script/ast-metrics-delta.ts [--base REF] [--min SCORE] [--no-compare] [--help]

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
  --help, -h      Show this help

Exit status 0: each measured production file is at the goal or more. Exit
status 1: a production file is below the goal, or the command failed. A file
with "no goal" or "not measured" never fails the check.
`;

const typeScriptFiles = ['*.ts', '*.tsx', '*.mts', '*.cts'];
const optionShape = {
  base: { type: 'string', default: 'origin/main' }, min: { type: 'string', default: '85' },
  'no-compare': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
} as const;

type DeltaOptions = { readonly base: string; readonly min: number; readonly compare: boolean };

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
  return { base: values.base, min: Number(values.min), compare: values['no-compare'] !== true };
}

// Without rename detection, git lists a renamed file as an added file, so the check measures it at its new path.
function deltaFiles(root: string, base: string): string[] {
  const changed = git(root, ['diff', '--name-only', '-z', '--no-renames', '--diff-filter=AM', '--merge-base', base, '--', ...typeScriptFiles], `git diff against ${base} failed.`);
  const untracked = git(root, ['ls-files', '-z', '--others', '--exclude-standard', '--', ...typeScriptFiles], 'git ls-files failed.');
  return [...new Set(`${changed}${untracked}`.split('\0').filter((file) => file !== ''))].sort();
}

function main(args: readonly string[]): number {
  const options = optionsOf(args);
  if ('help' in options) {
    process.stdout.write(help);
    return 0;
  }
  const root = repositoryRoot();
  verifyBase(root, options.base);
  const files = deltaFiles(root, options.base);
  if (files.length === 0) {
    process.stdout.write(`No TypeScript file is added or changed against ${options.base}.\n`);
    return 0;
  }
  const report = deltaReportOf(analyzeDelta(root, files, options), options.min);
  process.stdout.write(report.text);
  if (options.compare) process.stdout.write(`Comparison with ${options.base}: ${reportFolder}/compare.html\n`);
  return report.passed ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof CommandError)) throw error;
  process.stderr.write(`ast-metrics-delta: ${error.message}\n`);
  process.exitCode = 1;
}
