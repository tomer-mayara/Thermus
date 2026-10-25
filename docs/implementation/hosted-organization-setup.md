# Hosted organization setup and password cutover preparation


## Current scope

S1-02 prepares the User/Admin password model. It does not change the WorkOS
account or execute a rollout. Execute the scoped cutover only in S1-05 with the
owner's intended environment and application confirmed. Named creation and the
first Admin are implemented by S1-03a. Its marked test agreement is not
production legal approval. The existing approved personal-User bundle cannot
authorize new organization creation; rollout requires the exact revised
organization/authority bundle. The older Super Admin procedure below is historical
and must not be used as the current role setup procedure.

## Before you start

Confirm the intended WorkOS staging or production environment, application,
client ID, AuthKit issuer, organization scope, and operator authority. Keep API
keys in the approved secret store; do not put credentials, reset links, or
invitation tokens in Git, logs, tickets, or records. Preserve the private
agreement controls in [Hosted User onboarding](hosted-user-onboarding.md).
Do not copy a staging URL or role catalog into production without checking it.

## S1-05 cutover checklist (prepared, not executed)

1. Record the exact scope and approved change window. Read the saved provider
   settings and deployed application URLs before any write. Stop on a client,
   issuer, environment, or URL mismatch. Reconcile existing grants and pending
   invitations before replacing the old catalog; do not infer a migration from
   a renamed role.
2. Configure the User/Admin catalog to match the application's validated role
   mapping. User permits product/MCP access. Admin includes that access and
   organization administration, including invitations for either role and the
   free billing read. Default and unknown grants must give no Thermus access.
   Read back the catalog and check custom organization roles too. Follow the
   [WorkOS RBAC integration](https://workos.com/docs/rbac/integration).
3. Confirm email/password sign-in and a provider MFA configuration compatible
   with Slice 1. The current live fixture requires `mfaEnabled: false` and
   `mfaRequired: false`; preflight reads these settings and does not write them.
   There is no `WORKOS_MFA_POLICY` application setting. An old Required-policy
   Password exchange is not proof of completed MFA.
4. Verify the exact callback, MCP resource, sign-out, and Initiate login URLs
   for that application. Use the [Initiate login URI guidance](https://workos.com/docs/authkit/vanilla/nodejs#configure-initiate-login-uri)
   and [Sign-out URI guidance](https://workos.com/docs/authkit/sessions#sign-out-uris).
   Do not guess dashboard paths or reuse another environment's URLs.
5. Confirm approval and retained exact bytes for the organization/authority
   bundle. Do not relabel the approved personal-User documents or use the marked
   test fixture in production. Verify named creation, saved creator/legal facts,
   confirmed first Admin, and a current-membership browser switch to the same
   named organization's MCP guide.
6. Prove the real password flow, required email verification, password reset,
   and invitation-origin sign-in with authorized staging identities. Check the
   trusted application landing and current membership after invitation
   acceptance. A local fake code exchange proves none of these provider flows.
7. Check User and Admin product/MCP access; Admin member reads and both invite
   roles; User administration refusal; default, unknown, inactive, removed,
   and foreign-organization refusal; and unchanged authorized access in another
   organization. Check current grants again on the next browser and MCP
   request. Check protected cookies, callback state/PKCE, logout, and outage
   handling. Keep member rows read-only and the retired grant route unavailable.
8. Record verified outcomes and unresolved failures without credentials. Stop
   rollout if scope, role catalog, password behavior, or access cannot be
   established. Run the applicable existing gates; this checklist adds no gate.

Current live configuration is unverified: the saved client differs from the
connected staging client and the saved issuer is missing. No successful real
password, verification, reset, or cutover result is claimed for S1-02.

## Ordinary membership removal

S2.5 uses the checked Members action for ordinary active User/Admin membership
removal. Follow the [removal runbook](admin-s2-5-02-removal-runbook.md). Its release
and notice holds still apply; this setup document does not activate removal.
Do not run independent operator, WorkOS, or IdP membership reductions during a
customer removal or unresolved hold. Do not reactivate a deleted membership,
replace all roles, or delete an account to repair that action. Rejoin requires a
new authorized invitation. Preserve replacement memberships and later grants.

The historical read-after-write procedure below applies only to its old
Super Admin role-assignment operation. Current member reads cannot settle a
pending customer removal, authorize a retry, or clear its durable hold. A restore
must keep the removal privilege hold outside restored rows as the runbook says.

## Historical Super Admin procedure

The remaining procedure records the earlier AUTH-07W/AUTH-08W operating model.
Its API examples and MFA prerequisites do not authorize the S1-05 cutover or
current customer authority. Historical onboarding references to its numbered
identity, membership, and single-role steps describe manual controls only;
confirm a current approved provider procedure before using them.

This runbook is for the external platform operator of the hosted edition. It
gives the steps to set up a customer organization and its first Super Admin, and
to revoke, replace, or recover a Super Admin. The operator does these steps in
WorkOS. Thermus has no operator route or method and no customer membership-grant
writer. After the existing session and current access checks, the retired
`/members/grants` path returns `404` without a write or change record. Earlier
sign-in, access-denial, and failure responses stay unchanged.

The [authentication design](../design/authentication-design.md#organization-administration)
gives the roles. The [hosted live gate](test-gate-policy.md#hosted-live-gate-auth-06)
runs these steps against the WorkOS staging environment. The section
[Provider findings](#provider-findings) keeps the historical results.

## Authority and limits

- Only the external operator sets up organizations and grants, revokes,
  replaces, and recovers Super Admin. This authority is outside the customer
  roles, and it needs no global administration product.
- The operator grants only the explicit role `super-admin`. Super Admin gives no
  Admin and no User. Customer self-grant forms are retired; Super Admin cannot
  grant itself Admin or User in Thermus. Before any operator User grant, follow
  [Hosted User onboarding](hosted-user-onboarding.md). Native invitations and
  direct WorkOS writes still need the agreement controls of that runbook.
- Each step adds or removes only the role `super-admin`, with one role
  assignment on the organization. The other grants of the person stay: User,
  Admin, and the default role `member`, also when another authorized provider
  writer changes User or Admin at the same time. No step writes the complete role set of a
  membership. A step never deactivates or deletes a membership, and it never
  changes the identity or another membership of the person.
- No customer role can do these steps. The customer invitation routes still
  deny a request to invite Super Admin. A current-access caller of the retired
  grant path gets `404`;
  it does not write a refusal record.
- This runbook does not create, rename, or delete a customer organization on
  request of a customer, does not change organization settings, does not author
  roles, and does not reset passwords or MFA factors.

The operator dashboard MFA prerequisite below is separate from the AuthKit
end-user policy. Shared Staging can use AuthKit Optional while the operator
still must complete dashboard MFA before each runbook write.

## Historical prerequisites

1. **Completed MFA.** Sign in to the WorkOS dashboard of the environment with
   MFA. The WorkOS team must require MFA (dashboard Settings, Authentication,
   "Require multi-factor authentication"). Each write of this runbook happens in
   that signed-in work: in the dashboard, or with the API key of the environment
   in a command that you start for one step. Keep the API key only in a secret
   store that needs your MFA. Never put it in a file, a log, a ticket, a record,
   or a shell history. This precondition is a manual check: you make sure of
   it yourself before each write. No test checks it, also not the hosted live
   gate, because the WorkOS API cannot show a completed operator MFA. The owner
   decides in the decision ticket `ae984833-e115-4da9-bebe-7c4b1fb1a025` how
   the operator MFA is enforced and proven.
2. **The request.** Get, in writing, from the person who asks for the change:
   the organization name, the external ID of the organization, the email of the
   intended Super Admin, and the reason. The external ID is the customer
   reference of the operator, for example `thermus-customer-0042`. It is unique
   in the environment.
3. **Onboarding control.** Confirm the User onboarding responsibility before
   granting authority that can lead to User access. A Super Admin grant is not
   terms acceptance. Keep policy documents and completed agreement records
   private, as [Hosted User onboarding](hosted-user-onboarding.md) requires.
4. **The record.** Keep one record line for each step, as
   [Records](#records) gives.

The examples use the WorkOS API with `curl` in `bash` or `zsh`.
`$WORKOS_API_KEY` comes from the secret store for one command only. The header
file keeps the key out of the process list. The WorkOS dashboard shows the same
data.

```sh
api() { curl --silent --show-error --fail-with-body --header @<(printf 'Authorization: Bearer %s\n' "$WORKOS_API_KEY") --header 'Content-Type: application/json' "$@"; }
```

## Set up an organization and its Super Admin

### 1. Locate or create the organization

Look for the organization by its external ID:

```sh
api https://api.workos.com/organizations/external_id/thermus-customer-0042
```

- Found: check that the name is the name of the request. If it is not, stop:
  the external ID belongs to another organization. Record `stopped`.
- Not found (`404`): create the organization with the external ID:

  ```sh
  api -X POST https://api.workos.com/organizations \
    -d '{"name":"Acme","external_id":"thermus-customer-0042"}'
  ```

- After an unknown outcome of the create, look for the organization by its
  external ID again before any other request. Found: the create took effect.
  Not found: send the create again. The external ID prevents a duplicate:
  WorkOS refuses a second organization with the same external ID with `400`
  and the code `external_id_already_used`. An `Idempotency-Key` does not give
  the earlier organization back: WorkOS refuses a second create with the key of
  the first create in the same way. After that refusal, look the organization
  up again.

### 2. Verify the identity

```sh
api 'https://api.workos.com/user_management/users?email=sam%40acme.example&limit=2'
```

There must be exactly one user, and `email_verified` must be `true`. Confirm
with the person who asked that this account is the intended person. If WorkOS
has no such user, more than one, or an unverified email, stop and record
`stopped`. This runbook does not make identities.

### 3. Inspect the membership in every status

```sh
api 'https://api.workos.com/user_management/organization_memberships?user_id=user_01SAM&organization_id=org_01ACME&statuses=active,inactive,pending&limit=10'
```

Always name the three statuses. Without `statuses`, WorkOS gives only active
memberships, and an inactive membership stays hidden. There is at most one
membership. Write its status and its role slugs (`roles`) in the record as the
roles before.

### 4. Add only Super Admin

- No membership: create it with only `super-admin`.

  ```sh
  api -X POST https://api.workos.com/user_management/organization_memberships \
    -d '{"user_id":"user_01SAM","organization_id":"org_01ACME","role_slugs":["super-admin"]}'
  ```

- Active, with `super-admin`: nothing to do. Record `unchanged`.
- Active, without `super-admin`: assign only `super-admin` to the membership,
  on the authorization resource of the organization. The resource has the type
  `organization` and the external ID of the organization (step 1), not the
  organization ID: WorkOS refuses the organization ID of an organization with
  an external ID with `404` and the code `entity_not_found`, and changes
  nothing.

  ```sh
  api -X POST https://api.workos.com/authorization/organization_memberships/om_01SAM/role_assignments \
    -d '{"role_slug":"super-admin","resource_type_slug":"organization","resource_external_id":"thermus-customer-0042"}'
  ```

  The role assignment adds one role and keeps each other role, also a change
  of User or Admin that another authorized provider writer makes at the same
  time. Never send the complete role set with `PUT /user_management/organization_memberships/{id}`:
  a replacement that starts from the read of step 3 can remove a grant that a
  writer added after that read, or return a grant that a writer removed.

- Inactive or pending: stop and record `stopped`. Do not create a membership:
  WorkOS documents that a create activates an inactive membership with the
  roles of the create. Do not reactivate it: WorkOS documents that a
  reactivation restores its earlier roles. Do not assign a role to it either.
  The person who asked must decide first; a later step is a new request with a
  new record.

### 5. Verify the current access

Read the membership again, as in step 3. It must be active with
`super-admin`. Its other roles can differ from step 3: another authorized
provider writer can change User or Admin at the same time, and the role
assignment keeps that change.
Write the roles that you read in the record as the roles after. If the
membership is not active with `super-admin`, the outcome is `unknown`:
continue with [After an unknown outcome](#after-an-unknown-outcome).

For the customer billing check, set `WORKOS_MFA_POLICY=required` only with a
matching WorkOS environment that requires MFA. Ask the person to sign in
through Password and complete the required MFA step. Its organization page
lists the organization, its billing page opens, and its portal shows no
product access: Super Admin alone gives no User.

With the default `WORKOS_MFA_POLICY=optional`, the customer session has no MFA
evidence. Billing and protected administration pages and writes are refused,
also with Super Admin. This refusal does not mean that the provider grant
failed. Record `applied` when the membership read above verifies the grant;
use the browser outcome that matches the configured MFA contract.

## Revoke Super Admin

1. Do steps 2 and 3 for the person and the organization.
2. Active, with `super-admin`: remove only the role assignment of
   `super-admin`, on the same resource as in step 4 of the setup:

   ```sh
   api -X DELETE https://api.workos.com/authorization/organization_memberships/om_01SAM/role_assignments \
     -d '{"role_slug":"super-admin","resource_type_slug":"organization","resource_external_id":"thermus-customer-0042"}'
   ```

   Each other role stays, also a change that another authorized provider writer
   makes at the same time. If no other role remains, WorkOS gives the membership the default role
   `member`, which gives no application permission. The membership stays
   active. The identity and the other memberships of the person stay. The next
   request of the person in this organization gets no Super Admin access, also
   in a browser session that is open.
3. Without `super-admin`, or without a membership: nothing to do. Record
   `unchanged`.
4. Inactive or pending: stop and record `stopped`.
5. Verify: read the membership again, as in step 3 of the setup. It must be
   active without `super-admin`. Its other roles can differ, as in step 5 of
   the setup. Write them in the record as the roles after. If the membership
   still has `super-admin` or is not active, the outcome is `unknown`:
   continue with [After an unknown outcome](#after-an-unknown-outcome).

Never deactivate or delete the membership to revoke Super Admin: that removes
each other grant of the person too.

## Replace a Super Admin

1. Grant Super Admin to the new identity with steps 2 to 5 of the setup.
2. Then revoke Super Admin of the old identity, as above.

In this order, the organization keeps a Super Admin at each moment. The other
grants of both people stay.

## Recover an organization without a working Super Admin

The Super Admin of an organization can lose its access: its membership is
inactive, the person left, or the person lost the account. Grant Super Admin to
another verified identity with steps 2 to 5 of the setup. Do not reactivate an
inactive membership as a part of a recovery: WorkOS documents that a
reactivation restores each earlier role of it. The person who asked decides
about that membership separately.

## After an unknown outcome

A write that fails, times out, or gives an answer that you did not read has an
unknown effect. Do not send it again. Inspect first, with step 3. After a
grant:

- `super-admin` is in place: the earlier write took effect. Record `applied`.
  Write nothing.
- `super-admin` is absent: stop and record `stopped`. Either the earlier write
  did not take effect, or someone removed the grant later. Only a new decision
  of the person who asked starts a new grant, with a new record. Thus a retry
  never returns a grant that someone removed.
- The membership is inactive or pending: stop and record `stopped`. Do not
  create or reactivate it.

After a revocation, the same inspection decides the other way. `super-admin`
is absent: the earlier write took effect. Record `applied`, and write nothing.
`super-admin` is in place, or the membership is inactive or pending: stop and
record `stopped`. Only a new decision of the person who asked starts a new
revocation, with a new record.

## Records

Keep one record line for each step in the change log of the operator, outside
Thermus. Thermus has no storage for these records yet: it writes only its own
change records, of the customer changes, to the operator log
(`Account change record: <JSON>`). Keep the operator records at least as long
as those. A record holds no credential: no API key, token, password, one-time
code, or link.

| Field | Value |
| --- | --- |
| `time` | The time of the outcome, in ISO 8601 UTC. |
| `actor` | The operator: the name of the WorkOS dashboard account of the person, never a key. |
| `organizationId` | The WorkOS organization ID. |
| `target` | The user ID and the email of the person, or the external ID of the organization. |
| `action` | `locate-or-create-organization`, `grant-super-admin`, `revoke-super-admin`, or `inspect-after-unknown-outcome`. |
| `rolesBefore`, `rolesAfter` | The role slugs of the membership before and after the step, for a grant change. |
| `outcome` | `applied`, `unchanged`, `stopped`, or `unknown`. |
| `reason` | Why the step stopped or why its outcome is unknown. |

For example:

```json
{"time":"2026-10-14T06:24:31.512Z","actor":"operator:Dana Example","organizationId":"org_01ACME","target":{"userId":"user_01SAM","email":"sam@acme.example"},"action":"grant-super-admin","rolesBefore":[],"rolesAfter":["super-admin"],"outcome":"applied"}
```

## Provider findings

The hosted live gate uses `test/support/hosted-live/operator-runbook.ts` to set
state and checks the production organization services in
`test/acceptance/auth/hosted-live/operator-setup.ts`. The
[test inventory](../testing/test-list.md) lists the current product cases.
Earlier provider-only proofs recorded these findings:

- WorkOS refuses a second organization with the same external ID with `400`
  `external_id_already_used`, also for a create with the `Idempotency-Key` of
  the first create. Thus the external ID, not the key, prevents a duplicate.
- A create with only `super-admin` gives exactly `super-admin`, and the
  application reads only the grant of Super Admin: no Admin and no User.
- The roles of a membership are role assignments on the authorization
  resource of the organization. That resource has the type `organization` and
  the external ID of the organization. WorkOS refuses a role assignment that
  names the organization ID instead with `404` `entity_not_found`, and the
  roles stay.
- A role assignment of `super-admin` and its removal keep each other role,
  the identity, and the other memberships, also the default role `member`.
  Without another role, WorkOS gives the membership the default role `member`:
  the membership stays active without an application permission.
- A customer single-role change between the inspection of step 3 and the
  write of the operator stays: a grant keeps a removal of Admin, and a
  revocation keeps a grant of User. The earlier step of this runbook, a
  replacement of the complete role set, lost both changes in the same order.
- A read with only the status `active` does not show an inactive membership;
  a read with the three statuses does.
- WorkOS accepted a create for an existing active membership and changed
  nothing: no second membership, and the roles stayed. The runbook still never
  sends a create for an existing membership.

The proofs use the API key of the staging environment. They do not prove the
completed operator MFA of [Before you start](#before-you-start): it stays a
manual check.

## Limits

- A role assignment changes only `super-admin`, so a change of User or Admin
  at the same time stays. WorkOS takes no precondition for it: of two operator
  changes of `super-admin` at the same time, the last one stays. Step 5 finds
  such a change; it cannot prevent it.
- Separate WorkOS requests are not one transaction. Work that a person started
  with an earlier grant can finish after a revocation.
- Thermus reads the memberships for each request, so a revocation takes effect
  at the next request. An access token that WorkOS issued before stays valid
  for its lifetime of 300 seconds, but each request also needs the current
  grant.
