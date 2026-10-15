# RHD-02: hosted portal and local health

Status: implementation started. Date: 2026-10-15.
Branch: `codex/rhd-02-hosted-portal`, stacked on
[PR #115](https://github.com/3-headed-monkey/Thermus/pull/115).

The [Render plan](render-hosted-docker-plan.md) defines this slice.
Serve the built portal and its assets with the required browser policy.
Check local startup prerequisites before listening, then serve a constant
health response. Validate hosted MCP Origin headers before authentication.
Preserve the existing listener, self-hosted, and protected-route contracts.

Write failing acceptance specifications first. Run focused tests and each
applicable gate from the [test gate policy](test-gate-policy.md) before Ready.
Implementation results and review evidence will be added here. No deployment
or merge is recorded.
