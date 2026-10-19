# Measure and review a pull request with ast-metrics

The commands below wrap the ast-metrics CLI for the process "Code quality review
with ast-metrics" in [AGENTS.md](../../AGENTS.md). They carry the correct syntax
of the tool. Use the baseline wrapper only for a retained high-severity
review finding with a written reason,
or when `.ast-metrics.yaml` rules change. Commit the resulting baseline. A
violation already on `main` is not a third exception. Run the commands from
the repository root; the static commands need no build. A coverage run builds
compiled Node unit tests before it runs both complete unit parts. Delta, review, MCP,
snapshot, CRAP, process, baseline, and online architecture runs need `ast-metrics` on PATH (`brew install ast-metrics/tap/ast-metrics`
on macOS). The wrappers pin 0.43.1. They check CLI results with
`ast-metrics version` and MCP results with the initialization response.
`--allow-tool-version` permits another actual version for that run and its
child operations. A mismatch otherwise fails before results are consumed.
Help, offline architecture rendering, and coverage collection need no
installed ast-metrics. A pin change needs the applicable live contracts and
fixture review. The
[ast-metrics review guide](../../docs/implementation/ast-metrics-review.md)
explains what each command reports, the configuration, and the limits of the
tool.

## Source layout

The nine command entry points stay in this folder:

| Entry point | Purpose |
|---|---|
| `ast-metrics-delta.ts` | Measure changed TypeScript files. |
| `ast-metrics-mcp.ts` | Make one call to the ast-metrics MCP server. |
| `ast-metrics-review.ts` | Report changes in code quality. |
| `ast-metrics-coverage.ts` | Collect unit test coverage per function. |
| `ast-metrics-crap.ts` | Assess per-function CRAP goals and give coverage or split advice. |
| `ast-metrics-architecture.ts` | Compare architecture snapshots and show the trend. |
| `ast-metrics-snapshot.ts` | Capture the metrics of one source tree. |
| `ast-metrics-process.ts` | Run the complete review and save its four sections. |
| `ast-metrics-baseline.ts` | Refresh an allowed baseline and report ignored entry counts. |

Helper modules are grouped by task: `delta/`, `mcp/`, `snapshot/`,
`review/`, `coverage/`, `crap/`, `architecture/`, `process/`, `baseline/`,
and `provenance/`. The last folder owns input identity and its checked readers. The `shared/` folder holds JSON readers,
number calculations, and repository commands that more than one task uses.

Select tests with the [test gate policy](../../docs/implementation/test-gate-policy.md).
Only a change under `src/` requires the full ordinary suite (`npm test`) and
the remaining static and build checks in that policy. Do not add
`npm run check`, which would repeat unit and portal tests. For other changes,
run only affected test groups and existing focused tests. Keep the
delta, review, CRAP, and architecture steps for each pull request, through
the process command. This scope also applies to tests and commands that
start other tests: a focused caller must not expand it indirectly.

## CRAP scores and goals

For decision paths `p` and covered share `c`, `CRAP = p² × (1 − c)³ + p`.
This repository measures V8 coverage of each function's own characters;
it approximates the original basis-path coverage measure. The approved
project goal is CRAP < 30 for added or changed functions, with the inclusive
target CRAP ≤ 15 for added functions. Bands and risk counts keep CRAP ≥ 30
as their boundary. Target 15 is a project decision, not a universal grade.

| Paths | Minimum whole percent for CRAP < 30 | Minimum whole percent for CRAP ≤ 15 |
| --- | --- | --- |
| 0 | 0% | 0% |
| 4 | 0% | 12% |
| 5 | 1% | 27% |
| 10 | 42% | 64% |
| 15 | 60% | 100% |
| 20 | 71% | split |
| 25 | 81% | split |
| 30 | split | split |
| 35 | split | split |

The recommendation is the smallest whole percentage that meets the actual
inequality. `split` means no coverage percentage can meet it. At a positive
crossing `c = 1 − ((L − p) / p²)^(1/3)`, strict comparison uses
`floor(100c) + 1`, inclusive comparison uses `ceil(100c)`, and both check
the candidate. Zero paths and already-passing zero coverage need no division.
At 30 paths full coverage cannot get below 30. At 15 paths full coverage
meets target 15. Five paths at zero coverage and 25 paths at 80% equal 30
and fail the strict limit. Decisions use unrounded values across commands;
display precision or explicit inequalities preserve the boundaries at
29.96 and 15.04.

Coverage must have verified provenance compatible with the candidate's
source, unit-test, and build inputs, including helpers and fixtures. A
prose-only commit can reuse an older compatible report. Matching uses each
file and its unique supported V8 function name. Anonymous and duplicate
names, compiler helpers, missing matches, and zero-own exclusions have no
exact score. Source evidence separately proves new, changed, or unchanged
identity; name equality alone cannot prove copies, changed extractions, or
unresolved moves. Unknown data stays unknown. A path count is a lower bound
on CRAP and can prove a violation at 30 or more.

Architecture joins compatible head coverage with proven base/head pairs to
estimate base risk. Stored head-derived estimates retain their origin and
unknown count; they are not measurements of base coverage. Missing historical
values stay absent. The architecture report has the complete graph and
legend with or without coverage, bands when justified, the complexity table,
added or worsened risk list, and trend. See the
[guide](../../docs/implementation/ast-metrics-review.md#the-crap-goal) for
identity limits, goal exceptions, and exact boundary rules.

## Measure the delta

```text
Usage: pnpm exec node script/code-quality/ast-metrics-delta.ts [--base REF] [--min SCORE] [--no-compare] [--allow-tool-version] [--help]

Options:
  --base REF      Git ref to compare with (default: origin/main)
  --min SCORE     Goal for each production file (integer 0..128; default: 85)
  --no-compare    Do not add the comparison with REF to the HTML report
  --allow-tool-version  Allow an installed version other than the pinned version
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
  --allow-tool-version  Allow an installed version other than the pinned version
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
Usage: pnpm exec node script/code-quality/ast-metrics-review.ts [--base REF] [--max-findings N] [--allow-tool-version] [--help]

Options:
  --base REF          Git ref to compare with (default: origin/main)
  --max-findings N    Most findings in the report (integer 1..1000; default: 50)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h          Show this help
```

Prints the Markdown review of `ast-metrics review` against `--base` (default
`origin/main`) and writes it to `ast-report/review.md`: files whose score
dropped, new functions with more than 10 decision paths, new rule
violations, and the summary of the change. It also writes the current structured
review to `ast-report/review.json`; stale files cannot supply a later result. Exit status 1 when a finding of
severity high exists, else 0. Update the branch from the base first.

Focused tests: select the `ast-metrics-review*.test.ts` rows in the
[available test inventory](#available-tests). Run a live row only within its
listed scope.

## Assess per-function CRAP goals

```text
Usage: pnpm exec node script/code-quality/ast-metrics-crap.ts [--base REF] [--coverage FILE] [--limit N] [--target N] [--allow-tool-version] [PATH...] [--help]

Options:
  --base REF            Compare against the merge base of REF and HEAD
                        (default: origin/main)
  --coverage FILE       Read verified unit coverage from FILE
                        (default: ast-report/coverage.json in the repository)
  --limit N             Require CRAP strictly below N (default: 30)
  --target N            Require new functions at or below N (default: 15)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h            Show this help
```

`N` is a finite positive decimal with at most six fractional digits. Its
decimal digits must form a safe integer after the point is removed (at most
9007199254740991). The target must be less than the limit. Each `PATH` is an
existing TypeScript file under `src/`, relative to the current folder or
absolute. The default selection includes changed and untracked production
files and excludes deletions. Explicit inspection paths keep the proven
classification against the merge base; they do not make every function new.

An empty default selection prints `No production files to assess.` and exits
0 without coverage or MCP. Other runs require compatible verified unit
coverage before measurement. Missing, stale, or unverified coverage gives a
specific error and no measured table. The command uses one bounded MCP
session across selected files and no full architecture snapshot. It starts
no build or test suite.

The table gives `File`, `Function`, `Change`, `Paths`, `Coverage`, `CRAP`,
and `To do` for all functions of selected files, including unchanged and
identity-unknown functions. Under the limit, advice says `ok`, with
`for 15: cover ≥ k%` or `for 15: split` when the inclusive target is missed.
At or above the limit, advice gives strict-limit coverage or `split`.
Unknown coverage gives a marked lower bound and `no coverage data`, or a
split when paths alone prove the goal impossible. Unknown identity states
which goal cannot be classified. Rows sort by exact score or numeric lower
bound descending, then file, function, and stable source identity. Bounds
do not establish an exact ranking of unknown risks. The summary separates
known limit violations, measured target misses, unmeasured functions, and
unresolved required assessments or identities.

Exit 0 means all applicable assessments passed, or the default production
selection was empty. Exit 1 means a known inspected limit violation, a
required new-target miss, an unknown required goal, invalid input, or a tool
failure. Unchanged high functions can retain `unchanged by this PR` in the
review; the command still reports their violations. Under approved D2,
improve required misses for at most three cycles with selected unit tests
or fewer paths. Record score or bound, paths, coverage, classification, and
reason for all unresolved required goals, including new functions above
15 but below 30 and unknown data. Ready may proceed with recorded reasons;
exceptions do not change the command result or excuse tool failures.

Reuse compatible coverage. If collection is outside the selected scope,
record the unavailable assessment as deferred and keep the architecture
graph without bands. The process command composes these assessments; the
baseline wrapper refreshes only an allowed baseline.

Focused tests: select the `ast-metrics-crap*.test.ts` rows in the
[available inventory](#available-tests). Select the live contract only when
its behavior or a shared dependency changes. It reuses a compatible report
and starts no collector:

```sh
AST_METRICS_CRAP_COVERAGE=/absolute/path/coverage.json node --test dist/test/acceptance/script/ast-metrics-crap.live.js
```

Without the variable it reads `ast-report/coverage.json`. Missing tool or
report gives an explicit skip, which is not a pass; record the assessment as
deferred. A present stale report fails. Collect only when the independent
test selection permits both complete unit parts.

## Measure the coverage per function

The command builds first. Run it, or its live test, only
when `src/` changed or both complete parts of the unit suite were already
selected: emitted Node tests and source portal tests. A focused unit package
does not select both complete parts. Reuse current valid coverage when available;
otherwise, use the architecture report without bands, with its graph and
legend, outside that scope. Current coverage must describe the candidate's
source, unit-test, and build inputs, including test helpers and fixtures.
A commit that changes only documents does not invalidate coverage when those
inputs are unchanged.

```text
Usage: pnpm exec node script/code-quality/ast-metrics-coverage.ts [--from DIR] [--out FILE] [--no-build] [--allow-unverified] [--help]

Options:
  --from DIR    Read the coverage files of an earlier run of the unit suite from
                DIR, and do not run the suite
  --no-build    Reuse dist/ only with a matching .coverage-build.json manifest
  --allow-unverified  Inspect --from data without verified capture evidence
  --out FILE    Write the report to FILE (default: ast-report/coverage.json)
  --help, -h    Show this help
```

Runs `npm run build`, then
`node --test --test-concurrency=1 "dist/test/unit/**/*.test.js"`, then
`node --test "test/unit/user-portal/**/*.test.ts"`, with one temporary
`NODE_V8_COVERAGE` folder. Suite output goes to stderr. It checks inputs
and output throughout capture and atomically publishes
`ast-report/coverage.json` only after both runs succeed. Successful raw data
and `capture-manifest.json` stay under
`ast-report/coverage-captures/capture-<unique>/`. The report keeps
`suite: "unit"` and schema `version: 2`; `measurementVersion` is
`own-characters-1`.

Each source file records `representation` (`emitted-javascript` or
`source-typescript`) and `contentIdentity` (SHA-256 of the original file's
UTF-8 text). `dist/src/x.js` maps to `src/x.ts`; source `.ts` URLs under `src/`
are accepted directly. Test scripts and outside paths are ignored. Offsets
use UTF-16 code units in that representation. Different representations
for one logical file cannot be unioned without source-map conversion.

For source TypeScript on Node 24.20.0, named function offsets stay aligned
with the original UTF-16 source. The anonymous module range also includes
the exact appended `\n\n//# sourceURL=<file URL>` trailer. Its identified
length includes that trailer; the content hash excludes it. Whole V8 ranges
are preserved and validated against that exact length, without clamping.
Thus named functions measure source characters, while the anonymous module
can include generated sourceURL characters.

Each measured function preserves its name, whole range, summed calls, and
numeric covered share. Its own characters exclude the union of strictly
contained functions from all compatible processes. Equal ranges do not
establish parenthood; grandchildren are subtracted once. Helpers and their
descendants are subtracted before exclusion. Each process clears zero-count
blocks; a positive overlapping block does not restore them. Execution is
unioned over own characters across processes. A zero-own function appears instead in
`unmeasuredFunctions` with `path`, `name`, `start`, `end`, and
`reason: "no-own-characters"`. It has no measured share or CRAP. This is a
character-coverage approximation, not basis-path coverage.

The collector rejects invalid raw offsets or counts, empty or inverted
ranges, blocks outside their whole range, script bounds violations,
crossing ranges, conflicting content identities, and unsafe summed calls.
Every offset and count must be a finite nonnegative safe integer. Valid
nonempty functions with no own characters are unmeasured, not invalid.

Verified `provenance` holds the source and input fingerprints, runtime,
compiler, unit suite, measurement version, original `capturedCommit`,
`buildFingerprint`, and `captureManifestFingerprint`. It covers test helpers,
fixtures, configuration, manifests, lockfiles, and other test inputs as well
as TypeScript. Paths, content, and executable modes are hashed in lexical
order with unambiguous framing. Symlinks include their link text and target
content; dangling links and cycles fail. Generated output and unrelated
prose do not affect this identity. Markdown fixtures under `src/` and
`test/` remain inputs. See the
[review guide](../../docs/implementation/ast-metrics-review.md#capture-provenance-and-reuse)
for the exact input selection and limits.

`--no-build` reuses output only when `dist/.coverage-build.json` verifies
current inputs and all emitted content. `--from DIR` starts no build or
suite. It validates the original capture manifest, raw content, script
identities, and current inputs/build, preserving the original commit. Raw
V8 URLs are absolute: import requires the original checkout path. This
restriction does not apply to offline rendering of a completed report and
snapshot. Arbitrary raw data cannot become verified by import.
`--allow-unverified` is valid only with `--from`; it writes inspection data
with an explicit reason, available original information, and `commit: null`
when no original commit is available. Neither such output nor legacy
version-1 reports without verified provenance enable bands or historical
counts. `--no-build` and `--from` are mutually exclusive.
Only a complete verified report can establish that an absent file was not
loaded by the selected suite. The command and its live test need no
ast-metrics. Exit status 0 means the report was written. A failed build,
suite, provenance check, or invalid capture exits 1 and preserves an earlier
report. If report publication fails after a successful archive, its raw data
remain available for `--from` recovery.

Focused tests: select the `ast-metrics-coverage*.test.ts` and
`ast-metrics-provenance-*.test.ts` rows in the
[available test inventory](#available-tests). Run a live row only within its
listed scope.

## Show the architecture delta

```text
Usage: pnpm exec node script/code-quality/ast-metrics-architecture.ts [--base REF] [--head FILE --base-snapshot FILE] [--changes FILE] [--touched FILES] [--coverage FILE | --no-coverage] [--trend-store DIR] [--record] [--timeout-ms MS] [--out FILE] [--allow-tool-version] [--help]

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
```

Prints the architecture delta of `src/` as Markdown: a header with the base
commit, one summary line (modularity, cross share, cycles, communities, base
→ head), and a fenced Mermaid graph of the communities with their changes
and its legend. The graph always appears. For an unchanged map, `The map did
not change.` appears above the graph; equal snapshots with no touched files
keep all nodes and dependencies without change arrows or touched borders.
Then it prints the complexity table of the changed `src/` files: the maintainability and the
decision paths of each file, base → head (`new`, `gone`, or `not measured`
when a side has no value), and its rank among the ten riskiest files of the
head, or `No production file changed.` By default it snapshots the merge base of
`--base` (default `origin/main`) in a temporary worktree and the working
tree. File status includes additions, modifications, renames, and deletions.
A rename has one row labeled `newpath (renamed from oldpath)` with the old
base path's values. A deletion has gone head cells and touches its base community. Delta omits
deleted files; architecture retains them. With `--head` and `--base-snapshot`,
it reads two snapshot files and runs no tool. `--changes FILE` gives status
and rename proof tied to both snapshots' commits and source fingerprints.
`--touched` selects root-relative paths, separated by commas, without rename
proof. If both are present, `--touched` selects rows and `--changes` supplies
independent correspondence evidence. Without either option, no changed-file
rows are selected. Repository mode rejects `--changes`; Git owns its status
evidence. See the [offline change format](../../docs/implementation/ast-metrics-change-request.md#a4-offline-change-metadata). With a verified compatible report of the coverage
command (`--coverage`, or `ast-report/coverage.json` of the repository),
each community gets a CRAP band (good, warning, or critical) from its
functions at CRAP 30 or more and their change against the base, the table
gets the column `CRAP ≥ 30`, and a list names each function that the pull
request added or made worse. Last, it prints the trend table of the last
ten records of `main` with the head as the last row. Only `--record` writes
a missing merge-base record to `docs/metrics/` (or `--trend-store`). It
verifies the full base commit, its ancestry on `origin/main`, and its source
content and committer date before writing. Offline `--record` also needs a repository for
these checks. A non-ancestor gives `No record: <base8> is not on origin/main.`
and renders existing history without a write. Missing refs and unverifiable
identity fail. Records use full SHAs; prefix collisions and malformed stores
fail. Record-shaped directories and symlinks also fail. Atomic publication
never overwrites an existing record, including
concurrent writes. Keep the record from `main` in a merge conflict. Exit
status 0 when the Markdown is printed; 1 with one diagnostic line for a failure. The
[ast-metrics review guide](../../docs/implementation/ast-metrics-review.md)
gives the matching rule, the encoding, the bands, the rules of the table, and
the trend store.

Different or missing snapshot versions produce `Tool versions: base
ast-metrics <version or unknown>; head ast-metrics <version or unknown>.`
Equal known versions need no notice.
Offline rendering uses the stored values and checks no installed tool.

Coverage must match the supplied head snapshot's source and input
fingerprints, runtime, compiler, unit suite, and measurement version.
`--no-coverage` ignores default coverage and conflicts with `--coverage`.
Missing, legacy, unverified, or stale coverage withholds bands, the CRAP
column, and assessed-function list, with a specific notice after the summary.
Report and explicit-skip notices also go to stderr. Structural rendering
still exits 0. A stale report names the original capture commit; compatible
output says `Coverage: unit suite at <commit8>.` after complexity, also when
no production file changed. An older capture can match after a prose-only
commit. Offline matching uses only the supplied head's provenance and needs
no Git; a legacy head cannot establish compatibility.

A missing or stale report does not authorize a broader suite. Use
`--no-coverage` outside the collection scope. Paste the fenced `mermaid`
block and legend unchanged into every pull request body, including one
that changes only documents or has no valid coverage.

Source evidence supplies function correspondence. Within the same file or
a proven file rename, a unique declaration kind/owner/name pair keeps its
identity through body or signature edits. Otherwise, a unique unchanged
body/signature pair can prove a move or rename, including a move to an
untracked file. A new function requires complete evidence for its head file
and all base files, proven partners for all base declarations, and no matching
base body or unresolved move candidate. Name equality alone, copies, duplicate bodies, anonymous functions,
and changed extractions cannot prove correspondence. Legacy snapshots stay
readable, but missing evidence remains identity unknown; offline rendering
never reads the caller's checkout for proof. Unknown identity is not called
added or worse. A base function without a proven head partner has no exact
CRAP estimate, including a removed function. Its path count can still prove
a lower-bound violation at 30 or more. The report counts these unknowns
separately. `Unknown function identity: N (no proven declaration or unique
unchanged body/signature correspondence).` appears when identity unknowns
exist, even without coverage. Compatible coverage always adds
`Base functions without an estimated covered share: N.` after complexity.
An unmatched function with at least 30 paths is a known violation: its CRAP
is at least its paths. It counts in risk totals and displays `≥ <paths>`.
It is added risk only with proof that it is new. A larger lower bound alone
does not prove worsening against an unknown base value. Unknown assessment
withholds good; known violations can still support warning or critical.
The unknown count includes every function without a share, also known
lower-bound violations and zero-own exclusions.
The node adds `assessment incomplete: N unknown`; a node without a justified
band has no band color. Missing function metrics count separately as
`1 unmeasured file`, without a guessed function count. These rules add no
fourth band.
Below the unmatched summary, the report lists unmeasured functions of changed
files with at least five paths, sorted by path and name, for example
``- `src/x.ts` `(anonymous)`: paths 5, covered unknown, CRAP ≥ 5``.

New trend records retain the base snapshot's actual `tool` version when
known. Legacy snapshots and records without it have an unknown tool version;
no installed version is substituted during offline rendering.
Stored head-derived counts are labeled `estimate`, the head row is
`measured`, old counts without provenance are `legacy unknown`, and absent
counts show `–`. Estimate provenance records the original coverage commit,
fingerprints, measurement version, and unknown-function count. The stored
value belongs to the first recording pull request; another head can give a
different estimate for the same base. Missing counts stay missing.
Mixed tool versions in the displayed history and head add
`Trend tool versions: <commit8>: ast-metrics X; this pull request: ast-metrics Y.`
The notice names each displayed commit and the head in table order; absent
legacy versions are `unknown`.
Without an offline trend store, the section says `No trend store.` A
configured empty store without `--record` says
`No snapshot of main in the trend store yet.`

Focused tests: select the `ast-metrics-architecture*.test.ts` rows in the
[available test inventory](#available-tests). Run a live row only within its
listed scope.

## Take a snapshot

```text
Usage: pnpm exec node script/code-quality/ast-metrics-snapshot.ts [--base REF] [--out FILE] [--timeout-ms MS] [--allow-tool-version] [--help]

Options:
  --base REF       Take the snapshot of the merge base of REF and HEAD
  --out FILE       The snapshot file, relative to the current folder (default:
                   ast-report/snapshot.json in the repository root, or
                   ast-report/snapshot-base.json with --base)
  --timeout-ms MS  Deadline of the MCP session (100..300000; default: 60000)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h       Show this help
```

Writes the snapshot of the working tree to `ast-report/snapshot.json`, or to
`--out` (relative to the current folder): the global numbers of `src/`, the
`src/` communities with labels, members, references, and edges, and each
`src/` file with its metrics and functions, from one `ast-metrics analyze
src` run and one session of `ast-metrics mcp src`, so that only a change of
`src/` changes the communities. The file is written only after all calls
succeeded and its input identity is unchanged. `tool` names the actual
checked ast-metrics version, including an explicitly permitted version. The
optional `provenance`
field holds source and expected coverage-input fingerprints, runtime,
compiler, suite, and measurement version. Each file can hold optional
`sourceEvidence` (`version: "typescript-tokens-v1"`, `coordinates: "utf16"`,
`complete`) and each supported function can hold optional `identity`
(version, declaration kind, lexical owner, name, source start/end, and SHA-256
body/signature hashes). Ranges use zero-based UTF-16 units and exclude the
end. Token normalization ignores whitespace and comments but preserves
executable syntax and literal spelling. The signature omits the declaration
binding name; recursive body references remain. Anonymous functions,
duplicate names, and unsupported owners stay unknown. Source parse errors withhold identity and set `complete: false`. Completeness requires every executable function to be supported and
every metric to have one declaration. Legacy snapshots remain readable
for structure. See the [snapshot format](../../docs/implementation/ast-metrics-change-request.md#a2-snapshot). Exit status 0 means the snapshot was written. `--timeout-ms`
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

## Run the complete review process

```text
Usage: pnpm exec node script/code-quality/ast-metrics-process.ts [--base REF] [--coverage FILE] [--collect-coverage | --skip-coverage] [--out FILE] [--allow-tool-version] [--help]

Options:
  --base REF            Comparison ref (default: origin/main)
  --coverage FILE       Reuse this report (default: ast-report/coverage.json at root)
  --collect-coverage    Explicitly build and collect the complete unit suite once
  --skip-coverage       Ignore all coverage and render structure without bands
  --out FILE            Save Markdown (default: ast-report/process.md at root)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h            Show this help
```

Run this on the complete candidate after updating from `origin/main` and
selecting tests. It runs delta, review, coverage resolution, CRAP, and
architecture in order. It prints and saves four sections: delta, review,
CRAP, and architecture. The report retains the stage Markdown, including
all tables, drawings, and legends. `--base` reaches every comparison;
`--allow-tool-version` reaches each tool operation. Explicit file paths
resolve from the current folder; default paths use the repository root.

Coverage reuse is the default. `--coverage FILE` selects another report.
Reuse requires verified capture provenance compatible with the candidate's
source, unit-test, and build inputs. Missing or stale data never starts a
suite. `--collect-coverage` builds and collects both complete unit parts
once. Use it only when `src/` changed or both parts were independently
selected: emitted Node tests and source portal tests. Record that selection
in the pull request evidence. `--skip-coverage` ignores all reports and
renders structure without bands. Give only one coverage option; conflicting
reuse, collection, and skip options fail.

An empty default production-file selection has no required CRAP goals. It
prints `No production files to assess.` without coverage or MCP for that
stage. A document-only run can finish and record structure without coverage
counts. A nonempty required selection without sufficient data stays
unresolved and exits 1, even with explicit skip.

Completed goal misses continue to give all evidence and exit 1. Operational
failures leave clear partial results and dependent sections unavailable;
they also exit 1. No failed analysis or unavailable required assessment
writes history. After all required analyses complete, the process requests
architecture recording under the verified-base rules, including when a
completed assessment misses a goal. Existing records stay unchanged. Exit
0 requires completed passing assessments. Invalid options and recording
failures exit 1. Approved goal exceptions do not excuse tool failures or
change these exit results. Exploratory standalone architecture stays
read-only without `--record`.

Focused tests: select the process and stage-outcome rows in the
[available test inventory](#available-tests). Process doubles never start
application coverage implicitly. A new process test does not select both
complete unit parts or every live contract.

## Refresh an allowed baseline

```text
Usage: pnpm exec node script/code-quality/ast-metrics-baseline.ts [--allow-tool-version] [--help]

Options:
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h            Show this help before Git or tool access
```

Runs `ast-metrics baseline` from the repository root, with the pinned tool
check or an explicit version override. It reports the number of YAML ignored
entries before and after the refresh. A missing baseline starts at zero.
Exit 0 means the refresh succeeded and both counts are valid; failures exit
1. Help needs no Git or tool access.

This wrapper adds no permission to change `.ast-metrics-baseline.yaml`. Use
it only for a retained high finding with a written reason or a change to
`.ast-metrics.yaml` rules. Commit the resulting baseline in the same pull
request. A violation already on `main` is not a third exception.

Focused tests: select the `ast-metrics-baseline.test.ts` rows in the
[available test inventory](#available-tests).

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

Live contracts check invariants of the current repository, not fixed community,
cycle, or file counts. MCP checks the function table and missing-file error.
Snapshot checks the shared kernel, unique labels, source members, valid
community and cycle references, positive file and function counts, HEAD,
deadlines, and worktree cleanup.

`ast-metrics-architecture.live.ts` is structural only. It uses `--no-coverage`,
checks equal metrics and the graph against the reported communities, and starts
no suite. `ast-metrics-architecture-coverage.live.ts` separately collects both
complete unit parts and passes its private report with `--coverage`.
`ast-metrics-coverage.live.ts` also collects both complete parts and keeps the
explicit proof that portal unit tests call `initializePortal`.
Both collectors assert that the default report stays unchanged. Each
architecture file uses a temporary trend store and writes no repository
trend record. Structural architecture checks that no worktree stays.

MCP, snapshot, and both architecture live files need ast-metrics on PATH and
skip when it is absent. The coverage live file needs no ast-metrics. A skip is
not a pass. Run either collector only when `src/` changed or both complete
unit parts were independently selected: emitted Node tests and source portal
tests. Otherwise record it as deferred, not passed. A build only prepares
emitted tests. Command and double changes select the affected focused and live
contracts, as mapped in the [policy](../../docs/implementation/test-gate-policy.md#ast-metrics-focused-and-live-contracts);
they do not select all live files.

`ast-metrics-tool-version.test.ts` checks that a later read-only architecture
run preserves a stored record's tool version and leaves the file unchanged.
The unit `ast-metrics-architecture-trend-provenance.test.ts` checks that table-number
reads preserve a present version and keep it absent for legacy records.

Architecture acceptance cases share complete base, banded, and repository
drawings in `test/acceptance/script/fixtures/ast-metrics-architecture-goldens.ts`.
The document-only case in `ast-metrics-architecture-unchanged.test.ts` checks
the complete graph without bands and proves that no test suite runs.

<!-- code-quality-tests:start -->

| Kind | Test file | Collects full unit coverage |
| --- | --- | --- |
| ordinary | test/acceptance/script/ast-metrics-architecture-bands.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-base.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-changes.test.ts | no |
| live | test/acceptance/script/ast-metrics-architecture-coverage.live.ts | yes |
| ordinary | test/acceptance/script/ast-metrics-architecture-identity.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-provenance.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-repository-changes.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-repository-provenance.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-table.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-trend.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-unchanged.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-unmeasured.test.ts | no |
| live | test/acceptance/script/ast-metrics-architecture.live.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-baseline.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-coverage-failures.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-coverage-own.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-coverage-provenance.test.ts | no |
| live | test/acceptance/script/ast-metrics-coverage.live.ts | yes |
| ordinary | test/acceptance/script/ast-metrics-coverage.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-crap-goals.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-crap-identity.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-crap-inputs.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-crap-paths.test.ts | no |
| live | test/acceptance/script/ast-metrics-crap.live.ts | no |
| ordinary | test/acceptance/script/ast-metrics-crap.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-delta-failures.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-delta-goal.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-delta.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-file-changes.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-mcp-help.test.ts | no |
| live | test/acceptance/script/ast-metrics-mcp.live.ts | no |
| ordinary | test/acceptance/script/ast-metrics-mcp.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-process-collection.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-process-coverage.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-process-failures.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-process.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-review.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-base-failures.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-base-worktree.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-base.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-failures.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-provenance.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-source.test.ts | no |
| live | test/acceptance/script/ast-metrics-snapshot.live.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-stage-outcomes.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-tool-version.test.ts | no |
| ordinary | test/acceptance/script/script-readme.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-bands.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-changes.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-coverage.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-crap.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-functions.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-identity.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-provenance.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-report.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-table.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend-file.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend-provenance.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend-publication.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend-store.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-unmeasured.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture.test.ts | no |
| ordinary | test/unit/script/ast-metrics-baseline.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-capture.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-input.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-own.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-unmeasured.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage.test.ts | no |
| ordinary | test/unit/script/ast-metrics-crap-command.test.ts | no |
| ordinary | test/unit/script/ast-metrics-crap-goals.test.ts | no |
| ordinary | test/unit/script/ast-metrics-crap-report.test.ts | no |
| ordinary | test/unit/script/ast-metrics-delta.test.ts | no |
| ordinary | test/unit/script/ast-metrics-file-changes.test.ts | no |
| ordinary | test/unit/script/ast-metrics-mcp.test.ts | no |
| ordinary | test/unit/script/ast-metrics-process.test.ts | no |
| ordinary | test/unit/script/ast-metrics-provenance-inputs.test.ts | no |
| ordinary | test/unit/script/ast-metrics-provenance-read.test.ts | no |
| ordinary | test/unit/script/ast-metrics-review-report.test.ts | no |
| ordinary | test/unit/script/ast-metrics-review.test.ts | no |
| ordinary | test/unit/script/ast-metrics-snapshot.test.ts | no |
| ordinary | test/unit/script/ast-metrics-source-evidence-read.test.ts | no |
| ordinary | test/unit/script/ast-metrics-source-evidence.test.ts | no |
| ordinary | test/unit/script/ast-metrics-tool-version.test.ts | no |
<!-- code-quality-tests:end -->
