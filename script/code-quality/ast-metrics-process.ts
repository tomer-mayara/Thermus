#!/usr/bin/env node
import { processCommandOf } from './process/command-line.ts';
import { processOperations } from './process/operations.ts';
import { saveProcessReport } from './process/output.ts';
import { failureText } from './process/report.ts';
import { runProcess } from './process/run.ts';
import { repositoryRoot } from './shared/repository.ts';

const help = `Usage: node script/code-quality/ast-metrics-process.ts [--base REF] [--coverage FILE] [--collect-coverage | --skip-coverage] [--out FILE] [--json FILE] [--allow-tool-version] [--help]

Run delta, review, coverage resolution, CRAP, and architecture in order. Print
and save four Markdown sections, including the architecture drawings and legends.
Completed goal misses keep all evidence. Failed prerequisites leave clear partial
results and do not publish history. Successful analysis requests a verified base
record; existing records stay unchanged. Unavailable required assessments prevent
recording. Completed goal misses may record after all analyses finish. Document-only
work can record structure without coverage counts.

Options:
  --base REF            Comparison ref (default: origin/main)
  --coverage FILE       Reuse this report (default: ast-report/coverage.json at root)
  --collect-coverage    Explicitly build and collect the complete unit suite once
  --skip-coverage       Ignore all coverage and render structure without bands
  --out FILE            Save Markdown (default: ast-report/process.md at root)
  --json FILE           Also write the stage outcomes as JSON to FILE
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h            Show this help

Give only one coverage option. Explicit file paths resolve from the current folder.
Reuse requires verified compatible capture provenance. Missing or stale coverage
never starts a suite. An empty default production-file selection needs no CRAP
coverage or MCP call. Required goals without coverage remain unresolved.

Collection is permitted only when src/ changed or both complete unit parts were
already selected: emitted Node tests and source portal tests. The option grants
no policy exception. Select tests first and record that selection in PR evidence.

With --json, the command also writes one JSON object to FILE. It has version 1,
base (the merge base of REF and HEAD), head (HEAD), and outcomes. The outcomes
are the four stages in order. Each has name, status, and text, as the report
gives them. A name is Delta, Review, CRAP, or Architecture. A status is passed,
goal miss, failed, or unavailable. The command writes the file also after a goal
miss or a failed stage. The Markdown, the exit status, and the history record do
not change. After a diagnostic, it writes no file, so an older file can stay.
The review route check reads the file with --process.

Exit 0: all required assessments completed and passed. Exit 1: a goal miss,
unavailable required assessment, invalid option, recording failure, or tool failure.
`;

async function main(): Promise<void> {
  const options = processCommandOf(process.argv.slice(2));
  if ('help' in options) { process.stdout.write(help); return; }
  const root = repositoryRoot();
  const report = await runProcess(processOperations(root, options));
  process.stdout.write(report.text);
  saveProcessReport(root, options, report);
  process.exitCode = report.passed ? 0 : 1;
}

try { await main(); }
catch (error) {
  process.stderr.write(`ast-metrics-process: ${failureText(error)}\n`);
  process.exitCode = 1;
}
