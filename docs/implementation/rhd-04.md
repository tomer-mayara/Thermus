# RHD-04: production identity and Render setup

Status: planned; initial acceptance is not satisfied. Date: 2026-10-15.
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
| Separate staging environment | `environment_01M4VDKATD5PXZT4H01EHCMR2A`. |
| Production roles | Only default `member` and `admin`; multiple roles disabled. |
| Google sign-in | Disabled; no OAuth credential. |
| Native-client settings | CIMD and DCR disabled. |
| Production URLs | No redirect, logout, origin, or initiate-login URLs. |

The required role definitions, Google setup, native-client settings, service,
runtime settings, and production URLs are not verified as complete. The initial
acceptance result is **unsatisfied**.

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
| Staging | Existing staging settings remain separate and unchanged. | Pending final read-back |

Roles do not inherit. Admin or Super Admin alone gives no User access. Optional
MFA gives no proven MFA evidence, so protected Thermus administration stays denied.
Follow the [organization runbook](hosted-organization-setup.md) for Super Admin
changes, including completed operator MFA and the external operator record.
That runbook does not create identities or define roles.

## Pending owner information and ordering

- Confirm paid service budget, instance, region, and name. The plan proposes
  `thermus-hosted`, Oregon, and one 1 CPU / 2 GB instance.
- Supply the production Google project and OAuth application details and the
  authority to publish it; confirm production billing and protected secret access.
- Supply organization name, unique external ID, intended verified user emails,
  approved grants, and written reason. Identify a Super Admin if one is needed.
- Confirm the operator, completed dashboard MFA before runbook writes, and the
  external record location.
- Confirm connected Git credentials with access to both repositories and the
  native client; the plan uses Claude Code for the first proof.
- Merge the reviewed stack through PR #117 before selecting checked `main`.
  This branch starts at PR #117 head
  `c3a2734144a043b1d184f8531a59d4f2dafe41b1`.

Service creation starts an initial build/deploy even with auto-deploy off. Prefer
creation after the stack merges. If creation is needed to obtain the origin,
record any incomplete setup attempt as such and let missing configuration fail
closed. Do not supply placeholder identity settings. Complete exact WorkOS URLs
after the origin is known. Enable On Commit only after the RHD-05 remote smoke.

## Validation and handoff

Pending: manual read-back of each required result, with no secrets in evidence;
complete-candidate repository checks under the [test gate policy](test-gate-policy.md);
and review of this record. No provider acceptance pass is recorded yet.
Do not run staging fixture creation or cleanup against production.
