# Hosted account closure and deletion

The external operator handles hosted access removal and deletion requests with
this manual procedure. Use the [private record template](templates/hosted-deletion-request.md).
Keep completed records in a restricted operator store, outside Git. This runbook
does not publish or adopt the private privacy and terms drafts.

## Process checks

These Given-When-Then cases are tabletop checks for the operator and reviewer.
They are not automated tests or evidence of a live deletion.

- Given a request received on day 1 and verified on day 8, when the operator
  sets the target, then it is day 31 (30 calendar days after receipt). An
  earlier legal deadline controls; verification does not restart either clock.
- Given one person in organizations A and B, when A authorizes removal from A,
  then remove A's approved roles first and preserve B's membership and roles.
  Shared or unknown session effects stop the affected operation until they are
  understood and any broader need to sign in again is explicitly approved.
- Given an approved whole-account request, when an irreversible operation has
  an unknown outcome, then the operator inspects the exact resource before a
  retry and records confirmed facts separately from residual-data unknowns.
- Given a retained security record or an unknown provider backup period, when
  the operator closes the request, then the result names the exception, its
  owner and review date, without promising all copies were erased.

## 1. Receive, verify, and set the scope

Record receipt time, request reference, handler, and the requested outcome as
soon as the request arrives, including requests through legal@thermus.ai.
Aim to complete authorized deletion actions within **30 calendar days of
receipt**. Record any applicable earlier legal deadline and follow it. Ask the
owner for legal review promptly if a deadline or retention duty is unclear;
verification and provider questions do not extend a legal deadline.

Verify identity with the least information needed, using a trusted existing
account/contact channel. For an organization request, verify the requester's
authority for that organization. An email address match alone is insufficient.
Record the method and result, not copies of identity documents, credentials, or
verification codes. If verification fails, keep the request open with a named
owner and next action; do not make destructive changes on an unverified request.

Confirm in writing which outcome is authorized:

- **Organization removal:** specified access, membership, invitations, and
  records for one organization. This does not authorize deletion of the user
  identity, another organization membership, or every role of the person.
- **Whole Thermus account closure:** the user identity and explicitly approved
  memberships across all its organizations. Inventory the other organizations
  first and resolve authority, contractual duties, and retained-record needs.
  A customer administrator's authority for one organization does not authorize
  whole-account deletion.

Record the WorkOS environment, user ID, organization IDs, membership IDs, and
approved role changes. Confirm that each ID matches the intended person and
organization. Use the WorkOS [user](https://workos.com/docs/reference/authkit/user)
and [membership](https://workos.com/docs/reference/authkit/organization-membership)
read procedures; follow pagination and inspect memberships in all statuses.
Do not copy full provider responses into the record.

## 2. Promptly remove authorized access

Access removal is separate from deletion. After identity, authority, and scope
are confirmed, promptly perform the approved access changes. Sign in to the
correct WorkOS environment with operator MFA, and use the credential handling
rules in [hosted organization setup](hosted-organization-setup.md#before-you-start).

For organization-only removal, remove the approved scoped roles first. Follow
[Revoke Super Admin](hosted-organization-setup.md#revoke-super-admin) for each
approved role, substituting only the approved `role_slug` for User or Admin.
Remove one role assignment at a time; preserve peer roles and other memberships.
Never replace the complete role set with a `PUT`. For a role-only change,
remove only that role. Read the membership again in all statuses and inspect
its roles to confirm the intended access is removed. Check that the default
`member` role and any custom role permissions do not retain that access. Stop
and escalate an unexpected grant or unknown result; do not broaden removals
silently.

WorkOS's [membership management guide](https://workos.com/docs/authkit/users-organizations)
says that deactivation revokes all active sessions. Do not assume the effect is
limited to the selected organization. Before using
[Deactivate an organization membership](https://workos.com/docs/reference/authkit/organization-membership/deactivate),
understand its session side effects and obtain explicit approval for any broader
need to sign in again. Stop deactivation while that scope is shared or unknown.
Deactivation keeps the membership record; it is not deletion. Do not deactivate
a whole membership for a request to remove only one role.

Use [List sessions and Revoke Session](https://workos.com/docs/reference/authkit/session)
to inspect sessions before an approved revocation. A session's organization ID
alone does not prove exclusive scope: WorkOS documents
[switching organizations through refresh](https://workos.com/docs/authkit/sessions).
For organization-only removal, stop any shared or unknown-scope session operation
until its side effects are understood and any broader need to sign in again is
explicitly approved. Record the scope evidence and approval. For whole-account
closure, inventory and revoke all of that user's sessions. Re-list to confirm
the observed result. Do not claim that a session action invalidates every
previously issued token at once. Work already started with earlier access can
still finish; record this limit when it affects the request.

Use [List authorized applications and Delete an authorized application](https://workos.com/docs/reference/authkit/user)
for approved Connect authorization removal. This deletes the user's authorization
for a Connect application, not the shared application itself. The documented
control takes user and application IDs; it does not offer an organization filter.
If a grant also serves retained access, stop that grant's removal and resolve the
scope with the owner. Record any access gap and provider follow-up. Do not
broaden the change silently. [Connect verification](https://workos.com/docs/authkit/connect/oauth)
distinguishes local JWT checks from synchronous introspection. Account-specific
Connect token lifetimes and all revocation effects remain unverified. AuthKit's
five-minute token setting is not evidence about Connect tokens.

Inspect pending invitations and provisioning paths for the approved scope. Use
[Revoke an invitation](https://workos.com/docs/reference/authkit/invitation/revoke)
for each approved pending invitation and inspect its state afterward. Have the
authorized organization owner stop scoped regrant, enrollment, or provisioning
paths, including manual User grants. Record the restriction in the private
onboarding record so a later operator does not grant access again by mistake.
Do not change shared provisioning or unrelated invitations to remove one user.
Directory-managed memberships require coordination with the authorized IdP
owner; confirm the scoped source change and resulting WorkOS state.

Do not delete an organization, shared Connect application, Render service, or
log stream, or rotate shared secrets, to remove one person. Do not change a
Google account or a third-party MCP client's data under this procedure.

## 3. Complete authorized deletion

Before each irreversible action, record explicit approval for the exact
resource ID, environment, and scope. Explain that user and membership deletion
cannot be undone. Approval of access removal alone does not approve deletion.
Re-read the resource immediately before the action and compare it with the
record; stop on a mismatch or a new scope conflict.

For an approved organization membership deletion, follow WorkOS's
[Delete an organization membership](https://workos.com/docs/reference/authkit/organization-membership/delete).
For approved whole-account deletion, follow
[Delete a user](https://workos.com/docs/reference/authkit/user/delete) only after
the other memberships and approved session/Connect actions are resolved.
Membership deletion does not delete the user identity. A directory-managed
membership cannot be deleted through the membership endpoint; WorkOS documents
a `422` response. Coordinate scoped removal at the IdP with its authorized
owner instead of bypassing that control.

After each action, inspect the exact resource or scoped inventory to confirm
the result. If the response is lost or times out, record `unknown` and inspect
before a retry. Absence in the correct environment confirms only the observed
resource state, not erasure of every provider copy. Keep partial failures open
with a named owner, next action, and date. Do not repeat a destructive action
against a different ID to work around an error.

Review private onboarding/acceptance records, support records, and any known
manual exports for the same approved scope. Delete unnecessary personal data.
Retain only the minimum evidence needed for a stated purpose or legal duty,
with restricted access and a review/deletion date. Do not retain full fetched
pages, request content, or credentials as proof of deletion.

## 4. Record residual data and close the request

As checked on October 16, 2026, the Render Hobby workspace has seven days of
accessible application log history and no configured log forwarding, attached
disk, Postgres, or Key Value instance. Do not add a storage system or export logs
for routine deletion work. Confirm the current configuration before relying on
this inventory. [Render logging](https://render.com/docs/logging#retention-period)
describes the history window; it does not prove physical erasure. Do not remove
a shared service or log history to delete one user's entries. If selective
removal is needed and no supported control is verified, record the limitation
and have the owner seek a provider procedure.

WorkOS and Render residual records, security records, and backup purge schedules
remain unknown for this account. The WorkOS Audit Logs product's retention
setting does not govern Render logs or every WorkOS record. The providers'
[WorkOS DPA](https://workos.com/legal/data-processing-addendum) and
[Render DPA](https://render.com/dpa) do not establish a universal per-user
30-day purge. If provider assistance is required, prepare a minimal request for
the owner to authorize and send. Keep its status and any confirmed schedule in
the record; do not send secrets or full content.

Give the requester a clear result through the authorized contact process:
completed actions and dates, scope preserved, incomplete actions, retained
categories and reasons, provider uncertainties, and the next review date where
needed. State that Thermus's 30-day target concerns authorized actions under its
control. Do not state that every copy is gone. Copies held by the person's
Google account, a requested website, or their MCP client need that party's own
process. Record response date and reference, then review retained evidence on
its due date. This runbook authorizes no message or deletion merely by being read.
