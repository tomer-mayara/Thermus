# Slice 1 Staging release verification

Historical record: the status and production observations below are from
23 October 2026. Later setup/deployment observations in the
[S2-04 ledger](admin-s2-04.md#evidence-and-release-holds) supersede the old
"signup remains closed" state; they do not by themselves prove release. Use that
ledger for current earlier-release holds and the
[S2.5-02 ledger](admin-s2-5-02.md) for removal release gates. Preserve the dated
native-flow, legal and test evidence below.

Status: reviewed on 23 October 2026. The owner approved the complete organization
legal package at 19:45:23 UTC, and its public policy pages are published and
verified. The runtime candidate passes its source, image, and Staging journey
checks. The complete metrics process and manager review are recorded separately;
the current committed candidate still needs human review and a release decision
on the native invitation limitations and deferred mailbox checks. Production
signup remains closed.

## Current runtime candidate

The approved-bundle runtime candidate on `codex/invitation-release-fixes` passed
the complete hosted live command: **28/28 tests**, eight suites, zero failures,
cancellations, skips, or todos. The log finished at 20:21:58 UTC and has SHA-256
`84e20f940a7deddb8c62129eafa55f3c737e5526a9763c5cb5764cfdf90c5af8`.
It is retained as `ast-report/invitation-fixes-2026-10-23/gate-hosted-live-runtime.log`.
The command rebuilt the backend and portal with Node 24.20.0 and used only the
Staging Keychain launcher. No production setting changed.

This run proves current password sessions, permissions, invitation administration,
MCP isolation, expiry and refresh, organization creation, first Admin, and revoked
activation replay. Its creation cases use marked test agreements. The separate
[production composition and Linux AMD64 image checks](admin-s1-approved-organization-runtime.md)
prove the approved bytes, readable documents, one unchecked creator checkbox,
saved versions/hashes, and enabled startup. Keep those evidence scopes distinct.

Fresh complete inventories before and after the live run contain exactly the
two original users and two original organizations. Full records are unchanged,
and both pagination cursors are null. The sanitized comparison is retained as
`ast-report/invitation-fixes-2026-10-23/runtime-live-inventory-comparison.json`.
The runtime source and changed test/build-context hashes match the worker gate
record; the final PR records the committed candidate and quality reports.

## Historical Staging evidence

The historical production source candidate is `9de610e8b75dfa041dcf18c5380ccf80feb9f797`.
The live run uses four corrected test files. Their diff SHA-256 is
`38818a810ab9e1ab3b46f130ae8d5c0d1845449735d75dd09f0f11c4495664df`.
The retained result also has the hash of each test file. No production source
changed for this verification.

| Check | Result and evidence |
| --- | --- |
| Full hosted live gate | **PASS: 28/28**, eight suites, no failures, skips, cancellations, or todos. 23 October 2026, 18:35:59–18:44:59 UTC, including builds and cleanup. |
| Password, browser session, organization selection, and product access | Passed in the full gate. Admin includes product access; default and inactive memberships remain denied. |
| MCP and browser isolation | Passed. Connect tokens work without MFA. Browser and M2M tokens are refused at MCP. Selection, revocation, token expiry, refresh, logout, and failed activation replay retain their controls. |
| Named organization creation and first Admin | Passed with explicitly test-only agreement documents. Saved metadata, creator authority facts, portal connection guide, and a real MCP page fetch were checked. This does not approve production terms. |
| Ordinary native invitations | Passed for User and Admin. Send, duplicate refusal, resend, revoke, terminal-state refusal, inactive reactivation, native acceptance, and current application access were checked. |
| Native role preservation and lifecycle edge cases | Nine sequential cases and one concurrent resend attempt passed. The concurrent revoke attempt preserved access controls but did not complete a verified native flow. An alternate-address new join did not create the target membership. See the [proof matrix](../testing/workos-invitation-proof-matrix.md). |
| Mailbox-dependent checks | **Pending by owner choice:** mail delivery, password reset, and consumer exact-address acceptance/refusal. The later API-assisted verification challenge below does not close these checks. No uncontrolled consumer address was used. |
| Fixture cleanup | Passed. At 19:12 UTC, complete fresh listings contained exactly the two original users and two original organizations, with unchanged records and no further pages. All native run-owned users and organizations were confirmed absent. |

The verified target is WorkOS Staging
`environment_01M4VDKATD5PXZT4H01EHCMR2A`, client
`client_01M4VDKB7C7T2GV2NWPS84HADP`, issuer
`https://reasonable-field-33-staging.authkit.app`. The local application uses
`https://localhost:46443/`, with `/login` and `/callback` registered. The existing
Keychain launcher supplies the matching test credentials; no key is stored in
these records.

Staging was aligned with the approved Slice 1 profile before fixtures were
created: password and email verification enabled; Google, SSO, and provider MFA
disabled. Admin has product, User-grant, Admin-grant, and billing permissions;
User has product access; the default and retired Super Admin roles grant none.
Unrelated provider settings and the two original users and organizations were
preserved. Final settings, roles, and application configuration match the
post-configuration readback.

### Test corrections and retained evidence

The first full run failed: 23 passed and five failed. Four failures came from
old expectations that an unassigned or unauthorized account must land at the
root portal. Slice 1 correctly opens the organization selector. The fifth read
visible access text while its Details section was closed.

The test driver now requires the exact selector destination and an authenticated
session when that is the expected landing. The tests still visit the root to
check denied access and keep the 403 assertions. The Admin case opens Details
before reading its visible text. Successful invitation landing checks remain.
The complete gate passed after these test-only corrections. A second agent
review found no weakened authorization assertion or changed fixture lifetime;
the manager reviewed the complete diff.

Local evidence is retained under `ast-report/staging-release-2026-10-23/`:
`baseline.json`, `configured.json`, `hosted-live-r1.log`, `hosted-live-r1.json`,
`hosted-live-r2.log`, `hosted-live-r2.json`, `hosted-live-r2.patch`, and the native
probe results named in the matrix. These are local review artifacts, not
uploaded CI results. The failed first run remains intact.
`final-cleanup-comparison.json` records the complete inventory comparison;
`final-configuration-readback.json` retains the final non-secret settings.

The follow-up diagnostics below add a verified ordinary-login recovery for the
revocation error and test new-user alternate signup through email verification.
They do not repair the native generic error or establish alternate target access.
These observations do not prove a provider defect or justify a new
application-side grant. Keep both limitations visible before release.

For that historical test-only candidate, only the hosted live group consumes the
changed test helper. Its full gate and
backend/portal builds passed; type checking passed with Node 24.20.0. Ordinary
suites, container gates, production metrics, and new layout checks are not
selected by these test-only changes. This run does not claim a separate manual
review of all desktop and mobile layouts.

The historical complete-candidate habit-hooks review retained one parameter-count finding,
23 existing comment findings, and one existing large test file. The fourth
helper parameter states an explicit expected landing; it keeps the test oracle
separate from the observed response and preserves existing callers. The comments
explain external provider behavior, credential handling, and suite order. The
large file keeps the live session and token-expiry scenarios together. No
snooze, rule, goal, or assertion was relaxed. Source metrics are N/A under the
path selection policy. All 11 registry diagrams remain unchanged; no production
callable contract or architecture changed.

## Follow-up native diagnostics

Follow-up probes pin `285f5f044409775c864556c335ca17f9d7f64c1f` and the same
Staging environment. They use fresh run-owned reserved-domain fixtures and
native AuthKit UI. Their sanitized local artifacts remain under
`ast-report/invitation-fixes-2026-10-23/`; original evidence is not rewritten.
The [proof matrix](../testing/workos-invitation-proof-matrix.md#follow-up-diagnostics-on-23-october)
names the artifacts and their limits.

| Check | Reviewed observation |
| --- | --- |
| Existing alternate-address joining | The target grant is absent with either existing or initially absent invited B. Login as A reaches only A's unrelated organization. The invitation is revoked with accepted A and no current role; unrelated membership and access remain unchanged. |
| New exact-address signup control | Native name/password signup succeeds: correct verified identity, one active User membership, selected target, and product access. |
| New alternate-address signup through verification | Both A and B start absent. A completes native signup and the actual verification challenge with a code from a matching current owned Events API event and `getEmailVerification`. The code stays in memory. Native verification POST is 200 and fresh A is verified, but the application opens “No organization access”; target memberships are empty and portal is 403. Alternate joining remains a release hold. |
| New exact-address reinvitation | After the alternate failure, a new invitation to A's exact address activates one User membership and correct target access. Unrelated membership ID, roles, and access remain unchanged. This verifies a recovery procedure, not alternate-address acceptance. |
| Concurrent revoke recovery | One 93 ms overlap of the observed password request and SDK revoke reproduces the native generic error. Fresh state remains revoked with no active target membership. Ordinary `/login` in a new browser context restores unrelated access only; the target is unlisted and selection is 403. AuthKit's generic error remains. |
| Owned-fixture cleanup | Each follow-up artifact confirms removal of its own resources. A complete Staging comparison at 19:59:48 UTC confirms exactly the original two users and two organizations, with unchanged IDs and full records and null before/after cursors. |

The local `final-native-cleanup-comparison.json` retains that complete Staging
comparison against the original baseline. It is separate from per-run cleanup
reads and does not monitor later changes.

The manager and an independent agent reviewed these observations. They establish
client request overlap, not provider transaction order. A pending membership
under a revoked invitation is not an active grant. An invitation's current role
may reflect a later membership: after exact reinvitation succeeds, the older
revoked invitation reports User. Keep original intended roles separately.

The verification-code API proves that the actual owned challenge completes; it
does not prove mailbox delivery. WorkOS silently drops mail to the reserved
example domains used here. Personal mailbox and controlled consumer cases remain
pending by owner choice. No uncontrolled address, direct verified-flag update,
custom activation, or application grant fallback was used.

For recovery, invite the exact address that the member uses to sign in. After an
alternate failure, an administrator checks current state and, if still intended,
sends a new exact-address invitation with the intended role. After a revoked-link
error, leave that flow and open ordinary application `/login` in a new browser
context for existing workspaces; ask the administrator about target access.
These steps do not revive a revoked link, silently alter recipient policy, or
waive any release hold.

## Approved legal package and remaining release work

The owner approved the complete version 2 bundle and publication scope at
`2026-10-23T19:45:23Z`, for `https://app.thermus.ai`. The
[approval record](organization-signup-approval-2026-10-23.md) records the actual
response, approved scope, and restricted exact-byte evidence. The
[canonical manifest](../legal/organization-signup-2026-10-23/manifest.json)
pins bundle `s105-organization-proposal-2026-10-23-v2`, complete Terms, Privacy,
checkbox versions and hashes, and the effective date. The historical proposal
and its unapproved review manifest remain historical; they are not the approval.

The approved basis is one organization agreement and creator authority statement.
Invited Users and Admins receive readable Terms/Privacy links without a separate
checkbox or acceptance record. Invitation acceptance, sign-in, and MCP approval
do not become each person's express terms acceptance. Preserve the old frozen
personal bundle and existing records unchanged.

Runtime wiring on `codex/invitation-release-fixes` is implemented; see
[approved organization runtime](admin-s1-approved-organization-runtime.md).
The historical 28/28 hosted gate and nine native cases above do not validate
those new source changes. The current runtime checks above supply separate
evidence. The quality record retains the unchanged MI goal miss and justified
Habit Hooks findings. Current-candidate human approval, release disposition, and
the scoped deployment verification remain necessary.

Marketing PR 24 was merged as `4afdad5c8869296b3bbf8b376ee98c6fcdc4d01a`.
Netlify deploy `6adbbde44eb3dfaaa5af6abb` published that exact merge at
20:05:18 UTC. Public verification passed for `/terms`, `/terms/`, `/privacy`,
and `/privacy/`: complete approved semantics, punctuation, links, all ten table
rows, effective date, versions, and hashes match. Same-host 301 redirects end at
200. Eight JavaScript-disabled visits at widths 375 and 1280 confirm direct
mailto links, no email obfuscation, and no horizontal overflow. The marketing
repository retains `reports/legal-publication/production/verification.md`, JSON,
and screenshots. This closes public policy verification, not runtime release.
Local production composition now verifies complete readable runtime presentation,
one initially unchecked creator checkbox, and saved versions/hashes. Publication
in the production application still needs deployment verification. Changed text or a delayed
effective date needs a new version, hashes, and approval as the approval record
specifies.

The read-only production inventory completed at 19:57:44 UTC found zero users
across Active, Inactive, and Pending status, zero memberships across those
statuses in each of seven organizations, and zero pending invitations. Every
list was complete; `production-inventory.json` retains the scoped result.
Historical organizations and records were untouched. This point-in-time read
needs refresh if later changes affect cutover. Preserve existing agreements and
records; a newly required transition needs its own approved scope. Resolve or
explicitly disposition the remaining native-flow and mailbox holds under the
[S1-05 release plan](../design/organization-admin-plan.md#s1-05--complete-journey-verification-and-cutover)
before opening. The Thermus runtime candidate is not merged or deployed, and
production signup remains closed. After required checks, the owner must decide
whether the verified exact-address reinvitation and ordinary-login recovery are
sufficient for release, or whether the failed alternate join and native generic
error need repair first. No release exception or recipient-policy change is
recorded here. Deferred mailbox checks are not silently treated as passes. No
backup gate is added: the owner already removed that prerequisite.
