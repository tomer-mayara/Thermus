# Hosted Docker on Render: implementation plan

Status: proposed; implementation has not started. Date: 2026-10-15.
The owner selected hosted Docker on Render with GitHub auto-deploys to production.
This plan creates no service, account setting, issue, or deployment.

## Goal and deployment target

Serve the portal, WorkOS browser authentication, and the protected MCP fetch tool
at one public HTTPS origin through the production entry point. Preserve local
and self-hosted behavior. Do not deploy the development work slice.

Use one paid Git-backed Render Web Service on `main`. Proposed defaults are
`thermus-hosted`, Oregon, and one 1 CPU / 2 GB trial instance. Use the assigned
Render HTTPS origin initially. A custom domain is optional. Start with one Node
process and **one active fetch**, with no queue. Measure CPU, memory, response
time, and health responsiveness under representative and near-limit inputs before
broad enrollment; change the fixed limit in a later release if the
results justify it. Include runtime and build usage in the cost review.

The first release needs no Thermus database, Redis, persistent disk, scheduler,
worker, separate frontend, registry setup, Blueprint, or GitHub deployment workflow.
WorkOS owns accounts and roles. Public signup and paid product billing are outside
this release. A separate staging service is optional, not a launch prerequisite.
Use a paid instance for an always-available service; see [free instance limits](https://render.com/docs/free).

Render read access was verified on 2026-10-15 for workspace **Thermus AI**
(`tea-db8i6ceq1p3s73dev9og`); the service query returned no entries. Service creation
and GitHub authorization remain to be checked. Region, name, budget, and provider
setup do not block application coding.

## Architecture and application contracts

```text
Browser / native MCP client
        | HTTPS, one public origin
Render HTTPS edge
        | HTTP, port 8080
Thermus hosted Node process
        +-- / and /assets/*: built portal
        +-- browser auth, account, metadata and /mcp routes
        +-- /healthz: local startup completed
        +-- WorkOS: sessions, Connect tokens, users and grants
        +-- one admitted fetch -> Lightpanda -> allowed public HTTP(S) page
```

Render terminates HTTPS. Set Render `PORT=8080`; the image sets
`LISTEN_HOST=0.0.0.0` and `LISTEN_PORT=8080`. The existing listener supports these
settings: no new port precedence or application `PORT` adapter is needed.
`PUBLIC_BASE_URL` is the external HTTPS origin with base path `/`. Keep local
listener defaults. See [Render port binding](https://render.com/docs/web-services#port-binding).

### Protected fetch and work lifetime

Compose existing `createFetchOperation` and `fetchToolServers` in
[`openWorkOSApplication`](../../src/hosted-workos-application.ts), behind the
existing WorkOS token and current User-grant checks. Keep request-scoped MCP
servers and safe completion records. Do not copy work-slice Google enrollment,
Axiom wiring, URL logs, or Markdown logs. Use stdout/stderr for production logs.

Put the fixed cap around the shared `FetchOperation`, covering DNS, rendering,
cleaning, and cleanup across requests. Reject excess work immediately with an
`isError: true` tool result, a safe busy message, and completion status `busy`;
the current generic failure mapping
would otherwise hide it as a processing failure. Hold the slot until the operation
and its child have settled, including after an abort. Add no new environment knob.
Preserve the 20-second renderer readiness budget, 60-second process limit, 32 MiB
child-output buffer, 10 MiB HTML input limit, network guards, and sanitation.

Reuse current listener drain, MCP cancellation, and renderer cleanup. Test slow
authentication, slow DNS, and an active child under client disconnect and SIGTERM.
The first DNS lookup currently has no finite cancellable wait; authentication
finishes before MCP lifetime wiring, and browser/account calls are not all owned
by MCP. Fix demonstrated gaps with small changes at their owners. Make DNS and
pre-render waiting finite and cancellable, and process exit bounded. The existing
five-second socket drain alone does not prove this. Set and test a fixed hosted
shutdown deadline below Render's configured stop window; its default is 30 seconds.
Treat Render force-kill as a final fallback, not a passing graceful-stop test.
Do not promise that arbitrarily long calls complete or add a lifecycle framework.

### Portal, health, and request boundaries

Serve only `GET` and `HEAD` of `/` as `index.html`, and those methods on allowlisted
`/assets/<file>` build paths. A small preloaded file map can supply the files and
validate them at startup. Set correct content types, prevent traversal, and return
a normal missing-asset error. Forward all other requests unchanged to the existing
application, including auth, account, `/mcp`, and root `/.well-known/*` routes.
Add no SPA catch-all. Follow the [portal contract](../user-portal.md#deployment),
including CSP `form-action` for `https://api.workos.com` and the exact AuthKit origin.
Keep secrets out of the browser bundle.

Startup already awaits application initialization before listening. Reuse trusted
rules loading and native cleaner construction, verify the built portal, and run
a bounded check of the pinned renderer version. Invalid local inputs fail before
listening. After successful startup, `GET` and `HEAD /healthz` return a small constant
`200` response; other methods are refused. Add no readiness state framework.
Health proves local initialization, not WorkOS reachability or successful rendering.
Do not call WorkOS or render a page on each probe.

Before authentication on hosted `/mcp`, validate the request's `Origin` header:
absent is allowed for native clients; the configured public origin is allowed;
foreign, malformed, and opaque `null` origins receive `403`. Canonical URL
reconstruction from `PUBLIC_BASE_URL` is not header validation, and the current SDK
handler does not enable that validation. Follow the [MCP transport requirement](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).
Keep browser CSRF checks and same-origin requests, with no broad CORS policy.
Keep the configured canonical origin; verify Render forwarding and health probes
at rollout rather than inventing Host or forwarded-header allowlists.

Hosted fetching intentionally changes the old no-native-module contract, and the
public portal changes root `401` to `200`. Update
[`server-only-modules.test.ts`](../../test/acceptance/mcp/server-only-modules.test.ts),
[`hosted-startup.test.ts`](../../test/acceptance/auth/hosted-startup.test.ts), hosted
composition comments, [ad-rules reference](../reference/ad-rules.md), and affected
runtime/authentication documents. Preserve operator-command isolation from native
modules and protected account/MCP behavior. Give offline startup tests the required
portal, rules, and renderer fixtures or doubles. Final-image acceptance uses the
real packaged renderer; test doubles cannot establish that image's runtime proof.

## Hosted image and deployment checks

Use `Dockerfile.hosted` and `Dockerfile.hosted.dockerignore` with the repository
root as context. Preserve the self-hosted image contract. Reuse pinned Node
24.20.0, pnpm 12.10.1, Rust 1.97, Lightpanda 1.0.0, and their recorded digests.
`adblock-rs` needs Rust to compile its native module for compatible Linux.
Keep build tools out of runtime; include the checked renderer, CA bundle,
production dependencies, and trusted rules. Run as non-root with telemetry off.

The context must support the actual checks, not just TypeScript compilation.
Include portal config, `.habit-hooks` workspace/config inputs, needed documents
such as `docs/lightpanda-runtime.md`, launchers, migrations, and test fixtures.
Exclude `.env*`, credentials, local keys, caches, Git metadata, and unrelated
submodule content. Docker ignore rules do not control Git submodule checkout.
Backend output is `dist/src`; portal output is `src/user-portal/dist`.

Add one small offline build command. Start with existing `npm run check`, then run
emitted offline integration tests and selected offline acceptance/renderer cases
directly with `node --test`. The root `dist` built by `test:unit` survives `check`;
`test:build` builds temporary fixtures and Vite writes the separate portal output.
Avoid broad suites that require live Axiom or WorkOS credentials. Keep the explicit
selection small, documented, and nonempty. Add no generic gate framework, test
manifest, or artifact ledger. Include the applicable architecture checks.

The final runtime target must depend on successful offline checks so BuildKit
cannot skip them. Choose the simplest useful stages; no fixed stage count or
single compiler invocation is required. Verify the assembled runtime outputs and
production dependencies, then do not rebuild them after final artifact verification.
Test the final local image. Render builds another image from the same commit and
must check and run its own outputs. Keep Docker-daemon and live-credential tests
outside Render builds.

Keep secrets out of built artifacts, logs, and caches. Render exposes
service environment values as Docker build arguments: do not declare or reference
sensitive `ARG` values, copy secret files, or print the environment. The offline
gate must run without WorkOS or Axiom secrets. See [Docker on Render](https://render.com/docs/docker).

Prove real rendering in the final **Linux AMD64** image: native module loading,
CA-backed HTTPS, JavaScript results, private-network refusal, overload,
cancellation, and bounded shutdown. The [runtime record](../lightpanda-runtime.md)
has AMD64 digest/version evidence but no rendered-page proof. ARM64 evidence does
not close that gap. Test failed offline checks and invalid startup locally.

Select a trusted production rules policy before image completion, version its
file, ship it, and set the absolute `AD_RULES_FILE` path. Do not use a test fixture
as production policy or silently default to an empty file. If the owner deliberately
selects an empty policy, record the loss of rule-based ad removal. Rules changes
produce a checked image; no runtime download or persistent disk is needed.

## Production WorkOS and Render setup

Use a production WorkOS environment distinct from local staging. Production
requires billing activation; keys, users, organizations, and settings do not carry
over. A custom AuthKit domain is optional. See [WorkOS environments](https://workos.com/docs/authkit/environments).
Keep Google sign-in for this first release. Configure production Google OAuth
credentials, the WorkOS-provided Google callback URI, and publish the OAuth app as
required by [Google OAuth setup](https://workos.com/docs/integrations/google-oauth).
A later owner decision to use only passwords can remove this setup; do not make
that login change as part of deployment simplification.

| Runtime setting | Production source |
| --- | --- |
| `DEPLOYMENT` | `hosted` |
| `PUBLIC_BASE_URL` | Assigned public HTTPS origin plus `/` |
| `PORT` | `8080` in Render; image listener remains `0.0.0.0:8080` |
| `WORKOS_API_KEY`, `WORKOS_CLIENT_ID` | Matching production environment |
| `WORKOS_AUTHKIT_ISSUER` | Exact production HTTPS AuthKit origin, no final slash |
| `WORKOS_REDIRECT_URI` | `<origin>/callback` |
| `WORKOS_COOKIE_PASSWORD` | Protected stable secret, at least 32 characters |
| `WORKOS_MFA_POLICY` | `optional` for this release |
| `LIGHTPANDA_BIN`, `AD_RULES_FILE` | Absolute paths fixed in the image |
| `LIGHTPANDA_DISABLE_TELEMETRY` | `true` in the image |

Configure `<origin>/` as default sign-out URI, `<origin>/login` as initiate-login
URI, and `<origin>/mcp` as MCP resource. Preserve the local staging URLs. Store
secrets in protected runtime settings and keep the cookie key stable across deploys.

Configure all three production role definitions with these exact Thermus
permissions, as required by [the role mapping](../../src/auth/hosted-auth/workos/hosted-role-mapping.ts):

| Role slug | Thermus permissions |
| --- | --- |
| `user` | `product:access` |
| `admin` | `user-grants:manage` |
| `super-admin` | `admin-grants:manage`, `billing:manage` |
| Default and other roles | No Thermus permissions |

All three mapped roles must exist, even for fetch-only use. Roles do not inherit:
Admin or Super Admin alone does not give User access. The
[operator runbook](hosted-organization-setup.md) grants roles but does not define
them. Preprovision known users and explicit User grants externally, with its
operator MFA prerequisites. Optional MFA gives no proven MFA evidence, so privileged
Thermus UI writes stay denied. Add no login-based enrollment or implicit grant.

Register the selected native MCP client independently in production; use the
existing Claude Code flow as the first proof. Enable CIMD, which is off by default;
enable DCR only if that client needs it. Set the exact `<origin>/mcp` resource.
Preserve existing OIDC scopes, issuer/audience checks, and current-grant checks;
do not invent permission OAuth scopes. A browser cookie is not an MCP credential.
See [WorkOS MCP setup](https://workos.com/docs/authkit/mcp). Never run staging fixture
creation, mutation, or cleanup against production.

Connect the Git provider with repository authorization; Render connector access
alone does not authorize GitHub checkout. Render clones every `.gitmodules` entry
before Docker ignore rules apply. Verify access to both Thermus and
`tools/code-review-agents` with the connected credentials; resolve failures before
rollout. Do not assume an undocumented checkout bypass. See [Git submodules](https://render.com/docs/git-provider#git-submodules).
Keep PR previews off initially and set no pre-deploy migration command.

Create the service with auto-deploy off. Creation still starts an initial
build/deploy. Supply known settings and `/healthz` at creation. If the generated
origin is only known after creation, read that origin, then configure the public
URL, secrets, exact WorkOS URLs, and health path. Any missing-config attempt must
fail closed. Use no placeholder identity or anonymous fallback. Manually deploy
the checked `main` revision; enable **On Commit** only after its first remote smoke.

## Verification, rollout, and recovery

Use BDD acceptance specifications first, then focused TDD steps. Follow
[AGENTS.md](../../AGENTS.md), [coding principles](../coding-principles.md), DRY3,
and the [test layout](../testing/test-code-layout.md). Existing commands remain
mandatory where the [test gate policy](test-gate-policy.md#required-runs) applies:
changed tests before commit; `npm run check` and `habit-hooks` on the complete
candidate; applicable integration, acceptance, interface, renderer, container,
and isolated WorkOS hosted-live gates. Keep the snooze file empty. Missing or
skipped release evidence is not a pass. Record results under that policy.

The new offline build and hosted-image commands must enter `package.json` and the
test gate policy with their selections and prerequisites. A short remote manual
protocol is sufficient initially. The existing `test:hosted-live` starts a local
fixed HTTPS origin and changes staging fixtures; it is not a remote command.

Before broad enrollment, use designated accounts and controlled pages to verify:
portal/assets/CSP and Google sign-in/callback/logout; separate Connect login,
metadata, tool listing and real fetch; absent/revoked User denial; foreign Origin
`403`; safe logs; cookie continuity across restart/deploy; forwarding/probes; and
actual capacity at the fixed limit. Revoke only a designated account and restore
its controlled state. Record expected outcomes without tokens or page contents.

Enable On Commit and prove GitHub auto-deploy with a normal reviewed harmless
change. Do not break `main` or inject production build/start failures to prove
Render behavior. Test those failures locally; Render documents how an unready
replacement retains the old healthy deployment in [deploys](https://render.com/docs/deploys)
and [health checks](https://render.com/docs/health-checks).

After two successful retained deploys, rehearse rollback between those valid
versions before broader enrollment. Smoke the restored version, restore latest
checked `main`, and confirm On Commit is enabled. A [rollback](https://render.com/docs/rollbacks)
uses the retained artifact and that deploy's service environment, start command,
health path, and instance count; it does not replace current settings for later
standard deploys. Environment-group values, domains, compute plan, and external WorkOS
settings do not roll back. Check cookie-key compatibility. Dashboard rollback
disables auto-deploy; API rollback does not. Keep one short deployment record:
commit, deploy ID, runtime architecture, instance size, cap, measured load, checks,
and recovery result. Document operator ownership, costs, logs, and useful alerts.

Open a draft PR first. Before Ready, complete required checks and manual review;
wait for every Actions job started for its head to pass. Return to Draft before
fixing a Ready PR. Follow the owner merge rule for decision records. Render build
checks supplement these rules. Done means the production origin and Git auto-deploy
work, protected fetch and refusal contracts pass, work and exit remain bounded,
required checks pass, and the operator can deploy and recover the service.

## Appendix A: delivery tickets

These are proposed tickets, not created issues. Each code ticket writes its failing
Given-When-Then specification first, updates affected documents and fixtures, and
runs its focused tests plus every applicable existing gate. The boundaries below
identify each ticket's proof; they do not waive repository checks.

### RHD-01 — Enable protected hosted fetch

**Scope:** production fetch composition, fixed shared cap of one, safe busy result
and completion status, trusted rules, and bounded work lifetime. Update the hosted
no-native-module contract while preserving operator-command isolation.

**Dependencies:** none; select production rules before RHD-03 completes.

**Acceptance:** Given a valid Connect user with User access, when tools are listed
and called, then cleaned Markdown is returned; missing/revoked access is refused;
an excess call fails promptly and failure/cancellation release capacity only after
settlement. Slow auth/DNS and active-child disconnect/SIGTERM cases exit on time.

**Verification/done:** production composition acceptance and focused lifetime tests
pass with existing auth/renderer gates; fix demonstrated wait/cleanup gaps.

### RHD-02 — Serve the portal and local health

**Scope:** built portal/assets/CSP, startup prerequisite checks, small `/healthz`,
and explicit hosted MCP Origin validation. Preserve existing listener settings.

**Dependencies:** none; integrate fetch startup checks with RHD-01.

**Acceptance:** Given valid startup inputs, when the server starts, then the portal
and health return `200`, other routes keep their handlers, and foreign/malformed/
null MCP origins receive `403` before auth. Missing local inputs prevent listening;
absent/native and matching origins still reach normal protected MCP handling.

**Verification/done:** route, startup, Origin, public-root and protected-route
specifications pass offline; local/self-hosted contracts remain covered.

### RHD-03 — Build and prove the hosted image

**Scope:** hosted Dockerfile/context, offline build command, versioned production
rules, checked runtime, and final Linux AMD64 image acceptance command.

**Dependencies:** RHD-01 and RHD-02.

**Acceptance:** Given a clean build, when an offline check fails, then no runtime
image is produced; when checks pass without live secrets, then the assembled image
serves the hosted application and renders HTTPS/JavaScript within its safety and
shutdown contracts. Invalid startup inputs fail closed.

**Verification/done:** final-image proof, gate failure proof, required local suites,
isolated hosted-live and affected self-hosted container checks pass; commands and
AMD64 results enter the policy/runtime record. No nested Docker in Render builds.

### RHD-04 — Configure production identity and Render

**Scope:** production WorkOS/Google/client settings, roles/users/grants, Git and
submodule access, paid service settings, runtime secrets, and health path.

**Dependencies:** account/Git checks can start alongside coding; service completion
waits for RHD-03 and the selected production rules, origin, and budget.

**Acceptance:** Given authorized provider and repository access, when the service
and identity settings are read back, then they name the exact production origin,
role mapping, native client, checked revision, and matching runtime settings;
missing configuration fails closed and local staging remains separate.

**Verification/done:** protected settings are inspected without logging secrets;
first intended manual deploy is configured, auto-deploy and previews remain off.

### RHD-05 — Release, prove auto-deploy, and recover

**Scope:** first remote smoke, designated-user access checks, capacity measurement,
harmless Git auto-deploy, controlled rollback, operator runbook and release record.

**Dependencies:** RHD-04.

**Acceptance:** Given the configured service, when the checked revision deploys,
then the real browser and separate MCP journeys pass; a reviewed Git change
auto-deploys; two successful retained versions permit rollback and restoration of
latest checked `main` with On Commit restored and protected behavior intact.

**Verification/done:** remote protocol and recovery results pass, required PR gates
are complete, costs and ownership are recorded, and the owner accepts the first
release before broader enrollment. No deliberate broken production deployment.
