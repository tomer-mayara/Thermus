#!/usr/bin/env node
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { sourceScriptsIn } from './coverage/input.ts';
import { mergedCoverage } from './coverage/merge.ts';
import { writeCoverageReport } from './coverage/report.ts';
import { withUnitSuiteCoverage } from './coverage/run.ts';
import { CommandError, git, repositoryRoot } from './shared/repository.ts';

const help = `Usage: node script/code-quality/ast-metrics-coverage.ts [--from DIR] [--out FILE] [--help]

Measure the coverage of each function of src/ by the unit suite. The command runs
node --test on "dist/test/unit/**/*.test.js" in the repository root, with
NODE_V8_COVERAGE set to a temporary folder. Run npm run build first. The output of
the suite goes to stderr. Each Node process of the run writes a V8 coverage file
at exit, and the command merges these files.

The report holds each function of the scripts under dist/src/, the build of src/:
its name, its range in the compiled JavaScript, the count of its calls, and its
covered share, the part of its characters that at least one process ran. A
function without a name is "(anonymous)". The compiler helpers, whose names start
with __, and the functions inside them are not in the report.

Options:
  --from DIR    Read the coverage files of an earlier run of the unit suite from
                DIR, and do not run the suite
  --out FILE    Write the report to FILE (default: ast-report/coverage.json)
  --help, -h    Show this help

Exit status 0: the report is written. Exit status 1: the suite failed, the coverage
files disagree, or the command failed. Then no report is written.
`;

const defaultOut = 'ast-report/coverage.json';
const optionShape = { from: { type: 'string' }, out: { type: 'string' }, help: { type: 'boolean', short: 'h' } } as const;

type CoverageOptions = { readonly from: string | undefined; readonly out: string | undefined };

function parsedValues(args: readonly string[]) {
  try {
    return parseArgs({ args, options: optionShape }).values;
  } catch {
    throw new CommandError('Invalid arguments. Use --help for the supported options.');
  }
}

function optionsOf(args: readonly string[]): CoverageOptions | { readonly help: true } {
  const values = parsedValues(args);
  if (values.help) return { help: true };
  if (values.from === '') throw new CommandError('The --from value must name a folder.');
  if (values.out === '') throw new CommandError('The --out value must name a file.');
  return { from: values.from, out: values.out };
}

function main(args: readonly string[]): number {
  const options = optionsOf(args);
  if ('help' in options) {
    process.stdout.write(help);
    return 0;
  }
  const root = repositoryRoot();
  // The run of the suite takes minutes. A repository without a commit fails before it.
  const commit = git(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], 'HEAD names no commit. Commit first.').trim();
  const coverageIn = (folder: string) => mergedCoverage(sourceScriptsIn(folder, root));
  const coverage = options.from === undefined ? withUnitSuiteCoverage(root, coverageIn) : coverageIn(options.from);
  // The default report goes to the repository root, as the reports of the other commands do.
  const report = writeCoverageReport(options.out === undefined ? resolve(root, defaultOut) : resolve(options.out), commit, coverage);
  process.stdout.write(`Wrote ${options.out ?? defaultOut}. Files: ${report.files.length}. Processes: ${report.processes}.\n`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof CommandError)) throw error;
  process.stderr.write(`ast-metrics-coverage: ${error.message}\n`);
  process.exitCode = 1;
}
