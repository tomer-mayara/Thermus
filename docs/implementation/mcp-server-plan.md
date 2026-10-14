# MCP server implementation plan

Status: implementation plan with board tickets. Date: 2026-10-13.
This publication changes documents only; no implementation verification is claimed.
The [fictional design review](mcp-server-plan-review.md) explains the corrections.

## Objective and agreed scope

Expose `getURLAsMarkdown(url, reason)` through MCP HTTP with the existing renderer
and cleaners; return exactly their final Markdown. Both arguments are required.
Reason states why the agent needs the page. Record it without scoring/content
comparison. Check `product:access` before fetch.

Keep production Better Auth and hosted `503`. Inject the permissive
`NoAuthProvider` only from `test/support/auth/no-auth-provider.ts` as an
`IdentityVerifier` and `AccessResolver`. No auth/development flag, production
bypass, fake OAuth, username, or profile lookup. Records use canonical user
`authority` and `subject`.

HTTP is first. New stdio tool delivery, `postURLAsMarkdown`, caching, OAuth
provider work, rule subscriptions, and renderer image provisioning are deferred.
Follow [coding principles](../coding-principles.md), [AGENTS.md](../../AGENTS.md),
and the [test gate policy](test-gate-policy.md).

## Boundaries and composition

Reuse `MCPServer`'s verifier, resolver, and per-request context seam. Adapt its
`registerTools` hook to a request-server builder that receives the trusted
`RequestContext` and returns an SDK `Server` or `McpServer`. Existing high-level
probe tests can return their servers through the same builder. Do not add a DI
framework, mandatory composition helper, or provider knowledge inside the tool.

Application constructs the fetcher/pipeline once. A small operation uses existing
`WebsiteFetcher` and type-only `Pick<HtmlToMarkdownPipeline, 'process'>` contracts.
It checks permission, URL semantics, fetch output size, processing, and string result.
The MCP adapter owns reason, record, and wire result. The operation gets URL,
trusted context, and `AbortSignal`; reason never enters fetching or cleaning.

Compose `CleanHtmlAdsAdblockRs`, `PromptInjectionRemoverSanitizer`, and
`CleanHtmlToMarkdownDefuddle` in that order. Supply trusted rules explicitly.
Keep `requestedUrl` as the exact accepted input spelling and preserve the
fetcher's `finalUrl` across all stages. Rules and relative links use `finalUrl`.
Shared service instances must not hold mutable page or call state.

## Input and dispatch contract

Advertise one new tool, `getURLAsMarkdown`, with this object schema:

```json
{
  "type": "object",
  "properties": {
    "url": { "type": "string", "minLength": 1, "maxLength": 8192 },
    "reason": { "type": "string", "minLength": 1, "maxLength": 2000 }
  },
  "required": ["url", "reason"],
  "additionalProperties": false
}
```

Use one schema for listing/validation through public SDK schema facilities.
Count Unicode code points consistently; reject whitespace-only reasons and require
absolute HTTP(S) URLs without userinfo. The 8,192 URL and 2,000 reason defaults
bound renderer arguments and log input. Test exact/Unicode/empty boundaries; never
truncate accepted input. Keep reason at the MCP boundary with safe recording below.

Use the SDK low-level `Server`, declare its tools capability, and install public
`tools/list` and `tools/call` handlers for this one tool. This gives the adapter
ownership of unknown-tool rejection, argument validation, safe errors, and
completion logging before a high-level callback could miss them. Use
`Server.projectCallToolResult(result, undefined)` for wire results without an
output schema. Prove discovery and result projection in both supported HTTP eras:
modern (2026-07-28) and legacy (the SDK's supported 2025 versions).
The existing `createMcpHandler` factory accepts `Server | McpServer`.

Keep the existing MCPServer auth/context path. The SDK owns envelope parsing,
protocol negotiation, and the existing 4 MiB request-body bound with HTTP `413`.
Do not duplicate JSON parsing, buffer a second body, use a parsed-body bypass,
patch SDK internals, or write JSON-RPC.
Preserve the generic HTTP bridge's streaming behavior and unrelated routes.
Start with a small interface characterization proof of these public APIs.

## Results, failures, and existing sanitizer behavior

Success is `{ content: [{ type: 'text', text: markdown }] }` before SDK projection.
Return exactly the string, without title/footer/JSON/warnings. Missing/nonstring
Markdown or thrown fetch/pipeline errors give a safe error and no partial output.

| Condition | Public behavior |
| --- | --- |
| Missing, malformed, rejected token | Existing HTTP `401`; no operation. |
| Access or OAuth-scope refusal | Existing distinct HTTP `403`; no operation. |
| Auth/access outage; hosted placeholder | Existing generic `5xx`; hosted `503`. |
| Envelope/body rejection | Existing SDK protocol response or HTTP `413`. |
| Unknown tool at dispatch | Safe SDK `InvalidParams` (`-32602`); no fetch. |
| Invalid arguments or URL/reason | One error text, `Invalid tool arguments`; no fetch. |
| Missing `product:access` | One error text, `Access denied`; no fetch. |
| Fetch failure | One error text, `Page fetch failed`; no pipeline. |
| Thrown pipeline/HTML-size/result error | One error text, `Page processing failed`. |
| Cancellation | Stop work, classify as cancelled, and return no success. |

Tool-error results have `isError: true` and one text-content entry. Check
cancellation before generic fetch/process error mapping and again before return.
A disconnected client might receive no response. Do not repeat raw inputs or
renderer causes in messages or records; causes can include the URL in argv.

Preserve the sanitizer contract: scanner failure or eight-scan exhaustion can
withhold HTML as an empty string with warnings. Empty Markdown can mean empty
source, all content removed, or withholding; exact empty success is v1 behavior.
Characterize these cases; do not parse warnings or add a pipeline status. Removal
follows existing rules/limits, without proof that every ad or injection is gone.

## Completion records

Emit one completion record in `finally` for each envelope-valid dispatched
`tools/call`, including unknown tools/invalid arguments. Use synchronous `info`/
`error` or a narrow function; no recorder object, paired records, shared audit
state, transaction, export setup, or durability guarantee.

Record trusted authority, subject, tenant, a recognized/unknown tool label,
validated safe URL, bounded reason when structurally valid, status, and duration.
Use field-status codes for absent, invalid, or oversized values. Never copy an
unknown tool name, raw argument object, headers, token, cookie, HTML, Markdown,
or arbitrary cause into a record. For URL records, omit userinfo, query, and
fragment; fetching still uses the accepted URL. JSON-encode the record so text
cannot create extra log lines.

Guard `logger.info` and fallback `logger.error` in `finally`; emission failure gets
only a best-effort generic report. Never mask the result/error or retry fetching.
Crashes/export failures can lose records; emission is not durable exactly-once.
Reason/path can be sensitive: callers must exclude secrets. No universal secret
recognition is promised. Earlier envelope/body/auth refusals use separate safe
request/auth reports; failed auth establishes no trusted user identity.

## Limits, cancellation, and shutdown

Retain renderer timing/output bounds and private-network controls, the ad
cleaner's 256-element depth limit, and the sanitizer's 10 MiB UTF-8 HTML limit.
Reuse one named HTML byte limit for an early check before ads. Add no arbitrary
Markdown or rule-file size cap in this work.

Pass MCP signals through fetcher/process APIs; check before/after fetch, between
stages, and before return. Renderer owns child/timer/listener cleanup; pipeline
needs no MCP types. No synchronous preemption; keep guards. P01 proves per-call cancel.

P02 adds MCPServer-owned shutdown cancellation and awaits active work in modern
and legacy HTTP; SDK close alone does not cancel legacy work. Initiate HTTP close
to stop accepting, cancel MCP work, await drain/tasks, then release providers.
Revise the current listener-before-application disposal order. Repeated close
succeeds with cleanup once and isolated state for concurrent requests.

## Rules and local runtime

Propose server-only `AD_RULES_FILE`: a trusted absolute UTF-8 file read once.
Missing/unreadable rules, invalid encoding, or construction failure stops startup
and releases resources before listening. Empty files keep documented no-op
behavior; native parsing can ignore lines. No complete syntax proof or updater.

Keep this setting out of shared `loadDeploymentConfig`: account/client CLI
commands also use that loader. Commands and hosted placeholder startup require
neither rules nor renderer. The app initializer owns server-specific loading.

Deliver a local Node process with pinned Lightpanda 1.0.0 [setup](../lightpanda-runtime.md).
The image has no renderer; do not claim container rendering. If rules affect image
startup, P03 adds fixture/config mounts and Compose guidance. Renderer image
provisioning is separate future work.

## Tests and gates

The source [test inventory](../testing/test-list.md) supplies pending MCP cases.
Its username wording becomes canonical identity fields; POST remains deferred.
Update that inventory during implementation, not during this plan edit.

Start each slice with Given/When/Then acceptance, then focused failing tests,
implementation, and refactoring until green. Pure refactors start with passing
characterization. Follow DRY3; no permanently red slice or delayed decisive tests.

Unit tests double other packages at public interfaces; real auth/MCP/operation/
pipeline collaboration is integration coverage. Interface tests prove a few
contracts. Acceptance uses a real MCP client/HTTP path with external doubles.

Test-only No Auth accepts any supplied token contents with fixed synthetic
identity/workspace, only `product:access`, distinct client ID, synthetic issuer,
configured resource, finite current times, and empty scopes. Keep the Bearer gate; use other doubles
for refusals/isolation. Retain auth tests and prove real Better Auth valid-token
and forged/revoked/disabled-user tool calls. Hosted remains `503`.

Keep normal integration/acceptance offline and renderer-free. Propose
`npm run test:mcp:renderer`, which explicitly builds/runs
`test/acceptance/mcp/get-url-as-markdown.runtime.ts` outside default test globs.
It uses the real SDK HTTP path, Lightpanda, real pipeline, local JS/redirect
fixtures, and the existing test-only network seam. Missing/unsupported runtime
fails setup. Zero tests, skips, and todos cannot pass this gate. Require it before
claiming rendered tool behavior. Do not add a production network bypass.

Run changed tests before commit and complete-candidate [policy gates](test-gate-policy.md).
`check` omits full integration/acceptance/interface/container suites. MCP/auth/app
changes need integration/acceptance/container; renderer/network also needs its
interface tests. P03 adds renderer script/gate docs. Record commands/status/counts.
Keep habit snoozes empty and follow existing PR rules. This document records no implementation test runs.

## Appendix: board tickets and dependencies

Tickets were created in the Thermus project board `magumagu` and read back.
Each was in Backlog at creation. These labels map to real ticket UUIDs; the table
records status and dependencies at creation, not current implementation progress.
MCP-P01 implementation has a separate [PR #62](https://github.com/3-headed-monkey/Thermus/pull/62). Each slice starts tests first and
finishes green; this documentation publication makes no completion claim.

| Planning label | Board ticket UUID | Status at creation | Dependencies at creation |
| --- | --- | --- | --- |
| MCP-P01 | 6792e30e-bbd2-483e-958d-21db4ced6da6 | Backlog | None |
| MCP-P02 | 02309709-ecae-4199-8100-425e6c8f1973 | Backlog | MCP-P01 |
| MCP-P03 | 53db3dd7-56b9-415b-92e8-de6303d3eb3e | Backlog | MCP-P01 and MCP-P02 |

### MCP-P01 — Complete HTTP fetch tool with test-injected dependencies

Outcome/scope: prove the public low-level SDK seam, wire schema/dispatch/records,
fetch-clean operation, safe errors, early HTML bound, and per-call cancellation.
Dependencies: none. Given test-injected server auth and a real MCP HTTP client,
when a valid call uses fetcher/pipeline doubles, then exact Markdown and one record result.
Given invalid/unknown calls or cancellation, then safe errors/records occur and
later work stops. Prove both eras with unit/interface/integration/acceptance tests.
Gates: check, habit, focused tests, integration, acceptance, applicable fetcher
interface tests for signal-contract changes, container. Docs: tool contract/inventory.

### MCP-P02 — Close active work and isolate concurrent requests

Outcome/scope: own shutdown cancellation, both HTTP eras, entry-point shutdown
order, resource cleanup, and concurrent/repeated use. Dependency: P01. Given an
active modern or legacy call, when shutdown starts, then fetching is cancelled,
tasks/drain finish, and provider resources close once. Given concurrent calls
and repeated close, then contexts/results remain separate and no work leaks.
Add lifecycle acceptance first and focused tests. Gates: check, habit, focused
integration/acceptance tests, full integration/acceptance, applicable interfaces
for lifecycle/fetcher contract changes, container. Docs: lifecycle/limits/inventory.

### MCP-P03 — Deliver local production runtime and prove real behavior

Outcome/scope: server-only rule loading, real pipeline/local pinned runtime,
explicit renderer gate, required container rule fixtures, and real Better Auth
valid/refused tool calls. Dependencies: P01–P02. Given real authorized access and
JS/redirect fixtures, when the tool runs, then exact cleaned Markdown and final
URL behavior result. Given missing rules or forged/revoked/disabled credentials,
then startup or access fails without fetching. Missing runtime fails gate setup.
Add acceptance before code, including runtime cases in this slice. Gates: check,
habit, focused tests, integration, acceptance, renderer gate, applicable auth/
network interfaces, container. Docs: scripts/gate policy, runtime/rules/Compose
setup, inventory, and this plan. Image renderer delivery remains deferred.

## Completion checklist

- [ ] Implement each vertical slice with its acceptance cases green.
- [ ] Keep No Auth test-only and prove real-provider access/refusals.
- [ ] Prove safe records, exact/empty Markdown, and cancellation in both eras.
- [ ] Supply trusted rules and pinned local renderer; document image limits.
- [ ] Pass focused tests and all required gates; record actual evidence.
- [ ] Update affected guides and complete owner review and PR gates.
