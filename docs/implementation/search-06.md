# SEARCH-06: Pinned search runtime and delivery gates

Date: 2026-10-20.
Status: implementation and local verification complete; owner review and merge pending.

This record covers [SEARCH-06](search-pipeline-plan.md#search-06-prove-the-pinned-runtime-and-select-the-delivery-gates)
and continues pull request 202. The complete-candidate comparison base is
`063404050aaf2d8989039309afc96d0308f7b318`. The branch includes that main
update. The manager reviewed and signed off all three workers' changes.

## Change

The renderer gate and hosted offline build now select both fetch and search
runtime files. Hosted build also selects the public search, shared capacity,
and search lifecycle acceptance files. A separate `test:mcp:search:live`
command selects only the real Brave proof. Ordinary and offline gates do not
select the live file.

The search runtime uses a complete local page whose JavaScript creates the
supported Brave structures. A test-only `WebsiteFetcher` transport sends the
canonical Brave request to that local fixture, then returns canonical metadata
with the original rendered HTML. The real provider classifier, production
cleaners, and MCP tool projection run. The test checks safe titles, links,
snippets, order, relative links, full-document input, no-results, withholding,
and unsupported-page refusal. The transport uses the existing isolated
loopback permission; production gets no endpoint override or network bypass.

Three proof files now share `test/support/processes/pinned-renderer.ts`.
This removes the third copy of the pinned-version check. The setup acceptance
matrix tests all three files with missing, relative, absent-file, and wrong-
version settings. Network access is denied during these checks. No invalid
setup may start a public request, pass, skip, or remain as todo.

## Test-first evidence and provider correction

The package selection specification first failed both cases because search
runtime and live commands were absent. After script changes, both cases passed.
The new local runtime cases passed on their first run against existing product
behavior; no separate feature-red run is claimed for them.

The first real MCP proof failed at `2026-10-20T23:00:11.295Z`. It returned
`Search failed`, with one allowed outgoing stage, no incoming stage, and one
correlated `search_failed` completion. No renderer error was reported. That
evidence alone did not identify a challenge or HTTP 429.

One diagnostic request at `2026-10-20T23:02:00.483Z` found a valid results
page with 18 web cards. Seventeen had the generic description. One YouTube
card used a direct video-description element. The old classifier required
the generic description on every card, so it rejected the page.

The original 241,431-byte rendered response is saved unchanged, with capture
metadata and an 18-result expectation file. The
[fixture notes](../../test/support/fixtures/search-engine/README.md#captured-results-with-a-video-description)
record its provenance. A public MCP regression first reproduced the failure
offline. The focused video unit cases then had two expected positive failures
and 13 passing refusals before the production change.

The fix adds only the observed direct video-description selector. It still
requires a nonblank title, destination, and description. Publication metadata,
missing or wrong macro markers, missing or blank descriptions, wrong placement,
and mixed pages with an unsupported card still fail. It does not discard a
bad card or accept arbitrary `.content` elements. The public regression proves
that all 18 cleaned links, titles, descriptions, and their order survive.

The provider, full-page cleaning, and public search selection passed 99 tests.
The local fetch runtime, search runtime, and shared setup selection passed 18
tests. Both runs had zero failures, cancellations, skips, or todo cases.

## Dated live MCP proof

The corrected live proof passed at `2026-10-20T23:06:10.995Z` on macOS ARM64.
It used Lightpanda **1.0.0**, with executable SHA-256
`955440053a84754dd64c62f970449a56a2b350cdf43ea5f2e809a73047b8173d`.
Both version output and hash were checked before the requests.

```sh
LIGHTPANDA_BIN=/Users/tomermayara/git/Thermus/.cache/lightpanda/1.0.0/lightpanda \
  pnpm exec npm run test:mcp:search:live
```

The command built the backend, ran one test, and exited 0. It used the real
self-hosted composition, a local Better Auth account and token, the real Brave
HTTP adapter, renderer, classifier, cleaners, and MCP client. No provider or
renderer double, endpoint substitution, altered network rule, or challenge
bypass was used. There was one MCP search request after the classifier fix.

Query: `Lightpanda browser`. Result: one successful Markdown text item with
27,132 characters, useful external result titles, destination links, and
snippet text. Both stages were allowed. One completion had status `success`
and operation ID `3afabe09-43b9-432d-9a68-b0883308cca3`; both stage records
used that ID. Completion fields contained no query, reason, page, or URL.
There were no renderer error records.

The [saved live result](search-06-live-result.json) retains the complete MCP
result and correlated records. This proves that this dated call passed. It
does not guarantee later provider access, ranking, or page structure. A live
empty-results response remains unverified; the no-results contract is covered
by its documented controlled fixture.

## Acceptance coverage

| Criteria | Evidence |
| --- | --- |
| AC1: public flow | Public search and actual production-entry tests cover both editions and protocol eras. The local and live runtime files reach the MCP tool result. |
| AC2: validation before work | Query unit tests, schema integration, protected search integration, and public invalid-argument cases cover bounds, Unicode, exact text, access, and operation IDs. |
| AC3: stage decisions | Protected search integration checks refusal, changed query, malformed outcomes, failures, and no repeated provider work. |
| AC4: final decision | Protected search and public/runtime cases check nonblank results, no-results, withholding, cancellation, and invalid classifications. |
| AC5: provider boundary | Provider unit tests cover URL encoding, final destinations, bounded HTML/depth, ambiguous shapes, and the observed generic and video descriptions. |
| AC6: safe fidelity | Full captured-page cleaning and public regressions preserve safe expected results. Runtime checks include JavaScript output, hidden content, unsafe links, and canonical relative links. |
| AC7: cancellation and ownership | Shared composition, DNS, public lifecycle, and existing pinned fetch runtime tests cover cancellation, shutdown, context isolation, and renderer cleanup. |
| AC8: hosted capacity | Shared owner unit tests and public hosted acceptance cover both tool orders, incoming work, cleanup, cancellation, failure, and recovery. |
| AC9: safe records and failures | Dispatcher, formatter, protected pipeline, public/runtime, and live checks verify records and safe results. Existing fetch regressions remain selected. |
| AC10: executable gates | Both local runtime files and the separate dated live MCP proof pass. Final complete-candidate delivery results follow below. |

## Complete-candidate check selection

The complete pull request changes `src/`. Select `npm test`,
`npm run typecheck`, `npm run test:build`, `npm run build:user-portal`,
`npm run test:mcp:renderer`, `npm run test:container`, `npm run build:hosted`,
and the Linux AMD64 `npm run test:container:hosted` gate. The live search
proof is selected separately. Do not add another `npm run check` run.

Hosted authentication, organization operations, signup creation, and SDK
retries do not change; their dedicated live gates are not selected. Their
ordinary offline proofs remain in the selected full suite. The edited test
inventory's existing script README contract is included in that suite.

Run habit-hooks and the full ast-metrics process with the same base. Both
unit and integration suites are selected, so their coverage can be collected.
Reuse the documented SEARCH-02 analyzer correction; do not change rules,
baseline, coverage data, or existing immutable history records.

## Complete-candidate results

The source and test candidate is `85817282`. Later document edits record
evidence only. Commands use pnpm 12.10.1 and its pinned Node 24.20.0.
The ordinary suite passed on its first run for this candidate. Its temporary
launcher outside the repository loaded only the existing Axiom test key and
endpoint from the main checkout and fixed the dataset to `system-log-test`.
No secret was copied into this worktree or printed.

| Check | Result |
| --- | --- |
| Provider, full-page cleaning, and public search selection | 99 tests passed. |
| Fetch runtime, search runtime, and setup selection | 18 tests passed. |
| `npm test` | 5,759 backend and 41 portal tests passed; zero failures, cancellations, skips, or todo cases. |
| `npm run typecheck` | Passed. |
| `npm run test:build` | 13 tests passed. |
| `npm run build:user-portal` | Passed. |
| `npm run test:mcp:renderer` | 13 tests passed. |
| `npm run test:container` | 13 tests passed. |
| `npm run build:hosted` | Passed all selected offline stages: 3,988 backend unit, 23 portal unit, 13 build, 18 portal acceptance, 685 integration, 188 selected acceptance/interface, and 13 runtime tests. |
| `npm run test:container:hosted` | Nine checks passed, including Linux AMD64 rendering, TLS, capacity, shutdown, and refusal to create an image after an offline test fails. |
| `npm run test:mcp:search:live` | One real MCP test passed, as recorded above. |
| README and test-inventory contract | 18 existing tests passed after the documentation update. |
| Unit and integration coverage | 3,988 backend unit, 23 portal unit, and 685 integration tests passed; verified capture for 133 files from 1,154 processes. |

All selected test and build gates passed. The hosted image build also passed
all 13 pinned fetch and search runtime cases on Linux AMD64 with network
access disabled. The final image passed its seven runtime checks. The last
check inserted one failing test into a private copy and verified that the
failure prevented image creation. The outer gate exited 0 with nine passes
and zero failures, cancellations, skips, or todo cases.

The first fresh coverage run passed all 3,988 backend unit tests, then refused
to write coverage because the manager edited fixture documentation during
capture. Its input fingerprint correctly detected the change. The replacement
capture passed with all repository inputs held fixed. No coverage data was
edited or reconstructed.

## Habit-hooks review

The complete-candidate run reports no lint errors and 135 retained findings:
two complexity findings, one function-size finding, 120 comment lines, and
12 file-size findings. The snooze file stays `[]`.

The 113 earlier findings keep their reasons in
[SEARCH-05](search-05.md#habit-hooks-review). The additional complexity finding
is `SearchEngineBraveHttp.isNoResults`, whose body is unchanged. Its 15 paths
check one strict absence grammar, including conflicting result markers and
banner branches. Keep these checks together so a partial banner cannot become
a false no-results response.

Retain the 19 additional comment lines for these reasons:

| File | Reason |
| --- | --- |
| `test/acceptance/mcp/get-url-as-markdown.runtime.ts` | The 14 lines state gate prerequisites, real authentication, renderer-child observation, telemetry isolation, and legacy shutdown ownership. |
| `test/acceptance/mcp/renderer-gate-setup.test.ts` | One line explains why the child must not inherit `NODE_TEST_CONTEXT`. |
| `test/acceptance/mcp/search-pipeline.live.ts` | Two lines state the separate gate selection and the single public request without fallback. |
| `test/acceptance/mcp/search-pipeline.runtime.ts` | Two lines state the dedicated selection and the canonical transport's test-only scope. |

Retain the two additional file-size findings. The existing fetch runtime keeps
nine related cases with their authentication, renderer, and shutdown lifetime.
Its third repeated pin check was extracted into the shared setup helper. The
provider unit file keeps the public provider contract and independent refusal
matrix together, including the observed video shape. A split based only on
line count would not separate another responsibility.

## Code quality review

All comparisons use `063404050aaf2d8989039309afc96d0308f7b318`.
The complete process finished delta, review, CRAP, and architecture. Delta,
review, and CRAP report the exceptions below; architecture passes. There are
15 high, 18 medium, and six low review findings. The command exits 1 for these
retained exceptions. This is not an all-green quality result. Operational
failures are not accepted as exceptions.

### Maintainability and high findings

All 13 production files below 85 have direct `ast-metrics-mcp.ts file`
inspection. The 12 unchanged files retain their SEARCH-05 inspection and
reasons. The provider was inspected again. Its file score is 34.2, with 55
paths across 12 functions. The changed `isWebResult` has seven paths, 100%
measured coverage, and CRAP 7.0. The selector adds no decision path. The
largest provider function is the unchanged 15-path no-results validator.
Keep these file-score exceptions:

| Production file | Score | Reason |
| --- | --- | --- |
| `src/search-engine/search-engine-brave-http.ts` | 34.2 | One provider owns the fixed request, size and depth bounds, canonical destination, and supported DOM grammar. Keep strict refusals together; the change adds only the observed description selector. |
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

The capacity class and two search classes account for three of the 15 high
review findings. Their reasons are above; class and file scores differ.
Keep the other 12 high findings for these reasons:

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
| `test/acceptance/mcp/renderer-gate-setup.test.ts` | 65 to 53 | One shared launcher and invalid-setup matrix cover all three gates. Two script-selection cases keep live traffic out of ordinary and offline commands. These cases own one gate contract; no further helper or split is needed. |
| `test/acceptance/mcp/search-pipeline.test.ts` | 55 to 28 | Keep the edition-by-era matrix, public refusals, and observed full-page video regression with one protocol driver. The new case proves that all 18 results survive the public flow. Each case checks an observable contract; splitting by score would add navigation. |
| `test/integration/mcp/fetch-tool-server.test.ts` | 28 to 20 | Fetch regressions, search outcomes, and private completion share one dispatcher interface. Detailed negative cases belong at this boundary and stay independent. |

The medium and low findings concern these same validation, composition,
lifetime, and test responsibilities. The dispatcher has ten paths and 99.6%
coverage; the outcome projection has 11 paths and 100% coverage. Their measured
CRAP scores are 10.0 and 11.0. No framework is added to reduce file coupling
or move a decision out of the report.

### Function assessment limits

The unedited process report in the pull request gives each function's
classification, paths, coverage, score or lower bound, and required action.
There are zero measured target misses, 36 functions without a coverage match,
and 68 required functions with unknown assessment or identity. A lower bound
is not a measured score or a pass. Keep each unknown row for the reasons below.

| Report rows | Reason |
| --- | --- |
| All measured unknown-identity rows in the four new search-pipeline files | The analyzer does not establish declaration identity against the base. Each measured score meets both numeric targets, but that does not repair its identity evidence. Keep the reported classification. |
| `projectSearchOutcome`, MCP `safeSearchFailure`, and `parseSearchToolArguments` | The new boundary functions measure 11.0, 9.0, and 3.0, with 11, nine, and three paths and 100%, 98.9%, and 100% coverage. Their declaration identity remains unknown to the analyzer. |
| `createToolOperations`, `createHostedToolOperations`, and `OperationCapacity.wrap` | The new factories and wrapper each measure 1.0 at one path and 100% coverage. The analyzer cannot establish declaration identity. |
| The 18 anonymous rows in `application.ts` and three in `hosted-workos-application.ts` | Their bodies are unchanged by this PR. Keep unknown identity, unknown coverage, and the bounds reported for paths one, two, four, and seven. |
| The five anonymous rows in `fetch-tool.ts` | The three-path cleaner callback and existing record and renderer-report callbacks retain their bodies. The search binding is new, and the server-builder callback now passes both operations. These anonymous functions lack a coverage match; their one- or three-path bounds cannot replace a measured score. |
| The two anonymous rows in `mcp/fetch-tool-server.ts` | The discovery callback now lists both tools; the request-lifetime callback is unchanged by this PR. Both have one path and unknown coverage. Interface and acceptance tests exercise these contracts, but cannot supply the analyzer's missing match. |
| The five unnamed `SearchEngineBraveHttp` rows | These callback bodies are unchanged by this PR. They have one or three paths, unknown identity and coverage, and lower bounds of at least one or three. Keep each reported unknown; passing provider tests do not establish a missing analyzer match. |
| The anonymous search-pipeline row, capacity callback, and `SearchFailure.publicMessage` getter | These new members have two, two, and one paths, unknown coverage, and bounds of at least two, two, and one. Behavior tests cover their public contracts; the analyzer cannot match these members to coverage. Keep each unknown assessment. |

Named unchanged functions keep the reason `unchanged by this PR` in the full
report. No coverage was edited or inferred from passing tests. The type-only
pipeline-step file and removed single-fetch wrapper have no measured file
score; this is not a missing production implementation.

### Commands and history

The fresh coverage is verified compatible with the complete candidate. The
analyzer is the local `0.43.1-search02-anonymous-fix` documented in
[SEARCH-02](search-02.md#analyzer-completeness-correction). Its binary SHA-256
is `f834fbf0587bbfff3e25da094965d2d4c0faabe49247dec30dcc74a8a13ad115`.
The correction patch SHA-256 is
`a75412fe6c1cf3b22f8bdcdc5c55677f2abb3f4a7a07b48c2ed58b5ff502c0e6`.
Both hashes were checked. Rules, baseline, and the installed analyzer stay
unchanged. No coverage report is edited.

```sh
pnpm exec node script/code-quality/ast-metrics-coverage.ts \
  --suite unit --suite integration

PATH="$PWD/ast-report/search-02-tooling/0.43.1-search02-anonymous-fix/bin:$PATH" \
  pnpm exec node script/code-quality/ast-metrics-process.ts \
  --base 063404050aaf2d8989039309afc96d0308f7b318 --allow-tool-version
```

The existing immutable records keep their checked hashes:

- `docs/metrics/2026-10-20-304cd24f.json`:
  `7191f52971a5a16eef92b641b29e75bc0a28d3861e617fa99fd95eeef8985ab4`.
- `docs/metrics/2026-10-20-06340405.json`:
  `9ee8da37d03127e9943a5f2672503258e6ef4657a5ef9a03d708fdad868836c3`.

The base record already exists; no new record is needed. The final handoff
runs the process after these document updates are committed. The pull request
description includes its complete, unedited report with all four sections,
graphs, legends, import evidence, and notices. Owner review is required before
merge under [AGENTS.md](../../AGENTS.md#pull-requests).
