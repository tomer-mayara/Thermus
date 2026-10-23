# WorkOS native invitation proof matrix

This runbook covers the provider proofs required by
[S1-04b](../design/organization-admin-plan.md#s1-04b--invitation-acceptance-and-trusted-landing)
and [Native invitations — Slice 1](../design/organization-admin-plan.md#native-invitations--slice-1).
This record separates the completed native checks from the checks that remain
unproven. See [Staging release verification](../implementation/admin-s1-staging-release-verification.md)
for the full hosted journey, the approved legal package, and the remaining release gates.

## Verified target and remaining holds

The authorized verification on 23 October 2026 used this Staging configuration:

- Environment: `environment_01M4VDKATD5PXZT4H01EHCMR2A`.
- Client: `client_01M4VDKB7C7T2GV2NWPS84HADP`.
- Issuer: `https://reasonable-field-33-staging.authkit.app`.
- Login, callback, and sign-out URLs: `https://localhost:46443/login`,
  `https://localhost:46443/callback`, and `https://localhost:46443/`.

The existing `~/.config/thermus/with-workos-staging.cjs` launcher supplies the
matching client and issuer and reads the test key from Keychain. No new key was
needed. Staging was aligned before the run: password and email verification
enabled; Google, SSO, and MFA disabled. Admin has the four Thermus permissions;
User has product access; default and retired roles have none. The release record
describes the configuration changes. Production was not changed.

The historical full hosted gate passed 28 tests. Mail delivery, password reset,
and consumer exact-address acceptance/refusal remain pending by owner choice.
A later owned reserved-domain probe completed an actual email-verification
challenge with a code read through the documented provider API; it does not prove
mail delivery. No consumer mailbox was invented or used.
An unresolved native proof remains a release hold; a passing ordinary invitation
test does not substitute for that proof.

## Prerequisites and safety

Use only an authorized, verified test environment. Reserve it for one run. The
current live harness can delete stale resources with the shared `thermus-live-`
and `Thermus live ` prefixes, so two runs must not overlap. Do not start its
fixture setup until the environment holds are resolved and its cleanup scope is
confirmed.

Use fresh, run-owned organizations, identities, and invitations. Use verified
password identities for existing-user cases; new-user signup controls must prove
that both planned addresses are absent before sending the invitation.
Keep each case independent. Use separate fixtures for each role direction,
acceptance order, and race attempt. Record fixture IDs in a run-owned inventory.
Never use a customer membership or an existing person's account. Corporate
alternate recipients must have different addresses in the same approved test
domain. Address/domain matching alone must not create membership.

The consumer case needs controlled, authorized consumer-domain recipients: one
exact invited identity and a different identity. Confirm mailbox control, provider
classification, and cleanup ownership before the run. Do not invent consumer
addresses or use an uncontrolled mailbox. An `example.net` fixture does not prove
consumer exact-address behavior.

Do not record API keys, passwords, verification codes, tokens, invitation links,
or query strings. Keep invitation credentials in memory only. Use the native
WorkOS acceptance flow. If the actual UI cannot select the planned identity or
shows an unknown step, stop that case and record the limit. Do not guess UI steps
or add a Thermus acceptance endpoint, activation registry, or acceptance record.

## Assertions and observations

Read the accepting identity's membership directly from WorkOS before and after
each operation. Record membership ID, organization ID, status, and the complete
role set. Require one intended membership and compare its actual roles. An
invitation's `role_slug` reflects its current membership role; it is not immutable
proof of the role originally invited. Record each invitation's intended role
before acceptance separately from its later representation.

For a new join, require exactly one active membership for the accepting identity
in the intended organization, with the intended role. Portal arrival, an
`acceptedUserId`, or a revoked invitation alone does not prove activation.
Check the authenticated identity and selected organization, then check current
application access. For an existing member, require the same active membership
ID and roles after each attempt.

After an ambiguous response or a race, wait for both operations to settle and
make fresh reads of the invitation and membership. Record each operation's
sanitized result, the observed terminal state, and access in the intended and
unrelated organization. Do not assume which concurrent operation wins. A pending
read does not prove email delivery. Do not blindly resend, retry an unknown write,
or claim revocation after acceptance.

## Exact proof matrix

| Case | Initial state and action | Required observation |
| --- | --- | --- |
| Corporate User preservation | Identity A has active User only. Send an Admin invitation to different same-domain address B. Accept that invitation as A. | The same active membership keeps User only. No additional active membership or Admin access appears. |
| Corporate Admin preservation | Identity A has active Admin only. Send a User invitation to different same-domain address B. Accept as A. | The same active membership keeps Admin only. |
| Overlap, User first | Send User and Admin invitations to two different same-domain addresses in one organization. One identity accepts User first, then attempts Admin. | After the first acceptance, active membership has User only. The second attempt does not change that active role. Record whether the provider accepts or refuses it. |
| Overlap, Admin first | With independent fixtures, the same arrangement accepts Admin first, then attempts User. | After the first acceptance, active membership has Admin only. The second attempt does not change that active role. Record the provider outcome. |
| Acceptance and resend | Use a fresh invitation for each ordering: accept then resend; resend then accept; concurrent acceptance and resend. | Record both results and fresh states. Acceptance gives the intended role without changing any existing active role. A late resend must not create another grant. Do not infer the concurrent winner. |
| Acceptance and revoke | Use a fresh invitation for each ordering: accept then revoke; revoke then attempt acceptance; concurrent acceptance and revoke. | Late revoke does not remove an accepted membership. A confirmed revoked invitation grants no access. Record both results and fresh states for the concurrent attempt without assuming its winner. |
| Consumer exact address | Invite a controlled consumer address. Attempt acceptance as a different controlled identity; then use the exact identity, with a fresh invitation if needed to isolate the attempts. | The different identity gains no membership or access. The exact identity can accept with the intended role. Unrelated organization access is unchanged. |

For every case, inspect application pages and sanitized logs for invitation
credential leakage. Check current access through public application interfaces.
Preserve access to unrelated organizations after refusal. Stop and hold release
if an active role changes or preservation cannot be proved.

## Existing automated coverage and its limits

The existing live
[administration proofs](../../test/acceptance/auth/hosted-live/administration-proofs.ts)
cover pending invitation creation, duplicate and active-address send refusal,
resend, revoke, and terminal-state refusal through the real directory adapter.
The live
[administration server cases](../../test/acceptance/auth/hosted-live/administration-server.ts)
cover exact-recipient User/Admin acceptance and inactive membership reactivation
through AuthKit. These cases also check application access and credential
exclusion. They passed in the 23 October full hosted gate; they do not by
themselves cover the matrix above.

The current
[invitation browser driver](../../test/support/hosted-live/portal-visit.ts)
waits for successful portal arrival. The
[AuthKit driver](../../test/support/hosted-live/authkit-driver.ts)
does not define all refusal or controlled race outcomes. Disposable probes add
observations of the actual native flow, strict membership checks, and fresh
application access checks. An unfamiliar UI or unresolved write stays unproven.
Do not replace missing native proof with fake or SDK request-test behavior.

Retain the browser/MCP separation proof in
[organization integration tests](../../test/integration/auth/hosted-organizations.test.ts)
and the live
[signup server cases](../../test/acceptance/auth/hosted-live/signup-server.ts).
The [portal acceptance tests](../../test/acceptance/user-portal/portal.test.ts)
check the readable Terms and Privacy link labels. Invited use must add no creator
agreement checkbox or acceptance write.

## Results

| Case | Status | Evidence / limit |
| --- | --- | --- |
| Exact-address new join control | PASS | One active User membership, matching native identity and selected target, and product access. |
| Corporate User preservation | PASS for the tested same-domain identities | The original active User membership ID and role remain. Admin access stays denied. |
| Corporate Admin preservation | PASS for the tested same-domain identities | The original active Admin membership ID and role remain. Admin and product access remain. |
| Overlap, User first | PASS | Exact-address User invitation accepted first; second invitation addresses another same-domain identity. The second attempt keeps the same active User membership. |
| Overlap, Admin first | PASS | Independent fixtures accept exact-address Admin first, then attempt the alternate User invitation. The same active Admin membership remains. |
| Accept then resend | PASS | HTTP 400; fresh invitation still accepted, with the same active User membership. The error cause is not inferred. |
| Resend then accept | PASS | Matching pending resend response, then native acceptance and one active User membership. |
| Concurrent acceptance/resend | PASS for one measured attempt | Browser password request and SDK resend overlap by 310 ms. Resend returns pending; fresh state is accepted with one active User membership and correct native target access. |
| Accept then revoke | PASS | HTTP 400; fresh invitation still accepted. The accepted membership and access remain. |
| Revoke then attempt acceptance | PASS | Matching revoked response; native page shows “Invalid invitation”; no active target membership or access. Unrelated access remains. |
| Concurrent acceptance/revoke | Native error remains; ordinary-login recovery verified separately | The historical attempt overlaps by 83 ms and preserves access controls. A later independent attempt overlaps by 93 ms, reproduces the generic native error, then signs in normally in a fresh browser context. Only the unrelated authorized workspace is available; the revoked target remains denied. |
| Alternate-address new join diagnostic | Required target activation not observed; release hold | Existing A with existing or absent B, and new A with absent B, all fail to gain target membership. New A completes actual email verification, but reaches “No organization access” with portal 403. The invitation is revoked with accepted A and no current role. |
| New exact-address signup control | PASS for one User invitation | Both addresses start absent. Native name/password signup creates the intended verified identity, activates one User membership, and selects the target with product access. |
| Fresh exact-address reinvitation recovery | PASS for one existing User identity | After alternate acceptance leaves no target access, an administrator sends one new invitation to A's exact address. Native acceptance activates one User membership with correct target access; unrelated membership and access remain unchanged. This does not fix alternate acceptance. |
| Consumer exact address | PENDING by owner choice | Controlled consumer mailboxes are not authorized for this run. |

The historical nine-case sequential run and initial race probes use production
source `9de610e8b75dfa041dcf18c5380ccf80feb9f797` and the four live-test corrections
identified in the release record. The follow-up diagnostics below pin
`285f5f044409775c864556c335ca17f9d7f64c1f`. Neither set proves the checks for
the current runtime changes in progress. All native probes use fresh `example.net`
identities, not controlled consumer mailboxes. The results do not establish a
general provider classification for all email domains.

The corrected sequential run completed nine cases between 18:59:23 and 19:04:40
UTC on 23 October. The manager and an independent agent checked the raw
intermediate and final states, not only the probe's status labels. The first
active membership ID is stable in both overlap orders. Both preservation cases
end with an invitation reported as revoked and an accepted identity; its current
role follows the preserved membership, not the originally invited role.

The concurrent probes measure client request overlap. They do not establish
WorkOS's internal transaction order or prove every possible interleaving.

### Retained native evidence and limits

Local, ignored evidence is retained in
`ast-report/staging-release-2026-10-23/`:

- `native-invitations-corrected-fixed-mvlc3cl8-a7efad.json`: nine sequential
  cases, operation results, fixture IDs, membership snapshots, native identity,
  target and unrelated access, and cleanup of all 31 owned resources.
- `native-invitations-races-race-mvlcadw9-45d863.json`: both concurrent attempts
  and cleanup of all six owned resources. Its overall exit 1 remains valid.
- `native-invitations-alternate-diagnostic-diag-mvlcd0xt-5325cf.json`: isolated
  alternate-address new join, safe request trace, and cleanup of all four owned
  resources. Its exit 1 remains valid.
- `native-invitations-revoke-race-diagnostic-revdiag-mvlchixq-1de470.json`:
  focused revoke attempt with 102 ms of request overlap. Native rendered text
  shows “Something went wrong” on the password page. Fresh state is revoked,
  with no accepted identity or active target membership; unrelated access
  remains. All three owned resources were removed. This confirms safe final
  state, but the generic error does not close the native-flow hold; exit 1 is
  retained.
- `native-sequential-independent-review.md` and
  `native-races-independent-review.md`: independent review of the observations
  and the limits of each result.

Earlier exploratory results are retained, not counted as passes. The first
probe checked organization deletion too soon; a later read confirmed removal.
A later probe expected 200 from the legacy Admin invitations route, whose
correct response is 303 to Members. It also failed to require first activation
when WorkOS reported a revoked invitation. The corrected checks require the
intended active membership and native target access. No original report was
rewritten to hide these errors.

The final complete Staging listings at 19:12 UTC contain exactly the two
original users and two original organizations, with unchanged records. Both
pagination cursors are null. The inventory comparison and final non-secret
configuration readback are retained beside the probe results. No known
invitation credential or password was found in the inspected application pages
and server logs; this is a scoped check, not a claim about all provider logs.

### Follow-up diagnostics on 23 October

Local, ignored evidence for the follow-up work is retained in
`ast-report/invitation-fixes-2026-10-23/`. The manager and an independent agent
reviewed the fresh membership, identity, application access, and cleanup facts:

| Artifact | Observed result and limit |
| --- | --- |
| `alternate-address-addr-mvlddumf-73de24.json` and `alternate-address-addr-mvldeuld-8897fa.json` | Existing A fails to join whether invited B was absent or already existed. Send creates pending B when needed. Alternate acceptance leaves no target membership, removes B's pending membership, and preserves A's unrelated access. |
| `new-user-password-newpw-mvldpkvm-33660e.json` | New exact-recipient signup succeeds with one active User membership and correct native target access. Both identities were absent before invitation creation. |
| `new-user-password-newpw-mvldrtqs-b82bd8.json` | New alternate A reaches email verification with no target membership. This intermediate stop alone does not establish the final outcome. |
| `new-user-verification-verify-mvle5rq3-115964.json` | A fresh alternate signup completes the actual email-verification challenge: matching current owned event/client and verification record, code held in memory, observed visible code control, and native POST 200. Fresh A is verified, but the callback opens “No organization access”; portal is 403 and target memberships remain empty. All three owned resources are confirmed absent. |
| `exact-reinvite-recovery-recover-mvldy2rl-f9041a.json` | Initial alternate failure is reproduced. A new exact-address invitation then activates one User membership for the same A and correct target access. The unrelated membership ID, roles, and access remain unchanged. All four owned resources are confirmed absent. |
| `revoke-recovery-recovery-mvldgi46-b38076.json` | One measured 93 ms client-request overlap reproduces “Something went wrong” on native password sign-in. Revoke returns the matching revoked invitation; no active target membership appears. A new browser context starts ordinary application login and restores only existing unrelated access. All three owned resources are confirmed absent. |

At 19:59:48 UTC, complete Staging user and organization listings again contain
exactly the original two users and two organizations. Canonical comparison with
the original baseline confirms the same IDs and full records, with null before
and after cursors. `final-native-cleanup-comparison.json` retains the result in
the follow-up artifact directory. This is a point-in-time comparison, not a
continuing monitor.

A separate read-only production inventory at 19:57:44 UTC found zero users across
Active, Inactive, and Pending status, zero memberships across those statuses in
each of seven organizations, and zero pending invitations. All list pages were
complete. `production-inventory.json` retains that result; historical organizations
and records were not deleted or changed. These facts do not open signup or
resolve the native-flow holds.

The verification code came from the documented
[Events API](https://workos.com/docs/events#email-verification-events) and
[get email verification operation](https://workos.com/docs/reference/authkit/email-verification).
No verified flag or authentication policy was changed directly. WorkOS accepts
[reserved example domains](https://workos.com/docs/email#testing-with-example-domains)
without delivering their email. This proves challenge completion, not mail
delivery, password reset, or consumer-domain behavior. The fresh alternate case
has no unrelated membership because it starts with a new identity; the existing
identity diagnostics and recovery check preserve an unrelated membership.

The two password POSTs in the existing-identity diagnostics are separate native
fetches with HTTP 200, not a redirect chain. The first begins before the observed
invitation response finishes and before the driver types the password. Waiting
for that response does not restore target activation. The trace does not explain
why AuthKit sends them. A provider HTTP 200 alone does not prove sign-in or a grant.

The [WorkOS invitation guide](https://workos.com/docs/authkit/invitations)
describes alternate corporate addresses in signup. The new-user follow-up tests
that distinction and completes verification; target activation still is not
observed. This establishes a release limitation in the tested configuration,
not a proven third-party root cause or a repaired native flow. Do not grant access
in Thermus to compensate or silently change the accepted recipient policy.

### Recovery instructions

Use the email address that the member will actually use to sign in. If alternate
acceptance leaves no target access, the inviting administrator must check the
current membership and invitation state. If a grant is still intended, send a
new invitation to that exact address with the intended role. The tested recovery
uses a new invitation; retrying the old revoked link is not the same operation.
Do not automatically resend or create a grant from an accepted identity field.

If a revoked link leaves “Something went wrong” on native sign-in, stop retrying
that link. Open the application's ordinary `/login` in a new browser context and
sign in for existing authorized workspaces. Ask the inviting administrator to
check target access separately. This recovery restores existing access only; it
does not revive the revoked invitation or remove AuthKit's generic error. Both
native limitations and the remaining release holds stay visible.

For each completed row, record candidate SHA, date, verified environment identity,
fixture IDs, operation order, sanitized results, before/after membership roles,
fresh invitation state, application access, and cleanup result. A blocked or
inconclusive row stays unproven.

## Cleanup

Delete only fixtures listed in this run's owned inventory. Delete applications
before users, then organizations, as applicable. Confirm removal with fresh reads
and record any failed cleanup. Do not broaden cleanup prefixes to include
existing consumer identities. Keep an unresolved cleanup item visible; do not
hide it by deleting resources whose ownership is uncertain.

## Provider references

- [WorkOS invitation reference](https://workos.com/docs/reference/authkit/invitation).
- [WorkOS invitation guide](https://workos.com/docs/authkit/invitations).
- [Pinned WorkOS OpenAPI contract](https://github.com/workos/openapi-spec/blob/1cfae382eda055174703010c77b4d58f6ed59603/spec/open-api-spec.yaml).

These references describe supported behavior; documentation alone does not
close an unproven native outcome or override the observed release limitations.
