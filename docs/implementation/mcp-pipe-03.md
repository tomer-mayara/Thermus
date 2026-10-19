# MCP-PIPE-03: outgoing observation and fixed step records

Status: merged in PR #160 on 2026-10-18 at the owner's request.
Merge revision: `190d60f7d8af0b6e0c61017154b363a49686653d`.
Implementation baseline: `121609500498e710e74b10e6058496353cf51bc2` on `origin/main`.
Tested implementation revision: `15d7c223f59dd618d5a6f5200f6988d646e1b5bc`.
PR: [#160](https://github.com/tomer-mayara/Thermus/pull/160).

The user authorized this slice after merging MCP-PIPE-02 in
[PR #159](https://github.com/tomer-mayara/Thermus/pull/159). The
[reviewed ticket](mcp-pipelines-plan.md#mcp-pipe-03--add-the-outgoing-standard-step-and-fixed-records)
defines the scope. The original documentation foundation recorded intended
behavior before implementation results existed. The manager signed off that
foundation, committed it as `5f7dd2b0`, and opened draft PR #160 before source
edits. The manager signed off the stable implementation, contracts, focused
evidence, and current API docs. Complete checks and suites passed as recorded
below. Both image gates and environment restoration are verified. The manager
signed off the complete implementation and retained quality dispositions. The
owner then requested the merge. The implementation commit includes source, tests, and
README; final evidence updates are docs only. PR #160 tracks readiness and
the final head's checks.

## Authorized scope

Add `ObserveRequestStep` and the small protocol/executor inside `src/page-fetch/`.
Use `PipelineStep<Input, Output>` with a fixed readonly ID and
`execute(input, signal): Promise<StepResult<Output>>`. Its result is
`allow { output }` or `block { code }`. The step receives no logger, operation
ID, facts bag, or context object.

The production outgoing step has ID `outgoing.observe_request`. It accepts the
original valid URL string and allows that exact string unchanged. It performs
no policy processing. The executor owns decision validation, cancellation,
safe output checks, timing, and the one step-record attempt.

Bind the outgoing role and ID through trusted composition. Only explicit
allow with the original string can reach fetch. A generic `blocked` result
prevents fetch. Throws use `step_failed`; malformed decisions, codes, or output
use `invalid_step_result`. Unknown decisions and incoming scan codes must fail
closed. Use fixture-controlled steps to prove these outcomes; add no production
blocking policy.

The executor attempts this fixed record through a core-owned synchronous sink:

```ts
{
  event: 'pipeline.step.completed',
  operationId,
  stepId: 'outgoing.observe_request',
  outcome,
  durationMs,
  code?,
}
```

Allowed has no code. Blocked uses `blocked`; failed uses `step_failed` or
`invalid_step_result`; cancelled uses `cancelled`. Duration is a finite,
non-negative rounded integer capped at `Number.MAX_SAFE_INTEGER`; invalid clock
data uses a fixed safe duration. No URL, reason, page, Markdown, headers,
credentials, warning, raw error, or result payload enters this record.

Composition adapts the application logger to the neutral sink. Preserve the
page-fetch import guard, including type-only imports: public auth/fetch contracts
are allowed; MCP/SDK/provider, application/composition, concrete cleaner,
renderer/network-policy, and concrete logger dependencies are refused.
Extend the existing architecture fixtures; add no new pipeline package,
registry, inheritance hierarchy, or facts/projector framework.

## Invariants

- Preserve order: HTTP auth/access, dispatch ID and schema checks, hosted
  cancellation/capacity, then protected cancellation/permission/URL/ID guards.
  Run the outgoing step before fetch. The existing processor stays unchanged.
- Keep the same validated operation ID and signal. New step records join the
  existing `mcp.tool.completed` ID. Unreached steps get no synthetic event.
- Outgoing block or failure projects `isError: true`, `Page fetch failed`, and
  `fetch_failed`. Cancellation keeps the existing safe result and `cancelled`
  completion. Do not use an unknown-error default to implement block behavior.
- Observe signal abort or `AbortError` before recording/advancing, even when
  the signal has not changed yet. Cancellation wins over late allow/block/error.
  An entered step settles after its owned work and cleanup; do not race abort
  against it. Keep the hosted slot until that settlement. Do not rewrite a
  completed step record if later fetch or processing cancels.
- Attempt one synchronous sink write per entered step. Sink failure cannot
  change a decision, repeat work, skip cleanup, or leave an unhandled promise.
  With a healthy sink, require exact event counts and one actual MCP completion.
  No durable or exactly-once delivery guarantee is added.
- Preserve exact Markdown, empty success, renderer reports/deduplication,
  fixed public failures, cleaner order, and current capacity ownership.
  Legacy completion URL path and verbatim reason can still contain sensitive text.

Incoming standard steps and typed withholding remain MCP-PIPE-04. Policy,
redaction, child-request interception, step-up, hashing, cache, per-cleaner
standard steps, and durable audit remain outside this slice. Traffic from an
agent's other internet tools is outside Thermus MCP scope.

## BDD and TDD intent

Write the public acceptance specification first and record its genuine failure
before implementing the new record. Use focused TDD for the protocol, executor,
observation role, sink boundary, and composition. Refactor with tests green.

- Given a permitted call in either edition and protocol era, when it finishes,
  then fetch receives the exact original URL, Markdown stays exact, and one
  allowed outgoing event joins its completion ID.
- Given a fixture step that blocks, throws, returns an unknown decision/code,
  or changes the URL or output type, when execution settles, then no fetch or
  processing starts; fixed errors and distinct blocked/failed events result.
- Given secret sentinels and a healthy sink, when records are read, then only
  the fixed safe fields exist, with exact counts and IDs. A non-completion event
  cannot resolve `firstCompletion`.
- Given a broken sink, when a step allows or blocks, then the result remains
  correct and no step or fetch repeats.
- Given abort before step settlement and delayed cleanup, when work settles,
  then cancellation wins, no fetch follows, and overlapping hosted work remains
  busy until cleanup finishes. Earlier completed records stay unchanged.

Same-package step/executor tests use public collaborator doubles. Protected
core tests with real auth remain integration. HTTP/edition acceptance proves
the observable behavior in both protocol eras. Update tool/logging references
and the test inventory in this PR when the implementation names are settled.

## Verification record

The documentation foundation ran no implementation suite or AST measurement.
The BDD and focused TDD results are below. The complete check, integration,
acceptance, hosted offline build, and renderer proof passed. AST and habit-hooks
are complete with retained findings. Both image gates and environment restoration
passed. Manager sign-off is complete; owner review remains pending.
See PR #160 for the final head's checks.
Record actual commands, exit statuses, candidate revision, Node counts, and
retained findings as evidence arrives. Historical results from tickets 01–02
are not evidence for this candidate.

The manager confirmed `pnpm install --frozen-lockfile` exited 0, Node `24.20.0`,
ast-metrics `0.43.1`, and Lightpanda `1.0.0`. These prerequisite checks are not
implementation test or quality-gate passes.

| Required evidence | Status |
| --- | --- |
| First failing BDD acceptance specification | Exit 1; 9 tests, 1 suite, 6 passes, 3 failures; zero cancelled/skipped/todo |
| Observation/executor TDD | Stub red: exit 1, 45 tests, 0 suites, 0 passes, 45 failures; green: exit 0, 45 passes; zero cancelled/skipped/todo |
| Protected core integration | Red: exit 1, 38 tests, 1 suite, 28 passes, 10 failures; green in the joined run below |
| Core and edition acceptance | Exit 0; 47 tests, 2 suites, 47 passes; zero failed/cancelled/skipped/todo |
| HTTP faults, records, cancellation, and hosted capacity | Exit 0; 97 tests, 1 suite, 97 passes; zero failed/cancelled/skipped/todo |
| Reader TDD and architecture proof | Reader red: 6 tests, 1 suite, 5 passes, 1 failure; joined green: 23 tests, 2 suites, 23 passes |
| Every new/changed test before commit | Focused bundle exit 0; 257 tests, 8 suites, 257 passes; zero failed/cancelled/skipped/todo |
| Scoped source/test ESLint | Exit 0; 27 TypeScript files, no findings |
| Complete check | Passed in `build:hosted` |
| Habit-hooks; snooze `[]` | Exit 1; retained findings with reasons below |
| Complete integration | Exit 0 in hosted build; 534 tests, 44 suites, 534 passes |
| Full acceptance | Exit 0; backend 508 tests/47 suites/508 passes; portal 16/0/16; zero other outcomes |
| Hosted offline build and rendered MCP proof | Exit 0; offline 137 tests/17 suites/137 passes; renderer 9/1/9 |
| Self-hosted image | Exit 0; 13 tests, 1 suite, 13 passes; zero other outcomes |
| Linux AMD64 hosted image | Exit 0; 9 tests, 0 suites, 9 passes; zero other outcomes |
| Environment restoration | Runner and independent verification exit 0; original state and 753 non-doc input hashes verified |
| Required AST passes, inspections, and review Markdown | Complete; nonzero findings and dispositions below |
| Manager implementation/docs review | Signed off, including functional proofs and quality dispositions |
| Owner review | Pending |
| Actions/final head | Repository API reports 0 workflows; see PR #160 for the final head's checks |

Before production edits, the implementation agent ran:

```sh
pnpm run build && pnpm exec node --test dist/test/acceptance/mcp/hosted-fetch-tool.test.js dist/test/acceptance/mcp/self-hosted-fetch-tool.test.js
```

`.cache/mcp-pipe-03/acceptance-red.log` records three missing outgoing-event
failures: hosted composition and self-hosted modern/legacy calls. Exact legacy
Markdown and completion checks passed before the new record assertions failed.
This is a failure of the new record requirement, not an artificial break in
unchanged output. Later focused and complete-candidate results are recorded below.

### Focused TDD

The observation and executor tests used this command:

```sh
pnpm run build && pnpm exec node --test dist/test/unit/page-fetch/observe-request-step.test.js dist/test/unit/page-fetch/execute-outgoing-step.test.js
```

`.cache/mcp-pipe-03/executor-red.log` records the stub implementation run:
45 tests in 0 suites, all 45 failed, exit 1. The final
`executor-green.log` records exit 0, 45 tests in 0 suites, all 45 passed,
with zero failed/cancelled/skipped/todo. The stub failures are not 45 distinct
proofs of missing product behavior; the public BDD red above is the primary proof.

Intermediate logs preserve TypeScript narrowing and Promise-capture corrections
in the test harness. `executor-before-cause-assertion-fix.log` also preserves a corrected
assertion: an absent `Error.cause` is safe, so the test checks its value rather
than requiring an own property whose value is undefined. These test corrections
are not reported as product regressions.

The protected core red command was:

```sh
pnpm run build && pnpm exec node --test dist/test/integration/page-fetch/fetch-page.test.js
```

`.cache/mcp-pipe-03/core-red.log` records exit 1, 38 tests in 1 suite:
28 passed, 10 failed, and zero cancelled/skipped/todo. The failures identify
missing outgoing execution/recording; existing cases passed.

### Core and edition acceptance green

```sh
pnpm run build && pnpm exec node --test dist/test/integration/page-fetch/fetch-page.test.js dist/test/acceptance/mcp/hosted-fetch-tool.test.js dist/test/acceptance/mcp/self-hosted-fetch-tool.test.js
```

`.cache/mcp-pipe-03/core-and-acceptance-green.log` records exit 0, 47 tests in
2 suites, and 47 passes, with zero failed/cancelled/skipped/todo. This closes
the core and edition BDD red cases.

### HTTP contract green

```sh
pnpm run build && pnpm exec node --test \
  dist/test/acceptance/mcp/outgoing-step.test.js \
  dist/test/acceptance/mcp/outgoing-step-cancellation.test.js \
  dist/test/acceptance/mcp/http-fetch.test.js \
  dist/test/acceptance/mcp/http-fetch-refusals.test.js \
  dist/test/acceptance/mcp/http-request-isolation.test.js \
  dist/test/integration/mcp/renderer-setup-report.test.js
```

`.cache/mcp-pipe-03/http-contracts-green.log` records exit 0, 97 tests in
1 suite, and 97 passes, with zero failed/cancelled/skipped/todo. Both protocol
eras prove private-field exclusion, step faults, broken sinks, and delayed
cleanup cancellation. Production hosted composition proves slot ownership
and shared operation IDs. A step exception that resembles a renderer failure
does not emit a renderer report.

The hosted-slot case waits for the actual `busy` and `cancelled` completion
records before its next call. It does not infer slot release from a step event.

### Shared reader and import proof

The reader red command was:

```sh
pnpm run build && pnpm exec node --test dist/test/unit/test-support/operator-log.test.js
```

`.cache/mcp-pipe-03/reader-red.log` records exit 1, 6 tests in 1 suite:
5 passed, 1 failed, and zero cancelled/skipped/todo. The new step-event reader
was missing. The joined green command was:

```sh
pnpm run build && pnpm exec node --test dist/test/unit/test-support/operator-log.test.js dist/test/acceptance/architecture/page-fetch-boundaries.test.js
```

`.cache/mcp-pipe-03/reader-and-boundary-green.log` records exit 0, 23 tests in
2 suites, all 23 passed, with zero failed/cancelled/skipped/todo.
`stepRecordsIn(output, operationId?)` selects only step events and optionally
matches the exact case-sensitive ID. It is shared by the HTTP and edition
proofs. The architecture fixtures now also prove the local executor/protocol/
record modules' public-contract allow and implementation deny boundaries.

### Final focused candidate

```sh
pnpm run build && pnpm exec node --test \
  dist/test/unit/page-fetch/observe-request-step.test.js \
  dist/test/unit/page-fetch/execute-outgoing-step.test.js \
  dist/test/unit/test-support/operator-log.test.js \
  dist/test/integration/page-fetch/fetch-page.test.js \
  dist/test/integration/mcp/get-url-as-markdown-pipeline.test.js \
  dist/test/integration/mcp/get-url-as-markdown-mcp.test.js \
  dist/test/integration/mcp/renderer-setup-report.test.js \
  dist/test/acceptance/architecture/page-fetch-boundaries.test.js \
  dist/test/acceptance/mcp/hosted-fetch-tool.test.js \
  dist/test/acceptance/mcp/self-hosted-fetch-tool.test.js \
  dist/test/acceptance/mcp/http-dns-cancellation.test.js \
  dist/test/acceptance/mcp/http-fetch-refusals.test.js \
  dist/test/acceptance/mcp/http-fetch.test.js \
  dist/test/acceptance/mcp/http-renderer-shutdown.test.js \
  dist/test/acceptance/mcp/http-request-isolation.test.js \
  dist/test/acceptance/mcp/http-shutdown.test.js \
  dist/test/acceptance/mcp/outgoing-step.test.js \
  dist/test/acceptance/mcp/outgoing-step-cancellation.test.js \
  dist/test/acceptance/mcp/http-fetch-cancellation.test.js \
  dist/test/acceptance/mcp/http-cancelled-shutdown.test.js \
  dist/test/integration/fetch-tool-renderer-setup-report.test.js \
  dist/test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.test.js \
  dist/test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.js
```

`.cache/mcp-pipe-03/focused-green.log` records exit 0, 257 tests in 8 suites,
all 257 passed, with zero failed/cancelled/skipped/todo. The bundle covers all
18 new/changed test entry files and 5 unchanged regression files. The manager
approved the source/test behavior; the full gates remain separate proofs.

Scoped ESLint on all 27 source/test TypeScript files exited 0 with no findings;
`.cache/mcp-pipe-03/focused-eslint.log` is empty. The implementation agent's
diff check exited 0. These scoped checks do not replace the complete-candidate
proofs below.

### Hosted build and renderer

```sh
LIGHTPANDA_BIN=/Users/tomermayara/git/Thermus/.cache/lightpanda/1.0.0/lightpanda pnpm run build:hosted
```

The command exited 0 with live credential settings removed from its environment.
`.cache/mcp-pipe-03/build-hosted.log` and its status file record these phases:

| Phase | Tests | Suites | Passed |
| --- | ---: | ---: | ---: |
| Backend unit | 2800 | 194 | 2800 |
| Portal unit | 19 | 0 | 19 |
| Build | 13 | 0 | 13 |
| Portal acceptance | 16 | 0 | 16 |
| Complete integration | 534 | 44 | 534 |
| Hosted offline | 137 | 17 | 137 |
| Real renderer | 9 | 1 | 9 |

Every phase had zero failed, cancelled, skipped, or todo tests. Typechecks and
the portal build passed. This supplies the full `check`, complete integration,
hosted offline build, and rendered MCP proofs. Neither image gate is replaced.

### Full acceptance

`pnpm run test:acceptance` exited 0. The backend reported 508 tests in 47 suites,
all 508 passed; the portal reported 16 tests in 0 suites, all 16 passed. Both
phases had zero failed, cancelled, skipped, or todo tests. Evidence is
`.cache/mcp-pipe-03/acceptance-full.log` and its status file.

Only Axiom test credentials were loaded from the main checkout's `.env.local`
into the child environment, using `system-log-test`. No credential values are
recorded here. This is not a dedicated image proof.

### Self-hosted image

`pnpm run test:container` exited 0 on the original Linux ARM64 VM with 4 CPUs
and 4 GiB. It reported 13 tests in 1 suite, all 13 passed, with zero failed,
cancelled, skipped, or todo tests. Duration was 81.254 seconds. Evidence is
`.cache/mcp-pipe-03/container-self-hosted.log` and its status file.

The manager independently verified native cleanup against the original resource
inventory, config files, Docker context, and CPU count;
`.cache/mcp-pipe-03/environment/native-cleanup.ok` records the result.
The hosted Linux AMD64 and restoration proofs are recorded below.

### Hosted Linux AMD64 image

`pnpm run test:container:hosted` exited 0 on Linux AMD64 through Rosetta with
2 CPUs and 4 GiB. It reported 9 tests in 0 suites, all 9 passed, with zero failed,
cancelled, skipped, or todo tests. Duration was 1117.180 seconds, about 18 minutes
37 seconds. Evidence is `.cache/mcp-pipe-03/container-hosted-rosetta.log` and its
status file, plus `hosted-image-runner.log` in the same directory.

The positive image's inner `build:hosted` passed all seven phases with the same
counts as the hosted build above: 2800/19/13/16/534/137/9 tests and
194/0/0/0/44/17/1 suites. Every phase passed with zero other outcomes.
`hosted-build-live.log` preserves the positive build output streamed from
Buildx history.

The packaged proof covers image contents, native cleaner, non-root user and CA
certificates; real CLI/portal/auth/origin behavior and signup notice; public
HTTPS and controlled JavaScript rendering; private-address refusal, capacity,
cancellation and shutdown; invalid startup inputs and missing portal. Its final
deliberately failing offline check blocks image creation. That negative proof
took 312.375 seconds and passed its parent assertion; it is not a product failure.

### Environment restoration and final disposition

The runner restored original config bytes, binfmt entries, Docker context and
engine, CPU count, containers, volumes, networks, and image tags, then stopped
the VM. It exited 0 without a fallback restart. Evidence is
`.cache/mcp-pipe-03/rosetta/restoration.ok`.

The manager independently ran the external verifier named in
`.cache/mcp-pipe-03/environment/final-verifier-path.txt`. It exited 0 and matched
753 tracked non-doc implementation inputs and the exact original stopped VM
state with 4 CPUs and 4 GiB, resource inventory, and config bytes against the
pre-task snapshot. Evidence is
`.cache/mcp-pipe-03/environment/final-restoration.ok`.

The tested implementation remains `15d7c223`; the final evidence update changes
docs only. All functional proofs and restoration are complete. The manager
signed off source, tests, current docs, and retained quality dispositions.
Owner review remains pending. The repository API reports zero Actions workflows
in `.cache/mcp-pipe-03/workflows.json`. PR #160 tracks its Ready state and the
final head's checks.

### AST measurements and retained findings

The manager checked the branch against `origin/main` at `12160950` before
measurement. The default delta command failed its optional HTML comparison:
`Cannot compare code with branch or commit origin/main`; see
`.cache/mcp-pipe-03/ast-delta-default.log`. No successful HTML comparison is claimed.

Three measurements then ran `pnpm exec node script/ast-metrics-delta.ts --no-compare`.
Each exited 1 for the same four production files below 85; the three delta logs
are byte-identical. Each low-score file was inspected in every pass with
`pnpm exec node script/ast-metrics-mcp.ts file <path>`: 12 calls, all exit 0.
Logs are `ast-pass{1,2,3}-<filename>.log` under `.cache/mcp-pipe-03/`.

| File | Score | Retained design reason |
| --- | ---: | --- |
| `src/page-fetch/execute-outgoing-step.ts` | 48.2 | The 29-line executor has 7 paths and owns await, validation, cancellation, and terminal recording in `finally`. The 9-line `checkedResult` has 10 paths and snapshots required own fields, exact URL, and closed code. Shape/cancellation helpers are already separate; predicate files would add indirection without a new responsibility. |
| `src/page-fetch/fetch-page.ts` | 51.7 | The 29-line operation callback has 4 paths. It preserves guard/outgoing/fetch/process order and a fetcher-only diagnostic catch without phase flags. |
| `src/fetch-tool.ts` | 80.3 | The 17-line factory has 1 path and binds real collaborators. Reporter deduplication and startup privacy helpers have cohesive roles. |
| `src/page-fetch/step-record.ts` | 83.2 | The 7-line writer has 2 paths; the 5-line duration helper has 3. They own one best-effort bounded event. Further splitting would hide that small operation. |

`ObserveRequestStep` scored 90.0. The type-only protocol was unmeasured. No source
change was justified by the three passes. Rules and baseline remain unchanged.

The final `pnpm exec node script/ast-metrics-review.ts` exited 1 with two high,
seven medium, and five low findings. `ast-report/review.md` and
`.cache/mcp-pipe-03/ast-review-final.log` contain the full Markdown, which must
also go in the PR description. Retain the findings for these reasons:

- High: `HtmlPageProcessor` class score 73 is inherited from merged ticket 01,
  with no source diff from main. Its 6-line/2-path method and one-line constructor
  keep the size/Markdown boundary small; the
  [ticket 01 reason](mcp-pipe-01.md#ast-measurement-and-retained-findings) still applies.
- High: core integration maintainability fell from 25 to 18. Ten new cases
  prove public guards, results, and no later work through one protected boundary
  and fixture with real auth. Removing security cases or calling them unit
  tests would weaken the proof without improving the design.
- Medium: the report flags `checkedResult` at exactly 10 paths, although the
  guide describes new functions with more than 10. Retain this actual threshold
  finding explicitly. The executor's file total is 23 paths; the result-shape
  checks and terminal sequence remain bounded and cohesive as explained above.
- Medium: core factory size is 36 physical/21 logical lines. Keep its explicit
  guard/outgoing/fetch/process flow and fetcher-only report ownership.
- Medium: MCP dispatch's 47 physical/30 logical lines and auth/organization
  community grouping are inherited. The manager confirmed dispatch and
  auth/hosted-admin/organization sources have no diff from main. This ticket
  does not justify changing that existing lifecycle or collaboration graph.
- Low: composition has 16 named dependencies and core has 12, including public
  type contracts. Keep explicit collaborators; aggregate dependency bags would
  only conceal them. MCP's 14 dependencies are unchanged.
- Low: core integration's Halstead estimate rose 1.01→1.66 and operator-reader
  tests 0.35→0.47. These volume increases add exact public-boundary and event/ID
  selection proofs, not new production risk established by the estimate.

The nonzero delta and review results are not recorded as green. Function path
counts above are distinct from file totals. No baseline or rule change was made.

### Habit-hooks retained findings

Final `habit-hooks` exited 1; `.cache/mcp-pipe-03/habit-hooks-final.log` records
four existing CLI exports, 22 comment lines, and four files over 200 lines.
The snooze file remains `[]`. Each listed comment was read.

- `readyToken` and `discoverHostedAuthorization` in `script/fetch-url/helper/oauth.ts`,
  and `callbackResult` and `launchBrowser` in `script/fetch-url/helper/browser.ts`,
  are unchanged CLI exports. Their proper CLI/test boundary
  refactor is outside outgoing observation; no suppression was added.
- Composition comments explain one shared operation versus per-request servers,
  renderer report deduplication, and why raw rule-parser errors stay in causes.
  The step-writer comment explains why failed recording cannot change a result
  or repeat work. The shutdown comment explains the verifier's tool-call-only hold.
- Self-hosted comments distinguish the renderer double from an executable,
  final-host ad rules from requested-host rules, an active token after a ban
  from product access, and script reparsing that forces scan exhaustion.
- Reader and fixture comments state the three site log forms, console prefixes,
  complete tenant terminator, and production message formats. Those constraints
  explain why parsing is not a plain line-start match.
- `http-request-isolation.test.ts` and `self-hosted-fetch-tool.test.ts` remain
  cohesive edition/lifecycle acceptance proofs. The 282-line
  `test/integration/page-fetch/fetch-page.test.ts` owns one protected boundary
  with real auth; the 229-line `test/unit/page-fetch/execute-outgoing-step.test.ts` owns its result,
  record, and cancellation contract through one focused fixture. A split at
  200 lines would duplicate fixtures or add indirection without a new role.

No source change was justified by these findings. The manager confirmed the
CLI scripts are unchanged from main. This nonzero result is not a green gate.

Follow the [shared Definition of Done](mcp-pipelines-plan.md#verification-and-shared-definition-of-done)
and [test gate policy](test-gate-policy.md#required-runs), including
[suite prerequisites](test-gate-policy.md#suite-commands) and special
[focused commands](test-gate-policy.md#focused-commands). A complete final renderer
phase in `build:hosted` can supply the renderer proof without a duplicate run.
Add any further gate required by the final changed scope.

Run the current [AGENTS.md AST process](../../AGENTS.md#code-quality-review-with-ast-metrics)
on the complete candidate after docs are updated; the
[review guide](ast-metrics-review.md) gives the commands and limits. Aim for
85 in changed production files, inspect each residual, use at most three
measurement/inspection passes, and put justified residuals and full review
Markdown in the PR description. Keep rules and baseline unchanged in this slice.
