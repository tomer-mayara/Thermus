# Auth WorkOS MCP URL fetch: work slice plan

Status: implementation and the offline candidate checks are complete on
2026-10-15. The complete hosted live gate is running. The fresh Google account
and client browser-first proof remains pending, and PR #108 stays in Draft.
This plan supersedes the manual User-grant step of the first version. The
owner approved automatic access for eligible Google users.

Slice folder: `test/acceptance/work-slice/auth-workos-mcp-url-fetch/`.
Entry point: `auth-workos-mcp-url-fetch.ts` in that folder.

## Goal

1. A person opens the portal in a browser and signs in through WorkOS AuthKit
   with a verified `@thermus.ai` Google account.
2. The slice enrolls an eligible new user in its configured organization with
   the explicit role `user`. The browser session selects that organization.
   The portal shows product access after the callback.
3. The person connects Claude Code. The client opens a separate Connect OAuth
   authorization flow in the browser, gets consent, and keeps its own token
   for `https://localhost:46443/mcp`.
4. The client calls `getURLAsMarkdown` through the real HTTPS endpoint. Thermus
   validates the Connect token and current WorkOS access, renders the URL,
   and returns Markdown. Axiom shows the fetch lines and the completion
   record with the WorkOS identity.

The portal cookie and browser access token are not MCP credentials. A browser
sign-in does not give a token to copy into a client. The client requests its
own Connect token with PKCE and the MCP resource audience. Browser-first is
required: client-first authorization does not run the Thermus callback that
enrolls eligible users.

## Boundaries and invariants

The slice is an opt-in development composition. The normal hosted application
uses no enrollment policy, grants no automatic User role, and keeps the
WorkOS `member` default role without product access. Production onboarding is
not enabled. The slice sets neither an organization domain nor a default User
role in WorkOS.

Eligibility comes only from the trusted result of the WorkOS code exchange:

- `authenticationMethod` is `GoogleOAuth`.
- `emailVerified` is true.
- The email domain is exactly `thermus.ai`. Similar domains and suffixes such
  as `thermus.ai.example` do not qualify.

The target comes from `THERMUS_SLICE_ORGANIZATION_ID`, which the slice
composition requires. The launcher defaults it to the existing Staging
organization `org_01M4YYEQ6V2ZBM3RQEEV8CKFEA` and preserves an explicit value.
A missing or empty value fails before the slice listens. The configured
organization must exist in the selected WorkOS environment.

An absent membership can be created with the explicit role `user`. An active
membership keeps its roles. Admin-only, default-role, or other memberships
without User are not upgraded. Pending and inactive memberships are unchanged.
A removed User role or inactive membership stays refused on the next Google
sign-in and the next MCP request. A hard-deleted membership has no retained
revocation marker: it is indistinguishable from a new user and can enroll
again. Use role removal or deactivation for persistent access refusal.

Enrollment is serialized for a user within one process. Reads and WorkOS
writes do not form an atomic transaction with concurrent operators or other
processes. Do not claim full cross-process atomicity. Do not blindly retry an
ambiguous write: it may already have succeeded. A failed callback issues no
new authorized browser session; the membership may already exist. A read-back
of an active User can reconcile a lost response. Inspect unresolved WorkOS
state before another attempt.

A Google sign-in gives no MFA evidence. Portal product access and MCP need no
MFA evidence; the members and invitations pages still refuse that session.
Every protected MCP call reads the current grant from WorkOS. Enrollment does
not replace token verification or access resolution.

## Decisions

| ID | Decision |
| --- | --- |
| D1 | Reuse WorkOS Staging, `environment_01M4VDKATD5PXZT4H01EHCMR2A`. Google, DCR, and CIMD are on. Keep password MFA required. Update the two live configuration proofs and rerun the complete live gate. |
| D2 | Use `https://localhost:46443/` with the registered callback, sign-out, login, and MCP resource URIs. Keep a local TLS certificate so the browser and client trust it once. |
| D3 | Keep the organization "Thermus work slice", external ID `thermus-work-slice`, with no domain. Require its ID as explicit slice configuration. |
| D4 | Connect Claude Code through browser OAuth with the scopes `openid profile email offline_access`. Verify the resulting Connect token at the MCP boundary. Never print the token or keys. |
| D5 | Automatically enroll only eligible verified Google users of `thermus.ai` whose target membership is absent, with the explicit role `user`. Select the target in their browser session. Preserve existing roles and status. This replaces the original manual User grant. |
| D6 | Reuse `openWorkOSConnection()` and `composeWorkOSApplication()` and an optional onboarding seam. The normal hosted composition supplies no policy. The slice supplies the policy and fetch server. |
| D7 | Reuse `LocalHttpsSite` with the slice application, certificate, and logger. Prove forwarding, disconnect cancellation, and shutdown with active work. |
| D8 | Use the existing Axiom test logging and fetch lines. A completion record carries the authority, subject, and tenant; no credential appears in logs. |
| D9 | Use offline BDD acceptance scenarios for application behavior and focused tests for the enrollment boundary. Complete the real browser-first walk separately and record safe results. |
| D10 | Keep Google sessions without MFA evidence. Do not weaken administration requirements. |

## Launch and settings

Build the portal, install the pinned Lightpanda 1.0.0, and provide the Axiom
test settings. Start through the local staging launcher:

```sh
npm run build:user-portal
node ~/.config/thermus/with-workos-staging.cjs test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.sh
```

The staging launcher supplies `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, and
`WORKOS_AUTHKIT_ISSUER`. The shell script supplies the slice organization,
local origin, callback, cookie password, TLS directory, rules path, renderer
path, and Axiom endpoint defaults. Explicit values are preserved. The entry
point also requires the organization ID when it runs without the shell
launcher. The [slice README](../../test/acceptance/work-slice/auth-workos-mcp-url-fetch/README.md)
gives every setting, trust command, client command, and log line.

The live gate and the slice use the same origin and cannot run together. Stop
the slice before the complete hosted live gate or the fixed-port HTTPS-site
integration test. Do not stop an unrelated listener to make a test pass.

## Implementation order

1. Integrate latest main while preserving its test-support moves, import
   guards, and split architecture specifications. Port new slice imports to
   the current folders.
2. Write a failing acceptance scenario: a first eligible Google callback
   without a selected organization creates an explicit User membership,
   selects it in the sealed session, shows portal access, and permits a
   separately issued Connect token to call the fetch tool.
3. Use TDD for eligibility, required target configuration, all membership
   states, repeated and concurrent callbacks, ambiguous write failures, and
   organization selection. Verify the default hosted composition remains
   unchanged.
4. Add focused HTTPS integration scenarios for authenticated MCP forwarding,
   client disconnect cancellation, and close with active work. Close the
   application before waiting for the listener to drain. The site must await
   that drain even if custom application cleanup ignores it or throws.
5. Add launcher specifications for the staging organization default and an
   explicit override, observe a failure, then implement the environment
   export. Keep the existing secret-output checks.
6. Update affected documents and the test inventory. Run changed tests and
   the complete candidate gates. Complete the manual live proof below.

## Live proof

Keep the PR in Draft until all of these checks have recorded results on the
final candidate. A configuration read-back is a prerequisite, not proof of the
flow.

1. Start the slice and trust its TLS certificate. Open the portal first and
   authenticate a verified `@thermus.ai` Google user through AuthKit. Observe
   any Google/MFA challenge without inferring MFA evidence from it.
2. Check the configured organization's User membership and selected browser
   session. Check `/session`, the visible portal, product access, and the
   organization page. No manual User grant is part of this walk. An existing
   non-User membership must stay refused; use an eligible account without a
   membership for the enrollment proof.
3. Configure Claude Code with the printed HTTPS endpoint and scopes. Open its
   separate Connect browser authorization, select the target organization if
   asked, and grant consent. Verify the client gets its own token for the MCP
   resource without printing its value.
4. Ask the client to fetch a public HTTPS URL through `getURLAsMarkdown`.
   Verify the real HTTPS MCP request, real pinned renderer output, returned
   Markdown, and Axiom's started, completed, and identity completion records
   for the same call.
5. Verify a wrong Bearer token gets `401` with the protected-resource metadata
   challenge and no fetch. Remove only User from the current membership; the
   same Connect token must get `403 access_denied` with no fetch. Sign in with
   Google again and verify the removed role is not restored. Restore the
   intended grant after the proof.
6. Verify Connect renewal, then revoke the user's authorized application.
   Observe refusal after token expiry and failed refresh. Record safe results
   without keys, tokens, cookies, codes, or complete authentication URLs.
7. Stop with Ctrl+C. Check clean shutdown and log flush. Remove the client
   entry. Record any live blocker explicitly; never call an incomplete walk
   a pass.

## Tests and release gates

Offline acceptance tests use the real application and SDK with a local WorkOS
fake, a renderer double, and a recording logger. They establish application
behavior within those seams. WorkOS interface tests establish pinned SDK and
jose contracts against a local fake. Launcher tests are unit specifications
with `pnpm` and `openssl` doubles. None proves the Google, Connect client,
renderer, or Axiom live behavior.

Before each commit, run every changed test. Before Ready, run on the complete
candidate:

- `npm run check` and `habit-hooks`; keep the snooze file empty and correct or
  explain each enforced smell.
- Focused commands for every new or changed test.
- `npm run test:integration` and `npm run test:acceptance`.
- `npm run build && node --test dist/test/interface/auth/workos.test.js`.
- `npm run test:container`, required by the package and startup changes.
- `npm run test:hosted-live` with the staging settings, after stopping the
  slice. Run the entire file; a name-filtered run is not a gate pass.
- Renderer or other applicable gates if their covered production files
  change, as the [test gate policy](test-gate-policy.md) requires.

Record exit status, tests, passes, failures, cancellations, skips, and todo
counts. A skipped or unrun test is not a pass. After Ready, every Actions job
started for the final head must pass. A fix returns the PR to Draft first.

## Recorded evidence and remaining work

The [validation record](auth-workos-mcp-url-fetch-validation.md) gives the
completed commands, exact counts, retained habit-hooks findings, and remaining
live evidence. Earlier startup smoke checks and configuration reads do not
replace the real Google, Connect, HTTPS fetch, and Axiom proof. PR #108 stays
in Draft until that walk and the complete required gates pass.
