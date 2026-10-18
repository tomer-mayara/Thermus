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

### Measure the delta: `script/ast-metrics-delta.ts`

```sh
pnpm exec node script/ast-metrics-delta.ts [--base REF] [--min SCORE] [--no-compare]
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

### Review the delta: `script/ast-metrics-review.ts`

```sh
pnpm exec node script/ast-metrics-review.ts [--base REF] [--max-findings N]
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

### Ask the MCP server: `script/ast-metrics-mcp.ts`

```sh
pnpm exec node script/ast-metrics-mcp.ts file <path> [--json]
pnpm exec node script/ast-metrics-mcp.ts complex [--limit N] [--max-cyclomatic N]
pnpm exec node script/ast-metrics-mcp.ts risky [--limit N]
pnpm exec node script/ast-metrics-mcp.ts overview
pnpm exec node script/ast-metrics-mcp.ts tools
pnpm exec node script/ast-metrics-mcp.ts call <tool> ['<json arguments>']
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

### Measure the coverage per function: `script/ast-metrics-coverage.ts`

```sh
npm run build
pnpm exec node script/ast-metrics-coverage.ts [--from DIR] [--out FILE]
```

The command runs the unit suite of `dist/` (`node --test --test-concurrency=1
"dist/test/unit/**/*.test.js"`, as `npm run test:unit` does) with
`NODE_V8_COVERAGE` set to a temporary folder, and writes
`ast-report/coverage.json`. The output of the suite goes to stderr. Without
`dist/`, it says "Run npm run build first." With `--from DIR`, it reads the
coverage files of an earlier run and does not run the suite. On this Mac the
run takes about 85 seconds (274 processes, 95 files of `src/`, 1138
functions). The command needs no ast-metrics.

For each function of a script under `dist/src/` (`dist/src/x.js` is the
build of `src/x.ts`), the report gives its name, its range in characters of
the build, the sum of its calls, and its covered share: the part of its
characters that at least one process ran. A process does not run the
characters of a block with count 0, or of a function that it did not call.
The range of a function includes its nested functions, and each nested
function has its own entry. The module function and the anonymous functions
have the name `(anonymous)`. The tsc helpers (`__` names) and the functions
inside them are left out; the wrapper of `__disposeResources` and its
`SuppressedError` fallback stay as two `(anonymous)` entries in each file
that uses `using`. A file that no unit test loads is not in the report. A
function that only integration or acceptance tests call, such as
`createApplication`, shows 0 calls.

V8 gives a block only where its count differs from the count around it, so
the blocks of one function differ from process to process; the command
therefore merges per character. Two lengths for one script mean coverage
files of two builds: the command stops with exit status 1. Exit status 1
also follows a failed suite, a file that is not V8 coverage, or a folder
without coverage files. Then no report is written.

### Take a snapshot: `script/ast-metrics-snapshot.ts`

```sh
pnpm exec node script/ast-metrics-snapshot.ts [--base REF] [--out FILE] [--timeout-ms MS]
```

The command writes the snapshot of the working tree to
`ast-report/snapshot.json`, or to `--out` (relative to the current folder).
It runs `ast-metrics analyze src` for the JSON report and one MCP session of
`ast-metrics mcp src` with `get_communities` and `get_file_metrics` for each
`src/` file (about one second on this repository). The file holds:

- `commit` and `date`: HEAD and its committer date. The files can hold
  changes that are not committed.
- `global`: modularity, cross share, and cycles from `get_communities`, the
  LOC-weighted maintainability, the decision paths, and the counts of files
  and functions. All of them describe `src/` alone.
- `communities`: each community of `src/`, sorted by label, with id, label,
  hub, member files, the numbers of its files, references, and edges to the
  other communities.
- `files`: each `src/` file, sorted by path, with its community (or `null`),
  maintainability, decision paths, lines, risk, and functions.

A label is the largest namespace in `src/` by member count, without the
`src/` prefix. The files at the top of `src/` give `src`, and the shared
kernel is `shared kernel`. When two communities get the same label, each
label gets the basename of its hub in parentheses. The maintainability of a
community or of `src/` is the sum of index × lines over the sum of lines of
the files with an index. A score keeps one decimal and a share two. A value
that ast-metrics does not give is absent. A function without a name is
`(anonymous)`. The exit status is 1, with one diagnostic line and no
snapshot, for a missing executable, a failed analysis, a failed or late
session (`--timeout-ms`, default 60000 ms), or a file without an answer.

With `--base REF`, the command takes the snapshot of the merge base of REF
and HEAD. It adds a temporary detached worktree of that commit in the system
temporary folder (`thermus-snapshot-base-<pid>-<random>`), runs the same
analysis there, and removes the worktree again with `git worktree remove
--force`, also after a failure. The worktree gets no `node_modules`, because
ast-metrics only parses the files, and no hook of the repository runs in it
(`core.hooksPath=/dev/null`). `commit` and `date` then name the merge base
and its committer date. The default file is `ast-report/snapshot-base.json`,
so that `ast-report/snapshot.json` stays.

Before it adds its worktree, the command runs `git worktree prune` and
removes each worktree under the temporary folder whose name has the prefix
and whose run has ended (the name holds the process id of its run, so the
worktree of a run that is still active stays). It removes a stale worktree
with `git worktree remove --force --force`, because git locks a worktree
until its add is complete; a stale worktree that git cannot remove stays,
and the run goes on. One stderr line says how many it removed. On SIGINT or
SIGTERM, the command removes its worktree, says so, and exits 130 or 143; a
signal that comes during a synchronous step, such as `ast-metrics analyze`,
takes effect after that step. After SIGKILL or a crash, the next run removes
the worktree. With `--base`, the exit status is also 1 for an unknown ref, a
ref without a merge base with HEAD, or a worktree that git cannot remove;
the diagnostic then names the folder that stays.

### Show the architecture delta: `script/ast-metrics-architecture.ts`

```sh
pnpm exec node script/ast-metrics-architecture.ts [--base REF] [--head FILE --base-snapshot FILE] [--touched FILES] [--timeout-ms MS] [--out FILE]
```

The command prints the architecture delta of `src/` as Markdown, and also
writes it to `--out` (relative to the current folder). By default it takes
the snapshot of the merge base of `--base` (default `origin/main`) in a
temporary worktree, as `--base` of the snapshot command does, and the
snapshot of the working tree; this takes about two seconds. The changed
files are the `src/` files of the delta rule of the delta command. With
`--head` and `--base-snapshot` it reads two snapshot files and runs no tool;
the changed files then come from `--touched` (paths from the root, separated
by commas), else there are none.

The output is the header `## Architecture of src/: base <8 characters of the
base commit> → head`, one summary line (modularity and cross share with two
decimals, cycles, communities with the shared kernel, base → head, with
` (n new, m gone)` when there are such), then the Mermaid graph with its
legend, or `The map did not change.`

Matching: a head community matches the base community with the largest
Jaccard overlap of their files, at 0.5 or more; the largest overlaps match
first, a tie goes to the first label, and each base community matches once.
An unmatched community is new or gone, so a split or a merge shows as gone
and new. The map changed when a community is new, gone, or touched, or when
a dependency or a cycle appeared or disappeared; numbers, reference counts,
and labels alone do not change it.

The encoding: nodes sorted by label, ids `c_<label>` (a later node with the
same id gets a number); a node text with the label, ` · new` or ` · gone`,
the files, the LOC-weighted maintainability, and the decision paths, each
with `↑n` or `↓n` for a change; a thick border for a touched community; a
grey dashed node for a gone community with its base numbers; edges sorted by
labels with the references and their change, `<n> · cycle` red dashed for a
cycle, `<n> · new` thick for a new dependency (`· new · cycle` red dashed when
both), `gone` grey dashed for a gone dependency; one legend paragraph. A
label text has no double quote and no backtick. Exit status 0 when the
Markdown is printed (a report, not a gate); 1 with one diagnostic line for a
failure; 130 or 143 when a signal stops the base snapshot.

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
  most 10, at most 150 lines and 20 decision paths for a file, at most 30
  lines and 20 logical lines for a function. The rule `no_community_cycles`
  is not used: it judges how ast-metrics groups the files of the whole
  repository, not an import cycle, and its baseline entry drifted with every
  change of `script/`; the architecture delta of the evolution plan shows the
  cycles of `src/` instead.

`.ast-metrics-baseline.yaml` lists the violations that existed when the rules
were last set (169 on 2026-10-18). The review and `ast-metrics lint` report
only a violation that the baseline does not list. A baseline entry carries
the measured value in its message, so a file whose value moved appears
again. Refresh the baseline in two cases: when the rules change, in the same
pull request as the rule change; and when a violation reached `main` without
the process (PR #155 brought two), in a pull request that names it. Run
`ast-metrics baseline` and commit the file.

## How ast-metrics counts

These facts, measured with `ast-metrics-mcp.ts file <path> --json` on
2026-10-17, say what moves a number:

- The decision paths of a file are the sum over all its functions, arrow
  functions included, plus the branches at the top level of the file. A
  function with one `if` or one `?:` adds one path for each.
- The outgoing dependencies of a file are the names it imports, type-only
  imports included: `import type { A, B }` counts 2. Fewer names per file is
  the only way down.
- The maintainability index of a file falls with its volume, so a split along
  a real seam raises the index of each part more than a local rewrite. The
  rule `min_maintainability` applies to each class with the class's own
  volume, so a small class with its helpers as module functions scores
  higher than a large one.
- A test case is an anonymous function in the table of `file`, so the table
  of a test file names the file's helpers and nothing else.

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
- ast-metrics analyzes TypeScript only. The commands under `script/` are
  TypeScript and appear in the delta without a goal; `script/fetch-url.mjs`
  and other JavaScript files stay outside the measurements.
- ast-metrics groups the dependency graph of all that it analyzes, so the
  snapshot analyzes `src/` alone: growth of `script/` or `test/` cannot
  regroup the communities of `src/`. The review and the lint analyze the
  whole repository; that is why `no_community_cycles` is not a rule here:
  with the grouping of the whole repository, it named a "cycle" between two
  halves of `script/` that have no import cycle.
- With namespace granularity, a member of a community can be a deep folder,
  such as `src/auth/hosted-auth`. The snapshot gives each file the community
  of the nearest member; a file under no member has none.
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
