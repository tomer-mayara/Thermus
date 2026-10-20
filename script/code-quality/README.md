# Measure and review a pull request with ast-metrics

These commands implement the process in [AGENTS.md](../../AGENTS.md). Update
from `origin/main`, select tests from the complete candidate, then run the
[complete process](#run-the-complete-review-process). Use the individual
commands to inspect a result or repeat an improvement pass with the same base.
The [review guide](../../docs/implementation/ast-metrics-review.md) gives the
measurement rules, formats, configuration, and limits. The
[script index](../README.md) links this command reference.

Run commands from the repository root. Static analysis needs no build.
Coverage collection builds compiled Node tests before it runs the selected
package suites. The default runs both complete unit parts. Only a change under
`src/` selects the full ordinary suite
(`npm test`) and the remaining checks in the
[test gate policy](../../docs/implementation/test-gate-policy.md). Other
changes select affected groups and existing focused tests. Do not add
`npm run check`, which repeats unit and portal tests. A command or live test
must not start a broader suite through a nested coverage call.

Tool operations need `ast-metrics` on PATH (`brew install
ast-metrics/tap/ast-metrics` on macOS). The wrappers pin 0.43.1 and check CLI
results with `ast-metrics version`, and MCP results with initialization.
`--allow-tool-version` permits another actual version for that run and its
child operations; a mismatch otherwise fails before results are consumed.
Help, offline architecture rendering, and coverage collection need no
installed ast-metrics. Delta and CRAP also need no tool for an empty default
selection. A pin change needs the applicable live contracts and fixture review.
MCP operations start and stop their server within a deadline, also after a
failure. Do not start or register a persistent server.

## Source layout

The ten command entry points stay in this folder, in process order:

| Entry point | Purpose |
| --- | --- |
| `ast-metrics-delta.ts` | Measure changed TypeScript files. |
| `ast-metrics-mcp.ts` | Inspect one result through MCP. |
| `ast-metrics-review.ts` | Report changes in code quality. |
| `ast-metrics-coverage.ts` | Collect selected-suite coverage per function. |
| `ast-metrics-crap.ts` | Assess function goals and give coverage or split advice. |
| `ast-metrics-architecture.ts` | Compare architecture snapshots and show history. |
| `ast-metrics-snapshot.ts` | Capture one source tree. |
| `ast-metrics-process.ts` | Run the complete review and save its four sections. |
| `ast-metrics-baseline.ts` | Refresh an allowed baseline and report ignored counts. |
| `ast-metrics-backfill.ts` | Record missing exact commits from first-parent main history. |

The matching helper folders (`delta/`, `mcp/`, `review/`, `coverage/`,
`crap/`, `architecture/`, `snapshot/`, `process/`, `baseline/`, and `backfill/`)
own each command's work. `identity/` owns source evidence and function identity;
`provenance/` owns input identity and checked readers; `dependencies/` owns
parsed imports, resolution, and checked snapshot dependency evidence.
`review/layer-tree.ts` assembles Git/source evidence and move correspondence;
`review/layers.ts` applies the approved path policy. Capture lifecycle propagation
and parent signal observations live in `coverage/propagation.ts` and
`coverage/signal-observations.ts`; `test/support/processes/crash-child.ts` owns
the cooperating intentional-crash fixture protocol. `coverage/suite-capture.ts`
owns one suite's capture and archive lifecycle; `coverage/manifest-format.ts`
checks manifest schema, version, comparison identity, and completion protocol.
`coverage/loader-contract.ts` defines the loader handshake, `loader-runtime.ts`
coordinates its owner, and `loader-observer.ts` runs in the actual loader thread.
`loader-validation.ts` checks participant and owner evidence;
`loader-checkpoint.ts` checks canonical raw identities, hashes, and the final flush.
`shared/` owns common argument checks, limits, JSON readers, ordering,
number calculations, and repository commands. JSON readers retain file-kind
diagnostics; consumers check their schemas. Text ordering compares UTF-16
code units and preserves ties. Locale-sensitive names keep their comparator.

Tests put CLI or MCP doubles from `test/support/doubles/ast-metrics/` first
on PATH. The CLI fake writes configured analysis, review, and baseline
results and logs arguments and working directories. It delegates `mcp` to
the MCP fake, which speaks line-based JSON-RPC, supplies configured metrics,
and can simulate a timeout or an early exit. Its busy timeout mode sends no
answer, but handles SIGTERM by releasing its timers and input so it exits
normally. This preserves the timeout test and permits complete capture evidence.
Their path helpers and the Git
stub isolate tests from installed tools and repository state. They are test
doubles, not real-tool checks. Shared process drivers live in
`test/support/processes/`; fixtures, drivers, and isolation helpers follow
the [test code layout](../../docs/testing/test-code-layout.md).

## CRAP scores and goals

For decision paths `p` and covered share `c` from 0 to 1:

`CRAP = p² × (1 − c)³ + p`

This repository uses V8 coverage of each function's own characters. It
approximates the original basis-path coverage measure. Added or changed
functions have the strict goal **CRAP < 30**. Added functions also have the
inclusive target **CRAP ≤ 15**. Target 15 is an approved project decision,
not a universal grade. Architecture bands and risk counts use **CRAP ≥ 30**;
a new function above 15 but below 30 can miss its target without adding
critical architecture risk.

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

Each recommendation is the smallest whole percentage that meets the actual
inequality. At a positive crossing `c = 1 − ((L − p) / p²)^(1/3)`, strict
comparison uses `floor(100c) + 1`; inclusive comparison uses `ceil(100c)`.
Both check the candidate. Zero paths and already-passing zero coverage need
no division. `split` means no coverage share can meet the goal. Five paths
at zero coverage and 25 paths at 80% equal 30 and fail the strict goal.
At 30 paths even full coverage fails it; at 15 paths full coverage meets 15.
Decisions use unrounded scores. Display precision or an explicit inequality
keeps 29.96 visibly below 30 and 15.04 above 15.

### Own characters, joins, and unknowns

A function owns its whole UTF-16 range minus the union of strictly contained
functions across compatible processes. Equal ranges do not establish
parenthood; descendants are subtracted once. Compiler helpers and their
descendants are subtracted before exclusion. Each process clears zero-count
blocks, and execution is unioned across processes over the remaining own
characters. A function with no own characters has no measured share and is
listed in `unmeasuredFunctions`. This is character coverage, not basis-path
coverage. The [coverage guide](../../docs/implementation/ast-metrics-review.md#measure-the-coverage-per-function-scriptcode-qualityast-metrics-coveragets)
gives the range and representation rules.

Coverage joins by file and unique supported V8 name: a method uses its own
name, and a constructor uses its class name. Anonymous functions, duplicate
names, and missing matches have no exact CRAP. Only a complete verified
report can show that a missing file was not loaded; its unique supported
named functions then use share 0. Anonymous functions stay unknown even
when their file is absent. A missing name within a present file stays unknown.
Without a share, paths are a lower bound: `CRAP ≥ paths`. At least 30 paths
proves a violation; fewer paths do not prove a pass. Unknowns include
zero-own exclusions and known lower-bound violations.

Function identity is separate from this coverage join. In the same file or
a proven file rename, a unique declaration kind/owner/name pair proves
continuity. Equal body/signature hashes mean unchanged; edits mean changed.
Otherwise, only a unique unchanged body/signature pair can prove a move or
rename. New classification needs complete source evidence and no unresolved
base partner or move candidate. Name equality alone cannot resolve copies,
duplicate bodies, anonymous functions, or changed extractions. Legacy or
incomplete evidence stays identity unknown. Offline rendering does not read
the caller's checkout to fill a gap. Unknown identity cannot be called added
or worse, and cannot pass a required goal.

### Provenance and base estimates

Reuse requires verified provenance compatible with the candidate's source,
selected-test, and build inputs, plus runtime, compiler, suite, and measurement
version. Helpers, fixtures, configuration, manifests, and lockfiles count.
Generated output and unrelated prose do not change the input identity;
Markdown fixtures under `src/` and `test/` do. Thus an older capture can
remain valid after a prose-only commit. Legacy or unverified reports cannot
enable bands or historical risk counts. See
[capture provenance and reuse](../../docs/implementation/ast-metrics-review.md#capture-provenance-and-reuse)
for fingerprint and import mechanics.

The base gets no coverage run. A proven base/head function pair combines
base paths with the compatible head share to estimate base CRAP. A removed
or unmatched base function has no exact estimate; its paths can still prove
a lower-bound violation. Stored head-derived counts are **estimates**, not
measured base coverage. They keep the original coverage commit,
fingerprints, measurement version, and unknown-function count. They belong
to the first recording pull request; another head can give a different
estimate for the same base. Missing historical values remain absent.

### Bands, report columns, lists, and trends

Community and component nodes use the same three bands:

| Band | Required evidence |
| --- | --- |
| good | Every function is assessed, no file metrics are missing, and no function reaches 30. |
| warning | Known violations exist, but none is proven added or worse. |
| critical | At least one violation is proven added or worse. |

A proven new function at 30 or more is added risk, including a known lower
bound. A proven pair is worse only when exact head CRAP reaches 30 and
crosses 30 or exceeds its exact base estimate. A larger lower bound alone
cannot prove worsening against an unknown value. Gone nodes use known base
estimates. Unknown assessments prevent good; known violations can still
support warning or critical. Nodes state `assessment incomplete: N unknown`
and separately count an `unmeasured file` when function metrics are absent.
A node with no justified band has no band color. These rules add no fourth
band.

The CRAP command table has `File`, `Function`, `Change`, `Paths`, `Coverage`,
`CRAP`, and `To do`, including unchanged and identity-unknown functions.
Rows sort by score or lower bound descending, then file, function, and
stable source identity. Bounds cannot give an exact ranking of unknown
risks. Advice gives `ok`, strict-limit coverage or `split`, and target advice
such as `for 15: cover ≥ k%` or `for 15: split`. The summary separates known
limit violations, measured target misses, unmeasured functions, and
unresolved required assessments or identities. For example, a changed
function with `Paths: 20` and `Coverage: 50%` has `CRAP: 70`; its `To do`
shows `cover ≥ 71%` for the strict limit. A new function with four paths and
zero coverage has CRAP 20: it passes the strict limit, but its target advice
says `for 15: cover ≥ 12%`.

Architecture's changed-file table has `File`, `Maintainability`,
`Decision paths`, and `Risk rank`. Values show base → head, with `new`,
`gone`, or `not measured` when applicable. Risk rank is among the head's ten
riskiest files. Compatible coverage adds `CRAP ≥ 30` counts per side;
unassessed sides show `not measured`. The list `Functions at CRAP 30 or more,
added or worse` names proven additions and regressions. The report also gives
unmatched counts, identity unknowns, base functions without estimated shares,
and unmeasured functions of changed files with at least five paths. Those
lists sort by path and name. No changed production file gives
`No production file changed.`

The trend uses the same last ten stored `main` records, oldest first, plus
head, for its global table, maintainability/risk charts, and component
matrix. Global columns are `Commit`, `PR`, `Date`, `Modularity`, `Cross share`,
`Cycles`, `Maintainability`, and `Functions ≥ 30`. Component cells label
`MI` and `functions ≥ 30` separately. Risk values keep their basis: head is
`measured`, stored head-derived values are `estimate`, and old counts without
provenance are `legacy unknown`. Counts include known lower-bound
violations; other unknown functions are not counted. Missing values show `–`.
Charts split at gaps and changes of risk basis; they do not connect unlike
assessments.

Nonunit and combined risk values name their normalized suite set. Records keep
every capture identity and its original order. Charts split when either the
risk basis or selected suite set changes. Existing D3 records labelled measured
or head-derived estimate without `captureProvenance` retain the historical
unit-only schema. Pre-D3 records labelled `legacy unknown` remain unknown;
no suite or measured history is invented for them.

Runs of at least two values get a fenced Mermaid line chart; one value gets
a caption, and empty series say unavailable. Mixed tool versions get a
notice. Only a terminal `(#<n>)` in a commit title supplies the `PR`
column; offline rendering makes no GitHub lookup. See the
[architecture guide](../../docs/implementation/ast-metrics-review.md#show-the-architecture-delta-scriptcode-qualityast-metrics-architecturets)
for graph encoding, matching, and trend mechanics.

For required CRAP misses, improve selected tests or reduce paths for at most
three cycles with the same base. Record score or bound, paths, coverage,
classification, and reason for each unresolved goal, including new functions
above 15 but below 30 and unknown assessments. An unchanged high function can
retain `unchanged by this PR`. Ready may proceed with documented exceptions;
the command still exits 1. Exceptions do not excuse tool failures. Reselect
tests after test changes; missing coverage never authorizes a broader suite.

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

Lists added or changed TypeScript files against the merge base of `--base`:
production `src/` files first, lowest maintainability first, then other
files and files without measurements. Committed, staged, unstaged,
untracked, and renamed files count; deleted files do not. The production
maintainability goal is `--min`; test and support files have `no goal`.
It writes HTML to `ast-report/`, including `compare.html` unless
`--no-compare` is set. An empty selection prints a notice without tool access.

Exit 0 means no production file missed the goal; exit 1 means a missed goal,
invalid input, or an analysis failure. Maintainability ranges from 0 to 128;
more is better. Inspect low files with MCP and repeat for at most three
passes. Record any remaining score below 85 and its reason.

Focused tests: affected `ast-metrics-delta*.test.ts` rows in the
[available inventory](#available-tests), plus shared helpers when changed.
These patterns help selection; they do not select every listed test.

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
prints the answer, then stops the server. `file` prints file and function
maintainability, decision paths, and LOC, lowest score first. LOC counts
lines of code; it is not a source position. `--json` preserves the server
answer. Other subcommands print the results shown above. Limits delegated
to ast-metrics have no wrapper-owned default. Paths resolve from the current
folder and must stay within the repository.

Exit 0 means the answer was printed. Exit 1 gives one diagnostic line for
invalid input, an unknown tool or file, a timeout, an early server exit,
a version mismatch, or a missing executable. A timeout stops the server.

Focused tests: affected `ast-metrics-mcp*.test.ts` rows in the
[available inventory](#available-tests). Select its live contract only when
applicable under the policy.

## Review the delta

```text
Usage: pnpm exec node script/code-quality/ast-metrics-review.ts [--base REF] [--max-findings N] [--allow-tool-version] [--help]

Options:
  --base REF          Git ref to compare with (default: origin/main)
  --max-findings N    Most findings in the report (integer 1..1000; default: 50)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h          Show this help
```

Prints Markdown and writes `ast-report/review.md` and `ast-report/review.json`:
score drops, new-function warnings above 10 paths, new rule violations, and a
change summary. Function severity is high at 25 or more, else medium. The file
cap is 40 paths and LOC stays 150. The wrapper removes only the native medium
new-function warning at exactly 10 paths. It validates fresh native Markdown,
JSON, counts, gate, stdout, and exit status before any policy adjustment.

New resolved imports from `src/html-cleaner-pipeline/` to `src/mcp/`, and from
`src/website-fetcher/` to `src/auth/`, are high findings. These rules use CR-13
source resolution and compare with the merge base. Known forbidden base pairs
can follow proven Git renames or unique exact-content deleted/added moves;
allowed imports moved across a forbidden boundary are new findings. Uncertain dependencies in affected guarded sources fail with
an explicit diagnostic. Unchanged unrelated uncertainty does not block a
prose-only candidate. Native review itself compares with the base ref's tip;
update the branch from the base first. The native baseline does not suppress
wrapper path checks; the merge base establishes existing forbidden pairs.

When policy changes the report, forwarded tool stderr is labelled
`Native ast-metrics review diagnostic:` so native counts remain distinct from
wrapper counts. Unchanged native output and operational-failure diagnostics
keep their original form.

Adjusted JSON retains complete `nativeReview` and `reviewPolicy` metadata;
counts and gate are recomputed from every finding. Adjusted Markdown respects
`--max-findings`, while JSON retains the full list. A high finding outside the
Markdown limit still fails. Affected tests and all 13 live cases pass without skips. Final review evidence
belongs in the pull request description.

Exit 0 means no high-severity finding; exit 1 means such a finding, invalid
input, or a tool/report failure. Correct high findings or record a reason.
Refresh the baseline only within the [allowed policy](#refresh-an-allowed-baseline).

Focused tests: affected `ast-metrics-review*.test.ts` rows in the
[available inventory](#available-tests).

## Measure the coverage per function

```text
Usage: pnpm exec node script/code-quality/ast-metrics-coverage.ts [--from DIR] [--out FILE] [--no-build] [--allow-unverified] [--suite unit|integration|acceptance] [--help]

Options:
  --suite NAME  Repeat to select suites (default: unit); remove duplicates in first-requested order
                Each suite uses its package test script; nested suite commands defer collection
  --from DIR    Read the coverage files of an earlier captured suite from
                DIR, and do not run the suite
  --no-build    Reuse dist/ only with a matching .coverage-build.json manifest
  --allow-unverified  Inspect --from data without verified capture evidence
  --out FILE    Write the report to FILE (default: ast-report/coverage.json)
  --help, -h    Show this help
```

Select tests before collection. Unit collection, including either full-unit
live collector, is permitted only when `src/` changed or both complete unit
parts were independently selected: emitted Node tests and source portal tests.
A focused unit package does not select both parts. Integration or acceptance
collection also requires that complete package suite to be in the selected
scope. These options grant no scope exception. Reuse compatible data when
possible; otherwise keep the unavailable assessment and graph without bands.

Run comparison and coverage collection sequentially in the same checkout.
Native ast-metrics 0.43.1 `analyze --compare-with` checks out the comparison
ref (`origin/main` by default), then returns to the candidate branch. It can
refuse a dirty tree. Do not change
the checkout or run delta or process comparisons while collection is active.
A temporary checkout change can remove the collector preload and invalidate
the capture.

The default remains `unit`. Repeat `--suite unit|integration|acceptance` to
select suites, with duplicates removed in first-requested order. The command
checks each package `test:<suite>` script before it launches anything. It
accepts the `npm run build` prerequisite followed by direct `node --test`
commands for that suite. Nested suite commands, unknown prerequisites, or
selections that could add another suite defer collection before the build.
It preserves the package's exact globs and exclusions.

One build precedes the selected suites. Default unit collection runs
`node --test --test-concurrency=1 "dist/test/unit/**/*.test.js"`, then
`node --test "test/unit/user-portal/**/*.test.ts"`. Each selected suite gets
its own temporary `NODE_V8_COVERAGE` folder and retained capture manifest.
Suite output goes to stderr. Successful raw files and `capture-manifest.json`
stay under `ast-report/coverage-captures/capture-<suite>-<unique>/` before atomic
report publication. Compatible own-character execution is unioned across
processes and selected suites.

Cooperating Node child processes and workers inherit the capture settings.
Each process/thread needs normal completion evidence, verified loader shutdown
evidence, or a verified pre-crash seal. Other missing, untracked, unflushed, or killed participants reject the
capture and preserve the earlier report. A child that exits normally with
status 1 can still contribute complete coverage. An incomplete capture cannot
be called verified or justify expanding the selected suites.

Normal-exit markers record an `exitCheckpoint` after an explicit V8 flush.
Verification requires later V8 raw evidence beyond that checkpoint. This proves
a later flush; it does not by itself prove that termination was automatic-only.
Parent observations in `signal-*` receipts reject signal exits for captured
PIDs unless a verified pre-crash seal supports SIGKILL. A later flush alone
cannot turn such a signal exit into normal completion. Signals from native
children with no captured Node identity do not invalidate Node coverage.

The approved test helper `test/support/processes/crash-child.ts` requests a
main-thread seal bound to the capture, process/thread, and nonce. IPC and an
explicit prepared nonce at a synchronous blocked fixture boundary use the same
request and receipt checks. Only known crash fixtures set
`THERMUS_COVERAGE_CRASH=1` to install the seal IPC listener. Ordinary captured
forks have no injected message listener, so their normal exit and product IPC
behavior stay unchanged. OAuth uses a prepared `THERMUS_COVERAGE_SEAL_NONCE`
at its synchronous boundary and adds no IPC listener. The child flushes V8, stops coverage, records raw file hashes, and blocks before SIGKILL.
The parent checks that set before and after killing, then writes the receipt.
Active workers, previous worker-thread evidence, or missing, stale,
mismatched, or changed evidence reject the seal. Same-capture children and workers receive the lifecycle preload even when
their explicit options omit it; explicit independent captures remain separate.
Default ESM file workers keep Node's normal argument filtering and have
verified lifecycle coverage. A default CommonJS eval worker does not execute
inherited `--import` and stays unverified unless it uses the explicit
captured-argument adaptation.
Real `pnpm` and `tsx` entries keep their loader and executable tests. For actual
asynchronous loaders, both import and require capture preloads register an
observer with public `module.register()` in the actual loader thread. A persistent request, acknowledgement, and owner
receipt bind the capture ID, PID, loader and owner thread IDs, and nonce under
`loaderProtocol: "loader-flush-park-1"`. The evidence files are
`loader-request-*`, `loader-ack-*`, and `loader-receipt-*`; a `loader-parked`
marker retains `complete: false` until the verifier checks that exchange.
Node 24.20.0 runs require preloads in that loader thread too. The preload writes
an incomplete `loader-awaiting-owner` marker, and the observer adopts the same
marker after it binds the actual owner. An ownerless participant stays unverified.
A direct require preload with `node --import tsx` can instead use synchronous
hooks and start an unreferenced ordinary esbuild worker. The loader protocol
does not approve that noncooperating worker; the capture still fails strictly.
Only genuine owner exit, after its exit listeners finish, requests the loader
flush. A manually emitted `exit` event cannot end capture early. This uses the
private `process._exiting === true` guard in pinned Node 24.20.0; an absent or
different value leaves the participant incomplete. The
[guide](../../docs/implementation/ast-metrics-review.md#capture-provenance-and-reuse)
links the pinned Node sources and states this implementation limit.
The loader takes coverage and parks without stopping coverage. Verification
requires the intact checkpoint, a distinct later V8 flush, matching handshake,
and a normally completed owner. The complete exchange has a three-second
deadline. Signal deaths, missing or changed evidence, and raw-only or running
identities still reject publication. Worker evidence still prevents a pre-crash
seal. A focused loader fixture does not prove a complete real capture.

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

Current loader proof, 2026-10-19: complete real integration capture at
`88bfbf7193e990474be87170b62e10cb7d8118ce` passed all 535 tests in 44 suites,
with zero failures, cancellations, skips, or todos. Collection exited 0 in
29.671 seconds. The unchanged real work-slice tests ran through `pnpm` and
`tsx`; the small protocol fixtures are separate evidence.
The version-4 `capture-integration-aQqaHK` archive contains 226 raw V8 files,
109 PIDs, and 113 participant identities: 109 normal-exit owners and four real
internal `tsx` loaders. Each loader has matching request, acknowledgement, and
owner receipt evidence, an intact one-file checkpoint, one distinct later
flush, and a normally completed matching owner. The report covers 110 source
files and records 24 `createApplication` calls. Strict `--from` reimport exited 0,
produced a byte-identical report, and kept `["integration"]` plus the original
capture commit and nested identity. The default coverage report stayed unchanged.
Local evidence is under `ast-report/loader-integration-final-2026-10-19/`.
The earlier `c620cf8f` run passed all 535 integration tests but failed strict
verification for four raw-only loaders; it remains an unverified historical run.

Schema stays `version: 2` and `measurementVersion: "own-characters-1"`.
New capture manifests use version 4 with
`completionProtocol: "normal-exit-or-sealed-or-loader-1"` and original `captureId`, also
retained in per-capture provenance. Their raw fingerprint includes coverage,
lifecycle, seal-request, seal-receipt, signal-outcome, and loader handshake
evidence. Manifest versions 1, 2, and 3 retain their original rules; they are
not silently promoted to the new protocol.
Single-unit reports retain `suite: "unit"`; new nonunit and combined reports
use a suite array and `provenance.captures` with every original suite identity.
Version-2 capture manifests retain the suite identity and canonical unit
`comparisonIdentity` used to compare source and build inputs. Combined
manifest fingerprints hash the ordered suite/manifest-fingerprint descriptor.
Old single-unit strings and version-1 capture manifests remain readable.

For example, after both complete suites have been selected:

```sh
pnpm exec node script/code-quality/ast-metrics-coverage.ts --suite unit --suite acceptance
```

Each file records its representation and SHA-256 content identity.
`dist/src/x.js` maps to `src/x.ts`; source TypeScript under `src/` is also
accepted. Offsets stay in that representation's UTF-16 coordinates;
different representations cannot be unioned without conversion. The reader
validates whole ranges, counts, nesting, script bounds, content identities,
and safe summed calls before computing own-character coverage. Each
measured function keeps name, whole range, calls, and covered share;
zero-own functions are listed separately. See the
[coverage guide](../../docs/implementation/ast-metrics-review.md#measure-the-coverage-per-function-scriptcode-qualityast-metrics-coveragets)
for sourceURL trailers and exact validation rules.

`--no-build` requires `dist/.coverage-build.json` to verify current inputs
and all emitted content. `--from DIR` runs no build or suite: it validates
the original capture, raw content, and current inputs/build while retaining
the original commit. It imports one retained capture and cannot be combined
with `--suite`. Raw V8 URLs require the original checkout path; offline
rendering of a completed report does not. `--allow-unverified` is valid only
with `--from` and writes inspection data with its reason, original
information when available, and `commit: null` if unknown. It cannot enable
bands or history. `--no-build` and `--from` are mutually exclusive.

Exit 0 means the report was written. Invalid options, a failed build or
suite, invalid raw data, failed provenance, or publication failure exits 1
and preserves an earlier report. Archived raw data survive a later report
publication failure for recovery with `--from`. No ast-metrics is required.

Focused tests: affected `ast-metrics-coverage*.test.ts` and
`ast-metrics-provenance-*.test.ts` rows in the
[available inventory](#available-tests). Collector live rows have the scope
above, even when a focused caller would otherwise select them.

## Assess per-function CRAP goals

```text
Usage: pnpm exec node script/code-quality/ast-metrics-crap.ts [--base REF] [--coverage FILE] [--limit N] [--target N] [--allow-tool-version] [PATH...] [--help]

Options:
  --base REF            Compare against the merge base of REF and HEAD
                        (default: origin/main)
  --coverage FILE       Read verified selected-suite coverage from FILE
                        (default: ast-report/coverage.json in the repository)
  --limit N             Require CRAP strictly below N (default: 30)
  --target N            Require new functions at or below N (default: 15)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h            Show this help
```

Thresholds are finite positive decimals with at most six fractional digits.
After removing the point, the digits must form a safe integer (at most
9007199254740991); target must be below limit. Each `PATH` is an existing
TypeScript file under `src/`, relative to the current folder or absolute.
The default selects changed and untracked production files, excluding
deletions. Explicit paths keep their proven classification against the base;
they do not make every function new.

An empty default selection prints `No production files to assess.` and
exits 0 without coverage or MCP. Other runs need compatible verified coverage
from selected suites before measurement. Missing, stale, or unverified coverage gives
a specific error and no measured table. The command uses one bounded MCP
session for the selected files; it starts no build, suite, or full
architecture snapshot. Output follows the [CRAP rules above](#crap-scores-and-goals).

Exit 0 means applicable assessments passed or the default selection was
empty. Exit 1 means a known inspected limit violation, required new-target
miss, unknown required goal, invalid input, or tool failure. It also reports
unchanged high functions. Documented exceptions do not change this result.
If compatible coverage is unavailable and collection is outside scope,
record a deferred assessment.

Focused tests: affected `ast-metrics-crap*.test.ts` rows in the
[available inventory](#available-tests). The live contract reuses compatible
coverage and starts no collector:

```sh
AST_METRICS_CRAP_COVERAGE=/absolute/path/coverage.json node --test dist/test/acceptance/script/ast-metrics-crap.live.js
```

Without that variable it reads `ast-report/coverage.json`. A missing tool or
report skips explicitly; a skip is not a pass. A present stale report fails.

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

Prints Markdown in this order: base/head summary, community graph and
legend with import evidence, component graph and legend, changed-file
complexity, then global and component trends. Both fenced Mermaid graphs
always appear. An unchanged community map keeps `The map did not change.`;
with complete evidence the component view can say
`The component map did not change.` Paste both graphs, legends, import
evidence, tables, and trend charts unchanged into the pull request body,
including for document-only changes and reports without coverage.

Repository mode snapshots the merge base in a temporary worktree and the
working tree. Git supplies additions, modifications, renames, and deletions.
A rename has one `newpath (renamed from oldpath)` row using old base values;
a deletion has gone head cells and touches its base community. `--out` also
saves the report relative to the current folder.

Offline mode requires both `--head` and `--base-snapshot` and runs no tool.
`--changes` gives version-1 status and rename proof tied to both snapshots'
commits and source fingerprints. Repository mode rejects it. `--touched`
selects root-relative comma-separated paths without rename proof. With both,
it selects rows while `--changes` supplies correspondence evidence; with
neither, offline mode has no changed-file rows. Offline readers use supplied
evidence, not the caller's source tree. See the
[offline change format](../../docs/implementation/ast-metrics-change-request.md#a4-offline-change-metadata).

Coverage defaults to the repository report when present; offline mode needs
explicit `--coverage`. `--no-coverage` ignores the default and conflicts with
`--coverage`. Missing, legacy, unverified, stale, or skipped coverage keeps
structure with a specific withholding notice and no bands, CRAP column, or
assessed-function list. Report and explicit-skip notices also go to stderr.
An invalid report envelope fails. Compatible data adds
`Coverage: unit suite at <commit8>.` for the default suite, or a selected-suite
label with original capture identities for nonunit and combined reports, even
when no production file changed. See the [CRAP rules](#crap-scores-and-goals) for
incomplete assessments with valid coverage.

When tests, helpers, or fixtures under `test/` change without source changes,
the line after complexity is `Test changes are not judged: the base uses the
coverage of the head.` Without usable coverage it says `Test changes are not
judged: no coverage comparison was made.` Repository detection includes every
extension and committed, staged, unstaged, deleted, renamed, and nonignored
untracked inputs. Source assets also suppress a test-only claim. The TypeScript
delta selection stays unchanged, and `--touched` does not override this check.
Offline reports require known, equal source fingerprints in both snapshots,
declared test paths, and no declared source changes before they print the
notice. `--touched` selects rows; it alone does not prove unchanged source.
Missing or different fingerprints suppress the test-only claim. Offline mode
reads no checkout to fill the evidence.

Components are populated top-level `src/` folders, plus `src` for root files.
Nodes use file counts, LOC-weighted maintainability, paths, and eligible
bands. Each importing file counts once per target component; internal
imports make no self-edge or self-cycle. Import evidence shows up to ten
file pairs per changed community edge and an omitted count. It separates
changed imports from unchanged imports regrouped by the tool. Tool reference
counts and file-pair counts have different units.

Snapshots preserve parser-derived local static, type, re-export,
side-effect, and literal dynamic import pairs. Packages are ignored;
unresolved local imports, unsupported aliases, non-literal dynamic imports,
parse errors, and outside-source targets stay explicit issues. Legacy data
without dependencies withhold component edges and import explanations.
Incomplete evidence keeps known head edges and proven cycles, without
new/gone labels, count deltas, gone edges, cycle-change claims, or a component
unchanged claim. The notice says more dependencies and cycles may exist.
Missing metrics stay unavailable. See the
[snapshot format](../../docs/implementation/ast-metrics-change-request.md#a2-snapshot)
for dependency resolution and source evidence.

Only `--record` writes a missing base record to the trend store. It verifies
the full base SHA, ancestry on `origin/main`, source content, and committer
date. Offline recording also needs a repository. A non-ancestor prints
`No record: <base8> is not on origin/main.` and renders existing history;
missing refs or unverifiable identity fail. Publication never overwrites an
existing record, including concurrent writes. Malformed stores, prefix
collisions, record-shaped directories, and symlinks fail. Commit a new record;
keep the `main` file in a conflict. No record runs at merge time.

Records retain the base's actual tool version, title, stable-name component
metrics, and eligible estimated risk provenance. Legacy absence stays unknown.
Missing component LOC or paths withholds the whole component record field;
missing member function metrics withhold that component's risk count.
Different or missing snapshot versions get a `Tool versions:` notice;
mixed trend versions get a `Trend tool versions:` notice. An offline run
without a store says `No trend store.`;
a configured empty store without recording says
`No snapshot of main in the trend store yet.`

Repository trends check gaps strictly between the oldest and newest displayed
records that belong to first-parent `origin/main`. Every stored full commit
identity counts, including records omitted by the display limit or date order.
Each missing interval gets one line. Commits outside those endpoints are not
checked. Missing or shallow history leaves the structural report intact with
an explicit unavailable reason. An offline report with an explicit store says
`Gap check unavailable: offline snapshot dates cannot prove omitted commits.`
It runs no Git for this check. Offline mode without a store stays unchanged.
Use [manual backfill](#backfill-missing-main-records) to fill eligible gaps.

Exit 0 means structural Markdown was printed; this report is not a goal gate.
Exit 1 means invalid input, analysis/read/record failure, with one diagnostic
line and no Markdown. SIGINT/SIGTERM during base capture remove its worktree
and exit 130/143. Coverage unavailability alone does not fail structure or
permit collection outside test scope.

Focused tests: affected `ast-metrics-architecture*.test.ts` and
`ast-metrics-community-evidence.test.ts` rows in the
[available inventory](#available-tests). Select structural and collector
live contracts separately under their listed scope.

## Take a snapshot

```text
Usage: pnpm exec node script/code-quality/ast-metrics-snapshot.ts [--base REF | --commit FULL_SHA] [--out FILE] [--timeout-ms MS] [--allow-tool-version] [--help]

Options:
  --base REF       Take the snapshot of the merge base of REF and HEAD
  --commit FULL_SHA  Take the snapshot of one full lowercase 40-character commit SHA
  --out FILE       The snapshot file, relative to the current folder (default:
                   ast-report/snapshot.json in the repository root,
                   ast-report/snapshot-base.json with --base, or
                   ast-report/snapshot-commit.json with --commit)
  --timeout-ms MS  Deadline of the MCP session (100..300000; default: 60000)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h       Show this help
```

Writes global `src/` metrics, communities, files and functions, source
identity, and dependency evidence. It uses one `ast-metrics analyze src`
run and one bounded `ast-metrics mcp src` session; only source changes alter
communities. Publication requires every call to succeed and unchanged input
identity. The snapshot stores no coverage or CRAP; architecture joins those
when reporting.

Capture emits optional file `maintainabilityRaw` by default when native file MI
is available. It keeps finite precision before rounding, including zero, with
no assumed upper clamp. Rounded `maintainability`
stays unchanged; top-level snapshot version stays 1. Missing/legacy raw values
remain unavailable, never inferred from rounded scores. Present malformed or
nonfinite native MI for a `src/` file stops capture before publication;
out-of-scope entries remain ignored. The existing
architecture reader ignores this optional field; displays/trends/process retain
rounded data. A raw-retaining assessment reader remains future work.

`tool` keeps the checked actual version, including an explicit override.
Optional `title` is the commit message's first line; optional `provenance`
contains source and expected coverage-input fingerprints, runtime, compiler,
suite, and measurement version. Optional source evidence uses
`typescript-tokens-v1`, UTF-16 ranges, and completeness. Supported function
identity keeps kind, owner, name, range, and body/signature hashes. Token
normalization ignores whitespace and comments but retains executable syntax
and literal spelling. Anonymous functions, duplicate names, unsupported
owners, and parse errors limit identity. Legacy snapshots remain readable
for structure. The [snapshot guide](../../docs/implementation/ast-metrics-review.md#take-a-snapshot-scriptcode-qualityast-metrics-snapshotts)
gives exact fields and completeness rules.

Community labels use the largest source namespace by member count, without
`src/`; ties use lexical order. Root files use `src`, the shared kernel uses
`shared kernel`, and duplicate labels append the hub basename. Maintainability
is weighted by LOC. LOC is a line count, not a source position.

`--base` captures the merge base in a temporary worktree under the system
temporary folder. It needs no install or repository hook. The command removes
it after success, failure, SIGINT, or SIGTERM, and clears abandoned worktrees
from interrupted runs, reporting that count on stderr. Explicit `--out`
resolves from the current folder; defaults are at the repository root.

`--commit FULL_SHA` captures one exact committed tree, independently of HEAD or
its merge base. Require a full lowercase 40-character hexadecimal commit SHA;
reject combination with `--base` before starting tools. Default output is
`ast-report/snapshot-commit.json` at the repository root. The command reuses the
existing exact-commit owner and temporary-worktree cleanup. It starts no build,
test or coverage run and uses the same version-1 snapshot format. Working-tree
default and `--base` merge-base behavior stay unchanged.

Exit 0 means the snapshot was written. Exit 1 gives one diagnostic line for
invalid input, a missing executable, failed analysis/call, or publication
failure. SIGINT/SIGTERM during base or exact-commit capture exit 130/143 after
cleanup.

Focused tests: affected `ast-metrics-snapshot*.test.ts`,
`ast-metrics-dependencies*.test.ts`, and source-evidence rows in the
[available inventory](#available-tests). Select its live contract only within
policy scope.

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
architecture in order. It prints and saves four report sections: delta,
review, CRAP, and architecture, preserving all stage tables, drawings,
legends, and notices. A text fence keeps delta's aligned rows. `--base`
reaches each comparison and the version override reaches each tool operation.
Explicit paths resolve from the current folder; defaults use the repository root.

Reuse of compatible verified coverage is the default. Missing or stale data
never starts a suite. `--coverage` selects another report.
`--collect-coverage` builds and collects both complete unit parts once; use
it only when `src/` changed or both parts were independently selected, and
record that selection. `--skip-coverage` ignores all reports and renders
structure without bands. Reuse, collection, and skip choices conflict.

An empty default production selection prints `No production files to
assess.` without coverage or MCP for CRAP. A document-only run can finish
and record structure without risk counts. Nonempty required goals without
sufficient data stay unresolved, including with explicit skip.

Completed goal misses retain the full evidence. Operational failures leave
partial results and dependent sections unavailable. Only after all required
analyses complete does the process request verified base recording; completed
goal misses can record, unavailable required assessments and failures cannot.
Existing history stays unchanged. Exploratory standalone architecture stays
read-only without `--record`.

Exit 0 requires completed passing assessments. Goal misses, unresolved
required data, invalid options, tool failures, and recording failures exit 1.
Approved exceptions do not change these results or excuse tool failures.

Focused tests: affected `ast-metrics-process*.test.ts` and
`ast-metrics-stage-outcomes.test.ts` rows in the
[available inventory](#available-tests). Process doubles never start coverage
implicitly. A process test alone selects neither both complete unit parts
nor all live contracts.

## Refresh an allowed baseline

```text
Usage: pnpm exec node script/code-quality/ast-metrics-baseline.ts [--allow-tool-version] [--help]

Options:
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h            Show this help before Git or tool access
```

Runs `ast-metrics baseline` from the repository root after the pinned
version check or an explicit override. It prints the YAML ignored-entry
counts before and after; a missing baseline starts at zero. Exit 0 means
refresh succeeded and both counts are valid; invalid input, invalid YAML,
or tool failure exits 1. Help needs no Git or tool access.

Use this wrapper only when the pull request changes the rules in
`.ast-metrics.yaml`. Commit the resulting `.ast-metrics-baseline.yaml` in the
same pull request. A retained review finding and a violation already on
`main` are not reasons; the wrapper grants no extra permission.

Focused tests: affected `ast-metrics-baseline.test.ts` rows in the
[available inventory](#available-tests).

## Backfill missing main records

```text
Usage: pnpm exec node script/code-quality/ast-metrics-backfill.ts [--count N] [--allow-tool-version] [--help]

Options:
  --count N             Positive safe integer commit count (default: 10)
  --allow-tool-version  Allow an installed version other than the pinned version
  --help, -h            Show this help
```

Selects the latest `--count` commits from first-parent `origin/main`, then
processes those commits oldest first. Count must be a positive safe integer;
its default is 10. Complete Git history and `origin/main` are required. Help
and invalid arguments resolve before Git or tool access; missing or shallow
history fails before analysis.

Each missing record comes from a detached temporary worktree of that exact
commit. This is not a merge-base snapshot. Existing records stay immutable,
including records without CRAP counts. Backfill writes verified structural
records under `docs/metrics/`; it installs no dependencies, collects no
coverage, and starts no test suite. It adds no merge-time workflow. Worktrees
are removed after success, failure, SIGINT, or SIGTERM. Commit new records
and keep the `main` version in any metrics conflict.

Exit 0 means all selected records exist. A failure exits 1 and retains
records completed before the failure. Signals exit 130 or 143 after cleanup.
A later run skips existing records and can continue the missing work.

Focused tests: `ast-metrics-backfill.test.ts` and
`ast-metrics-trend-gaps.test.ts` rows in the [available inventory](#available-tests).
They use temporary repositories and tool doubles and run no application suite.

## Available tests

This is the complete available inventory, not a requirement to run every
file. Select affected rows with the
[test gate policy](../../docs/implementation/test-gate-policy.md#ast-metrics-focused-and-live-contracts),
following changed shared helpers and fixtures to their consumers. Each
command's test patterns are selection aids. After a clean build, replace
`test/` with `dist/test/` and `.ts` with `.js` for an emitted focused test.
The documentation contract can also run directly from source:

```sh
node --test test/acceptance/script/script-readme.test.ts
```

That test reads real `--help` with an empty PATH and forbids child processes.
It checks exact Usage/Options contracts, declared defaults, and this inventory
against the [test inventory](../../docs/testing/test-list.md#ast-metrics-commands).
It reads command references; it never executes the listed test commands.
Prose changes alone do not select a broader suite through those references.

Live contracts check repository invariants, not fixed community, cycle, or
file counts. MCP checks function output and missing files. Snapshot checks
source membership, labels, references, counts, HEAD, dependency pairs,
deadlines, and worktree cleanup. Architecture acceptance cases share full
graph fixtures; the document-only case proves no suite runs.

`ast-metrics-architecture.live.ts` uses `--no-coverage` and checks structure,
components, graphs, legends, and cleanup without starting a suite.
`ast-metrics-architecture-coverage.live.ts` and `ast-metrics-coverage.live.ts`
collect both complete unit parts. The latter also proves that portal tests
call `initializePortal`. Both keep the default report unchanged. Architecture
live cases use temporary trend stores and write no repository record.

`ast-metrics-rules.live.ts` probes the pinned tool's coupling and new-function
warning behavior in temporary repositories. Path-target coupling patterns do
not catch named TypeScript imports; symbol patterns follow aliases and match
across paths, with low findings. Native new-function warnings start at ten
paths and become high at 25, while the wrapper removes the warning at 10
and keeps it at 11. It also checks file limits at 39/40/41 paths and
149/150/151 LOC. It runs no collector. The owner approved cleaner → MCP and
website-fetcher → auth path rules through the review wrapper, file cap 40
with LOC 150 unchanged, and a strict new-function warning above 10 paths on
2026-10-19. The candidate implements those project rules. Selected tests,
typechecking, and all 13 affected live cases pass. Native coupling cases explain
the need for
resolved-path checks; focused review-policy tests cover the wrapper rules.

MCP, snapshot, CRAP, and architecture live cases need ast-metrics and skip
explicitly when unavailable. CRAP also needs reusable compatible coverage.
A skip is not a pass. Coverage collection itself needs no ast-metrics.
Run either full-unit live collector only when `src/` changed or both complete
unit parts were independently selected; otherwise record it as deferred. A build only prepares
emitted tests. Changes to one command or double do not select all live files.

<!-- code-quality-tests:start -->

| Kind | Test file | Collects full unit coverage |
| --- | --- | --- |
| ordinary | test/acceptance/script/ast-metrics-architecture-bands.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-base.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-changes.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-components.test.ts | no |
| live | test/acceptance/script/ast-metrics-architecture-coverage.live.ts | yes |
| ordinary | test/acceptance/script/ast-metrics-architecture-identity.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-provenance.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-repository-changes.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-repository-provenance.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-table.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-test-changes.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-trend-charts.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-trend-view.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-trend.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-unchanged.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture-unmeasured.test.ts | no |
| live | test/acceptance/script/ast-metrics-architecture.live.ts | no |
| ordinary | test/acceptance/script/ast-metrics-architecture.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-backfill.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-baseline.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-community-evidence.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-coverage-crash.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-coverage-failures.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-coverage-loader-exit.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-coverage-loader-refusal.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-coverage-loader.test.ts | no |
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
| ordinary | test/acceptance/script/ast-metrics-mcp-shutdown.test.ts | no |
| live | test/acceptance/script/ast-metrics-mcp.live.ts | no |
| ordinary | test/acceptance/script/ast-metrics-mcp.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-process-collection.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-process-coverage.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-process-failures.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-process.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-review-policy.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-review.test.ts | no |
| live | test/acceptance/script/ast-metrics-rules.live.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-base-failures.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-base-worktree.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-base.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-commit.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-dependencies.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-failures.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-provenance.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-raw-mi.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-source.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot-title.test.ts | no |
| live | test/acceptance/script/ast-metrics-snapshot.live.ts | no |
| ordinary | test/acceptance/script/ast-metrics-snapshot.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-stage-outcomes.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-tool-version.test.ts | no |
| ordinary | test/acceptance/script/ast-metrics-trend-gaps.test.ts | no |
| ordinary | test/acceptance/script/script-readme.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-bands.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-changes.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-component-records.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-components.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-coverage.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-crap.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-functions.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-identity.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-provenance.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-report.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-table.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-test-changes.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend-charts.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend-file.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend-provenance.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend-publication.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend-store.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend-title.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend-view.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-trend.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture-unmeasured.test.ts | no |
| ordinary | test/unit/script/ast-metrics-architecture.test.ts | no |
| ordinary | test/unit/script/ast-metrics-backfill.test.ts | no |
| ordinary | test/unit/script/ast-metrics-baseline.test.ts | no |
| ordinary | test/unit/script/ast-metrics-community-evidence.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-capture.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-input.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-loader-checkpoint.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-loader-manifest.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-loader-runtime.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-loader-validation.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-own.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-propagation.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-seal.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-suites.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage-unmeasured.test.ts | no |
| ordinary | test/unit/script/ast-metrics-coverage.test.ts | no |
| ordinary | test/unit/script/ast-metrics-crap-command.test.ts | no |
| ordinary | test/unit/script/ast-metrics-crap-goals.test.ts | no |
| ordinary | test/unit/script/ast-metrics-crap-metrics.test.ts | no |
| ordinary | test/unit/script/ast-metrics-crap-report.test.ts | no |
| ordinary | test/unit/script/ast-metrics-delta.test.ts | no |
| ordinary | test/unit/script/ast-metrics-dependencies-read.test.ts | no |
| ordinary | test/unit/script/ast-metrics-dependencies.test.ts | no |
| ordinary | test/unit/script/ast-metrics-file-changes.test.ts | no |
| ordinary | test/unit/script/ast-metrics-json-file.test.ts | no |
| ordinary | test/unit/script/ast-metrics-mcp.test.ts | no |
| ordinary | test/unit/script/ast-metrics-order.test.ts | no |
| ordinary | test/unit/script/ast-metrics-process.test.ts | no |
| ordinary | test/unit/script/ast-metrics-provenance-inputs.test.ts | no |
| ordinary | test/unit/script/ast-metrics-provenance-read.test.ts | no |
| ordinary | test/unit/script/ast-metrics-review-moves.test.ts | no |
| ordinary | test/unit/script/ast-metrics-review-policy.test.ts | no |
| ordinary | test/unit/script/ast-metrics-review-report.test.ts | no |
| ordinary | test/unit/script/ast-metrics-review.test.ts | no |
| ordinary | test/unit/script/ast-metrics-snapshot-source.test.ts | no |
| ordinary | test/unit/script/ast-metrics-snapshot-title.test.ts | no |
| ordinary | test/unit/script/ast-metrics-snapshot.test.ts | no |
| ordinary | test/unit/script/ast-metrics-source-evidence-read.test.ts | no |
| ordinary | test/unit/script/ast-metrics-source-evidence.test.ts | no |
| ordinary | test/unit/script/ast-metrics-tool-version.test.ts | no |

<!-- code-quality-tests:end -->
