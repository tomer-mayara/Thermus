#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { reportFailure } from './shared/command-error.ts';
import { crapDeltaOf } from './architecture/crap-delta.ts';
import { commandOf } from './architecture/command-line.ts';
import { mapSourcesOf } from './architecture/input.ts';
import { architectureReportOf } from './architecture/report.ts';
import { trendLinesOf } from './architecture/trend.ts';

const help = `Usage: node script/code-quality/ast-metrics-architecture.ts [--base REF] [--head FILE --base-snapshot FILE] [--changes FILE] [--touched FILES] [--coverage FILE | --no-coverage] [--trend-store DIR] [--record] [--timeout-ms MS] [--out FILE] [--allow-tool-version] [--help]

Print the architecture delta of src/ as Markdown, for the body of a pull
request: a summary line with the modularity, the cross share, the cycles, and
the communities of the base and the head, and a Mermaid graph of the src/
communities of the head with the changes against the base. Every report includes
the graph and its legend. An unchanged map keeps its note above the graph.
Then print the complexity table of the changed src/ files: the maintainability
and the decision paths of each file, from the base to the head, and its rank
among the ten riskiest files of the head. A proven rename compares its old path
with its new path in one row. Deletions touch the base community and have gone
head cells. A file that the base does not have is
new, a file that the head does not have is gone, and a file without a
maintainability index in the head is not measured. Without a changed src/ file,
the section says that no production file changed.

With the coverage report of script/code-quality/ast-metrics-coverage.ts, each function of
src/ gets its CRAP: paths² × (1 − covered share)³ + paths. The function of the
coverage has the same name in the same file, as V8 names it: a method by its
own name, a constructor by its class. A function without a name, a name that
the file or the report has twice, and a name that the report does not have get
no CRAP. A file that the report does not have counts as uncovered. The base
tree gets no coverage run. Source evidence proves declaration continuity in
the same or a mapped file, or a unique unchanged body/signature proves a move.
Only a proven partner supplies the head covered share to a base estimate.
Different same-name bodies do not prove identity. Duplicate, anonymous, and
legacy identities can remain unknown. The report counts unknown identities
and base functions without an estimated covered share. A community is
good when no function has CRAP 30 or more, warning when some have but this
pull request added or made worse none of them, and critical when it added or
made worse one. The node text gives the band and the count, the border has the
color of the band, the table gives the count of each changed file, and a list
names each function that the pull request added or made worse. Without the
report, the output says that coverage is missing. Coverage must have verified
provenance that matches the source and coverage inputs of the head snapshot,
with compatible input identity, measurement version, runtime, and compiler.
Selected-suite reports retain every suite and capture identity. An older
capture commit is allowed when those identities match. Legacy data still shows
structure, but cannot establish coverage compatibility. With --no-coverage, the
command ignores the default report explicitly.

Last, the command prints the trend of src/ on main: the modularity, the cross
share, the cycles, the maintainability, and the count of the functions at CRAP
30 or more of the last ten records of the trend store by date, oldest first,
and of the head as the last row, this pull request. The trend store of a
repository is docs/metrics/ of its root: one JSON file for each commit of main
that a pull request used as its base, named <date>-<commit8>.json, with the
global numbers of the snapshot of that commit and the numbers of each
community, and nothing for each file. With --record, the command writes the
file of the merge base when the store has no file of that commit; a file that
exists stays as it is. Commit the new file with the pull request. With --head
and --base-snapshot, the command reads no store unless --trend-store names one.
Offline --record also requires a repository that verifies the full base commit
and its source content. Recording requires that the base is on origin/main. Without a store, the trend section says No trend store.
Repository reports check gaps strictly between the oldest and newest displayed
records on first-parent origin/main. Every stored full commit identity counts,
also when its row is outside the display selection. Each missing interval gets
one gap line. Commits outside those endpoints are not checked. Missing or shallow
Git history gets an explicit notice. Offline reports with a store state that
dates cannot prove omitted commits and run no Git for this check.

By default, the command takes two snapshots, as script/code-quality/ast-metrics-snapshot.ts
does: the base is the merge base of REF and HEAD, in a temporary worktree, and
the head is the working tree. The changed files are the src/ files that differ
between the merge base and the working tree, untracked files included. With
--head and --base-snapshot, the command reads two snapshot files instead and
runs neither git nor ast-metrics. Optional --changes metadata names additions,
modifications, deletions, and old/new rename paths. It must identify both
snapshot commits and source fingerprints. Legacy snapshots without provenance
cannot validate it. Repository mode uses Git status and rejects --changes.
Without metadata, offline changed files come from --touched alone. With
metadata, they include both rename paths. --touched overrides this path
selection only; it gives no rename proof and cannot name a path with a comma.

A head community matches the base community with the largest Jaccard overlap of
their files, when that overlap is 0.5 or more; each base community matches one
head community at most. A community without a match is new or gone. The map
changed when a community is new or gone, when a changed file is in a community,
or when a dependency or a cycle between communities appeared or disappeared. A
change of the numbers alone does not change the map; the output then prints
"The map did not change." above the graph.

Options:
  --base REF            The base of the pull request (default: origin/main)
  --head FILE           Read the head snapshot from FILE
  --base-snapshot FILE  Read the base snapshot from FILE
  --changes FILE        Read version 1 status metadata for the two offline snapshots
  --touched FILES       The changed files, as paths from the root separated by
                        commas, in place of the default selection; no rename proof
  --coverage FILE       Read the coverage report from FILE (default in a
                        repository: ast-report/coverage.json when it exists)
  --no-coverage         Ignore default coverage and print structure without bands
  --record              Record a verified base on origin/main in the trend store
  --trend-store DIR     Use DIR as the trend store, relative to the current
                        folder (default in a repository: docs/metrics of the root)
  --timeout-ms MS       Deadline of each MCP session (100..300000; default: 60000)
  --out FILE            Also write the Markdown to FILE, relative to the current
                        folder
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h            Show this help

Exit status 0: the Markdown is printed; the command is a report, not a gate.
Exit status 1: the command failed, also when it cannot write the trend store. It
prints one diagnostic line on stderr and no Markdown. Exit status 130 or 143:
SIGINT or SIGTERM stopped the snapshot of the merge base, after the removal of
its worktree.
`;

// The trend section comes last. Its record goes to the store before the output.
async function main(): Promise<string> {
  const command = commandOf(process.argv.slice(2));
  if (command.kind === 'help') return help;
  const sources = await mapSourcesOf(command);
  const delta = crapDeltaOf(sources);
  const trend = trendLinesOf(command, sources, delta);
  const report = `${[architectureReportOf(sources, delta), ...trend].join('\n')}\n`;
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
  reportFailure('ast-metrics-architecture', error);
}
