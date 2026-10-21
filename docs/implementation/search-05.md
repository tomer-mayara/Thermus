# SEARCH-05: Public MCP search

Date: 2026-10-20.
Status: implemented; selected local gates passed. Quality exceptions recorded.

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

The final source and test candidate is `8c790e98`. The following checks passed
on that candidate. Later changes in this record contain evidence only.

| Check | Result |
| --- | --- |
| Combined emitted focused selection | 178 tests passed. |
| `npm test` | 5,739 backend and 41 portal tests passed. |
| `npm run typecheck` | Passed. |
| `npm run test:build` | 13 tests passed. |
| `npm run build:user-portal` | Passed. |
| `npm run test:mcp:renderer` | Nine tests passed. |
| `npm run test:container` | 13 tests passed, including the changed discovery expectation. |
| `npm run build:hosted` | Passed all offline unit, integration, portal, hosted acceptance, build, and renderer stages. |
| `npm run test:container:hosted` | Nine checks passed, including the Linux AMD64 runtime, TLS rendering, capacity, shutdown, and proof that a failed offline test prevents image creation. |
| Unit and integration coverage | 3,973 backend unit, 23 portal unit, and 685 integration tests passed; verified capture for 133 files from 1,154 processes. |
| `git diff --check` | Passed. |

The renderer gate used Lightpanda 1.0.0 with SHA-256
`955440053a84754dd64c62f970449a56a2b350cdf43ea5f2e809a73047b8173d`.
This existing fetch runtime gate does not replace SEARCH-06's search proofs.

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

## Code quality review

All comparisons use `063404050aaf2d8989039309afc96d0308f7b318`. The branch
includes that main update. The complete process finished all four sections:
delta, review, and CRAP report goal misses; architecture passes. The process
exits 1 for the retained exceptions below. This is not an all-green quality
result, and no operational tool failure is accepted as an exception.

### Maintainability and high findings

Direct `ast-metrics-mcp.ts file` inspection completed for all 12 production
files below 85. The largest function has 11 decision paths. Review removed
an unnecessary search failure wrapper before final verification. Keep these
remaining file-score exceptions:

| Production file | Score | Reason |
| --- | --- | --- |
| `src/search-pipeline/search-pipeline.ts` | 43.2 | One owner enforces validation, stage order, cancellation, and final release. Provider result checks stay separate from renderer error reports. |
| `src/mcp/fetch-tool-server.ts` | 46.6 | The dispatcher keeps one operation ID, status, cancellation signal, and completion in the same call lifetime. Separate search and fetch error policies preserve their public contracts. A two-tool registry or more wrappers would hide this flow. |
| `src/search-pipeline/execute-incoming-step.ts` | 46.7 | Validation, typed withholding, cancellation, and one terminal record belong to one entered stage. |
| `src/search-pipeline/search-failure.ts` | 47.6 | The immutable public message and bounded diagnostic allowlists form one error policy. Its category functions have at most ten paths. |
| `src/search-pipeline/execute-outgoing-step.ts` | 48.2 | Exact query checks, refusal, cancellation, and the terminal record belong to the same outgoing role. |
| `src/mcp/tool-completion-record.ts` | 55.0 | The early search branch enforces privacy before any argument access. Keep it next to the existing fetch projection so the boundary is visible. The changed formatter has five paths and 99.6% measured coverage. |
| `src/application.ts` | 56.2 | The change selects the operation-pair factory. Edition selection, route restrictions, and teardown stay visible. The changed function has one path and 100% measured coverage. |
| `src/hosted-workos-application.ts` | 63.0 | The opener selects the shared factory and retains startup order. Provider configuration and request-server ownership stay explicit. The changed opener has two paths and 93.5% measured coverage. |
| `src/mcp/operation-capacity.ts` | 65.8 | One small class owns one slot. Its wrapper checks cancellation and busy before work and releases in `finally`; another helper would obscure that invariant. |
| `src/mcp/search-tool-schema.ts` | 66.2 | One short parser applies the advertised schema and the `SearchQuery` invariant. Its three paths have 100% measured coverage. Keep validation and its fixed invalid result together. |
| `src/fetch-tool.ts` | 68.0 | One composition root shows shared resources and distinct converter settings. Both factories and the changed server builder have one path and 100% measured coverage. |
| `src/mcp/search.ts` | 75.9 | One 16-line function validates and projects the two outcomes. Its 11 paths have 100% measured coverage. Splitting individual guards would hide the release rule. |

The capacity class and two search classes account for three of the 14 high
review findings. Their reasons are above; class and file scores differ.
Keep the other 11 high findings for these reasons:

| File | Reported score | Reason |
| --- | --- | --- |
| `src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts` | 63 | One converter owns ordered sanitization, extraction, and reports; result preservation changes document preparation. |
| `src/html-cleaner-pipeline/html-to-markdown/prepare-html-document.ts` | 59 | Parsing, normalization, and library workarounds share one document lifecycle and safety context. |
| `src/page-fetch/fetch-failure.ts` | 71 | The immutable message and bounded detail allowlists form one public error boundary. |
| `src/search-engine/search-engine-brave-http.ts` | 34 | The provider owns the fixed request, bounds, destination checks, and supported DOM grammar. Those refusals must stay explicit. |
| `src/search-pipeline/search-query.ts` | 65 | This small class owns bounded Unicode validation and exact read-only text. Its early scalar bound uses constant space. |
| `src/website-fetcher/fetch-diagnostic.ts` | 81 | Fixed code lists and bounds keep request data out of diagnostic records. |
| `src/website-fetcher/network-policy.ts` | 61 | DNS waits, timers, late completion, and the abandoned-work guard share state and need one owner. |
| `src/website-fetcher/website-fetcher-lightpanda.ts` | 71 | Readiness, rendering, cancellation, child completion, and release need one lifecycle owner. |
| `src/website-fetcher/website-fetcher.ts` | 80 | The small public page, renderer, and canonical failure contracts belong together. Splitting constructors adds navigation without removing a rule. |
| `test/acceptance/mcp/search-pipeline.test.ts` | 55 to 32 | Keep the edition-by-era success matrix and public refusal cases with one fixture protocol driver. Each case checks an observable contract; splitting the specification by score would add navigation. |
| `test/integration/mcp/fetch-tool-server.test.ts` | 28 to 20 | Fetch regressions, search outcomes, and private completion share one dispatcher interface. Detailed negative cases belong at this boundary and stay independent. |

The medium and low findings concern these same validation, composition,
lifetime, and test responsibilities. The dispatcher has ten paths and 99.6%
coverage; the outcome projection has 11 paths and 100% coverage. Their measured
CRAP scores are 10.0 and 11.0. No framework is added to reduce file coupling
or move a decision out of the report.

### Function assessment limits

The unedited process report in the pull request gives each function's
classification, paths, coverage, score or lower bound, and required action.
There are zero measured target misses, 31 functions without a coverage match,
and 63 required functions with unknown assessment or identity. A lower bound
is not a measured score or a pass. Keep each unknown row for the reasons below.

| Report rows | Reason |
| --- | --- |
| All measured unknown-identity rows in the four new search-pipeline files | The analyzer does not establish declaration identity against the base. Each measured score meets both numeric targets, but that does not repair its identity evidence. Keep the reported classification. |
| `projectSearchOutcome`, MCP `safeSearchFailure`, and `parseSearchToolArguments` | The new boundary functions measure 11.0, 9.0, and 3.0, with 11, nine, and three paths and 100%, 98.9%, and 100% coverage. Their declaration identity remains unknown to the analyzer. |
| `createToolOperations`, `createHostedToolOperations`, and `OperationCapacity.wrap` | The new factories and wrapper each measure 1.0 at one path and 100% coverage. The analyzer cannot establish declaration identity. |
| The 18 anonymous rows in `application.ts` and three in `hosted-workos-application.ts` | Their bodies are unchanged by this PR. Keep unknown identity, unknown coverage, and the bounds reported for paths one, two, four, and seven. |
| The five anonymous rows in `fetch-tool.ts` | The three-path cleaner callback and existing record and renderer-report callbacks retain their bodies. The search binding is new, and the server-builder callback now passes both operations. These anonymous functions lack a coverage match; their one- or three-path bounds cannot replace a measured score. |
| The two anonymous rows in `mcp/fetch-tool-server.ts` | The discovery callback now lists both tools; the request-lifetime callback is unchanged by this PR. Both have one path and unknown coverage. Interface and acceptance tests exercise these contracts, but cannot supply the analyzer's missing match. |
| The anonymous search-pipeline row, capacity callback, and `SearchFailure.publicMessage` getter | These new members have two, two, and one paths, unknown coverage, and bounds of at least two, two, and one. Behavior tests cover their public contracts; the analyzer cannot match these members to coverage. Keep each unknown assessment. |

Named unchanged functions keep the reason `unchanged by this PR` in the full
report. No coverage was edited or inferred from passing tests. The type-only
pipeline-step file and removed single-fetch wrapper have no measured file
score; this is not a missing production implementation.

### Commands and history

The analyzer is the local `0.43.1-search02-anonymous-fix` documented in
[SEARCH-02](search-02.md#analyzer-completeness-correction). Its binary SHA-256
is `f834fbf0587bbfff3e25da094965d2d4c0faabe49247dec30dcc74a8a13ad115`.
The saved correction patch SHA-256 is
`a75412fe6c1cf3b22f8bdcdc5c55677f2abb3f4a7a07b48c2ed58b5ff502c0e6`.
Both were checked. The installed analyzer, rules, and baseline are unchanged.

```sh
pnpm exec node script/code-quality/ast-metrics-coverage.ts \
  --suite unit --suite integration

PATH="$PWD/ast-report/search-02-tooling/0.43.1-search02-anonymous-fix/bin:$PATH" \
  pnpm exec node script/code-quality/ast-metrics-process.ts \
  --base 063404050aaf2d8989039309afc96d0308f7b318 --allow-tool-version
```

The final process reuses this verified compatible coverage after the evidence
documents are complete. Its full report belongs in the pull request without
edits, including both architecture graphs, legends, import evidence, and
notices. The base record already exists. Both existing immutable records
remain unchanged:

- `docs/metrics/2026-10-20-304cd24f.json`: SHA-256 `7191f52971a5a16eef92b641b29e75bc0a28d3861e617fa99fd95eeef8985ab4`.
- `docs/metrics/2026-10-20-06340405.json`: SHA-256 `9ee8da37d03127e9943a5f2672503258e6ef4657a5ef9a03d708fdad868836c3`.
