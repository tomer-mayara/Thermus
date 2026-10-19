# Measure and review a pull request with ast-metrics

The commands below wrap the ast-metrics CLI for the process "Code quality review
with ast-metrics" in [AGENTS.md](../../AGENTS.md). They carry the correct syntax
of the tool. The current direct-call exception is `ast-metrics baseline`:
use it only for a retained high-severity review finding with a written reason,
or when `.ast-metrics.yaml` rules change. Commit the resulting baseline. A
violation already on `main` is not a third exception. Run the commands from
the repository root; the static commands need no build. A coverage run needs
compiled unit tests. Delta, review, MCP, snapshot, and online architecture
runs need `ast-metrics` on PATH (`brew install ast-metrics/tap/ast-metrics`
on macOS; the process is
verified with 0.43.1). The
[ast-metrics review guide](../../docs/implementation/ast-metrics-review.md)
explains what each command reports, the configuration, and the limits of the
tool.

## Source layout

The six command entry points stay in this folder:

| Entry point | Purpose |
|---|---|
| `ast-metrics-delta.ts` | Measure changed TypeScript files. |
| `ast-metrics-mcp.ts` | Make one call to the ast-metrics MCP server. |
| `ast-metrics-review.ts` | Report changes in code quality. |
| `ast-metrics-coverage.ts` | Collect unit test coverage per function. |
| `ast-metrics-architecture.ts` | Compare architecture snapshots and show the trend. |
| `ast-metrics-snapshot.ts` | Capture the metrics of one source tree. |

Helper modules are grouped by task: `delta/`, `mcp/`, `snapshot/`,
`coverage/`, and `architecture/`. The `shared/` folder holds JSON readers,
number calculations, and repository commands that more than one task uses.

Select tests with the [test gate policy](../../docs/implementation/test-gate-policy.md).
Only a change under `src/` requires the full ordinary suite (`npm test`) and
the remaining static and build checks in that policy. Do not add
`npm run check`, which would repeat unit and portal tests. For other changes,
run only affected test groups and existing focused tests. Keep the static
delta, review, and architecture steps for each pull request. This scope also
applies to tests and commands that start other
tests: a focused caller must not expand it indirectly.

## Measure the delta

```text
Usage: pnpm exec node script/code-quality/ast-metrics-delta.ts [--base REF] [--min SCORE] [--no-compare] [--help]

Options:
  --base REF      Git ref to compare with (default: origin/main)
  --min SCORE     Goal for each production file (integer 0..128; default: 85)
  --no-compare    Do not add the comparison with REF to the HTML report
  --help, -h      Show this help
```

Lists each TypeScript file that the branch adds or changes against the merge
base with `--base` (default `origin/main`), with its maintainability score:
the production files under `src/` first, lowest first, then the other files,
then the files without a measurement. Committed, staged, unstaged, untracked,
and renamed files count; deleted files do not. The goal of `--min` (default
85, an integer from 0 to 128) applies to the production files; a test file or
a support file is listed with `no goal`. Exit status 1 when a production file
is below the goal, else 0. The run writes the HTML report to `ast-report/`,
with `compare.html` for the comparison with the base; `--no-compare` skips
the comparison.

Focused tests: select the `ast-metrics-delta*.test.ts` rows in the
[available test inventory](#available-tests). Run a live row only within its
listed scope.

## Ask the MCP server

```text
Usage: pnpm exec node script/code-quality/ast-metrics-mcp.ts <subcommand> [options]

Subcommands:
  file <path> [--json]                       get_file_metrics. The path is relative to the
                                             current folder, or absolute in the root. Prints
                                             the file score and each function, lowest score first.
  complex [--limit N] [--max-cyclomatic N]   find_complex_code, printed as JSON
  risky [--limit N]                          find_risky_code, printed as JSON
  overview                                   analyze_project, printed as JSON
  tools                                      The tools of the server and their descriptions
  call <tool> [<json arguments>]             Any tool. The arguments are a JSON object (default: {}).

Options:
  --json              file: print the answer of the server as JSON
  --limit N           complex, risky: the maximum number of results (default: delegated to ast-metrics)
  --max-cyclomatic N  complex: show the items above this complexity (default: delegated to ast-metrics)
  --timeout-ms MS     Deadline of the MCP call (100..300000; default: 60000)
  --help, -h          Show this help
```

Starts `ast-metrics mcp`, makes one call over standard input and output,
prints the answer, and lets the server exit; no server stays behind. `file`
prints the score, the decision paths, and the lines of each function in a
file, lowest score first. The score is the maintainability index, from 0 to
128; more is better. The lines column is LOC, not source positions.
`--json` prints the raw answer. The path is
relative to the current folder, or absolute inside the repository.
`--timeout-ms` sets the deadline (default 60000 ms; after a timeout the
command stops the server). Exit status 0 means the answer was printed.
Exit status 1 with one diagnostic line on stderr
for a file that is not in the analysis, an unknown tool, a timeout, a server
that exits before it answers, or a missing executable.

Focused tests: select the `ast-metrics-mcp*.test.ts` rows in the
[available test inventory](#available-tests). Run a live row only within its
listed scope.

## Review the delta

```text
Usage: pnpm exec node script/code-quality/ast-metrics-review.ts [--base REF] [--max-findings N] [--help]

Options:
  --base REF          Git ref to compare with (default: origin/main)
  --max-findings N    Most findings in the report (integer 1..1000; default: 50)
  --help, -h          Show this help
```

Prints the Markdown review of `ast-metrics review` against `--base` (default
`origin/main`) and writes it to `ast-report/review.md`: files whose score
dropped, new functions with more than 10 decision paths, new rule
violations, and the summary of the change. Exit status 1 when a finding of
severity high exists, else 0. Update the branch from the base first.

Focused tests: select the `ast-metrics-review*.test.ts` rows in the
[available test inventory](#available-tests). Run a live row only within its
listed scope.

## Measure the coverage per function

Build first with `pnpm run build`. Run this command, or its live test, only
when `src/` changed or the complete
emitted Node unit suite was already selected. A focused unit package does
not select that whole suite. Reuse current valid coverage when available;
otherwise, an architecture report without coverage is acceptable outside
that scope. Current coverage must describe the candidate's source, unit-test,
and build inputs, including test helpers and fixtures. A commit that changes
only documents does not invalidate coverage when those inputs are unchanged.

```text
Usage: pnpm exec node script/code-quality/ast-metrics-coverage.ts [--from DIR] [--out FILE] [--help]

Options:
  --from DIR    Read the coverage files of an earlier run of the unit suite from
                DIR, and do not run the suite
  --out FILE    Write the report to FILE (default: ast-report/coverage.json)
  --help, -h    Show this help
```

Runs `node --test --test-concurrency=1 "dist/test/unit/**/*.test.js"` with
`NODE_V8_COVERAGE` set to a temporary
folder (the suite output goes to stderr) and writes `ast-report/coverage.json`:
for each function of `src/` that the suite loaded, its name, its range in the
build, its calls, and its covered share. `--from DIR` reads the coverage
files of an earlier run. This collector covers only the emitted Node unit
suite. It currently omits the portal unit tests that `npm run test:unit` also
runs; that omission remains a bug until CR-01. The command and its live test
need no ast-metrics. Exit status 0 means the report was written. Exit status 1 when
`dist/` is missing, the suite fails, or the coverage files do not come from
one build; then no report is written. The
[ast-metrics review guide](../../docs/implementation/ast-metrics-review.md)
gives the details of the share.

Focused tests: select the `ast-metrics-coverage*.test.ts` rows in the
[available test inventory](#available-tests). Run a live row only within its
listed scope.

## Show the architecture delta

```text
Usage: pnpm exec node script/code-quality/ast-metrics-architecture.ts [--base REF] [--head FILE --base-snapshot FILE] [--touched FILES] [--coverage FILE] [--trend-store DIR] [--timeout-ms MS] [--out FILE] [--help]

Options:
  --base REF            The base of the pull request (default: origin/main)
  --head FILE           Read the head snapshot from FILE
  --base-snapshot FILE  Read the base snapshot from FILE
  --touched FILES       The changed files, as paths from the root separated by
                        commas, in place of the changed files of git
  --coverage FILE       Read the coverage report from FILE (default in a
                        repository: ast-report/coverage.json when it exists)
  --trend-store DIR     Use DIR as the trend store, relative to the current
                        folder (default in a repository: docs/metrics of the root)
  --timeout-ms MS       Deadline of each MCP session (100..300000; default: 60000)
  --out FILE            Also write the Markdown to FILE, relative to the current
                        folder
  --help, -h            Show this help
```

Prints the architecture delta of `src/` as Markdown: a header with the base
commit, one summary line (modularity, cross share, cycles, communities, base
→ head), and a Mermaid graph of the communities with their changes, or `The
map did not change.` Then it prints the complexity table of the changed
`src/` files: the maintainability and the decision paths of each file, base
→ head (`new`, `gone`, or `not measured` when a side has no value), and its
rank among the ten riskiest files of the head, or
`No production file changed.` By default it snapshots the merge base of
`--base` (default `origin/main`) in a temporary worktree and the working
tree, and the changed files follow the rule of the delta command; with
`--head` and `--base-snapshot` it reads two snapshot files and runs no tool
(`--touched` then names the changed files). With the report of the coverage
command (`--coverage`, or `ast-report/coverage.json` of the repository),
each community gets a CRAP band (good, warning, or critical) from its
functions at CRAP 30 or more and their change against the base, the table
gets the column `CRAP ≥ 30`, and a list names each function that the pull
request added or made worse. Last, it writes the record of the merge base to
the trend store `docs/metrics/` (or `--trend-store`) when the store has no
record of that commit, and prints the trend table of the last ten records of
`main` with the head as the last row. Exit status 0 when the Markdown is
printed; 1 with one diagnostic line for a failure. The
[ast-metrics review guide](../../docs/implementation/ast-metrics-review.md)
gives the matching rule, the encoding, the bands, the rules of the table, and
the trend store.

Move aside a stale default `ast-report/coverage.json` before the architecture
run. Its missing-coverage message does not require a broader test run; use
the output without bands when no current valid coverage is available and
the selection does not permit collection. Without a trend store in offline
mode, the section says `No trend store.` A configured store receives the base
record before the table is printed. An empty store passed directly to the
trend formatter says `No snapshot of main in the trend store yet.`

Focused tests: select the `ast-metrics-architecture*.test.ts` rows in the
[available test inventory](#available-tests). Run a live row only within its
listed scope.

## Take a snapshot

```text
Usage: pnpm exec node script/code-quality/ast-metrics-snapshot.ts [--base REF] [--out FILE] [--timeout-ms MS] [--help]

Options:
  --base REF       Take the snapshot of the merge base of REF and HEAD
  --out FILE       The snapshot file, relative to the current folder (default:
                   ast-report/snapshot.json in the repository root, or
                   ast-report/snapshot-base.json with --base)
  --timeout-ms MS  Deadline of the MCP session (100..300000; default: 60000)
  --help, -h       Show this help
```

Writes the snapshot of the working tree to `ast-report/snapshot.json`, or to
`--out` (relative to the current folder): the global numbers of `src/`, the
`src/` communities with labels, members, references, and edges, and each
`src/` file with its metrics and functions, from one `ast-metrics analyze
src` run and one session of `ast-metrics mcp src`, so that only a change of
`src/` changes the communities. The file is written only after all calls
succeeded. Exit status 0 means the snapshot was written. `--timeout-ms`
sets the deadline of the session (default 60000
ms). Exit status 1, with one diagnostic line on stderr, for a missing
executable, a failed analysis, or a failed call. With `--base REF`, the
snapshot is of the merge base of REF and HEAD: the command analyzes that
commit in a temporary worktree under the system temporary folder, removes
the worktree again (also after a failure, and on SIGINT or SIGTERM with exit
status 130 or 143), and writes `ast-report/snapshot-base.json` by default. A
run first removes the temporary worktrees that interrupted runs left, and
says on stderr how many. The worktree needs no `pnpm install`, and no hook
of the repository runs in it. The
[ast-metrics review guide](../../docs/implementation/ast-metrics-review.md)
describes the file. The snapshot stores no coverage or CRAP; the architecture
command joins coverage when it makes the report.

Community labels use the largest source namespace by member count, without
`src/`; ties use the first name in lexical order. Root files use `src`, and
the shared kernel uses `shared kernel`. Duplicate labels append the basename
of the hub in parentheses. Maintainability is weighted by LOC. LOC is a count
of lines of code, not a source position.

Focused tests: select the `ast-metrics-snapshot*.test.ts` rows in the
[available test inventory](#available-tests). Run a live row only within its
listed scope.

## Available tests

This is the complete available inventory, not a requirement to run every file.
The documentation contract discovers it from the test tree in lexical order.
Select affected tests with the [test gate policy](../../docs/implementation/test-gate-policy.md).
After a clean build, a focused command uses the emitted path of a selected row:
replace `test/` with `dist/test/` and `.ts` with `.js`.

```sh
pnpm run build
pnpm exec node --test dist/test/acceptance/script/script-readme.test.js
```

That documentation test reads real `--help` with an empty PATH and forbids all
child processes. It checks the Usage/Options contracts above and this inventory
against the [test inventory](../../docs/testing/test-list.md#ast-metrics-commands).
It reads listed test commands; it does not execute them. Prose changes alone do
not select a broader suite through a command reference.

Live MCP and snapshot tests need ast-metrics on PATH. The architecture live file
also needs ast-metrics, and its coverage case runs the complete emitted Node unit
suite. The coverage live file runs that suite without ast-metrics. Both collector
files are eligible only when `src/` changed or that complete unit suite was already
selected. Keep them deferred outside that scope. Each architecture live case
uses a temporary trend store; neither changes repository `docs/metrics/`.

<!-- code-quality-tests:start -->
| Kind | Test file | Collects full unit coverage |
| --- | --- | --- |
| ordinary | test/acceptance/script/ast-metrics-architecture-bands.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-base.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-table.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-trend.test.ts | no |
| live | test/acceptance/script/ast-metrics-architecture.live.ts | yes |
| ordinary | test/acceptance/script/ast-metrics-architecture.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-coverage-failures.test.ts | no |
| live | test/acceptance/script/ast-metrics-coverage.live.ts | yes |
| ordinary | test/acceptance/script/ast-metrics-coverage.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-delta-failures.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-delta-goal.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-delta.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-mcp-help.test.ts | no |
| live | test/acceptance/script/ast-metrics-mcp.live.ts | no |
| ordinary | test/acceptance/script/ast-metrics-mcp.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-review.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-base-failures.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-base-worktree.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-base.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-failures.test.ts | no |
| live | test/acceptance/script/ast-metrics-snapshot.live.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot.test.ts | no |
| ordinary | test/acceptance/script/script-readme.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-bands.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-coverage.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-crap.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-functions.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-report.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-table.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend-store.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage.test.ts | no |
| ordinary | test/unit/script/ast-metrics-delta.test.ts | no |
| ordinary | test/unit/script/ast-metrics-mcp.test.ts | no |
| ordinary | test/unit/script/ast-metrics-review.test.ts | no |
| ordinary | test/unit/script/ast-metrics-snapshot.test.ts | no |
<!-- code-quality-tests:end -->
