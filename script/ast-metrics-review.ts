#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { CommandError, notInstalled, repositoryRoot, verifyBase } from './repository.ts';

const help = `Usage: node script/ast-metrics-review.ts [--base REF] [--max-findings N] [--help]

Report the ast-metrics findings that the working tree adds or makes worse
against the tree of REF. Uncommitted changes count. ast-metrics ignores each
violation that .ast-metrics-baseline.yaml at the repository root lists.

The command runs ast-metrics review at the repository root, prints its Markdown
report, and writes the same report to ast-report/review.md.

Options:
  --base REF          Git ref to compare with (default: origin/main)
  --max-findings N    Most findings in the report (integer 1..1000; default: 50)
  --help, -h          Show this help

Exit status: the status of ast-metrics review, which is 1 when a finding of
high severity exists and 0 when none exists. The command also exits 1 when it
fails.
`;

const optionShape = {
  base: { type: 'string', default: 'origin/main' }, 'max-findings': { type: 'string', default: '50' },
  help: { type: 'boolean', short: 'h' },
} as const;

type ReviewOptions = { readonly base: string; readonly maxFindings: number };

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
  return { base: values.base, maxFindings };
}

// With --fail-on high, the exit status of ast-metrics is the result: 1 when a finding of high severity exists.
function review(root: string, options: ReviewOptions): number {
  const args = [
    'review', '--base', options.base, '--format', 'markdown', '--max-findings', String(options.maxFindings),
    '--report-markdown', './ast-report/review.md', '--fail-on', 'high',
  ];
  const run = spawnSync('ast-metrics', args, { cwd: root, stdio: ['ignore', 'inherit', 'inherit'] });
  if (run.error) {
    const { code, message } = run.error as NodeJS.ErrnoException;
    throw new CommandError(code === 'ENOENT' ? notInstalled : `ast-metrics did not run: ${message}`);
  }
  if (run.status === null) throw new CommandError(`ast-metrics review stopped on signal ${run.signal}.`);
  return run.status;
}

function main(args: readonly string[]): number {
  const options = optionsOf(args);
  if ('help' in options) {
    process.stdout.write(help);
    return 0;
  }
  const root = repositoryRoot();
  verifyBase(root, options.base);
  if (!existsSync(join(root, '.ast-metrics-baseline.yaml'))) {
    process.stderr.write('ast-metrics-review: no .ast-metrics-baseline.yaml; every existing rule violation counts as new.\n');
  }
  // ast-metrics fails when the folder of the report does not exist.
  mkdirSync(join(root, 'ast-report'), { recursive: true });
  return review(root, options);
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof CommandError)) throw error;
  process.stderr.write(`ast-metrics-review: ${error.message}\n`);
  process.exitCode = 1;
}
