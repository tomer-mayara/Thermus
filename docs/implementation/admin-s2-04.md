# S2-04 integrated audit verification and rollout

This candidate is stacked on S2-03c in PR #244. It implements the integrated
verification and release preparation in the
[organization admin plan](../design/organization-admin-plan.md#s2-04--integrated-proof-owner-rollout-and-release).

The implementation starts with the public browser, MCP, and Collector journey.
Existing behavior is characterization; a missing product behavior requires a
failing acceptance specification before its focused fix. The candidate will
record tests, manual observations, review, and unrun release gates separately.

The owner rollout must prove the selected project's restricted SQL access,
verified TLS, persistence, scoped recovery, key recovery, and zero added cost.
It also needs approved privacy information and the completed Slice 1 cutover.
A controlled test or merged source does not prove those release conditions.
