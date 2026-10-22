# Hosted User onboarding

This runbook covers manual User grants and the proposal to transition existing
users. [Self-serve activation](fs-01.md) and [portal/MCP handoff](fs-02.md)
have a separate implemented path. Signup remains off. [FS-04](fs-04.md) supplies
the frozen FS-03 document bundle in production composition under the separate
owner approval for implementation. The original review manifest remains unchanged.
These procedures publish no policy, send no notice, and change no access.

The manual steps below retain the earlier provider API procedure. S1-02 does
not execute them. Confirm a current approved provider procedure and scope before
using the historical numbered setup references. Admin authority can also lead to
product access; its invitations need the same agreement controls as User access.

## Control and limits

Tomer is the operator. The restricted `~/.codex/operator-records` directory is
the private record store. Keep completed records and evidence there, outside Git,
public tickets, and application logs. Use the blank
[acceptance template](templates/hosted-terms-acceptance.md). Keep only necessary
evidence for a stated purpose, with an access owner and review/deletion date.
Do not include credentials, invitation tokens, or fetched pages. On October 16,
2026, the owner removed the durable backup and restore prerequisite and chose
this restricted local folder alone. Keep exact document bytes, versions, hashes,
and access restrictions; no off-device backup or restore proof is required.

For a manual grant, the operator checks and records express agreement before
granting User. The application does not check agreement on manual grants or on
every product request. Self-serve activation does check explicit agreement and
stores an initial acceptance marker in WorkOS. It is not an acceptance history.

Initially, the operator controls manual User grants. S1-01 retires customer
grant forms, including self-grants. Native User and Admin invitations and direct WorkOS
writes can still bypass this procedure. Before delegating invitation authority,
the owner must establish who checks and records each agreement and how the
operator reviews compliance. If these controls cannot be maintained, stop new
grants and escalate to the owner. Do not claim software enforces acceptance on
these manual or invitation paths.

## Self-serve activation and its record

With signup enabled and an approved bundle supplied by composition, `/signup`
shows the complete notice before sign-in. An eligible signed-in person sees the
terms, notice, and one unchecked agreement checkbox. POST checks the current
bundle version, same origin, session CSRF token, express agreement, and a fresh
WorkOS verified-email result for the sealed subject. Personal and company email
addresses can qualify. Email verification does not verify age, employment, or
business authority; the approved wording must cover the adult/business terms.

A confirmed new personal-organization create permits one initial explicit User
membership attempt. No Admin is granted. WorkOS retains the
[signup record](hosted-signup-recovery.md#retained-personal-record). Freeze and
retain exact bundle, terms, notice, and agreement bytes with their versions and
hashes in the private store before use. Never reuse a version for changed bytes.
The marker holds document hashes and an agreement version, not complete text.

Existing product access offers Continue without another agreement or personal
workspace. Admin-only access is product access and offers Continue without a separate
personal workspace. Named creation and first Admin assignment wait for S1-03a. A retained marker with missing, pending, inactive, or
inconsistent access requires support; it does not authorize a new grant. Use
[signup inspection and recovery](hosted-signup-recovery.md), not the manual
new-membership procedure below, for an incomplete signup.

## Manual grants and invitations

Do not send or resend User invitations. WorkOS may allow a different address in
the invited domain to accept, so evidence for the invited address does not prove
agreement by the actual recipient. Inspect existing pending User invitations in
the reconciliation below. Do not enable automatic Google enrollment; production
composition currently omits it. Google sign-in, AuthKit invitation acceptance,
and Connect consent are not terms acceptance.

## Before requesting agreement

1. Confirm the WorkOS environment, application, and organization with the owner.
   Use the scope and secret-handling requirements in
   [organization setup](hosted-organization-setup.md#before-you-start) before
   each provider write. Never copy API keys into the record.
2. Freeze the exact, complete terms and privacy notice in the private store.
   Retain the exact agreement wording too. Give the bundle, terms, notice, and
   agreement distinct versions and record their SHA-256 hashes and dates. Each
   version and date must identify one exact document; never reuse
   a version for changed bytes. Have the owner approve those complete versions
   for private onboarding before use. Approval of operating defaults is not
   approval of incomplete legal text and is not any person's agreement. Keep
   publication separate.
3. Verify the actual WorkOS identity using step 2 of organization setup: exactly
   one user, verified email, and confirmation that this is the intended person.
   Record its user ID and the identity evidence. Read the organization by its
   external ID and confirm its name and ID. Stop on a mismatch or ambiguity.
   For a new person without an identity, privately supply the complete notice
   before asking them to use the normal hosted sign-in flow. Then repeat this
   verification. Sign-in creates no User grant and does not record agreement.
4. Read all membership statuses using step 3 of organization setup. There must
   be exactly one active membership for the verified user and organization.
   Record its ID, status, and role slugs. Stop for pending, inactive,
   directory-managed, foreign, duplicate, or ambiguous membership. If there is
   no membership, first rule out a retained or uncertain personal signup with
   the recovery runbook. Only an ordinary manual onboarding case may use the
   limited setup below; then repeat this check.

### Create a non-product membership only when none exists

The operator may set up an ordinary new user without a privileged role. First
confirm the organization's effective default role and `member` role configuration:
`member` must give no Thermus permission, including product, grant-management,
and billing permissions. Account for organization-specific custom roles. Stop
if this cannot be established. Do not change role configuration in this step.
[WorkOS role configuration](https://workos.com/docs/rbac/configuration) explains
default roles; [custom roles](https://workos.com/docs/rbac/custom-roles) can change
the organization's effective configuration.

Serialize this work with every operator and other membership writer for this
user and organization. Confirm no directory or other automation manages the
membership. Immediately reread all three membership statuses. Continue only
if none exists and no concurrent writer is possible. Recheck the approved scope and
the environment, then use the `api` helper from organization setup with the
verified IDs substituted in this example:

```sh
api -X POST https://api.workos.com/user_management/organization_memberships \
  -d '{"user_id":"<verified-user-id>","organization_id":"<verified-organization-id>","role_slug":"member"}'
```

The [WorkOS create contract](https://workos.com/docs/reference/authkit/organization-membership/create)
creates an active membership but can reactivate an inactive one. It supplies no
absence precondition; serialization and rereads are manual controls, not an
atomic guarantee. Never use this create for a known pending, inactive, or
directory-managed membership. Never bootstrap with User or Admin.

Read all statuses again. Require exactly one active, non-directory-managed
membership for the same user and organization, with only the verified
non-product `member` role. Record its ID, roles, time, actor, and create outcome.
Stop if another writer acted or any state is uncertain. After a timeout, read
to reconcile; do not repeat the create. If no membership can be established,
record `unknown` and escalate. Only after a verified result may the operator
continue to request agreement and later grant User.

## Request and record express agreement

Privately supply both frozen documents to the verified person and use this
request, with every bracketed field completed:

> Please read the attached Thermus hosted early-access Terms of Service
> [terms version and date] and Privacy Notice [notice version and date].
> To request User access for [organization name and ID], reply:
> “I am 18 or older and will use Thermus for business purposes. I expressly
> agree to the supplied Thermus hosted early-access Terms of Service [terms
> version and date]. I have received and read the supplied Privacy Notice
> [notice version and date]. [If acting for an organization: I am authorized
> to agree for organization name and ID.]” The notice acknowledgment records
> that you saw the notice; it does not request consent under privacy law.

Do not prefill a reply as evidence. Verify that the response came from the
actual identified person and covers the exact terms and organization. Record
its time, the evidence reference, and the operator's check. If authority is
relevant, record its confirmation. Stop for no response, unclear response,
wrong version, identity mismatch, or missing authority. A changed document
requires a fresh review and agreement; never alter the retained agreed copy.
A native MCP user follows these same steps without a portal visit.

## Grant only User and verify the result

This manual User procedure does not authorize Admin assignment or the S1-05
role cutover. Use a separately approved operator procedure for those changes.

1. Recheck the environment, approved scope, agreement evidence, and current
   identity and active membership immediately before the write. Stop if any
   target or state differs from the approved record. Record current roles.
2. If User is already present, record `unchanged`. Use the existing-user
   transition below if evidence was missing; do not invent a past grant date.
3. Otherwise use the single-role assignment of organization setup step 4,
   changing only `role_slug` to `user`. Use the verified membership ID and the
   organization's authorization resource: type `organization`, with its
   external ID. For an organization without an external ID, confirm its
   resource identifier before proceeding; do not guess. Never replace the
   complete role set, activate a membership, or grant Admin.
4. Read the membership again in all statuses. Verify the same user,
   organization, and membership, active with User. Record the time, operator,
   action, roles before and after, and `applied`, `unchanged`, `stopped`, or
   `unknown`. Preserve other grants. A concurrent change of another role is
   not a reason to restore the old role set.
5. A timeout or failed answer can follow an applied write. Mark `unknown` and
   reconcile by reading the same membership before any further action. If the
   read cannot establish the outcome, stop and escalate. Do not repeat a write
   to restore a grant someone removed. A later grant needs a new decision and
   record. Do not report successful access until the result is verified.

The next browser or MCP request reads current WorkOS grants. The same User grant
permits product access through either route; a portal-only check would miss native
MCP use. A request already in progress can finish after removal of access.

## Reconcile existing users and invitations

This section is a proposal for owner review, not authority to execute a
transition. Tomer prepares the private inventory and decision record. Do not
send notices, cancel invitations, or change existing access until the owner
approves the exact execution scope.

Inventory current product access in every hosted organization, including custom
roles that give `product:access`, pending User invitations, and people who can
grant User. Record user/organization IDs and evidence status, without raw provider
responses. Distinguish these cases:

| State | Proposed handling |
| --- | --- |
| Manual access with complete current agreement evidence | Verify the identity, organization, document versions, and evidence reference. Preserve the record. |
| Valid initial self-serve marker | Match its versions/hashes to retained bytes. It proves an initial marker was recorded, not agreement to future terms. |
| Access without sufficient agreement evidence | Record the gap; propose private delivery and a fresh express response. Do not infer agreement from use. |
| Incomplete, revoked, or inconsistent signup | Follow the recovery runbook. No automatic grant or metadata repair. |
| Pending User invitation or delegated grant authority | Propose a scoped invitation/grant-control plan; do not send, resend, or revoke through this proposal. |

A person can have different evidence for different organizations. Historical
sign-in, an invitation, or Connect consent is not terms acceptance. Do not
backdate evidence, overwrite the initial marker, or silently grandfather users.
FS-02 Continue lets existing product users proceed; it does not collect a new
agreement or execute this transition.

Submit one private proposal with the exact frozen documents and agreement text,
notice text, recipients and verified delivery method, responsible operator,
proposed cutoff date, and treatment of missing responses and pending invitations.
Keep execution approval, policy publication, and signup opening separate. The
owner must approve any proposed User removal at cutoff; preserve unrelated
roles, memberships, and authorized access. Explain and obtain approval for any
broader session or Connect effects under the [deletion runbook](hosted-account-deletion.md).
A proposed cutoff is not authority to delete an identity or signup marker.

Record each delivery, response/version, unresolved gap, and approved outcome in
the private store. Do not claim all existing users agreed until evidence proves
it. Later-version evidence belongs in a separate dated record; WorkOS's initial
metadata is not an agreement history. Set review/deletion dates for transition
records and retained exceptions. Check the retained exact bytes, versions, hashes,
and local access restrictions before execution. This task prepares the proposal only.

## Acceptance scenarios

- Given no express acceptance for the actual verified identity and terms
  version, when an operator considers User access, the operator stops before
  the grant.
- Given a complete private acceptance record, when an operator grants User,
  the operator changes only User and records the verified result.
- Given a native MCP user, the same identity and acceptance checks apply
  without requiring a portal visit.
- Given an invitation that can grant User, the operator stops that path and
  uses identity verification followed by an explicit grant instead.
- Given an existing User without evidence, the operator records the gap and
  follows an explicit transition; sign-in is not backdated agreement.
- Given a deletion request, the operator verifies its scope and authority,
  removes only authorized access, and targets authorized deletion actions
  within 30 calendar days of receipt without extending legal deadlines.

These scenarios verify the manual procedure. FS-01 separately checks and stores
an initial acceptance marker only for its self-serve activation path.
