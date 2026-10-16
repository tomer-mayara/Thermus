# RHD-04: production identity and Render setup

Status: incomplete; initial acceptance is not satisfied. Date: 2026-10-15.
Draft [PR #118](https://github.com/3-headed-monkey/Thermus/pull/118) is stacked
on PR #117. No production setup success is recorded.
This record starts before provider changes. It contains no secret values.
The [hosted Docker plan](render-hosted-docker-plan.md) defines the scope.
RHD-05 owns rollout, remote journeys, load, auto-deploy proof, and recovery.

## Manual acceptance specification

**Given** authorized production provider and repository access, an approved paid
service, a checked revision on `main`, and named verified users with written
grant requests,

**When** the operator configures production identity and the Render service,
then reads the saved settings back,

**Then** the settings name one exact production origin, the matching production
WorkOS environment, the Thermus role mapping, the selected native client, the
checked revision, and matching runtime settings. Required settings are present
in protected storage. Missing configuration fails closed. Local staging remains
separate. Auto-deploy and previews remain off.

This is a manual provider acceptance check. A saved setting does not prove a
successful browser login, native-client login, render, or remote health response.
Those checks belong to RHD-05. Existing startup tests cover refusal of missing
configuration; do not break production to repeat that proof.

## Verified initial state

These read-backs were supplied by the setup session on 2026-10-15. They show
the starting state, not a completed setup.

| Item | Observed state |
| --- | --- |
| Render workspace | `tea-db8i6ceq1p3s73dev9og`; no services. |
| WorkOS project | `project_01M4VDKASGJ1KSYCWZWR2ZTT9D`. |
| Production environment | `environment_01M4VDKBVH3BKNY1F64VSWJ9ZD`. |
| Production client | `client_01M4VDKC291XX3CDEFP5ZKY5KP`. |
| Production application | `app_01M4VDKC50NT3Z13KGM1P2BFRD`. |
| Production issuer | `https://spontaneous-mountain-26.authkit.app`. |
| Separate staging environment | `environment_01M4VDKATD5PXZT4H01EHCMR2A`. |
| Production roles | Only default `member` and `admin`; multiple roles disabled. |
| Google sign-in | Disabled; no OAuth credential. |
| Native-client settings | CIMD and DCR disabled. |
| Production URLs | No redirect, logout, origin, or initiate-login URLs. |

The required role definitions, Google setup, native-client settings, service,
runtime settings, and production URLs are not verified as complete. The initial
acceptance result is **unsatisfied**.

## Further verified state and blocked write

Production user and organization lists are empty; both reads exhausted their
cursors. The dashboard session reports `productionState: Inactive`,
`canUseProduction: false`, and `hasActiveBilling: false`.
Dashboard MFA is neither required nor configured. These are operator dashboard
settings; they do not establish the AuthKit end-user MFA policy.

An explicit production `createPermission` request for `product:access` returned
`FORBIDDEN`, with an `ADMIN` role hint. No successful permission creation was
reported. Production mutations stopped; no fallback environment or write was used.
The owner must activate production billing and resolve production write authority
before configuration continues.

Render's existing Git credential `tomer-mayara` shows `code-review-agents`, but
a Thermus repository search returns no result. GitHub CLI confirms private Thermus
admin access for its own account. That does not prove Render checkout access.
The owner must authorize Thermus for Render and retain submodule access.
The owner confirmed the Render workspace name, Thermus AI. This does not identify
the intended production users, their grants, or a Super Admin.

## Planned configuration and read-back

Record each result with its date and proof source after configuration. Inspect
protected values without copying them here; record only that they were checked.

| Area | Required result | Evidence status |
| --- | --- | --- |
| WorkOS | Production billing active; API key, client, and exact HTTPS AuthKit issuer match production. | Pending |
| Google | Production OAuth credential, exact WorkOS callback, and suitable publication state; sign-in enabled. | Pending |
| URLs | `<origin>/callback`, default sign-out `<origin>/`, initiate login `<origin>/login`, and MCP resource `<origin>/mcp`. | Pending origin |
| MFA | AuthKit Optional and `WORKOS_MFA_POLICY=optional`. | Pending |
| Roles | Multiple roles enabled; `user`: `product:access`; `admin`: `user-grants:manage`; `super-admin`: `admin-grants:manage`, `billing:manage`. Default and other roles give no Thermus permission. | Pending |
| Users and grants | Verified identities and approved active memberships with explicit User grants; no implicit enrollment. | Pending owner request |
| Native client | Separate production registration; CIMD enabled; DCR only if needed; exact MCP resource. Read back metadata and settings. | Pending |
| Git access | Connected credentials can read Thermus and `tools/code-review-agents`; Docker ignore does not bypass submodule checkout. | Pending |
| Render service | Paid Git-backed service on `main`, root context, `Dockerfile.hosted`, `/healthz`, no pre-deploy command, previews off, auto-deploy off. | Pending |
| Runtime | Hosted deployment, root HTTPS public URL, Render `PORT=8080`, matching WorkOS settings, stable protected cookie key of at least 32 characters. | Pending |
| Image settings | Listener `0.0.0.0:8080`, absolute pinned renderer and rules paths, telemetry disabled. | Pending service read-back |
| Revision | First intended manual deployment names checked `main` after the stack merges. | Pending merge |
| Staging | Inspected staging AuthKit settings, applications, and roles remain unchanged. | Verified; limited to these reads |

Roles do not inherit. Admin or Super Admin alone gives no User access. Optional
MFA gives no proven MFA evidence, so protected Thermus administration stays denied.
Follow the [organization runbook](hosted-organization-setup.md) for Super Admin
changes, including completed operator MFA and the external operator record.
That runbook does not create identities or define roles.

## Proposed Render settings

These are reviewable planned inputs, not a creation result. The owner approved
`thermus-hosted`, Oregon, one `1c-2g` instance (formerly Standard) at $25/month
for 1 CPU and 2 GB RAM, plus variable usage, and the assigned Render HTTPS
address. Git access is pending. Variable usage includes builds and bandwidth; see
[Render pricing](https://render.com/pricing).

| Creation input | Planned value |
| --- | --- |
| Type / owner / name | Web Service / `tea-db8i6ceq1p3s73dev9og` / `thermus-hosted`. |
| Repository / branch | `https://github.com/3-headed-monkey/Thermus` / `main`. |
| Runtime / region / plan | Docker / Oregon / `1c-2g` (formerly Standard), one instance. |
| Docker context / file | Repository root (`.`) / `Dockerfile.hosted`. |
| Health check | `/healthz` at creation. |
| Auto-deploy / previews | Off / off. |
| Pre-deploy command | None. |
| Runtime values | `DEPLOYMENT=hosted`, `PORT=8080`, `WORKOS_MFA_POLICY=optional`, known production client and issuer above. |
| Values still required | Assigned HTTPS `PUBLIC_BASE_URL`, matching `WORKOS_REDIRECT_URI`, protected production API key and stable cookie password. |

Use the Dashboard or the [full create-service API](https://api-docs.render.com/reference/create-service)
to set the health path at creation. The MCP create operation lacks a health field.
No Blueprint is needed. Leave the image's listener, rules, renderer, and telemetry
settings as the image defines them. No origin or secret value has been guessed.

## Pending owner information and ordering

- Supply the production Google project and OAuth application details and the
  protected credential location and authority to publish it. Activate production
  billing, resolve the refused production write, and confirm protected secret access.
- Supply organization name, unique external ID, intended verified user emails,
  approved grants, and written reason. Identify a Super Admin if one is needed.
- Confirm the operator, completed dashboard MFA before runbook writes, and the
  external record location.
- Confirm connected Git credentials with access to both repositories and the
  native client; the plan uses Claude Code for the first proof.
- Merge the reviewed stack through PR #117 before selecting checked `main`.
  This branch starts at PR #117 head
  `c3a2734144a043b1d184f8531a59d4f2dafe41b1`.
  Current `main`, `cf2928ba239e4ef88e7cf7e660d5b08bc04b6486`, lacks that stack.

WorkOS remains the authentication provider. Production Google sign-in needs an
owner-managed Google OAuth client; see the official
[WorkOS Google OAuth setup](https://workos.com/docs/integrations/google-oauth).
The Google project and protected credential location remain pending.

Service creation starts an initial build/deploy even with auto-deploy off. Prefer
creation after the stack merges. If creation is needed to obtain the origin,
record any incomplete setup attempt as such and let missing configuration fail
closed. Do not supply placeholder identity settings. Complete exact WorkOS URLs
after the origin is known. Enable On Commit only after the RHD-05 remote smoke.

## Validation and handoff

`pnpm exec node --run check` passed with exit status 0; the session log is
`/tmp/thermus-rhd04/check.log`.

`habit-hooks` exited 1 with 180 findings: 3 high-complexity, 1 oversized-function,
1 unused-variable, 164 non-essential-comment, and 11 oversized-file findings.
The log is `/tmp/thermus-rhd04/habit-hooks.log`. Every rule group and diagnostic
location matches `/tmp/thermus-rhd03/habit-hooks-post-fixture.log`. The manager
retained these findings for the [RHD-03 reasons](rhd-03.md#retained-habit-hooks-findings).
The snooze file remains `[]`. This is not a clean hooks pass. This change adds no
code. Follow the [test gate policy](test-gate-policy.md) for the complete candidate.

Final staging `authkitSettings`, `authkitApplications` (limit 100), and `roles`
query results were byte-identical to their initial text snapshots. This proves
only that these inspected settings are unchanged; it does not cover all provider
state. Render repository authorization remains pending; no repository grant was
made.

The manager reviewed this record and the plan status update. The whitespace check
passed, and all 25 relative file links resolve. Production read-backs remain pending.
No provider acceptance pass or Ready status is recorded; RHD-04 remains incomplete
in Draft #118.
Do not run staging fixture creation or cleanup against production.
