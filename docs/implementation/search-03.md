# SEARCH-03: Protected search pipeline and records

Date: 2026-10-20.
Status: implementation in progress.

This record covers [SEARCH-03](search-pipeline-plan.md#search-03-implement-the-protected-search-pipeline-and-records).
Start from merged SEARCH-01 and SEARCH-02 at
`304cd24fd0f198716c372bd2ec404eeffc12a132`.

The scope is the protected `SearchPipeline`, its two local stage executors,
shared finite step IDs and record contracts, and the search-core import guard.
Check access, query, and operation ID before work. Preserve the full engine
page, apply incoming decisions before release, and record each entered stage
once without query or page data. Keep cancellation and safe renderer failure
reports distinct from provider failures.

Write the executable behavior specification first, then implement and check
the local contracts. Record test-first evidence, selected checks, quality
findings, and manager review here before delivery. Shared application
composition and public MCP registration remain in SEARCH-04 and SEARCH-05.
