# Hosted organization setup and recovery

This runbook is for the external platform operator of the hosted edition. It
gives the steps to set up a customer organization and its first Super Admin, and
to revoke, replace, or recover a Super Admin. The operator does these steps in
WorkOS. Thermus has no operator route or method: the customer routes refuse each
request to grant or revoke Super Admin.

The [authentication design](../design/authentication-design.md#organization-administration)
gives the roles. The [hosted live gate](test-gate-policy.md#hosted-live-gate-auth-06)
runs these steps against the WorkOS staging environment. The section
[Provider proofs](#provider-proofs) gives the results.

## Authority and limits

- Only the external operator sets up organizations and grants, revokes,
  replaces, and recovers Super Admin. This authority is outside the customer
  roles, and it needs no global administration product.
- The operator grants only the explicit role `super-admin`. Super Admin gives no
  Admin and no User. A Super Admin can then grant Admin to itself in Thermus,
  and with that Admin authority, User to itself.
- Each step adds or removes only the role `super-admin`, with one role
  assignment on the organization. The other grants of the person stay: User,
  Admin, and the default role `member`, also when a customer changes User or
  Admin at the same time. No step writes the complete role set of a
  membership. A step never deactivates or deletes a membership, and it never
  changes the identity or another membership of the person.
- No customer role can do these steps. Thermus refuses a customer request to
  grant or revoke Super Admin with `403`, and it keeps a change record of the
  refusal.
- This runbook does not create, rename, or delete a customer organization on
  request of a customer, does not change organization settings, does not author
  roles, and does not reset passwords or MFA factors.

## Before you start

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
3. **The record.** Keep one record line for each step, as
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
  of User or Admin that a customer makes at the same time. Never send the
  complete role set with `PUT /user_management/organization_memberships/{id}`:
  a replacement that starts from the read of step 3 can remove a grant that a
  customer added after that read, or return a grant that a customer removed.

- Inactive or pending: stop and record `stopped`. Do not create a membership:
  WorkOS documents that a create activates an inactive membership with the
  roles of the create. Do not reactivate it: WorkOS documents that a
  reactivation restores its earlier roles. Do not assign a role to it either.
  The person who asked must decide first; a later step is a new request with a
  new record.

### 5. Verify the current access

Read the membership again, as in step 3. It must be active with
`super-admin`. Its other roles can differ from step 3: a customer can change
User or Admin at the same time, and the role assignment keeps that change.
Write the roles that you read in the record as the roles after. If the
membership is not active with `super-admin`, the outcome is `unknown`:
continue with [After an unknown outcome](#after-an-unknown-outcome).

Then ask the person to sign in to Thermus with MFA. Its organization page lists
the organization, its billing page opens, and its portal shows no product
access: Super Admin alone gives no User. Record `applied`.

## Revoke Super Admin

1. Do steps 2 and 3 for the person and the organization.
2. Active, with `super-admin`: remove only the role assignment of
   `super-admin`, on the same resource as in step 4 of the setup:

   ```sh
   api -X DELETE https://api.workos.com/authorization/organization_memberships/om_01SAM/role_assignments \
     -d '{"role_slug":"super-admin","resource_type_slug":"organization","resource_external_id":"thermus-customer-0042"}'
   ```

   Each other role stays, also a change that a customer makes at the same
   time. If no other role remains, WorkOS gives the membership the default role
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

## Provider proofs

The hosted live gate runs these steps with the pinned SDK against the WorkOS
staging environment: `test/support/hosted-live/operator-runbook.ts` gives the
steps, and `test/acceptance/auth/hosted-live/operator-setup.ts` gives the
proofs. The [test inventory](../testing/test-list.md) lists them. The proofs
found:

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
