# Production deployment verification

PR [292](https://github.com/tomer-mayara/Thermus/pull/292) merged as `b0723a0a03eb2408bd1b8aeda6646a0f7c77f8d1`. The reviewed candidate is `8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0`, against trusted base `21458b0d18cc4f9efd3a59f6361a86f1acdc317c`.

Render deployment `dep-dbh91hmc6qcc73endk40` reports **live** on that exact merge SHA at **2026-10-29 00:21:34 UTC**. It was triggered once through the existing Git-backed Docker service, with cache retained. No service, billing, auto-deploy, or deployment-mode setting changed. [Trigger](trigger.json), [live state](live.json).

The candidate and merge share Git tree `68449d61251d89d00712c7e6f34ef279deaa58b5`. Shared content and canonical-guide hashes match the validated frozen files; the primary checkout is clean. [Source identity](source-identity.json).

## Live checks

- Health GET and HEAD: 200; GET body `ok`.
- Portal and same-origin assets: 200, with CSP on HTML and the Quick start navigation in the served JavaScript.
- Signed-out guide GET and HEAD: 401 without guide content.
- Signed-out MCP: 401 with the authentication challenge.
- One authenticated MCP page fetch succeeded and returned the example-domain Markdown with its IANA reference.
- No error/fatal application log was returned from `2026-10-29T00:21:34.73362Z` through `2026-10-29T00:24:15.858Z`. This is a bounded observation, not a claim about later traffic.

[HTTP smoke](public-after.json), [script](public-smoke.cjs), [MCP outcome](mcp-probe.json), [bounded log query](runtime-errors.json).

The MCP probe initially assumed the returned Markdown would contain the title “Example Domain”. The successful output had no heading. Inspection verified the page text and IANA reference; no second request or service error occurred. The [initial assertion result](mcp-probe-initial.json) remains retained.

Positive Admin UI and clipboard checks were run locally. The existing production browser session has no guide access, so this deployment check verifies the exact released source and public behavior; it does not claim a positive production Admin view or native clipboard test. See the [access limit](../browser-access-limit.md).

## Separate GitHub workflow

[Hosted image run 40793133570](https://github.com/tomer-mayara/Thermus/actions/runs/40793133570) failed before its build job started. GitHub reports recent failed account payments or a spending limit that needs to increase. Render completed its existing Git-backed build independently and reached live. No billing or image cutover was performed. [Run metadata](github-image-run.json), [annotation](github-image-run.log).

## Cleanup and history

Temporary validation checkouts, including the unused duplicate, are archived. The primary worktree remains active. [Cleanup](cleanup.json). The full review, first image-gate failure, one successful unchanged retry, initial PR draft, and prior manager hold remain available in versioned evidence. Deployment evidence supplements the original candidate/base review and does not restamp it.
