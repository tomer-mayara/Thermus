# Search pipeline plan

Initial review: 2026-10-20, against `ec1647bb`.

**Status:** SEARCH-01 through SEARCH-09 are implemented. SEARCH-07 corrected
R1; SEARCH-08 corrected R2; SEARCH-09 addresses R3. Final qualification is in
progress in [SEARCH-09 evidence](search-09.md). Earlier test and build passes
remain evidence for their recorded inputs; they do not qualify changed inputs.
[PR 202](https://github.com/tomer-mayara/Thermus/pull/202) is Draft.
Owner review and merge remain pending.

This document owns the current design, acceptance criteria, and next steps.
The [search reference](../reference/mcp-search-tool.md) owns tool usage.
The [SEARCH-06 record](search-06.md) owns the earlier gate results and quality
exceptions; SEARCH-07 through SEARCH-09 record later checks. Passing test and build
gates does not mean that all maintainability or coverage assessments met their goals.

## Review findings

### R1: Contradictory document can report no results — medium priority

**Fixed by SEARCH-07.** At the reviewed revision, the Brave classifier checked
duplicate results sections, banners, and conflicting result markers only
inside `main#search-page`. See
[the provider](../../src/search-engine/search-engine-brave-http.ts), methods
`classify` and `isNoResults`.

A controlled reproduction starts with the documented no-results fixture and
adds a second `section#mixed-main`, with a valid web result, outside that
root. The provider returned `no_results`. A second known banner outside the
root had the same outcome. Moving the duplicate section inside the root, or
adding a second `main#search-page`, correctly failed. Ordinary footer
navigation was valid and remains valid after the fix.

The earlier record accurately describes the narrower root check. The mistake
is treating that check as sufficient for the plan's broader requirement to
refuse ambiguous pages before claiming absence. This is a reproduced
classification gap, not an observed live Brave failure.

**Correction:** SEARCH-07 checks known container and banner uniqueness across
the document, requires the results section inside the search root, and rejects
known result markers anywhere before returning no-results. Banner containment
still follows the strict fallback structure. Ordinary footer navigation and
generic footer data attributes remain valid. No new abstraction was needed.

### R2: A malformed error can escape the core's safe failure — low priority

**Fixed by SEARCH-08.** The outgoing executor, incoming executor, and protected
pipeline read `error.name` to recognize cancellation. That property can itself
throw. At the reviewed revision, a collaborator that threw such an `Error`
caused the raw getter exception to escape `SearchPipeline` in all three
positions. See
[the outgoing executor](../../src/search-pipeline/execute-outgoing-step.ts),
[the incoming executor](../../src/search-pipeline/execute-incoming-step.ts),
and [the pipeline](../../src/search-pipeline/search-pipeline.ts).

The MCP boundary caught this and returned fixed safe text. No MCP content leak
was demonstrated. The new public regression also shows that outgoing and
engine failures received the generic processing-failure status. The fixed
core now preserves each boundary's expected message and status.

**Correction:** The three search paths share one small safe cancellation
check. An aborted signal wins before error inspection; the check also observes
an abort caused during inspection. An unreadable name or prototype falls back
to the boundary's fixed failure. A narrow guard protects the engine's existing
renderer-report classification too. Stage outcomes and recording stay local.

### R3: Proof claims need more precise ownership

**Addressed by SEARCH-09.** At review, some assertions proved less than their summaries:

- The live test found an external result link and a relevant paragraph
  independently. It did not prove that the paragraph described that result.
- Incoming withholding and malformed-outcome cases did not all assert that
  the engine ran exactly once. The ordinary incoming-exception case did.
- The edition-by-era matrix checks destination strings; the captured-page
  integration, video regression, and runtime cases check actual Markdown
  links. Fidelity is supported by their combined evidence, not by each matrix
  case alone.
- The runtime guide used a pending AMD64 rendering statement. The
  [RHD-03 record](rhd-03.md) and SEARCH-06 record contain successful image
  rendering results. The guide now states that completed evidence directly.

These were proof and documentation gaps, not demonstrated wrong search output.
SEARCH-09 adds exact call counts to existing cases and requires a description
in the result paragraph or the immediately following paragraph. It refuses
ambiguous title blocks and does not cross another result or section boundary.
Controlled cases reject detached footer text and another result's description.
Current references name each proof's scope. Historical records stay intact;
the new record owns the separate live result and final selected checks.

### Known limits, not new defects

- The no-results fixture is derived from a captured page and Brave's fallback
  component. It is not an authentic empty response. The full incoming flow is
  tested for that supported structure; current live empty-results behavior
  remains unverified. The [fixture notes](../../test/support/fixtures/search-engine/README.md)
  describe its origin and limits.
- Dated real self-hosted MCP searches passed with Lightpanda 1.0.0 in
  SEARCH-06 and SEARCH-09. The latest call, at 2026-10-21 01:22:51 UTC,
  passed the stronger result/description assertion. These calls do not prove
  sustained access, every query, a live hosted search, or every future layout.
- Public Brave can return a challenge, rate limit, or changed page. HTTP
  access is not a guarantee against blocking. Unsupported responses fail.
- Full-page conversion can include page context. Captured fixtures prove
  safe result fidelity for their shapes. A nonblank runtime check cannot
  prove completeness on every unseen page.
- Quality exceptions remain in the dated verification records. Unknown coverage
  assessments are not passing assessments.

## Design and simplification decisions

```text
Authenticated MCP search(query, reason)
  -> protected SearchPipeline
  -> outgoing: allow the exact query
  -> SearchEngineBraveHttp: render and classify the full page
  -> incoming: ad cleaning, sanitizing, HTML-to-Markdown
  -> release Markdown, withhold content, or fail safely
```

| Part | Simplest sound design |
| --- | --- |
| Query | Keep the small `SearchQuery` value class. The MCP parser and direct core boundary both use its rules. These checks protect different entry points. |
| Provider boundary | Keep one `SearchEngine` interface and the `SearchDocument` record. Return original HTML and classification. Design an API response format only when an API adapter is needed. |
| Brave HTTP | Keep classification and document-wide checks private in `search-engine-brave-http.ts`. No provider registry or generic DOM classifier is needed. |
| Core and stages | Keep one protected pipeline and two local executors. Their query checks, withholding rules, and safe failures differ from fetch. Share the safe cancellation check and its checkpoint wrapper. |
| HTML conversion | Keep the full document through the existing cleaners. Keep the tested search-only preservation option; retain fetch defaults. |
| Resources | Keep one renderer, shared compatible cleaners and reports, separate converter instances, and one hosted capacity owner. These lifetimes are required behavior. |
| MCP | Keep direct dispatch for two tools and the existing description field. No tool router, `details` field, or nested MCP call is needed. |
| Tests | Keep provider contracts, real-cleaner fixtures, public behavior, local pinned rendering, and live access proofs at their proper layers. Add assertions to existing cases where possible. |
| Documents | Keep contracts and open work here; link to dated evidence and the gate policy. Remove repeated prospective instructions for completed tickets. |

No paid API, key, pagination, count option, automatic retry, alternate provider,
or production endpoint override is part of this change.

## Contracts to preserve

### Public inputs and discovery

Both authenticated editions and both supported MCP protocol eras expose
`search({ query, reason })` and `getURLAsMarkdown`.

- Query: 1 to 512 well-formed Unicode scalar values, with a non-whitespace
  character. Reject lone surrogates. Preserve accepted text exactly.
  `SearchQuery` owns the bound and exposes read-only `value`.
- Reason: 1 to 2,000 Unicode code points, with a non-whitespace character.
  Reject extra fields. Do not send the reason to the engine or log it for search.
- Tool descriptions guide the model to use search for a query and fetch for
  a known page. They do not guarantee model behavior or provider access.
  The exact text lives in the reference and discovery tests.

The protected core checks cancellation, `product:access`, the query, and the
canonical operation UUID before stages or provider work. Reuse
`ExecutionContext` and the existing operation-ID check.

### Provider and incoming processing

`SearchEngine.search(query, signal)` returns
`{ page: WebsiteFetchResult, kind: 'results' | 'no_results' }`.
The pipeline checks the returned shape before incoming work and retains the
classification. The engine receives no actor, tenant, reason, or logging
context.

Brave builds `https://search.brave.com/search?q=...` with `URLSearchParams`.
The entire query remains one encoded value. The final URL must have the HTTPS
Brave origin, the `/search` path, and no credentials. This is a returned-page
check; renderer network protections still control requests and subresources.
Do not add returned-query equality without a separate provider contract.

Before parsing, enforce the 10 MiB UTF-8 HTML bound. Before selectors, enforce
the iterative element-depth bound of 256. Cancellation is cooperative between
synchronous work; parsing cannot be interrupted midway.

Supported result cards need nonblank titles, destinations, and descriptions.
Recognize the captured generic and video-description structures. Do not skip
an unsupported card to make a page pass. For no-results, require the supported
absence structure and no conflicting known results. SEARCH-07 applies
these checks across the document. Phrases in query or snippet text do not
determine classification.

Pass the original full page, including head, styles, and ancestors, to
`ProcessHtmlStep` once. Use the ad cleaner, sanitizer, and search-mode
Defuddle converter in that order. Preserve base-URL resolution. Safety
cleaning may remove unsafe content.

### Outcomes and failures

| Condition | Public outcome |
| --- | --- |
| Results and allowed nonblank Markdown | One text item with the exact Markdown. |
| Supported no-results and allowed incoming outcome | Exactly `No search results.`. |
| Typed `scan_failed` or `scan_limit` withholding | `Search content withheld`, with `isError: true`. |
| Outgoing or provider failure | `Search failed`, with `isError: true`. |
| Incoming failure, blank results, or unexpected processing failure | `Search processing failed`, with `isError: true`. |
| Invalid input, denied access, cancellation, or busy | The existing fixed error and `isError: true`. |

Withholding, failure, and cancellation take precedence over no-results.
Malformed provider or stage outcomes fail safely. Typed renderer failures may
add existing allowlisted public diagnostics; classification failures must not
be reported as renderer failures. Raw errors and provider content stay out of
error details. Fetch keeps its existing withholding behavior.

### Ownership, cancellation, and records

The concrete composition creates one shared Lightpanda fetcher. Its abandoned
DNS protection must apply across both tools. Share rules, compatible cleaners,
and report deduplication state. Do not wait indefinitely for abandoned native
DNS.

Hosted fetch and search share one application-scoped slot for the whole
operation, including incoming work and cleanup. Check cancellation before
busy, refuse overlap without queuing, and release only after settlement.
Self-hosted concurrency remains unchanged. Use the existing MCP request
lifetime for cancellation and shutdown.

Search checks an aborted signal before it inspects a thrown error, then checks
the signal again after inspection. Unreadable error metadata stays inside the
fixed failure for its boundary. Keep cancellation outcomes in the executors
so each entered stage records the correct terminal result.

Each entered stage attempts one correlated safe record. Unentered stages
emit none. Use `search.outgoing.observe_request` and
`search.incoming.process_html` with the existing shared record contract.

Each dispatched tool call, including invalid arguments, attempts one completion.
Pre-dispatch refusals emit no completion or stage records. Search completion
has only `event`, `operationId`, `authority`, `subject`, `tenantId`,
`tool`, `status`, and `durationMs`. Select this branch before inspecting
fetch arguments. Logging failure must not change a result or repeat work.

## Files and directories

The existing production layout stays:

```text
src/
  search-engine/
    search-engine.ts
    search-engine-brave-http.ts
  search-pipeline/
    search-query.ts
    search-pipeline.ts
    search-failure.ts
    search-cancellation.ts
    execute-outgoing-step.ts
    execute-incoming-step.ts
  mcp/
    search-tool-schema.ts
    search.ts
    operation-capacity.ts
    fetch-tool-server.ts
    tool-completion-record.ts
  fetch-tool.ts
  application.ts
  hosted-workos-application.ts
```

Reuse the public step, execution, and record contracts in `src/page-fetch/`
and the existing HTML cleaner package. SEARCH-08 added only
`src/search-pipeline/search-cancellation.ts` for the shared safe check and its
checkpoint wrapper. No other new production directory or file is planned.

Tests stay in `test/unit/search-engine/`, `test/unit/search-pipeline/`,
`test/integration/search-pipeline/`, `test/integration/mcp/`, and
`test/acceptance/mcp/`. Reuse captured data in
`test/support/fixtures/search-engine/`, existing MCP sites and drivers, and
the shared pinned-renderer helper. Follow the
[test code layout](../testing/test-code-layout.md).

## Acceptance criteria and evidence

The AC numbers remain stable. Open review work extends these requirements;
the earlier passing runs do not prove the new cases.

| ID | Required observable behavior | Evidence and remaining work |
| --- | --- | --- |
| AC1 | Authorized clients in both editions and eras discover both tools with guidance. Search preserves the query, fetches once, processes the full page once, and returns Markdown. | Public search acceptance and production-entry tests; SEARCH-05. |
| AC2 | Invalid input, denied access, and invalid operation IDs start no stages, provider, cleaners, or failure reports. Dispatched invalid calls still get completion records. Cover bounds, supplementary characters, lone surrogates, blank text, and exact preservation. | Query, schema, protected pipeline, and public invalid-argument tests. |
| AC3 | Outgoing refusal, changed query, malformed output, or failure prevents provider and incoming work. Incoming failure or withholding releases no page content and does not repeat provider work. | Protected pipeline tests assert one engine call for incoming malformed and withholding outcomes; public withholding asserts one renderer launch. SEARCH-09. |
| AC4 | Results require nonblank allowed Markdown. No-results still passes incoming and releases only the fixed text. Withholding and cancellation win. Malformed or contradictory provider output never claims absence. | Protected, public, and runtime tests; document-wide conflict regressions in SEARCH-07. |
| AC5 | Query delimiters remain one value at the fixed endpoint. Unexpected final destinations, unsupported shapes, oversized HTML, and excessive depth fail. Ordinary query/snippet phrases cannot override DOM structure. | Provider contract tests and document-wide container regressions in SEARCH-07. |
| AC6 | Supported full-page fixtures retain safe titles, actual Markdown links, snippets, order, and correct base resolution through real cleaners. Unsafe content is removed or withheld. | Real-cleaner integration, video public regression, and local runtime assertions. No universal completeness claim. |
| AC7 | Observed cancellation starts no later stage. Calls keep context and results isolated. Shared renderer ownership preserves DNS protection, prompt cancellation, cleanup, and shutdown. | Composition, DNS, lifecycle, and pinned fetch/search tests; SEARCH-08 adds malformed-error and inspection-triggered cancellation controls. |
| AC8 | Held rendering, incoming work, or cleanup prevents overlapping hosted fetch/search in both orders. Cancelled callers get cancellation before busy. Capacity returns only after settlement on success, failure, or abort. | Capacity unit and public hosted acceptance tests. |
| AC9 | Completion and entered-stage records are correlated, safe, and attempted once. Logger failure changes no behavior. Safe failures distinguish provider and renderer errors. Fetch remains compatible. | Dispatcher, formatter, core, and public tests; malformed-error core regression in SEARCH-08. |
| AC10 | Pinned local rendering reaches the MCP result without public access. The separate live proof reaches real Brave and useful MCP output; a provider refusal fails that proof. | Both runtime files; SEARCH-09 owns the stronger result/description assertion and its separate dated live result. SEARCH-06 retains its earlier evidence. |

## Implementation steps and completion gate

1. **Review complete:** preserve the current implementation and record the
   findings and simplified plan here. No production or test code changes
   belong to this review.
2. **SEARCH-07 complete:** public and provider scenarios failed first, then
   passed after the document-scope correction. Existing valid pages and
   ordinary footer navigation remain supported. See the verification record.
3. **SEARCH-08 complete:** protected-core specifications failed first, then
   passed with the shared safe cancellation check. Public tests preserve the
   boundary's message and completion status. Cancellation and stage records
   remain correct when inspecting an error fails or causes an abort.
4. **SEARCH-09 implementation complete:** existing cases assert call counts.
   Controlled false-positive cases failed before the live assertion was
   corrected. Current documents identify proof ownership and completed AMD64
   evidence. Record the separate live result as pass or failure; do not retry
   until it happens to pass.
5. Select checks from the **complete candidate**, as the
   [test gate policy](test-gate-policy.md) requires. Source changes select
   `npm test`, `npm run typecheck`, `npm run test:build`,
   `npm run build:user-portal`, and applicable runtime/container/hosted gates.
   Run changed tests before commit. Do not add a duplicate `npm run check`.
6. Run habit-hooks and the full
   [ast-metrics process](ast-metrics-review.md) after the final changes.
   Reuse coverage only if it is compatible; record each remaining goal
   exception. Do not alter immutable metric history.
7. Update evidence and the PR description, including the required complete
   process report. Then follow [AGENTS.md](../../AGENTS.md) for Ready,
   started Actions jobs, owner review, and merge.

The original review used source inspection, 214 passing focused tests, and
independent in-memory reproductions of R1 and R2. SEARCH-07 and SEARCH-08 fix
those defects and record their own checks. Final image/build qualification of
the completed SEARCH-07–09 candidate remains required before Ready; earlier
passes do not qualify changed production inputs. No new public Brave request
is needed for SEARCH-07 or SEARCH-08.

A future unchanged live empty-results capture should get provenance and a
full-flow regression. Until then, retain the explicit unverified limit.
Do not make an open-ended capture attempt or a new provider implementation
part of these correction tickets.

## Appendix A: implementation tickets

These are local work packages, not board issues. The original sequence is
complete; its dated records retain the implementation details. Keep the
existing ticket anchors so earlier records remain linked.

### SEARCH-01: Define the query and document contracts

**Implemented.** Added `SearchQuery`, the engine/document contracts, and
initial specifications. Covers AC2. See [SEARCH-01 evidence](search-01.md).

### SEARCH-02: Prove Brave HTTP classification and full-page fidelity

**Implemented; R1 fixed by SEARCH-07.** Added the HTTP provider and
captured-page conversion proof, including the search-only preservation setting.
Covers AC5–AC6. See [SEARCH-02 evidence](search-02.md).

### SEARCH-03: Implement the protected search pipeline and records

**Implemented; R2 fixed by SEARCH-08.** Added protected orchestration, local executors,
safe failures, and architecture checks. Covers AC2–AC4, AC7, and AC9.
See [SEARCH-03 evidence](search-03.md).

### SEARCH-04: Share renderer resources and hosted operation capacity

**Implemented.** Shared the renderer, compatible cleaners and reports, and
one hosted slot. Covers AC7–AC8. See [SEARCH-04 evidence](search-04.md).

### SEARCH-05: Expose MCP search with safe projection and discovery guidance

**Implemented.** Added dispatch, descriptions, private completion records,
and public edition-by-era coverage. Covers AC1 and AC9.
See [SEARCH-05 evidence](search-05.md).

### SEARCH-06: Prove the pinned runtime and select the delivery gates

**Implemented; R3 addressed by SEARCH-09.** Local pinned rendering, one dated live MCP
search, and selected test/build gates passed. Covers AC10 and final checks
across AC1–AC9. Retained quality exceptions and the live result are in
[SEARCH-06 evidence](search-06.md). SEARCH-09 owns the later proof corrections.

### SEARCH-07: Refuse contradictory Brave documents

**Implemented.** Addresses R1, AC4, and AC5. The public acceptance red,
provider red, narrow fix, and current checks are in [SEARCH-07 evidence](search-07.md).

**Paths:** `src/search-engine/search-engine-brave-http.ts`,
`test/unit/search-engine/search-engine-brave-http.test.ts`, and
`test/acceptance/mcp/search-pipeline.test.ts`.

**Acceptance:** Given the supported no-results fixture plus a duplicate known
results section, conflicting banner, or a Brave result card outside the main,
when search runs, then it fails safely before incoming and never reports
absence. Given the unchanged fixtures or ordinary footer navigation with
generic data attributes, then their existing outcomes remain. No new provider
request is needed.

**Steps:** Write the public failing case; add the provider conflict and valid
control cases; check document-wide uniqueness and containment; keep the
original page; run the focused tests and update current provider limits.

### SEARCH-08: Keep malformed errors inside the safe search boundary

**Implemented.** Addresses R2, AC7, and AC9. The failing specifications,
shared check, public regression, and current checks are in
[SEARCH-08 evidence](search-08.md).

**Paths:** the three search pipeline modules that inspect cancellation;
new `src/search-pipeline/search-cancellation.ts`;
`test/unit/search-pipeline/search-cancellation.test.ts`;
`test/integration/search-pipeline/protected-search.test.ts`; and
`test/integration/mcp/fetch-tool-server.test.ts`.

**Acceptance:** Given an outgoing, engine, or incoming error whose name read
throws, when the protected pipeline runs, then callers get the fixed failure
for that boundary, no private error text, and only the expected stage records.
Given an aborted signal, then cancellation wins without inspecting the error.
Public MCP behavior remains safe and records the correct failure status.

**Steps:** Write the failing boundary scenarios; add one bounded safe
cancellation check for its three callers; retain local stage decisions;
run the focused cancellation, failure, and dispatch regressions. Do not
generalize fetch and search executors.

### SEARCH-09: Align proof strength and current documentation

**Implemented; final qualification in progress.** Addresses R3, AC3, AC6,
and AC10. See [SEARCH-09 evidence](search-09.md).

**Paths:** existing protected-search, public search, and live search tests;
shared `test/support/dsl/search-results.ts` assertion and its controlled unit
cases; `docs/reference/mcp-search-tool.md`, `docs/lightpanda-runtime.md`, the
gate policy, and this plan. Historical verification records stay intact.

**Acceptance:** Incoming malformed and withholding cases assert one engine
call. Public withholding asserts one renderer launch. The live proof requires
a useful external result link with its associated description; an unrelated
footer paragraph cannot satisfy it. Current text identifies which proof owns
which claim and records the completed AMD64 evidence. The live empty-results
limit remains explicit.

**Steps:** Add counters to existing cases; strengthen the live assertion with
controlled positive and negative examples without fixing live rankings or
exact wording; update the current documents; run selected focused tests and
the separate live gate when verifying the changed live test. Record any access
failure honestly. Re-select final checks from the completed candidate.
