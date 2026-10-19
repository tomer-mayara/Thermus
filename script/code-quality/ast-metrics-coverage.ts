#!/usr/bin/env node
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { collectCoverage } from './coverage/capture.ts';
import { importedCoverage } from './coverage/import.ts';
import { writeCoverageReport } from './coverage/report.ts';
import { CommandError, git, repositoryRoot } from './shared/repository.ts';

const help = `Usage: node script/code-quality/ast-metrics-coverage.ts [--from DIR] [--out FILE] [--no-build] [--allow-unverified] [--help]

Measure the coverage of each function of src/ by the unit suite. The command runs
node --test on "dist/test/unit/**/*.test.js", then on
"test/unit/user-portal/**/*.test.ts" in the repository root, with
NODE_V8_COVERAGE set to a temporary folder. The command runs npm run build first. The output of
the suite goes to stderr. Each Node process of the run writes a V8 coverage file
at exit, and the command merges these files.

The report holds source scripts under dist/src/ (emitted JavaScript) and src/
(source TypeScript), with representation and content identity. Offsets use UTF-16
code units of the executed representation. It records each function name, whole
range, calls, and covered share of its own characters after nested ranges leave
the mask. Measurement version is own-characters-1; report schema version is 2. A
function without a name is "(anonymous)". The compiler helpers, whose names start
with __, and the functions strictly inside them are not in the report. Functions
with no own characters appear in unmeasuredFunctions with no-own-characters.
Invalid ranges, unsafe counts, crossing functions, and incompatible identities
fail before a report is written. Inputs and emitted outputs must stay stable.
Successful captures retain their raw files and capture-manifest.json under
ast-report/coverage-captures/. --from verifies this original manifest, its raw data,
and current source/build identity. It retains the original capture commit.
Unverified inspection cannot enable architecture bands or historical CRAP counts.

Options:
  --from DIR    Read the coverage files of an earlier run of the unit suite from
                DIR, and do not run the suite
  --no-build    Reuse dist/ only with a matching .coverage-build.json manifest
  --allow-unverified  Inspect --from data without verified capture evidence
  --out FILE    Write the report to FILE (default: ast-report/coverage.json)
  --help, -h    Show this help

Exit status 0: the report is written. Exit status 1: the suite failed, the coverage
files disagree, or the command failed. Then no report is written.
`;

const defaultOut = 'ast-report/coverage.json';
const optionShape = { from: { type: 'string' }, out: { type: 'string' }, 'no-build': { type: 'boolean' }, 'allow-unverified': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } as const;

type CoverageOptions = { readonly from: string | undefined; readonly out: string | undefined; readonly noBuild: boolean; readonly allowUnverified: boolean };

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
  if (values['allow-unverified'] && values.from === undefined) throw new CommandError('--allow-unverified requires --from.');
  if (values['no-build'] && values.from !== undefined) throw new CommandError('--no-build cannot be used with --from.');
  return { from: values.from, out: values.out, noBuild: values['no-build'] ?? false, allowUnverified: values['allow-unverified'] ?? false };
}

function main(args: readonly string[]): number {
  const options = optionsOf(args);
  if ('help' in options) {
    process.stdout.write(help);
    return 0;
  }
  const root = repositoryRoot();
  const result = options.from === undefined
    ? collectCoverage(root, { commit: git(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], 'HEAD names no commit. Commit first.').trim(), noBuild: options.noBuild })
    : importedCoverage(root, { folder: options.from, allowUnverified: options.allowUnverified });
  // The default report goes to the repository root, as the reports of the other commands do.
  const report = writeCoverageReport(options.out === undefined ? resolve(root, defaultOut) : resolve(options.out), { commit: result.commit, provenance: result.provenance }, result.coverage);
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
