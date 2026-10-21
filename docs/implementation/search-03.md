# SEARCH-03: Protected search pipeline and records

Date: 2026-10-20.
Status: core implemented; public MCP search remains open.

This record covers [SEARCH-03](search-pipeline-plan.md#search-03-implement-the-protected-search-pipeline-and-records).
Started from merged SEARCH-01 and SEARCH-02 at
`304cd24fd0f198716c372bd2ec404eeffc12a132`.

The scope is the protected `SearchPipeline`, its two local stage executors,
shared finite step IDs and record contracts, and the search-core import guard.
Check access, query, and operation ID before work. Preserve the full engine
page, apply incoming decisions before release, and record each entered stage
once without query or page data. Keep cancellation and safe renderer failure
reports distinct from provider failures.

Shared application composition and public MCP registration remain in
SEARCH-04 and SEARCH-05.

## Design and check selection

`SearchPipeline` owns access, query, and execution validation, stage order,
and the final release decision. The incoming executor receives the original
page without provider classification. A blank string can be an allowed stage
output; the pipeline then refuses it for results. Its stage record remains
allowed because that record describes the stage decision.

`SearchFailure` owns the search error vocabulary. It keeps only bounded
renderer details and an immutable public message. Its policy is local to
search: this is the second use of the mapping, so DRY3 does not call for a
shared formatter yet. Provider result validation is separate from the engine
failure handler, so malformed result data cannot produce a renderer report.

The protected pipeline specifications are integration tests. They execute
the real access guard, execution validator, and record writer with doubles
for the engine and stages. The safe error specifications are unit tests.
This placement follows the package boundaries without adding a test-only
dependency injection mechanism.

The source changes select `npm test`, `npm run typecheck`,
`npm run test:build`, and `npm run build:user-portal`. Run portal tests
separately if backend failures stop the ordinary command. The core is not
yet composed into either application. Renderer, cleaner, auth, hosted, and
container behavior is unchanged, so their dedicated runtime and production
gates are not selected for this ticket.

Run habit-hooks and the complete ast-metrics process against
`304cd24fd0f198716c372bd2ec404eeffc12a132`. Collect unit and integration
coverage because both complete groups are already selected by `npm test`.
This measures the core in the test group that executes its real shared
collaborators. Reuse the documented local analyzer correction from
[SEARCH-02](search-02.md#analyzer-completeness-correction); do not change the
installed tool, metrics rules, or baseline.

The public MCP specifications remain open until SEARCH-05. Keep this pull
request in Draft while those required cases fail.

## Test-first evidence and review

The protected public-pipeline specification first failed with
`ERR_MODULE_NOT_FOUND` because `search-pipeline.ts` did not exist. The first
implementation passed that specification. The safe failure matrix then
passed 1 of 10 cases before the bounded detail mapping, and all 10 after it.
A canonical renderer error with a throwing diagnostic getter produced a
second failure: 56 of 57 integration cases passed. The safe error boundary
then passed that case too.

The architecture specification first had two failures because concrete Brave
imports were allowed. The shared type contract rejected three search ID
assignments. After the guard and finite IDs were added, the combined fetch
and search architecture checks passed all 24 cases, and the type contract
compiled. The shared record writer and fetch executor checks passed all 78
cases, including four added record cases.

Manager review kept final release decisions in the pipeline, separated
provider result validation from renderer failure reporting, and replaced
repeated page-field checks with one fixed-field contract. It also added
coverage for malformed decisions and documents, exact argument lists, safe
reports, callback failure, and reverse completion of concurrent operations.
The concurrent case uses an explicit start barrier, without a timing guess.

The final core and safe failure checks passed all 126 cases. The manager's
combined focused run passed all 256 cases, with zero failures, cancelled,
skipped, or todo tests:

```sh
pnpm exec node --experimental-transform-types --test \
  test/integration/search-pipeline/protected-search.test.ts \
  test/unit/search-pipeline/search-failure.test.ts \
  test/unit/search-pipeline/search-query.test.ts \
  test/unit/page-fetch/execute-outgoing-step.test.ts \
  test/unit/page-fetch/execute-incoming-step.test.ts \
  test/acceptance/architecture/page-fetch-boundaries.test.ts \
  test/acceptance/architecture/search-pipeline-boundaries.test.ts
```

The manager reviewed and signed off both workers' changes.

## Complete-candidate checks

`pnpm install --frozen-lockfile` passed with pnpm 12.10.1. Commands used
Node 24.20.0 through `pnpm exec`.

| Check | Exit | Result |
| --- | --- | --- |
| Focused source checks above | 0 | All 256 cases passed, including 134 added cases. |
| `npm test` | 1 | 5,652 of 5,658 backend cases passed in 304 suites. The six failures are listed below. |
| `npm run test:user-portal` | 0 | All 41 cases passed. Run separately because backend failures stopped the ordinary command. |
| `npm run typecheck` | 0 | Backend and portal types passed, including the shared static step contracts. |
| `npm run test:build` | 0 | All 13 cases passed. |
| `npm run build:user-portal` | 0 | Passed. |
| Isolated metrics timeout diagnosis | 0 | All 16 existing cases in `ast-metrics-mcp.test.js` passed. |
| `git diff --check` | 0 | No whitespace findings. |
| Verified unit and integration coverage | 0 | All 3,961 backend unit, 23 portal unit, and 657 integration cases passed. The verified report contains 131 files from 1,146 processes. |
| `habit-hooks --branch origin/main` | 1 | Ten retained findings, explained below. No lint errors. |
| Complete ast-metrics process | 1 | All four sections completed. Architecture passed. Four file scores and 28 function identity or coverage assessments remain exceptions. No measured CRAP target miss. |

Every completed Thermus test run above had zero cancelled, skipped, or todo
tests. The ordinary suite is still a failed gate:

- Two search acceptance cases require MCP registration in SEARCH-05.
- Three logging cases require `AXIOM_API_KEY`, which is unset.
- The existing metrics timeout case expected one tool call but observed
  zero. Its 300 ms deadline includes child startup and the MCP handshake.
  All 16 cases in that file passed in isolation after the full suite. This
  supports a startup-timing diagnosis; it does not change the failed full
  suite result. The test and its deadline are unchanged.

No failing case was skipped, weakened, or changed to expect failure. The
pull request stays Draft.

## Code quality review

The production and test candidate is `557e28e9`. Later edits add only this
verification record and the generated metrics history. Coverage remains
compatible with the source, tests, and build inputs.

The complete habit-hooks run has ten retained findings. The snooze file
stays `[]`:

- Five comments are required `@ts-expect-error` assertions. They prove the
  negative type contract; removing them removes that compiler check.
- Two config comments explain why the list of standalone container scripts
  must match the import-boundary specification. They state a dependency rule
  that the file names cannot express.
- The lint config exceeds 200 lines because it holds ordered dependency
  rules. Keeping their precedence visible prevents one block from silently
  replacing another rule for the same files.
- The protected-search test file exceeds 200 lines because it holds one
  public operation contract and its private fixture. Its matrices test
  validation, decisions, records, and cancellation through that boundary.
- The fetch outgoing test file exceeds 200 lines because it holds one stage
  contract and the shared record-writer cases. A size-only split would add
  navigation without separating a responsibility.

### Maintainability and high findings

Direct inspection with `ast-metrics-mcp.ts file` confirms these file scores.
Each function has at most ten decision paths. The page-field validation was
simplified during review. Retain the remaining low scores for these reasons:

| Changed production file | Score | Reason |
| --- | --- | --- |
| `src/search-pipeline/search-pipeline.ts` | 43.2 | One owner keeps validation, stage order, final release, and cancellation at each boundary. The engine and result-validation error paths stay separate so provider data cannot produce a renderer report. |
| `src/search-pipeline/execute-incoming-step.ts` | 46.7 | Outcome validation, typed withholding, cancellation, and the single terminal record belong to one entered stage. Splitting the try/finally lifecycle would hide its record invariant. |
| `src/search-pipeline/search-failure.ts` | 47.6 | Fixed detail allowlists and bounds form one public error policy. Small named functions separate the diagnostic categories. A file split or generic formatter would obscure this safety boundary. |
| `src/search-pipeline/execute-outgoing-step.ts` | 48.2 | Exact query validation, refusal, cancellation, and one terminal record belong to the outgoing role. Its checks are local because search has its own error contract. |

The shared `pipeline-step.ts` contains type declarations and is not measured.
The high review findings for the new search pipeline and failure class are
covered by the reasons above; class scores differ from file scores. The nine
other high findings are retained for these design reasons:

| File | Reported score | Reason |
| --- | --- | --- |
| `src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts` | 63 | One converter owns ordered sanitization, extraction, and reports; its preservation setting changes document preparation. |
| `src/html-cleaner-pipeline/html-to-markdown/prepare-html-document.ts` | 59 | Parsing, normalization, and library workarounds share one document lifecycle; keep the full-document safety context together. |
| `src/page-fetch/fetch-failure.ts` | 71 | The immutable public message and bounded detail allowlists form one error boundary. |
| `src/search-engine/search-engine-brave-http.ts` | 34 | One provider owns the fixed request, bounds, destination checks, and strict supported DOM grammar. Those refusals must stay explicit. |
| `src/search-pipeline/search-query.ts` | 65 | The small class owns bounded Unicode validation and exact read-only text. Its early scalar bound uses constant space. |
| `src/website-fetcher/fetch-diagnostic.ts` | 81 | Fixed code lists and field bounds keep request data out of diagnostic records. |
| `src/website-fetcher/network-policy.ts` | 61 | DNS waits, timers, late completion, and abandoned-work protection share state and must keep one owner. |
| `src/website-fetcher/website-fetcher-lightpanda.ts` | 71 | Rendering, readiness, cancellation, child completion, and release need one lifecycle owner. |
| `src/website-fetcher/website-fetcher.ts` | 80 | This module groups the small public page, renderer, and canonical failure contracts. Splitting their constructors adds navigation without removing a rule. |

The new incoming executor's method-length findings describe the same single
stage lifecycle. The new failure file's aggregate complexity comes from the
separate bounded diagnostic categories. The core's coupling consists of
public role contracts, shared execution helpers, and local modules. The
architecture acceptance cases prove that concrete implementations cannot
enter those imports. These medium and low findings need no extra layer.

### Function assessment limits

All four new source files are additions in Git. The analyzer conservatively
marks their 28 function identities as unknown. The table below records each
score or bound, path count, and coverage. Retain the identity exception for
each row: the comparison does not establish declaration correspondence.
No measured score misses either numeric CRAP target.

Two rows also lack a coverage match: the page-field callback and the public
message getter. The integration and unit cases execute them, but that does
not establish a numeric analyzer match. Keep their reported lower bounds
and unknown coverage; do not substitute an inferred score. The process has
no operational failure, and no coverage report was edited.

| File | Function | Change | Paths | Coverage | CRAP | To do |
| --- | --- | --- | --- | --- | --- | --- |
| src/search-pipeline/search-failure.ts | failureDetail | unknown | 10 | 94.5% | 10.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/execute-incoming-step.ts | executeIncomingStep | unknown | 10 | 99.7% | 10.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/execute-incoming-step.ts | checkedResult | unknown | 10 | 100% | 10.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/execute-outgoing-step.ts | checkedResult | unknown | 10 | 100% | 10.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-pipeline.ts | checkedDocument | unknown | 9 | 100% | 9.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/execute-outgoing-step.ts | executeOutgoingStep | unknown | 7 | 99.6% | 7.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-failure.ts | exitedProcessDetail | unknown | 5 | 100% | 5.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-failure.ts | httpFailureDetail | unknown | 5 | 100% | 5.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-failure.ts | interruptedProcessDetail | unknown | 5 | 100% | 5.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-failure.ts | rendererDetail | unknown | 5 | 100% | 5.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-pipeline.ts | search-pipeline\SearchPipeline.search | unknown | 5 | 100% | 5.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/execute-incoming-step.ts | isResultObject | unknown | 4 | 100% | 4.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/execute-outgoing-step.ts | isResultObject | unknown | 4 | 100% | 4.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-pipeline.ts | isPage | unknown | 4 | 100% | 4.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-pipeline.ts | search-pipeline\SearchPipeline.searchDocument | unknown | 4 | 100% | 4.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-pipeline.ts | throwIfCancelled | unknown | 4 | 100% | 4.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/execute-incoming-step.ts | isIncomingBlockCode | unknown | 3 | 100% | 3.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-failure.ts | destinationFailureDetail | unknown | 3 | 100% | 3.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-failure.ts | launchDetail | unknown | 3 | 100% | 3.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-pipeline.ts | safeSearchFailure | unknown | 3 | 100% | 3.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/execute-incoming-step.ts | throwIfCancelled | unknown | 2 | 100% | 2.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/execute-outgoing-step.ts | throwIfCancelled | unknown | 2 | 100% | 2.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-failure.ts | safeFailureDetail | unknown | 2 | 100% | 2.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-failure.ts | search-failure\SearchFailure.constructor | unknown | 2 | 100% | 2.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-pipeline.ts | (anonymous) | unknown | 2 | unknown | ≥ 2 | no coverage data; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-pipeline.ts | checkedQuery | unknown | 2 | 100% | 2.0 | ok; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-failure.ts | search-failure\SearchFailure.publicMessage | unknown | 1 | unknown | ≥ 1 | no coverage data; identity unknown: cannot classify the new-function target |
| src/search-pipeline/search-pipeline.ts | search-pipeline\SearchPipeline.constructor | unknown | 1 | 100% | 1.0 | ok; identity unknown: cannot classify the new-function target |

### Commands and history

The complete runs use the same base and the locally corrected analyzer
documented in SEARCH-02. The binary and saved patch hashes were verified
against that record. The installed analyzer, metrics rules, and baseline are
unchanged.

```sh
pnpm exec node script/code-quality/ast-metrics-coverage.ts \
  --suite unit --suite integration

PATH="$PWD/ast-report/search-02-tooling/0.43.1-search02-anonymous-fix/bin:$PATH" \
  pnpm exec node script/code-quality/ast-metrics-process.ts \
  --base 304cd24fd0f198716c372bd2ec404eeffc12a132 --allow-tool-version
```

The first complete process wrote the immutable base record
`docs/metrics/2026-10-20-304cd24f.json`, with SHA-256
`7191f52971a5a16eef92b641b29e75bc0a28d3861e617fa99fd95eeef8985ab4`.
That record is committed without edits. Existing history records are
unchanged. After this document update, the final process reuses verified
coverage. The pull request description includes the complete final
`ast-report/process.md` without changes, including all graphs, legends,
import evidence, and notices.
