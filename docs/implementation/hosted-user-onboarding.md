# Hosted User onboarding

This runbook implements the approved operator-managed onboarding process for
hosted early access. The operator records express agreement before an explicit
User grant. The application does not store or check that agreement. Updated
policy pages stay unpublished. This runbook sends no acceptance request and
changes no production access by itself.

## Control and limits

The owner assigns an operator and a private record store with limited access.
Keep completed records and evidence there, outside Git, public tickets, and
application logs. Use the blank [acceptance template](templates/hosted-terms-acceptance.md).
Keep only necessary evidence; set a review date for retained records and any
exception. Do not include credentials, invitation tokens, or fetched pages.

Initially, the operator controls User grants. Customer Admins can grant User,
including to themselves; a Super Admin can grant itself Admin and then User.
Direct WorkOS writes also bypass this procedure. The application does not
prevent these paths. Before delegating grant authority, the owner must establish
who checks and records each agreement and how the operator reviews compliance.
If these controls cannot be maintained, stop new grants and escalate to the owner.
Do not claim that acceptance is enforced by software.

Do not send or resend User invitations. WorkOS may allow a different address in
the invited domain to accept, so evidence for the invited address does not prove
agreement by the actual recipient. Inspect existing pending User invitations in
the reconciliation below. Do not enable automatic Google enrollment; production
composition currently omits it. Google sign-in, AuthKit invitation acceptance,
and Connect consent are not terms acceptance.

## Before requesting agreement

1. Confirm the WorkOS environment, application, and organization with the owner.
   Use the operator MFA and secret-handling requirements in
   [organization setup](hosted-organization-setup.md#before-you-start) before
   each provider write. Never copy API keys into the record.
2. Freeze the exact, complete terms and privacy notice in the private store.
   Give each document a version, a date, and a SHA-256 hash of its retained
   bytes. Have the owner approve those complete versions for private onboarding
   before use. Approval of recommended defaults is not approval of incomplete
   legal text and is not any person's agreement. Keep publication separate.
3. Verify the actual WorkOS identity using step 2 of organization setup: exactly
   one user, verified email, and confirmation that this is the intended person.
   Record its user ID and the identity evidence. Read the organization by its
   external ID and confirm its name and ID. Stop on a mismatch or ambiguity.
4. Read all membership statuses using step 3 of organization setup. There must
   be exactly one active membership for the verified user and organization.
   Record its ID, status, and role slugs. Stop for pending, inactive,
   directory-managed, foreign, duplicate, or ambiguous membership. If there is
   no membership, use the limited setup below, then repeat this check.

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
if none exists and no concurrent writer is possible. Recheck operator MFA and
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
directory-managed membership. Never bootstrap with User, Admin, or Super Admin.

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
> [terms version, date, SHA-256] and Privacy Notice [notice version, date,
> SHA-256]. To request User access for [organization name and ID], reply:
> “I am 18 or older and will use Thermus for business purposes. I expressly
> agree to the supplied Thermus hosted early-access Terms of Service [terms
> version and SHA-256]. I have received and read the supplied Privacy Notice
> [notice version and SHA-256]. [If acting for an organization: I am authorized
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

1. Recheck the environment, operator MFA, agreement evidence, and current
   identity and active membership immediately before the write. Stop if any
   target or state differs from the approved record. Record current roles.
2. If User is already present, record `unchanged`. Use the existing-user
   transition below if evidence was missing; do not invent a past grant date.
3. Otherwise use the single-role assignment of organization setup step 4,
   changing only `role_slug` to `user`. Use the verified membership ID and the
   organization's authorization resource: type `organization`, with its
   external ID. For an organization without an external ID, confirm its
   resource identifier before proceeding; do not guess. Never replace the
   complete role set, activate a membership, or grant Admin or Super Admin.
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

Prepare a private inventory of active User memberships, pending User invitations,
and people who can grant User, in every hosted organization. Record the actual
user IDs, organization IDs, and evidence status. Do not treat historical sign-in,
an invitation, or Connect consent as agreement. Do not backdate evidence or
silently grandfather existing Users.

Submit an explicit transition to the owner: responsible operator, complete frozen
documents, notice text, delivery method, cutoff date, and proposed handling of
missing evidence and pending User invitations. Obtain the owner's approval
before sending notices or changing existing access. This task prepares the
reconciliation procedure; it does not send notices, cancel invitations, or revoke
production access. Until approved actions are complete, record each unresolved
gap and do not claim that all existing Users have agreed. At the approved cutoff,
verify outcomes and record any owner-authorized access removal using the
[deletion runbook](hosted-account-deletion.md) where applicable. Removal of User
is separate from deletion of identity or other organization access.

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

These scenarios verify an operating procedure. They do not claim that the
application checks or stores agreement records.
