# Habit-hooks dispositions — final v4

Candidate: `44753a72a7c1cecbf076e1448c26a4ae4b93a9f2`.
Base: `a421afc056ce3e400f2779c75683ea45270b96cb`.
Input: `ast-report/workspace-selection-release-refresh/habit-hooks-final.log`.

Retain all 21 comment findings and both test-file length findings for the reasons
below. No suppression or snooze is needed. These are judgments about the complete
candidate, not waivers based only on whether a line existed on main. This review
did not run habit-hooks. The final current-candidate runner has manager-reported exit 1. The raw final log
is independently checked and byte-identical to v3; it has no execution-status field.
The snooze file was independently read and remains exactly the empty JSON array
`[]`; its byte hash is retained in habit-hooks-review-final-v4.json. No finding is
presented as corrected or as a zero-finding pass.

| Findings | Path and lines | Reason to retain |
| --- | --- | --- |
| 4 comments | test/integration/auth/workos-provider-organizations.test.ts:25-28 | Defines the test boundary: real SDK/provider/session/routes with a fake remote API and substituted destinations. It prevents treating this integration proof as real WorkOS evidence and identifies the live gate that covers that limit. |
| 1 comment | Same file:37 | Explains why billing is deliberately absent from the substitute destinations: the route owns a real billing page. Without this reason, the missing entry looks like a coverage gap. |
| 2 comments | Same file:49-50 | Gives the compact cross-workspace role matrix behind isolation and permission cases: User here, Admin there, inactive/default elsewhere. The table's purpose spans several fixture records and is useful when checking that a different workspace cannot supply authority. |
| 1 comment | Same file:107 | Defines the remote-request assertion scope. JWKS discovery is excluded from the organization-call trace so key-set traffic is not mistaken for a membership/catalog read. That scope matters when interpreting the new picker-read assertion. |
| 2 comments | src/interfaces/web/account/account-routes.ts:11-12 | Records the division of authority: route session/current-access admission does not replace each operation's permission check. The local AccountOperation type cannot express that security obligation. |
| 2 comments | Same file:74-75 | Explains why signed-in failures become pages and why immutable answers are reconstructed: refreshed or ended session cookies must reach the browser on errors too. |
| 1 comment | Same file:93 | Records dispatch precedence: dedicated administration handling must run before the generic account operation fallback. This is a collaboration constraint, not a reason to move authorization into the fallback. |
| 1 comment | Same file:107 | States the changed picker invariant: identity admits the recovery page; optional access controls display only. It prevents a later refactor from turning the display lookup into an admission gate. |
| 2 comments | Same file:132-133 | Explains origin-before-body order and current-membership authority. A foreign form must cause no body/service work, and the session must switch to the ID confirmed by the service rather than an untrusted request hint. |
| 3 comments | Same file:162-164 | Explains cookie precedence and response reconstruction. Session-refresh cookies must precede a later switch cookie, including when redirect headers are immutable. The order affects actual browser session state. |
| 1 comment | Same file:172 | Explains directory normalization for relative route paths. The missing final slash would otherwise change URL resolution and public-base containment. |
| 1 comment | Same file:186 | Explains why cloning precedes freezing: later mutations to resolver-owned records must not change a running operation's context, and the route must not freeze the collaborator's own object. |
| File length, 553 lines | test/acceptance/auth/hosted-member-removal-browser.runtime.ts | Keeps the dedicated browser gate's shared workspace shell and Members/Audit/Connect/picker viewport and JavaScript matrix discoverable under one entry point. Protocol mechanics already live in drivers, including the new WorkspaceSelectionBrowser. A threshold-only split would scatter the matrix without simplifying source behavior. |
| File length, 234 lines | test/integration/auth/workos-provider-organizations.test.ts | One integration subject verifies the real provider/session/account-route collaboration against a pinned local WorkOS API fake. Offered memberships, current permission isolation, exact remote reads and rejected provider data share one role matrix and composition. Keeping them together makes the new optional-read phase comparable to unchanged selection authority. |

The grouped counts are 8 test comments plus 13 production comments, for 21 total,
and 2 test-file length findings. No source behavior fix is needed for these
findings. New picker/source functions have no habit complexity finding in this log;
MI/CRAP and other metric goals are separate evidence and are not inferred from it.


## Comparison and current-head scope

The final log is byte-identical to both the source v3 and final v3 logs: all 21
comment locations and two oversized-file locations remain. No finding was added,
removed or reclassified. Log SHA-256:
`73e37e90397119b59a10b57c2b5759fc03192ad65dab32335a1baab4b1bde1d4`.
The manager reports the current final runner exited 1. The reviewer independently
checked its output and empty snooze, but did not run the hook.

All three containing files are byte-identical to their earlier reviewed versions.
The SO-02 merge leaves all src/test bytes unchanged; the final commit adds only
an immutable metric record. Final-head-input-bridge-v4.json carries source review
at e36e34c9 to final44753a72 against a421afc0. The same real-SDK/local-fake and
live-evidence boundary, current workspace isolation, cookie authority and browser
matrix cohesion reasons above remain valid. The exact visible-label readiness
wait remains in the separate browser helper, with no larger timeout or sleep.

All 23 findings are retained with reasons, not called fixed or zero-finding pass.
Snooze remains []. No tracked source, suppression or configuration change is
recommended. Metrics and all other gates use separate evidence and their original
pins. Prior v2/v3 reviews and gate history remain preserved and are not relabelled.
