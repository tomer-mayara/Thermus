# MCP-PIPE-02: operation correlation

Status: in progress; documentation foundation prepared; source work and checks pending.
Implementation baseline: `a50382ea` on `origin/main`.

The user authorized this slice after merging MCP-PIPE-01 in
[PR #155](https://github.com/tomer-mayara/Thermus/pull/155). The baseline also
includes the architecture evolution in PR #156. The
[reviewed ticket](mcp-pipelines-plan.md#mcp-pipe-02--correlate-operations-and-update-record-readers)
defines the scope. This record claims no implementation or passing test result.

## Scope and intended behavior

Add one operation ID to each dispatched MCP call and its existing completion
record. Allocate the UUID before tool-name and argument validation. Preserve
the same ID and signal through the protected operation, hosted capacity wrapper,
development spy, and direct callers.

Replace the third operation argument with `ExecutionContext { signal, operationId }`;
keep the three-parameter contract. Validate supplied identity once before work
or logging. Do not add an optional fallback or allocate a second ID inside the
operation. Keep current permission, URL, cancellation, and busy precedence.

Update record readers to select the event type and operation ID. A non-completion
event must not resolve `firstCompletion`. Keep one completion attempt per
dispatched call and no completion for HTTP/auth/body/envelope refusals before
dispatch. The existing completion fallback and best-effort behavior remain.
Its URL path and verbatim reason can still contain sensitive text.

This slice adds no outgoing/incoming standard steps, step records, policy,
redaction, cache, or typed withholding. Exact Markdown, empty success, fixed
public failures, renderer diagnostics, and cleanup/capacity ownership remain.

## Intended BDD and TDD evidence

Write the new acceptance case first and record its genuine failure before the
behavior exists. Then use focused TDD for identity and forwarding, keep tests
green after each change, and run the acceptance case again.

- Given concurrent dispatched calls in either edition/protocol era, when they
  finish, then IDs are distinct and each call's collaborators receive its
  original ID and signal.
- Given unknown, invalid, denied, busy, or cancelled dispatched calls, when
  they finish, then each completion has its ID. Pre-dispatch refusals still
  have no tool completion.
- Given a reader and a different event type, when that event arrives, then
  the completion wait stays pending; the actual completion resolves it once.
- Given invalid direct-call ID text, when validation runs, then no protected
  work starts and unchecked identity text does not reach records.
- Given abort or overlapping hosted work, when calls settle, then cancellation
  and busy precedence remain, and the slot stays owned through real cleanup.

Use the repository test definitions: real collaboration between packages is
integration, including protected core tests with real auth. Keep focused
single-package tests at their own boundaries and reuse existing MCP drivers/sites.
Update the current tool/logging reference and test inventory with the final
interfaces and actual changed tests after implementation.

## Verification record

No implementation suites or AST measurements have run for this foundation.
Record actual commands, exit status, test/pass/fail/cancel/skip/todo counts,
candidate revision, and reasons for retained findings as results arrive.

| Evidence | Status |
| --- | --- |
| First failing acceptance specification | Pending |
| Focused TDD and changed-test runs | Pending |
| Complete check and habit-hooks review | Pending |
| Applicable integration/acceptance and renderer/container proofs | Pending |
| Required AST delta/inspection passes and final review | Pending |
| Manager review and owner PR review | Pending |

Follow the plan's [shared verification requirements](mcp-pipelines-plan.md#verification-and-shared-definition-of-done)
and [test gate policy](test-gate-policy.md) for commands and prerequisites.
Use the current [AGENTS.md AST process](../../AGENTS.md#code-quality-review-with-ast-metrics)
and [review guide](ast-metrics-review.md): production goal 85, at most three
measurement/inspection passes, justified residuals and review Markdown in the
PR, and no baseline change in this slice.

The manager will review and commit this documentation foundation and open a
draft PR before source work. No PR is claimed open for MCP-PIPE-02 yet.
