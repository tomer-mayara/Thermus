#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { commandOf } from './ast-metrics-architecture-command-line.ts';
import { mapSourcesOf } from './ast-metrics-architecture-input.ts';
import { architectureReportOf } from './ast-metrics-architecture-report.ts';
import { CommandError } from './repository.ts';

const help = `Usage: node script/ast-metrics-architecture.ts [--base REF] [--head FILE --base-snapshot FILE] [--touched FILES] [--timeout-ms MS] [--out FILE] [--help]

Print the architecture delta of src/ as Markdown, for the body of a pull
request: a summary line with the modularity, the cross share, the cycles, and
the communities of the base and the head, and, when the map changed, a Mermaid
graph of the src/ communities of the head with the changes against the base.
Then print the complexity table of the changed src/ files: the maintainability
and the decision paths of each file, from the base to the head, and its rank
among the ten riskiest files of the head. A file that the base does not have is
new, a file that the head does not have is gone, and a file without a
maintainability index in the head is not measured. Without a changed src/ file,
the section says that no production file changed.

By default, the command takes two snapshots, as script/ast-metrics-snapshot.ts
does: the base is the merge base of REF and HEAD, in a temporary worktree, and
the head is the working tree. The changed files are the src/ files that differ
between the merge base and the working tree, untracked files included. With
--head and --base-snapshot, the command reads two snapshot files instead and
runs neither git nor ast-metrics; the changed files then come from --touched.

A head community matches the base community with the largest Jaccard overlap of
their files, when that overlap is 0.5 or more; each base community matches one
head community at most. A community without a match is new or gone. The map
changed when a community is new or gone, when a changed file is in a community,
or when a dependency or a cycle between communities appeared or disappeared. A
change of the numbers alone does not change the map; the output then says that
the map did not change.

Options:
  --base REF            The base of the pull request (default: origin/main)
  --head FILE           Read the head snapshot from FILE
  --base-snapshot FILE  Read the base snapshot from FILE
  --touched FILES       The changed files, as paths from the root separated by
                        commas, in place of the changed files of git
  --timeout-ms MS       Deadline of each MCP session (100..300000; default: 60000)
  --out FILE            Also write the Markdown to FILE, relative to the current
                        folder
  --help, -h            Show this help

Exit status 0: the Markdown is printed; the command is a report, not a gate.
Exit status 1: the command failed. It prints one diagnostic line on stderr and
no Markdown. Exit status 130 or 143: SIGINT or SIGTERM stopped the snapshot of
the merge base, after the removal of its worktree.
`;

async function main(): Promise<string> {
  const command = commandOf(process.argv.slice(2));
  if (command.kind === 'help') return help;
  const report = architectureReportOf(await mapSourcesOf(command));
  if (command.out !== undefined) {
    const target = resolve(command.out);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, report);
  }
  return report;
}

try {
  process.stdout.write(await main());
} catch (error) {
  const message = error instanceof CommandError ? error.message : `Unexpected failure: ${error instanceof Error ? error.message : String(error)}`;
  // A diagnostic is one line, also when ast-metrics or the server wrote several lines.
  process.stderr.write(`ast-metrics-architecture: ${message.replace(/\s+/g, ' ').trim()}\n`);
  process.exitCode = 1;
}
