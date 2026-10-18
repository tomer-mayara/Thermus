# MCP-PIPE-04 implementation record

Status: implementation in progress.
Baseline: `190d60f7d8af0b6e0c61017154b363a49686653d` on `origin/main`.
MCP-PIPE-03 merged in [PR #160](https://github.com/tomer-mayara/Thermus/pull/160)
on 2026-10-18 at the owner's request.

## Scope

Implement [MCP-PIPE-04](mcp-pipelines-plan.md#mcp-pipe-04--add-incoming-processing-and-typed-withholding-together).
Convert the cleaner adapter to the incoming step and remove the temporary
processor port. Carry a typed scan failure or scan limit from the sanitizer
to the incoming decision. Keep the current exact Markdown response, including
empty success for known withholding. Keep ordinary empty content allowed.

## Work and verification

Open a draft pull request before source changes. First show a failing public
acceptance case for incoming records. Use focused TDD for the typed signal,
step validation, and outcome projection. Preserve cleaner order, cancellation,
capacity, safe records, and cleanup. The manager reviews delegated work.

Run all changed tests before committing them. Run the complete checks,
integration, acceptance, renderer, both container gates, habit-hooks, and the
AST review process required by [AGENTS.md](../../AGENTS.md) and the
[test gate policy](test-gate-policy.md). Add actual commands and results here
as each check finishes. No implementation or check pass is claimed yet.
