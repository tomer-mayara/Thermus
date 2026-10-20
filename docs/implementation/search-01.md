# SEARCH-01: query and document contracts

Date: 2026-10-20.
Status: contracts implemented and reviewed; public search acceptance remains open.

This record covers [SEARCH-01](search-pipeline-plan.md#search-01-define-the-query-and-document-contracts).
The [draft pull request](https://github.com/tomer-mayara/Thermus/pull/200)
stays open. The public search flow is not implemented in this ticket.

## Changes

- `src/search-pipeline/search-query.ts` exports `SEARCH_QUERY_MAX_SCALARS`
  and the pure `isValidSearchQuery` predicate. It accepts nonblank strings of
  1 to 512 well-formed Unicode scalar values. Counting stops when the limit
  is exceeded, before any full-string checks. Accepted text is not changed.
- `src/search-engine/search-engine.ts` defines `SearchDocument` with the
  original `WebsiteFetchResult` and `results` or `no_results`. `SearchEngine`
  accepts the query and an `AbortSignal` and returns `Promise<SearchDocument>`.
- Unit cases cover scalar boundaries, supplementary characters, whitespace,
  non-string values, and invalid surrogate sequences. Static interface
  fixtures check page fields, classifications, arguments, and the Promise
  return contract.
- The public MCP specification uses the existing authenticated transport and
  site. It requires search discovery, argument schema limits, and the fixed
  invalid-arguments result. No fake search handler was added.

The Brave adapter, protected orchestration, MCP schema and dispatch, shared
capacity, and runtime proof remain in SEARCH-02 through SEARCH-06. The
existing fetch-only site cannot yet control search engine outcomes. Additional
absence, provider-failure, processing-failure, and withholding scenarios need
the real search composition from those tickets.

## Test-first evidence

| Step | Command | Observed result |
| --- | --- | --- |
| Public BDD first | `pnpm run build && pnpm exec node --test dist/test/acceptance/mcp/search-pipeline.test.js` | Build passed; both cases failed. Discovery lacks `search`, and calls return `Unknown tool` instead of the specified tool result. |
| Query tests before implementation | `pnpm exec node --test test/unit/search-pipeline/search-query.test.ts` | Failed with `ERR_MODULE_NOT_FOUND` because the validator did not exist. |
| Query implementation | `pnpm run build && pnpm exec node --test dist/test/unit/search-pipeline/search-query.test.js` | Build and all 27 query cases passed. |
| Static contract proof | `pnpm exec tsc --noEmit` | Passed, including the expected type errors for invalid document and engine contracts. |
| Public specification after contracts | `pnpm exec node --test dist/test/acceptance/mcp/search-pipeline.test.js` | The same two cases remain red. No test was skipped or changed to expect the missing tool. |

The invalid-argument case stops at its first unknown-tool response. Its later
argument examples are specified but cannot be verified until search dispatch
exists. The query unit matrix verifies the validator independently.

## Check selection

The candidate adds production files under `src/`, so the
[test gate policy](test-gate-policy.md) selects `npm test`,
`npm run typecheck`, `npm run test:build`, and `npm run build:user-portal`.
If the expected backend acceptance failures stop `npm test` before portal
tests, run `npm run test:user-portal` to finish that selected part.

The new contracts are not wired into an application. This ticket changes no
renderer, cleaner, server composition, auth, portal, or container behavior.
The dedicated renderer, container, hosted build, and live-provider gates are
not selected for this candidate. Their search coverage remains in later
tickets.

Run `habit-hooks` and the ast-metrics process with unit coverage on the complete
candidate. The ordinary suite remains a failed gate while public search
acceptance is red; this work must not go Ready or merge in that state.

## Complete-candidate results

| Check | Result |
| --- | --- |
| `npm test` | Failed: 5,444 of 5,449 backend tests passed. The two new public search cases fail because the tool does not exist yet. Three existing logging cases fail because `AXIOM_API_KEY` is unset. No tests were skipped. |
| `npm run test:user-portal` | All 41 cases passed. Run separately because the backend failures stopped `npm test` before this selected part. |
| `npm run typecheck` | Passed, including backend static contract fixtures and portal types. |
| `npm run test:build` | All 13 cases passed. |
| `npm run build:user-portal` | Passed. |
| `habit-hooks --branch origin/main` | Completed with 12 comment findings. The disposition below retains each compiler directive; the snooze file stays empty. |
| `pnpm exec node script/code-quality/ast-metrics-process.ts --collect-coverage` | All four sections completed. Coverage passed: 3,855 backend unit cases and 23 portal unit cases. The process exited 1 for the recorded maintainability and identity findings below. Architecture passed. |

The logging tests require a real Axiom export, as the test gate policy states.
No credentials, fake exports, skipped cases, or changes to those tests were
introduced. This failed gate must be resolved before Ready.

All 12 habit-hooks findings are `@ts-expect-error` directives in
`test/interface/search-engine/search-engine-types.ts`, at lines 12, 14, 16,
18, 20, 31, 33, 35, 37, 39, 44, and 49. Each directive makes one invalid
contract fixture compile. TypeScript fails if the expected error disappears.
Keep them as executable compiler annotations.

## Code-quality review

The first ast-metrics process stopped in delta because its native comparison
could not check out `origin/main` with the uncommitted candidate. The review
guide documents this restriction. After commit `6f25b21f`, the comparison and
all four sections completed against the same base,
`0524a43646886f143ddf707bfb73d2157085649a`. This resolved the tool failure.

The validator file has maintainability 66.2, below the goal of 85. Direct
inspection with `ast-metrics-mcp.ts file` reports one nine-line function
with five decision paths. Keep the implementation: each step enforces a
different rule, counting stops at 513 code points, and the remaining checks
run only on bounded text. The loop uses constant space. A full array conversion
would need another bound, and a counting regular expression would hide the
scalar rule. Helper functions would add indirection to this small predicate.
The manager and implementation author reviewed these alternatives and found
no useful simplification. No code change or repeated measurement cycle was
needed for this finding.

The validator has measured coverage of 100% and CRAP 5.0. The tool classifies
its identity as `unknown`, so its new-function assessment remains a goal miss.
Git shows that the function is new. Its measured score meets both numerical
goals, below 30 and at most 15. Retain the identity finding as a tool
correspondence limit; do not change the report or rewrite the predicate to
change its classification. The interface-only engine file has no measured
maintainability or runtime function.

The review also reports five high findings in fetch files outside this code
change. Each was read and retained for the following design reason:

| File and reported score | Reason to retain |
| --- | --- |
| `src/page-fetch/fetch-failure.ts`, 71 | The public error class and its fixed detail allowlists form one boundary. Keeping the guards and mappings together makes the permitted output clear. |
| `src/website-fetcher/fetch-diagnostic.ts`, 81 | The process and renderer field checks produce the same diagnostic contract. Their explicit field bounds and fixed code lists make the logging boundary reviewable. |
| `src/website-fetcher/network-policy.ts`, 61 | One owner tracks each DNS wait, timer, cancellation, and late completion. Splitting those callbacks would spread the state needed to refuse further work while a native lookup remains pending. |
| `src/website-fetcher/website-fetcher-lightpanda.ts`, 71 | The renderer lifecycle keeps process completion, cancellation, readiness limits, and resource release together. The separate flags guard different races; extracting them only to improve the score would obscure that ownership. |
| `src/website-fetcher/website-fetcher.ts`, 80 | The small module groups the public page, fetcher, and error contracts. Splitting the error constructors would add navigation without removing a distinct rule. |

No metrics rules or baseline changed. Keep the generated base record,
`docs/metrics/2026-10-19-0524a436.json`, without edits. The final process run
reuses the compatible unit coverage because only documents change after this
review. The pull request includes the complete process report without edits,
including its goal misses, graphs, legends, and evidence limits.

## Manager review

The manager reviewed the delegated implementation, static fixtures, test
results, and quality findings. The query and document contracts meet the
SEARCH-01 contract requirements. This sign-off covers those contracts only.
The public acceptance flow and the ordinary test gate remain open, so the
pull request stays in Draft and must not merge.
