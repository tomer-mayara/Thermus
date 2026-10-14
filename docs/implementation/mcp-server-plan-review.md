# MCP plan review: fictional Uncle Bob and Sandi Metz dialogue

Date: 2026-10-13. Status: design review of a proposed implementation.
This is a fictional conversation written for this review. It is not a quotation
from either person, an account of their participation, or their endorsement.
The speakers represent two useful design viewpoints, not personal advice.
The [updated plan](mcp-server-plan.md) contains the selected design.

## Fictional conversation

**Uncle Bob:** Start with invariants: permission before fetching, trusted tenant,
complete Markdown, and no hidden auth bypass. I propose a separate operation and
recorder so transport details cannot control these rules.

**Sandi Metz:** Separate the responsibilities, but keep their form small. A
procedure can enforce the fetch-and-clean rules, and a logger function can emit
the record. Neither needs object identity or a new lifecycle. Use existing roles.

**Uncle Bob:** Agreed. MCPServer is already a useful object: it owns request
context and connection lifetime. Keep that ownership instead of another framework.
The previous callback design loses unknown tools and invalid
arguments before logging. The adapter must own the dispatch it promises to audit.

**Sandi Metz:** Then choose the public low-level Server for one tool. Declare
its capability and use public list/call handlers and result projection. Avoid an
HTTP observer, duplicate body parsing, and private patches. Prove both wire eras.

**Uncle Bob:** We need clear record ownership so every attempted call has an
outcome. Does a two-phase recorder protect that invariant?

**Sandi Metz:** It adds a failure protocol without durable storage. One completion
record in finally is the honest promise. Guard the logger and fallback reporter
so logging does not mask the result. Earlier envelope/auth failures are separate.

**Uncle Bob:** Untrusted work needs bounds. The earlier plan added body, output,
and rule-file caps. Which bounds follow actual risks and existing behavior?

**Sandi Metz:** Keep the SDK body bound and renderer controls. Bound URL/reason
input and reuse the existing HTML byte limit before ads. Remove unrelated new
caps. Test Unicode boundaries; do not invent a secret-recognition engine.

**Uncle Bob:** Empty Markdown after sanitizer trouble looks like success. Should
the operation turn every warning into an error?

**Sandi Metz:** The sanitizer deliberately withholds HTML on some internal
failures. Preserve that contract and characterize empty outcomes. Warning text
is not a stable failure interface. A new typed status is separate product work.

**Uncle Bob:** Permissive auth cannot leak into production. A different deployment
selector would enlarge the supported security behavior.

**Sandi Metz:** Keep No Auth in test support. Inject existing verifier/resolver
contracts and use a fixed fixture identity. Real provider acceptance must prove
valid access and forged, revoked, and disabled-user refusals for this tool.

**Uncle Bob:** Request cancellation must reach the renderer. Shutdown must stop
work in both HTTP eras, not just release a server object.

**Sandi Metz:** Own the signal and active work where lifetime is known. The SDK
cancels modern work on close but not legacy work. Initiate listener close, cancel,
await tasks/drain, then close the provider. Do not claim synchronous preemption.

**Uncle Bob:** Ad rules and the renderer are production dependencies. Startup
must expose a missing dependency rather than quietly substitute test rules.

**Sandi Metz:** Load rules at server startup, not in the shared command loader.
Choose local pinned runtime first. The image lacks a renderer; a container auth
gate cannot prove rendering. Separate image provisioning from this delivery.

**Uncle Bob:** Each ticket should prove user behavior. The previous operation
acceptance preceded registration, and decisive renderer tests came too late.

**Sandi Metz:** Use three vertical slices: a complete injected HTTP tool,
lifetime/concurrency, then real runtime/provider delivery. Each starts with
acceptance, uses focused tests, and ends green. Keep the offline suite offline.

## Findings and resolutions

| Previous mistake or excess | Evidence and selected correction |
| --- | --- |
| New mandatory composition/pipeline layers | [MCPServer](../../src/mcp/mcp-server.ts) already injects auth/context. Reuse it and a type-only pipeline `Pick`; introduce no framework. |
| Handler-only audit misses rejections | The [SDK 2.3.1 pin](../../package.json) identifies the reviewed version. Its high-level `tools/call` handler checks the tool name and schema before the registered callback. Use public `Server.setRequestHandler()` dispatch for the one tool. |
| HTTP observer risks body/protocol duplication | In the [pinned SDK 2.3.1](../../package.json), the checked `createMcpHandler()` API and `CreateMcpHandlerOptions.maxRequestBodySize` control the body bound. Retain its 4 MiB default and envelope parsing. |
| Two-phase recorder implies unsupported guarantees | [Logger contract](../../src/application.ts) already exposes `info`/`error`. Emit one guarded completion record; promise no durable delivery. |
| Arbitrary new Markdown/rule caps | [Fetcher bounds](../../src/website-fetcher/website-fetcher-lightpanda.ts) and [sanitizer bound](../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts) already constrain work. Reuse them and add justified URL/reason limits. |
| Failure to distinguish withheld empty output from thrown errors | [Removal session](../../src/html-cleaner-pipeline/prompt-injection-remover/hidden-html-removal-session.ts) can withhold HTML with warnings. Preserve/characterize exact empty success; map thrown errors safely. |
| Shutdown relies on SDK close alone | The checked handler `close()` behavior from `createMcpHandler()` in [SDK 2.3.1](../../package.json) differs across HTTP eras. The [entry point](../../src/index.ts) also owns listener/provider lifetimes. Own cancellation/tasks for both eras and change disposal order. |
| Required server settings in a command-shared loader are a risk | [Local auth command](../../src/auth/local-auth/local-auth-command.ts) also calls deployment configuration. Load `AD_RULES_FILE` only in server initialization. |
| Image/runtime work and validation scope conflated | [Dockerfile](../../Dockerfile) lacks Lightpanda. Choose the local [pinned runbook](../lightpanda-runtime.md); keep container auth evidence distinct from renderer acceptance. |
| Six dependency slices delay useful acceptance | [Coding principles](../coding-principles.md) require behavior-first work. Use three green vertical slices with decisive tests in each. |

The logging backend is independent work. Use the existing logger contract without
adding exporter settings or claiming the unrelated OTel work is a prerequisite.
No fictional speaker's name substitutes for evidence or repository requirements.

## Section-by-section simplicity review

| Former plan section | Review result in the updated plan |
| --- | --- |
| Objective/scope and agreed decisions | Retain the single GET tool, HTTP, required reason, exact output, and test-only auth; remove premature production modes. |
| Proposed limits/configuration | Keep URL 8,192 and reason 2,000 code points. Reuse SDK/renderer/HTML bounds; remove the custom body, Markdown, and rule-file caps. |
| Tool schema and errors | Keep one shared schema and safe named errors. Public low-level handlers own tool validation; SDK owns protocol parsing and result projection. |
| Architecture/composition | Reuse auth/context injection and existing fetcher/pipeline roles. A procedure is enough; no forced classes, new recorder, or composition framework. |
| Test authentication | Keep the fixed test fixture and unchanged Bearer gate. Require real provider positive and negative acceptance in production delivery. |
| Call recording | Replace shared attempt/terminal state with one guarded completion record for dispatched valid envelopes. State loss and sensitive-free-text limits plainly. |
| Cancellation/lifetime | Separate per-call cancellation from shutdown. Add explicit modern/legacy cleanup and entry-point drain order; retain synchronous limits. |
| Rules/runtime delivery | Make rules server-only and local runtime the first target. Add necessary container rule fixtures; defer renderer image provisioning. |
| Acceptance/verification | Preserve test classification and policy gates. Keep renderer acceptance explicit and separate; missing prerequisites fail rather than skip. |
| Appendix/ticket dependencies | Replace six horizontal tickets with three vertical slices; no permanently red test PR or final verification-only slice. |
| Completion checklist | Use unchecked observable delivery items with no implementation claims or invented approvals. |

## Review limits and implementation checks

This review changes documents only. It does not prove implementation behavior or
claim tests ran. The first slice must characterize public SDK discovery, schema
validation, and `projectCallToolResult(result, undefined)` in both HTTP eras.
Retain existing provider tests; No Auth coverage is application-policy evidence.
Each implementation slice must follow the current [test gate policy](test-gate-policy.md).

Empty withholding remains an explicit v1 limitation. Recording is best effort,
not durable, and reason/path fields can contain sensitive text. Cancellation
cannot interrupt synchronous parsing. Local runtime delivery does not make the
current image renderer-ready. These limits are visible requirements boundaries,
not promises to add frameworks or future features in this plan.
