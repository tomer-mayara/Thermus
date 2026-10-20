# SEARCH-05: Public MCP search

Date: 2026-10-20.
Status: implemented; complete-candidate verification in progress.

This record covers [SEARCH-05](search-pipeline-plan.md#search-05-expose-mcp-search-with-safe-projection-and-discovery-guidance).
It continues Draft pull request 202. The comparison base is
`063404050aaf2d8989039309afc96d0308f7b318`.

## Change

The MCP server lists `search` and `getURLAsMarkdown`. Their descriptions
direct web queries to search and known page URLs to fetch. Both production
compositions pass the operation pair to the request server. No MCP lifecycle
algorithm changes.

`search-tool-schema.ts` uses `SearchQuery` for query validation and preserves
the existing reason limits. `search.ts` projects typed release or withholding
to one MCP text item. The dispatcher selects fixed safe errors and preserves
bounded renderer diagnoses from `SearchFailure`.

Search completion formatting branches before it reads arguments. Records
retain trusted identity, the operation UUID, fixed status, and duration. They
contain no query, reason, URL, page, provider response, or failure data.
Fetch result and completion contracts remain unchanged.

See the [search reference](../reference/mcp-search-tool.md) for the public
contract. SEARCH-06 still owns the pinned search runtime and live Brave proof.

## Test-first evidence

Before implementation, the existing public acceptance file failed both cases:
search was absent from discovery and its calls returned `Unknown tool`.
The new boundary test files then failed because their modules did not exist.
After those modules were added, all six schema and projection tests passed.
Existing fetch lifecycle and renderer reporting characterization passed before
the operation-pair migration.

The dispatcher tests first exposed the missing operation-pair dispatch. The
manager's review found that an error's `message` getter could change between
validation and return. A regression test reproduced the raw-text leak. Search
now reads that message once, and the focused dispatcher and formatter run
passed all 41 cases. Fetch failure mapping is unchanged.

The expanded public acceptance cases landed after dispatch was available;
their first complete run was green. No separate red run is claimed for that
expansion. A real hosted-entry success case first failed against an
unrecognized engine response; the complete captured page then made it pass.
Both actual production entry compositions now prove discovery and successful
search in both protocol eras.

The manager reviewed all four workers' changes. Review kept one hosted
capacity owner, corrected the test site's shutdown ordering, strengthened
actual-entry coverage, and updated exact discovery expectations in existing
tests. No lifecycle algorithm or authentication behavior changed.

The combined emitted focused run passed all 178 cases in five suites, with
zero failures, cancellations, skips, or todo cases. The selection included
every new or changed ordinary test file. The changed container discovery
expectation is checked separately by its dedicated gate. A prior source-only
self-hosted run could not start child CLI processes because Node's strip-only
mode rejects existing parameter properties; the emitted run passed.

## Check selection

The complete candidate changes `src/`. It selects `npm test`,
`npm run typecheck`, `npm run test:build`, and `npm run build:user-portal`.
The composition and MCP changes also select `npm run test:mcp:renderer`,
`npm run test:container`, `npm run build:hosted`, and the Linux AMD64
`npm run test:container:hosted` gate. No separate `npm run check` is added.

Hosted authentication, organization operations, signup creation, and SDK
retry configuration do not change. Their dedicated live gates are not
selected; their ordinary offline coverage remains selected.

Run habit-hooks and the complete ast-metrics process. Unit and integration
coverage are selected by the full ordinary suite. Reuse the documented local
[analyzer completeness correction](search-02.md#analyzer-completeness-correction).
Keep the installed analyzer, quality rules, baseline, and immutable records
unchanged. Keep the pull request Draft while required gates or SEARCH-06
proofs remain incomplete.

## Complete-candidate checks

`pnpm install --frozen-lockfile` passed. Commands use pnpm 12.10.1 and its
pinned Node 24.20.0. The final ordinary run passed all 5,739 backend tests in
304 suites and all 41 portal tests. It reported zero failures, cancellations,
skips, or todo cases.

The first run passed 5,736 backend tests and failed three Axiom cases because
this worktree had no `.env.local`. The main checkout had configured test
credentials. A temporary launcher outside the repository loaded only the key
and ingestion endpoint and fixed the dataset to `system-log-test`. No secret
was copied into this worktree or printed.

The next run passed the logger cases but failed two existing timing checks
while other build and analysis work competed for CPU. The MCP fake recorded
no call before its 300 ms deadline, and OAuth reached its 150 ms deadline
before the cancellation path. After the final search error-handler
simplification, the full suite ran on its own and passed all cases. The
tests, deadlines, assertions, and suite selection were not weakened.

The build-output command passed all 13 cases. Remaining gate and quality
results are recorded below after completion.

## Habit-hooks review

The complete-candidate run has no lint errors. It reports 113 retained
findings: one complexity finding, one function-size finding, 101 comment
lines, and ten file-size findings. The snooze file stays `[]`.

`projectSearchOutcome` keeps runtime validation and release projection at one
boundary. Its 11 decision paths cover the two permitted outcomes and malformed
values, including throwing getters. Splitting each guard into a helper would
hide the release rule. `createFetchToolServer` keeps request-server setup,
dispatch, completion, and lifetime registration together. The callback owns
one completion status through its `finally` block. No new dispatch framework
is needed for two tools.

Retain the flagged comments for these reasons:

| File | Reason |
| --- | --- |
| `.habit-hooks/eslint.config.mjs` | The two lines explain why container entry paths and boundary tests must agree. |
| `src/application.ts` | The comments explain environment, routing, resource ownership, rules-before-storage order, and early drain-failure observation. |
| `src/fetch-tool.ts` | The comments state shared application lifetime, warning deduplication, and native parser error containment. |
| `src/hosted-workos-application.ts` | The comments state composition boundaries, enrollment, MFA evidence, bounded retries, startup refusal, and shared grant ownership. |
| `src/mcp/fetch-tool-server.ts` | The two comments explain hostile error getters and best-effort logging. Neither failure may escape into the result. |
| `src/mcp/search.ts` | The comment explains why malformed operation access errors are replaced with fixed text. |
| `test/integration/fetch-tool-renderer-setup-report.test.ts` | The comments explain the DNS-free target and distinct process launch failures. |
| `test/acceptance/auth/self-hosted-container.test.ts` | The comments identify the dedicated gate, excluded hosted capabilities, test-only page and rules seams, browser consent, isolated Compose environment, DNS-free target, and image CA check. |
| `test/acceptance/auth/self-hosted.test.ts` | The comment explains state retained across listener port changes. |
| `test/acceptance/mcp/http-shutdown.test.ts` | The comment explains how the test holds only the intended request in verification. |
| `test/acceptance/mcp/self-hosted-fetch-tool.test.ts` | The comments identify the renderer double, final-host rules, and a ban that preserves the token for an access-resolution check. |
| `test/interface/page-fetch/pipeline-step-types.ts` | The five `@ts-expect-error` directives are executable negative type checks. |
| `test/support/hosted-live/local-https-site.ts` | The comments state certificate effects, option defaults, routing differences, ownership, cleanup order, and early drain-error observation. |
| Both work-slice entry files | The comments identify the manual entry and launcher, import guard, deliberate provider differences, and logging cleanup. |
| `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.ts` | The comments state offline proof limits, fixture provenance, trusted rules, listener identity, MFA and enrollment conditions, port selection, cleanup order, and non-JSON refusal handling. |
| `test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.test.ts` | The comments identify fixture provenance, trusted rules, listener identity, port selection, and production cleanup order. |

Retain the ten file-size findings. The lint configuration owns ordered boundary
rules; `application.ts` owns edition composition and teardown. The two
self-hosted authentication files keep their installation or image lifecycle
with the scenarios that use it. Hosted capacity keeps both tool orders and
settlement cases together. The self-hosted fetch file keeps one real provider
installation with its tool checks. The WorkOS work-slice file keeps its offline
composition and scenarios together. The MCP dispatcher specification keeps
the shared dispatch and completion contract with its tool-specific cases.
The protected-search and fetch outgoing specifications each keep one operation
or stage contract with its negative matrices. A size-only split would add
navigation without separating a new responsibility.
