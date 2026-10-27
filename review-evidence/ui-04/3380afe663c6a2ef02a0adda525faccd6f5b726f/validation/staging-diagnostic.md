# UI-04 staging run

The full required `npm run test:hosted-live` ran once with the reviewed staging
launcher and pinned absolute Lightpanda. It started at 2026-10-27T00:04:01.047Z
and ended at 00:13:29.012Z, exit 1. It reports 29 tests: 22 passed, 7 failed,
zero skipped, cancelled or todo. Both dedicated entries ran.

Six cases in the member-read, invitation, retired-grant and administration
server groups share the rejected administration fixture promise. The WorkOS
sendInvitation request returned HTTP 429 with `Sandbox environment email quota
reached for invitation emails.` Its request ID is
`0d4634a5-a117-4fc9-b0a6-fb48960c158f`; retryAfter is null. These cases did not
establish their new pending-row assertions. No reset time is known or claimed.

The separate scoped removal case failed at the fresh invitation POST after
removing the User and acting Admin: actual HTTP 503, expected 303. This is the
assertion at emitted hosted-removal.live.js:212, corresponding to the invitation
send in the source. Its returned status does not establish the provider cause.
Do not attribute this failure to quota as a proven fact. The preceding scoped
journal records unsafe-request refusals, User and self removal, loss of original
workspace access, and preserved account/other-workspace portal and MCP access.
Fresh rejoin and replacement-role proof did not complete.

The exact-resource journal ends with cleanup-complete and no failures. All
owned IDs were verified according to the existing cleanup rules. The main live
group's after hook completed without a reported cleanup failure. Local fixture
containers/networks are checked again after all container gates end.

This preserves the parent's separate history: UI-03's earlier full run passed
28/29 with a missing third-invitation Revoke form; its later focused diagnostic
failed setup with the sandbox quota. Neither this run nor the later quota proves
the cause of that earlier missing form. The parent report stays authoritative
for its own candidate. No waiver, provider setting change, paid upgrade or
production fixture operation was used. Retry the required full group only when
staging can send invitations and investigate any remaining HTTP 503 separately.
