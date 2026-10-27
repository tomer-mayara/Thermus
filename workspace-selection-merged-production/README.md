# Merged workspace-picker deployment

The user reported that PR #281 was merged and asked to deploy it. GitHub confirms
merge commit `89e79754482704534530936c1cef7850394abb6f` at
2026-10-27 23:06:59 UTC. Its complete Git tree equals reviewed PR head
`44753a72a7c1cecbf076e1448c26a4ae4b93a9f2`.

[Source equivalence](source-equivalence.json) preserves both tree hashes and
compares app, tests, dependencies, Dockerfile and TypeScript build configuration
with the previously deployed and role-verified `feaddbde`. Those inputs are
unchanged. The inherited release workflow/scripts and immutable metric record
remain part of this merged revision; they were covered by the earlier refreshed
checks. No new source changes or checks are claimed in this deployment turn.

[Authorization and trigger](authorization-and-start.json) records the user's
current request, service identity and exact deployment response. Production
remains the existing Git-backed Render service with automatic deployment off.
The authenticated Render connector started deployment
`dep-dbgiufou01pc73c7irl0` at 23:09:51 UTC for the exact merged commit. No service
migration, settings change, new deployment pipeline or credential was needed.

The prior staging gate result remains 22 passed / 7 failed because of the WorkOS
sandbox invitation-email quota. This deployment does not relabel it as passing
or erase the prior report. The owner completed the merge and explicitly asked
for the merged revision to be deployed. The prior failed agent merge attempt and
review history remain in the immutable release-refresh report.

Render confirms this exact commit is live since 23:12:56 UTC. The new instance is
`srv-db8mnqg473hc739d529g-xt2q4`. [Verification](verification.json) records fresh
post-deploy browser observations. Both accounts clicked the selected organization
and reached Connect at `/`, with workspace Thermus AI. The user role sees Connect
and Switch Workspace on both pages; the admin role also sees Members and Audit
Log. Members and Audit Log links open correctly, and the user's selected workspace
persists when the picker is reopened. Both sessions were returned to Connect.

[Health and assets](public-assets.json) returned 200: health body `ok`, portal HTML,
favicon, JavaScript and CSS. The bounded warn/error query on the new instance is
empty. Screenshots of the [user picker](user-picker.jpg) and
[admin picker](admin-picker.jpg) show the compact menus. No account, role,
membership, invitation, audit destination, credential or environment setting was
changed. The record keeps its exact one-workspace/two-account verification scope.

The merged deployment is complete. The source tree is clean; the worker check
worktree was already archived after its evidence was preserved. Existing review,
approval and failed-run history remain in the preceding immutable artifacts.
