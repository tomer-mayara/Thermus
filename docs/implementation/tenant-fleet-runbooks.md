# Tenant fleet runbooks

Date: 28 October 2026. Ticket SO-11 of Slice 2 of the
[self on-boarding plan](self-onboarding-plan.md#slice-2-free-tier-end-to-end).
These runbooks tell the operator what to do when a tenant of the fleet fails,
and how to rotate the secrets of the fleet. [Section 7](#7-alerts) gives the
alerts. The operator is the owner of the Render workspace Thermus AI
(`tea-db8i6ceq1p3s73dev9og`), the Supabase project Thermus AI
(`rnqktgtgrvvqptbaosth`), the GitHub repository `tomer-mayara/Thermus`, and
the Axiom organization.

This document holds no secret value. Each step names where a secret lives.
Do not copy a secret into a ticket, a chat, a commit, a log, or a command
line. Reading a runbook authorizes no write: each delete names the exact
resource first. Keep notes in the private operator record, outside Git, as the
[account deletion](hosted-account-deletion.md) runbook does.

## How to use these runbooks

The provisioner of SO-06 and the release path of SO-02 are on `main`. The MCP
gateway of SO-05, the fleet script and the sweeps of SO-09, and the idle
suspension of SO-10 are not on `main` yet. A step that needs one of them has a
marker, for example **Waits for SO-09.** Until that ticket is on `main` and in
production, do the fallback of the step if it has one, or do not do the step.
The steps of SO-05 use the source of its pull request
[#285](https://github.com/tomer-mayara/Thermus/pull/285) at `fd4c4454`, and
can change before its merge.

The production control plane runs with `MCP_TENANTS_ENABLED` off until step 6
of the SO-12 order, so production has no tenant yet.

| Situation | Runbook |
| --- | --- |
| A `Tenant provisioning failed:` line, or a row in state `failed` | [1. Failed provision](#1-failed-provision) |
| A `thermus-tenant-*` service with no registry row, or with a `deleted` row | [2. Orphaned Render service](#2-orphaned-render-service) |
| A pause email of Supabase, or `Tenant provisioning cannot read the tenant registry.` lines | [3. Paused Supabase project](#3-paused-supabase-project) |
| The owner removes an organization | [4. Deletion of a tenant](#4-deletion-of-a-tenant) |
| A key expires, is exposed, or is due, or the month ends | [5. Rotations and the monthly pruning](#5-rotations-and-the-monthly-pruning) |
| Searches get "Server busy. Try again later." or "Search failed: HTTP 429" | [6. Shared Brave search limit](#6-shared-brave-search-limit) |
| An alert email | [7. Alerts](#7-alerts) |

## Where the secrets and settings live

| Name | What it is | Where it lives |
| --- | --- | --- |
| `RENDER_API_KEY` of the control plane | The API key of the dedicated Render user of the control plane. | A Render secret variable of the production service `srv-db8mnqg473hc739d529g`, from step 6 of the SO-12 order. |
| `RENDER_API_KEY` of the release workflow | The API key of a dedicated Render user, a Member of Thermus AI. | The GitHub repository secret `RENDER_API_KEY` of `tomer-mayara/Thermus`. Before step 5 of the SO-12 order, it can move to a GitHub environment that allows only `main` (manager note of the SO-02 review). |
| Fleet key | The API key of the Render user of the fleet script. It is not the key of the control plane. | The git-ignored `.env.local` of the main checkout, `/Users/tomermayara/git/Thermus/.env.local`. Today the file holds `RENDER_API_KEY` for the probes and the [Render interface gate](test-gate-policy.md#render-interface-gate-so-06). **Waits for SO-09:** SO-09 names the variable of the fleet key. |
| `GATEWAY_SIGNING_KEY` | The Ed25519 private key that signs each access context. Only the control plane holds it. | A Render secret variable of the production service. **Waits for SO-05.** |
| `GATEWAY_PUBLIC_KEY` | One or more Ed25519 public keys in PEM form, separated by commas. It is not a secret. | A Render variable of the production service, and a Render variable of each tenant service. The provisioner copies the value of the control plane into each new tenant. |
| `LOGGING_DESTINATION_ENCRYPTION_KEY` | The key that encrypts the saved bearer token of each Audit logs destination. | A Render secret variable of the production service, and the protected copy outside the database that [S2-01a](admin-s2-01a-database-setup.md#initial-credentials-and-configuration) asks for. |
| `DATABASE_URL` | The connection of the runtime role `thermus_logging` to the Supabase project. | A Render secret variable of the production service. The runtime password is in the password manager of the owner. |
| GitHub token of `ghcr-thermus-hosted-read` | A GitHub personal access token (classic) with only the scope `read:packages`. Render pulls the private image with it. | Only in the Render registry credential `ghcr-thermus-hosted-read` (`rgc-dbg1h0142hec73da9ra0`) of the workspace Thermus AI. |
| Pruning token | The GitHub CLI login of the operator, with the scopes `read:packages` and `delete:packages` for the monthly pruning only. | The credential store of the GitHub CLI on the Mac of the operator. |

A Render API key reaches each workspace of its user, and it can change each
service there
([SO-01c](self-onboarding-s1.md#so-01c-render-private-service-lifecycle)).
The control plane reads its settings at its start only. After a change of a
setting, deploy the service. A save of a variable in the Render Dashboard can
start a deploy by itself
([S2-01a](admin-s2-01a-database-setup.md#initial-credentials-and-configuration)).
If it does not, start a deploy.

## Log lines of the fleet

The control plane writes its system log to standard error, one line for each
record, in the form `[<time>] <LEVEL> <message>`
([console sink](../../src/logs/system/console-system-log-sink.ts)). Render keeps
this log for 7 days on the Hobby plan. To find a line, search the log of the
production service in the Render Dashboard for the prefix of the line.
[Section 7.3](#73-axiom-monitors) tells how the lines can reach Axiom.

| Prefix | Level | Source | Meaning |
| --- | --- | --- | --- |
| `The tenant provisioner runs:` | INFO | [`src/app/tenant-provisioning.ts`](../../src/app/tenant-provisioning.ts) | The start read the tenant settings and started the loop. The line names the workspace, the tenant image, the plan, and the name prefix. |
| `Tenant provisioning record: {json}` | INFO | [`src/tenancy/tenants/tenant-provisioning-log.ts`](../../src/tenancy/tenants/tenant-provisioning-log.ts) | A row takes a state. The fields are `organizationId`, `state`, `serviceName`, and the facts of the state: `serviceId`, `internalUrl`, `imageDigest`, or `resumed`. |
| `Tenant provisioning retry: {json}` | INFO | [`src/tenancy/tenants/tenant-service-creation.ts`](../../src/tenancy/tenants/tenant-service-creation.ts) | The provisioner tries again to find or create the service of a row. The fields are `organizationId`, `attempt`, `waitSeconds`, and `reason`. |
| `Tenant provisioning failed: {json}` | ERROR | `tenant-provisioning-log.ts` | The row is `failed`. The fields are `organizationId`, `serviceName`, and `reason`. The registry holds the same reason in `failure_reason`. |
| `Tenant provisioning cannot read the tenant registry. It tries again in 60 s.` | ERROR | [`src/tenancy/tenants/tenant-provisioner.ts`](../../src/tenancy/tenants/tenant-provisioner.ts) | The database does not answer. |
| `Tenant provisioning could not write the row of organization` | ERROR | `tenant-provisioning-log.ts` | A record did not reach the registry. The row waits for the next claim. |
| `Tenant provisioning failed unexpectedly:` | ERROR | `tenant-provisioner.ts` | A defect. The loop tries again in 60 s. |
| `Logging storage is unavailable:` | ERROR | [`src/app/logging-storage.ts`](../../src/app/logging-storage.ts) | At the start: `DATABASE_URL`, `LOGGING_DESTINATION_ENCRYPTION_KEY`, or `DATABASE_CA_CERT_PATH` is missing or invalid. |
| `MCP gateway tenant restart: {json}` | ERROR | **Waits for SO-05:** `src/interfaces/mcp/mcp-gateway-refusals.ts` of PR #285 | A live tenant stopped during a call. The fields are `organizationId`, `phase` (`before-answer` or `during-answer`), and `cause` (`http-502` or `connection`). |
| `MCP gateway refusal: {json}` | INFO, or ERROR for an operator report | **Waits for SO-05:** the same file | The gateway answered by itself, with `503` or with the search busy words. The fields are `organizationId`, `reason`, and, when they apply, `state`, `resume`, and `resumeFailure`. |
| The daily summary line | INFO | **Waits for SO-09:** SO-09 gives the prefix | Once a day: the counts and the cost by state and plan, the memberships with only the default role, the restarts outside a deploy, and the memory values of the live tenants. |

## 1. Failed provision

**Signs.** The log has a `Tenant provisioning failed:` line. The row of the
organization in `thermus_admin.tenants` is in state `failed`. **Waits for
SO-05 and SO-07:** the gateway and the portal show "Workspace setup failed. We
have been notified and will fix it.".

**State and reason.** The provisioner stops a row as `failed` from `creating`
or `deploying`. It writes the reason to the column `failure_reason`, at most
1,000 characters, and to the `reason` field of the line. The provisioner never
claims a `failed` row again. A `failed` row holds no place under
`FREE_TENANT_LIMIT`. The reasons on `main`, from
[`tenant-service-attempt.ts`](../../src/tenancy/tenants/tenant-service-attempt.ts),
[`tenant-service-creation.ts`](../../src/tenancy/tenants/tenant-service-creation.ts),
[`tenant-deploy-watch.ts`](../../src/tenancy/tenants/tenant-deploy-watch.ts), and
[`tenant-deploy-progress.ts`](../../src/tenancy/tenants/tenant-deploy-progress.ts):

| `failure_reason` starts with | Cause | Do this before the repair |
| --- | --- | --- |
| `<n> Render services have the name <name>` | Two or more services have the name of the tenant. The provisioner cannot tell which one is the tenant. | In step 3 of the repair, delete each service with that name. |
| `Render refused the create: Render answered <status>` | Render refused the create call. Examples: a key of a user without access to the workspace, a wrong registry credential, a wrong plan, or a wrong image. | Read the status and the message. Correct the setting of the control plane, then deploy it. |
| `No Render service after 3 attempts. The last attempt: <reason>` | Three attempts got no service. The `<reason>` names the last cause: `the service list is unavailable (...)`, `the create got no clear answer (...)`, or `Render limits the creates for <n> s`. A wrong key of the control plane gives `the service list is unavailable (Render answered 401...)`. | Read the [Render status page](https://status.render.com) and the create limit below. A create without a clear answer can have made the service. The next request finds that service by its name. |
| `The deploy <deploy ID> of <service ID> ended as <status>` | The first deploy failed, for example with `update_failed` or `build_failed`. A failed image pull also ends here. | Read the deploy log of the service in the Render Dashboard within 7 days. For a failed pull, check the token of [5.4](#54-github-token-of-the-registry-credential), and check that GHCR has the digest of `TENANT_IMAGE` ([5.5](#55-monthly-ghcr-pruning)). |
| `The deploy of <service ID> did not reach live within 15 minutes. Last seen: <seen>` | The deploy did not end in 15 minutes. The `<seen>` gives the last state, for example `no deploy yet` or `<deploy ID> live, internal address pending`. | Read the deploy and the events of the service in the Render Dashboard. |
| `The Render service <service ID> no longer exists` | The service was deleted during its first deploy. | Find out who deleted it. |
| `The deploying row has no Render service ID` | A fault of the registry. | Report it as a defect. |

**Waits for SO-09:** SO-09 changes the word "Render" in these reasons to
platform-neutral words, such as "the platform" and "the tenant service"
(manager note of 28 October 2026). Match a reason by its meaning.

**The create limit.** Render allows 20 creates an hour for each Render user
([SO-01c](self-onboarding-s1.md#so-01c-render-private-service-lifecycle)).
The control plane has its own Render user, so the fleet script, staging, and
the Render Dashboard do not use its limit. The adapter counts the window from
the rate-limit headers of each create answer, and it sends no create that
Render would refuse ([`render-creation.ts`](../../src/tenancy/providers/render/render-creation.ts)).
Then the `Tenant provisioning retry:` line has the reason
`Render limits the creates for <n> s`, and the attempt waits up to one hour.
The loop works on one row at a time, so this wait delays each later row too.
A row that waits is not failed: do not repair it. Each repair uses one create
of the same limit.

**Repair: delete, then request.** **Waits for SO-09:** the fleet commands
`status`, `delete`, and `request`, and the registry operation that brings a
`deleted` row back to `requested`. A request alone keeps a `failed` row
(manager note of the SO-04 review). The fleet script prints what it will do
and waits for a yes before each write.

1. Find the row with the fleet command `status`. Fallback: in the Supabase
   Dashboard, open the SQL Editor of the project and run this read:

   ```sql
   SELECT organization_id, state, service_name, render_service_id, failure_reason, updated_at
   FROM thermus_admin.tenants WHERE state = 'failed';
   ```

2. Read `failure_reason`, and do the step of the table first.
3. In the Render Dashboard, open the workspace Thermus AI and search the
   services for the `service_name` of the row. For zero or one service, go to
   step 4. For two or more services, delete each of them with the steps of
   [runbook 2](#2-orphaned-render-service), "Delete".
4. Run the fleet command `delete` for the organization. It deletes the service
   of the row through the adapter and sets the row `deleted`.
5. Check: the row is `deleted`, and the Render Dashboard does not list its
   service.
6. Run the fleet command `request` for the organization. The row goes back to
   `requested`.
7. Check: the log has three `Tenant provisioning record:` lines for the
   organization: `"state":"creating"`, then `"state":"deploying"` with a
   `serviceId`, then `"state":"live"` with an `internalUrl`. In the recorded
   runs, a first deploy was live 64 to 104 s after its create call. **Waits for
   SO-07:** the portal shows the connection guide.
8. If the same reason comes back, stop. Do not repeat the repair, and tell the
   owner.

Until SO-09 is on `main`, there is no supported repair. Correct the cause,
leave the row `failed`, and do not change the row with SQL.

## 2. Orphaned Render service

**Definition.** An orphaned service is a private service in the workspace
Thermus AI whose name starts with `TENANT_NAME_PREFIX`, and that has no usable
row in the registry:

- no row of `thermus_admin.tenants` has its service ID in `render_service_id`
  or its name in `service_name`; or
- its row is in state `deleted`.

The prefix is `thermus-tenant-` in production. The staging control plane of
the SO-12 rehearsal and the Render interface gate use `thermus-spike-tenant-`.
An orphan costs about 7 USD a month while it runs on `0.5c-512mb`
([plan section 8](self-onboarding-plan.md#8-cost-model)). An orphan with the
name of a tenant is also a risk. The next provision of that tenant takes it as
its service. Two such services stop the provision with the reason
`<n> Render services have the name <name>`.

These services are not orphans:

- the service of a `creating` row: the row has the name, and the provisioner
  finds the service by it;
- the service of a `failed` row: use [runbook 1](#1-failed-provision);
- a service whose name does not start with the prefix, for example the
  production service `srv-db8mnqg473hc739d529g`.

A person or a rehearsal can make an orphan by hand. An extra service of a
duplicate name is an orphan too. So is a service whose delete failed after its
row became `deleted`.

**Find.**

1. List the tenant services with the fleet command `list`. It filters by
   `TENANT_NAME_PREFIX`. **Waits for SO-09.** Fallback: in the Render
   Dashboard, open the workspace Thermus AI and search the services for the
   prefix. The API read is
   `GET /v1/services?ownerId=tea-db8i6ceq1p3s73dev9og&type=private_service&limit=100`,
   one page after the other with the cursor.
2. List the rows. Fallback: in the Supabase SQL Editor, run this read:

   ```sql
   SELECT organization_id, state, service_name, render_service_id FROM thermus_admin.tenants;
   ```

3. Compare the two lists. A service is an orphan when no row has its ID or its
   name, or when its row is `deleted`.
4. Write the service ID, the name, and the result in the operator record.

**Delete.**

1. Check that the service ID is not `srv-db8mnqg473hc739d529g`, the production
   service.
2. Check that the name starts with the prefix. Read the rows again (step 2 of
   "Find"). Stop if a row in a state other than `deleted` has the ID or the
   name of the service.
3. In the Render Dashboard, open the service, open **Settings**, and use the
   delete control at the end of the page. Type the confirmation that Render
   asks for. The fleet script cannot delete a service without a row. The
   write guard of the adapter refuses each service that the registry does not
   own, and always the production service
   ([`render-writes.ts`](../../src/tenancy/providers/render/render-writes.ts)).
4. Check: the service list does not show the service. In SO-01c, a delete
   answered `204` in 0.4 s, and the next list did not show the service.
5. Leave the row as it is. The runtime role has no `DELETE` grant, so a
   `deleted` row stays in the registry.

## 3. Paused Supabase project

**Why it can happen.** The tenant registry, the destination settings, and the
removal intent are in the Supabase project Thermus AI
(`rnqktgtgrvvqptbaosth`), on the Free plan (D-8). Supabase pauses a Free
project after low activity over 7 days. It sends a warning email about one
week before the pause, and an email after the pause
([Supabase project pausing](https://supabase.com/docs/guides/platform/free-project-pausing)).
With `MCP_TENANTS_ENABLED` on, the provisioner reads the registry every 5 s
while it has no work, so a pause is unlikely while the control plane runs.
With the switch off, as in production today, only the use of the product reads
the database, so 7 days without use can pause the project.

**What stops during the pause.**

- Provisioning. The loop writes
  `Tenant provisioning cannot read the tenant registry. It tries again in 60 s.`
  each minute. Each row stays in its state.
- New tenants. Signup and the gateway cannot insert a `requested` row.
  **Waits for SO-05 and SO-07.**
- The registry reads of the gateway. The gateway serves its copy of the
  registry for up to 60 s. Then each MCP call through the gateway gets `503`
  with `Retry-After: 15` and "The service is temporarily unavailable. Try
  again in 15 seconds.". The log gets `MCP gateway refusal:` lines with
  `"reason":"registry-unavailable"`. **Waits for SO-05.** With the switch off,
  the control plane runs the MCP calls itself, and they do not stop.
- The audit export. Each export reads the destination settings first, so it
  sends nothing, and the events are lost: there is no durable queue
  ([S2-01a](admin-s2-01a-database-setup.md#verify-and-retain-rollout-evidence)).
  The Audit logs page shows that the settings are unavailable.
- Member removal. A removal does not start
  ([removal runbook](admin-s2-5-02-removal-runbook.md)).
- Billing, from Slice 3. The Stripe webhook route and the daily reconciliation
  cannot apply a status. Stripe sends a failed webhook again, and the
  reconciliation corrects each status within a day after the resume.
- The daily sweeps: the idle suspension, the organization sweep, and the daily
  summary. **Waits for SO-09 and SO-10.**

The tenant services keep running, and they keep their cost. The sign-in and
the pages that need no storage keep working.

**Resume.**

1. Open the Supabase Dashboard. Select the organization, then the project
   Thermus AI (`rnqktgtgrvvqptbaosth`).
2. Click **Resume project**, and confirm. Do it at once: Supabase can restore
   a paused project for a limited time only.
3. Wait until the dashboard shows the project as active.
4. Open **Connect**, then **Session pooler**. Compare the host, the port, the
   database, and the user `thermus_logging.rnqktgtgrvvqptbaosth` with
   `DATABASE_URL` of the production service. Do not show the password. If a
   value changed, correct `DATABASE_URL`, then deploy the control plane.
5. Do not restart the control plane for the resume alone. Its SQL runtime
   opens a new connection for the next work. If the errors continue for
   5 minutes after the resume, deploy the control plane again.

**Check after the resume.**

- The `Tenant provisioning cannot read the tenant registry.` lines stop. A row
  that waited moves on with `Tenant provisioning record:` lines.
- **Waits for SO-05:** the `registry-unavailable` refusals stop, and an MCP
  call reaches its tenant.
- In an organization with a saved destination, open Audit logs. The page
  shows the settings, and **Test** passes.
- **Waits for SO-09:** the next daily summary line comes.

Write the time of the pause and its effects in the operator record. D-8 asks
to examine the Supabase plan again at the first paying customer
([plan section 5](self-onboarding-plan.md#5-owner-decisions-answered-on-26-october-2026)).

## 4. Deletion of a tenant

**Waits for SO-09.** The order is that of SO-09: first the WorkOS
organization, then the tenant. SO-09 adds this order and the registry rows to
the [account deletion](hosted-account-deletion.md) runbook.

1. Remove the WorkOS organization under the existing procedure of
   [account deletion](hosted-account-deletion.md). Then no member has access
   when the tenant goes.
2. Run the fleet command `delete` with the organization ID. It prints the
   organization, the service, and the row. Check them, then answer yes. The
   command deletes the Render service through the adapter and sets the row
   `deleted`.
3. Check: the Render Dashboard does not list the service, and the row is
   `deleted`.
4. Write the IDs and the result in the private record of the deletion.

If step 2 does not happen, the weekly organization sweep of the control plane
deletes the tenant. Before the delete, the sweep reads the organization by its
ID, and it deletes only after a `404`, because the WorkOS lists lag for some
seconds. Then the row is `deleted`, and the log has one line for the tenant.

The row stays in the registry in state `deleted`, because the runtime role has
no `DELETE` grant. A `deleted` row holds no place under `FREE_TENANT_LIMIT`.
A later request for the same organization keeps the `deleted` row. Only the
registry operation of the repair of [runbook 1](#1-failed-provision) brings it
back.

## 5. Rotations and the monthly pruning

Rules for each rotation:

- Make the new secret first. Put it in each place. Check it. Remove the old
  secret last.
- Change one place at a time, and check after each change.
- If an old secret is exposed, revoke it at once. Accept a short failure until
  the new secret is in place.
- Write the date of each rotation and the next due date in the operator
  record.

### 5.1 Render API keys

Three places hold a Render API key. Give each place its own key, so that one
revoke changes one place. The fleet key belongs to a Render user other than
the user of the control plane
([plan section 4.2](self-onboarding-plan.md#42-flows)).

| Key | Used by | Where it lives |
| --- | --- | --- |
| Control plane key | The provisioner. **Waits for SO-05 and SO-10:** the resume of the gateway. **Waits for SO-09:** the sweeps and the daily summary. | The Render secret variable `RENDER_API_KEY` of the production service. |
| Release key | The deploy job of [`hosted-image.yml`](../../.github/workflows/hosted-image.yml) ([Hosted release](../../README.md#hosted-release)). | The GitHub repository secret `RENDER_API_KEY`, or the GitHub environment that SO-12 can add. |
| Fleet key | The fleet script. **Waits for SO-09.** Today also the probes and the Render interface gate. | The git-ignored `.env.local` of the main checkout. |

The Render documentation gives no expiry date for a key. Rotate a key when it
is exposed, or when a person with access to it leaves. The owner sets a
regular interval. If two places hold the same key, put the new key in both
places before step 5.

1. Sign in to the Render Dashboard as the Render user of the key. Open
   **Account Settings**, find **API Keys**, and create a new key. Give it a
   name with its place and the date. Render shows the key one time only
   ([Render API](https://render.com/docs/api)).
2. Put the new key in its place:
   - Control plane: open the production service, then **Environment**.
     Replace the value of `RENDER_API_KEY`, and save. Deploy the service if the
     save does not start a deploy.
   - Release: on GitHub, open the repository **Settings**, then **Secrets and
     variables**, then **Actions**. Update `RENDER_API_KEY`. Or run
     `gh secret set RENDER_API_KEY --repo tomer-mayara/Thermus`, and paste the
     key at its prompt. Do not put the key on the command line. If the secret
     is in a GitHub environment, update it there.
   - Fleet: open `/Users/tomermayara/git/Thermus/.env.local` in an editor, and
     replace the value. Do not show the file.
3. Do not revoke the old key yet.
4. Check the new key:
   - Control plane: the deploy is `live`, and the start line
     `The tenant provisioner runs:` is in the log. Then wait for the next
     Render call: a `Tenant provisioning record:` line with
     `"state":"deploying"` or `"state":"live"`, or **Waits for SO-09:** the
     next daily summary line with memory values. A wrong key gives
     `Render answered 401` in a `Tenant provisioning retry:` line or a
     `Tenant provisioning failed:` line.
   - Release: dispatch the workflow on `main` with a digest that GHCR has and
     the service ID of a tenant:
     `gh workflow run hosted-image.yml --repo tomer-mayara/Thermus --ref main -f digest=sha256:<digest> -f service_id=<tenant service ID>`.
     The deploy job reads the service with the key, and then it stops with
     "The service is a private_service, not a web service." No deploy starts
     ([`deploy-hosted-image.ts`](../../script/release/deploy-hosted-image.ts)).
     With a wrong key, the job stops with `answered 401`. Before a tenant
     exists, the next release dispatch is the check. The job reads the service
     before it deploys, so a wrong key stops the job before any change.
   - Fleet: run the fleet command `list`. **Waits for SO-09.** Before SO-09,
     run the next probe or interface gate that reads Render.
5. Revoke the old key: in **Account Settings**, **API Keys**, open the menu
   (**•••**) of the old key, click **Revoke**, and confirm. A revoke takes
   effect at once.
6. Check again with the check of step 4.

### 5.2 Gateway key pair

**Waits for SO-05** (the signing key, its start check, and the gateway) **and
SO-09** (the fleet upgrade that deploys the tenants in batches of three). The
order is add, switch, remove, with several accepted public keys (answer 3 of
the SO-11 ticket, from SO-09).

- `GATEWAY_SIGNING_KEY` is the private key. It lives in a Render secret
  variable of the production service.
- `GATEWAY_PUBLIC_KEY` is the list of accepted public keys. It lives in a
  Render variable of the production service and of each tenant service. A
  tenant tries each key of its list
  ([`access-context-verifier.ts`](../../src/accounts/identity/access-context-verifier.ts)).
  The provisioner copies the list of the control plane into each new tenant.
- The start check of SO-05: the control plane does not start when its
  `GATEWAY_PUBLIC_KEY` does not hold the public key of its
  `GATEWAY_SIGNING_KEY`. So add the new public key to the control plane before
  the switch, and remove the old public key from it only after the switch.
- A context expires 2 minutes after the gateway signs it
  ([`signed-access-context.ts`](../../src/accounts/identity/signed-access-context.ts)).
  In PR #285, the relay route checks each relay with the public key of the
  current signing key only. So for about 2 minutes after the switch, the route
  refuses the relay of a call that started before the switch. That audit event
  is lost. Do the switch at a quiet time.

The fleet script has no command for a variable. Change a variable of a
service in the Render Dashboard (the service, then **Environment**), or with
the API call `PUT /v1/services/<service ID>/env-vars/GATEWAY_PUBLIC_KEY`. Then
deploy with the fleet command `upgrade` and the current digest of the tenant.

1. Make the new key pair on the Mac of the operator, in a new private folder
   outside the repository:

   ```sh
   umask 077
   openssl genpkey -algorithm ed25519 -out gateway-signing.pem
   openssl pkey -in gateway-signing.pem -pubout -out gateway-public.pem
   ```

   The private key file starts with `-----BEGIN PRIVATE KEY-----`, and the
   public key file with `-----BEGIN PUBLIC KEY-----`.
2. Add on the control plane. Set `GATEWAY_PUBLIC_KEY` of the production
   service to the old public key, a comma, and the new public key. Deploy the
   control plane. Check: the deploy is `live`, the start has no error about
   `GATEWAY_PUBLIC_KEY`, and an MCP call works.
3. Add on each tenant. List the tenant services with the fleet command
   `list`. Set `GATEWAY_PUBLIC_KEY` of each one to the same two keys, also of
   a suspended tenant: its resume deploy reads the new value. Deploy the live
   tenants in batches of three with the fleet command `upgrade`. Check: each
   deploy reaches `live`; the upgrade stops at the first deploy that does not.
   Then read `GATEWAY_PUBLIC_KEY` of each tenant service again: each one has
   both keys.
4. Switch. Set `GATEWAY_SIGNING_KEY` of the production service to the new
   private key. Deploy the control plane. Check: the deploy is `live`, the
   start passes its check, and MCP calls work. A tenant without the new key
   refuses each call with `403`. If calls fail, set the old private key again
   and deploy: each tenant still accepts the old key.
5. Wait 2 minutes after the deploy of step 4 is `live`, so that each context of
   the old key expires. Render stops the old instance of the control plane
   60 s after the new instance is live.
6. Remove on each tenant. Set `GATEWAY_PUBLIC_KEY` of each tenant service to
   the new public key only. Deploy the live tenants in batches of three with
   the fleet command `upgrade`. Check: each deploy reaches `live`, and MCP
   calls work.
7. Remove on the control plane. Set `GATEWAY_PUBLIC_KEY` of the production
   service to the new public key only, and deploy. Check: the deploy is
   `live`, and MCP calls work. List the tenants again: a tenant that the
   provisioner made during step 6 has both keys. Set its list to the new key,
   and deploy it.
8. Delete the two key files: `rm gateway-signing.pem gateway-public.pem`. Keep
   no copy of a private key outside Render.

### 5.3 Settings encryption key

`LOGGING_DESTINATION_ENCRYPTION_KEY` is 32 random bytes in canonical base64.
It lives in a Render secret variable of the production service, and in the
protected copy that
[S2-01a](admin-s2-01a-database-setup.md#initial-credentials-and-configuration)
asks for. A tenant never holds it: the tenant role refuses to start with it
([`control-plane-secrets.ts`](../../src/runtime/config/control-plane-secrets.ts)).

**What it protects.** The bearer token of each saved Audit logs destination.
The control plane encrypts the token with AES-256-GCM, with the organization
ID as associated data, and stores it in `encrypted_credential` of
`thermus_admin.logging_destination_settings`
([`destination-credential-codec.ts`](../../src/logs/audit/destination-credential-codec.ts)).
A destination without a token (`auth = 'none'`) stores no value.

**What a new key does.** There is one key and no key version. With a new key,
the control plane cannot read a token that the old key encrypted. For each
such organization, the settings read, the save, the Test, and each export
answer "unavailable"
([`destination-settings-service.ts`](../../src/logs/audit/destination-settings-service.ts)).
The Admin cannot save a new token either, because a save reads the stored
token first. The audit events of that organization are lost until someone
corrects the stored value.

**What a wrong value does.** A value that is not canonical base64 for 32 bytes
makes the hosted storage unavailable at the start, with the line
`Logging storage is unavailable: LOGGING_DESTINATION_ENCRYPTION_KEY must be canonical base64 for exactly 32 bytes.`.
The tenant registry needs the same storage, so with `MCP_TENANTS_ENABLED=true`
the start stops with "MCP_TENANTS_ENABLED=true needs the tenant registry:
DATABASE_URL and LOGGING_DESTINATION_ENCRYPTION_KEY must be valid.".

A re-encryption tool does not exist yet. So:

1. Count the stored tokens. In the Supabase SQL Editor, run this read:

   ```sql
   SELECT count(*) FROM thermus_admin.logging_destination_settings WHERE encrypted_credential IS NOT NULL;
   ```

2. If the count is 0, rotate:
   1. Make a new key directly in the protected storage, for example with
      `openssl rand -base64 32`. Do not use a WorkOS secret or a cookie secret
      again.
   2. Replace `LOGGING_DESTINATION_ENCRYPTION_KEY` of the production service
      with the new key, and deploy.
   3. Check: the deploy is `live`, and the start has no
      `Logging storage is unavailable:` line. With the switch on, the line
      `The tenant provisioner runs:` is in the log. Open Audit logs in an
      organization: the page loads, with no "unavailable".
   4. Remove the old key from the protected copy.
3. If the count is more than 0, do not rotate the key. First a reviewed tool
   must decrypt each stored value with the old key and encrypt it with the new
   key, with the organization ID as associated data. Ask the owner for a
   ticket.
4. If the key is exposed while tokens are stored, treat each stored token as
   exposed too. Ask each Admin of such an organization to revoke the token at
   the destination, for example in Axiom, and to save a new one. Then ask for
   the reviewed tool of step 3, and rotate with it.

### 5.4 GitHub token of the registry credential

The registry credential `ghcr-thermus-hosted-read` (`rgc-dbg1h0142hec73da9ra0`)
of the workspace Thermus AI holds a GitHub personal access token (classic) of
the user `tomer-mayara`, with only the scope `read:packages`
([SO-01b owner steps](self-onboarding-s1.md#owner-steps-render-registry-credential)).
Render pulls the private image `ghcr.io/tomer-mayara/thermus-hosted` with it
at each deploy of a tenant. The control plane uses the same credential from
step 4 of the SO-12 order. `RENDER_REGISTRY_CREDENTIAL_ID` of the control plane
holds its ID, and each tenant service names the same ID.

**Expiry date.** The token has an expiry date. The owner set it at step 2 of
the SO-01b owner steps and wrote it down; the example there is 90 days. The
repository and the Slice 1 record do not hold the date. Read it on GitHub:
**Settings**, **Developer settings**, **Personal access tokens**, **Tokens
(classic)**. The list shows the expiry date of each token. Write the date in
the operator record, and rotate the token some days before it, for example
14 days. GitHub also sends an email before a token expires.

An expired token stops each new image pull: the create of a tenant, a fleet
upgrade, a resume deploy, and from step 5 of the SO-12 order a deploy of the
control plane. Render then sends the email for a failed image pull
([7.2](#72-render-failure-emails)), and the deploy fails. Running instances
keep running.

1. On GitHub, sign in as `tomer-mayara`, and click **Generate new token
   (classic)** in **Tokens (classic)**.
2. Type a note such as `Render Thermus AI GHCR pull <date>`, set an expiry
   date, and select only `read:packages`.
3. Copy the token: GitHub shows it one time only. Write the new expiry date in
   the operator record.
4. In the Render Dashboard, open the workspace Thermus AI, open the workspace
   settings, and find **Container Registry Credentials**. Update the token of
   `ghcr-thermus-hosted-read`, and keep its name, its registry, and the
   username `tomer-mayara`. The API call is
   `PATCH /v1/registrycredentials/rgc-dbg1h0142hec73da9ra0`, with the four
   fields `registry`, `name`, `username`, and `authToken`. Update the
   credential in place. A new credential gets a new ID, and each service would
   still name the old one.
5. Check: the credential keeps the ID `rgc-dbg1h0142hec73da9ra0`. A service
   uses the new token only after its next deploy
   ([Render API](https://api-docs.render.com/reference/update-registry-credential)).
   Deploy one service that uses the credential: a tenant with the fleet command
   `upgrade` and its current digest (**Waits for SO-09**), or the control plane
   from step 5 of the SO-12 order. Check that the deploy reaches `live`. Before
   such a service exists, the next tenant create of the SO-12 rehearsal is the
   check.
6. Delete the old token on GitHub, in **Tokens (classic)**.
7. Check again: the next deploy of a service that uses the credential reaches
   `live`.

### 5.5 Monthly GHCR pruning

GHCR deletes no version by itself, and each merge to `main` adds one version
of about 148 MiB. The pruning rule of
[Hosted release](../../README.md#hosted-release) keeps each digest that a
service runs, and the last ten release digests for a rollback. Do this once a
month:

1. Get the token: run `gh auth refresh --scopes read:packages,delete:packages`.
   The GitHub CLI keeps the token in its credential store on the Mac of the
   operator.
2. Do steps 2 to 4 of the pruning rule of [Hosted release](../../README.md#hosted-release):
   list the versions, write down the digests to keep, and delete each other
   version. A tenant row without `image_digest` runs an image that only Render
   shows: read the image of its live deploy in the Render Dashboard, and keep
   that digest too.
3. Check: list the versions again. Each digest to keep is still there.
   **Waits for SO-09:** the next fleet upgrade or resume deploy reaches `live`.
   If you deleted a version that a service needs, restore it within 30 days on
   the package page, or with
   `gh api --method POST /user/packages/container/thermus-hosted/versions/<version ID>/restore`.
4. Remove the two scopes:
   `gh auth refresh --remove-scopes read:packages,delete:packages`.
5. Write the date, the number of deleted versions, and the kept digests in the
   operator record.

## 6. Shared Brave search limit

This is a runbook entry, not an alert (answer 4 of the SO-11 ticket).

**The limit.** The search tool reads the public Brave website without an API
key ([search tool](../reference/mcp-search-tool.md)). Render shares the
outbound addresses of a region across all services of that region. So all
tenants send their searches from the same addresses, and Brave limits them
together. In SO-01e, Brave answered `HTTP 429` to 10 searches at the same
time, and 5 searches at the same time passed
([SO-01e findings](self-onboarding-s1.md#findings)).

**The guard.** **Waits for SO-05.** The gateway allows 5 searches at a time
across all tenants. The sixth gets the tool error "Server busy. Try again
later.", and the log gets an `MCP gateway refusal:` line with
`"reason":"search-busy"`. The limit is the constant `SEARCH_LIMIT` of the
gateway source in PR #285, not a setting.

**Signs.** Users get "Server busy. Try again later." for searches, or the tool
error "Search failed: HTTP 429". The second one comes when Brave refuses
anyway, for example because other Render customers use the same addresses.

**What to do.**

1. Count the `"reason":"search-busy"` lines of the last 7 days in the Render
   log, or in Axiom when the log path of [7.3](#73-axiom-monitors) exists.
2. For a small number, do nothing. The client can try again.
3. For many refusals each day, or many `Search failed: HTTP 429` errors, tell
   the owner. The later options are a Brave Search API key, which has its own
   limits, or a dedicated outbound IP address for the workspace, which Render
   sells. Each option needs an owner decision and a change. Do not make
   `SEARCH_LIMIT` larger: 10 searches at a time got `HTTP 429` in SO-01e.

## 7. Alerts

### 7.1 Limits of the Hobby plan

The Render workspace runs on the Hobby plan (D-9):

- Render keeps the logs for 7 days. Copy the evidence of a failure into the
  operator record within 7 days, for example a failure line or a deploy log.
  The registry keeps `failure_reason` longer.
- Render sends failure emails ([7.2](#72-render-failure-emails)). It gives no
  alert for a log line or for a metric.
- As recorded on 16 October 2026, the workspace had no log forwarding
  ([account deletion, section 4](hosted-account-deletion.md#4-record-residual-data-and-close-the-request)).

So since 27 October 2026, the alerts for the log lines are Axiom monitors on
the production logging destination ([7.3](#73-axiom-monitors); D-9 as amended
in [plan section 5](self-onboarding-plan.md#5-owner-decisions-answered-on-26-october-2026)).

### 7.2 Render failure emails

Set them one time, in the Render Dashboard of the workspace Thermus AI: open
**Integrations**, then **Notifications**. Set **Notification Destination** to
email, and **Default Service Notifications** to **Only failure
notifications**. A tenant service has no override, so it uses the default of
the workspace ([Render notifications](https://render.com/docs/notifications)).
Then Render sends an email when:

- a build or a deploy of a service fails, also the first deploy of a new
  tenant;
- a Docker image pull fails, for example after the token of
  [5.4](#54-github-token-of-the-registry-credential) expires;
- a running service becomes unhealthy, for example when Render reports an
  instance that ran out of memory;
- Render suspends a service that fails to start and become healthy again and
  again over 24 hours.

The memory kills: in SO-01e, ten heavy calls restarted a `0.5c-512mb` tenant
in place, and Render reported no event for it
([recommendation for D-15](self-onboarding-s1.md#recommendation-for-d-15)). So
a failure email can miss a restart. The restart monitor of
[7.3](#73-axiom-monitors) covers this case.

When an email comes, open the service in the Render Dashboard. Read its
events, its deploy log, and its memory and instance count within 7 days. A
failed first deploy of a tenant also gives a `failed` row: use
[runbook 1](#1-failed-provision). For a failed image pull, check
[5.4](#54-github-token-of-the-registry-credential) and
[5.5](#55-monthly-ghcr-pruning).

### 7.3 Axiom monitors

Answer 1 of the SO-11 ticket: three Axiom monitors on the production logging
destination email the owner. The owner makes them; this document describes
them, and this ticket made no Axiom change.

**Precondition: the log path.** The monitors read the log lines of the control
plane in an Axiom dataset. On `main`, the control plane writes its system log
to standard error only: [`src/index.ts`](../../src/index.ts) composes the
console sink, and Render keeps the lines for 7 days. The source has an
OpenTelemetry sink,
[`OtelSystemLogSink`](../../src/logs/system/otel-system-log-sink.ts), but the
production composition does not use it. So the monitors need a path to Axiom
first. There are two ways:

- A Render log stream of the workspace to an Axiom Secure Syslog endpoint.
  This is an owner step with no source change
  ([Axiom: send Render logs](https://axiom.co/docs/send-data/render),
  [Render log streams](https://render.com/docs/log-streams)). The stream
  carries the logs of each service of the workspace, also of the tenants.
- An export of the system log of the control plane through
  `OtelSystemLogSink`. This is a source change with its own ticket.

The owner chooses the way and the dataset. The Axiom readback of
24 October 2026 showed 3 of 3 allowed datasets in use
([S2-04 ledger](admin-s2-04.md#axiom-plan-usage-and-retention--dated-readback)).
Until a path exists, no monitor can fire, and the Render failure emails are
the only alerts.

**The notifier.** In Axiom, open **Monitors**, click **Manage notifiers**, and
click **New notifier**. Type a name, for example `Thermus owner email`. Click
**Email**, type the address of the owner under **Users**, click **+**, and
click **Create**
([email notifier](https://axiom.co/docs/monitor-data/email-notifier)).

**The monitors.** Each one is a match monitor with this notifier. Axiom sends
one notification for each matching event, at most 10 a minute and 500 a day.
The query uses `where`, and no aggregation
([match monitors](https://axiom.co/docs/monitor-data/match-monitors)).

| Monitor | Match | Meaning |
| --- | --- | --- |
| Tenant restart | **Waits for SO-05.** Each line that contains `MCP gateway tenant restart: `. | A live tenant answered `HTTP 502` or reset the connection during a call. With `phase` `before-answer`, the client got "Server restarted. Try again in a minute.". With `during-answer`, the gateway ended the answer stream. This is the alert on the first restart outside a deploy (SO-01e). A restart during a fleet upgrade also gives a line: compare its time with the upgrade. |
| Tenant memory at 80 % | **Waits for SO-09.** The memory line of the daily summary, with a value at or above 80 % of the limit of the plan: 410 MiB for `0.5c-512mb`, and 1,638 MiB for `1c-2g`. | A tenant came near its memory limit. On `0.5c-512mb`, five 9 MiB calls peaked at 379 MiB, 74 % of the limit, and ten calls restarted the container (SO-01e). |
| Fleet summary | **Waits for SO-09.** Each daily summary line. | One email a day with the counts and the cost by state and plan, the memberships with only the default role, the restarts outside a deploy, and the memory values. This is the fleet alert of D-9. |

The queries, in the advanced query language (APL). In them, `<dataset>` is the
dataset of the log path, and `message` is the field that holds the log line.
Check both names in a query of the dataset first. The level label of each line
has color codes, so the queries match the text after it with `contains`.

```kusto
['<dataset>']
| where message contains "MCP gateway tenant restart: "
```

```kusto
['<dataset>']
| where message contains "<prefix of the daily summary line of SO-09>"
```

**Waits for SO-09:** SO-09 gives the prefix and the fields of the daily
summary line. Then the memory monitor adds a `where` clause on the memory
value and the plan of each live tenant: at or above 410 MiB on `0.5c-512mb`,
or at or above 1,638 MiB on `1c-2g`.

**When a monitor fires.**

- Tenant restart: open the tenant service in the Render Dashboard. Read its
  memory and its instance count at the time of the line; the instance count
  can show 0. For one restart, write it in the operator record. For restarts
  again and again, tell the owner. D-2 accepts a kill on a very large page on
  `0.5c-512mb`.
- Tenant memory at 80 %: no action at once. If it comes again for a tenant,
  tell the owner: a page or a load needs more memory than the Slice 1 runs
  measured.
- Fleet summary: read it. Compare the cost with
  [plan section 8](self-onboarding-plan.md#8-cost-model). Use
  [runbook 1](#1-failed-provision) for each `failed` tenant. A membership with
  only the default role is a billed seat in WorkOS
  ([plan section 7](self-onboarding-plan.md#7-risks-and-limits)): tell the
  owner. A day without this email means that the control plane, its daily
  sweep, or the log path stopped: examine them.

### 7.4 Owner steps for the alerts

Do them in this order:

1. Set the Render failure emails ([7.2](#72-render-failure-emails)).
2. Choose the log path and the dataset, and make the path
   ([7.3](#73-axiom-monitors)). For the Render log stream: in Axiom, open
   **Settings**, then **Endpoints**, click **New endpoint**, click **Secure
   Syslog**, select the dataset, and copy the target URL. In the Render
   Dashboard, open **Integrations**, then **Observability**, and under **Log
   Streams** set the default destination to that URL. Keep the URL only in
   Render and in Axiom. Check: a new log line of the control plane comes into
   the dataset.
3. Make the email notifier ([7.3](#73-axiom-monitors)).
4. After SO-05 is in production with `MCP_TENANTS_ENABLED` on, make the
   monitor Tenant restart.
5. After SO-09 is in production, make the monitors Tenant memory at 80 % and
   Fleet summary.
6. For each monitor, run its query over the last 7 days in the preview. Check
   that it shows the matching lines, or no line yet.

The Axiom MCP connector of the owner can also make the notifier and the
monitors.

## Sources

Repository, at `main` `c4594b2f`: sections 4.2, 4.3, 5, 7, and 8 of the
[self on-boarding plan](self-onboarding-plan.md); the sections SO-01b, SO-01c,
SO-01e, SO-02, SO-03, and SO-06 of the
[Slice 1 record](self-onboarding-s1.md); the
[database setup](admin-s2-01a-database-setup.md); the
[account deletion](hosted-account-deletion.md) runbook;
[Hosted release](../../README.md#hosted-release); the source files that the
sections link. PR #285 at `fd4c4454` for the lines of SO-05. External pages,
read on 28 October 2026: Render
[notifications](https://render.com/docs/notifications),
[log streams](https://render.com/docs/log-streams),
[API keys](https://render.com/docs/api), and
[registry credential update](https://api-docs.render.com/reference/update-registry-credential);
Supabase [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing);
Axiom [match monitors](https://axiom.co/docs/monitor-data/match-monitors),
[email notifier](https://axiom.co/docs/monitor-data/email-notifier), and
[Render logs](https://axiom.co/docs/send-data/render).
