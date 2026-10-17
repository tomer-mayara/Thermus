# RHD-04: production identity and Render setup

Status: requested production setup checks completed in the later October 16,
2026 release checkpoint. PR #119 merged after review. That restricted checkpoint
records Google production publication, verified branding, and fresh sign-in.
The earlier incomplete states below are historical. Hosted-product policy
coverage and self-serve opening remain separate [FS-05](fs-05.md) work.
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
CIMD, and sign-up enabled. DCR, passkeys, and magic sign-in are disabled.
Google was initially disabled and is now enabled, as recorded below.
DCR remains conditional on the actual Claude Code flow. Provider sign-up does
not grant Thermus product access; no automatic enrollment was added.

The owner confirmed completed dashboard MFA sign-in. Read-back shows
`isMfaConfigured: true`, `isMfaRequired: true`, and last login
`2026-10-16T01:37:26.833Z` (2026-10-15 in America/Denver). Dashboard MFA is
separate from Optional end-user MFA.

Created organization `Thermus AI`, external ID `thermus-ai`, with ID
`org_01M515XQD27ZTRYZ546RSWBMY8`; an independent read confirmed it. The two
approved initial identities were created. Their email addresses stay outside this
repository. Initially both were unverified without memberships, so grants stopped.
Both have now completed real Google sign-in and provider verification, then
received explicit User-only active memberships. No manual verification override
or Admin/Super Admin grant was made. The [RHD-05 record](rhd-05.md) gives exact
read-backs and browser proof limits. Operator records remain outside this repository.

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
was pending at setup; native login and discovery are now verified in RHD-05.
Roles do not inherit: Admin or Super Admin alone
gives no User access. Optional MFA keeps protected Thermus administration denied.
Follow the [organization runbook](hosted-organization-setup.md) for Super Admin
changes; none is requested here.

## Verified Render service and runtime settings

Reuse the owner-created service `Thermus` (`srv-db8mnqg473hc739d529g`) at
`https://thermus.onrender.com`; do not create the earlier proposed `thermus-hosted`.
It is in the approved Thermus AI workspace, Oregon, with one `1c-2g` instance
(formerly Standard): 1 CPU / 2 GB, $25/month plus variable build and bandwidth
usage. See [Render pricing](https://render.com/pricing).

| Setting | Verified read-back |
| --- | --- |
| Repository / branch | `https://github.com/tomer-mayara/Thermus` / `main` |
| Runtime / root directory | Docker / empty root directory |
| Docker context / file | `.` / `./Dockerfile.hosted` |
| Health / Docker command | `/healthz` / empty command |
| Auto-deploy | Trigger `off`, auto-deploy `no` |
| Previews / pre-deploy command | Off / none |

The UI confirms nine saved environment keys and no linked environment groups.
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

The owner saved `WORKOS_API_KEY` and `WORKOS_COOKIE_PASSWORD` with **Save only**.
The UI confirms both are nonempty, neither has surrounding whitespace, and the
cookie password has at least 32 characters. Secret values were never printed or
saved outside protected settings. The first saved API key was confirmed in memory
to match the Staging key. The owner then created a Production key and replaced
only `WORKOS_API_KEY` in Render with **Save only**. The cookie password is unchanged.

Production read-back shows one active, nonexpired key,
`key_01M518FYX3WKT38PQZSH388D4Y`, named `Production Key (Render)`, for application
`app_01M4VDKC50NT3Z13KGM1P2BFRD`. It was created at
`2026-10-16T02:26:10.466Z` (2026-10-15 in America/Denver). A separate browser
read confirmed Production context. The saved Render value is nonempty, starts
with `sk_`, is not masked text, and has no surrounding whitespace. Its first
three and last four characters match the masked Production key display. The full
key is no longer visible in WorkOS, so this is not a full-value comparison or
successful API authentication. Checks stayed in memory and variables were cleared;
no secret values were printed or saved. The replacement blocker is cleared;
actual live credential use belongs to RHD-05. At the time of the key correction,
only the two failed setup attempts below existed.
The image defines listener
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
fault tests. No manual deploy had been requested at that point. Later intended
deployment attempts are recorded in [RHD-05](rhd-05.md). Use Dashboard **Save only**
for environment changes that must not deploy.

## Pending owner information and ordering

- Complete the deferred Google public links and production publication below.
  Production activation and permission write authority are now verified.
- Both identities are provider-verified with User-only active grants read back.
  Complete the remaining authenticated checks in RHD-05; no implicit enrollment
  was added. RHD-04 remains incomplete while deferred Google publication is open.
- Production native client configuration and CIMD registration are verified.
  Login, fetch, and native refresh are verified in RHD-05.
- Checked `main` is ready: PRs #115–117 were reviewed and merged. The
  [RHD-05 record](rhd-05.md) gives exact merge commits and matching tree evidence.
  The old `main` revision in the failed setup attempts above is historical.

## Native MCP client configuration

Claude Code 2.1.300 is installed. Its [official OAuth guidance](https://code.claude.com/docs/en/mcp#use-pre-configured-oauth-credentials)
supports automatic CIMD; [WorkOS recommends CIMD](https://workos.com/docs/authkit/mcp)
and reserves DCR for older clients. No manual client registration is needed
before the documented login flow.

From the Thermus repository directory, this local-scope configuration was added
and read back exactly:

```sh
claude mcp add-json --scope local thermus-production '{"type":"http","url":"https://thermus.onrender.com/mcp","oauth":{"scopes":"openid profile email offline_access"}}'
```

The name was absent in local, user, and project scopes before setup. Existing
MCP entries and repository `.mcp.json` are unchanged. No client ID, secret, fixed
callback, headers, metadata override, or certificate override was added.

Production read-back confirms CIMD enabled, DCR disabled, and the only/default
OAuth resource `https://thermus.onrender.com/mcp`, ID
`authkit_oauth_resource_01M511F4QYR5PJDMNA1R2QC3A8`. Public issuer metadata
returned HTTP 200 with the production issuer above, CIMD, S256, auth method
`none`, scopes `email`, `offline_access`, `openid`, `profile`, and no
`registration_endpoint`. OAuth Connect applications were initially empty with
exhausted cursors.
Fresh staging AuthKit settings still match the initial snapshot.

The owner approved the designated personal account's native consent, and
`claude mcp login thermus-production` succeeded. The server connected and exposed
its fetch tool. The command uses local scope and runs from the Thermus directory:

```sh
claude mcp login thermus-production
```

The [RHD-05 record](rhd-05.md) gives login, discovery, and connection revocation/
recovery and actual tool-call denial evidence. Real native fetch and recovery
have passed. The separate Claude model-account sign-in
blocker is resolved; a later expired-token fetch proved native refresh.
DCR remains off. Native refresh must use the Connect token lifetime, not the
300-second browser access-token lifetime.

## Google Cloud OAuth configuration

The owner authorized the Google Cloud project and its connection to WorkOS
Production, including acceptance of the Google API Services User Data Policy.
Business-account sign-in is complete. Project `Thermus`, ID `thermus-511802`,
was created under `thermus.ai` and selected; its OAuth configuration was created.
WorkOS handles authentication and Render hosts Thermus. Google supplies the OAuth
client; no Google hosting is needed. Follow the [WorkOS instructions](https://workos.com/docs/integrations/google-oauth)
and [Google consent setup](https://developers.google.com/workspace/guides/configure-oauth-consent).

Saved branding has app name `Thermus`, the approved business operator as support
and developer contact, homepage `https://thermus.ai`, authorized domains
`thermus.ai` and `workos.com`, and no logo. The homepage was verified live; no
privacy or terms links were found and its Security and trust button opens a
waitlist. The owner deferred those pages, so their branding fields remain blank.
Audience is External, publishing status is Testing, and there are no test users.
Publish app is disabled because Branding configuration is incomplete. Google
requires the public links for external production apps; see its
[branding guidance](https://support.google.com/cloud/answer/15549049).
Branding verification and publication have not been done.

Saved Data Access has exactly three non-sensitive scopes: `userinfo.email`,
`userinfo.profile`, and `openid`. Sensitive and restricted tables are empty.
These are the identity scopes `email`, `profile`, and `openid`; see
[Google OpenID Connect](https://developers.google.com/identity/protocols/oauth2/openid-connect).
The WorkOS Production Google configuration has default email and profile scopes
and **Return Google OAuth tokens** unchecked. Its exact callback is:

`https://auth.workos.com/sso/oauth/google/EbBjbztH0euVsoez6KC6QNYyQ/callback`

The owner reports creating the Google client and saving its credentials in
WorkOS. Production read-back confirms GoogleOAuth credential
`oauth_credential_01M5197HKWJZ3ZJ9N05TP9R1YW`, state `Valid`, with client ID
`1095718049617-r18sqt9hul9gbfqjgmjcunq8745u0s6v.apps.googleusercontent.com`.
Both redirect and default redirect match the callback above. A protected redacted
secret is present, `isUserlandEnabled` is true, `customScopes` is empty,
`returnProviderTokens` is false, and no custom domain is set. AuthKit confirms
`isGoogleOauthEnabled: true`. This does not prove full secret equality or live
authentication.

Google-side read-back in `thermus-511802` confirms exactly one client,
`Thermus WorkOS Production`, created October 15, 2026, of type Web application.
Its full public client ID exactly matches WorkOS's client ID above. Saved details
confirm the exact callback, zero JavaScript origins, and AI-powered-agent
unchecked. This is human sign-in through WorkOS; the callback is not Thermus's
`/callback`. The connection is configured and verified on both sides within
these read-back limits. No secret value was read or exposed in this check, and
no full secret comparison was made.

Complete the owner-deferred public links and any required branding/domain checks,
then publish In production before public launch. RHD-05 now records successful
browser sign-in with the configured Testing app; those checks do not prove
publication. Keep secrets in protected storage and preserve identity-only scopes
and disabled token return.

The first intended deployment failed its build; the retry from checked `main`
is live with public smoke passed 15/15. The [RHD-05 record](rhd-05.md) gives
the exact revision, fix, and public acceptance evidence.
Keep On Commit off until authenticated RHD-05 remote smoke passes.
The Google project exists;
Google and WorkOS connection settings are verified; production publication remains
pending.
The Production key correction is complete within the read-back limits above.
Startup passed. Later callback, session, organization-selection, and current-grant
flows proved live WorkOS API use; public smoke alone did not prove it.

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
After the Google changes, staging `authkitSettings` was read again and still
matched its stored initial snapshot.

The manager reviewed this record and the plan status update. Whitespace and
relative links passed review. Remaining release checks are in RHD-05.
No complete provider acceptance pass is recorded; deferred Google publication
keeps RHD-04 incomplete. PR #119 contains the consolidated record.
Do not run staging fixture creation or cleanup against production.
