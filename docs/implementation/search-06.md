# SEARCH-06: Pinned search runtime and delivery gates

Date: 2026-10-20.
Status: local runtime and live Brave proofs passed; final delivery checks in progress.

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
| `npm run test:mcp:search:live` | One real MCP test passed, as recorded above. |

The Linux AMD64 hosted image gate and fresh coverage are still running.
Final quality evidence will follow their results.

The first fresh coverage run passed all 3,988 backend unit tests, then refused
to write coverage because the manager edited fixture documentation during
capture. Its input fingerprint correctly detected the change. The replacement
capture holds all repository inputs fixed; no coverage data is edited or
reconstructed.

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
