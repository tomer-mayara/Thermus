# ast-metrics review guide

This guide gives the details of the process "Code quality review with
ast-metrics" in [AGENTS.md](../../AGENTS.md). AGENTS.md gives the rules; this
guide gives the commands, what they report, the configuration, and the limits
of the tool. If the two disagree, follow AGENTS.md and correct this guide.

The facts in this guide were verified on 2026-10-17 through 2026-10-19 with
ast-metrics 0.43.1 on this repository. PR #188 merged CR-10 option A,
CR-11, and manual CR-12 at `efed6618`.
The architecture plan is now an [archival record](../archive/architecture-evolution-plan.md).
This guide holds its current decisions and limits. On 2026-10-19, the owner
deferred D4's measured base-coverage store and D5's merge workflow. D8 kept
the two baseline refresh reasons and rejected a third reason for violations
already on `main`. Later that day, the owner reduced the reasons to one: a
change to the rules in `.ast-metrics.yaml`. A retained high finding is not a
reason, because the baseline cannot list the high findings of the review: a
score drop, a new function at 25 or more paths, or a forbidden import. D9
keeps each command's unexpected-error
diagnostics; no shared normalization is approved. These dispositions change
no runtime behavior and grant no broader test scope.
A later version can behave differently; verify the limits again before you
change the process.

## Installation

Delta, review, MCP, snapshot, CRAP, process, baseline, backfill, and online architecture
need the `ast-metrics` executable on PATH. On macOS, install it
from its Homebrew tap: `brew install ast-metrics/tap/ast-metrics`. Other
systems get it from <https://github.com/ast-metrics/ast-metrics>. Check
`ast-metrics version`: the wrappers pin 0.43.1. CLI calls check that
subcommand, and MCP calls check initialization's `serverInfo.version`. Each
operation checks before it consumes results and reuses the checked value in
its child operations. In a composite snapshot or architecture run, every MCP
initialization must also match the checked CLI version, even with an
override. A mismatch gives `ast-metrics <v> is not the pinned
<p>; run with --allow-tool-version to continue.` Pass `--allow-tool-version`
to the outer command to permit another actual version throughout that run.
The override does not change the pin. A pin change needs the applicable live
contracts and fixture review.

Help and offline architecture rendering start no tool and check no installed
version. Coverage collection does not invoke ast-metrics and has no tool
version option. The commands under `script/code-quality/` need no build; run
them from the repository root with `pnpm exec node`.

## The commands

The ten entry points and their helper folders are in
[`script/code-quality/`](../../script/code-quality/README.md). That README explains
CRAP before the command sections, which follow the review process order. It
lists each command's synopsis, options and defaults, output, exits, and focused
tests. Use these wrappers for the review process. The process wrapper composes
the complete review.
The baseline wrapper reports counts for an allowed refresh. Shared helpers
handle repeated argument and limit checks, JSON file reads, and UTF-16 text
ordering. Consumers keep their schema checks and file-kind diagnostics.
Comparators return zero for ties; locale-sensitive sorts keep their existing
contract. Each command keeps its help, output, cleanup, and failure behavior.
D9 retains these command-specific unexpected-error diagnostics after CR-17.

Select tests under the [test gate policy](test-gate-policy.md) before these
commands. Only a change under `src/` requires the full ordinary suite
(`npm test`) and the remaining static and build checks in that policy.
Do not add `npm run check`, which would repeat unit and portal tests.
For other changes, run only affected test groups and existing focused tests.
The existing `script-readme.test.ts` contract checks command help and both test
inventories. Changes to documented help contracts or either test inventory
select that focused contract. They do not select listed commands, live
collectors, or a complete suite. See the
[focused command](test-gate-policy.md#select-by-changed-path).
The delta, review, snapshot, and architecture commands do not run tests.
Run the process command for every pull request; the individual commands
remain available for inspection and improvement passes.

By default, the coverage command runs both parts of the unit suite: emitted Node tests
and source portal tests. Run it, or its live test, only when `src/` changed
or both complete parts were already selected. A focused unit package or a
script change alone does not select both complete parts. Reuse a current
valid report when available; otherwise, a review outside that scope uses
the architecture report with `--no-coverage`. The missing or stale report
does not expand the test selection.
Explicit repeatable `--suite` options can select unit, integration, and
acceptance coverage. Each complete requested group must already be selected
under the test gate policy. A flag does not grant that scope. The process
wrapper still collects only the default unit group. See the coverage section
for package selections, capture identities, and child-process limits.
The separate `ast-metrics-architecture-coverage.live.ts` has the same
restriction. It collects both complete unit parts and passes its private
report with `--coverage`. `ast-metrics-architecture.live.ts` is structural
only: it uses `--no-coverage` and starts no suite. Both collectors assert
that the default coverage report stays unchanged. Both architecture files
use private trend stores. Structural architecture checks worktree cleanup.

Live contracts use repository invariants rather than fixed community, cycle,
or file counts. Snapshot checks the shared kernel, unique labels, source
members, valid community and cycle references, positive file and function
counts, HEAD, deadlines, and cleanup. It also checks unique normalized source
dependency pairs and the literal dynamic import in `application.ts`.
Structural architecture checks equal metrics, every reported community,
each populated source folder component, and both complete graphs and legends. MCP
checks the function table without requiring an incidental function name.
Coverage retains the explicit proof that portal unit tests call
`initializePortal`.

MCP, snapshot, and both architecture live files need ast-metrics on PATH and
skip when it is absent. The coverage live file needs no ast-metrics. A skip
or a deferred collector is not a pass. Command and double changes select
only affected focused and live contracts. The
[policy mapping and safe commands](test-gate-policy.md#ast-metrics-focused-and-live-contracts)
show the module areas and the structural and collecting runs. A slice that
changes only dedicated live files and documents can run MCP, snapshot,
structural architecture, and
the existing focused README contract after a build. It defers both collectors
and adds no complete suite. A build only prepares emitted test files.

### Run the complete process: `script/code-quality/ast-metrics-process.ts`

```sh
pnpm exec node script/code-quality/ast-metrics-process.ts [--base REF] [--coverage FILE] [--collect-coverage | --skip-coverage] [--out FILE] [--allow-tool-version]
```

The defaults are base `origin/main`, reuse of `ast-report/coverage.json`,
and output `ast-report/process.md`, all default report paths at the
repository root. Explicit file paths resolve from the current folder.
`--base` applies to each comparison, and `--allow-tool-version` applies to
each tool operation. Both wrappers give `--help` before Git or tool access.

The process runs delta, review, coverage resolution, CRAP, and architecture
in order. It prints and saves four Markdown sections, keeping the stage
reports and architecture tables, fenced drawings, and legends unchanged.
The report uses typed outcomes to distinguish completed goal misses from
failed operations. Completed goal misses continue and exit 1. A failed
prerequisite leaves dependent stages unavailable, saves partial evidence,
and exits 1. Required assessments without sufficient data do not pass.
Exit 0 means all required assessments completed and passed. Invalid options
or a recording failure also exit 1.

The programmatic `runProcess` result is `ProcessResult`, which extends
`StageReport` with `readonly outcomes: readonly StageOutcome[]`. Outcomes keep
the final Delta, Review, CRAP, Architecture order and each stage's text and
status: `passed`, `goal miss`, `failed` or `unavailable`. Each entry reflects the final state, including any history publication
result. These are process stage outcomes, not
native exit records. CLI output, saved Markdown, exits, stage execution, coverage
and history behavior stay unchanged. This adds no flag, JSON artifact, route,
assessment, policy adoption or automatic merge.

Reuse is the default; `--coverage FILE` selects another report. Missing or
stale coverage never starts a suite. `--collect-coverage` explicitly builds
and runs both complete unit parts once. Use it only when `src/` changed or
both complete parts were independently selected, and record that selection
in the pull request evidence. `--skip-coverage` ignores all reports and
uses architecture without coverage. Reuse, collection, and skip options
conflict with one another. A missing band is no reason to expand the tests.

An empty default production-file selection prints
`No production files to assess.` without reading coverage or using MCP
for CRAP. A document-only run can therefore finish without coverage and
record structure without coverage-derived counts. A required nonempty
selection without compatible data remains unassessed and prevents recording.

After all required analyses complete, the process requests architecture's
verified recording operation. A completed goal miss can still record;
a failed operation or an unavailable required assessment cannot. Existing
records remain immutable. Commit a new verified record with the candidate.
Standalone architecture is read-only without `--record`. Use the same base
after fixes. A fix under `src/`, `test/`, or `script/` makes the coverage
report stale; collect again when the test selection permits it. A
document-only fix can reuse the report. The approved exceptions after at
most three improvement
cycles change neither exit results nor tool failure requirements.

### Refresh a permitted baseline: `script/code-quality/ast-metrics-baseline.ts`

```sh
pnpm exec node script/code-quality/ast-metrics-baseline.ts [--allow-tool-version]
```

The wrapper runs `ast-metrics baseline` from the repository root and counts
YAML ignored entries before and after. A missing initial baseline counts as
zero. Exit 0 means the refresh succeeded and counts are valid; failures exit
1. The same version pin and explicit override apply. This command adds no
permission: refresh only when the pull request changes the rules in
`.ast-metrics.yaml`. Commit the baseline in the same pull request. A retained
review finding and a violation already on `main` are not reasons.

### Measure the delta: `script/code-quality/ast-metrics-delta.ts`

```sh
pnpm exec node script/code-quality/ast-metrics-delta.ts [--base REF] [--min SCORE] [--no-compare] [--allow-tool-version]
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

### Review the delta: `script/code-quality/ast-metrics-review.ts`

```sh
pnpm exec node script/code-quality/ast-metrics-review.ts [--base REF] [--max-findings N] [--allow-tool-version]
```

The command runs `ast-metrics review` against `--base` (default
`origin/main`), prints its Markdown report, and writes the same text to
`ast-report/review.md`. It also produces a fresh structured report at
`ast-report/review.json`; stale output cannot supply a later assessment.
The report lists:

- A file whose maintainability score dropped, with the scores before and
  after (severity high).
- A new function with more than 10 decision paths, with its file, line, and
  name (severity high at 25 or more, else medium).
- A new forbidden resolved import from `src/html-cleaner-pipeline/` to
  `src/mcp/`, or from `src/website-fetcher/` to `src/auth/` (severity high).
- A rule violation that the baseline does not list, for the rules in
  `.ast-metrics.yaml`.
- A summary of the change in complexity, maintainability, outgoing
  dependencies, and estimated bugs, and the improvements.

The wrapper validates native Markdown, JSON, counts, gate, stdout, and exit
status before applying project policy. Native 0.43.1 warns at 10 paths; the
wrapper removes only its medium new-function finding with numeric path count
exactly 10. Other function warnings and native high findings remain. Adjusted
JSON retains the complete `nativeReview` and `reviewPolicy` metadata, with
recomputed counts and gate. Adjusted Markdown obeys `--max-findings`; JSON
keeps every finding, and hidden high findings still fail the gate.

When policy changes the report, forwarded tool stderr is labelled
`Native ast-metrics review diagnostic:` so native counts remain distinct from
wrapper counts. Unchanged native output and operational-failure diagnostics
keep their original form.

The layer rules use CR-13 resolved source imports and compare with the merge
base of REF and HEAD. They check ordinary, type-only, side-effect, re-export,
and literal dynamic imports. Known forbidden base pairs can follow proven Git
source/target renames or unique exact-content deleted/added moves without a
new finding. An allowed pair moved across a
forbidden boundary is new risk. Affected guarded sources with parse errors,
unresolved local imports, unsupported aliases, or nonliteral dynamic imports
fail with a dependency diagnostic. Unchanged unrelated uncertainty does not
block a document-only review. Symbol names alone cannot prove a forbidden path.
The native baseline does not suppress these resolved-path checks. Existing
forbidden pairs are established from the merge base, not baseline messages.

The exit status is 1 when a finding of severity high exists, else 0. The
native review compares the working tree with the tip of the base ref, not with
the merge base: update the branch from `origin/main` first, or the review lists
changes that are not yours.

### Ask the MCP server: `script/code-quality/ast-metrics-mcp.ts`

```sh
pnpm exec node script/code-quality/ast-metrics-mcp.ts file <path> [--json]
pnpm exec node script/code-quality/ast-metrics-mcp.ts complex [--limit N] [--max-cyclomatic N]
pnpm exec node script/code-quality/ast-metrics-mcp.ts risky [--limit N]
pnpm exec node script/code-quality/ast-metrics-mcp.ts overview
pnpm exec node script/code-quality/ast-metrics-mcp.ts tools
pnpm exec node script/code-quality/ast-metrics-mcp.ts call <tool> ['<json arguments>']
```

Each run starts `ast-metrics mcp` as a child process, makes one call over
standard input and output, prints the answer, and lets the server exit. No
server stays behind, and each call reads the current files, so the numbers
follow your edits. A call takes about one second.

- `file <path>` is the tool for a refactor pass: it prints the score, the
  decision paths, and the lines of each function in the file, lowest score
  first. The lines column counts lines of code (LOC); it does not give source
  positions. The functions at the top of the list are the ones to split first.
- `complex` and `risky` list the classes and files of the whole repository
  with the highest complexity, the lowest maintainability, and the highest
  risk (complexity, maintainability, coupling, and change frequency
  together).
- `overview` gives the totals of the repository and the architecture
  suggestions: dependency cycles between groups of packages and packages that
  always change together.
- `call` reaches every tool of the server; `tools` lists them.

Each MCP subcommand accepts the common `--allow-tool-version` override.
When `--limit` or `--max-cyclomatic` is absent, the wrapper omits that tool
argument and delegates the default to ast-metrics.

The server analyzes the same files as the delta command, test files
included. In a test file, each case is an anonymous function in the table.
`file` takes a path relative to the current folder or an absolute path in
the repository.

### Measure the coverage per function: `script/code-quality/ast-metrics-coverage.ts`

Use the default run only when the test selection permits both complete parts
of the unit suite, as stated above. For explicit suites, each complete requested
group must be independently selected. A current valid report covers the
candidate's source, test, and build inputs, including test helpers and
fixtures. A commit that changes only documents does not invalidate coverage
when those inputs are unchanged. The report's commit label alone does not
prove that it is current. If you cannot verify its inputs, use the
architecture report without coverage.

```sh
pnpm exec node script/code-quality/ast-metrics-coverage.ts [--suite unit|integration|acceptance]... [--no-build] [--from DIR] [--allow-unverified] [--out FILE]
```

By default, the command first builds the candidate. It then runs emitted Node unit
tests (`node --test --test-concurrency=1 "dist/test/unit/**/*.test.js"`),
then the source portal unit tests (`node --test
"test/unit/user-portal/**/*.test.ts"`). Both runs use one
`NODE_V8_COVERAGE` folder. Suite output goes to stderr. The command needs
no ast-metrics. It publishes `ast-report/coverage.json` atomically only
after the build, both runs, and the provenance checks succeed. It retains
the raw capture and its manifest under
`ast-report/coverage-captures/capture-<suite>-<unique>/`. The build manifest is
`dist/.coverage-build.json`. `--no-build` accepts this output only when its
content hash and current input identity match; timestamps and file sizes
are insufficient.

Repeat `--suite unit|integration|acceptance` to request other already-selected
complete groups. The default is `unit`. Duplicate requests are removed in
first-requested order. One build precedes the runs, and each suite gets a
separate retained capture. Unit includes emitted Node unit tests and source
portal unit tests. Integration uses the emitted integration group. Acceptance
uses emitted acceptance tests excluding `hosted-image`, then source portal
acceptance tests. The collector accepts the package's `test:<suite>` build
prerequisite and direct Node test selections only. An unsupported prerequisite,
nested command, or selection outside that suite defers collection before it
builds or launches children. It never expands selection to obtain coverage.
`--from DIR` imports one archived capture without execution and cannot combine
with `--suite`.

Run comparison and coverage collection sequentially in the same checkout.
Native ast-metrics 0.43.1 `analyze --compare-with` checks out the comparison
ref (`origin/main` by default), then returns to the candidate branch. It can
refuse a dirty tree. Do not change
the checkout or run delta or process comparisons while collection is active.
A temporary checkout change can remove the collector preload and invalidate
the capture.

Compatible own-character execution is unioned across requested suites.
Source TypeScript and emitted JavaScript for one logical file still conflict.
The collector propagates its lifecycle preload into same-capture Node children
and workers, including children with a reduced environment. The runner uses
`--import`. Default ESM file workers keep Node's normal argument filtering.
Workers with an explicit argument array receive the required preload. A default
CommonJS eval worker does not inherit `--import` execution and stays unverified
unless it has the explicit captured-argument adaptation.
Explicit independent captures stay separate. Each process/thread needs normal flush-and-exit evidence,
the verified loader shutdown protocol described below, or the approved verified
pre-crash seal. Missing, untracked, unflushed, or
unsealed killed participants prevent verified publication; a failed suite keeps
the previous good report. A real collector proof runs only when all of its
complete groups are already selected; fixture success does not prove that
whole-repository collection will succeed.

The earlier complete real combined capture passed on 2026-10-19 in requested order
`[acceptance, unit]`: 853 emitted acceptance tests and 16 portal acceptance
tests, then 3,544 emitted unit tests and 19 portal unit tests. Every group had
zero failures and zero skips. Both captures are verified under
`normal-exit-or-sealed-1` and retain distinct original capture IDs. The report
contains 115 production files and 3,430 raw V8 files; its `processes` field
counts raw files, not distinct processes. `createApplication` was called 89
times with covered share 1. The proof includes eight sealed unit crash children,
the busy MCP fake's normal SIGTERM cleanup, and the registration test's clean
server stop. That earlier proof did not select the complete integration group; its
suite-union contracts used doubles. Both collecting live checks passed, with no skips. The latest retained unit
capture also imported as verified, with 104 production files and 880 raw V8
files. All 13 affected live cases passed without skips: two collecting cases,
ten structural cases, and one CRAP case with verified imported unit coverage.
Final typechecking also passed.

Current loader proof, 2026-10-19: the complete real integration capture passed
at `88bfbf7193e990474be87170b62e10cb7d8118ce`, on top of `main` at `bc722eef`
(PR #192). All 535 tests in 44 suites passed, with zero failures, cancellations,
skips, or todos. Collection completed with exit 0 in 29.671 seconds. This is a
complete repository capture, separate from the small protocol fixtures. The
existing real work-slice tests were unchanged.

The retained `capture-integration-aQqaHK` archive uses manifest version 4 and
`normal-exit-or-sealed-or-loader-1`. It contains 226 raw V8 files from 109 PIDs
and 113 participant identities: 109 normal-exit owners and four actual internal
`tsx` loader threads. Every loader has matching request, acknowledgement, and
owner receipt evidence, an unchanged one-file checkpoint, one distinct later
V8 flush, and a normally completed matching owner. The report covers 110 source
files and records 24 calls to `createApplication`.

Strict `--from` reimport exited 0 in 2.447 seconds and produced a byte-identical
report. It kept `["integration"]`, the original capture commit, and the nested original capture
identity. The default `ast-report/coverage.json` stayed unchanged. Local evidence
is under `ast-report/loader-integration-final-2026-10-19/`.
The earlier `c620cf8f` run also passed all 535 integration tests, but its four
raw-only loader threads caused strict verification to fail. That failed capture
remains historical evidence; it was not promoted to verified status.

The collector accepts emitted JavaScript under `dist/src/` and source
TypeScript under `src/`. It maps `dist/src/x.js` to `src/x.ts` and ignores
test scripts and outside paths. Each file preserves `representation`
(`emitted-javascript` or `source-typescript`) and `contentIdentity`
(SHA-256 of the original file's UTF-8 text). Offsets use UTF-16 code units of that
representation, not bytes. Equal length does not prove equal content.
Ranges from emitted JavaScript and source TypeScript cannot be merged for
one logical file; no source-map conversion is implemented.

Node 24.20.0 keeps named function offsets in stripped TypeScript aligned
with the original UTF-16 source text. It appends the exact trailer
`\n\n//# sourceURL=<file URL>`, which extends the anonymous module's whole
range. For `source-typescript`, the identified length includes that trailer;
`contentIdentity` hashes the original file before the trailer. The collector
preserves V8's whole ranges and validates against this exact length. It does
not clamp ranges or allow arbitrary trailing characters. Named functions
still measure their actual source characters; the anonymous module can
include generated sourceURL characters.

For each measured function, the report preserves its whole `start` and
`end`, name, sum of calls, and numeric `coveredShare`. The module function
and anonymous functions have the name `(anonymous)`. A complete verified
report can establish that an absent file was not loaded by the selected
suite set. An imported report with unknown capture origin cannot establish
this. Functions called only by an unselected suite can show zero calls.

#### How the share is counted

A function's own characters are its whole range minus the union of all
strictly contained function ranges. Grandchildren are subtracted once;
equal ranges do not establish parenthood. The collector builds that union
from all processes with compatible representation and content identity
before it calculates shares. Process order and a nested entry missing from
one process do not change the denominator. A process runs no character of
a zero-count block or of a function it did not call. Within one process,
a positive block that overlaps a zero-count block does not restore the
cleared characters. The collector unions execution over the remaining own
characters across processes and sums calls.
This is a character-coverage approximation, not basis-path coverage.

Compiler helpers (`__` names) and their descendants are excluded from the
reported functions. Their ranges are subtracted from containing source
functions before exclusion. A valid function with no own characters is
omitted from measured functions and recorded in `unmeasuredFunctions`
with `path`, `name`, `start`, `end`, and reason `no-own-characters`. It is
unmeasured, with neither zero nor full coverage. Measured entries keep a
numeric share in [0,1]. New reports use JSON schema `version: 2` and identify the measurement as
`measurementVersion: "own-characters-1"`.

Every raw offset and count must be a finite nonnegative safe integer. A
whole range must satisfy `0 ≤ start < end ≤ identified script UTF-16
length`; each nonempty block must lie within its whole range. The collector
rejects malformed, empty, inverted, or out-of-bounds ranges, crossing
function ranges, conflicting content identities, invalid counts, and unsafe
summed calls. It does not clamp invalid data or publish a report after a
failed suite or invalid capture. Empty raw ranges are invalid; a nonempty
function with no own characters after subtraction is the unmeasured case.

#### Capture provenance and reuse

New reports use schema `version: 2`; measurement semantics are separately
named by `measurementVersion: "own-characters-1"`. Verified `provenance`
holds `sourceFingerprint`, `inputsFingerprint`, `runtime`, `compiler`,
`suite: "unit"`, `measurementVersion`, `capturedCommit`, `buildFingerprint`,
and `captureManifestFingerprint`. The commit is the original capture's
commit, not the commit of a later import. The capture manifest also binds
each script's path, representation, and content identity.

Default unit reports retain the single string `suite: "unit"`. An explicit
non-unit or multi-suite report uses the same ordered suite array in the report
and provenance, such as `["unit", "acceptance"]`. Its `captures` array retains
each original full per-suite identity and capture-manifest fingerprint.
`comparisonIdentity` uses the canonical unit input identity to compare the
current tree; it does not replace those true per-suite identities. Each suite
is part of its own input hash. The aggregate `captureManifestFingerprint` is
SHA-256 of the ordered JSON list of each capture's `suite` and
`captureManifestFingerprint`. Readers validate the suite order and set, reject
duplicates, and check each capture's commit, source, runtime, compiler, build,
measurement version, and comparison identity. Legacy unit strings remain
readable.

New capture manifests use `version: 4`, retain full per-suite `identity` and
`comparisonIdentity`, and use
`completionProtocol: "normal-exit-or-sealed-or-loader-1"` with the original
`captureId`. Per-capture provenance retains both fields.
`captureId` hashes the resolved original capture directory; import preserves it.
`rawFingerprint` binds raw `coverage-*`, lifecycle `process-*`, `seal-request-*`,
`seal-receipt-*`, `signal-*`, and loader handshake file names and contents.
Manifest versions 1, 2, and 3 remain readable under their original evidence rules;
legacy data is not relabeled as using the new protocol. Report schema stays
version 2 and the measurement stays `own-characters-1`. The build manifest
still uses the canonical unit identity and an emitted-output hash.

Normal-exit markers record an `exitCheckpoint` after an explicit V8 flush.
Verification requires later V8 raw evidence beyond that checkpoint. This proves
a later flush; it does not by itself prove that termination was automatic-only.
Parent observations in `signal-*` receipts reject signal exits for captured
PIDs unless a verified pre-crash seal supports SIGKILL. A later flush alone
cannot turn such a signal exit into normal completion. Signals from native
children with no captured Node identity do not invalidate Node coverage.

For intentional crashes, `test/support/processes/crash-child.ts` requests a
seal tied to capture ID, PID, main-thread identity, and a fresh nonce. It can
use IPC or a prepared nonce at a synchronous blocked fixture boundary; both
paths require the same request and receipt evidence. Only known crash fixtures
set `THERMUS_COVERAGE_CRASH=1` to install the seal IPC listener. Ordinary
captured forks keep their normal exit and product IPC behavior without that
listener. The OAuth fixture uses `THERMUS_COVERAGE_SEAL_NONCE` and a synchronous
seal boundary; it adds no IPC listener. The child flushes V8, stops coverage, hashes its raw file set, writes the sealed
marker, and blocks execution. Only a process without worker-thread history
can seal; active workers and previous worker evidence both prevent it. The parent
verifies the seal, sends SIGKILL, waits for closure, verifies the raw set and
hashes again, and writes the receipt. A queued later product call must not run
after sealing. Missing, stale, mismatched, or changed seal evidence fails
verification. The approved protocol is explicit; an arbitrary killed child
cannot obtain verified status by being omitted.

Verified public worker cases include default ESM file workers and workers
with explicit captured arguments. A default CommonJS eval worker without
that adaptation stays unverified; support does not imply that all worker
forms can supply completion evidence.

A capture preload registers an observer in the actual asynchronous loader thread
through public [`module.register()`](https://nodejs.org/download/release/v24.20.0/docs/api/module.html#asynchronous-customization-hooks).
This covers actual asynchronous loaders used by real `pnpm` and `tsx`
TypeScript entries with either the import or require capture preload. It does
not replace the entry or its loader. The loader and its owner exchange a
capture ID, PID, actual loader thread ID, owner thread ID,
and nonce. Persistent `loader-request-*`, `loader-ack-*`, and
`loader-receipt-*` files bind that exchange to the captured participant under
`loaderProtocol: "loader-flush-park-1"`. A `loader-parked` process marker keeps
`complete: false`; only the checked shutdown exchange can approve it.

Pinned Node 24.20.0 also runs `--require` preloads inside its asynchronous loader
thread, as shown in the [loader worker source](https://github.com/nodejs/node/blob/v24.20.0/lib/internal/modules/esm/worker.js).
The lifecycle preload first writes an incomplete `loader-awaiting-owner` marker.
The observer adopts that same marker only after it binds the actual loader and
owner identities. It does not create a second ordinary worker marker or omit the
thread. Without an owner, that participant stays unverified.

This support does not certify every `tsx` invocation or generic worker. A direct
require capture preload with `node --import tsx` can select synchronous hooks
and start an unreferenced ordinary esbuild worker. That worker still needs its
own completion evidence and the capture is refused when it does not cooperate.
The positive require-preload case explicitly registers the asynchronous
`tsx/esm` loader through public `module.register()` and uses its namespaced
typed import, while retaining the real `pnpm` and `node --import tsx` chain.

The owner requests the final loader flush only after its genuine exit listeners
finish. A manually emitted `exit` event must not start this exchange or stop
later application work. The guard checks the private `process._exiting === true`
state in pinned Node 24.20.0. Its basis is Node's
[`process.exit()` implementation](https://github.com/nodejs/node/blob/v24.20.0/lib/internal/process/per_thread.js)
and [native exit hook](https://github.com/nodejs/node/blob/v24.20.0/src/api/hooks.cc).
This is a version-specific implementation dependency, not a public Node API
promise. An absent or different guard value leaves the participant incomplete.

After the owner exit listeners finish, the loader calls `takeCoverage()` and
parks without calling `stopCoverage()`. Verification requires an intact
checkpoint, a distinct later V8 flush, matching handshake evidence, and normal
completion of the owner. The complete exchange, including the clock advance
needed to distinguish raw flush files, has a three-second deadline. Missing,
stale, duplicate, malformed, changed, or wrong-owner evidence fails closed.
Signal death cannot use loader completion, and a normal-owner claim cannot hide
raw-only or still-running thread identities. Active or earlier worker evidence
continues to prevent a pre-crash seal. A focused protocol test does not prove
that a complete repository capture succeeds.

The deterministic SHA-256 input identity covers the source tree, tests and
helpers, non-TypeScript fixtures, scripts, configuration, package manifests,
lockfiles, patches, migrations, Docker inputs, and files that tests read.
The selected roots are `src/`, `test/`, `script/`, `patches/`,
`migrations/`, `docker/`, `.github/`, and `.habit-hooks/`; root files except
`.md`, `.txt`, and `.log` files; and `docs/lightpanda-runtime.md`, which tests
read. Markdown outside `src/` and `test/` is excluded from the other
selected roots. Generated roots `dist/`, `ast-report/`,
and `coverage/`, plus
`src/user-portal/dist/` and `src/user-portal/.vite/`, are excluded. So are
`node_modules/`, `.git/`, and `.DS_Store` at any depth and unrelated prose.
Markdown fixtures under `test/` remain inputs. Paths use forward
slashes and lexical order. Length-prefixed path/content entries prevent
ambiguous concatenation. Symlinks contribute their link text and the content
of the target that is read; cycles and unsupported file kinds fail. Added,
deleted, and untracked inputs affect the hash. Executable modes are hashed
alongside content. Runtime, TypeScript compiler,
suite, and measurement version are included. This fingerprint is not a Git
tree ID. The input set is conservative: an included change can invalidate a
capture even when it does not affect executed code.

The collector checks inputs before and after build and suite execution and
checks emitted content through the capture. A mutation fails publication.
`--from DIR` runs no build or suite. It validates the original capture
manifest and raw content, checks the original input and build identities,
and preserves the capture commit. Raw V8 URLs are absolute, so import
requires the original checkout path. Offline rendering of a completed
report and snapshot has no such restriction. Arbitrary V8 files cannot
gain verified provenance through import. Missing or invalid provenance,
including mismatched script evidence, fails by default.
Explicit `--allow-unverified` permits inspection with status `unverified`,
a reason, original information when present, and `commit: null` when no
original commit is available. Such output enables no bands or historical
CRAP count. A successful raw archive remains available if report publication
fails; `--from` can recover it. Legacy version-1 reports remain readable,
but absent provenance is unverified.

A document-only commit can reuse an older verified report when source and
input fingerprints, runtime, compiler, and measurement version all
match the analyzed head snapshot. For explicit suites, readers verify each
original identity and the shared canonical comparison identity. The capture
commit label alone does not prove compatibility. Offline rendering checks the supplied head snapshot;
it does not consult the caller's checkout or need Git.

The architecture command reads the report to give each matched measured
function its CRAP and each community its band (see "Show the architecture
delta"). Zero-own functions remain unmatched and get no exact CRAP. Their
path count can still prove a violation at 30 or more. An unmeasured
entry also blocks a measured same-name entry from supplying a share; name
equality alone cannot distinguish them. After a change of `src/`, collect
coverage again if no current valid report is available and both complete
parts of the unit suite are within scope.

### The CRAP goal

The process includes this assessment. For a focused improvement pass, run:

```sh
pnpm exec node script/code-quality/ast-metrics-crap.ts [--base REF] [--coverage FILE] [--limit N] [--target N] [--allow-tool-version] [PATH...]
```

Defaults are `origin/main`, `ast-report/coverage.json`, strict limit 30,
inclusive target 15, and changed production TypeScript files under `src/`.
Thresholds accept finite positive decimals with at most six fractional
digits and a safe integer after removing the point; the target must be below
the limit. Explicit paths select inspection files; they do not make every
function new.
The command resolves an empty default selection first, prints
`No production files to assess.`, and exits 0 without reading coverage or
opening MCP. A required nonempty selection without sufficient data remains
unresolved. Missing, stale, or unverified coverage fails without a measured
table. Record a deferred assessment when collection is outside the selected
scope. This command runs no build or test suite and takes no full architecture
snapshot. It uses one bounded MCP session and source evidence against the
selected base.

For decision paths `p` and own-character covered share `c`, the score is
`p² × (1 − c)³ + p`. The original CRAP measure used basis-path coverage;
this repository's V8 character share is an approximation. See the original
[Savoia and Evans article](https://www.artima.com/weblogs/viewpost.jsp?thread=215899)
and the [GMetrics definition](https://dx42.github.io/gmetrics/metrics/CrapMetric.html).
Added or changed
functions must aim below 30. Added functions must also aim at 15 or less.
The owner approved these project goals on 2026-10-18; 15 is not a universal
CRAP standard. The architecture bands and risk counts keep their boundary
at CRAP ≥ 30. A new function between 15 and 30 can miss its required target
without adding a critical architecture band.

The separate pure `crapAbsoluteOf({ paths, share? })` in
`assessment/crap-absolute.ts` calculates both `atMost15` and `below30`, each with
`PASS`, `MISS` or `UNKNOWN` and a reason. Its observation is one of
`known-coverage { paths, share, displayValue }`, positive
`missing-coverage { paths, lower, upper }`, or `proven-zero { paths: 0, value: 0 }`.
Paths must be a nonnegative safe integer. A supplied share must be finite and in
`[0,1]`; null is invalid. Missing coverage gives exact safe-integer bounds
`[p,p²+p]`; reject a bound that is not a safe integer. Known coverage needs no unused
bound cap. Zero paths without coverage prove zero without an invented share.

`compareCrap` decides from the exact operands; `crapValueOf` supplies an
approximate display value only. For five paths and share `1e-320`, display can
be 30 while `below30` is `PASS`. This is arithmetic over supplied operands,
not accepted evidence. It does not select origin/applicability, apply exceptions,
track lineage/history or decline, decide routes/AUTO eligibility, or verify
scope/provenance. It adds no command or process integration and activates no
policy. MI85, CLI/report/process/history behavior and manual merging stay unchanged.

The separate pure `crapDeteriorationOf({ reference?, head? })` in
`assessment/crap-deterioration.ts` accepts optional `{ paths, share? }` sides.
It retains the `crapAbsoluteOf` observation shapes and reports `belowFive`
(`head − reference < 5`) and `noDeterioration` (`head − reference ≤ 0`), each
with `PASS`, `MISS` or `UNKNOWN` and a reason. Every supplied side is validated
even if the other is absent; undefined is absent and null is invalid.

Known endpoints use exact fractions. Missing share uses the existing safe bounds
`[paths,paths²+paths]`; zero proves zero without fabricated coverage. The possible
difference is `[head lower − reference upper, head upper − reference lower]`.
An upper bound must prove a pass; a lower bound must prove a miss. Equal input
bounds do not prove unchanged scores. The additive `compareCrapDifference` in
`architecture/crap-score.ts` compares exactly; existing functions and signatures
stay unchanged. Decisions use no display arithmetic and promise no numeric
difference.
This is arithmetic over supplied values, with no reference selection, identity,
history, exceptions, routes, process integration or policy adoption. Full
assessment remains pending; existing commands and manual merging stay unchanged.

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

A recommendation is the smallest whole percentage that satisfies the actual
inequality. For `0 < p < L`, equality is at
`c = 1 − ((L − p) / p²)^(1/3)`. A strict limit needs coverage above the
crossing; an inclusive target permits equality. At a positive crossing use
`floor(100c) + 1` for strict comparison, or `ceil(100c)` for inclusive
comparison, then check the candidate. Already-passing zero coverage and zero
paths need no division. At `p = L`, even full coverage cannot get below L;
at `p = T`, full coverage meets target T. Five paths at zero and 25 paths
at 80% equal 30 and fail the strict limit. Fifteen paths at full coverage
equal 15 and meet the target. `split` means no share can meet that goal.
Comparisons use unrounded values across CRAP output, bands, regressions, and
counts. The output keeps one decimal unless that hides a goal boundary;
it then shows more precision or an explicit inequality. Thus 29.96 stays
visibly below 30 and 15.04 stays visibly above 15.

The table has `File`, `Function`, `Change`, `Paths`, `Coverage`, `CRAP`, and
`To do`. It shows all functions of selected files. Source evidence classifies
new, changed, unchanged, or identity unknown, with the same conservative
matching limits as architecture. Anonymous functions, duplicate names,
copies, changed extractions, and unresolved moves cannot gain identity from
name equality. Compatible coverage joins by file and a unique supported V8
name. Missing matches and zero-own exclusions have no measured share.
Their CRAP is shown as `≥ <paths>`, with `no coverage data` or `split` when
the paths alone make the applicable goal impossible. Unknown identity states
which goal cannot be classified; neither unknown identity nor unknown coverage
passes a required goal.

The pinned tool omits `functions` for constant modules. CRAP accepts this as
an empty list only when source evidence finds no function declarations, the
answer names the selected file through an absolute path or a path relative to
the explicit repository root, complexity and risk are explicitly zero, and
the line counts are valid nonnegative integers. Missing or malformed function
data in other answers remains an operational error.

Rows sort by exact score or numeric lower bound, descending, then file,
function, and stable source identity. Bounds do not give an exact ranking of
unknown risks. The summary separates known limit violations, measured target
misses, unmeasured functions, and required functions with unknown assessment
or identity. Counts of lower bounds are not exact totals. Under the limit,
advice is `ok`, with target advice such as `for 15: cover ≥ 12%` or
`for 15: split` when needed. At or above the limit, advice gives strict-limit
coverage or a split. Exit 1 reports known limit violations in inspected files,
required new-target misses, or insufficient data for a required goal; exit 0
means the applicable assessments passed, including the empty default case.

Improve required misses with selected unit tests or fewer paths and remeasure
with compatible coverage and the same base for at most three cycles. Record
score or bound, paths, coverage, classification, and reason for every
unresolved required goal, including new functions above 15 but below 30 and
unknown data. An unchanged high function can retain `unchanged by this PR`.
Under approved D2, Ready may proceed with these documented exceptions; the
command still exits 1. Tool failures remain errors. Reselect tests from the
actual candidate after test changes; do not expand selection only to collect
coverage. Real-file checks reuse compatible coverage or collect only when
eligible. A missing report does not add a blanket live gate.

### Take a snapshot: `script/code-quality/ast-metrics-snapshot.ts`

```sh
pnpm exec node script/code-quality/ast-metrics-snapshot.ts [--base REF | --commit FULL_SHA] [--out FILE] [--timeout-ms MS] [--allow-tool-version]
```

With no revision option, the command writes the snapshot of the working tree to
`ast-report/snapshot.json`, or to `--out` (relative to the current folder).
It runs `ast-metrics analyze src` for the JSON report and one MCP session of
`ast-metrics mcp src` with `get_communities` and `get_file_metrics` for each
`src/` file (about one second on this repository). The file holds:

- `tool`: the actual checked ast-metrics version, including an explicitly
  permitted version. Legacy snapshots can omit it; their version is unknown.
- `commit` and `date`: HEAD and its committer date for working-tree capture,
  the merge base for `--base`, or the exact requested commit for `--commit`.
  Only working-tree capture can include changes that are not committed.
- `global`: modularity, cross share, and cycles from `get_communities`, the
  LOC-weighted maintainability, the decision paths, and the counts of files
  and functions. All of them describe `src/` alone.
- `communities`: each community of `src/`, sorted by label, with id, label,
  hub, member files, the numbers of its files, references, and edges to the
  other communities.
- `files`: each `src/` file, sorted by path, with its community (or `null`),
  rounded `maintainability`, optional `maintainabilityRaw`, decision paths,
  lines, risk, functions, and optional `classObservations`.
- `provenance`: source and expected coverage-input fingerprints, runtime,
  compiler, suite, and measurement version. These inputs are checked before
  and after analysis. The commit label alone does not identify uncommitted
  snapshot content.
- `dependencies`: version 1 source dependency evidence: normalized `pairs`
  with `from`, `to`, and `kinds`, plus `issues` for unresolved evidence.
  The pairs keep local static imports, type imports, re-exports, side-effect
  imports, and literal dynamic imports. They include imports within one
  component and deduplicate each source/target file pair.

Optional file `maintainabilityRaw` preserves the finite value from native
`concernedFiles[].maintainability.maintainabilityIndex`, including zero, without
rounding or an assumed upper clamp. Capture emits it by default when available.
The additive field keeps snapshot version 1
and leaves rounded `maintainability` unchanged. Missing/legacy raw values stay
unavailable; never reconstruct them from rounded values. Present malformed or
nonfinite native MI for a `src/` file rejects capture before publication;
out-of-scope entries remain ignored. The existing
architecture reader ignores this field, so its displays, trends and process
results still use rounded data. A future assessment must retain and validate raw
MI through a checked assessment boundary. The separate decoder below is
groundwork for that boundary. This field adds no raw function data.

Optional per-file `classObservations` keeps the native reported subset from
the already fetched `get_file_metrics` response's `classes` array. Each entry
has `name: string` and optional `maintainabilityRaw: number`. Native order,
duplicate names and empty string names stay as reported. A missing `classes`
key omits the field and stays unavailable; an explicit empty array stays empty
and means only that the native response was empty. Missing MI stays unavailable.
Finite MI keeps zero and native precision without rounding or a clamp.
A malformed present array, entry, name, maintainability object or index, or a
nonfinite index, rejects capture before publication. Snapshot version stays 1;
there is no new flag, native call or session. The current architecture reader
ignores these observations and continues to use rounded fields.

These observations are not a source class inventory. Native ast-metrics 0.43.1
can omit class expressions and anonymous default classes, omit MI for an empty
or nested declaration, and collapse same-named namespace classes into one entry.
Presence, length and names prove neither source identity nor completeness.
Class decision automation needs separate source correspondence and completeness
evidence. Persistent class identity and full assessment validation remain
future work; this field does not activate policy.

The separate synchronous offline decoder
`snapshotObservationsIn(text, expected: { commit, tool })` in
`script/code-quality/snapshot/observations.ts` returns only version 1, declared
commit/tool and file paths with optional raw file MI and passive class
observations. The commit must be a full lowercase 40-hex SHA, and the expected tool must be a
nonempty string. Both declared labels must exactly match the supplied
expectations; paths must be unique canonical `src/` paths. Present numbers must be finite and
present classes must have the declared shape. Missing raw data stays unknown;
rounded display MI never fills it. Zero, native order, duplicate and empty class
names, and explicit empty arrays stay intact.

This validates only the projection. It does not validate the full snapshot or
provenance, content cleanliness/authenticity, approved tool or measurement basis,
class/source completeness, coverage/exact measurement binding, comparison,
history or route eligibility. It is groundwork for future assessment validation.
Existing architecture and CRAP readers and behavior stay unchanged. It adds no
CLI, collection or write operation and activates no policy.

The separate synchronous calculation `fileMi85Of(text, expected: { commit,
tool }, selected: readonly string[])` in `assessment/file-mi85.ts` returns
readonly per-file `{ path, state, maintainabilityRaw?, reason }` results. It
first decodes the full raw-observation projection with exact declared commit/tool
binding, even for empty selection, and checks unique canonical selected `src/`
paths. Raw MI at least 85 is `MEETS` for this floor only; below 85 is `LOW`.
An absent file row or absent raw MI is `UNKNOWN`, with a different reason for
each. It uses no rounding or class aggregation and has no `NOT_APPLICABLE` state.

This calculates over declared inputs and caller selection. It does not verify
source authenticity, full scope, provenance or trust, infer scope, or decide
routes/AUTO eligibility. It adds no IO, CLI, report or history behavior and
activates no policy. Full assessment remains pending; existing commands and
manual merging stay unchanged. The process does not call it yet. `LOW` or
`UNKNOWN` alone is not an architect trigger; broader checks remain pending.

The separate pure `miDeclineOf({ reference?, head? })` in
`assessment/mi-decline.ts` retains supplied operands in `observation` (missing
properties omitted) and returns `belowFive`
(`reference − head < 5`) and `noDeterioration` (`reference − head ≤ 0`), each
with `PASS`, `MISS` or `UNKNOWN` and a reason. Missing operands stay unknown.
Every supplied operand must be finite; null and nonfinite values are invalid
even when the other operand is absent. Comparisons use exact decimal arithmetic
over the supplied number representations, with no rounding or tolerance. The
result makes no exact numeric difference claim and does not apply the MI85 floor.

The caller supplies a validated B or A reference. This arithmetic proves no
comparability, lineage, origin, best accepted score/history or scope. It does
not apply exceptions, choose routes or change commands. It activates no policy.
Full assessment
remains pending; merging stays manual.

The raw 0.43.1 JSON gives file coupling counts and namespace relations, but
does not give complete file import pairs. The snapshot therefore uses the
TypeScript parser supplied by `ts-morph`. It ignores package imports and
reports local resolution failures, unsupported aliases, non-literal dynamic
imports, parse errors, and targets outside `src/`. Unknown evidence is not
an empty dependency set. See the [dependency format](ast-metrics-change-request.md#a2-snapshot)
for the resolution rules and issue reasons.

Each file can also hold `sourceEvidence` with normalization version
`typescript-tokens-v1`, coordinates `utf16`, and a `complete` flag. Each
supported function can hold `identity`: declaration kind, lexical owner,
name, source `start` and `end`, and SHA-256 `body` and `signature` hashes.
Offsets start at zero and exclude the end character. TypeScript syntax and
token text supply these hashes; whitespace and comments do not affect them,
but literal spelling and executable syntax do. The signature omits the
binding name; recursive uses in the body remain. Source parse errors withhold identity and set `complete: false`.
Anonymous functions, duplicate names, and unsupported owners have no stable
identity. `complete` is true only when every executable function is supported
and every metric has one source declaration. This `complete` flag describes
functions only; it says nothing about class observations. See the [snapshot format](ast-metrics-change-request.md#a2-snapshot).

Snapshots contain no coverage or CRAP. The architecture command joins a
separate coverage report when it makes its output. Snapshot capture starts no
build, test or coverage run.

A label uses the largest source namespace by member count. A tie uses the
lexically first namespace. Remove the `src/` prefix; without a source
namespace, use `src`. The shared community ID gives `shared kernel`. When
labels repeat, each gets the basename of its first hub in parentheses, or
the community ID if it has no hub. The hub is a duplicate suffix, not the
primary label rule. The maintainability of a community or of `src/` is the sum of index × lines over the sum of lines of
the files with an index. Rounded scores keep one decimal and a share two; file
`maintainabilityRaw` keeps native precision. A value
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

With `--commit SHA`, the command captures that exact committed tree, independently
of HEAD or its merge base. Give a full lowercase 40-hex commit SHA. The command
rejects `--commit` with `--base` before starting tools. It reuses the existing
exact-commit owner and temporary-worktree analysis/cleanup; it does not install
dependencies and uses the same version-1 format described above. The default file is
`ast-report/snapshot-commit.json` at the repository root. Explicit `--out` remains
relative to the current folder. The working-tree default and `--base` merge-base
meaning stay unchanged.

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
With `--commit`, invalid or missing commit identity and worktree failures also
exit 1; SIGINT/SIGTERM use the same cleanup and exit 130/143.

### Show the architecture delta: `script/code-quality/ast-metrics-architecture.ts`

```sh
pnpm exec node script/code-quality/ast-metrics-architecture.ts [--base REF] [--head FILE --base-snapshot FILE] [--changes FILE] [--touched FILES] [--coverage FILE | --no-coverage] [--record] [--trend-store DIR] [--timeout-ms MS] [--out FILE] [--allow-tool-version]
```

The command prints the architecture delta of `src/`, the complexity table of
the changed files, and the trend of `src/` on `main` as Markdown, and also
writes it to `--out` (relative to the current folder). Step 6 of the process puts this output in the pull
request description. By default it takes the snapshot of the merge base of
`--base` (default `origin/main`) in a temporary worktree, as `--base` of the
snapshot command does, and the snapshot of the working tree; this takes about
two seconds. The changed files retain addition, modification, deletion, and
rename status.
A rename compares the old base path with the new head path and has one row
labeled `newpath (renamed from oldpath)`. A deletion has a row at its old
path and touches its base community. Delta omits deleted files; architecture keeps them.
With `--head` and `--base-snapshot`, the command reads two snapshot files and
runs no tool. `--changes FILE` supplies validated status and rename evidence
for those snapshots. `--touched` supplies root-relative paths separated by
commas, with no rename proof. With both options, `--touched` selects the
rows while `--changes` supplies independent correspondence evidence. Without
either option, there are no changed-file rows. See the [offline change format](ast-metrics-change-request.md#a4-offline-change-metadata).

Different or missing snapshot versions produce `Tool versions: base
ast-metrics <version or unknown>; head ast-metrics <version or unknown>.`
Equal known versions need no notice.
Offline rendering uses the stored values and checks no installed tool.

The coverage comes from `--coverage` (a report of the coverage command,
relative to the current folder), else from `ast-report/coverage.json` in the
repository root when that file exists. With `--head` and `--base-snapshot`,
only `--coverage` gives it. `--no-coverage` ignores any default report and
is mutually exclusive with `--coverage`. An invalid report envelope still
fails with exit status 1. Missing, legacy, unverified, incompatible, or
explicitly skipped coverage does not fail structural rendering. It gives a
specific reason after the Markdown summary, with no bands,
CRAP column, or assessed-function list. Report and explicit-skip notices
also go to stderr; missing coverage is quiet on stderr.

A mismatched verified report gives:

```text
The coverage report is of another tree (<commit8>): the bands are withheld. Run the coverage command again when the test selection permits it.
```

The other notices distinguish missing data, no verified coverage provenance,
a head snapshot without provenance, and an explicit skip. Compatible output
adds `Coverage: unit suite at <commit8>.` after the complexity section,
including when no production file changed. The commit names the original
capture. Explicit suite reports name their ordered suites, for example
`Coverage: unit + acceptance suites at <commit8>.`. For a test-only candidate,
including changed helpers, fixtures, and untracked `test/` paths of any
extension, the report prints
`Test changes are not judged: the base uses the coverage of the head.`
when compatible coverage is available. Without an assessment it prints
`Test changes are not judged: no coverage comparison was made.`
Any changed path under `src/`, of any extension, suppresses this
particular notice. Offline inputs require equal known source fingerprints and
explicit test paths, with no source path, before they can establish test-only
changes. They do not infer this from commit dates or empty metadata.
These notices do not measure base coverage or judge changed tests. D4 defers
the measured base-coverage store. Legacy snapshots can still show
structure; they cannot establish coverage compatibility.

These notices do not change the selected test scope. Use verified compatible
coverage if available. Otherwise use `--no-coverage` when collection is
outside the permitted scope, keeping the graph and legend. No file needs to
be moved or deleted.

The output is the header `## Architecture of src/: base <8 characters of the
base commit> → head`, one summary line (modularity and cross share with two
decimals, cycles, communities with the shared kernel, base → head, with
` (n new, m gone)` when there are such, and with coverage
` · functions ≥ 30: <base> → <head>`, the count of the functions at CRAP 30
or more in all of `src/`), then the community Mermaid graph with its legend
and import evidence, then `## Components of src/` with its graph and legend,
then the complexity section, and last the trend section (see "The trend"). Each graph
always appears. When the community map did not change, `The map did not change.`
appears above it. With complete dependency evidence, an unchanged component
map says `The component map did not change.` Equal snapshots with no touched files keep every node and
dependency without change arrows or touched borders; compatible coverage
still supplies the bands.
Without valid coverage, keep the graph and the specific withholding notice,
without bands. Invalid report envelopes still stop the command. With valid
coverage, individual unknowns can still make an assessment incomplete; the
band rules below explain that separate case.

Paste both fenced `mermaid` blocks, their legends, and import evidence
unchanged into every pull request body, including a pull request that changes only documents or has
no current valid coverage. Prose does not replace the graph. This requirement
does not expand the selected test scope or permit coverage collection outside it.

Matching: a head community matches the base community with the largest
Jaccard overlap of their files, at 0.5 or more; the largest overlaps match
first, a tie goes to the first label, and each base community matches once.
An unmatched community is new or gone, so a split or a merge shows as gone
and new. The map changed when a community is new, gone, or touched, when a
dependency or a cycle appeared or disappeared, or when the band of a kept
community is not the band of its base (see "The bands"); numbers, reference
counts, and labels alone do not change it.

The encoding: nodes sorted by label, ids `c_<label>` (a later node with the
same id gets a number); a node text with the label, ` · new` or ` · gone`,
the files, the LOC-weighted maintainability, and the decision paths, each
with `↑n` or `↓n` for a change; a thick border for a touched community; a
grey dashed node for a gone community with its base numbers; edges sorted by
labels with the references and their change, `<n> · cycle` red dashed for a
cycle, `<n> · new` thick for a new dependency (`· new · cycle` red dashed when
both), `gone` grey dashed for a gone dependency; one legend paragraph. A
label text has no double quote and no backtick. With coverage, the node text
has a third line with the band, its symbol, and the count of the functions
at CRAP 30 or more, with its change against the base as ` (+k)` or ` (−k)`:
`● good: 0 fn ≥ 30`, `▲ warning: 2 fn ≥ 30`, or `■ critical: 6 fn ≥ 30 (+2)`.
The border has the color of the band: the classes `good` (`#0ca30c`),
`warning` (`#fab219`), and `critical` (`#d03b3b`) come after `touched` and
`gone`, only those that the graph uses, and a touched node is in its
`touched` line and in its band line. A band class sets the color only, so
that the thick border still shows a touched community: a width of its own
would replace that border, because the class that the block defines later
wins. The legend then names the bands before the numbers.

CRAP: each function of a `src/` file of the head gets
`CRAP = paths² × (1 − share)³ + paths`, where paths are its decision paths
in the snapshot and share is its covered share in the coverage report.
Comparisons use the unrounded value; a value at 30 or more is over the
strict limit. Display uses one decimal unless it hides the boundary, then
more precision or an explicit inequality. The function
of the report has the same name in the entry of the same path, with the name
that V8 gives: ast-metrics names a method `module\Class.method`, V8 names it
`method`, and V8 names a constructor `Class`. A function gets no exact CRAP and
counts as unmatched when it is anonymous (also a method without a name, such
as `module\Class.`), when the file of the snapshot or of the report has its
name twice, or when the report has the file but not the name, including a zero-own
function recorded as unmeasured. A file that
the report does not have currently counts as uncovered: each named function
has the share 0 and the CRAP `paths² + paths`. In the historical study at
`76b514ac` on 2026-10-18, 721 of the 1022 functions of `src/` matched a
function of the report, 68 were in files that the report does not have, and 233 stayed unmatched, 227 of them anonymous;
with the names of ast-metrics as they are, only 402 matched. 22 functions
had CRAP 30 or more, 15 of them in files absent from the report. These are
dated observations, not assertions about the current tree.

The base tree gets no coverage run, so its CRAP is a head-derived estimate.
A proven base/head function pair uses the base decision paths with the head
covered share. A base function without a proven head partner has no exact estimated
CRAP. Removed functions and files remain unknown; they do not get zero share.
Its path count can still prove a lower-bound violation at 30 or more.
The report counts unknown base estimates separately, including those of
removed functions. Equal supported trees give equal counts.

Function correspondence uses source evidence, separately from the coverage
join above. Within the same file, or a proven file rename, a unique
kind/owner/name declaration pair establishes continuity. Equal body and
signature hashes mean unchanged; an edit to either means changed. Without
that continuity, only one unique unchanged body/signature pair can prove a
move or rename, including a move to an untracked file. Same-name declarations
in unrelated files do not establish continuity. Copies, duplicate bodies,
changed extractions, and recursive renames can remain ambiguous. A function
is new only when its head file and all base files have complete evidence,
all base declarations have proven partners, and no matching base body or
unresolved move candidate remains. Legacy snapshots and missing source
evidence limit classification to identity unknown. Offline readers never
read the caller's checkout to fill the gap. Unknown identity is not called
new or worse.

Without a covered share, CRAP is at least the decision paths. An unmatched
function with 30 or more paths is therefore a known violation. It counts
in risk totals and displays `≥ <paths>` rather than an exact value. A
function below 30 paths with unknown coverage has unknown assessment; the
lower bound does not establish that it passes. Zero-own-character functions
follow these same rules.

The bands: a community is good only when every function is assessed and
none reaches CRAP 30. It is warning when some are known violations and
none is proven added or worse, and critical when one is proven added or
worse. A proven pair is worse when its exact head CRAP is at least 30 and
either crosses 30 or exceeds its exact base value. A lower bound alone
does not prove worsening against an unknown base value. A proven new
function at 30 or more, including a lower bound, is added. Unknown
correspondence gives neither claim. A gone community uses its known base
estimates; base unknowns remain visible. These rules also apply to
changed-file rows and the list
below the table. `Unknown function identity: N (no proven declaration or
unique unchanged body/signature correspondence).` appears when identity
unknowns exist, even without coverage. Compatible coverage always adds
`Base functions without an estimated covered share: N.` after complexity.
The incomplete count includes all functions without a share, including
known lower-bound violations and zero-own exclusions.
A community with unknown assessment cannot establish an unqualified good
band. Known violations can still justify warning or critical, followed by
`; assessment incomplete: N unknown` in the node text. Without a justified
band, the node says `assessment incomplete: N unknown; 0 known fn ≥ 30`
and has no band color. Missing function metrics count separately as
`1 unmeasured file`, without an invented function count. Both cases can
appear together as `assessment incomplete: 2 unknown; 1 unmeasured file`.
These rules add no fourth band.

The complexity section has the heading `## Complexity of the changed files`
and a table with the columns `File`, `Maintainability`, `Decision paths`, and
`Risk rank`: one row for each changed file under `src/`, sorted by path.
Each cell gives the value of the base and of the head, such as
`72.0 → 60.0 ↓12.0` or `12 → 15 ↑3`: the maintainability with one decimal,
the decision paths as an integer, and the change with the arrows of the map,
left out when it is zero. A file that the base does not have shows
`new → 70.2`, and a file that the head does not have shows `55.0 → gone`. A
file without a maintainability index in the head is `not measured` in both
columns: ast-metrics gives an index only to a file with code, and the
snapshot gives such a file 0 decision paths only because ast-metrics leaves
out each value of zero. The same word shows a value that a snapshot file
leaves out, such as the decision paths. The risk rank is the position of the
file among the ten files of the head with the highest risk score, from 1 (on
a tie, the first path ranks first); it is empty for each other file and for a
file without a risk score. When no changed file is under `src/`, the section
has the line `No production file changed.` in place of the table, as for a
pull request that changes only documents.

With coverage, the column `CRAP ≥ 30` comes after `Decision paths`: the
count of the functions at CRAP 30 or more of the file in the base and in the
head, such as `1 → 2 ↑1`, `new → 2`, or `3 → gone`, and `not measured` for a
side without an assessed function or a known lower-bound violation, such
as a file of types or a file with only unmatched functions below 30 paths.
After the table come the heading
`### Functions at CRAP 30 or more, added or worse` and one line for each
such function of the changed files, sorted by path and name, such as
``- `src/x.ts` `name`: paths 12, covered 0.25, CRAP 72.8 (base 41.0)``, with
`(base new)` for an added function, or the line `None.`. A method shows as
`Class.method`, without the module, which the path names. The last line is
`Unmatched functions: <n> (anonymous, duplicate, or not in the coverage).`,
the count of the functions of the changed files that have no exact CRAP,
including known lower-bound violations. Directly below that summary, the
report lists unmeasured functions in changed files with at least five paths,
sorted by path and name, for example
``- `src/x.ts` `(anonymous)`: paths 5, covered unknown, CRAP ≥ 5``. Anonymous
functions are displayed without a name match. T6 of the
[archived evolution plan](../archive/architecture-evolution-plan.md#t6-crap-bands-and-colors)
records the original band design. The rules above are the current contract.

#### Components and import evidence

The component view follows the designed source folders. A node is a
top-level folder under `src/`; root files belong to `src`. Every populated
component appears, including a component with no cross-component imports.
Names stay stable when the dependency tool regroups its communities.
Each node gives its file count, LOC-weighted maintainability, and decision
paths. Eligible CRAP counts and bands use the same assessment and change
rules as the community view.

A component edge counts each importing file once for each target component.
Several target files in that component still contribute one. Imports inside
one component remain in snapshot evidence but give no component self-edge
or self-cycle. Cross-component cycles and new, gone, and touched states use
the existing map encoding. The component graph always appears, including
on an unchanged candidate and without coverage.

Below the community graph, new and gone community edges show at most ten
file → file pairs each, followed by the omitted count when needed. The
evidence separates changed imports from unchanged imports that community
regrouping moved to another edge. Files with a changed matched community
show `path: old → new`. Proven file renames use the same CR-05 evidence as
the complexity table; a shared basename does not prove a move. Tool edge
reference counts and deduplicated file pairs have different units.
Base pairs translate both endpoints through proven renames before the
comparison. A kind change on the same pair does not add or remove an import.
An added import requires complete base evidence; a removed import requires
complete head evidence. Otherwise the change is unknown. Missing dependency
metadata withholds import explanations. Known issues stay visible even
when the other snapshot has no metadata. Unmatched community identities
are reported separately from matched-community regrouping.

Legacy snapshots without dependencies still show their community map and
component nodes from file metrics. The report states that component edges
and import explanations are unavailable. When both snapshots have dependency
metadata but either has issues, the component graph keeps known head edges
and cycles proven in that known subgraph. Edge lines show known counts with
no new/gone labels or count deltas; gone base edges are omitted. The report
does not claim that cycles changed or that the component map stayed the same.
Its incomplete-evidence notice states that more dependencies and cycles may
exist. Diagnostics remain visible. For example, the stylesheet import
`./style.css` in `src/user-portal/main.ts` is `unresolved-local`, because CSS
is outside the analyzed TypeScript file set.
Missing metrics remain unavailable. Offline mode
uses only the supplied snapshots and change evidence; it never reads the
caller's source files to fill these gaps.

#### The trend

The trend section has the heading `## Trend of src/ on main` and a table with
the columns `Commit`, `PR`, `Date`, `Modularity`, `Cross share`, `Cycles`,
`Maintainability`, and `Functions ≥ 30`: one row for each of the last ten
records of the trend store by the time of their dates, oldest first (two
records of the same time in the order of their file names), and the head as
the last row, `this pull request`, without a date. A row gives the first eight
characters of the commit, the day of its committer date, the modularity and
the cross share with two decimals, the count of the cycles, the LOC-weighted
maintainability of `src/` with one decimal, and the count of the functions at
CRAP 30 or more in all of `src/`, as the summary line counts it. A value that a
record does not have, such as the count of a run without coverage, is `–`.

New repository snapshots hold optional `title`, the first line of the commit
message. New records retain that title. A terminal `(#<n>)` supplies `#<n>`
in the global table's `PR` column. A missing title or a title without that
terminal suffix gives `–`. Legacy records are not changed. Offline rendering
uses only the supplied title; it makes no Git or GitHub call to fill it.

Separate maintainability and `Functions ≥ 30` chart sections use the same
last ten records and head as the numeric table. A missing value ends a run;
the next known value starts a new run. Risk runs also end when their basis
changes between `measured`, `head-derived estimate`, and `legacy unknown`,
or when the normalized selected suite set changes. Captions name that basis
and any explicit non-unit suite set. No line crosses an unknown value or
joins different coverage bases. A run of at least two values gets a fenced `mermaid` `xychart-beta`
line chart. A one-value run gets its commit and value in a caption. A section
without values says that its measure is unavailable. A constant run gets a
nonzero y-axis range, including when every value is zero. Chart labels use
eight hexadecimal commit characters or `this pull request`; an invalid
commit prefix becomes the literal `unknown`. Chart values and axis bounds
use exact decimal text without exponent notation. Numeric tables retain
every value and gap. Mermaid frontmatter rotates commit labels 45 degrees
so the full eleven-point window remains readable.

This uses separate charts for contiguous runs because the documented
[Mermaid XY chart syntax](https://mermaid.js.org/syntax/xyChart.html) takes
numeric line values and defines no missing-value token. This can produce
several small charts instead of one continuous chart. A two-point
`xychart-beta` probe rendered in a real GitHub pull request comment on
2026-10-19 during CR-14 implementation. The disposable comment was removed
after its body and rendered image were saved. A later GitHub pull request
preview also verified separated, rotated labels over the full eleven-point
window. These checks cover the syntax used here; GitHub's renderer version
was not identified. Separately,
the actual Mermaid 12.2.0 parser accepted the generated chart blocks from a
temporary installation, with no repository dependency added. Parser acceptance
does not establish support for newer features on GitHub. See
[GitHub's diagram guide](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams)
for fenced diagrams and the renderer-version check.

`### Trend by component` is a matrix over the same chronological window.
Rows use stable component names, sorted by name across the displayed records
and head. Columns use the record commit prefixes, then `this pull request`.
Each cell labels `MI` and `functions ≥ 30` separately; the latter retains
its D3 basis. Missing component data, a missing component, or a missing
metric gives `–` for that measure. A missing legacy field never implies
zero or that a component did not exist. If no displayed record or head has
components, the section says `No component history in these records.`
Community labels are not joined across history. The complete report in the pull request description includes
these chart blocks, captions, and the component matrix with the numeric table.

The trend store of a repository is `docs/metrics/` of its root, and the pull
requests commit its files (step 7 of the process). It holds one JSON file for
each recorded commit of `main`, from a verified pull request base or manual
backfill, named
`<date>-<commit8>.json`: the day of the committer date of the commit in the
time zone of the commit, and the first eight characters of the commit. A file
holds `version` 1, the actual snapshot `tool` version when known, the
`commit`, its `date`, optional commit `title`, the global numbers of the
snapshot of the merge base (`modularity`, `crossShare`, `cycles` as a count,
`maintainability`, `paths`, `files`, `functions`, and with coverage
`functionsOver30`), and each community, sorted by label, with its `label`,
`files`, `loc`, `maintainability`, `paths`, and with coverage
`functionsOver30`. New records also hold `components`, sorted by stable
`name`, with `files`, `loc`, optional `maintainability`, `paths`, and eligible
`functionsOver30` and `crap` provenance. Each component keeps its own
unknown-function count. Counts and provenance are absent unless verified
coverage and complete member assessments support them. If any component
lacks per-file LOC or paths, the whole record `components` field is omitted.
Legacy records can omit components; that absence means unknown.
It holds nothing for each file. The JSON has two spaces and
a newline at the end, so that two files diff well.

Architecture runs are read-only unless `--record` is present. The complete
candidate review uses that flag to record a missing base. Before any write,
the command validates the store, resolves the full base commit, and verifies
that it is an ancestor of `origin/main`. The snapshot date must equal the
commit's committer date, and its source fingerprint must match the immutable
commit content in a temporary worktree. A custom `--base` is allowed when
its resolved merge base passes the same check. A verified non-ancestor gives
`No record: <base8> is not on origin/main.`, shows existing history, and
writes nothing. Missing refs or unverifiable commit identity fail.

Offline rendering with two snapshot files needs neither Git nor ast-metrics.
Offline `--record` also needs a repository that can verify the snapshot's
full base commit and content. It refuses an unverifiable write. Offline mode
uses only an explicit `--trend-store DIR`; without one the trend section says
`No trend store.` A configured empty store without `--record` says
`No snapshot of main in the trend store yet.`

Record identity uses the full SHA. A short filename prefix collision, a
malformed store, or conflicting records fail before publication. Every
record-shaped path must be a regular file; its filename date and prefix
must agree with its content. Required global and community fields, optional
component fields, and
optional provenance are validated before a write. A new
record is published atomically without overwrite, including concurrent
writers. A store lock bounds contention to five seconds. If a failed run
leaves `.record-lock`, confirm that no writer is active before removing
that directory and retrying. An existing record stays byte-for-byte unchanged, also when its
count is missing or a later run would give another count. Keep the file from
`main` and drop the candidate's conflicting file during a merge conflict.

Approved D3 retains counts from compatible head coverage as
`head-derived-estimate`, with the original coverage commit, source and input
fingerprints, build fingerprint, measurement version, and unknown-function
count. New records also retain full `crap.captureProvenance`, including
explicit suite captures and their comparison identity. The base count uses
the base's decision paths with the head's shares; it is not a measurement of base coverage. The table
labels historical estimates as `17 (estimate)`, the current head as
`17 (measured)`, absent counts as `–`, and old unattributed counts as
`22 (legacy unknown)`. A later pull request can
produce another estimate for one base, but the stored value belongs to the
first recording pull request. Missing, stale, or unverified coverage gives
absent count fields, never zero. Existing legacy counts stay immutable and
are labeled legacy unknown.

When the displayed records and head contain different tool versions, the
trend appends `Trend tool versions: <commit8>: ast-metrics X; this pull request: ast-metrics Y.`
The notice associates every displayed record with its commit prefix and the
head with `this pull request`, in table order. Absent legacy versions are
`unknown`.

Nobody runs anything at merge time. Ordinary base recording can lag behind
`main` and omit commits. Manual backfill can fill missing structural records.
Repository reports check gaps strictly between the oldest and newest displayed
records on first-parent `origin/main`. All stored full identities count, also
when their rows are outside the display selection. Each contiguous missing
interval gets one line: `k commits of main between <a8> and <b8> have no record.`
The endpoints are recorded commits and are excluded from `k`. Commits outside
those endpoints are not checked. Missing or shallow Git history gives an
explicit reason. Offline reports with a store print
`Gap check unavailable: offline snapshot dates cannot prove omitted commits.`;
no-store output stays
`No trend store.` In a repository, `--trend-store` replaces `docs/metrics/`, as
the live test does with a temporary folder. D3 authorizes no base-coverage
store or merge workflow; the owner deferred both under D4 and D5.

Exit status 0 when the Markdown is printed (a report, not a gate); 1 with one
diagnostic line for a failure, also for a store that the command cannot read or
write; 130 or 143 when a signal stops the base snapshot.

### Backfill structural history: `script/code-quality/ast-metrics-backfill.ts`

```sh
pnpm exec node script/code-quality/ast-metrics-backfill.ts [--count N] [--allow-tool-version]
```

The default count is 10; `N` must be a positive safe integer. Help and argument
checks run before Git or tool access. The command requires complete
first-parent `origin/main` history and selects its latest `N` commits, or all
available commits when fewer exist. It analyzes missing selected commits
oldest first in exact detached temporary worktrees. It does not use a merge
base. Full identity, date, ancestry, and immutable source content are verified
before the no-overwrite store publishes a record under `docs/metrics/`.

Existing records remain unchanged, including records without CRAP counts.
Backfill collects structural data only. It runs no build, suite, coverage
collector, or package install. Each tool session is bounded, and worktrees are
removed on success, analysis failure, SIGINT, and SIGTERM. A cleanup failure
prevents that record's publication. Earlier completed records survive a later
failure. Exit 0 means the selected records exist; failures exit 1 and signals
exit 130 or 143. D5 defers a merge-time workflow; manual backfill remains
the supported way to fill missing structural records.

## The configuration

Use `.ast-metrics.yaml` at the repository root for the wrappers, which run
ast-metrics from that root. A controlled two-file exclusion check with 0.43.1
on 2026-10-18 showed that a config in the initial working folder and an
explicit `--config` are both honored. A config in the analyzed folder can
replace either: with `analyze src`, `src/.ast-metrics.yaml` won over the root
and explicit configs; with `analyze .`, the root config won over the explicit
config. With no analyzed-folder config, the explicit config won over the root
config for `analyze src`. These checks establish exclusion lookup behavior,
not precedence for every setting. Keep the root config authoritative by
adding no config under `src/`. The root file:

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
  most 10, at most 150 lines and 40 decision paths for a file, at most 30
  lines and 20 logical lines for a function. The rule `no_community_cycles`
  is not used: it judges how ast-metrics groups the files of the whole
  repository, not an import cycle, and its baseline entry drifted with every
  change of `script/`; the architecture delta shows the cycles of `src/` instead.

The owner approved D6 and D7 on 2026-10-19: cleaner → MCP and
website-fetcher → auth path restrictions enforced by the review wrapper,
a file cap of 40 paths with LOC 150 unchanged, and a new-function warning
strictly above 10 paths. PR #188 implemented these rules. Selected tests,
typechecking, and all 13 affected live cases pass. Retained
review findings still need individual reasons. A controlled 0.43.1 capability
check found that `coupling.forbidden`
matches imported symbol names, not resolved source paths, and emits low
review findings. It cannot provide the proposed high-severity path gate.
The approved review-wrapper rules address that native limit. The native
new-function warning starts at 10 decision paths; the wrapper applies the
approved strict boundary above 10. Configuration now uses file cap 40 and
LOC 150. Focused policy and pinned-tool boundary tests pass.

The rule refresh changed 209 intermediate entries to 169 after the approved
D6/D7 changes; the base before PR #188 had 175 entries.
Final verification stayed at 169 entries and left the baseline byte-identical.
The rule change of PR #188 permitted that refresh.
PR #188's final review reports 10 high maintainability findings, two medium findings,
no low findings, and six improvements. Each retained high finding still needs
its own reason in the pull request description. This refresh adds no baseline exception.

The baseline lists rule violations that existed when the rules were set or
refreshed. Review and `ast-metrics lint` omit listed rule violations. The
refresh does not silence high file-maintainability regressions; those still
need individual reasons in the pull request description. A baseline entry
carries the measured value in its message, so a file whose value moved can
appear again. AGENTS.md permits a refresh for one reason only: the pull
request changes the rules in `.ast-metrics.yaml` (step 4). Refresh and commit
the baseline in that same pull request. A retained high finding is not a
reason: the baseline cannot list a score drop, a new function at 25 or more
paths, or a forbidden import, and a refresh would only hide the new lint-rule
violations of the candidate from its own review. A violation already on
`main` is not a reason either; historical refreshes do not grant permission.
Use `pnpm exec node script/code-quality/ast-metrics-baseline.ts` for the
refresh.

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
- The study on 2026-10-18 observed a reported seven-point score drop and
  an unreported 1.3-point drop. These examples do not establish an exact
  general threshold.
- `compare.html` lists only the files whose metrics moved enough. The delta
  command lists every delta file.
- ast-metrics analyzes TypeScript only. The commands under `script/` are
  TypeScript and appear in the delta without a goal, including
  `script/fetch-url/fetch-url.ts`. JavaScript files stay outside the measurements.
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
structures they reach, and the tests that touch too much). `review.md` and
`review.json` hold the last review. `process.md` holds the four report sections for the complete
review process. The folder is not committed; a reviewer runs the delta
command on the branch to get it.
