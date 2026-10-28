# Deployment verification

PR [290](https://github.com/tomer-mayara/Thermus/pull/290) merged as `cc2ed669d6821525e23c6ff3d6ddcdc6339862bd`. Its tree equals validated candidate `3e5931a080c88e0331cdd27cc036b37efbd8d80c`: `a9d110c5c1094c4962d6ea980ffe8655ad5f394b`.

The existing Git-backed [Render service](https://dashboard.render.com/web/srv-db8mnqg473hc739d529g) has automatic deployment disabled. One manual deployment, `dep-dbh747gn74is73blrsp0`, built the exact merged revision and became **live at 2026-10-28 22:11:00 UTC**. It passed on the first attempt. No service settings or production access were changed. [Trigger](trigger.json), [live status](live.json), [source identity](source-identity.json).

Post-deploy checks passed at [app.thermus.ai](https://app.thermus.ai): GET and HEAD health returned 200; the portal and built JavaScript/CSS assets returned 200; the portal supplied CSP; signed-out Quick start GET/HEAD returned 401; and MCP without authorization returned 401 with its Bearer challenge. A real authorized production MCP page fetch returned nonempty Markdown without an error. [Public probes](public-after.json), [verification summary](verified.json).

The current authenticated browser loaded the Connect page without console errors. Its current account/session lacked Admin-page access and received Access denied for Quick start. Thus no positive Admin production screenshot is claimed. The removed action is proven by the exact deployed tree, the local Admin screenshots/browser cases, and the real staging signup flow. No role or account was changed for verification.

Render returned no application error/fatal log entries for 22:11:00–22:12:45 UTC. This is a bounded observation, not a future uptime guarantee.

The separate [GitHub image-publishing run](https://github.com/tomer-mayara/Thermus/actions/runs/40777427070) did not start its runner because of the existing account payment/spending-limit issue. [Diagnostic](github-image-run.log). That run did not produce a new GHCR image. Production still uses the verified Render Git build; no migration, billing setting, or workflow bypass was applied. The local final Linux AMD64 image gate passed before merge.

The managed validation worktree was archived after its safe evidence was copied. Primary checkout remains clean. No deployment retry was needed.
