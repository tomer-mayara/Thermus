# Search pipeline plan

Status: SEARCH-01 contracts and SEARCH-02 provider implemented; public search remains open.
Date: 2026-10-20.

Add MCP `search({ query, reason })` to return cleaned first-page Markdown.
The first engine loads the public Brave HTTPS search page through the existing
Lightpanda renderer. Its file is `search-engine-brave-http.ts`. This scope
includes no paid API, key, pagination, count option, or provider framework.

Follow [AGENTS.md](../../AGENTS.md), the
[coding principles](../coding-principles.md), the
[test code layout](../testing/test-code-layout.md), and the
[test gate policy](test-gate-policy.md). This is a plan, not an implementation
or verification record.

## Flow and contracts

```text
Authenticated MCP search(query, reason)
  -> protected SearchPipeline
  -> outgoing: allow the exact query unchanged
  -> SearchEngine: fetch and classify a rendered search page
  -> incoming: process the full rendered page once
  -> final decision
  -> Markdown or a safe MCP tool error
```

Use both authenticated editions and both supported MCP protocol eras. Preserve
their access, Origin, cancellation, and shutdown rules. Do not nest
`createFetchPage`, `getURLAsMarkdown`, or another MCP call inside search.

Use the existing per-tool `description` field in `tools/list` for discovery
guidance. Keep the actual fetch tool name `getURLAsMarkdown`. Set these planned
descriptions:

- `search`: "Search the web with a text query and return cleaned results as
  Markdown. Use this tool for web searches; search engines may block generic
  page-fetch requests. Use getURLAsMarkdown to read a result page. Give the
  reason the agent needs the search."
- `getURLAsMarkdown`: "Fetch a known web page URL as Markdown. For web searches,
  use search instead of fetching a search engine results URL. Give the reason
  the agent needs the page."

MCP clients receive this metadata during discovery and can supply it to the
model. It guides tool choice; it does not guarantee model behavior or provider
access. Add no `details` field, routing engine, or server-side restriction. The
[MCP tool specification](https://modelcontextprotocol.io/specification/2026-07-28/server/tools#tool)
defines the description field.

| Contract | Responsibility |
| --- | --- |
| MCP schema | Accept only `query` and `reason`; reject invalid arguments and extra fields. |
| `SearchQuery` | Own the exact query text; enforce its Unicode and length rules at construction; expose read-only `value`. |
| `SearchPipeline` | Check access and semantic inputs; run stages in order; retain provider classification; make the final release decision. |
| `SearchEngine` | Accept query and signal; return `SearchDocument = { page: WebsiteFetchResult, kind: 'results' \| 'no_results' }`. |
| Brave HTTP engine | Build the fixed URL, use an injected public `WebsiteFetcher`, check the final URL, and classify the returned DOM. |
| Incoming stage | Use `ProcessHtmlStep` with the ad cleaner, prompt-injection sanitizer, and Defuddle, in their existing order. |
| Search executors | Check local stage outcomes, cancellation, and safe errors; write one record per entered stage. |
| Concrete composition | Construct and share renderer resources, cleaners, reporting, and hosted capacity. |

The engine returns the original rendered page with requested URL, final URL,
and HTML. It returns no Markdown or extracted fragment. The pipeline retains
`kind` and passes only `page` to incoming processing once. Before incoming
starts, validate that the engine result has an object `page` with string
`requestedUrl`, `finalUrl`, and `html` fields, and exactly one supported `kind`.
Invalid or missing classification is a search failure, never no-results.

After incoming allows the page, `results` requires nonblank Markdown.
`no_results` releases exactly `No search results.`. Incoming failure,
withholding, or cancellation always wins, including on a no-results page.
The final pipeline outcomes need only released Markdown or typed withholding
with `scan_failed` or `scan_limit`. Do not add a second no-results union
through every layer. The MCP adapter returns withholding as `isError: true`
without page content. Existing fetch empty-success withholding stays unchanged.

Keep the HTML document boundary provider-neutral. A future API adapter could
normalize its response to this boundary, but that needs separate design and
verification. It is outside this plan and need not use Lightpanda. Add no
unused response-format union now.

## Inputs, provider checks, and content

The query must contain 1 to 512 well-formed Unicode scalar values and at least
one non-whitespace character. Reject lone UTF-16 surrogates. Do not trim or
normalize accepted text. `SearchQuery` owns these rules and exposes
`SearchQuery.MAX_SCALARS` and a read-only `value`. Construction rejects invalid
input with `TypeError('Invalid search query')`, without including the input.
The MCP schema declares the same limit. Its argument parser and the protected
pipeline use `SearchQuery` for semantic validation before effects. Pass
`query.value` to the string-based stage and engine contracts. The MCP parser
maps a construction failure to the fixed invalid-arguments result.
Preserve the existing reason contract: 1 to 2000 code points and nonblank.
Reject extra fields.

Before stage, report, or provider effects, the core checks `product:access`,
the query, and the operation ID with the existing canonical
`assertOperationId`. Reuse `ExecutionContext`; do not copy or move this small
contract. Pass one signal through engine and stages, and use one operation ID
for executor records and safe failure reports. Do not send the ID, reason,
user, tenant, permissions, or logging context to the engine or provider.

Brave constructs only `https://search.brave.com/search?q=...` with
`URLSearchParams`. Query text stays one encoded `q` value. Callers cannot
select another endpoint or provider option. Before classification, require
the returned final URL to have the HTTPS `search.brave.com` origin and
`/search` path, with no credentials. Refuse unexpected final destinations.
This check rejects an unsupported returned page; it cannot prevent public
redirects or subresources that the renderer has already followed. Retain
renderer private-IP and network protections.

Classify supported DOM structures, not broad matches on page text. A query or
result snippet can contain phrases about challenges or no results. Require
supported results or explicit no-results structure; unknown, challenge, or
unsupported shapes fail closed. HTML parsers can repair malformed input, so
do not claim to detect every malformed document.

Before classifier parsing, apply the existing 10 MiB UTF-8 HTML bound. Before
selector work, use bounded iterative DOM inspection with a depth limit of 256.
Cleaner checks later in the flow do not protect the classifier. Check the
signal before and after engine work, classification, and stages. Cancellation
is cooperative between synchronous transformations; DOM parsing is not
preemptible. Preserve existing renderer buffer, DNS, time, process, and cleanup
controls.

Keep the full original document for safety cleaning, including CSS and
ancestors. For supported captured full-page shapes, integration fixtures must
show that expected safe titles, destination links, snippets, and order survive
the real cleaners. Output can include page context. Safety cleaning can remove
unsafe content intentionally. Do not promise universal result completeness or
runtime detection of every partial or navigation-only nonblank extraction.
Keep the nonblank check for a results page.

Use existing document base behavior: resolve `base href` against the final
URL, or use the final URL when no usable base exists. Prove Defuddle behavior
early. If it loses required safe fixture results, add a narrow search-only
preservation setting in the HTML converter, with fetch defaults unchanged.
Do not discard CSS or ancestors to force fragment extraction.

SEARCH-02 found that default conversion produced blank lines inside result
link labels. Its opt-in `CleanHtmlToMarkdownDefuddle` setting,
`{ preserveSearchResults: true }`, keeps the full cleaned body and converts
block children of links to inline labels. SEARCH-04 must enable this setting
for search only. Share the ad cleaner and sanitizer; use separate converter
instances for the two modes. The [SEARCH-02 record](search-02.md) and
[fixture notes](../../test/support/fixtures/search-engine/README.md) give the
capture evidence and its limits. The supported English no-results template
has a controlled derived fixture; a live empty response remains unverified.

Provider classification failures must remain distinct from renderer failures.
Report and preserve safe public renderer diagnostics only for renderer errors.
Unknown provider shapes, challenges, and unsupported final URLs are search
failures; none implies absence. Use search-safe error mapping instead of the
existing fetch-only fallback messages. Use `Search failed` for outgoing or
engine failures, `Search processing failed` for incoming or unexpected
processing failures, and `Search content withheld` for typed scan withholding.
Keep the existing invalid-arguments, access-denied, cancellation, and busy
messages. Every failure has `isError: true`. Raw errors and provider content
must not appear in tool errors. Do not retry around a challenge or switch
provider.

## Shared resources and records

Expand the concrete composition in `src/fetch-tool.ts` to create one
`WebsiteFetcherLightpanda` shared by fetch and search. Load rules once and
share compatible cleaners and the setup reporter, including deduplication
state. The abandoned native DNS guard belongs to a fetcher instance; separate
instances would let the other tool escape it. Keep quick cancellation and late
DNS observation. Do not wait indefinitely for native DNS to settle.
Use the existing `ObserveRequestStep` for the unchanged-query outgoing role.

One application-scoped hosted capacity owner wraps both full operations,
including outgoing work, rendering, incoming processing, and cleanup. Check
a cancelled caller before reporting busy. Refuse overlap without a queue.
Release capacity only when the active operation settles, including after
abort. Replace the old fetch-only owner; do not retain a second slot. A slot
around renderer calls alone is insufficient. Self-hosted concurrency stays
unchanged. No `MCPServer` lifecycle algorithm change is needed.

Reuse public `PipelineStep`, `OutgoingStep`, `IncomingStep`,
`ExecutionContext`, `assertOperationId`, and `writeStepRecord` from
`src/page-fetch/`. Extend the finite `StepId` union with:

- `search.outgoing.observe_request`
- `search.incoming.process_html`

Keep search executors local because their checked outcomes and errors differ
from fetch. Do not add duplicate step or record contracts, or a generic
executor framework.

Each entered stage attempts one `pipeline.step.completed` record with the
same operation ID, fixed stage ID, safe outcome/code, and bounded duration.
An unentered stage emits no record. Each envelope-valid `tools/call` that
reaches dispatch attempts one correlated `mcp.tool.completed` record, including
dispatched calls with invalid arguments. Authentication, body, or envelope
refusals before dispatch emit no tool completion or stage records.

Select the search logging branch before existing `safeReason` or `safeUrl`
projection, even for malformed search arguments. Search records omit raw
query, reason, page, URL, provider response, and failure data. Keep trusted
actor and tenant fields and fixed safe statuses. Fetch completion fields stay
unchanged. Sink or logger failure must not change a result or repeat work.

## File plan

| New production path | Purpose |
| --- | --- |
| `src/search-engine/search-engine.ts` | Public engine and rendered-document contracts. |
| `src/search-engine/search-engine-brave-http.ts` | Public HTTP implementation, fixed URL checks, and private classification methods. |
| `src/search-pipeline/search-pipeline.ts` | Protected orchestration and final decision. |
| `src/search-pipeline/search-query.ts` | `SearchQuery` class with exact text, Unicode rules, and query bounds. |
| `src/search-pipeline/execute-outgoing-step.ts` | Unchanged-query checks and outgoing records. |
| `src/search-pipeline/execute-incoming-step.ts` | Incoming checks, withholding, and records. |
| `src/mcp/search-tool-schema.ts` | Search argument schema and parsing. |
| `src/mcp/search.ts` | Meaningful typed outcome-to-MCP projection. |
| `src/mcp/operation-capacity.ts` | Shared capacity owner replacing the fetch-only wrapper. |

Keep classification private initially. Extract
`src/search-engine/brave-search-page.ts` only if classification becomes a
substantial, coherent module. Add no `src/search-tool.ts` or duplicate
`src/search-pipeline/pipeline-step.ts` or `step-record.ts`.

Modify these existing paths:

- `src/page-fetch/pipeline-step.ts`: add the two finite search IDs; reuse
  `src/page-fetch/step-record.ts` without a second record implementation.
- `src/fetch-tool.ts`: compose both operations from shared concrete resources.
- `src/application.ts` and `src/hosted-workos-application.ts`: wire both
  editions and the one hosted capacity owner.
- `src/mcp/fetch-tool-server.ts` and `src/mcp/tool-completion-record.ts`:
  dispatch, projection, and safe search records.
- `src/mcp/single-fetch-operation.ts` and its callers: replace the old owner
  with `operation-capacity.ts`.
- `.habit-hooks/eslint.config.mjs`: extend the page-fetch-style import guard
  to search core. Permit public contracts, the shared helpers listed above,
  and local modules. Reject concrete Brave and classifier imports, SDK,
  composition, renderer, cleaner, and logger
  implementations, including type-only imports.
- `test/acceptance/architecture/page-fetch-boundaries.test.ts`: extend
  architecture acceptance coverage to enforce the search boundary, or add
  a focused sibling specification using the existing guard fixtures.
- `package.json`: select both fetch and search runtime files in
  `test:mcp:renderer` and `build:hosted`, plus necessary ordinary hosted
  search acceptance cases in the hosted build.
- `docs/implementation/test-gate-policy.md`,
  [Lightpanda runtime guide](../lightpanda-runtime.md),
  [README.md](../../README.md), and the
  [fetch reference](../reference/mcp-fetch-tool.md): describe the new flow
  and gate selection. Add `docs/reference/mcp-search-tool.md`.

No ast-metrics rule change is planned unless implementation evidence requires
it. The current guard does not cover search core merely because this plan
names it.

## Test plan and acceptance criteria

Write the failing BDD acceptance specification first, then use TDD for its
contracts and behavior. Unit tests replace other Thermus packages at public
interfaces. Real collaboration between packages belongs in integration or
acceptance tests.

Use `test/unit/search-engine/` and `test/unit/search-pipeline/` for detailed
matrices. Use `test/integration/search-pipeline/brave-markdown.test.ts` for
real cleaning of supported captured pages. Add
`test/acceptance/mcp/search-pipeline.test.ts` and
`test/acceptance/mcp/hosted-search-capacity.test.ts` for public behavior.
Cover both edition-by-era combinations for discovery and representative
success; do not repeat every negative matrix in all four combinations.

Reuse existing MCP drivers and production-like sites. Add support only where
needed; do not copy a complete search site by default. Keep private fixtures
beside their consumers. Move fixtures to
`test/support/fixtures/search-engine/` only when shared. Extend
`test/interface/page-fetch/pipeline-step-types.ts`, step-record coverage in
`test/unit/page-fetch/execute-outgoing-step.test.ts` and
`test/unit/page-fetch/execute-incoming-step.test.ts`, and
`test/unit/page-fetch/execution-context.test.ts` where shared contracts change.
Update dispatcher, completion, capacity, isolation,
shutdown, and fetch regression tests affected by the composition.

Acceptance criteria:

1. **Public flow.** Given an authorized client in each edition and supported
   era, when it discovers tools and calls search, then both tools are present,
   their descriptions explain when to search and when to fetch a known page,
   outgoing preserves the query, the engine fetches once, incoming processes
   the full page once, and the tool releases the expected Markdown.
2. **Validation before work.** Given invalid query or reason fields or extra
   fields, when MCP parses the call, then it rejects it. Given denied access,
   an invalid query, or an invalid operation UUID, when the protected pipeline
   is called directly, then it rejects the call. These refusals start no stage,
   renderer, cleaner, or renderer-failure report. A dispatched MCP call still
   attempts its completion record. Cover 512/513 scalar values, supplementary
   characters, lone surrogates, blank input, and exact preservation of valid
   whitespace and Unicode.
3. **Stage decisions.** Given outgoing refusal, exception, changed query, or
   malformed output, when search runs, then engine and incoming do not start.
   Given incoming failure, malformed output, or typed scan withholding, then
   no page content is released and provider work is not repeated.
4. **Final decision.** Given a supported results page, when incoming allows
   nonblank Markdown, then it is released. Blank results extraction fails.
   Given explicit no-results, then incoming still runs and only an allowed
   outcome releases exactly `No search results.`. Withholding and cancellation
   take precedence in both cases. Invalid engine result shapes or
   classifications fail before incoming. Provider failures never claim absence.
5. **Provider boundary.** Given spaces, Unicode, URL-like text, or query
   delimiters, when the Brave adapter requests a page, then they remain one
   encoded `q` value at the fixed endpoint. Unexpected final origin or path
   fails before classification. Snippet or query phrases about challenges or
   no results do not override DOM structure. Unknown shapes, unsupported
   pages, oversize HTML, and depth beyond 256 fail safely.
6. **Safe fidelity.** Given supported captured full-page fixtures, when the
   real cleaners run, then expected safe titles, destination links, snippets,
   and order remain, base URL behavior is correct, and unsafe content is
   removed or withheld. No claim extends to every future provider page.
7. **Cancellation and ownership.** Given cancellation at a boundary,
   concurrent contexts, or shutdown, when work settles, then no later stage
   starts after observed cancellation and no context or result crosses calls.
   The shared renderer preserves abandoned-DNS protection across tools,
   returns cancellation promptly, and retains cleanup ownership.
8. **Hosted capacity.** Given active fetch or search, when another tool call
   arrives while rendering, incoming processing, or cleanup is held, then it
   gets busy without work or queuing. Test both arrival orders and success,
   failure, and abort. A cancelled caller gets cancellation before busy; the
   slot returns only after operation settlement.
9. **Safe records and failures.** Given a dispatched call, when it completes,
   then it attempts one correlated completion and one record per entered
   stage, with search IDs and no raw query, reason, URL, page, or error.
   Pre-dispatch refusals emit neither record type. Malformed search arguments
   cannot enter fetch log projection. Sink failure changes no behavior.
   Renderer diagnostics remain safe and distinct from provider classification
   failures; fetch fields and public behavior stay compatible.
10. **Executable gates.** Given pinned Lightpanda 1.0.0, when the dedicated
    local runtime gate runs, then rendering and the search pipeline pass
    through the tool result. A separate live end-to-end proof must also pass
    through the real Brave adapter, classifier, cleaners, and MCP result.

Add `test/acceptance/mcp/search-pipeline.runtime.ts`. A test-only
`WebsiteFetcher` transport maps the canonical Brave URL to a local renderer
fixture and returns metadata for the canonical Brave page. Use existing
test-scoped fixture isolation and its isolated private-network allowance.
Introduce no production endpoint override or production network bypass.
This proves pinned rendering and pipeline behavior, not real Brave access.

Keep the live proof separate from deterministic ordinary tests. Record its
command, date, pinned version, and tool result. Earlier raw probes used
`1.1.0-nightly.10257+c3dfbaab3` and returned twice in about 2.3 seconds.
They establish neither pinned-1.0.0 compatibility, conversion fidelity, nor
sustained public access. SEARCH-02 captured a full results page with verified
1.0.0 and proved its fidelity offline through the real engine and cleaners.
A later raw request received HTTP 429. No live proof through the complete MCP
search flow has passed under this plan.

## Implementation order and gates

1. Add failing public acceptance specifications for the fixed contracts and
   representative edition-by-era flow.
2. Prove realistic full-page Brave-to-Markdown fidelity early with real
   cleaners. If required fixture results are lost, use TDD for a narrow
   search-only preservation setting and keep fetch defaults.
3. Use provider TDD for URL encoding, final destinations, bounded DOM
   classification, false-positive phrases, and distinct renderer failures.
4. Use pipeline TDD for Unicode, permission, UUID validation, local executors,
   no-results precedence, cancellation, outcomes, and records. Extend shared
   contract and import-guard specifications.
5. Wire shared renderer resources, one hosted capacity owner, dispatch, and
   logging. Set both tool descriptions and check discovery guidance in both
   editions and eras. Prove cross-tool DNS, held incoming/cleanup, both capacity
   orders, and existing fetch regressions.
6. Add and select the pinned local runtime proof. Run the separate pinned live
   end-to-end proof. Update reference and gate documents before final review.
7. Select checks from the complete implementation candidate, run them, and
   continue until the acceptance specifications and required gates pass.

Future source changes require `npm test`, `npm run typecheck`,
`npm run test:build`, and `npm run build:user-portal`, plus applicable
renderer, self-hosted container, hosted build, and AMD64 hosted container
gates from the [test gate policy](test-gate-policy.md). Run selected new or
changed tests locally before commit and record deferred checks accurately.
Do not add a duplicate `npm run check` run.

Run `habit-hooks` on the complete candidate and keep its snooze file empty.
Follow the [ast-metrics review process](ast-metrics-review.md) with required
source coverage, maintainability and CRAP assessment, final unedited process
report, and generated metrics record. Follow normal draft, review, Ready,
Actions, and merge policy from [AGENTS.md](../../AGENTS.md).

Appendix A records ticket status and links to implementation evidence. The
checks above apply to the complete implementation candidate.

## Appendix A: implementation tickets

These are local work packages. SEARCH-01 contracts and SEARCH-02 provider
behavior are implemented; public search acceptance remains open.
SEARCH-03 through SEARCH-06 are **Planned**.
The entries are not board issues or instructions to open separate pull requests.
No board issue has been created.
AC numbers refer to the acceptance criteria above. The dependency order is:

`SEARCH-01 -> SEARCH-02 -> SEARCH-03 -> SEARCH-04 -> SEARCH-05 -> SEARCH-06`

Write the public BDD specification first, then use TDD for each package's
deliverable. Keep cross-package acceptance cases open until their full flow
passes. Do not skip them or merge a test-only red change or an incomplete
feature. Each package includes its affected documents and local test evidence.
Use public-interface doubles in unit tests and real collaborators in
integration tests. Keep private fixtures near their consumers. Apply the
complete-candidate checks and merge policy above whenever required; SEARCH-06
does not defer checks from earlier work. Add no executable tests for prose.

### SEARCH-01: Define the query and document contracts

**Status:** Contracts implemented; public acceptance remains open.
**Dependencies:** none. **Acceptance:** AC2.

The [implementation record](search-01.md) gives the changes and verification
evidence. The complete search flow remains in Draft.

**Scope and main paths:** Add the failing public search specification and the
`SearchQuery` value class in `src/search-pipeline/search-query.ts`.
Define `SearchDocument` and the engine contract in
`src/search-engine/search-engine.ts`. Use
`test/unit/search-pipeline/` and
`test/acceptance/mcp/search-pipeline.test.ts`; reuse existing MCP drivers.

**Given-When-Then:** Given boundary queries and contract fixtures, when a
`SearchQuery` is constructed, then it accepts exactly 1 to 512 well-formed
Unicode scalar values with nonblank content, preserves accepted text as
read-only `value`, and rejects lone surrogates and oversized or blank input
with a fixed error. The document contract carries the original page and only
`results` or `no_results` classification.

**Done evidence:** Focused query tests show red then green, including
512/513 values and supplementary characters. The public BDD specification
states reason limits, extra-field refusal, and fixed safe outcomes. Record
its initial failure; the cross-package flow remains open until implemented.

### SEARCH-02: Prove Brave HTTP classification and full-page fidelity

**Status:** Implemented and reviewed; public search and delivery gates remain open.
**Dependencies:** SEARCH-01. **Acceptance:** AC5, AC6,
and the provider/renderer distinction in AC9. The
[implementation record](search-02.md) gives the evidence and limits.

**Scope and main paths:** Implement
`src/search-engine/search-engine-brave-http.ts`, with classification private
unless it warrants a separate coherent module. Add provider unit matrices
and `test/integration/search-pipeline/brave-markdown.test.ts`. Use realistic
captured full pages with the real cleaners early. If required safe fixture
results are lost, add only the narrow search preservation setting described
above to the HTML converter; preserve fetch defaults.

**Given-When-Then:** Given supported results, no-results, challenge, and
unknown fixtures, when the engine fetches and classifies, then only supported
DOM structures produce `SearchDocument`. The request has one encoded `q` at
the fixed HTTPS endpoint; unexpected final destinations fail. Enforce the
10 MiB bound before parsing and iterative depth checks before selectors.
Query/snippet phrases do not cause false classification. Real cleaning keeps
the expected safe fixture results and base-link behavior from the full HTML.

**Done evidence:** Focused provider tests and real-cleaner integration results
cover bounds, final destinations, phrase false positives, distinct renderer
failures, and safe content/order. Record any converter setting and passing
fetch regressions. Do not substitute a fragment or a raw live-fetch result
for the full-page fidelity proof.

### SEARCH-03: Implement the protected search pipeline and records

**Status:** Planned. **Dependencies:** SEARCH-02. **Acceptance:** AC2, AC3,
AC4, stage cancellation in AC7, and stage records in AC9.

**Scope and main paths:** Add `src/search-pipeline/search-pipeline.ts` and its
two local executors. Reuse public page-fetch steps, execution validation, and
`writeStepRecord`; extend the finite IDs in
`src/page-fetch/pipeline-step.ts`. Extend shared contract/record tests and
the search-core import guard in `.habit-hooks/eslint.config.mjs`, with
architecture acceptance coverage that refuses concrete Brave imports.

**Given-When-Then:** Given valid access, query, and UUID, when search runs,
then outgoing permits only the unchanged query and incoming receives the
original page once. Given allowed results, then Markdown must be nonblank.
Given no-results, then exactly `No search results.` follows allowed incoming
processing. Withholding or cancellation wins. Invalid inputs, stage decisions,
or failures stop later work. Only entered stages attempt one safe record with
the shared operation ID; sink failure changes no behavior.

**Done evidence:** Focused unit matrices and boundary integration tests prove
effect ordering, typed withholding precedence, malformed outcomes, cancellation,
and record counts. Shared type/record and architecture specifications pass.
The core imports contracts rather than concrete adapters or transport.

### SEARCH-04: Share renderer resources and hosted operation capacity

**Status:** Planned. **Dependencies:** SEARCH-03. **Acceptance:** AC7, AC8.

**Scope and main paths:** Expand `src/fetch-tool.ts` concrete composition and
wire `src/application.ts` and `src/hosted-workos-application.ts`. Replace the
fetch-only owner with `src/mcp/operation-capacity.ts` and update callers.
Create one actual renderer instance, load rules once, and share compatible
cleaners and setup reporting/deduplication. Add capacity, DNS, lifecycle, and
fetch regression coverage. Keep search discovery gated until this owner is
in place; SEARCH-05 adds the public dispatch.

**Given-When-Then:** Given an abandoned native DNS lookup, when the other tool
uses the shared fetcher, then its guard still applies without delaying caller
cancellation indefinitely. Given active hosted work, when another operation
arrives during rendering, incoming work, or cleanup, then it gets busy without
queuing. Check cancellation before busy, hold the slot through settlement,
and test both tool arrival orders. Self-hosted concurrency stays unchanged.

**Done evidence:** Real-composition integration and capacity tests cover shared
renderer/DNS state, reporter deduplication, held incoming/cleanup, success,
failure, abort, isolation, shutdown, and existing fetch behavior. Show that
there is one hosted slot and no lifecycle algorithm change in `MCPServer`.

### SEARCH-05: Expose MCP search with safe projection and discovery guidance

**Status:** Planned. **Dependencies:** SEARCH-04. **Acceptance:** AC1, AC9;
public confirmation of AC2, AC4, AC7, and AC8.

**Scope and main paths:** Add `src/mcp/search-tool-schema.ts` and the typed
projection in `src/mcp/search.ts`. Update `src/mcp/fetch-tool-server.ts` and
`src/mcp/tool-completion-record.ts`. Set both descriptions from the
discovery guidance above. Extend the public search and hosted-capacity
acceptance files and existing discovery, completion, and shutdown tests.

**Given-When-Then:** Given an authorized client in each edition and supported
era, when it discovers and calls search, then both tools and their planned
descriptions are exposed and the tool returns the specified result or safe
error. Guidance directs web queries to `search` and known pages to
`getURLAsMarkdown`, without a routing engine or access guarantee. Given even
malformed search arguments, then search logging runs before fetch field
projection and leaks no raw query, reason, URL, page, or failure. Dispatched
calls attempt one completion; pre-dispatch refusals emit no tool/stage records.

**Done evidence:** The representative edition-by-era flow passes, with detailed
negative matrices kept at their owning boundaries. Public cross-tool capacity
and withholding cases pass. Record descriptions, safe errors and statuses,
privacy assertions, log-failure behavior, and unchanged fetch log fields.

### SEARCH-06: Prove the pinned runtime and select the delivery gates

**Status:** Planned. **Dependencies:** SEARCH-05. **Acceptance:** AC10 and
complete verification of AC1–AC9.

**Scope and main paths:** Add
`test/acceptance/mcp/search-pipeline.runtime.ts` using the test-only canonical
URL-to-local-fixture transport described above. Select both runtime files in
`package.json` for `test:mcp:renderer` and `build:hosted`, including necessary
ordinary hosted search cases. Update the test gate policy and runtime guide.
Complete `docs/reference/mcp-search-tool.md` and affected existing references.
Run the separate pinned real-Brave end-to-end proof through adapter,
classifier, cleaners, and tool output.

**Given-When-Then:** Given pinned Lightpanda 1.0.0, when the local runtime gate
runs, then real rendering and pipeline behavior pass with canonical Brave
metadata and test-scoped network isolation. Given actual Brave access, when
the separate end-to-end proof runs with the pinned runtime, then the complete
tool result passes. The local fixture proof and prior nightly probes cannot
stand in for this live proof.

**Done evidence:** Record the selected runtime commands, pinned version, local
gate results, and dated live command/result. The final complete-candidate
report shows all acceptance criteria and required gates passing, plus
habit-hooks and ast-metrics evidence under the main plan's rules. Record any
unmet prerequisite as incomplete; do not claim a pass or skip required proof.
