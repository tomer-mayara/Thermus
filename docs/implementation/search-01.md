# SEARCH-01: query and document contracts

Date: 2026-10-20.
Status: query-class revision implemented and tested; metrics review in progress.

This record covers [SEARCH-01](search-pipeline-plan.md#search-01-define-the-query-and-document-contracts).
The [draft pull request](https://github.com/tomer-mayara/Thermus/pull/200)
stays open. The public search flow is not implemented in this ticket.

## Changes

- `src/search-pipeline/search-query.ts` exports `SearchQuery`. Its constructor
  accepts nonblank strings of 1 to 512 well-formed Unicode scalar values and
  retains the exact text in a private field. The `value` getter is read-only.
  `SearchQuery.MAX_SCALARS` exposes the bound. Invalid input throws
  `TypeError('Invalid search query')` without including the input.
  Validation belongs to the class. Counting stops when the limit is exceeded,
  before any full-string checks. Accepted text is not changed.
- `src/search-engine/search-engine.ts` defines `SearchDocument` with the
  original `WebsiteFetchResult` and `results` or `no_results`. `SearchEngine`
  accepts query text and an `AbortSignal` and returns `Promise<SearchDocument>`.
  The engine remains independent of the pipeline package; callers can pass
  `query.value` at that boundary.
- Unit cases cover scalar boundaries, supplementary characters, whitespace,
  non-string values, invalid surrogate sequences, fixed errors, and refusal
  to overwrite the query text. Static interface
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
| Initial predicate implementation | `pnpm run build && pnpm exec node --test dist/test/unit/search-pipeline/search-query.test.js` | Build and all 27 query cases passed before the class revision. |
| Static contract proof | `pnpm exec tsc --noEmit` | Passed, including the expected type errors for invalid document and engine contracts. |
| Public specification after contracts | `pnpm exec node --test dist/test/acceptance/mcp/search-pipeline.test.js` | The same two cases remain red. No test was skipped or changed to expect the missing tool. |
| Characterization before the class revision | `pnpm run build && pnpm exec node --test dist/test/unit/search-pipeline/search-query.test.js` | All 27 existing cases passed. |
| Query-class tests before implementation | `pnpm exec node --test test/unit/search-pipeline/search-query.test.ts` | Failed because the `SearchQuery` export did not exist. The revised cases require construction, exact stored text, fixed errors, and read-only text. |
| Query-class implementation | `pnpm run build && pnpm exec node --test dist/test/unit/search-pipeline/search-query.test.js && pnpm exec tsc --noEmit` | Build, all 28 focused cases, and static type checking passed. |

The invalid-argument case stops at its first unknown-tool response. Its later
argument examples are specified but cannot be verified until search dispatch
exists. The query unit matrix verifies the class independently.

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

These results cover the query-class revision.

| Check | Result |
| --- | --- |
| `npm test` | Failed: 5,445 of 5,450 backend tests passed. The two new public search cases fail because the tool does not exist yet. Three existing logging cases fail because `AXIOM_API_KEY` is unset. No tests were skipped. |
| `npm run test:user-portal` | All 41 cases passed. Run separately because the backend failures stopped `npm test` before this selected part. |
| `npm run typecheck` | Passed, including backend static contract fixtures and portal types. |
| `npm run test:build` | All 13 cases passed. |
| `npm run build:user-portal` | Passed. |
| `habit-hooks --branch origin/main` | Completed with 12 comment findings. The disposition below retains each compiler directive; the snooze file stays empty. |
| `pnpm exec node script/code-quality/ast-metrics-process.ts --collect-coverage` | Pending for the query-class revision. |

The logging tests require a real Axiom export, as the test gate policy states.
No credentials, fake exports, skipped cases, or changes to those tests were
introduced. This failed gate must be resolved before Ready.

All 12 habit-hooks findings are `@ts-expect-error` directives in
`test/interface/search-engine/search-engine-types.ts`, at lines 12, 14, 16,
18, 20, 31, 33, 35, 37, 39, 44, and 49. Each directive makes one invalid
contract fixture compile. TypeScript fails if the expected error disappears.
Keep them as executable compiler annotations.

## Code-quality review

All comparisons use the same base,
`0524a43646886f143ddf707bfb73d2157085649a`.

The class replaces the standalone predicate at the owner's request. The
previous predicate's maintainability and function-identity findings no
longer describe the current code. Collect fresh unit coverage and measure
the class before completing this review. The interface-only engine file
has no measured maintainability or runtime function.

The previous review reported five high findings in fetch files outside this
code change. Each was read and retained for the following design reason:

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

The manager reviewed the delegated class implementation and test evidence.
The class owns validation and the unchanged text; the engine contract does
not gain a dependency on the pipeline. Metrics review is in progress.
The public acceptance flow and the ordinary test gate remain open, so the
pull request stays in Draft and must not merge.
