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
