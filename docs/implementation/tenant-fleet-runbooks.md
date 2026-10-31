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

The provisioner of SO-06, the release path of SO-02, the MCP gateway of SO-05,
the fleet script and the tenant sweeps of SO-09, the signup handoff and
workspace status of SO-07, and the idle suspension and the resume of SO-10 are
on `main`.
The tenant sweeps run only with `MCP_TENANTS_ENABLED` on.
[Operate the tenant fleet](../../script/README.md#operate-the-tenant-fleet)
gives the fleet commands, their settings, and their guards. Each write command
prints what it will do and waits for the answer `yes`; another answer writes
nothing. In the commands of these runbooks, `fleet.ts` is short for
`node --env-file=/Users/tomermayara/git/Thermus/.env.local script/fleet/fleet.ts`,
run from the repository root with the registry settings (`DATABASE_URL`,
`DATABASE_CA_CERT_PATH`), `RENDER_OWNER_ID`, and `TENANT_NAME_PREFIX` of the
fleet. A command that reads WorkOS, `request` or `summary`, runs through the
WorkOS launcher of the environment.

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
| A `System log export failed:` line, or no new line of the control plane in the Axiom dataset `system-log` | [7.3 Axiom monitors](#73-axiom-monitors), the precondition |

## Where the secrets and settings live

| Name | What it is | Where it lives |
| --- | --- | --- |
| `RENDER_API_KEY` of the control plane | The API key of the dedicated Render user of the control plane. | A Render secret variable of the production service `srv-db8mnqg473hc739d529g`, from step 6 of the SO-12 order. |
| `RENDER_API_KEY` of the release workflow | The API key of a dedicated Render user, a Member of Thermus AI. | The secret `RENDER_API_KEY` of the GitHub environment `production` of `tomer-mayara/Thermus`. The deployment branch rule of the environment allows only `main`. The repository secret `RENDER_API_KEY` stays until the first dispatch on `main` passes with the environment; then the owner deletes it ([Hosted release](../../README.md#hosted-release)). |
| Fleet key | The API key of the owner's Render user, which the fleet script uses. It is not the key of the control plane, so the fleet has its own rate-limit bucket. | The variable `RENDER_API_KEY` in the git-ignored `.env.local` of the main checkout, `/Users/tomermayara/git/Thermus/.env.local`. The probes and the [Render interface gate](test-gate-policy.md#render-interface-gate-so-06) read the same variable. The fleet script reads it from the environment of `node --env-file`. |
| `GATEWAY_SIGNING_KEY` | The Ed25519 private key that signs each access context. Only the control plane holds it, and it reads the key only with `MCP_TENANTS_ENABLED` on. | A Render secret variable of the production service, from step 6 of the SO-12 order. |
| `GATEWAY_PUBLIC_KEY` | One or more Ed25519 public keys in PEM form, separated by commas. It is not a secret. | A Render variable of the production service, and a Render variable of each tenant service. The provisioner copies the value of the control plane into each new tenant. |
| `LOGGING_DESTINATION_ENCRYPTION_KEY` | The key that encrypts the saved bearer token of each Audit logs destination. | A Render secret variable of the production service, and the protected copy outside the database that [S2-01a](admin-s2-01a-database-setup.md#initial-credentials-and-configuration) asks for. |
| `DATABASE_URL` | The connection of the runtime role `thermus_logging` to the Supabase project. | A Render secret variable of the production service. The runtime password is in the password manager of the owner. |
| `SYSTEM_LOG_OTLP_TOKEN` | The Axiom API token with ingest permission for the dataset `system-log` only (SO-11a). The control plane sends it as the bearer token of its system log export. A tenant refuses it. | A Render secret variable of the production service, from step 6 of the SO-12 order at the latest, and the password manager of the owner. The two other settings of the export, `SYSTEM_LOG_OTLP_ENDPOINT` and `SYSTEM_LOG_AXIOM_DATASET`, are plain Render variables of the production service. |
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
production service in the Render Dashboard for the prefix of the line. With the
three settings of [section 7.3](#73-axiom-monitors) (SO-11a), the control plane
also exports each record to the Axiom dataset `system-log`: the field `body`
holds the message with the caller file and line, without the time and the
level label, and `severity_text` holds the level. Then query the dataset for the
prefix too. A tenant writes to standard error only.

| Prefix | Level | Source | Meaning |
| --- | --- | --- | --- |
| `The tenant provisioner runs:` | INFO | [`src/app/tenant-provisioning.ts`](../../src/app/tenant-provisioning.ts) | The start read the tenant settings and started the loop. The line names the workspace, the tenant image, the plan, the name prefix, and the claim holder: the mark that the claims of this instance write to `claimed_by` ([runbook 1](#1-failed-provision), "A deploy of the control plane"). |
| `Tenant provisioning record: {json}` | INFO | [`src/tenancy/tenants/tenant-provisioning-log.ts`](../../src/tenancy/tenants/tenant-provisioning-log.ts) | A row takes a state. The fields are `organizationId`, `state`, `serviceName`, and the facts of the state: `serviceId`, `internalUrl`, `imageDigest`, or `resumed`. |
| `Tenant provisioning retry: {json}` | INFO | [`src/tenancy/tenants/tenant-service-creation.ts`](../../src/tenancy/tenants/tenant-service-creation.ts) | The provisioner tries again to find or create the service of a row. The fields are `organizationId`, `attempt`, `waitSeconds`, and `reason`. |
| `Tenant provisioning failed: {json}` | ERROR | `tenant-provisioning-log.ts` | The row is `failed`. The fields are `organizationId`, `serviceName`, and `reason`. The registry holds the same reason in `failure_reason`. |
| `Tenant provisioning cannot read the tenant registry. It tries again in 60 s.` | ERROR | [`src/tenancy/tenants/tenant-provisioner.ts`](../../src/tenancy/tenants/tenant-provisioner.ts) | The database does not answer. |
| `Tenant provisioning could not write the row of organization` | ERROR | `tenant-provisioning-log.ts` | A record, or the renewal of the claim before a create, did not reach the registry. The row waits for the next claim. |
| `Tenant provisioning leaves organization` | INFO | `tenant-provisioning-log.ts` | The row changed during the work: another writer moved it, for example a delete, or the loop of the other instance claimed it after the claim lease of this loop ended. The loop leaves the row as it is. |
| `Tenant provisioning failed unexpectedly:` | ERROR | `tenant-provisioner.ts` | A defect. The loop tries again in 60 s. |
| `Logging storage is unavailable:` | ERROR | [`src/app/logging-storage.ts`](../../src/app/logging-storage.ts) | At the start: `DATABASE_URL`, `LOGGING_DESTINATION_ENCRYPTION_KEY`, or `DATABASE_CA_CERT_PATH` is missing or invalid. |
| `MCP gateway tenant restart: {json}` | ERROR | [`src/interfaces/mcp/mcp-gateway-refusals.ts`](../../src/interfaces/mcp/mcp-gateway-refusals.ts) | A live tenant stopped during a call. The fields are `organizationId`, `phase` (`before-answer` or `during-answer`), and `cause` (`http-502` or `connection`). In the first 2 minutes after the live record of the row, a failure before the first answer byte is a cold start: it gives the next line, not this one. |
| `MCP gateway tenant starting: {json}` | INFO | `mcp-gateway-refusals.ts` | A new tenant does not answer yet: a call failed before the first answer byte less than 2 minutes after the last change of the live row, its live record or the digest record of a fleet upgrade. The private address of a new Render service refuses connections until about 76 s after its first deploy is live ([SO-03](self-onboarding-s1.md#so-03-private-address-of-the-control-plane), and the SO-12 rehearsal of 31 October 2026). The client gets "Your workspace is not ready yet. Try again in 15 seconds.". The fields are `organizationId`, `cause` (`http-502` or `connection`), and `secondsSinceLive`, the seconds since that change, in whole tenths. No monitor matches it. |
| `MCP gateway refusal: {json}` | INFO, or ERROR for an operator report | `mcp-gateway-refusals.ts` | The gateway answered by itself, with `503` or with the search busy words. The fields are `organizationId`, `reason`, and, when they apply, `state`, `resume`, and `resumeFailure`. The operator reports are the first refusal of a `failed` tenant and a failed resume. The first call of a `suspended` tenant sends one resume call to Render (`"resume":"sent"`); the other calls until the tenant is live have `"resume":"pending"`, or `"state":"deploying"` with `"reason":"resuming"`. A failed resume, also a `429`, gives `resumeFailure` with the reason, for example "The platform did not take the resume: the platform limits the calls of the service for 30 s", and the row is `suspended` again, so the next call tries again. A resume that fails again and again needs a check: `fleet.ts status --organization <organization ID>`. |
| `Workspace setup failed: {json}` | ERROR | [`src/interfaces/web/account/workspace-status.ts`](../../src/interfaces/web/account/workspace-status.ts) | The portal read the status of a `failed` tenant. The field is `organizationId`. One line for each organization, until its row leaves `failed`. |
| `Hosted signup could not read the free-tenant cap.` | ERROR | [`src/interfaces/web/auth/workos/workos-signup-tenants.ts`](../../src/interfaces/web/auth/workos/workos-signup-tenants.ts) | With the switch on, the database does not answer and the registry copy of the gateway is 60 s old, so signup cannot check the cap and answers "Activation is temporarily unavailable. Try again later.". |
| `Hosted signup could not request the tenant of the new organization.` | ERROR | `workos-signup-tenants.ts` | The tenant request after a signup failed. The organization exists; its first workspace status read requests the tenant again. |
| `Audit relay refusal: {json}` | ERROR | [`src/app/mcp-gateway-composition.ts`](../../src/app/mcp-gateway-composition.ts) | The relay route refused an audit event of a tenant, so the event is not exported. The fields are `reason` (`body`, `event`, `organization`, `context`, `actor`, or `memory`), `detail` (the reason of a refused context, for example `signature`), and `organizationId` when it is known. The line never shows the context or the event. |
| `The tenant sweeps run each day at` | INFO | [`src/app/tenant-sweeps.ts`](../../src/app/tenant-sweeps.ts) | The start began the tenant sweeps. The line names the hour of `TENANT_SWEEP_HOUR_UTC` and the days of `FREE_TENANT_IDLE_DAYS`. |
| `Tenant fleet summary: {json}` | INFO | [`src/tenancy/tenants/fleet-summary.ts`](../../src/tenancy/tenants/fleet-summary.ts) | Once a day at the tick, the daily summary. The fields are in [the summary fields](#the-summary-fields). |
| `Tenant fleet summary stopped: {json}` | ERROR | `fleet-summary.ts` | The tick could not read the registry, so no summary line came. The field is `reason`. |
| `Organization sweep: {json}` | INFO | [`src/tenancy/tenants/organization-sweep.ts`](../../src/tenancy/tenants/organization-sweep.ts) | On Mondays at the tick, the counts of the organization sweep: `rows` (not deleted), `organizations` (in the WorkOS list), `deleted`, `foundOnRead` (left out by the list, found by the read by ID), `unreadable`, `inFlight` (`creating` or `deploying`, left for the next sweep), `moved`, and `failed`. |
| `Organization sweep stopped: {json}` | ERROR | `organization-sweep.ts` | The sweep deleted nothing. The field `reason` says why: the registry cannot be read, the WorkOS list is not complete, the list is empty, or more than 2 tenants have no organization in the list. A WorkOS key of another environment or a defect of the list read gives the last two, so for them the line also has the counts `rows` (not deleted), `organizations` (in the list), and `absent` (rows without an organization in the list). Then check the WorkOS key and the list in the WorkOS Dashboard. Delete the tenant of each organization that is really gone by hand with `fleet.ts delete --organization <organization ID>` ([runbook 4](#4-deletion-of-a-tenant)); the sweep removes no more than 2 tenants in one run. |
| `Tenant removal record: {json}` | INFO | `organization-sweep.ts` | The sweep deleted one tenant. The fields are `organizationId`, `state` (`deleted`), `from`, `serviceId`, `serviceName`, and `cause` (`organization-absent`). |
| `Tenant removal failed: {json}` | ERROR | `organization-sweep.ts` | The removal of one tenant failed. The fields are `organizationId`, `serviceId`, and `reason`. The next sweep tries again. |
| `The organization sweep keeps the tenant of organization` | INFO | `organization-sweep.ts` | The read by ID of a left-out organization failed, so its tenant stays until the next sweep. |
| `Idle sweep: {json}` | INFO | [`src/tenancy/tenants/idle-sweep.ts`](../../src/tenancy/tenants/idle-sweep.ts) | Each day at the tick, after the organization sweep, the counts of the idle sweep: `idle` (live free tenants without an MCP call for `FREE_TENANT_IDLE_DAYS`, or since their creation when they never served one), `suspended`, `moved`, and `failed`. |
| `Idle sweep stopped: {json}` | ERROR | `idle-sweep.ts` | The tick could not read the registry, so no tenant was suspended. The field is `reason`. The next tick tries again. |
| `Tenant suspension record: {json}` | INFO | `idle-sweep.ts` | The sweep suspended one tenant. The fields are `organizationId`, `state` (`suspended`), `from` (`live`), `serviceId`, `serviceName`, `idleSince` (the last use, or the creation of a tenant that never served a call), and `cause` (`idle`). Its next MCP call resumes it. |
| `Tenant suspension failed: {json}` | ERROR | `idle-sweep.ts` | The suspension of one tenant failed; the row stays `live`, and the next sweep tries again. The fields are `organizationId`, `serviceId`, and `reason`. For a refused or limited call, Render changed nothing. When the reason says that the registry did not take the suspended state, the service is suspended while the row is `live`: run `fleet.ts suspend --organization <organization ID>`, which suspends again and records the row, before the next call of the organization meets the stopped service. |
| `The idle sweep leaves organization` | INFO | `idle-sweep.ts` | Another writer changed the row during the suspension, for example a delete, so the sweep left it. |
| `Tenant sweep step failed: {json}` | ERROR | [`src/tenancy/tenants/tenant-sweeps.ts`](../../src/tenancy/tenants/tenant-sweeps.ts) | A defect in a step of the tick. The fields are `step` and `reason`. The next step runs. |
| `System log export failed:` | ERROR | [`src/app/system-log-failure-line.ts`](../../src/app/system-log-failure-line.ts) | An export to Axiom failed, after the retries of the exporter, and its lines are not in `system-log`; standard error still has them. The line names the cause: an HTTP status such as `HTTP 401` (a refused token) or `HTTP 403`, an error code such as `ECONNREFUSED`, or `no answer in time`. It comes at most once a minute and counts the failures that had no line. It is on standard error only: Axiom never gets it, so the [precondition check](#73-axiom-monitors) reads the Render log. |

### The summary fields

The line `Tenant fleet summary: <JSON>` has one JSON object. Its window is the
24 hours before the tick. It names organizations, services, and memberships by
ID only, never a person.

| Field | Meaning |
| --- | --- |
| `at`, `windowHours` | The time of the tick in ISO 8601, and 24. |
| `tenants` | The rows that are not `deleted`. |
| `monthlyUsd` | The sum of `monthlyUsd` of `byState`. |
| `byState` | One item for each state and plan: `state`, `plan` (`null` for a `requested` row), `count`, and `monthlyUsd`: about 7 USD a month for each running tenant (`creating`, `deploying`, or `live`) on `TENANT_PLAN_FREE`, about 25 USD for each running tenant on another plan, and 0 for each other state ([plan section 8](self-onboarding-plan.md#8-cost-model)). |
| `defaultRoleMemberships`, `defaultRoleMembershipList` | The count of the active memberships of each WorkOS organization whose roles hold neither `user` nor `admin`, and the first 50 of them, each with `organizationId` and `membershipId`. WorkOS bills each one as a seat ([plan section 7](self-onboarding-plan.md#7-risks-and-limits)). The count is `null` when the read failed. |
| `restarts`, `restartList` | The count of the restarts outside a deploy that Render reports for the live tenants (the events `server_failed` and `server_restarted`), and each tenant with one or more, with `organizationId`, `serviceId`, and `restarts`. Render does not report each restart (SO-01e). |
| `highestMemoryShare`, `memory` | The highest `peakShare`, and one item for each live tenant with a memory point: `organizationId`, `serviceId`, `peakBytes`, `limitBytes`, and `peakShare`, the peak divided by the limit with 3 decimals. The points are 10 minutes apart. `highestMemoryShare` is `null` without a share. |
| `unavailable` | One text for each read that failed, such as `memory: Render answered 503`. The other fields keep what answered. |

## 1. Failed provision

**Signs.** The log has a `Tenant provisioning failed:` line. The row of the
organization in `thermus_admin.tenants` is in state `failed`. With
`MCP_TENANTS_ENABLED` on, each MCP call of the organization gets `503` with
"Workspace setup failed. We have been notified and will fix it.". The first
one writes an `MCP gateway refusal:` line with `"reason":"failed"` at the
level ERROR. Connect in the portal shows the same words in place of the
connection guide, and the first workspace status read of the organization
writes a `Workspace setup failed:` line at the level ERROR.

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
| `<n> services of the platform have the name <name>` | Two or more services have the name of the tenant. The provisioner cannot tell which one is the tenant. | In step 3 of the repair, delete each service with that name. |
| `The platform refused the create: Render answered <status>` | Render refused the create call. Examples: a key of a user without access to the workspace, a wrong registry credential, a wrong plan, or a wrong image. | Read the status and the message. Correct the setting of the control plane, then deploy it. |
| `No tenant service after 3 attempts. The last attempt: <reason>` | Three attempts got no service. The `<reason>` names the last cause: `the service list is unavailable (...)`, `the create got no clear answer (...)`, or `The platform limits the creates for <n> s`. A wrong key of the control plane gives `the service list is unavailable (Render answered 401...)`. | Read the [Render status page](https://status.render.com) and the create limit below. A create without a clear answer can have made the service. The next request finds that service by its name. |
| `The deploy <deploy ID> of <service ID> ended as <status>` | The first deploy failed, for example with `update_failed` or `build_failed`. A failed image pull also ends here. | Read the deploy log of the service in the Render Dashboard within 7 days. For a failed pull, check the token of [5.4](#54-github-token-of-the-registry-credential), and check that GHCR has the digest of `TENANT_IMAGE` ([5.5](#55-monthly-ghcr-pruning)). |
| `The deploy of <service ID> did not reach live within 15 minutes. Last seen: <seen>` | The deploy did not end in 15 minutes. The `<seen>` gives the last state, for example `no deploy yet` or `<deploy ID> live, internal address pending`. | Read the deploy and the events of the service in the Render Dashboard. |
| `The tenant service <service ID> no longer exists` | The service was deleted during its first deploy. | Find out who deleted it. |
| `The deploying row has no tenant service ID` | A fault of the registry. | Report it as a defect. |

Since SO-09, these reasons say "the platform" and "the tenant service" in place
of Render (manager note of 28 October 2026). The text from the adapter in a
reason, such as `Render answered 402: ...`, keeps its Render words. A row that
failed before SO-09 keeps the earlier words, such as `Render refused the
create:`. Match a reason by its meaning.

**The create limit.** Render allows 20 creates an hour for each Render user
([SO-01c](self-onboarding-s1.md#so-01c-render-private-service-lifecycle)).
The control plane has its own Render user, so the fleet script, staging, and
the Render Dashboard do not use its limit. The adapter counts the window from
the rate-limit headers of each create answer, and it sends no create that
Render would refuse ([`render-creation.ts`](../../src/tenancy/providers/render/render-creation.ts)).
Then the `Tenant provisioning retry:` line has the reason
`The platform limits the creates for <n> s`, and the attempt waits up to one hour.
The loop works on one row at a time, so this wait delays each later row too.
A row that waits is not failed: do not repair it. Each repair uses one create
of the same limit.

**A deploy of the control plane.** Render keeps the old instance of the
control plane for about 120 s after the new deploy is `live`. So two
provisioner loops run on one registry for about 2 minutes (SO-12 rehearsal of
31 October 2026, release record section 3.7, item 6). The claim of a row holds
it for one loop. `claimed_by` names the claim holder of that instance, as its
`The tenant provisioner runs:` line shows. `claimed_until` is the end of the
lease: 60 s after the claim or the last renewal. The loop renews the lease
right before each create and before each read of the deploy, so the other loop
leaves the row. Each record of the work names the holder, and the `live` and
`failed` records free the row
([`pg-tenant-claim.ts`](../../src/tenancy/tenants/pg-tenant-claim.ts)).

At `SIGTERM`, the old instance claims no row and starts no Render call. A
Render call in flight gets 3 s to end, and then its answer reaches the
registry; a longer call is cut. Then the end of its work frees a `deploying`
row at once, and the new instance continues it. A `creating` row stays held until its lease ends, because a
create of the old instance can still be unknown. After that, the next claim
searches by name. To see who holds a row, read `claimed_by` and
`claimed_until` of the row with the read of step 1 below. An old instance of
a version before the claim lease ignores the claims. So deploy the first
version with the lease with `MCP_TENANTS_ENABLED` off, as the production order
does, or when `fleet.ts list` shows no row in `requested`, `creating`, or
`deploying`.

**Repair: delete, then request.** The fleet commands `status`, `delete`, and
`request` do it ([Operate the tenant fleet](../../script/README.md#operate-the-tenant-fleet)).
A tenant request of signup or of the gateway keeps a `failed` or `deleted` row
(manager note of the SO-04 review). The fleet command `request` brings a
`deleted` row back to `requested` with the registry operation `reviveDeleted`
of [`pg-tenant-fleet-store.ts`](../../src/tenancy/tenants/pg-tenant-fleet-store.ts):
under the registry lock and inside `FREE_TENANT_LIMIT`, as a new request
without its old service. The fleet script prints what it will do and waits for
the answer `yes` before each write; another answer writes nothing.

1. Find the row: `fleet.ts status --organization <organization ID>`, or
   `fleet.ts list` for each row of the prefix. Fallback: in the Supabase
   Dashboard, open the SQL Editor of the project and run this read:

   ```sql
   SELECT organization_id, state, service_name, render_service_id, failure_reason, updated_at, claimed_by, claimed_until
   FROM thermus_admin.tenants WHERE state = 'failed';
   ```

2. Read `failure_reason`, and do the step of the table first.
3. In the Render Dashboard, open the workspace Thermus AI and search the
   services for the `service_name` of the row. For zero or one service, go to
   step 4. For two or more services, delete each of them with the steps of
   [runbook 2](#2-orphaned-render-service), "Delete".
4. Run `fleet.ts delete --organization <organization ID>`. Check the row and
   the service that it prints, then answer `yes`. It deletes the service of the
   row through the adapter and sets the row `deleted`. A row without a service
   ID only becomes `deleted`.
5. Check: `fleet.ts status --organization <organization ID>` shows the row
   `deleted`, and the Render Dashboard does not list its service.
6. Run `fleet.ts request --organization <organization ID>` through the WorkOS
   launcher of the environment, and answer `yes`. The command reads the
   organization in WorkOS first and refuses an organization that WorkOS does
   not have. The row goes back to `requested`.
7. Check: the log has three `Tenant provisioning record:` lines for the
   organization: `"state":"creating"`, then `"state":"deploying"` with a
   `serviceId`, then `"state":"live"` with an `internalUrl`. In the recorded
   runs, a first deploy was live 64 to 104 s after its create call. Then
   Connect in the portal shows the connection guide within about 15 s: the
   registry copy is read again after 10 s, and the setup page reloads every
   5 s.
8. If the same reason comes back, stop. Do not repeat the repair, and tell the
   owner.

Do not change a row with SQL: each fleet statement names the state that it
starts from, and SQL by hand does not.

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
`<n> services of the platform have the name <name>`.

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

1. List the tenant services of Render: in the Render Dashboard, open the
   workspace Thermus AI and search the services for the prefix. The API read
   is `GET /v1/services?ownerId=tea-db8i6ceq1p3s73dev9og&type=private_service&limit=100`,
   one page after the other with the cursor. The fleet script has no command
   for the services of Render: its `list` reads the registry (step 2).
2. List the rows with `fleet.ts list`. It gives each row of the prefix with
   its service ID and name, and each row without a service yet. Fallback: in
   the Supabase SQL Editor, run this read:

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
- New tenants. The gateway cannot insert a `requested` row, so the MCP call
  of an organization without a tenant gets the `503` of the next item.
  Signup cannot insert a row either. With the switch on, signup reads the
  free-tenant cap from the registry copy of the gateway, so after 60 s each
  signup page answers "Activation is temporarily unavailable. Try again
  later." and writes a `Hosted signup could not read the free-tenant cap.`
  line. With the switch off, signup checks no cap: it creates the organization
  and writes a `Hosted signup could not request the tenant of the new
  organization.` line, and the first workspace status read after the resume
  requests the tenant again.
- The workspace status. After 60 s, Connect in the portal shows "The service
  is temporarily unavailable. Try again in 15 seconds." in place of the
  connection guide, and reloads every 5 s. With the switch off, Connect shows
  the connection guide, because the control plane serves the tools itself.
- The registry reads of the gateway. The gateway serves its copy of the
  registry for up to 60 s. Then each MCP call through the gateway gets `503`
  with `Retry-After: 15` and "The service is temporarily unavailable. Try
  again in 15 seconds.". The log gets `MCP gateway refusal:` lines with
  `"reason":"registry-unavailable"`. With the switch off, the control plane
  runs the MCP calls itself, and they do not stop.
- The audit export. Each export reads the destination settings first, so it
  sends nothing, and the events are lost: there is no durable queue
  ([S2-01a](admin-s2-01a-database-setup.md#verify-and-retain-rollout-evidence)).
  The Audit logs page shows that the settings are unavailable.
- Member removal. A removal does not start
  ([removal runbook](admin-s2-5-02-removal-runbook.md)).
- Billing, from Slice 3. The Stripe webhook route and the daily reconciliation
  cannot apply a status. Stripe sends a failed webhook again, and the
  reconciliation corrects each status within a day after the resume.
- The daily sweeps. The fleet summary gives no line but
  `Tenant fleet summary stopped:`, the idle sweep suspends nothing and gives
  `Idle sweep stopped:`, and the organization sweep of a Monday deletes
  nothing and gives `Organization sweep stopped:`.
- Resumes. The gateway cannot move a `suspended` row, so the MCP calls of a
  suspended tenant get `503` with `Retry-After: 15` and
  `"reason":"registry-unavailable"`, and no resume goes to Render.

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
- With the switch on: the `registry-unavailable` refusals stop, and an MCP
  call reaches its tenant. Connect of an organization with a live tenant shows
  the connection guide, and the signup page shows its notice again.
- In an organization with a saved destination, open Audit logs. The page
  shows the settings, and **Test** passes.
- The next daily summary line `Tenant fleet summary:` comes at the next tick.

Write the time of the pause and its effects in the operator record. D-8 asks
to examine the Supabase plan again at the first paying customer
([plan section 5](self-onboarding-plan.md#5-owner-decisions-answered-on-26-october-2026)).

## 4. Deletion of a tenant

The order: first the WorkOS organization, then the tenant. The
[account deletion](hosted-account-deletion.md#delete-the-tenant-of-a-removed-organization)
runbook gives this order and the registry rows.

1. Remove the WorkOS organization under the existing procedure of
   [account deletion](hosted-account-deletion.md). Then no member has access
   when the tenant goes.
2. Run `fleet.ts delete --organization <organization ID>`. It prints the row,
   the service ID, and the service name. Check them, then answer `yes`.
   The command deletes the Render service through the adapter, then sets the
   row `deleted` from the state and the service that it read. A row that
   another writer changed meanwhile, also a new provision of the organization
   with a new service, stays as it is, and the command says so.
3. Check: `fleet.ts status --organization <organization ID>` shows the row
   `deleted`, and the Render Dashboard does not list the service. A service
   that Render no longer has counts as deleted, so a repeat of step 2 is safe.
4. Write the IDs and the result in the private record of the deletion.

If step 2 does not happen, the weekly organization sweep of the control plane
deletes the tenant. It runs on Mondays at the daily tick of
`TENANT_SWEEP_HOUR_UTC` (default 04:00 UTC). It compares the rows that are not
`deleted` with the complete WorkOS organization list; a failed page deletes
nothing and gives `Organization sweep stopped:`. An empty list, or a list that
leaves out more than 2 of these rows, also deletes nothing and gives
`Organization sweep stopped:` with the counts (manager decision of 28 October
2026), because a WorkOS key of another environment or a defect of the list
read would make every organization look gone. Then do steps 2 to 4 by hand for
each organization that is really gone. Inside that bound, the sweep reads each
organization that the list leaves out by its ID, and it deletes only after a
`404`, because the WorkOS lists lag for some seconds. Then the row is
`deleted`, and the log has one `Tenant removal record:` line for the tenant. A
row that the provisioner works on (`creating` or `deploying`) waits for the
next sweep.

The row stays in the registry in state `deleted`, because the runtime role has
no `DELETE` grant. It keeps its service ID and name for the record, and its
internal address goes. A `deleted` row holds no place under `FREE_TENANT_LIMIT`.
A later request of signup or of the gateway for the same organization keeps
the `deleted` row. Only the fleet command `request`, the repair of
[runbook 1](#1-failed-provision), brings it back.

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
| Control plane key | The provisioner, the organization sweep, the idle sweep, the daily summary, and the resume of the gateway. | The Render secret variable `RENDER_API_KEY` of the production service. |
| Release key | The deploy job of [`hosted-image.yml`](../../.github/workflows/hosted-image.yml) ([Hosted release](../../README.md#hosted-release)). | The secret `RENDER_API_KEY` of the GitHub environment `production`, which allows only `main`. The repository secret `RENDER_API_KEY` stays only until the first dispatch on `main` passes with the environment. |
| Fleet key | The fleet script, the probes, and the Render interface gate. It is the key of the owner's Render user. | The variable `RENDER_API_KEY` in the git-ignored `.env.local` of the main checkout. |

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
   - Release: on GitHub, open the repository **Settings**, then
     **Environments**, then `production`. Under **Environment secrets**, update
     `RENDER_API_KEY`. Or run
     `gh secret set RENDER_API_KEY --env production --repo tomer-mayara/Thermus`,
     and paste the key at its prompt. Do not put the key on the command line.
     Do not put the key in a repository secret: a workflow on any branch can
     read a repository secret. If the repository secret `RENDER_API_KEY` still
     exists, delete it after the check of step 4, with
     `gh secret delete RENDER_API_KEY --repo tomer-mayara/Thermus`.
   - Fleet: open `/Users/tomermayara/git/Thermus/.env.local` in an editor, and
     replace the value. Do not show the file.
3. Do not revoke the old key yet.
4. Check the new key:
   - Control plane: the deploy is `live`, and the start line
     `The tenant provisioner runs:` is in the log. Then wait for the next
     Render call: a `Tenant provisioning record:` line with
     `"state":"deploying"` or `"state":"live"`, or the next
     `Tenant fleet summary:` line with `memory` values and an empty
     `unavailable` list. A wrong key gives
     `Render answered 401` in a `Tenant provisioning retry:` line or a
     `Tenant provisioning failed:` line.
   - Release: dispatch the workflow on `main` with a digest that GHCR has and
     the service ID of a tenant:
     `gh workflow run hosted-image.yml --repo tomer-mayara/Thermus --ref main -f digest=sha256:<digest> -f service_id=<tenant service ID>`.
     The deploy job reads the service with the key, and then it stops with
     "The service is a private_service, not a web service." No deploy starts
     ([`deploy-hosted-image.ts`](../../script/release/deploy-hosted-image.ts)).
     With a wrong key, the job stops with `answered 401`. With no key in the
     environment `production` and no repository secret, it stops with
     `RENDER_API_KEY is empty` before any Render call. Before a tenant exists,
     the next release dispatch is the check. The job reads the service before
     it deploys, so a wrong key stops the job before any change.
   - Fleet: run `fleet.ts status --organization <organization ID>` for a
     tenant with a service. It reads the newest deploy and the internal address
     on Render with the key; a wrong key gives `unavailable (Render answered
     401...)`. The command `list` reads only the registry, so it is no check of
     the key. Without a tenant, run the next probe or interface gate that reads
     Render.
5. Revoke the old key: in **Account Settings**, **API Keys**, open the menu
   (**•••**) of the old key, click **Revoke**, and confirm. A revoke takes
   effect at once.
6. Check again with the check of step 4.

### 5.2 Gateway key pair

The fleet command `upgrade` of SO-09 deploys the tenants in batches of three.
The order is add, switch, remove, with several accepted public keys (answer 3
of the SO-11 ticket, from SO-09).

- `GATEWAY_SIGNING_KEY` is the private key. It lives in a Render secret
  variable of the production service.
- `GATEWAY_PUBLIC_KEY` is the list of accepted public keys. It lives in a
  Render variable of the production service and of each tenant service. A
  tenant tries each key of its list
  ([`access-context-verifier.ts`](../../src/accounts/identity/access-context-verifier.ts)).
  The provisioner copies the list of the control plane into each new tenant.
- The start check: with `MCP_TENANTS_ENABLED` on, the control plane does not
  start when its `GATEWAY_PUBLIC_KEY` does not include the public key of its
  `GATEWAY_SIGNING_KEY`. The log then has a `FATAL` line with
  `GATEWAY_PUBLIC_KEY must include the public key of GATEWAY_SIGNING_KEY.`
  ([`gateway-settings.ts`](../../src/runtime/config/gateway-settings.ts)). The
  check compares the keys, not their text. So add the new public key to the
  control plane before the switch, and remove the old public key from it only
  after the switch.
- A context expires 2 minutes after the gateway signs it
  ([`signed-access-context.ts`](../../src/accounts/identity/signed-access-context.ts)).
  The relay route checks each relay with the public key of the current signing
  key only
  ([`mcp-gateway-composition.ts`](../../src/app/mcp-gateway-composition.ts)).
  So for about 2 minutes after the switch, the route refuses the relay of a
  call that started before the switch. The log then has an
  `Audit relay refusal:` line with `"reason":"context"` and
  `"detail":"signature"`. That audit event is lost. Do the switch at a quiet
  time.

The fleet script has no command for a variable. Change a variable of a
service in the Render Dashboard (the service, then **Environment**), or with
the API call `PUT /v1/services/<service ID>/env-vars/GATEWAY_PUBLIC_KEY`. Then
deploy with `fleet.ts upgrade` and the current digest of the tenant:
`fleet.ts list` shows the digest of each row. A deploy reads the variables of
the service at its start, and the deploy with `imageUrl` keeps the image when
the digest is the current one.

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
3. Add on each tenant. List the tenants with `fleet.ts list`. Set
   `GATEWAY_PUBLIC_KEY` of each one to the same two keys, also of a suspended
   tenant: its resume deploy reads the new value. Deploy the live tenants in
   batches of three:
   `fleet.ts upgrade --all --image ghcr.io/tomer-mayara/thermus-hosted@<current digest>`,
   and answer `yes`. For a tenant on another digest, run
   `fleet.ts upgrade --organization <organization ID> --image ghcr.io/tomer-mayara/thermus-hosted@<its digest>`.
   Check: each deploy reaches `live` with the digest, and its line ends with
   `digest recorded`; the upgrade stops after the first batch with a deploy
   that does not, and the later batches do not start. Then read
   `GATEWAY_PUBLIC_KEY` of each tenant service again: each one has both keys.
4. Switch. Set `GATEWAY_SIGNING_KEY` of the production service to the new
   private key. Deploy the control plane. Check: the deploy is `live`, the
   start passes its check, and MCP calls work. A tenant without the new key
   refuses each call with `403`. If calls fail, set the old private key again
   and deploy: each tenant still accepts the old key.
5. Wait 2 minutes after the deploy of step 4 is `live`, so that each context of
   the old key expires. Calls go to the new instance once it is live (SO-01c).
   Render stops the old instance of the control plane about 120 s after the
   new instance is live: 119.7 s in R9 and in R14 of the SO-12 rehearsal of
   31 October 2026, not the 60 s that Render documents.
6. Remove on each tenant. Set `GATEWAY_PUBLIC_KEY` of each tenant service to
   the new public key only. Deploy the live tenants in batches of three with
   `fleet.ts upgrade --all --image ghcr.io/tomer-mayara/thermus-hosted@<current digest>`,
   as in step 3. Check: each deploy reaches `live`, and MCP calls work.
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
   Deploy one service that uses the credential: a tenant with
   `fleet.ts upgrade --organization <organization ID> --image ghcr.io/tomer-mayara/thermus-hosted@<its digest>`,
   or the control plane from step 5 of the SO-12 order. Check that the deploy
   reaches `live`. Before
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
3. Check: list the versions again. Each digest to keep is still there. The
   next fleet upgrade or resume deploy reaches `live`. `fleet.ts list` gives
   the digest of each row. A tenant whose upgrade stopped can have an image
   setting with the digest of the failed deploy
   ([SO-09 record](self-onboarding-s1.md#so-09-fleet-script-and-organization-sweep)): keep that
   digest until `fleet.ts upgrade` has deployed the recorded digest to it
   again.
   If you deleted a version that a service needs, restore it within 30 days on
   the package page, or with
   `gh api --method POST /user/packages/container/thermus-hosted/versions/<version ID>/restore`.
4. Remove the two scopes:
   `gh auth refresh --remove-scopes read:packages,delete:packages`.
5. Write the date, the number of deleted versions, and the kept digests in the
   operator record.

### 5.6 Axiom ingest token of the system log

`SYSTEM_LOG_OTLP_TOKEN` of the production service is an Axiom API token with
ingest permission for the dataset `system-log` only (SO-11a,
[7.3](#73-axiom-monitors)). The control plane reads it at its start. A refused
or expired token gives `System log export failed: HTTP 401.` or
`HTTP 403.` lines on standard error, and the monitors get no new line.
Standard error on Render still has each line for 7 days.

1. In Axiom, click **Settings**, then **API tokens**, and click **New API
   token**. Type a name such as `Thermus control plane system log <date>`.
   In **Token permissions**, click **Basic**, and in **Dataset access** select
   `system-log` only. A basic token can only ingest. If you set an expiration
   date, write it in the operator record, and rotate some days before it.
   Click **Create**
   ([Axiom tokens](https://axiom.co/docs/reference/tokens#create-basic-api-token)).
2. Copy the token: Axiom shows it one time only. Put it in the password
   manager of the owner, and nowhere else.
3. In the Render Dashboard, open the production service, then
   **Environment**, and set the secret variable `SYSTEM_LOG_OTLP_TOKEN` to the
   new token. Save, and deploy if the save does not start a deploy.
4. Do the check of the log path in [7.3](#73-axiom-monitors): no `FATAL` and
   no `System log export failed:` line in the Render log, and the
   `Listening on` line of the deploy in `system-log`.
5. In Axiom, delete the old token. Check again after the next line of the
   control plane, for example after the next deploy.

## 6. Shared Brave search limit

This is a runbook entry, not an alert (answer 4 of the SO-11 ticket).

**The limit.** The search tool reads the public Brave website without an API
key ([search tool](../reference/mcp-search-tool.md)). Render shares the
outbound addresses of a region across all services of that region. So all
tenants send their searches from the same addresses, and Brave limits them
together. In SO-01e, Brave answered `HTTP 429` to 10 searches at the same
time, and 5 searches at the same time passed
([SO-01e findings](self-onboarding-s1.md#findings)).

**The guard.** With `MCP_TENANTS_ENABLED` on, the gateway allows 5 searches
at a time across all tenants. The sixth gets the tool error "Server busy. Try
again later.", and the log gets an `MCP gateway refusal:` line with
`"reason":"search-busy"`. The limit is the constant `SEARCH_LIMIT` of
[`mcp-gateway-searches.ts`](../../src/interfaces/mcp/mcp-gateway-searches.ts),
not a setting.

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
  SO-11a adds no Render log stream: the control plane exports its own system
  log ([7.3](#73-axiom-monitors)).

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
plane in the Axiom dataset `system-log`. The owner chose the path on
28 October 2026: the control plane exports its system log through
[`OtelSystemLogSink`](../../src/logs/system/otel-system-log-sink.ts), not
through a Render log stream (SO-11a,
[plan section 6](self-onboarding-plan.md#slice-2-free-tier-end-to-end)). The
export needs three settings of the production service:

| Setting | Value |
| --- | --- |
| `SYSTEM_LOG_OTLP_ENDPOINT` | `https://us-east-1.aws.edge.axiom.co/v1/logs`: the edge deployment of the dataset `system-log`, as its dataset settings showed on 28 October 2026. |
| `SYSTEM_LOG_AXIOM_DATASET` | `system-log` (owner decision of 28 October 2026). The tests use `system-log-test` only. |
| `SYSTEM_LOG_OTLP_TOKEN` | A secret variable: an Axiom API token with ingest permission for `system-log` only ([5.6](#56-axiom-ingest-token-of-the-system-log)). |

With the three empty, the control plane writes its system log to standard
error only, no monitor can fire, and the Render failure emails are the only
alerts. The endpoint without the token, or the token without the endpoint,
stops the start with a `FATAL` line that names the setting. Only the control
plane exports: the lines of a tenant stay on Render for 7 days, because a
tenant holds no token (D-14). The export is best effort: a failed batch is
dropped, and the control plane writes one `System log export failed:` line to
standard error at most once a minute. At a stop, it waits at most 5 s for the
last lines.

**Check the log path.** After each deploy that sets or changes one of the
three settings:

1. In the Render log of the production service, look for a `FATAL` line, and
   for a `System log export failed:` line after the start. There must be
   none.
2. In Axiom, run this query over the last 15 minutes. It must show the
   `Listening on` line of the deploy.

```kusto
['system-log']
| where ['service.name'] == "thermus-control-plane"
| where body contains "Listening on "
| project _time, severity_text, body, ['service.instance.id']
```

The field `body` holds the message with the caller file and line, without the
time, the level label, or color codes, and `severity_text` holds the level. A
query of the test dataset showed these fields on 28 October 2026.

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
| Tenant restart | Each line that contains `MCP gateway tenant restart: `. | A live tenant answered `HTTP 502` or reset the connection during a call. With `phase` `before-answer`, the client got "Server restarted. Try again in a minute.". With `during-answer`, the gateway ended the answer stream. This is the alert on the first restart outside a deploy (SO-01e). A restart during a fleet upgrade also gives a line: compare its time with the upgrade. A new tenant sends no email: in the first 2 minutes after the live record of its row, a failure before the first answer byte gives the INFO line `MCP gateway tenant starting:`, because the private address of a new tenant refuses connections for about 75 s after the provisioner records it live (the SO-12 rehearsal of 31 October 2026). |
| Tenant memory at 80 % | The daily summary line, when its `highestMemoryShare` is 0.8 or more: a live tenant had a memory point at or above 80 % of the memory limit that Render gives for its plan, about 410 MiB of the 536,870,900 bytes of `0.5c-512mb`, and about 1,638 MiB of the 2 GiB of `1c-2g`. | A tenant came near its memory limit. On `0.5c-512mb`, five 9 MiB calls peaked at 379 MiB, 74 % of the limit, and ten calls restarted the container (SO-01e). |
| Fleet summary | Each line that contains `Tenant fleet summary: `. | One email a day with the counts and the cost by state and plan, the memberships with only the default role, the restarts outside a deploy, and the memory values ([the summary fields](#the-summary-fields)). This is the fleet alert of D-9. |

The queries, in the advanced query language (APL), read the field `body` of
the dataset `system-log`:

```kusto
['system-log']
| where body contains "MCP gateway tenant restart: "
```

The query of the monitor Tenant restart matches only the restart line. The
cold start line `MCP gateway tenant starting: ` has another prefix and the
level INFO, so it does not match. To see the cold starts and how long they
last, run this query; no monitor uses it:

```kusto
['system-log']
| where body contains "MCP gateway tenant starting: "
| extend start = parse_json(substring(body, indexof(body, "MCP gateway tenant starting: ") + 29))
| project _time, organizationId = tostring(start.organizationId), secondsSinceLive = todouble(start.secondsSinceLive)
```

```kusto
['system-log']
| where body contains "Tenant fleet summary: "
```

The memory monitor reads the JSON after the prefix. `peakShare` divides the
peak of each live tenant by the memory limit that Render gives for its plan,
so 0.8 is 410 MiB on `0.5c-512mb` and 1,638 MiB on `1c-2g`:

```kusto
['system-log']
| where body contains "Tenant fleet summary: "
| extend summary = parse_json(substring(body, indexof(body, "Tenant fleet summary: ") + 22))
| where todouble(summary.highestMemoryShare) >= 0.8
```

To see the tenant, expand the list:
`| mv-expand tenant = summary.memory | where todouble(tenant.peakShare) >= 0.8`.
A tenant without a limit series has a `peakShare` of `null`: compare its
`peakBytes` with 429,496,720 for `0.5c-512mb` (80 % of 536,870,900) or about
1,717,986,918 for `1c-2g` (80 % of 2 GiB).
Keep the prefix `Tenant fleet summary: ` stable: the match monitors use it with
`contains`.

**When a monitor fires.**

- Tenant restart: open the tenant service in the Render Dashboard. Read its
  memory and its instance count at the time of the line; the instance count
  can show 0. For one restart, write it in the operator record. For restarts
  again and again, tell the owner. D-2 accepts a kill on a very large page on
  `0.5c-512mb`. A `before-answer` line soon after 2 minutes from a
  `Tenant provisioning record:` line with `"state":"live"` of the same
  organization, after `MCP gateway tenant starting:` lines with a
  `secondsSinceLive` near 120, is a cold start that lasted longer than 2
  minutes. If the next calls answer, write its length in the operator record;
  it is not a restart.
- Tenant memory at 80 %: no action at once. If it comes again for a tenant,
  tell the owner: a page or a load needs more memory than the Slice 1 runs
  measured.
- Fleet summary: read it. Compare `monthlyUsd` and `byState` with
  [plan section 8](self-onboarding-plan.md#8-cost-model). Use
  [runbook 1](#1-failed-provision) for each `failed` item of `byState`. A
  membership of `defaultRoleMembershipList` is a billed seat in WorkOS without
  product access ([plan section 7](self-onboarding-plan.md#7-risks-and-limits)):
  tell the owner. For `restarts` above 0, do what the Tenant restart monitor
  says for each tenant of `restartList`. Each text of `unavailable` names a read
  that failed: look for the same text in the next summary. A day without this
  email, or a `Tenant fleet summary stopped:` line, means that the control
  plane, its registry, its daily sweep, or the log path stopped: examine them.

### 7.4 Owner steps for the alerts

Do them in this order:

1. Set the Render failure emails ([7.2](#72-render-failure-emails)).
2. Make the log path ([7.3](#73-axiom-monitors)), at step 6 of the SO-12
   order at the latest, after the owner decided the privacy text: the hosted
   document bundles name Render, not Axiom, as the processor of the service
   logs (the open point of SO-11a in
   [plan section 6](self-onboarding-plan.md#slice-2-free-tier-end-to-end)).
   Make the ingest token with steps 1 and 2 of
   [5.6](#56-axiom-ingest-token-of-the-system-log). On the production service,
   set the secret variable `SYSTEM_LOG_OTLP_TOKEN`, and
   `SYSTEM_LOG_OTLP_ENDPOINT` and `SYSTEM_LOG_AXIOM_DATASET` of the
   precondition table as plain variables, and deploy. Then do the check of the
   log path.
3. Make the email notifier ([7.3](#73-axiom-monitors)).
4. After the production control plane runs with `MCP_TENANTS_ENABLED` on
   (step 6 of the SO-12 order), make the monitor Tenant restart.
5. After SO-09 is in production with `MCP_TENANTS_ENABLED` on, make the
   monitors Tenant memory at 80 % and Fleet summary. The tenant sweeps run
   only with the switch on.
6. For each monitor, run its query over the last 7 days in the preview. Check
   that it shows the matching lines, or no line yet.

The Axiom MCP connector of the owner can also make the notifier and the
monitors.

## Sources

Repository, at `main` after the merge of #285 (SO-05): sections 4.2, 4.3, 5,
7, and 8 of the [self on-boarding plan](self-onboarding-plan.md); the sections
SO-01b, SO-01c, SO-01e, SO-02, SO-03, and SO-06 of the
[Slice 1 record](self-onboarding-s1.md); the
[database setup](admin-s2-01a-database-setup.md); the
[account deletion](hosted-account-deletion.md) runbook;
[Hosted release](../../README.md#hosted-release); the source files that the
sections link, among them the gateway lines of SO-05. SO-09 then changed the
fleet parts from its source: the fleet script
([`script/fleet/`](../../script/fleet/)), the tenant sweeps and the summary
line ([`src/tenancy/tenants/`](../../src/tenancy/tenants/)), and its section of
the Slice 1 record. External pages,
read on 28 October 2026: Render
[notifications](https://render.com/docs/notifications),
[log streams](https://render.com/docs/log-streams),
[API keys](https://render.com/docs/api), and
[registry credential update](https://api-docs.render.com/reference/update-registry-credential);
Supabase [project pausing](https://supabase.com/docs/guides/platform/free-project-pausing);
Axiom [match monitors](https://axiom.co/docs/monitor-data/match-monitors),
[email notifier](https://axiom.co/docs/monitor-data/email-notifier), and
[Render logs](https://axiom.co/docs/send-data/render).

SO-11a, on 28 October 2026: the SO-11a entry of
[plan section 6](self-onboarding-plan.md#slice-2-free-tier-end-to-end), the
owner decisions on the log path and the dataset `system-log`, the source files
[`system-log-output.ts`](../../src/app/system-log-output.ts),
[`system-log-export.ts`](../../src/app/system-log-export.ts),
[`system-log-failure-line.ts`](../../src/app/system-log-failure-line.ts), and
[`system-log-export-config.ts`](../../src/runtime/config/system-log-export-config.ts),
and [OTel system logger tests](../testing/otel-logger.md#system-log-export-of-the-control-plane).
External, read on 28 October 2026: Axiom
[OpenTelemetry](https://axiom.co/docs/send-data/opentelemetry) and
[API tokens](https://axiom.co/docs/reference/tokens); the dataset settings of
`system-log` (edge deployment `https://us-east-1.aws.edge.axiom.co`) and the
fields of `system-log-test`, read with the Axiom connector without a change.

The cold start line, on 31 October 2026: item 5 of the findings of the SO-12
rehearsal ([#301](https://github.com/tomer-mayara/Thermus/pull/301)), the
[SO-03](self-onboarding-s1.md#so-03-private-address-of-the-control-plane)
measurements, and the source files
[`mcp-gateway-refusals.ts`](../../src/interfaces/mcp/mcp-gateway-refusals.ts)
and [`tenant-lookup.ts`](../../src/tenancy/tenants/tenant-lookup.ts).
