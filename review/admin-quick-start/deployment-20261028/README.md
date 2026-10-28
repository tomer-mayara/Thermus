# Production deployment — Admin Quick start

PR #289 was merged by the owner as `7e9cc19a2f4d82620e745273660e35a8f1a151f3`
at 2026-10-28 18:58:09 UTC. Its Git tree is identical to the reviewed and tested
candidate `f5f8cd2e3a2297d73a44fbc2974c6eee5a59d81e`.

Render deployment `dep-dbh4gk6tlv9c73eqef00` of that exact merge commit became
**live at 19:14:54 UTC** on the existing Thermus production service,
`srv-db8mnqg473hc739d529g`, in workspace `tea-db8i6ceq1p3s73dev9og`.
Public origin: https://app.thermus.ai.

The service retained its Git/Docker build, `main` branch, automatic deploys off,
and `/healthz` readiness path. No image-runtime cutover, environment, gateway,
enrollment, provider-control, migration, or account-permission change was made.

## Verification

- Render confirms the exact merged SHA and a terminal `live` deployment.
- GET and HEAD `/healthz` return 200; GET is `ok` and HEAD has no body.
- The portal and its JavaScript/CSS/favicon assets return 200. The current
  JavaScript bundle is `index-ByeNiTlW.js` and contains the new Quick start menu
  implementation. CSP remains present on the portal and assets.
- Signed-out GET/HEAD `/quick-start` return 401 without the guide; HEAD is empty.
- The existing signed-in non-Admin session still loads Connect and workspace
  navigation, has no Quick start menu item, and is refused by the guide route.
  No console errors were reported on Connect. No Admin session was available,
  so a positive Admin view was not repeated in production. The same-tree local
  browser and WorkOS staging proofs remain the positive feature evidence.
- A real authenticated production `getURLAsMarkdown` request completed and
  returned the fetched public page. Unauthenticated MCP remains protected.
- No error/fatal runtime logs were returned for 19:14:54–19:18:04 UTC.

See [machine-readable verification](./verified.json),
[public smoke results](./public-after.json),
[source identity](./source-identity.json), and [merge metadata](./merge.json).
The browser and provider account permissions were not changed to obtain evidence.

## Failure and retry history

The GitHub image workflow run 40750011844 did not start its build because of the
account's payment or spending-limit restriction. That remains an account issue.
The current production service does not yet use that image release path; it
still uses Render's Git build, which the owner authorized us to deploy.

First Render deploy `dep-dbh4dbei0phs73cq4agg` stopped at a hosted acceptance
assertion: 188/189 passed. All five admitted MCP operations had succeeded and
the sixth call was correctly busy. The final audit receipt count included two
busy entries before the fifth successful receipt. This is consistent with the
relay's documented retry contract and the test counting transport attempts;
the status-only log does not prove which operation ID was duplicated.
The previous production revision remained live.

The unchanged retry passed all 189 hosted acceptance tests and completed the
remaining image build checks, then became live. No test, source, timeout,
assertion, configuration, or gate was changed or bypassed. The initial failure
is retained in [failure evidence](./attempt-1-failure.json) and its
[source-based disposition](./failure-disposition.md).

This record confirms this deployment, not a repair of GitHub billing or a
production migration to GHCR images. No new organization or membership was
created in production for the smoke check.
