# Slice 1 Staging release verification

Status: results reviewed on 23 October 2026. The full hosted journey passed.
Release remains held for the unresolved native invitation flows, the deferred
mailbox checks, and organization legal approval and implementation. Production
was not changed; signup was not opened.

## Staging evidence

The production source candidate is `9de610e8b75dfa041dcf18c5380ccf80feb9f797`.
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
| Mailbox-dependent checks | **Pending by owner choice:** fresh email verification, password reset, and consumer exact-address acceptance/refusal. No uncontrolled consumer address was used. |
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

The remaining native work is specific: verify the refusal or recovery UI when
revocation overlaps native sign-in, and resolve alternate-address joining for
an existing accepting identity with no target membership. A focused revoke
diagnostic shows “Something went wrong” on AuthKit's password page with target
access still denied. The alternate-address diagnostic reaches the unrelated
organization only. These observations do not prove a provider defect or justify
a new application-side grant. Keep both limitations visible before release.

Only the hosted live group consumes the changed test helper. Its full gate and
backend/portal builds passed; type checking passed with Node 24.20.0. Ordinary
suites, container gates, production metrics, and new layout checks are not
selected by these test-only changes. This run does not claim a separate manual
review of all desktop and mobile layouts.

The complete-candidate habit-hooks review retained one parameter-count finding,
23 existing comment findings, and one existing large test file. The fourth
helper parameter states an explicit expected landing; it keeps the test oracle
separate from the observed response and preserves existing callers. The comments
explain external provider behavior, credential handling, and suite order. The
large file keeps the live session and token-expiry scenarios together. No
snooze, rule, goal, or assertion was relaxed. Source metrics are N/A under the
path selection policy. All 11 registry diagrams remain unchanged; no production
callable contract or architecture changed.

## Legal package for opening signup

The [current source bundle](../../src/accounts/providers/workos/workos-approved-signup-documents.ts)
is the personal-workspace/User bundle `fs03-review-2026-10-16-v1`.
[FS-04](fs-04.md) records approval of those exact bytes for implementation only.
That approval does not cover organization creation, publication, or signup
opening. Do not relabel the old bundle as organization approval.

The [organization terms proposal](admin-s1-05-legal-proposal.md) contains exact
replacement wording for owner review. It is unapproved and unpublished. It has
proposed version IDs, but no approved hashes or effective dates.

The [accepted Slice 1 behavior](../design/organization-admin-plan.md#creation-and-joining--slice-1)
is that the creator agrees for the organization and confirms authority. Invited
Users and Admins receive readable Terms/Privacy links and have no separate
agreement checkbox or acceptance record. These product decisions do not prove
that the proposed legal wording is approved or that each invited person agreed.

The proposal's exact checkbox wording is:

> By checking this box and selecting Create organization, I agree to the Terms of Service shown above for the organization I am creating and acknowledge that I received and read the Privacy Notice shown above. I confirm that I am at least 18 years old, am legally able to enter this agreement, will use Thermus for business purposes, and have authority to bind this organization.

The smallest owner approval package must resolve and record these items:

- Confirm the complete organization terms, notice, and checkbox wording. Confirm
  the organization contracting party and creator authority, including personal
  email and own-business cases. Resolve how adult/business-use obligations apply
  to invited members under the organization agreement.
- Confirm that the processing permissions, privacy legal roles, lawful bases,
  and international-transfer provisions fit organization use. Confirm treatment
  of retained historical personal-workspace agreements and records. The
  23 October production cutover found no current users, memberships, or pending
  invitations, so no current user transition is required. Preserve old records;
  do not convert personal consent into organization authority.
- Approve the final complete UTF-8 bytes, readable presentation, new bundle and
  document versions, hashes, and effective/publication dates. Keep the old frozen
  manifest and existing acceptance records unchanged.
- State the approved scopes separately: runtime use, policy publication,
  and signup opening. If the inventory changes or a transition is proposed,
  approve that scope separately before execution. Approval for one scope does
  not authorize the others.

The repository assigns these decisions to the owner. No approval is recorded by
this note.

## Work after the legal decision

Approval alone does not make the current deployment ready to open signup.
After final approval, update the source bundle with the complete approved text,
new versions and hashes, and `purpose: 'organization-creation'`. The
[startup guard](../../src/interfaces/web/auth/workos/workos-signup-routes.ts)
rejects enabled signup with the current personal bundle. Update the affected
tests and documents, verify rendered text and saved acceptance facts, and run
the required source checks and review before deployment.

Reconcile two document conflicts as part of that work:

- [Hosted User onboarding](hosted-user-onboarding.md#manual-grants-and-invitations)
  still prohibits sending or resending User invitations and requires per-person
  agreement controls before delegated invitation authority. Align this text with
  the approved organization-agreement basis for invited use. Do not describe
  sign-in or invitation acceptance as individual terms acceptance.
- The [acceptance template](templates/hosted-terms-acceptance.md) still lists
  backup/restore readiness as required before opening. The owner removed that
  prerequisite, as [FS-03](fs-03.md) and
  [onboarding controls](hosted-user-onboarding.md#control-and-limits) record.
  Correct the stale template; do not introduce a new backup gate.

These are document fixes, not new release requirements. Provider evidence,
manual checks, required review, and scoped cutover remain subject to the
[S1-05 release plan](../design/organization-admin-plan.md#s1-05--complete-journey-verification-and-cutover).
