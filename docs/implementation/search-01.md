# SEARCH-01: query and document contracts

Date: 2026-10-20.
Status: contracts implemented; code-quality review in progress.

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

The logging tests require a real Axiom export, as the test gate policy states.
No credentials, fake exports, skipped cases, or changes to those tests were
introduced. This failed gate must be resolved before Ready.

All 12 habit-hooks findings are `@ts-expect-error` directives in
`test/interface/search-engine/search-engine-types.ts`, at lines 12, 14, 16,
18, 20, 31, 33, 35, 37, 39, 44, and 49. Each directive makes one invalid
contract fixture compile. TypeScript fails if the expected error disappears.
Keep them as executable compiler annotations.

The first ast-metrics process stopped in delta because its native comparison
could not check out `origin/main` with the uncommitted candidate. The review
guide documents this restriction. Commit the tested candidate, then run the
complete process against the same base, `0524a43646886f143ddf707bfb73d2157085649a`.
The final metrics result remains pending.
