# MCP request and response pipelines

Status: MCP-PIPE-01 merged in PR #155; MCP-PIPE-02 merged in PR #159.
MCP-PIPE-03 is in progress; MCP-PIPE-04 has not started.
Date: 2026-10-17. Historical review baseline: `41373e82`.
MCP-PIPE-01 implementation baseline: `8d12c1e7`.
MCP-PIPE-02 implementation baseline on `origin/main`: `a50382ea`.
MCP-PIPE-03 implementation baseline on `origin/main`: `12160950`.

This revision simplifies the design and changes the proposed ticket scopes.
The [review record](mcp-pipelines-plan-review.md) lists the corrections and the
historical design sign-off from both review agents and the manager. The
[MCP-PIPE-01 record](mcp-pipe-01.md) gives the tested implementation revision
and actual verification results separately from that design review.
The [MCP-PIPE-02 record](mcp-pipe-02.md) gives implementation `aa76f9f6` and
passing functional validation and verified environment restoration; the owner
merged PR #159. The [MCP-PIPE-03 record](mcp-pipe-03.md) tracks the authorized
outgoing step and local executor; complete checks, integration, acceptance,
and renderer proofs passed. Quality findings are documented; the self-hosted image passed, with hosted
image and restoration pending.
The AST audit clarifications are reviewed; see the
[audit evidence](mcp-pipelines-plan-review.md#appendix-a-ast-metrics-audit).
See [Appendix A: implementation tickets](#appendix-a-implementation-tickets)
for the four proposed work items. No board issues exist.

## Purpose and scope

Give traffic sent through Thermus MCP two explicit flows. Run an outgoing
step before fetching a page and an incoming step before returning its content.
Both use one small step contract. Each step does its work and returns allow or
block; the local executor enforces that result and attempts its fixed record.

The first outgoing step only observes the request. It returns the exact input
string unchanged and always allows it. It does no policy processing. Existing
permission checks, semantic URL validation, network protections, and limits
remain in force.

Thermus does not close an agent's other internet access. This outgoing step
sees the top-level MCP fetch URL, not each redirect or renderer child request.
Existing fetcher protections still apply to those requests. New outgoing
policy/redaction, child-request interception, step-up, hashing, caching,
per-cleaner standard steps, and durable audit storage are later work.

## Current behavior to preserve

`src/fetch-tool.ts` composes `WebsiteFetcherLightpanda` with one
`HtmlToMarkdownPipeline`: ad cleaner, prompt-injection sanitizer, then Defuddle.
Both editions use it. The existing MCP operation checks access and URL validity,
fetches, checks HTML size, processes, and returns only exact Markdown.

The current `getURLAsMarkdown` contract treats empty Markdown as success,
including sanitizer withholding after a failed scan or scan limit. Warnings
are internal data. The tool adds no title, warning, footer, structured content,
or JSON wrapper. Relative links use `finalUrl`; `requestedUrl` keeps its spelling.

Fetch and processing errors have fixed public messages without raw causes.
Cancellation remains distinct. Safe renderer launch/readiness reports remain:
only fixed launch fields or readiness category/budget reach callbacks; cancelled
work suppresses them; callback failure does not alter the result. Preserve setup
report deduplication in `src/fetch-tool.ts` and the shared renderer composition.
Move the safe callback contracts into neutral code, using public fetcher errors;
the core must not import callback aliases from `src/mcp/get-url-as-markdown.ts`.

The hosted wrapper owns one slot until its operation settles after cleanup.
Abort does not release it early. Self-hosted concurrency is unchanged.
Existing `mcp.tool.completed` records are best effort and retain their fallback
writer. They include URL origin/path and the bounded reason verbatim. These
fields can contain sensitive text. New step records must not copy them.

## Contracts and package boundaries

Keep the protocol and executor local to `src/page-fetch/`. Do not create a
separate pipeline package or a general workflow framework. Use this role:

```ts
interface PipelineStep<Input, Output> {
  readonly id: StepId;
  execute(input: Input, signal: AbortSignal): Promise<StepResult<Output>>;
}

type StepResult<Output> =
  | { decision: 'allow'; output: Output }
  | { decision: 'block'; code: BlockCode };
```

The fixed roles are:

| Step ID | Owner | Input → output on allow |
| --- | --- | --- |
| `outgoing.observe_request` | `src/page-fetch/observe-request-step.ts` | Original valid URL string → same string |
| `incoming.process_html` | `src/html-cleaner-pipeline/process-html-step.ts` | `WebsiteFetchResult` → Markdown string |

Only allow advances. Block has no output. A transform can return changed output
with allow when its role permits it; no modify decision is needed. The initial
outgoing role must preserve exact input. Use URL and Markdown strings directly.
Steps receive only input and signal; they do not own logging or correlation.
Keep per-call state local and do not mutate the fetched page.

| Boundary | Responsibility |
| --- | --- |
| `src/page-fetch/` | Protected `FetchPage`, semantic URL validator, execution context, step protocol/executor, final fetch outcome, and synchronous record-sink contract. |
| `src/html-cleaner-pipeline/` | One cleaner-owned adapter, later converted to `ProcessHtmlStep`; size guard, current cleaner order, typed withholding signal. Imports the neutral role as a type. |
| `src/mcp/` | Schema conversion, dispatch and operation ID, current MCP projection and completion record; hosted capacity wrapper remains here. |
| `src/fetch-tool.ts` | Selects and composes real fetcher, cleaner step, outgoing step, and record sink for both editions. |

The page-fetch import guard rejects MCP/SDK/provider, application/composition,
concrete renderer/network-policy, concrete cleaner, and concrete logger imports,
including type-only imports. It permits public auth contracts and
`src/website-fetcher/website-fetcher.ts`, including its public error contracts.
Reuse the existing ESLint rules and architecture-test fixtures to prove this
allow/deny boundary. Composition adapts `ApplicationLogger` to the core-owned
synchronous sink; the core must not import that logger type from application.

New pipeline orchestration and step-record emission stay in `src/page-fetch/`.
Dispatch allocates the ID; the MCP adapter owns wire projection. Preserve
`MCPServer` and renderer lifecycle ownership and algorithms. Limit changes
there to required integration. The hosted capacity wrapper forwards
`ExecutionContext` and retains its existing slot rules.

Reuse the public auth and fetch contracts. `FetchPage` accepts trusted
`RequestContext` and calls `requirePermission(context, 'product:access')`
before work.
Do not move the only permission check to MCP. Extract semantic URL validation
from the SDK-importing schema module; use the same rules at parsing and the
protected use case. SDK schema conversion may depend on those rules, not reverse.

During extraction, use a small `PageProcessor` port that returns a string and
one cleaner-owned adapter that implements it. That adapter validates Markdown
and calls the existing `assertHtmlInputSize` before `pipeline.process` or any
cleaner/parser. The core must not import that cleaner helper.

In MCP-PIPE-04, convert that same adapter into `ProcessHtmlStep` and remove the
transitional `PageProcessor` port. Do not retain a step → processor → second
adapter chain. Do not add temporary no-op runners or logging paths during
extraction. The existing HTML pipeline remains one collaborator of the step;
its cleaners run once, in the same order, with existing `Ctx` metrics intact.

The final neutral result is:

```ts
type FetchPageOutcome =
  | { status: 'released'; markdown: string }
  | { status: 'withheld'; code: 'scan_failed' | 'scan_limit' };
```

Ticket 01 returns only the released branch; ticket 04 adds the withheld variant.
The thin MCP adapter keeps `FetchOperation` string-returning. It maps only known
incoming withholding to exact empty text under the current `getURLAsMarkdown`
contract, without `isError` or structured content. Completion remains `success`.
Ordinary empty Markdown is released, not withheld.

Add the typed signal at `HiddenHtmlRemovalSession`, propagate it through the
sanitizer and `Ctx`, and consume it in the incoming step in the same ticket as
incoming records. Keep warnings for existing consumers; never parse them to
make a release decision. Do not ship a record that knowingly calls withholding
allowed and then reclassify it in a later ticket.

## Execution, errors, and capacity

Use one `ExecutionContext` with `signal` and `operationId`. In ticket 02,
replace the third `FetchOperation` argument with this context; retain three
parameters: `(url, trustedContext, execution)`. Update every direct caller,
`singleFetchOperation`, and `test/support/doubles/mcp/fetch-operation-spy.ts`.
Do not add an optional fallback or a fourth argument.

Allocate a UUID at dispatched `tools/call`, before checking tool name/arguments.
Direct neutral callers supply their own context. Validate a supplied UUID once
before work or step logging; never use unchecked caller text as a record ID.
MCP-generated contexts already use the allocated UUID. The same ID reaches the
operation, step records, and `mcp.tool.completed`; no inner layer replaces it.

Preserve this order and its error precedence:

1. HTTP authentication/access resolution.
2. MCP dispatch and ID allocation, then tool/schema checks.
3. Hosted capacity wrapper: check cancellation, then busy, then acquire slot.
4. Protected `FetchPage`: cancellation, permission, and semantic URL checks.
5. Outgoing step, fetch, then incoming step.
6. The thin operation adapter maps the neutral outcome to Markdown inside the
   hosted slot; release that slot only after the wrapped operation and cleanup settle.
7. Dispatch constructs the MCP result/completion after the wrapper returns.
   Transport cleanup has its own lifetime.

Pre-dispatch refusals still have no tool completion or step records. Dispatched
unknown/invalid/denied/busy calls get a completion ID but no record for an
unstarted step. Busy precedence must not change by moving checks across the
hosted wrapper. Do not create another capacity lock in the executor.

The local executor binds the trusted step role and ID. It does not let a
returned/supplied ID select a direction or gain the withholding exception.
It checks the decision tag, mandatory result shape, and permitted block code.
Before an allowed record or advance, it checks output for that role: outgoing
must equal the original valid string; incoming must be a string. An unknown
decision, unknown code, malformed result, or invalid output fails closed.

`blocked` is the generic block code. Only the incoming processor can produce
`scan_failed` or `scan_limit`, from its typed scan outcome. Wrong-direction
scan codes are invalid, even when their spelling is known. Map blocks explicitly:

| Outcome | MCP projection and completion |
| --- | --- |
| Outgoing block/failure/invalid result | `isError: true`, `Page fetch failed`, `fetch_failed` |
| Fetcher failure | Existing safe renderer reports where applicable; `Page fetch failed`, `fetch_failed`; no incoming step starts |
| Incoming generic block/failure/invalid result | `isError: true`, `Page processing failed`, `processing_failed` |
| Known typed incoming withholding | Exact empty success, `success` |
| Cancellation | Existing safe cancellation behavior, `cancelled` |

Do not depend on `safeFailure`'s unknown-error default to implement block rules.
Withheld carries no payload; an invalid result never releases payload. A block
follows the step's internal work and stops later standard steps/effects or
payload release. Required cleanup and terminal records still run.

Check cancellation before and after each awaited boundary. Signal abort or a
collaborator `AbortError` wins over late allow, block, or failure, including
when the signal has not changed yet. A step settles only after its owned work
and cleanup. Do not race abort against it and release capacity while it still
runs. Synchronous cleaner work cannot be preempted; existing limits bound it.
A currently executing step gets cancelled if abort is observed before its
record. Earlier completed step records are not rewritten by later cancellation.

The size guard belongs inside the incoming adapter/step. In the final flow,
oversize HTML therefore produces a failed incoming event and the unchanged
processing error, with zero cleaner/parser work.

## Fixed step records

The executor attempts one guarded synchronous write for each entered step:

```ts
{
  event: 'pipeline.step.completed',
  operationId,
  stepId,
  outcome,
  durationMs,
  code?,
}
```

`outcome` is `allowed`, `blocked`, `failed`, or `cancelled`. Allowed has no
code. Blocked uses `blocked` or genuine incoming `scan_failed`/`scan_limit`.
Failed uses `step_failed` or `invalid_step_result`; cancelled uses `cancelled`.
The step ID comes from the trusted role binding, not untrusted result data.
Duration is rounded to a finite non-negative integer, capped at
`Number.MAX_SAFE_INTEGER`; invalid clock data uses a fixed safe duration.

Fields are bounded by construction: validated UUID, two fixed step IDs, closed
outcomes/codes, and bounded duration. Do not add direction, ordinal, counters,
observation flags, arbitrary facts, per-call projectors, or byte-trimming logic.
Do not serialize step inputs/results/errors. Records contain no URL, reason,
HTML, Markdown, headers, credentials, warnings, or exfiltration targets.

A sink exception cannot change the decision, repeat a step/fetch, skip cleanup,
or create an unhandled promise. Use a synchronous sink with a single write
attempt; the existing completion record keeps its separate fallback behavior.
No durable or exactly-once delivery guarantee is claimed.

Filter test/log readers by event name and operation ID. In particular,
`mcp-fetch-site.ts` must not resolve `firstCompletion` when a step record arrives.
With a healthy sink, assert exact step event counts and one actual MCP completion
per dispatched call; do not weaken these to total-record minimums. Preserve
legacy completion fields while documenting their reason/path privacy limitation.

## Delivery overview

The proposed IDs are reassigned because no board issues have been created.
The canonical ticket bodies are in Appendix A; this table is their overview.

| Ticket | Depends on | Deployable result |
| --- | --- | --- |
| MCP-PIPE-01 | Baseline | Protected neutral extraction; unchanged behavior |
| MCP-PIPE-02 | 01 | Operation correlation and event-aware readers; no step records yet |
| MCP-PIPE-03 | 02 | Standard outgoing log-and-allow step and local executor |
| MCP-PIPE-04 | 03 | Incoming step and truthful typed withholding together |

## Verification and shared Definition of Done

Each ticket includes its tests and current docs. For extraction, establish
passing characterization before changing structure; do not create artificial
red tests. For new behavior in tickets 02–04, first write a failing public
acceptance case, then use focused TDD until it passes and refactor with green tests.

Reuse existing `test/integration/page-fetch/fetch-page.test.ts` cases
and `test/integration/mcp/fetch-tool-schema.test.ts` URL cases before adding suites.
Coordinator tests with real auth are integration tests, even with fetcher/step
doubles. Same-package step/executor tests with collaborator doubles are unit
tests. Real core-to-cleaner collaboration is integration. Keep interface tests
few and limited to contracts. Follow the [test layout](../testing/test-code-layout.md).

Run every new/changed test locally before its commit. Follow the policy's
[focused commands](test-gate-policy.md#focused-commands), including special
runtime and source build tests. For an ordinary emitted backend `.test.ts` only:

```sh
npm run build && node --test dist/test/<suite>/<path>.test.js
```

Before Ready, preserve these required proofs on the complete candidate:

| Proof | Command | Why it applies |
| --- | --- | --- |
| Complete checks | `npm run check` | Every ticket |
| Smell/import rules | `habit-hooks` | Every ticket; snooze stays `[]` |
| Integration | `npm run test:integration` | MCP changes and real cross-package tests |
| Acceptance | `npm run test:acceptance` | MCP changes and acceptance specifications |
| Rendered MCP | `npm run test:mcp:renderer` | Shared composition/cleaner changes |
| Self-hosted image | `npm run test:container` | MCP/composition server inputs |
| Hosted offline build | `npm run build:hosted` | Backend and hosted-check inputs |
| Hosted image | `npm run test:container:hosted` | Backend and hosted-check inputs; Linux AMD64 proof |
| AST quality review | [Repository scripts and process](ast-metrics-review.md#the-commands) | Every complete candidate, after docs are updated |

A complete passing final renderer phase of `build:hosted` can supply the
rendered MCP proof; record its result separately. Do not run the same proof
twice without a reason. Container passes do not replace that renderer proof.
Follow [required runs](test-gate-policy.md#required-runs) if scope changes,
including applicable renderer/network interface or auth/provider/live gates.

Use the policy's [suite prerequisites](test-gate-policy.md#suite-commands):
locked dependencies and Node 24.20.0; absolute pinned Lightpanda 1.0.0;
loopback/OpenSSL/ports; Axiom test credentials/network for full acceptance;
Docker/Buildx/Compose and image inputs; final Linux AMD64 hosted execution and
its HTTPS egress. Never relax a gate environment to make it pass.

Record each command, exit status, and Node test/pass/fail/skip/todo counts.
Missing prerequisites, zero selected tests, skipped tests, and non-runs are not
passes. Correct enforced smells or state their reasons. Update affected docs
in the same ticket. Follow [AGENTS.md](../../AGENTS.md) and the
[coding principles](../coding-principles.md), including DRY3 and small interfaces.

The current [AGENTS.md AST process](../../AGENTS.md#code-quality-review-with-ast-metrics)
is required before Ready; the [review guide](ast-metrics-review.md) gives the
commands and limits. Aim for 85 in each changed production file, use no more
than three measurement/refactor passes, and put justified residual scores and
the review Markdown in the PR description. Keep `.ast-metrics-baseline.yaml`
unchanged in this work. This requirement supersedes the earlier diagnostic-only audit.

MCP-PIPE-01 merged in [PR #155](https://github.com/tomer-mayara/Thermus/pull/155).
MCP-PIPE-02 merged in [PR #159](https://github.com/tomer-mayara/Thermus/pull/159).
The user authorized MCP-PIPE-03 from baseline `12160950`. Follow the [PR steps](test-gate-policy.md#pull-request-steps):
draft first, manual manager review of delegated work and owner review, required
checks before Ready, all started Actions jobs passed, Draft again before fixes,
and merge a clean PR once. The owner merges a new decision record. Delamain
workers follow their run prompt and do not open/merge PRs. The manager committed
the documentation foundation as `b0db5dc6`, opened draft
[PR #155](https://github.com/tomer-mayara/Thermus/pull/155), then committed the
implementation as `bcae8707`. The final evidence update changes docs only.
Earlier planning/review work changed docs only; it supplied no implementation
test results. Current implementation and check evidence must be recorded separately.

## Appendix A: implementation tickets

All IDs, titles, and labels remain local entries; no board issues exist.
MCP-PIPE-01 is **Merged** in PR #155; MCP-PIPE-02 is **Merged** in PR #159;
MCP-PIPE-03 is **In progress**; MCP-PIPE-04 is **Not started**.
These revised scopes replace the earlier appendix breakdown.
Suggested shared labels: `mcp`, `pipeline`. Each ticket must meet the shared
Definition of Done above; no testing-only or detached infrastructure ticket is needed.

### MCP-PIPE-01 — Extract the protected neutral fetch operation

**Dependency:** implementation baseline `8d12c1e7`. **State:** Merged in PR #155. **Label:** `refactor`.

The [implementation record](mcp-pipe-01.md) tracks the candidate and its evidence.

**Outcome:** Both editions use a protected neutral `FetchPage`; behavior stays
unchanged. One temporary processor port isolates the concrete HTML pipeline.

**Ordered tasks**

1. Reuse/move passing characterization from the existing operation/schema
   tests. Fill only gaps in exact/empty output, URL spelling, permission,
   fixed errors, reports, size guard, cancellation, and cleanup/capacity.
2. Extract semantic URL validation and preserve its code-point limits. Keep
   SDK conversion outside core; reuse validation at parsing and direct use.
3. Extract `FetchPage` with trusted auth context and public fetch contracts.
   Keep cancellation, `requirePermission`, and URL checks before work.
4. Add the small string-returning `PageProcessor` port and ONE cleaner-owned
   adapter. Put `assertHtmlInputSize` before any pipeline/cleaner/parser work;
   validate required Markdown there. Preserve renderer callbacks and dedup.
   Move size-guard cases to this real adapter boundary and prove zero concrete
   pipeline/cleaner calls on oversize input; retain the HTTP failure proof.
5. Wire both editions. Add the page-fetch import guard and its architecture
   proof with existing ESLint fixtures. Enforce the complete boundary above,
   including type-only imports. Do not add step plumbing.
6. Correct README claims for tenant rules/redaction/hash and HTTP-first fetch;
   describe current renderer-only fetching and MCP scope. Update current tool
   and composition docs. Complete the shared verification and Done requirements.

**Given-When-Then acceptance criteria**

- Given either edition and protocol era, when a permitted redirected page is
  fetched, then exact Markdown, final-URL links, and requested spelling remain.
- Given direct denied/invalid calls, when the use case runs, then no fetch or
  processing starts. Given empty or withheld content, then exact empty success remains.
- Given abort or collaborator `AbortError`, when work settles, then cancellation
  wins; a second hosted call remains busy until owned cleanup ends.
- Given renderer launch/readiness failure, when handled, then only safe fields
  reach reports, callback failure cannot change the fixed error, cancellation
  suppresses reports, and repeated setup failures retain deduplication.

**Main files and evidence**

- Source: `src/page-fetch/`, one adapter under `src/html-cleaner-pipeline/`,
  `src/mcp/get-url-as-markdown.ts`, schema, composition, and direct callers.
- Tests: existing operation/schema suites, real-pipeline integration,
  `test/integration/mcp/renderer-setup-report.test.ts`, edition/cancellation
  acceptance, and new `test/acceptance/architecture/page-fetch-boundaries.test.ts`.
- Rules/docs: `.habit-hooks/eslint.config.mjs`, README,
  `docs/reference/mcp-fetch-tool.md`, and affected current composition references.
- Done evidence: characterization before/after, report/import/capacity proofs,
  both editions/eras, and the shared gate evidence. No behavior feature is added.

### MCP-PIPE-02 — Correlate operations and update record readers

**Dependency:** merged MCP-PIPE-01; baseline `a50382ea`. **State:** Merged in PR #159. **Label:** `observability`.

The [implementation record](mcp-pipe-02.md) tracks this candidate and its evidence.

**Outcome:** Every dispatched call has one operation ID on its existing MCP
completion. Context reaches the whole operation without changing behavior.

**Ordered tasks**

1. Write a failing acceptance case for the additive completion ID. Use focused
   TDD for ID allocation and forwarding; this ticket emits no step events.
2. Add `ExecutionContext { signal, operationId }`. Replace the third operation
   argument, keeping three parameters. Allocate at dispatch before validation;
   validate supplied IDs once. Do not add a fallback or inner ID allocation.
3. Update hosted wrapper, debug spy, all direct calls, and production/test
   compositions. Preserve signal propagation, busy precedence, and cleanup.
4. Make readers select events and IDs; prepare `firstCompletion` to resolve
   only an actual completion. Keep exact completion counts and privacy tests.
5. Update completion/tool docs with the additive ID and existing reason/path
   limitation. Complete focused tests and shared verification/Done requirements.

**Given-When-Then acceptance criteria**

- Given concurrent dispatched calls, when they finish, then each has a distinct
  UUID and its collaborators receive that same ID and signal.
- Given unknown/invalid/denied/busy calls, when dispatch finishes, then each
  has its completion ID. Pre-dispatch refusals still have no tool completion.
- Given an event reader and a non-completion event fixture, when it receives
  that event, then no completion wait resolves. Actual completion resolves once.
- Given invalid direct-call ID text, when checked, then work cannot start and
  unchecked text does not reach records; Markdown and error contracts stay fixed.

**Main files and evidence**

- Source: execution context, MCP dispatch/completion, `single-fetch-operation.ts`,
  `src/fetch-tool.ts`, and affected operation call sites.
- Support/tests: `test/support/doubles/mcp/fetch-operation-spy.ts`,
  `test/support/in-process/mcp-fetch-site.ts`, other log readers, HTTP/edition
  acceptance, wrapper/spy contract tests, and request-isolation proofs.
- Docs: `docs/reference/mcp-fetch-tool.md` and affected logging references.
- Done evidence: new acceptance red/green, ID/signal forwarding and reader
  proofs, unchanged capacity/cancellation, plus the shared gate evidence.

### MCP-PIPE-03 — Add the outgoing standard step and fixed records

**Dependency:** merged MCP-PIPE-02; baseline `12160950`. **State:** In progress. **Label:** `outgoing-step`.

The [implementation record](mcp-pipe-03.md) gives the implemented candidate and
verified checks, integration, acceptance, and renderer proofs. Quality findings
are documented; the self-hosted image passed, with hosted image and restoration pending.

**Outcome:** `ObserveRequestStep` allows the exact URL unchanged before fetch.
The local executor enforces decisions and emits the fixed safe terminal event.

**Ordered tasks**

1. Write a failing MCP acceptance case for the joined outgoing record. Use
   focused TDD for the local protocol/executor and observation step.
2. Implement the trusted outgoing binding, decision/code checks, and exact
   string output check before allowed record or fetch. Use fixture-controlled
   block/throw/malformed steps to prove rejection; add no production policy.
3. Add the fixed synchronous record writer and bounded duration. Keep a single
   guarded write attempt and no facts/projector framework. Extend the import
   proof for local protocol/executor dependencies; no new pipeline package.
4. Wire both editions after existing guards/capacity. Test late abort and
   cleanup without racing settlement. Check secrets, counts, IDs, and broken sinks.
5. Update current tool/logging docs. Run focused cases and shared Done checks.

**Given-When-Then acceptance criteria**

- Given a valid call, when it completes, then fetch receives the exact URL,
  Markdown is unchanged, and one allowed outgoing event joins the completion ID.
- Given block, wrong-direction scan code, unknown decision, or changed/nonstring
  output, when checked, then no fetch/incoming work occurs and the fixed fetch
  error holds. The event distinguishes blocked from failed execution.
- Given sink failure, when the step settles, then its decision holds and work
  is not repeated. New records contain none of the URL/reason/payload/error sentinels.
- Given abort before step settlement, when it resolves/rejects after cleanup,
  then cancellation wins and no fetch follows; hosted capacity stays owned until then.

**Main files and evidence**

- Source: `src/page-fetch/` protocol/executor/observation, core and composition.
- Tests: same-package executor/step units with doubles; HTTP/edition acceptance;
  malformed output/code, record safety, cancellation/capacity and import proofs.
- Docs: `docs/reference/mcp-fetch-tool.md` and current logging references.
- Done evidence: acceptance red/green, exact fixed-event/count assertions,
  fail-closed/no-retry proofs, both editions/eras, and shared gate evidence.

### MCP-PIPE-04 — Add incoming processing and typed withholding together

**Dependency:** MCP-PIPE-03. **State:** Not started. **Label:** `incoming-step`.

**Outcome:** The existing cleaner adapter becomes the incoming standard step.
Records distinguish ordinary empty content from typed withholding while the
current MCP contract keeps exact empty success for known incoming withholding.

**Ordered tasks**

1. Write failing acceptance cases for incoming allowed/blocked records and
   unchanged output. Use focused TDD for the typed scan signal and step role.
2. Add typed `scan_failed | scan_limit` at the two existing
   `HiddenHtmlRemovalSession` withholding exits, then the sanitizer and `Ctx`.
   Keep the scan loop, scanner/parser algorithms, and cleaner order unchanged.
   Retain warnings for consumers; never parse warning text.
3. Convert the one cleaner adapter to `ProcessHtmlStep`; remove `PageProcessor`.
   Keep the size guard inside it before any cleaner/parser runs. Run the fixed HTML
   pipeline once and validate string output before any allowed event/release.
4. Add typed released/withheld result handling. Accept known withholding only
   from the incoming processor; reject malformed/wrong-direction codes. Map
   genuine withholding explicitly to the current exact empty MCP success.
5. Prove oversize failed-event/zero-cleaner behavior, safe counts/IDs, cancellation,
   no partial release, and capacity through cleanup. Keep previous records fixed.
6. Update tool, metrics, sanitizer, and composition docs; finish focused changed
   cleaner/integration/acceptance cases and all shared Done requirements.

**Given-When-Then acceptance criteria**

- Given normal/redirected/ad-only/hidden-only/empty pages with completed scans,
  when processing ends, then each existing cleaner stage runs once, exact
  Markdown remains, and allowed incoming records join outgoing/completion IDs.
  Ordinary empty remains allowed.
- Given real failed scan or eight-scan limit, when incoming work ends, then
  the event is blocked with its known code and no payload escapes; exact empty
  success has no error/structured content and completion stays `success`.
- Given changed warning wording, when the typed signal is unchanged, then the
  decision is unchanged. Unknown/wrong-direction codes never get empty success.
- Given oversized HTML, when the entered incoming step checks its limit, then
  a failed incoming event and fixed processing error result, with no cleaner work.
- Given invalid output, generic block, failure, or abort, when work settles,
  then no partial text escapes, cleanup/terminal records run, earlier records
  stay unchanged, and hosted capacity remains owned until settlement.

**Main files and evidence**

- Source: cleaner adapter converted to `process-html-step.ts`, HTML removal
  session/sanitizer/`Ctx`, neutral outcome, core, composition, and MCP adapter.
- Tests: sanitizer units, real-pipeline integration, exact HTTP/edition output,
  known/unknown/wrong-direction outcomes, oversize, record safety, and cleanup.
- Docs: `docs/reference/mcp-fetch-tool.md`, `docs/reference/pipeline-metrics.md`,
  affected sanitizer and composition references.
- Done evidence: acceptance red/green, real signal propagation, ordinary-empty
  and invalid-result proofs, both editions/eras, plus shared gate evidence.
