# RHD-04: production identity and Render setup

Status: incomplete; initial acceptance is not satisfied. Date: 2026-10-15.
Draft [PR #118](https://github.com/3-headed-monkey/Thermus/pull/118) is stacked
on PR #117. Production identity settings are partly configured; setup is incomplete.
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

## Historical setup blocks

Initially, production was inactive, unusable, and without active billing; user
and organization lists were empty with exhausted cursors. Dashboard MFA was neither
required nor configured. An explicit production `createPermission` request for
`product:access` returned `FORBIDDEN` with an `ADMIN` hint. Writes stopped, with
no fallback. The later activation and successful writes below resolved that block.
The initial Render search did not show Thermus; the later checkout below proved
access for that checkout. The agent made no GitHub grant.

## Verified production configuration update

Read back on 2026-10-15 after owner activation: `productionState: Active`,
`canUseProduction: true`, and `hasActiveBilling: true`. The explicit production
permission creation now succeeded. Four Thermus permissions were created.

| Role | Read-back permissions |
| --- | --- |
| `member` | None. |
| `user` | `product:access`. |
| `admin` | `user-grants:manage`, `widgets:dsync:manage`, `widgets:users-table:manage`. |
| `super-admin` | `admin-grants:manage`, `billing:manage`. |

The new role IDs are `role_01M5113VYK46GWNZWQHBF7808W` (`user`) and
`role_01M511402XZGQVV2MKWA46AFPS` (`super-admin`). The existing Admin widget
permissions were preserved; they are outside the Thermus permission set.
Multiple roles are enabled, `member` remains the default, and SSO and Directory
Sync role assignment are disabled.

AuthKit read-back confirms Optional MFA, password sign-in, email verification,
CIMD, and sign-up enabled. DCR, Google, passkeys, and magic sign-in are disabled.
DCR remains conditional on the actual Claude Code flow. Provider sign-up does
not grant Thermus product access; no automatic enrollment was added.

Production user and organization reads still show none. No account, membership,
or grant was created. The owner approved User access for two initial identities;
their email addresses stay outside this repository. No Super Admin was requested.
`Thermus AI`, external ID `thermus-ai`, is planned only. Dashboard MFA enrollment
is now configured and the workspace MFA requirement is enabled, both read back.
Completed MFA sign-in still needs owner confirmation before provisioning.
Dashboard MFA is separate from Optional end-user MFA.

Production URL settings were persisted and read back:

| Setting | Verified value |
| --- | --- |
| Default redirect | `https://thermus.onrender.com/callback` |
| Default sign-out | `https://thermus.onrender.com/` |
| Initiate login | `https://thermus.onrender.com/login` |
| Default MCP resource | `https://thermus.onrender.com/mcp` |
| Web origins / access token expiry | `[]` / 300 seconds |

Public AuthKit metadata confirms CIMD support, no `registration_endpoint`, and
scopes `email`, `offline_access`, `openid`, `profile`. Native client registration
and journeys remain pending. Roles do not inherit: Admin or Super Admin alone
gives no User access. Optional MFA keeps protected Thermus administration denied.
Follow the [organization runbook](hosted-organization-setup.md) for Super Admin
changes; none is requested here.

## Verified Render service and pending runtime settings

Reuse the owner-created service `Thermus` (`srv-db8mnqg473hc739d529g`) at
`https://thermus.onrender.com`; do not create the earlier proposed `thermus-hosted`.
It is in the approved Thermus AI workspace, Oregon, with one `1c-2g` instance
(formerly Standard): 1 CPU / 2 GB, $25/month plus variable build and bandwidth
usage. See [Render pricing](https://render.com/pricing).

| Setting | Verified read-back |
| --- | --- |
| Repository / branch | `https://github.com/3-headed-monkey/Thermus` / `main` |
| Runtime / root directory | Docker / empty root directory |
| Docker context / file | `.` / `./Dockerfile.hosted` |
| Health / Docker command | `/healthz` / empty command |
| Auto-deploy | Trigger `off`, auto-deploy `no` |
| Previews / pre-deploy command | Off / none |

The UI confirms seven saved environment keys and no linked environment groups.
Each saved public value below was independently checked in the UI and matched:

| Key | Verified saved value |
| --- | --- |
| `DEPLOYMENT` | `hosted` |
| `PUBLIC_BASE_URL` | `https://thermus.onrender.com/` |
| `PORT` | `8080` |
| `WORKOS_CLIENT_ID` | Production client listed above |
| `WORKOS_AUTHKIT_ISSUER` | Production issuer listed above, no final slash |
| `WORKOS_REDIRECT_URI` | `https://thermus.onrender.com/callback` |
| `WORKOS_MFA_POLICY` | `optional` |

The production API key and stable cookie password are not installed. The Render
form has two unsaved empty fields, `WORKOS_API_KEY` and `WORKOS_COOKIE_PASSWORD`,
with **Save only** selected. The form was handed to the owner for direct secret
entry. Keep secrets in protected settings. The image defines listener
`0.0.0.0:8080`, absolute rules and renderer paths, and disabled telemetry.
No Blueprint is needed. The Dashboard
and [full create-service API](https://api-docs.render.com/reference/create-service)
support a health path at creation; the MCP create operation lacks that field.

The first deploy, `dep-db8mnqo473hc739d53m0`, used old `main`
`cf2928ba239e4ef88e7cf7e660d5b08bc04b6486` and ended `update_failed` because
`PUBLIC_BASE_URL` was missing. Its logs show private Thermus checkout, submodule
sync, then Docker build. That clears the Git access blocker for that checkout;
it does not mean the agent granted repository access.

The MCP environment update unexpectedly triggered `dep-db8mtcjbc2fs73beo450`,
despite auto-deploy being off and the REST documentation stating no automatic
deploy. It ended `build_failed` on old `main`: `Dockerfile.hosted` was absent.
Neither attempt made the service live. These were setup failures, not deliberate
fault tests. No manual deploy was requested. Use Dashboard **Save only** for
further environment changes until checked `main` is ready.

## Pending owner information and ordering

- Complete the Google project setup below and confirm protected secret access.
  Production activation and permission write authority are now verified.
- The planned organization is `Thermus AI`, external ID `thermus-ai`; creation
  awaits operator MFA. The owner approved User access
  for two initial identities in the session. Keep their email addresses outside
  this repository. Verify those identities before granting access. No Super Admin
  was requested.
- Confirm completed operator MFA sign-in before provisioning and the external
  record location. Enrollment and the workspace requirement are verified.
- Configure the production native client, with Claude Code first. The login
  proof belongs to RHD-05.
- Merge the reviewed stack through PR #117 before selecting checked `main`.
  This branch starts at PR #117 head
  `c3a2734144a043b1d184f8531a59d4f2dafe41b1`.
  Current `main`, `cf2928ba239e4ef88e7cf7e660d5b08bc04b6486`, lacks that stack.

The owner chose setup steps for a new Thermus Google Cloud project.

## Google Cloud OAuth setup steps

WorkOS handles authentication and Render hosts Thermus. Google Cloud supplies
the OAuth client; no Google hosting is needed. Follow the current
[WorkOS instructions](https://workos.com/docs/integrations/google-oauth) and
[Google consent setup](https://developers.google.com/workspace/guides/configure-oauth-consent).

1. Create a Google Cloud project with display name `Thermus`. Select or accept an
   available project ID and record its actual value after creation; none is known.
2. Configure Google Auth Platform branding with app name `Thermus`, support email,
   developer contact, and the required application links. Use owner-approved
   contact details and real public URLs.
3. Set audience to External, because the approved identities include a personal
   Google account. Testing can use explicitly listed test users during setup;
   publish In production before the production sign-in proof. Complete any
   branding or domain verification Google requires.
4. Create an OAuth client of type Web application, named `Thermus WorkOS Production`.
   Copy the exact Google Redirect URI from the Google provider configuration in
   WorkOS **Production** into Google's authorized redirect URIs. This is Google's
   callback to WorkOS, not Thermus `<origin>/callback`. Do not derive it from the
   AuthKit issuer or use an example URI.
5. Keep WorkOS's default authentication scopes. The identity scope set is
   `openid`, `email`, and `profile`; Google can display the latter two as
   `https://www.googleapis.com/auth/userinfo.email` and
   `https://www.googleapis.com/auth/userinfo.profile`. Add no Google API scopes
   or return-Google-token option. See [Google OpenID Connect](https://developers.google.com/identity/protocols/oauth2/openid-connect).
6. Enter the Google client ID and secret directly into the WorkOS Production
   Google configuration using the app's own credentials, then save and enable
   Google sign-in. Keep the secret in protected storage; never paste it into
   Git, chat, a ticket, or a log.
7. Read back the project/client identity, audience, publication, exact callback,
   and WorkOS credential presence without exposing the secret. Record the result
   here. The real browser sign-in remains an RHD-05 check.

PR #117 remains open and unmerged. Wait for checked `main` before rollout.
Enable On Commit only after the RHD-05 remote smoke. Google setup is prepared
only; no Google Cloud project or credentials have been created.

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

Fresh staging `authkitSettings`, `authkitApplications` (limit 100), and `roles`
queries after the production changes were byte-identical to their initial text
snapshots. This proves
only that these inspected settings are unchanged; it does not cover all provider
state. The later Render checkout proves Git access for that checkout only.

The manager reviewed this record and the plan status update. The whitespace check
passed, and all 25 relative file links resolved at that review. Remaining acceptance
items are operator MFA confirmation, accounts and User grants, Google setup,
protected runtime secrets, native client setup, and checked `main`.
No provider acceptance pass or Ready status is recorded; RHD-04 remains incomplete
in Draft #118.
Do not run staging fixture creation or cleanup against production.
