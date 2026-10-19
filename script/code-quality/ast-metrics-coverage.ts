#!/usr/bin/env node
import { resolve } from 'node:path';
import { reportCommandError } from './shared/command-error.ts';
import { parseCommandArguments } from './shared/command-line.ts';
import { selectedSuites } from './coverage/suites.ts';
import type { CoverageSuite } from './provenance/types.ts';
import { collectCoverage } from './coverage/capture.ts';
import { importedCoverage } from './coverage/import.ts';
import { writeCoverageReport } from './coverage/report.ts';
import { CommandError, git, repositoryRoot } from './shared/repository.ts';

const help = `Usage: node script/code-quality/ast-metrics-coverage.ts [--from DIR] [--out FILE] [--no-build] [--allow-unverified] [--suite unit|integration|acceptance] [--help]

Measure function coverage of src/ by selected suites (default: unit). Repeat
--suite unit|integration|acceptance; duplicates keep their first requested position.
Each suite uses its package-defined test selection after npm run build. The default
unit selection is "dist/test/unit/**/*.test.js" followed by
"test/unit/user-portal/**/*.test.ts". Each suite gets an isolated NODE_V8_COVERAGE
folder and retained manifest. Unsupported or nested child suite commands defer
collection before any suite starts. No unselected suite is added. Output goes to
stderr. Cooperating Node children inherit capture settings, flush on normal exit,
and contribute to the union. A known crash fixture can instead flush, stop, seal
its exact raw file set, and park before its parent observes SIGKILL. Missing
shutdown, seal, signal, or flush evidence rejects capture.

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
New capture manifests use version 3 and retain each suite identity plus an explicit
canonical unit comparisonIdentity for tree compatibility. completionProtocol is
normal-exit-or-sealed-1 and captureId retains the original raw-folder identity.
A cooperative normal-exit checkpoint must be followed by a later V8 flush.
Signal exits require a verified pre-crash seal. v3 fingerprints include process,
seal-request, seal-receipt, signal, and raw V8 files. Combined and nonunit
reports name a suite array and every original capture identity in provenance.captures.
Their manifest fingerprint hashes the ordered suite/manifest-fingerprint descriptor.
Old single-unit report strings and version 1 and 2 capture manifests remain readable.
Successful captures retain their raw files and capture-manifest.json under
ast-report/coverage-captures/. --from verifies this original manifest, its raw data,
and current source/build identity. It retains the original capture commit.
Unverified inspection cannot enable architecture bands or historical CRAP counts.

Options:
  --suite NAME  Repeat to select suites (default: unit); remove duplicates in first-requested order
                Each suite uses its package test script; nested suite commands defer collection
  --from DIR    Read the coverage files of an earlier captured suite from
                DIR, and do not run the suite
  --no-build    Reuse dist/ only with a matching .coverage-build.json manifest
  --allow-unverified  Inspect --from data without verified capture evidence
  --out FILE    Write the report to FILE (default: ast-report/coverage.json)
  --help, -h    Show this help

Exit status 0: the report is written. Exit status 1: the suite failed, the coverage
files disagree, or the command failed. Then no report is written.
`;

const defaultOut = 'ast-report/coverage.json';
const optionShape = { suite: { type: 'string', multiple: true }, from: { type: 'string' }, out: { type: 'string' }, 'no-build': { type: 'boolean' }, 'allow-unverified': { type: 'boolean' }, help: { type: 'boolean', short: 'h' } } as const;

type CoverageOptions = { readonly suites: readonly CoverageSuite[]; readonly from: string | undefined; readonly out: string | undefined; readonly noBuild: boolean; readonly allowUnverified: boolean };

function parsedValues(args: readonly string[]) {
  return parseCommandArguments({ args, options: optionShape }).values;
}

function optionsOf(args: readonly string[]): CoverageOptions | { readonly help: true } {
  const values = parsedValues(args);
  if (values.help) return { help: true };
  if (values.from === '') throw new CommandError('The --from value must name a folder.');
  if (values.out === '') throw new CommandError('The --out value must name a file.');
  checkImportOptions(values);
  return { suites: selectedSuites(values.suite), from: values.from, out: values.out, noBuild: values['no-build'] ?? false, allowUnverified: values['allow-unverified'] ?? false };
}
function checkImportOptions(values: ReturnType<typeof parsedValues>): void {
  if (values['allow-unverified'] && values.from === undefined) throw new CommandError('--allow-unverified requires --from.');
  if (values['no-build'] && values.from !== undefined) throw new CommandError('--no-build cannot be used with --from.');
  if (values.from !== undefined && values.suite !== undefined) throw new CommandError('--suite cannot be used with --from; imported manifests name their original suite.');
}

function main(args: readonly string[]): number {
  const options = optionsOf(args);
  if ('help' in options) {
    process.stdout.write(help);
    return 0;
  }
  const root = repositoryRoot();
  const result = options.from === undefined
    ? collectCoverage(root, { commit: git(root, ['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], 'HEAD names no commit. Commit first.').trim(), noBuild: options.noBuild, suites: options.suites })
    : importedCoverage(root, { folder: options.from, allowUnverified: options.allowUnverified });
  const report = writeCoverageReport(options.out === undefined ? resolve(root, defaultOut) : resolve(options.out), { commit: result.commit, provenance: result.provenance, suite: result.suite }, result.coverage);
  process.stdout.write(`Wrote ${options.out ?? defaultOut}. Files: ${report.files.length}. Processes: ${report.processes}.\n`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  reportCommandError('ast-metrics-coverage', error);
}
