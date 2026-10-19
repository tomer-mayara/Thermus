#!/usr/bin/env node
import { commandOf } from './crap/command-line.ts';
import { runCrap } from './crap/run.ts';
import { CommandError } from './shared/repository.ts';

const help = `Usage: node script/code-quality/ast-metrics-crap.ts [--base REF] [--coverage FILE] [--limit N] [--target N] [--allow-tool-version] [PATH...] [--help]

Assess per-function CRAP goals: paths² × (1 − covered share)³ + paths.
The unit suite's V8 own-character share is an approximation to path coverage.
The strict limit applies to new and changed functions. New functions must also
meet the inclusive target. Explicit paths select inspection files; source
identity against the merge base determines which functions are new or changed.
All functions of selected files appear, including unchanged and unknown ones.
A measured limit violation in an inspection file fails the command. An unchanged
function can retain the reason "unchanged by this PR" after the approved review.

Options:
  --base REF            Compare against the merge base of REF and HEAD
                        (default: origin/main)
  --coverage FILE       Read verified unit coverage from FILE
                        (default: ast-report/coverage.json in the repository)
  --limit N             Require CRAP strictly below N (default: 30)
  --target N            Require new functions at or below N (default: 15)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h            Show this help

N is a finite positive decimal, with at most six fractional digits and safe
integer decimal digits (at most 9007199254740991 after removing the point).
The target must be less than the limit. PATH names an existing TypeScript file
under src/, relative to the current folder or absolute. By default, select
changed production files, including untracked files and excluding deletions.
One MCP session measures the selected files. No architecture snapshot is taken.
Missing, stale, or unverified coverage fails before measurement. An empty default
selection prints "No production files to assess." without coverage or MCP.

The table gives File, Function, Change, Paths, Coverage, CRAP, and To do. Unknown
coverage shows a marked lower bound. Counts distinguish known violations,
measured target misses, unmeasured functions, and unresolved required goals.

Exit status 0: all applicable assessments pass, or no production files were
selected. Exit status 1: a known limit violation, required new-target miss,
unresolved required goal, invalid input, or tool failure. A documented exception
after at most three improvement cycles does not change the command result.
`;

async function main(): Promise<string> {
  const command = commandOf(process.argv.slice(2));
  if (command.kind === 'help') return help;
  const report = await runCrap(command);
  if (!report.passed) process.exitCode = 1;
  return report.text;
}

try {
  process.stdout.write(await main());
} catch (error) {
  const message = error instanceof CommandError ? error.message : `Unexpected failure: ${error instanceof Error ? error.message : String(error)}`;
  process.stderr.write(`ast-metrics-crap: ${message.replace(/\s+/g, ' ').trim()}\n`);
  process.exitCode = 1;
}
