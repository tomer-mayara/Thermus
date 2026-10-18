# MCP-PIPE-03: outgoing observation and fixed step records

Status: in progress; documentation foundation prepared; source work and checks pending.
Implementation baseline: `121609500498e710e74b10e6058496353cf51bc2` on `origin/main`.

The user authorized this slice after merging MCP-PIPE-02 in
[PR #159](https://github.com/tomer-mayara/Thermus/pull/159). The
[reviewed ticket](mcp-pipelines-plan.md#mcp-pipe-03--add-the-outgoing-standard-step-and-fixed-records)
defines the scope. This foundation records intended behavior, not completed
implementation or passing checks. The manager will review and commit it and
open a draft PR before source work.

## Authorized scope

Add `ObserveRequestStep` and the small protocol/executor inside `src/page-fetch/`.
Use `PipelineStep<Input, Output>` with a fixed readonly ID and
`execute(input, signal): Promise<StepResult<Output>>`. Its result is
`allow { output }` or `block { code }`. The step receives no logger, operation
ID, facts bag, or context object.

The production outgoing step has ID `outgoing.observe_request`. It accepts the
original valid URL string and allows that exact string unchanged. It performs
no policy processing. The executor owns decision validation, cancellation,
safe output checks, timing, and the one step-record attempt.

Bind the outgoing role and ID through trusted composition. Only explicit
allow with the original string can reach fetch. A generic `blocked` result
prevents fetch. Throws use `step_failed`; malformed decisions, codes, or output
use `invalid_step_result`. Unknown decisions and incoming scan codes must fail
closed. Use fixture-controlled steps to prove these outcomes; add no production
blocking policy.

The executor attempts this fixed record through a core-owned synchronous sink:

```ts
{
  event: 'pipeline.step.completed',
  operationId,
  stepId: 'outgoing.observe_request',
  outcome,
  durationMs,
  code?,
}
```

Allowed has no code. Blocked uses `blocked`; failed uses `step_failed` or
`invalid_step_result`; cancelled uses `cancelled`. Duration is a finite,
non-negative rounded integer capped at `Number.MAX_SAFE_INTEGER`; invalid clock
data uses a fixed safe duration. No URL, reason, page, Markdown, headers,
credentials, warning, raw error, or result payload enters this record.

Composition adapts the application logger to the neutral sink. Preserve the
page-fetch import guard, including type-only imports: public auth/fetch contracts
are allowed; MCP/SDK/provider, application/composition, concrete cleaner,
renderer/network-policy, and concrete logger dependencies are refused.
Extend the existing architecture fixtures; add no new pipeline package,
registry, inheritance hierarchy, or facts/projector framework.

## Invariants

- Preserve order: HTTP auth/access, dispatch ID and schema checks, hosted
  cancellation/capacity, then protected cancellation/permission/URL/ID guards.
  Run the outgoing step before fetch. The existing processor stays unchanged.
- Keep the same validated operation ID and signal. New step records join the
  existing `mcp.tool.completed` ID. Unreached steps get no synthetic event.
- Outgoing block or failure projects `isError: true`, `Page fetch failed`, and
  `fetch_failed`. Cancellation keeps the existing safe result and `cancelled`
  completion. Do not use an unknown-error default to implement block behavior.
- Observe signal abort or `AbortError` before recording/advancing, even when
  the signal has not changed yet. Cancellation wins over late allow/block/error.
  An entered step settles after its owned work and cleanup; do not race abort
  against it. Keep the hosted slot until that settlement. Do not rewrite a
  completed step record if later fetch or processing cancels.
- Attempt one synchronous sink write per entered step. Sink failure cannot
  change a decision, repeat work, skip cleanup, or leave an unhandled promise.
  With a healthy sink, require exact event counts and one actual MCP completion.
  No durable or exactly-once delivery guarantee is added.
- Preserve exact Markdown, empty success, renderer reports/deduplication,
  fixed public failures, cleaner order, and current capacity ownership.
  Legacy completion URL path and verbatim reason can still contain sensitive text.

Incoming standard steps and typed withholding remain MCP-PIPE-04. Policy,
redaction, child-request interception, step-up, hashing, cache, per-cleaner
standard steps, and durable audit remain outside this slice. Traffic from an
agent's other internet tools is outside Thermus MCP scope.

## BDD and TDD intent

Write the public acceptance specification first and record its genuine failure
before implementing the new record. Use focused TDD for the protocol, executor,
observation role, sink boundary, and composition. Refactor with tests green.

- Given a permitted call in either edition and protocol era, when it finishes,
  then fetch receives the exact original URL, Markdown stays exact, and one
  allowed outgoing event joins its completion ID.
- Given a fixture step that blocks, throws, returns an unknown decision/code,
  or changes the URL or output type, when execution settles, then no fetch or
  processing starts; fixed errors and distinct blocked/failed events result.
- Given secret sentinels and a healthy sink, when records are read, then only
  the fixed safe fields exist, with exact counts and IDs. A non-completion event
  cannot resolve `firstCompletion`.
- Given a broken sink, when a step allows or blocks, then the result remains
  correct and no step or fetch repeats.
- Given abort before step settlement and delayed cleanup, when work settles,
  then cancellation wins, no fetch follows, and overlapping hosted work remains
  busy until cleanup finishes. Earlier completed records stay unchanged.

Same-package step/executor tests use public collaborator doubles. Protected
core tests with real auth remain integration. HTTP/edition acceptance proves
the observable behavior in both protocol eras. Update tool/logging references
and the test inventory in this PR when the implementation names are settled.

## Verification record

No implementation test suite or AST measurement has run for this foundation.
Record actual commands, exit statuses, candidate revision, Node counts, and
retained findings as evidence arrives. Historical results from tickets 01–02
are not evidence for this candidate.

| Required evidence | Status |
| --- | --- |
| First failing BDD acceptance specification | Pending |
| Focused TDD and each new/changed test before commit | Pending |
| Complete check | Pending |
| Habit-hooks and import guard; snooze `[]` | Pending |
| Complete integration and acceptance | Pending |
| Hosted offline build and rendered MCP proof | Pending |
| Self-hosted image and Linux AMD64 hosted image | Pending |
| Required AST passes, inspections, and review Markdown | Pending |
| Manager review, owner review, and started Actions jobs | Pending |

Follow the [shared Definition of Done](mcp-pipelines-plan.md#verification-and-shared-definition-of-done)
and [test gate policy](test-gate-policy.md#required-runs), including
[suite prerequisites](test-gate-policy.md#suite-commands) and special
[focused commands](test-gate-policy.md#focused-commands). A complete final renderer
phase in `build:hosted` can supply the renderer proof without a duplicate run.
Add any further gate required by the final changed scope.

Run the current [AGENTS.md AST process](../../AGENTS.md#code-quality-review-with-ast-metrics)
on the complete candidate after docs are updated; the
[review guide](ast-metrics-review.md) gives the commands and limits. Aim for
85 in changed production files, inspect each residual, use at most three
measurement/inspection passes, and put justified residuals and full review
Markdown in the PR description. Keep rules and baseline unchanged in this slice.
