# Two MCP pipelines: deep review and simplification

Date: 2026-10-17. Historical review baseline: `41373e82`.
MCP-PIPE-01 implementation baseline: `8d12c1e7`.
MCP-PIPE-02 implementation baseline on `origin/main`: `a50382ea`.
MCP-PIPE-03 implementation baseline on `origin/main`: `12160950`.
Status: historical design and audit signed off; MCP-PIPE-01 merged in PR #155; MCP-PIPE-02 merged in PR #159; MCP-PIPE-03 in progress.
Current specification: [MCP request and response pipelines](mcp-pipelines-plan.md).

This second review replaces the first design sign-off. Two review agents used
Metz- and Martin-inspired perspectives; the manager checked their findings
against the source and repository rules. Neither Sandi Metz nor Robert C. Martin
participated in or endorsed this review. That review changed documentation only.
The review and metrics below are historical evidence. The
[MCP-PIPE-01 record](mcp-pipe-01.md) gives the completed implementation and
verification results; the user has merged PR #155. The
[MCP-PIPE-02 record](mcp-pipe-02.md) gives the implementation and passing
functional validation and verified environment restoration; the owner merged
PR #159. The [MCP-PIPE-03 record](mcp-pipe-03.md) tracks the authorized outgoing
step and local executor; complete checks, integration, acceptance, and renderer
proofs passed. Quality findings are documented; the self-hosted image passed, with hosted
image and restoration pending. Ticket 04 remains
Not started. The analysis below stays a historical review; current implementation
evidence belongs in the separate records.

## Material findings and selected corrections

| Finding in the previous plan | Evidence and correction |
| --- | --- |
| The proposed fourth `FetchOperation` argument violates the repository's three-parameter limit. | The [current signature](../../src/mcp/get-url-as-markdown.ts) already has three arguments; [habit-hooks](../../.habit-hooks/eslint.config.mjs) enforces `max-params: 3`. Replace the signal argument with `{ signal, operationId }`; update wrappers and callers together. |
| A processor that must return string Markdown cannot also return payload-free withholding. | The previous plan combined required `ProcessedPage.markdown` with a withheld result. Remove the duplicate processor/result layers from the final design. One incoming step returns allow with a string or block with a closed code. `FetchPage` returns a distinct released/withheld union. |
| The size guard had no clear owner after the neutral extraction. | The [existing guard](../../src/html-cleaner-pipeline/html-input-limit.ts) belongs to HTML processing. Put it first in the cleaner-owned adapter, before `pipeline.process` or any cleaner/parser work. The same MCP error remains; the new incoming record truthfully says failed because that step started. |
| Extraction could lose renderer diagnostics. | [The operation](../../src/mcp/get-url-as-markdown.ts) projects safe launch/readiness fields, and [composition](../../src/fetch-tool.ts) deduplicates launch reports. Preserve those callbacks, cancellation precedence, reporter-failure isolation, and [existing coverage](../../test/integration/mcp/renderer-setup-report.test.ts). |
| Mandatory `facts` conflicted with the promise that malformed telemetry cannot change a decision. | Remove custom facts and projectors. The executor creates one closed event from validated identity, outcome, duration, and code. No payload-derived fields or separate truncation policy are needed. |
| Safe record bounds assumed valid identity without assigning validation. | Validate the supplied UUID before work or logging. Bind each step to its expected role in trusted composition and validate closed IDs/codes. A step-supplied label cannot turn an outgoing block into incoming withholding. |
| A step could reject on abort while its owned work still ran. | Require `execute` to settle only after its work and cleanup. Do not race abort to an early return. Preserve the [hosted wrapper's slot ownership](../../src/mcp/single-fetch-operation.ts) and add deferred-step coverage. |
| The incoming rollout would label scan withholding as allowed, then change it in the next release. | Introduce incoming records and typed withholding together. The [scan source](../../src/html-cleaner-pipeline/prompt-injection-remover/hidden-html-removal-session.ts) already has two withholding sites; propagate a closed code without reading warning text. |
| Phase order omitted the hosted wrapper and could change refusal precedence. | [Hosted composition](../../src/hosted-workos-application.ts) wraps the complete `FetchOperation`. Keep tool/schema checks before the slot and protected operation checks inside it. Internal result conversion stays inside that operation; MCP wire projection/completion stays at dispatch. |
| Verification demanded duplicate renderer execution and presented one focused command as universal. | The [renderer policy](test-gate-policy.md#renderer-gate-mcp-p03) accepts the complete renderer phase of `build:hosted`. Record that proof once. Use the [focused-command rules](test-gate-policy.md#focused-commands) and suite-specific runtime/source commands. |
| Some names claimed more than the code supports. | Replace “MCP v1” with the current `getURLAsMarkdown` contract. Replace “one-pass processor” with “each cleaner stage runs once”; the sanitizer intentionally performs multiple scans. |

The size-check correction changes a newly proposed step event, not an existing
wire contract. Oversized HTML still reaches no cleaner or parser and still
returns the fixed processing error. Known scan withholding still returns exact
empty text; ordinary empty output remains a separate allowed outcome.

## Simplicity review by section

For each part, the review asked: “Is it as simple as it can be?” The following
choices retain the required protections while removing work with no current use.

| Part | Selected simpler form | Requirement retained |
| --- | --- | --- |
| Scope | One MCP boundary and two directions. | Only Thermus-mediated requests are covered; renderer network protections remain. |
| Preserved behavior | One short list of existing invariants and their source evidence. | Access, exact URL/Markdown, limits, fixed errors, diagnostics, and cleanup. |
| Step protocol | `execute(input, signal)` returns allow with output or block with code. | Typed inputs, transformations through allow, fail-closed decisions, cancellation. |
| Data types | URL string for outgoing; existing fetched-page record for incoming; Markdown string on allow. | No one-field request wrapper or duplicated processing summary. |
| Package boundaries | Keep the contract and executor in `page-fetch`. | Core depends on public roles; no MCP SDK, auth provider, or concrete cleaner imports. |
| Incoming adapter | One cleaner-owned step wraps the existing pipeline. | Each cleaner stage runs once; existing algorithms, counters, and warnings stay intact. |
| Logging | One fixed lifecycle event. | Correlation, outcome, duration, safe reason code, bounded fields, best-effort delivery. |
| Output validation | A small directional output check before recording allow. | A generic executor cannot validate arbitrary output by itself; invalid results never advance. |
| Lifecycle | One operation owns its work through settlement. | Late cancellation cannot permit later effects or release the hosted slot early. |
| Withholding | One typed source signal and one explicit compatibility mapping. | No warning parsing, payload on block, wrong-direction success, or new wire version. |
| Delivery | Four green tickets, with identity separated from outgoing behavior and incoming withholding delivered together. | Small deployable changes; no testing-only ticket or misleading interim incoming record. |
| Document structure | One contract section, one outcome table, and one canonical ticket appendix. | No duplicate acceptance criteria or gate instructions to maintain. |
| Verification | One applicability table linked to repository policy. | All required proofs remain; one complete renderer run can satisfy its proof. |
| Deferred features | List the boundary of this work once. | No policy engine, step-up execution, child-request interception, registry, or durable audit. |

## Revised ticket boundaries

The proposed IDs have not been created on a board. Their scope changes as part
of this review; the appendix is the current source for ticket content.

| Ticket | Current scope | Change from the first breakdown |
| --- | --- | --- |
| MCP-PIPE-01 | Extract the protected neutral operation and one cleaner adapter. | Preserve diagnostic callbacks and move the existing HTML guard with its owner. |
| MCP-PIPE-02 | Add operation identity and update wrappers and record readers. | Correlation is a small observable delivery of its own. |
| MCP-PIPE-03 | Add the common local executor and outgoing observation. | No incoming records yet; the production outgoing step only allows unchanged input. |
| MCP-PIPE-04 | Convert the cleaner adapter into the incoming step, with typed withholding and records. | Replace the transitional port; do not retain two adapters or ship incorrect allowed records first. |

The transitional `PageProcessor` port in Ticket 01 is removed in Ticket 04.
This is an adapter conversion, not a permanent extra layer. It keeps extraction
small without adding temporary no-op executors or logging bypasses.

## Review status and limits

Both agents reviewed the complete saved revision, including its ticket appendix.

- **Metz-inspired review agent:** signed off with no remaining material concern.
  The final design has one cleaner adapter, a local executor, fixed records,
  and four coherent tickets. The transitional processor port has an explicit end.
- **Martin-inspired review agent:** signed off with no remaining material blocker
  after rechecking operation, dispatch, capacity, cleaner, and withholding code.
  Permission, output validation, diagnostics, record identity, and settlement
  ownership are consistent.
- **Manager:** reviewed both reports, checked the corrected plan against the
  source, and signed off the design. Local links, heading anchors, ticket IDs,
  Markdown fences, and whitespace checks passed.

During the planning and review work, no production code or tests changed and
no implementation checks ran. Document
checks do not prove runtime behavior; every ticket must supply its own evidence
under the [test gate policy](test-gate-policy.md).

Known limits remain explicit: outgoing observation is not policy enforcement;
coverage stops at Thermus MCP; legacy completion reason/path fields can contain
sensitive text; records are best effort; and synchronous cleaner work is not
preemptible. Step-up needs a separate approval and lifetime contract when it
becomes a real requirement.

## Appendix A: AST Metrics audit

The plan author and Martin-inspired review agent independently checked the
saved report against the source. The manager reviewed their findings, checked
the selected metrics and source boundaries, and signed off these clarifications.
The four ticket scopes and earlier design sign-off remain unchanged.

### Provenance and selected evidence

At audit time, the [saved report](/Users/tomermayara/git/Thermus/ast-report/index.html)
analyzed `./src`; its data contained 115 source files. Both checkouts were at
`41373e82`, the main checkout's source was clean, and selected source files
matched this worktree. The installed CLI was observed as 0.43.1. That does not
establish the generator version of the saved report. The report was not rerun,
and its JavaScript was read as static data, not executed.

These are file totals from [the saved data](</Users/tomermayara/git/Thermus/ast-report/data/data_TypeScript.js>).
The last column is a separate function/method measurement, not a file score.

| Source | File lines | File cyclomatic total | Function/method complexity |
| --- | ---: | ---: | --- |
| `get-url-as-markdown.ts` | 68 | 16 | Returned operation: 7 |
| `fetch-tool-server.ts` | 86 | 19 | `callTool`: 7 |
| `html-to-markdown-pipeline.ts` | 31 | 3 | `process`: 2 |
| `hidden-html-scanner.ts` | 233 | 78 | `visit`: 9 |
| `website-fetcher-lightpanda.ts` | 196 | 65 | `assertSuccessfulHttpStatus`: 7 |
| `mcp-server.ts` | 274 | 77 | `drainWork`: 6 |

### Lessons applied to this plan

- Keep pipeline decisions/records out of MCP transport and renderer lifecycle
  code. Dispatch allocates the ID; the existing capacity wrapper only forwards
  context. Preserve their existing resource and cleanup responsibilities.
- Enforce the neutral import boundary, including type-only dependencies. The
  core owns its synchronous sink contract; composition adapts the application
  logger. Permit public auth/fetch contracts, including fetcher error types.
- Keep the small HTML pipeline. Add typed withholding at its two existing
  removal-session exits and propagate it; leave scanner/parser algorithms and
  the existing scan loop unchanged. Keep current cleaner order and behavior.

### Limits and unsupported inferences

The configuration at audit time scanned source only. Zero detected tests and the resulting isolation/traceability
scores say nothing about the repository's actual tests. The generated
cyclomatic findings use file totals; these are not method-complexity failures
or the current lint gate. Maintainability scores change with comment weight;
class and file maintainability/risk values describe different levels. The
Markdown class table's risk values must not be read as file safety evidence.

The saved dependency graph had only 37 entries and 32 outgoing edges for 115 files.
It omitted real imports, including the operation and fetch composition. A
community-0 no-entry claim is contradicted by the dynamic composition loaders
in [application](../../src/application.ts) and
[hosted application](../../src/hosted-workos-application.ts). Keep the
source-based import guard; the partial graph cannot establish that boundary.
The audit-time YAML's example `Model` → `Controller` restriction was not a Thermus rule.

These historical findings were diagnostic and did not add a metric goal or
mandatory AST run. The current [AGENTS.md process](../../AGENTS.md#code-quality-review-with-ast-metrics)
now requires the AST review on each complete candidate before Ready; it
supersedes that earlier limit. Follow the [current review guide](ast-metrics-review.md):
production-file goal 85, no more than three passes, justified residual scores
and review Markdown in the PR description. The baseline stays unchanged in
this implementation. No AST review or implementation checks ran for this doc update.
