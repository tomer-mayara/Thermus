#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { runReview, type ReviewOptions } from './review/run.ts';
import { CommandError, repositoryRoot } from './shared/repository.ts';

const help = `Usage: node script/code-quality/ast-metrics-review.ts [--base REF] [--max-findings N] [--allow-tool-version] [--help]

Report the ast-metrics findings that the working tree adds or makes worse
against the tree of REF. Uncommitted changes count. ast-metrics ignores each
violation that .ast-metrics-baseline.yaml at the repository root lists.

The command runs ast-metrics review at the repository root, prints its Markdown
report, and writes fresh reports to ast-report/review.md and ast-report/review.json.

Options:
  --base REF          Git ref to compare with (default: origin/main)
  --max-findings N    Most findings in the report (integer 1..1000; default: 50)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h          Show this help

Exit status 0: a complete review has no finding of high severity. Exit status 1:
a high finding exists, or the command failed. Missing, malformed, incomplete, or
inconsistent review results are command failures.
`;

const optionShape = {
  base: { type: 'string', default: 'origin/main' }, 'max-findings': { type: 'string', default: '50' },
  'allow-tool-version': { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
} as const;

function parsedValues(args: readonly string[]) {
  try {
    return parseArgs({ args, options: optionShape }).values;
  } catch {
    throw new CommandError('Invalid arguments. Use --help for the supported options.');
  }
}

function optionsOf(args: readonly string[]): ReviewOptions | { readonly help: true } {
  const values = parsedValues(args);
  if (values.help) return { help: true };
  const maxFindings = Number(values['max-findings']);
  if (!/^\d+$/.test(values['max-findings']) || maxFindings < 1 || maxFindings > 1000) {
    throw new CommandError('The --max-findings value must be an integer from 1 to 1000.');
  }
  // git and ast-metrics would take a ref that starts with a dash as an option.
  if (values.base === '' || values.base.startsWith('-')) throw new CommandError('The --base value must name a git ref.');
  return { base: values.base, maxFindings, allowToolVersion: values['allow-tool-version'] === true };
}

function main(args: readonly string[]): number {
  const options = optionsOf(args);
  if ('help' in options) {
    process.stdout.write(help);
    return 0;
  }
  const report = runReview(repositoryRoot(), options);
  process.stdout.write(report.text);
  return report.passed ? 0 : 1;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof CommandError)) throw error;
  process.stderr.write(`ast-metrics-review: ${error.message}\n`);
  process.exitCode = 1;
}
