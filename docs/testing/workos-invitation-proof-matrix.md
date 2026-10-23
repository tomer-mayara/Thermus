# WorkOS native invitation proof matrix

This runbook covers the provider proofs required by
[S1-04b](../design/organization-admin-plan.md#s1-04b--invitation-acceptance-and-trusted-landing)
and [Native invitations — Slice 1](../design/organization-admin-plan.md#native-invitations--slice-1).
The matrix is **NOT RUN**. It is not evidence that WorkOS preserves an active
member's role.

## Current holds

Do not start fixture creation or acceptance while any hold remains:

- The locally saved client does not match the connected staging client.
- The locally saved issuer is missing.
- The callback configuration does not match the test callback.
- Staging MFA is Optional. The Slice 1 test profile requires Disabled.

Resolve these facts through the authorized environment review. Record the exact
verified environment, client, issuer, callback, and MFA profile without keys or
other credentials. Do not change shared provider settings as part of this proof.
An unresolved proof or an acceptance that changes an active role blocks release.

## Prerequisites and safety

Use only an authorized, verified test environment. Reserve it for one run. The
current live harness can delete stale resources with the shared `thermus-live-`
and `Thermus live ` prefixes, so two runs must not overlap. Do not start its
fixture setup until the environment holds are resolved and its cleanup scope is
confirmed.

Use fresh, run-owned organizations, verified password identities, and invitations.
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
exclusion. Their prior results do not cover the matrix above, and this runbook
claims no new execution.

The current
[invitation browser driver](../../test/support/hosted-live/portal-visit.ts)
waits for successful portal arrival. The
[AuthKit driver](../../test/support/hosted-live/authkit-driver.ts)
does not define all refusal or controlled race outcomes. The matrix therefore
remains a manual, blocked verification plan until the actual flow and safe
observations are established. Do not replace missing native proof with fake or
SDK request-test behavior.

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
| Corporate User preservation | NOT RUN | Environment holds above. |
| Corporate Admin preservation | NOT RUN | Environment holds above. |
| Overlap, User first | NOT RUN | Environment holds above. |
| Overlap, Admin first | NOT RUN | Environment holds above. |
| Acceptance/resend, all three orderings | NOT RUN | Environment holds above; controlled observation needed. |
| Acceptance/revoke, all three orderings | NOT RUN | Environment holds above; controlled observation needed. |
| Consumer exact address | NOT RUN | Environment holds above; controlled consumer recipients needed. |

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

These references describe ordinary lifecycle behavior. They do not close the
unproven active-role, overlapping invitation, or race cases.
