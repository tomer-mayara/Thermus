# Production deployment verification

PR [291](https://github.com/tomer-mayara/Thermus/pull/291) merged as `21458b0d18cc4f9efd3a59f6361a86f1acdc317c`. The reviewed candidate is `0445dfa6e566bf99155a6bf8f4e65c7619b3c322` against base `cc2ed669d6821525e23c6ff3d6ddcdc6339862bd`.

Render service `srv-db8mnqg473hc739d529g` at [app.thermus.ai](https://app.thermus.ai) reports deployment `dep-dbh8b77b9u1s73e901bg` **live** at **2026-10-28 23:34:26 UTC**, on the exact merge SHA. The deployment was triggered once through the existing Git-backed Docker service, with cache retained. No hosting setting changed. [Trigger](trigger.json), [live state](live.json).

The candidate and merge have the same Git tree, `f3dc8c645f693ca60320d2d536e128cefd8703a5`. Source and guide SHA-256 hashes match the validated files. The primary checkout is clean. [Source identity](source-identity.json).

## Production checks

- GET and HEAD `/healthz`: 200; GET body `ok`.
- Portal and its same-origin assets: 200; HTML has CSP, and the served JavaScript contains the Quick start navigation.
- Signed-out GET and HEAD `/quick-start`: 401, without guide content.
- Signed-out `/mcp`: 401 with the authentication challenge.
- One authenticated production MCP page-fetch call returned a non-empty text block without a tool error.
- No error/fatal application logs were returned for the bounded window from `2026-10-28T23:34:26.264784Z` to `2026-10-28T23:35:06.332Z`; this is not a claim about later traffic.

[HTTP smoke results](public-after.json), [probe script](public-smoke.cjs), [MCP outcome](mcp-probe.json), [bounded error log query](runtime-errors.json).

The positive Admin page and requested wording were verified in the local production-like browser tests, including mobile layout. This deployment check verifies the exact released source and public behavior; it does not claim a new positive production Admin UI or native clipboard test.

## Separate GitHub image workflow

[Hosted image run 40787808346](https://github.com/tomer-mayara/Thermus/actions/runs/40787808346) completed with failure before its build job started. GitHub reports failed recent account payments or a spending limit that needs to be increased. The Render deployment uses its existing Git-backed build and reached live independently. No billing, image cutover, auto-deploy, or workflow setting was changed. [Run details](github-image-run.json), [annotation](github-image-run.log).

## Cleanup and history

Both temporary gate worktrees are archived, and the primary worktree remains active. [Cleanup state](cleanup.json). The evidence branch retains earlier review commits and the original candidate/base identities. Deployment verification supplements the pre-merge check record; it does not restamp or replace it.
