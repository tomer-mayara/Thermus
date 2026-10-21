# Search pipeline plan

Reviewed: 2026-10-20, against `ec1647bb`.

**Status:** SEARCH-01 through SEARCH-06 are implemented. Their selected test
and build gates passed for source and test candidate `85817282`; later
changes recorded evidence. This review found two boundary defects and small
proof gaps. SEARCH-07 through SEARCH-09 below are planned, not implemented.
[PR 202](https://github.com/tomer-mayara/Thermus/pull/202) is Draft.
Owner review and merge remain pending.

This document owns the current design, acceptance criteria, and next steps.
The [search reference](../reference/mcp-search-tool.md) owns tool usage.
The [SEARCH-06 record](search-06.md) owns the earlier gate results and retained
quality exceptions. Passing test and build gates does not mean that all
maintainability or coverage assessments met their goals.

## Review findings

### R1: Contradictory document can report no results — medium priority

The Brave classifier checks for duplicate results sections and banners only
inside `main#search-page`. Its no-results check looks for conflicting result
markers inside that same root. See
[the provider](../../src/search-engine/search-engine-brave-http.ts), methods
`classify` and `isNoResults`.

A controlled reproduction starts with the documented no-results fixture and
adds a second `section#mixed-main`, with a valid web result, outside that
root. The provider returns `no_results`. A second known banner outside the
root has the same outcome. Moving the duplicate section inside the root, or
adding a second `main#search-page`, correctly fails. Ordinary footer
navigation remains valid.

The earlier record accurately describes the narrower root check. The mistake
is treating that check as sufficient for the plan's broader requirement to
refuse ambiguous pages before claiming absence. This is a reproduced
classification gap, not an observed live Brave failure.

**Correction:** SEARCH-07 will check known container and banner uniqueness
across the document, require their expected containment, and reject conflicting
Brave result cards before returning no-results. It will keep unrelated
navigation and generic data attributes valid. No challenge phrase list or
general page validator is needed.

### R2: A malformed error can escape the core's safe failure — low priority

The outgoing executor, incoming executor, and protected pipeline read
`error.name` to recognize cancellation. That property can itself throw.
A controlled collaborator that throws such an `Error` causes the raw getter
exception to escape `SearchPipeline` in all three positions. See
[the outgoing executor](../../src/search-pipeline/execute-outgoing-step.ts),
[the incoming executor](../../src/search-pipeline/execute-incoming-step.ts),
and [the pipeline](../../src/search-pipeline/search-pipeline.ts).

The MCP boundary catches this and returns fixed safe text. No MCP content leak
was demonstrated. The defect is in the protected core's failure contract.

**Correction:** SEARCH-08 will give the three search paths one small safe
cancellation check. An aborted signal still wins; an unreadable error property
must fall back to the stage's fixed failure. Keep stage outcomes and recording
local. No general error framework is needed.

### R3: Proof claims need more precise ownership

The evidence is useful, but some assertions prove less than their summaries:

- The live test finds an external result link and a relevant paragraph
  independently. It does not prove that the paragraph describes that result.
- Incoming withholding and malformed-outcome cases do not all assert that
  the engine ran exactly once. The ordinary incoming-exception case does.
- The edition-by-era matrix checks destination strings; the captured-page
  integration, video regression, and runtime cases check actual Markdown
  links. Fidelity is supported by their combined evidence, not by each matrix
  case alone.
- The runtime guide still uses a pending AMD64 rendering statement. The
  [RHD-03 record](rhd-03.md) and SEARCH-06 record contain successful image
  rendering results. The guide should state the completed evidence directly.

These are proof and documentation gaps, not demonstrated wrong search output.
SEARCH-09 will strengthen the existing assertions and align current reference
text. It will not create another test matrix or rewrite dated records.

### Known limits, not new defects

- The no-results fixture is derived from a captured page and Brave's fallback
  component. It is not an authentic empty response. The full incoming flow is
  tested for that supported structure; current live empty-results behavior
  remains unverified. The [fixture notes](../../test/support/fixtures/search-engine/README.md)
  describe its origin and limits.
- One real self-hosted MCP search passed with Lightpanda 1.0.0 on
  2026-10-20 at 23:06:10 UTC. This proves that call, not sustained access,
  every query, a live hosted search, or every future provider layout.
- Public Brave can return a challenge, rate limit, or changed page. HTTP
  access is not a guarantee against blocking. Unsupported responses fail.
- Full-page conversion can include page context. Captured fixtures prove
  safe result fidelity for their shapes. A nonblank runtime check cannot
  prove completeness on every unseen page.
- Existing quality exceptions remain recorded in SEARCH-06. Unknown coverage
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
| Brave HTTP | Keep classification private in `search-engine-brave-http.ts`. Repair the document scope; do not add a provider registry or generic DOM classifier. |
| Core and stages | Keep one protected pipeline and two local executors. Their query checks, withholding rules, and safe failures differ from fetch. Share only the repeated safe cancellation check in SEARCH-08. |
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
absence structure and no conflicting known results. SEARCH-07 strengthens
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
and the existing HTML cleaner package. SEARCH-08 adds only
`src/search-pipeline/search-cancellation.ts` for the shared safe check.
No other new production directory or file is planned.

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
| AC3 | Outgoing refusal, changed query, malformed output, or failure prevents provider and incoming work. Incoming failure or withholding releases no page content and does not repeat provider work. | Protected pipeline tests; strengthen direct call-count assertions in SEARCH-09. |
| AC4 | Results require nonblank allowed Markdown. No-results still passes incoming and releases only the fixed text. Withholding and cancellation win. Malformed or contradictory provider output never claims absence. | Protected, public, and runtime tests; document-wide conflict regressions in SEARCH-07. |
| AC5 | Query delimiters remain one value at the fixed endpoint. Unexpected final destinations, unsupported shapes, oversized HTML, and excessive depth fail. Ordinary query/snippet phrases cannot override DOM structure. | Provider contract tests; extend known-container scope in SEARCH-07. |
| AC6 | Supported full-page fixtures retain safe titles, actual Markdown links, snippets, order, and correct base resolution through real cleaners. Unsafe content is removed or withheld. | Real-cleaner integration, video public regression, and local runtime assertions. No universal completeness claim. |
| AC7 | Observed cancellation starts no later stage. Calls keep context and results isolated. Shared renderer ownership preserves DNS protection, prompt cancellation, cleanup, and shutdown. | Composition, DNS, lifecycle, and pinned fetch/search tests; preserve these in SEARCH-08. |
| AC8 | Held rendering, incoming work, or cleanup prevents overlapping hosted fetch/search in both orders. Cancelled callers get cancellation before busy. Capacity returns only after settlement on success, failure, or abort. | Capacity unit and public hosted acceptance tests. |
| AC9 | Completion and entered-stage records are correlated, safe, and attempted once. Logger failure changes no behavior. Safe failures distinguish provider and renderer errors. Fetch remains compatible. | Dispatcher, formatter, core, and public tests; malformed-error core regression in SEARCH-08. |
| AC10 | Pinned local rendering reaches the MCP result without public access. The separate live proof reaches real Brave and useful MCP output; a provider refusal fails that proof. | Both runtime files and the dated live result in SEARCH-06; improve result/description association in SEARCH-09. |

## Implementation steps and completion gate

1. **Review complete:** preserve the current implementation and record the
   findings and simplified plan here. No production or test code changes
   belong to this review.
2. **SEARCH-07:** write the public failing ambiguity scenario, add focused
   provider cases and valid-page controls, then make the narrow classifier
   correction. Run the affected cases.
3. **SEARCH-08:** write failing protected-core specifications for unreadable
   error names at all three boundaries. Add the shared safe cancellation
   check. Preserve cancellation precedence, records, and fixed failures.
4. **SEARCH-09:** strengthen existing count and live-association assertions
   and align current documents. Use a controlled false-positive example to
   prove the stronger live assertion. A live result must be recorded as pass
   or failure; do not retry until it happens to pass.
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

The earlier full-suite results remain evidence for the unchanged baseline.
This review used source inspection, 214 passing existing focused tests, and
independently repeated in-memory reproductions of R1 and R2. It made no new
public Brave request and does not claim a new full-suite run or a fix for
either defect. Only this plan changed.

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

**Implemented, with R1 open.** Added the HTTP provider and captured-page
conversion proof, including the search-only preservation setting.
Covers AC5–AC6. See [SEARCH-02 evidence](search-02.md).

### SEARCH-03: Implement the protected search pipeline and records

**Implemented, with R2 open.** Added protected orchestration, local executors,
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

**Implemented, with R3 open.** Local pinned rendering, one dated live MCP
search, and selected test/build gates passed. Covers AC10 and final checks
across AC1–AC9. Retained quality exceptions and the live result are in
[SEARCH-06 evidence](search-06.md). This status does not close the new findings.

### SEARCH-07: Refuse contradictory Brave documents

**Planned; before Ready.** Addresses R1, AC4, and AC5.

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

**Planned; before Ready.** Addresses R2, AC7, and AC9.

**Paths:** the three search pipeline modules that inspect cancellation;
new `src/search-pipeline/search-cancellation.ts`;
`test/integration/search-pipeline/protected-search.test.ts`; existing MCP
dispatch tests where needed.

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

**Planned; before final sign-off.** Addresses R3, AC3, AC6, and AC10.

**Paths:** existing protected-search, public search, and live search tests;
`docs/reference/mcp-search-tool.md`, `docs/lightpanda-runtime.md`, and this
plan. Keep historical verification records intact; add new evidence separately.

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
