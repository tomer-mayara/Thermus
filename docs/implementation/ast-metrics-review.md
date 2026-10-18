# ast-metrics review guide

This guide gives the details of the process "Code quality review with
ast-metrics" in [AGENTS.md](../../AGENTS.md). AGENTS.md gives the rules; this
guide gives the commands, what they report, the configuration, and the limits
of the tool. If the two disagree, follow AGENTS.md and correct this guide.

The facts in this guide were verified on 2026-10-17 with ast-metrics 0.43.1
on this repository. A later version can behave differently; verify the limits
again before you change the process.

## Installation

The commands need the `ast-metrics` executable on PATH. On macOS, install it
from its Homebrew tap: `brew install ast-metrics/tap/ast-metrics`. Other
systems get it from <https://github.com/ast-metrics/ast-metrics>. Check
`ast-metrics version`: this guide is verified with 0.43.1. The commands under
`script/` need no build; run them from the repository root with
`pnpm exec node`.

## The commands

### Measure the delta: `script/ast-metrics-delta.mjs`

```sh
pnpm exec node script/ast-metrics-delta.mjs [--base REF] [--min SCORE] [--no-compare]
```

The delta is each TypeScript file that the branch adds or changes against the
merge base with `--base` (default `origin/main`): committed, staged, unstaged,
and new untracked files, and a renamed file at its new path. Deleted files
and other file types are not part of it. The command runs one analysis of the
repository and prints the maintainability score of each delta file: the
production files first, lowest first, then the other files, then the files
without a measurement:

```
  41.4  src/user-portal/connection-guide.ts  below 85
  91.0  src/http/server.ts
  42.9  test/acceptance/script/ast-metrics-delta.test.ts  no goal
  not measured  src/types.d.ts
Result: 1 of 2 production files below 85. Goal: 85 or more for each production file. 1 other file without a goal. 1 file not measured.
Comparison with origin/main: ast-report/compare.html
```

The goal applies to the production files, under `src/`. The owner decided
this on 2026-10-17: no test file of the repository reaches 85 (339 files,
median 42, best 76), because a test file holds one function per case and
long case names, while the production files have a median of 62 and ten
files at 85 or more. A test file or a support file is listed with its score
and `no goal`; the review reports a drop of its score. The exit status is 1
when a production file is below `--min` (default 85), else 0. A file without
a measurement is listed as `not measured` and does not fail the gate. The
analysis also writes the HTML report to `ast-report/`, with `compare.html`
for the comparison with the base; `--no-compare` skips the comparison and
halves the run time.

The score is the maintainability index of ast-metrics: 0 to 128, from the
size, the complexity, and the comment density of the file. Above 85 the file
reads without effort. The index of a large file falls with its volume, so a
split into focused files raises it more than a local rewrite.

### Review the delta: `script/ast-metrics-review.mjs`

```sh
pnpm exec node script/ast-metrics-review.mjs [--base REF] [--max-findings N]
```

The command runs `ast-metrics review` against `--base` (default
`origin/main`), prints its Markdown report, and writes the same text to
`ast-report/review.md`. The report lists:

- A file whose maintainability score dropped, with the scores before and
  after (severity high).
- A new function with more than 10 decision paths, with its file, line, and
  name (severity high above 30, else medium).
- A rule violation that the baseline does not list, for the rules in
  `.ast-metrics.yaml`.
- A summary of the change in complexity, maintainability, outgoing
  dependencies, and estimated bugs, and the improvements.

The exit status is 1 when a finding of severity high exists, else 0. The
review compares the working tree with the tip of the base ref, not with the
merge base: update the branch from `origin/main` first, or the review lists
changes that are not yours.

### Ask the MCP server: `script/ast-metrics-mcp.mjs`

```sh
pnpm exec node script/ast-metrics-mcp.mjs file <path> [--json]
pnpm exec node script/ast-metrics-mcp.mjs complex [--limit N] [--max-cyclomatic N]
pnpm exec node script/ast-metrics-mcp.mjs risky [--limit N]
pnpm exec node script/ast-metrics-mcp.mjs overview
pnpm exec node script/ast-metrics-mcp.mjs tools
pnpm exec node script/ast-metrics-mcp.mjs call <tool> ['<json arguments>']
```

Each run starts `ast-metrics mcp` as a child process, makes one call over
standard input and output, prints the answer, and lets the server exit. No
server stays behind, and each call reads the current files, so the numbers
follow your edits. A call takes about one second.

- `file <path>` is the tool for a refactor pass: it prints the score, the
  decision paths, and the lines of each function in the file, lowest score
  first. The functions at the top of the list are the ones to split first.
- `complex` and `risky` list the classes and files of the whole repository
  with the highest complexity, the lowest maintainability, and the highest
  risk (complexity, maintainability, coupling, and change frequency
  together).
- `overview` gives the totals of the repository and the architecture
  suggestions: dependency cycles between groups of packages and packages that
  always change together.
- `call` reaches every tool of the server; `tools` lists them.

The server analyzes the same files as the delta command, test files
included. In a test file, each case is an anonymous function in the table.
`file` takes a path relative to the current folder or an absolute path in
the repository.

## The configuration

`.ast-metrics.yaml` at the repository root is the only configuration that
ast-metrics reads; it ignores `--config` and a configuration in another
folder. The file:

- Analyzes the repository and excludes `node_modules/`, the agent worktrees
  under `.claude/`, the generated reports under `ast-report/`, and the
  separate project under `tools/code-review-agents/`.
- Writes the HTML report to `ast-report/` (git-ignored).
- Applies the rules to production code only (`requirements.exclude:
  /test/`). The review still reports a score drop and a new complex function
  in a test file; the exclusion removes only rule violations from test code,
  where a long function is normal. The goal of 85 of the delta command
  applies to production files for the same reason.
- Sets the rules: maintainability 85 for each class, efferent coupling at
  most 10, no dependency cycle between communities, at most 150 lines and 20
  decision paths for a file, at most 30 lines and 20 logical lines for a
  function.

`.ast-metrics-baseline.yaml` lists the violations that existed when the rules
were set (170 on 2026-10-17). The review and `ast-metrics lint` report only a
violation that the baseline does not list. A baseline entry carries the
measured value in its message, so a file whose value moved appears again.
Refresh the baseline only when the rules change: run `ast-metrics baseline`
and commit the file in the same pull request as the rule change.

## Limits

- The rule `min_maintainability` checks each class, not each file. Most files
  of this repository have no class, so the rule covers almost none of them.
  The delta command checks the file goal instead.
- The review reports a score drop of a changed file, but not a new file that
  starts below 85. The delta command catches that file.
- The review drops a small change of a score; a drop of about 10 points
  counts.
- `compare.html` lists only the files whose metrics moved enough. The delta
  command lists every delta file.
- ast-metrics analyzes TypeScript. The commands under `script/` are
  JavaScript and stay outside the measurements.
- The commands run ast-metrics in the repository root that git names from
  the current folder. A worktree of an agent has its own copy of the files;
  run the commands from that worktree.

## Reports for the owner

After a run of the delta command, `ast-report/` holds the full report:
`index.html` (overview), `compare.html` (before and after against the base),
`explorer.html` (one file with its functions and neighbors), `risks.html`
(architecture observations), and `testquality.html` (test files, the
structures they reach, and the tests that touch too much). `review.md` holds
the last review. The folder is not committed; a reviewer runs the delta
command on the branch to get it.
