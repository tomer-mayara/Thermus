# Measure and review a pull request with ast-metrics

The commands below wrap the ast-metrics CLI for the process "Code quality review
with ast-metrics" in [AGENTS.md](../../AGENTS.md). They carry the correct syntax
of the tool; do not call `ast-metrics` directly in that process. Run them from
the repository root; no build is needed. The `ast-metrics` executable must be
on PATH (`brew install ast-metrics/tap/ast-metrics` on macOS; the process is
verified with 0.43.1). The
[ast-metrics review guide](../../docs/implementation/ast-metrics-review.md)
explains what each command reports, the configuration, and the limits of the
tool.

## Source layout

The six command entry points stay in this folder:

| Entry point | Purpose |
|---|---|
| `ast-metrics-delta.ts` | Measure changed TypeScript files. |
| `ast-metrics-review.ts` | Report changes in code quality. |
| `ast-metrics-mcp.ts` | Make one call to the ast-metrics MCP server. |
| `ast-metrics-snapshot.ts` | Capture the metrics of one source tree. |
| `ast-metrics-coverage.ts` | Collect unit test coverage per function. |
| `ast-metrics-architecture.ts` | Compare architecture snapshots and show the trend. |

Helper modules are grouped by task: `delta/`, `mcp/`, `snapshot/`,
`coverage/`, and `architecture/`. The `shared/` folder holds JSON readers,
number calculations, and repository commands that more than one task uses.

## Measure the delta

```sh
pnpm exec node script/code-quality/ast-metrics-delta.ts [--base REF] [--min SCORE] [--no-compare]
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

## Review the delta

```sh
pnpm exec node script/code-quality/ast-metrics-review.ts [--base REF] [--max-findings N]
```

Prints the Markdown review of `ast-metrics review` against `--base` (default
`origin/main`) and writes it to `ast-report/review.md`: files whose score
dropped, new functions with more than 10 decision paths, new rule
violations, and the summary of the change. Exit status 1 when a finding of
severity high exists, else 0. Update the branch from the base first.

## Ask the MCP server

```sh
pnpm exec node script/code-quality/ast-metrics-mcp.ts file <path> [--json]
pnpm exec node script/code-quality/ast-metrics-mcp.ts complex [--limit N] [--max-cyclomatic N]
pnpm exec node script/code-quality/ast-metrics-mcp.ts risky [--limit N]
pnpm exec node script/code-quality/ast-metrics-mcp.ts overview
pnpm exec node script/code-quality/ast-metrics-mcp.ts tools
pnpm exec node script/code-quality/ast-metrics-mcp.ts call <tool> ['<json arguments>']
```

Starts `ast-metrics mcp`, makes one call over standard input and output,
prints the answer, and lets the server exit; no server stays behind. `file`
prints the score, the decision paths, and the lines of each function in a
file, lowest score first; `--json` prints the raw answer. The path is
relative to the current folder, or absolute inside the repository.
`--timeout-ms` sets the deadline (default 60000 ms; after a timeout the
command stops the server). Exit status 1 with one diagnostic line on stderr
for a file that is not in the analysis, an unknown tool, a timeout, a server
that exits before it answers, or a missing executable.

## Measure the coverage per function

```sh
pnpm run build
pnpm exec node script/code-quality/ast-metrics-coverage.ts [--from DIR] [--out FILE]
```

Runs the unit suite of `dist/` with `NODE_V8_COVERAGE` set to a temporary
folder (the suite output goes to stderr) and writes `ast-report/coverage.json`:
for each function of `src/` that the suite loaded, its name, its range in the
build, its calls, and its covered share. `--from DIR` reads the coverage
files of an earlier run. The command needs no ast-metrics. Exit status 1 when
`dist/` is missing, the suite fails, or the coverage files do not come from
one build; then no report is written. The
[ast-metrics review guide](../../docs/implementation/ast-metrics-review.md)
gives the details of the share.

## Take a snapshot

```sh
pnpm exec node script/code-quality/ast-metrics-snapshot.ts [--base REF] [--out FILE] [--timeout-ms MS]
```

Writes the snapshot of the working tree to `ast-report/snapshot.json`, or to
`--out` (relative to the current folder): the global numbers of `src/`, the
`src/` communities with labels, members, references, and edges, and each
`src/` file with its metrics and functions, from one `ast-metrics analyze
src` run and one session of `ast-metrics mcp src`, so that only a change of
`src/` changes the communities. The file is written only after all calls
succeeded. `--timeout-ms` sets the deadline of the session (default 60000
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
describes the file.

## Show the architecture delta

```sh
pnpm exec node script/code-quality/ast-metrics-architecture.ts [--base REF] [--head FILE --base-snapshot FILE] [--touched FILES] [--coverage FILE] [--trend-store DIR] [--timeout-ms MS] [--out FILE]
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

Run the focused offline tests after a clean build, and the live tests with
the real executable on PATH and the real unit suite:

```sh
pnpm run build
pnpm exec node --test dist/test/unit/script/ast-metrics-delta.test.js dist/test/unit/script/ast-metrics-review.test.js dist/test/unit/script/ast-metrics-mcp.test.js dist/test/acceptance/script/ast-metrics-delta.test.js dist/test/acceptance/script/ast-metrics-delta-goal.test.js dist/test/acceptance/script/ast-metrics-delta-failures.test.js dist/test/acceptance/script/ast-metrics-review.test.js dist/test/acceptance/script/ast-metrics-mcp.test.js dist/test/unit/script/ast-metrics-snapshot.test.js dist/test/acceptance/script/ast-metrics-snapshot.test.js dist/test/acceptance/script/ast-metrics-snapshot-failures.test.js dist/test/acceptance/script/ast-metrics-snapshot-base.test.js dist/test/acceptance/script/ast-metrics-snapshot-base-failures.test.js dist/test/acceptance/script/ast-metrics-snapshot-base-worktree.test.js dist/test/unit/script/ast-metrics-architecture.test.js dist/test/unit/script/ast-metrics-architecture-coverage.test.js dist/test/unit/script/ast-metrics-architecture-report.test.js dist/test/unit/script/ast-metrics-architecture-table.test.js dist/test/unit/script/ast-metrics-architecture-functions.test.js dist/test/unit/script/ast-metrics-architecture-crap.test.js dist/test/unit/script/ast-metrics-architecture-bands.test.js dist/test/unit/script/ast-metrics-architecture-trend.test.js dist/test/unit/script/ast-metrics-architecture-trend-store.test.js dist/test/acceptance/script/ast-metrics-architecture.test.js dist/test/acceptance/script/ast-metrics-architecture-table.test.js dist/test/acceptance/script/ast-metrics-architecture-bands.test.js dist/test/acceptance/script/ast-metrics-architecture-base.test.js dist/test/acceptance/script/ast-metrics-architecture-trend.test.js dist/test/unit/script/ast-metrics-coverage.test.js dist/test/acceptance/script/ast-metrics-coverage.test.js dist/test/acceptance/script/ast-metrics-coverage-failures.test.js
pnpm exec node --test dist/test/acceptance/script/ast-metrics-mcp.live.js
pnpm exec node --test dist/test/acceptance/script/ast-metrics-coverage.live.js
pnpm exec node --test dist/test/acceptance/script/ast-metrics-snapshot.live.js
pnpm exec node --test dist/test/acceptance/script/ast-metrics-architecture.live.js
```
