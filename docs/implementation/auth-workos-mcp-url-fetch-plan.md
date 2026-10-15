# Auth WorkOS MCP URL fetch: work slice plan

Status: steps 0 to 4 done, and the documents of step 6, on 2026-10-15; step 5 and the runs of step 6 open.
Date: 2026-10-14. Branch: `claude/auth-workos-mcp-work-slice-c97848`.
Slice folder: `test/acceptance/work-slice/auth-workos-mcp-url-fetch/`.
Entry point: `auth-workos-mcp-url-fetch.ts` in that folder.

The owner confirms or changes each [decision](#decisions) before step 1.

Progress on 2026-10-14: the owner accepted D1 to D10, and step 0 ran with
the WorkOS connector in Staging. `updateAuthkitSettings` turned on Google
sign-in, DCR, and CIMD. The read-back shows `isGoogleOauthEnabled`,
`isAuthkitDynamicClientRegistrationEnabled`, and
`isAuthkitClientIdMetadataDocumentEnabled` true, with password sign-in on,
MFA `Required`, and sign-up allowed. `createOrganization` made "Thermus work
slice", `org_01M4YYEQ6V2ZBM3RQEEV8CKFEA`, with the external ID
`thermus-work-slice` and no domain. The AuthKit metadata now has the
`registration_endpoint` `<issuer>/oauth2/register`,
`client_id_metadata_document_supported: true`, and the scopes `email`,
`offline_access`, `openid`, and `profile`. The sign-in page of the environment
client offers "Continue with email", "Continue with Google", and a sign-up
link. The connector has no operation for the default scopes of DCR; the owner
checks them in the dashboard, and the client pins them anyway (D4). The MFA
probe after a Google sign-in waits for step 5, so that the first sign-in
happens there. The prerequisites are present: the staging launcher, Lightpanda
1.0.0 under `.cache/lightpanda/1.0.0/`, the portal build, the three Axiom
lines in `.env.local`, OpenSSL 3.6.3, free ports 46443 and 8080, Claude Code
2.1.289, and an empty `ad-rules.txt`.

Steps 1 to 3 ran on 2026-10-14 with two subagents in their own worktrees, from
the plan commit, and landed on the branch after a rebase onto `main`, which
had moved by five commits (#88 to #95: the test code layout, the moved MCP
test doubles and the raw MCP driver under `test/support/`, and the lint of
the test layer boundaries). Subagent B added the two production seams of D6
and gap 3 with their tests. `tools/list` without a `buildServer` does not give
an empty list: the default server has no tools capability, so the SDK answers
HTTP 404 with the JSON-RPC error -32601 "Method not found", and the case says
so. A second case covers `openWorkOSConnection()`: the settings, the operator
line, and the refusal of invalid settings without a line. The stop-signal
case became `test/unit/stop-signal.test.ts` with an `EventEmitter` as the
signals double, so that the integration test of the stop signals stays under
200 lines. Subagent A wrote the red acceptance test (five cases: the first in
both eras), the stub, the two moved helpers, and the three options of the
local HTTPS site with an integration case that listens on port 46443. The
acceptance test and the raw MCP requests of B's case import the driver from
`test/support/drivers/mcp/`, as the layout rule D2 requires since #95. The
move of the fetch lines ended the one exception of rule D2, so the lint
block, its architecture case, and the layout document changed with it; a new
case shows that the former exception is refused.

Step 4 ran on 2026-10-15 with subagent C, from the landed base. The slice
acceptance test is green in both eras: 5 of 5. The launcher has 13 unit cases
with a fixture, `test/unit/work-slice/fixtures/launcher-case.ts`, that copies
the launcher into a temporary root with a pnpm double and an openssl double.
The smoke start of C found that the default portal build of `LocalHttpsSite`
was a path from its own place, correct only from `dist/`; it now comes from
`portalBuild` in `test/support/processes/module-paths.ts` (rule D8), with a
case in the paths test. The site module grew past 200 lines and is split: what
the front answers, the portal files and the forward to Thermus, is
`test/support/hosted-live/portal-front.ts`. The entry point writes
`Listening on https://localhost:46443/`, because it does not use
`serveApplication()`. Two smoke runs on the owner's Mac through the staging
launcher, with the real Axiom key: the launcher made the certificate
(`CA:TRUE`, the three names, `serverAuth`, mode 0600), the front answered the
portal, the protected-resource metadata with the AuthKit issuer, `401` with
the metadata challenge without a token and with a wrong token, and `401` for
the session; Node refused the certificate without `NODE_EXTRA_CA_CERTS`; a
SIGINT gave exit status 0 and no export failure; Axiom had the WorkOS line and
the stop line of the run. `npm run check` passed on the candidate. Subagent D
changed the two gate proofs of D1 (Google as the only social provider; the
registration endpoint and CIMD in the AuthKit metadata) and the documents;
the changed proofs wait for the gate run of step 6. habit-hooks reports four
files over 200 lines: the three hosted WorkOS acceptance tests, which were
over the limit before, and the acceptance test of the slice, 248 lines with
its four cases and their shared site; each stays with that reason.

Runs of step 6 on 2026-10-15, before the walk of step 5: `npm run test:container`
passed 12 of 12 with Docker 29.5.2 on `linux/arm64`. The draft pull request is
`3-headed-monkey/Thermus#108`.

## Goal

One script starts the hosted edition with the real WorkOS provider and the
fetch tool, so that one person can walk this path:

1. The person opens the portal in a browser and signs in with Google, with a
   `thermus.ai` address. WorkOS AuthKit creates the user.
2. The person connects Claude Code to the MCP endpoint. Claude Code gets a
   Connect access token from AuthKit through OAuth, with the consent of the
   signed-in person.
3. Claude Code calls `getURLAsMarkdown`. The server checks the token against
   the AuthKit key set, reads the current grant of the person in WorkOS, and
   fetches the page. Axiom shows the fetch and the completion record with the
   WorkOS identity.

The slice is a development tool. It composes production parts with test-only
parts. It changes no production policy. The
[basic MCP URL fetch slice](basic-mcp-url-fetch-plan.md) is its model.

## What the flow means in the product

The requested flow has one point that the product does not do in the way the
request words it. Step 2 of the request says that WorkOS "generates an access
token this user can use to access our MCP". In the hosted edition, the browser
sign-in gives a browser session cookie only. The MCP endpoint refuses browser
tokens. It accepts only a Connect access token: a token that the MCP client
itself gets from AuthKit, through the OAuth authorization code flow with PKCE,
for the resource `<base>/mcp`, after the person gives consent on an AuthKit
page. The [hosted access rules](../design/authentication-design.md#hosted-access-of-auth-06)
give the checks. Claude Code does this flow itself: it reads the
protected-resource metadata of the MCP endpoint, registers itself at AuthKit,
opens the browser for the consent, and keeps the token. The browser session of
step 1 makes the consent short, because AuthKit does not ask for the sign-in
again. So the slice keeps the product rule: the person signs in once in the
browser, and the MCP client gets its own token.

The MCP endpoint of the hosted edition already validates the token: RS256, the
exact AuthKit issuer, the MCP resource as audience, the time claims, the claims
`sub`, `sid`, `client_id`, `scope`, `iat`, and `exp`, and a `sub` that is not
the `client_id`. After that, each request reads the current grants of the
person in the organization of the token from WorkOS. The
[hosted WorkOS test](../../test/acceptance/auth/hosted-workos.test.ts) and the
[hosted live gate](test-gate-policy.md#hosted-live-gate-auth-06) prove this.
The slice adds no check. It only puts the fetch tool behind these checks.

## Starting point

Checked on 2026-10-14 in the code, in the WorkOS Staging environment
`environment_01M4VDKATD5PXZT4H01EHCMR2A` through the WorkOS connector, and on
the owner's Mac.

| Part | State | Where |
| --- | --- | --- |
| Hosted composition with WorkOS: settings, SDK client, AuthKit key set, verifier, access resolver, browser session, session routes, protected-resource metadata | Exists. `openWorkOSApplication()` loads the settings and makes the connection; `composeWorkOSApplication()` makes the parts. | `src/hosted-workos-application.ts` |
| Fetch tool behind the hosted MCP endpoint | Missing. The hosted `MCPServer` has no `buildServer`, so it serves no tool. The hosted edition must load no rules reader, renderer, or pipeline; `test/acceptance/mcp/server-only-modules.test.ts` enforces this. | `src/hosted-workos-application.ts`, `src/fetch-tool.ts` |
| Connect token verification and the current grant read for each request | Exists. | `src/auth/hosted-auth/workos/workos-auth-provider.ts`, `workos-organizations.ts` |
| Browser sign-in, callback, sign-out, session JSON, portal | Exist. | `src/auth/hosted-auth/workos/workos-session-routes.ts`, `src/user-portal/` |
| MFA evidence of a session | Exists, for a password sign-in only. A Google sign-in gives `mfaCompleted: false`. The administration pages then answer `403`. | `src/auth/hosted-auth/workos/workos-sign-in.ts` |
| HTTPS in front of the hosted edition | Test support only. `LocalHttpsSite` serves the portal build at `https://localhost:46443/`, forwards each other request to Thermus, and makes a new self-signed certificate for each run in a temporary directory. | `test/support/hosted-live/local-https-site.ts` |
| Fake WorkOS API for offline tests, with Connect tokens, sign-ins, memberships, roles, and the sign-in method | Exists. | `test/support/workos-world.ts` |
| Work slice parts: Axiom logging, the fetch lines, the renderer check, the launcher pattern | Exist in the basic slice. `observeFetches()` and the renderer check are private to its entry point. | `test/acceptance/work-slice/basic-mcp-url-fetch/` |
| Google sign-in in Staging | Off. Each social provider is off; password sign-in is on; MFA is `Required`; passkeys and magic sign-in are off; sign-up is allowed; email verification is required. The live gate proves "no social provider". | WorkOS Staging, `test/acceptance/auth/hosted-live/configuration.ts` |
| Dynamic Client Registration and Client ID Metadata Documents in Staging | Off. The AuthKit metadata has no `registration_endpoint`. Claude Code needs one of them, or a pre-registered client. The live gate only records this as a diagnostic. | WorkOS Staging |
| Registered URIs in Staging | Redirect URI `https://localhost:46443/callback` (the only one, the default); Sign-out URI `https://localhost:46443/`; Initiate login URI `https://localhost:46443/login`; MCP resource indicator `https://localhost:46443/mcp`; no CORS origin. The live gate asserts exactly this. | WorkOS Staging |
| Connect applications in Staging | None. The live gate makes and deletes its own. | WorkOS Staging |
| Organizations in Staging | One WorkOS seed organization, "Test Organization", with the domain `example.com` and a test IdP. No organization for `thermus.ai`, and no verified `thermus.ai` domain. | WorkOS Staging |
| Roles in Staging | `member` (default, no permission), `user`, `admin`, `super-admin`, with the permissions of the hosted role mapping. Multiple roles are on. | WorkOS Staging |
| Claude Code on this Mac | 2.1.289. It supports OAuth for HTTP MCP servers with DCR and CIMD, a pre-registered client (`--client-id`, `--client-secret`, `--callback-port`), pinned scopes in `oauth.scopes`, `claude mcp login`, and `NODE_EXTRA_CA_CERTS`. A non-interactive run cannot do the OAuth flow. | `claude mcp add --help`, the Claude Code MCP documentation |
| Prerequisites on this Mac | Present: Lightpanda 1.0.0 under `.cache/lightpanda/1.0.0/`, the portal build `src/user-portal/dist/`, OpenSSL 3.6, Node 24.20, the Axiom lines in `.env.local` of this worktree, Playwright Chromium. Ports 46443 and 8080 are free. The staging launcher `~/.config/thermus/with-workos-staging.cjs` gives the three WorkOS settings. | |

## Gaps

### Product code

1. **No tool behind the hosted MCP endpoint.** `workosProviderParts()` makes
   the `MCPServer` without `buildServer`. The slice needs a seam that takes a
   `RequestServerBuilder`, so that the slice gives
   `fetchToolServers(operation, logger)` and production gives nothing. The
   rule "the hosted edition loads no server-only module" stays. Production
   behavior does not change.
2. **The connection and the composition are one function.**
   `openWorkOSApplication()` loads the settings, makes the SDK client and the
   key set, and composes. The slice needs the connection with the real WorkOS
   and the composition with its tool. The offline test needs the composition
   with the fake connection of `WorkOSWorld`. So the connection step becomes
   its own export.
3. **No exported stop-signal wait.** `serveApplication()` starts one HTTP
   listener and waits for `SIGINT` or `SIGTERM`. The slice has two listeners,
   the HTTPS front and Thermus, so it cannot use `serveApplication()`. The
   wait for the stop signal is private in `src/index.ts`.
4. **No MFA evidence for a Google sign-in.** This is a product rule, not a
   defect: only a password sign-in proves MFA, so a session from a Google
   sign-in cannot open the members or invitations pages. The portal and MCP
   do not need MFA evidence. The slice accepts this. It changes nothing.

### Test support

5. **The HTTPS front is fixed to the live gate.** `LocalHttpsSite` composes
   the hosted edition itself, with a random cookie password and no tool, and
   makes a throwaway certificate. The slice needs the same front with its own
   application and a certificate that stays, so that a person can trust it
   once in the browser and in Claude Code.
6. **The fetch lines and the renderer check belong to the basic slice.**
   `observeFetches()`, `MARKDOWN_LOG_LIMIT`, and `assertPinnedRenderer()` are
   in the entry point of the basic slice. A second slice needs them. They move
   to `test/support/work-slice/`.
7. **No slice folder.** The entry point, the launcher script, the acceptance
   test, the unit tests, the README of the slice, and the package script do
   not exist.

### WorkOS Staging configuration

8. **Google sign-in is off, and the live gate proves it is off.** The
   configuration proof "the hosted sign-in page offers only email sign-in and
   no social provider" and the gate policy say so. Google sign-in in Staging
   changes a proof of AUTH-06. The owner decides where the slice runs
   ([D1](#decisions)).
9. **Claude Code cannot register.** DCR and CIMD are off, and no Connect
   application exists. Claude Code then fails with "Incompatible auth server:
   does not support dynamic client registration". The environment needs DCR or
   CIMD on, or a pre-registered public Connect application with PKCE and a
   fixed callback port ([D3](#decisions)).
10. **A new user has no access.** After the first Google sign-in, WorkOS has
    the user, but the user has no organization membership. The portal shows no
    product access, the organization page gives the onboarding guidance, and
    the MCP endpoint answers `403 access_denied`. Access needs an active
    membership with the role `user` in an organization. No organization for
    the slice exists ([D5](#decisions)).
11. **Google credentials.** WorkOS gives built-in Google test credentials in
    Staging. With them, the Google consent screen shows the WorkOS name and
    logo. Own Google credentials need a Google Cloud project. The slice uses
    the built-in credentials.
12. **MFA after Google is not known.** The environment requires MFA. The WorkOS
    documentation excludes only SSO users from the requirement. Whether AuthKit
    asks for a TOTP enrollment after a Google sign-in is a probe of step 0.
    Either answer works for the slice: MCP needs no MFA evidence.

### MCP client

13. **The token needs a `scope` claim.** The verifier refuses a token without
    `scope`. Claude Code does not request the `scopes_supported` list of
    discovered metadata by itself, and the protected-resource metadata of
    Thermus names no scope. The client configuration must pin the scopes
    `openid profile email offline_access` ([D4](#decisions)). `offline_access`
    also gives the refresh token, so the 300-second access token renews
    without a new sign-in.
14. **The self-signed certificate.** Claude Code and the browser must trust the
    certificate of `https://localhost:46443/`. Claude Code reads
    `NODE_EXTRA_CA_CERTS`. The browser needs a one-time trust in the macOS
    Keychain, or the person accepts the warning ([D2](#decisions)).
15. **The OAuth flow is interactive.** `claude mcp login <name>` or `/mcp`
    does the flow in an interactive session. A `claude -p` run uses the stored
    token after that.

### This Mac, the gate, and the documents

16. **The WorkOS API key.** The slice needs `WORKOS_API_KEY`,
    `WORKOS_CLIENT_ID`, and `WORKOS_AUTHKIT_ISSUER`. They come from the staging
    launcher outside the repository. The key goes into no file, log, or ticket.
17. **One run at a time at port 46443.** The live gate and the slice use the
    same origin and the same registered URIs. They cannot run at the same
    time. A slice organization and the owner's user in Staging do not break
    the gate: the gate deletes only the data with its own name prefixes, and
    its configuration proofs read other settings.
18. **Documents.** The slice list, the docs index, the README scripts and the
    hosted section, the test inventory, the gate policy, the authentication
    design, and the fetch tool reference name the basic slice or the Staging
    configuration. Each needs the new slice or the new configuration.

## Decisions

Each decision has a default. Confirm or change it before step 1.

| ID | Decision | Default | Alternative |
| --- | --- | --- | --- |
| D1 | WorkOS environment | Staging, `environment_01M4VDKATD5PXZT4H01EHCMR2A`. The owner turns Google sign-in, DCR, and CIMD on through the WorkOS connector or the dashboard. The configuration proof of the live gate changes from "no social provider" to "Google only", and the gate policy and the design record the new configuration. The complete live gate runs again in step 6. | A new sandbox environment "Work slice" from the connector (`createEnvironment`), with its own AuthKit domain, API key, roles, permissions, URIs, and resource indicator. The live gate does not change, but the slice keeps a second configuration, and the staging launcher needs a second key. |
| D2 | Public origin and TLS | `https://localhost:46443/`, so that the registered redirect URI, Sign-out URI, Initiate login URI, and MCP resource indicator serve the slice without a change. The launcher makes one self-signed certificate with OpenSSL when it is missing, for `localhost`, `127.0.0.1`, and `::1`, under `.cache/thermus-local-tls/`, which Git ignores. The slice prints the one-time Keychain trust command for the browser and the `NODE_EXTRA_CA_CERTS` setting for Claude Code. | `mkcert`, which trusts its root in the Keychain itself. Or a public tunnel with a real certificate; that needs new URIs in WorkOS, which the gate proof of the one redirect URI refuses in Staging. |
| D3 | How Claude Code registers | DCR and CIMD on in the environment. Claude Code registers itself with its own loopback redirect URI, so no fixed port is needed. The consent page shows the client name that Claude Code registers. | A public Connect OAuth application with PKCE, made once by the owner, with the redirect URI `http://localhost:46481/callback`; then `claude mcp add --client-id <id> --callback-port 46481`. |
| D4 | Token scopes | The printed client command pins the scopes: `claude mcp add-json thermus-hosted '{"type":"http","url":"https://localhost:46443/mcp","oauth":{"scopes":"openid profile email offline_access"}}'`. | `scopes_supported` in the protected-resource metadata, a production change in `ProtectedResourceEndpoint`. Claude Code does not promise to request them, so the default stays the pin. |
| D5 | First access of the new user | An operator step after the first sign-in: the owner adds the user to the slice organization "Thermus work slice" with the role `user`, in the WorkOS dashboard or with the connector (`addUserToOrganization`), as the operator runbook adds a membership. The slice makes no membership itself. The entry point prints this step, and the portal shows the result after a reload. The owner makes the organization once, with the external ID `thermus-work-slice`. This step is a shortcut of the slice in Staging; in the product, the operator grants only Super Admin, as the runbook gives, and the Super Admin grants Admin and User in the portal. | (a) Automatic membership by the verified domain `thermus.ai` on the slice organization, with `user` as the default role of that organization. WorkOS documents automatic membership for verified domains, but its examples name SSO only. This needs a live probe before the slice can depend on it, and a decision about a default role that gives access. (b) An invitation from the portal by a Super Admin that signed in with a password and MFA: the complete product path, with more steps. (c) A slice-only `--grant-user <email>` command on the test-support `OperatorRunbook`. |
| D6 | Composition seam | `src/hosted-workos-application.ts` exports `openWorkOSConnection(config, logger, environment)` and `composeWorkOSApplication(config, connection, parts)`, with `parts: { logger, buildServer? }`. `openWorkOSApplication()` stays for `createApplication()` and passes no `buildServer`. The three offline tests that call `composeWorkOSApplication(config, connection, log)` change their third argument. The eslint rule of habit-hooks allows at most three parameters, so the record is the third parameter. | A copy of `workosProviderParts()` in the slice. The owner's rule refuses a copy of a production composition. |
| D7 | HTTPS front | `LocalHttpsSite.start(settings, options)` gets two options: `certificate` (the key and certificate files to use; the default is a new self-signed certificate) and `application` (a function that opens the application; the default is the hosted composition with the staging settings). The gate keeps its behavior. The slice gives its own application and the certificate of D2. | A new class in `test/support/` that takes the files, the portal build, and the forward target, and `LocalHttpsSite` as its user. |
| D8 | Logging | `openAxiomLogging()` and the three lines of the basic slice: the started line, the completed line with the Markdown, and the production completion record. The record shows the WorkOS identity: the authority `workos:<client ID>`, the user ID as subject, and the tenant `workos:<client ID>:<organization ID>`. The start line of the hosted composition and each failure report go to the same log. No new log line. | One slice-only line for each token check. The completion record already shows the identity, so it is not needed. |
| D9 | Proof | An offline acceptance test with `WorkOSWorld`, the renderer double, and a recording logger, in both protocol eras. The manual run proves Google sign-in, DCR, Claude Code, and the Axiom export, and the pull request records it. The complete hosted live gate runs after the gate proof changes (D1). | Also a `.live.ts` case of the slice in the gate. Not now: the gate drives AuthKit with a password user, and a Google sign-in needs a real Google account. |
| D10 | Sign-in method and MFA evidence | A Google sign-in gives no MFA evidence. The administration pages refuse that session. The slice documents this. No code changes. | Count a Google sign-in as MFA-completed. Refused: it contradicts the design, and WorkOS gives no MFA claim. |

## Design

### Files

```
src/hosted-workos-application.ts                      openWorkOSConnection(); composeWorkOSApplication(config, connection, { logger, buildServer? }); openWorkOSApplication() unchanged in behavior
src/index.ts                                          stopSignal(signals), now exported
test/support/hosted-live/local-https-site.ts          start(settings, { portalBuild?, certificate?, logger?, application? })
test/support/hosted-live/portal-front.ts              The portal files, their headers, and the forward to Thermus, from local-https-site.ts
test/support/processes/module-paths.ts                portalBuild, the portal build of the repository root
test/unit/work-slice/fixtures/launcher-case.ts        The harness of the launcher test: the pnpm and openssl doubles and the temporary root
test/support/work-slice/observe-fetches.ts            observeFetches(), MARKDOWN_LOG_LIMIT, from the basic slice
test/support/work-slice/pinned-renderer.ts            assertPinnedRenderer(executable), from the basic slice
test/acceptance/work-slice/README.md                  The list of the slices, with the new slice
test/acceptance/work-slice/auth-workos-mcp-url-fetch/README.md                       The README of the slice: the setup in WorkOS, the command, the settings, the walk, and the log lines
test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.ts    The entry point and the composition: composeWorkSliceApplication(); it runs only when executed directly
test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.ts   The acceptance test, offline
test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.sh    The launcher: the settings with their defaults, the certificate, then the entry point with the pinned Node runtime of pnpm
test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.ts   Imports the two moved helpers
test/acceptance/auth/hosted-live/configuration.ts     The social-provider proof: Google only (D1)
test/acceptance/auth/hosted-workos.test.ts            One case of the seam: with a buildServer the endpoint lists the tool; without it, no tool
test/unit/work-slice/observe-fetches.test.ts          Moved from basic-mcp-url-fetch.test.ts
test/unit/stop-signal.test.ts                         stopSignal() with an EventEmitter as the signals double
test/unit/work-slice/auth-workos-mcp-url-fetch-script.test.ts   The launcher with a pnpm double
package.json                                          The script work-slice:auth-workos-mcp-url-fetch
```

The slice adds two seams to `src/` by the owner's rule: the connection export
and the `buildServer` part (D6), and the stop-signal wait (gap 3). No
production behavior changes. `createApplication()` still composes the hosted
edition without a tool, and `server-only-modules.test.ts` still passes.

### Settings

The launcher sets the defaults. A setting with a value before the call keeps
that value. The three WorkOS settings come from the staging launcher:

```sh
node ~/.config/thermus/with-workos-staging.cjs test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.sh
```

| Variable | Rule | Default |
| --- | --- | --- |
| `DEPLOYMENT` | `hosted`. `loadDeploymentConfig(environment, 'http')` reads it. | `hosted` |
| `PUBLIC_BASE_URL` | An `https` origin. The MCP resource is `<base>/mcp`. It must be a registered resource indicator (D2). | `https://localhost:46443` |
| `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_AUTHKIT_ISSUER` | Required. From the staging launcher. The launcher of the slice refuses to start without them, with a message that names them and shows no value. | None |
| `WORKOS_REDIRECT_URI` | The registered callback. | `<PUBLIC_BASE_URL>/callback` |
| `WORKOS_COOKIE_PASSWORD` | At least 32 characters. A new value ends each browser session of the slice. | A new random value for each start, from `openssl rand -base64 32` |
| `AD_RULES_FILE`, `LIGHTPANDA_BIN` | As in the basic slice. `createFetchOperation()` reads them. | `ad-rules.txt` at the root; `.cache/lightpanda/1.0.0/lightpanda` |
| `AXIOM_API_KEY`, `AXOIM_ENDPOINT_URL`, `AXIOM_SYSTEM_LOG_TEST_DATA_SET` | As in the basic slice. | As in the basic slice |
| `THERMUS_TLS_DIR` | The directory of `key.pem` and `cert.pem`. The launcher makes them when they are missing. | `.cache/thermus-local-tls` |
| `LISTEN_HOST`, `LISTEN_PORT` | The Thermus listener behind the front. The front forwards to it, so port 0 is allowed here. | `127.0.0.1`, `0` |

The launcher writes the settings to stderr before the start, but never
`WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, or `AXIOM_API_KEY`.

### Composition

`composeWorkSliceApplication({ config, connection, environment }, logger)`:

1. The operation: `createFetchOperation(environment, logger)`, wrapped by
   `observeFetches()`.
2. The hosted application:
   `composeWorkOSApplication(config, connection, { logger, buildServer: fetchToolServers(operation, logger) })`.
   Everything else is the production composition: the verifier and the access
   resolver, the required permission `product:access`, the protected-resource
   metadata, the browser routes, the account routes, and the portal access
   operation.

The entry point:

1. `loadDeploymentConfig(process.env, 'http')` and `loadListenAddress()`.
2. `assertPinnedRenderer(process.env.LIGHTPANDA_BIN)`.
3. `axiomTestSettings()` and `openAxiomLogging()` with the scope name
   `thermus-work-slice-<run id>`.
4. `openWorkOSConnection(config, logger, process.env)`. The start makes no
   WorkOS call; the first token reads the key set.
5. `composeWorkSliceApplication()`, then `LocalHttpsSite.start()` with the
   application, the certificate files, and the portal build. The front
   listens at `https://localhost:46443/` on `127.0.0.1` and `::1`, serves the
   portal, and forwards each other request to the Thermus listener.
6. The instructions to stdout, then the wait with `stopSignal(process)`.
7. The stop: the front closes, then the application and the listener in the
   production order, then the logging. A failed export gives the `FATAL` line
   and exit status 1, as in the basic slice.

### The walk

The README of the slice gives this walk. The entry point prints the commands.

1. One-time setup in WorkOS Staging by the owner (D1, D3, D5): Google sign-in
   on, DCR and CIMD on with the default scopes `openid profile email
   offline_access`, and the organization "Thermus work slice" with the
   external ID `thermus-work-slice`.
2. Start the launcher through the staging launcher. Trust the certificate
   once (D2).
3. Open `https://localhost:46443/`, click Sign In, click "Continue with
   Google", and sign in with the `thermus.ai` Google account. AuthKit creates
   the user. The portal shows the name and "no product access"; the
   organization page gives the onboarding guidance.
4. The owner adds the user to the organization with the role `user` (D5).
   Reload the portal: "You have product access in organization <ID>. Roles:
   user."
5. Add the MCP server to Claude Code with the printed `claude mcp add-json`
   command (D4), with `NODE_EXTRA_CA_CERTS` set to the certificate. Run
   `claude mcp login thermus-hosted`. The browser opens AuthKit; the person
   clicks "Allow access". Claude Code keeps the token.
6. Start a new Claude Code session and ask it to read a page through
   `thermus-hosted`. Axiom shows the started line, the completed line, and the
   completion record with the WorkOS authority, the user ID, and the tenant.
7. Checks that show the validation: a request with a wrong Bearer token gets
   `401` with the metadata challenge; after the owner removes the role `user`,
   the next tool call gets `403 access_denied` and no fetch line; after the
   owner deletes the authorized application of the user in WorkOS, the token
   works until it expires, at most 300 seconds, and then the refresh fails.
8. Stop with Ctrl+C. Remove the client entry with `claude mcp remove
   thermus-hosted`.

### Unchanged production behavior

- The hosted edition in production serves no tool and loads no renderer.
- The token checks and the current grant read of each request stay as they
  are.
- A Google sign-in gives no MFA evidence (D10).
- The completion record keeps its format.

## Tests

### Acceptance

File: `auth-workos-mcp-url-fetch.test.ts`. Offline. It uses `WorkOSWorld`
with the organization `org_01ACME`, `RendererProcessDouble`, the trusted rules
fixture, a recording logger, `signInThroughServer()` with `HostedBrowser`, and
the real MCP SDK client through the real HTTP bridge, in both protocol eras.
The world's `authenticationMethod` is `GoogleOAuth`.

- Given the slice application and Ada with the role `user` in Acme, when Ada
  signs in through the server and the browser reads `session` and
  `portal/access`, then the session is signed in with `mfaCompleted: false`
  and the portal access names Acme and the role `user`; when an MCP client
  with a Connect token of Ada for Acme lists the tools and calls
  `getURLAsMarkdown` for `https://news.example/story` with a reason, then the
  client gets the cleaned Markdown without the paragraph that the rules
  remove, and the log has the started line, the completed line, and one
  completion record with the authority `workos:client_test`, the subject
  `user_01ADA`, the tenant `workos:client_test:org_01ACME`, and the status
  `success`; `close()` stops the application.
- Given Dee without a membership, as after a first Google sign-in, when Dee
  signs in and opens `portal/access` and `organizations`, then the access is
  `403` and the organization page gives the onboarding guidance; when an MCP
  client with a Connect token of Dee calls the tool, then it gets `403
  access_denied`, no renderer starts, and the log has no fetch line; when the
  world gets Dee's membership with `user`, as the operator step gives it, then
  the next call succeeds.
- Given no token, a browser token of Ada, and a Connect token for another
  resource, when each reaches the MCP endpoint, then each gets `401` with a
  Bearer challenge that names the protected-resource metadata, and the
  metadata names the AuthKit issuer of the world as its only authorization
  server.
- Given Ben with Admin only in Acme, when his Connect token calls the tool,
  then it gets `403` and no fetch line.

### Unit and integration

- `test/unit/work-slice/auth-workos-mcp-url-fetch-script.test.ts`: the
  launcher with a pnpm double: the defaults, the derived redirect URI, the
  random cookie password with at least 32 characters, the certificate files
  that it makes when they are missing and keeps when they exist, the refusal
  without the three WorkOS settings with a message that shows no value, the
  settings on stderr without the secrets, the extra arguments, and the exit
  status of pnpm.
- `test/unit/work-slice/observe-fetches.test.ts`: the moved cases of
  `observeFetches()`.
- `test/acceptance/auth/hosted-workos.test.ts`, one case: given
  `composeWorkOSApplication()` with a `buildServer` that gives a test-only
  tool, when a Connect token of a User lists the tools, then it gets that
  tool; without a `buildServer`, the list is empty. The slice test covers the
  real tool.
- `test/integration/auth/hosted-live-site.test.ts`: the failure cases stay;
  one more case: given certificate files and an application, when the site
  starts, then it uses them and forwards a request to that application.
- `test/acceptance/mcp/server-only-modules.test.ts`: unchanged. It shows that
  the seam adds no module to the hosted edition.

### Live gate

- `test/acceptance/auth/hosted-live/configuration.ts`: the social-provider
  proof asserts that the sign-in page offers exactly "Continue with Google"
  and no other social provider (D1). The AuthKit metadata diagnostic now
  shows `registration_endpoint: present`. The policy, the design, and the test
  inventory record both.

### Commands

```bash
npm run build && node --test dist/test/unit/work-slice/*.test.js dist/test/acceptance/work-slice/auth-workos-mcp-url-fetch/*.test.js dist/test/acceptance/work-slice/basic-mcp-url-fetch/*.test.js dist/test/acceptance/auth/hosted-workos.test.js dist/test/integration/auth/hosted-live-site.test.js dist/test/acceptance/mcp/server-only-modules.test.js dist/test/integration/server-stop-signals.test.js
```

## Steps

### Step 0: decisions, WorkOS Staging, and this Mac

The manager does this step with the owner. The connector writes need a session
that is not in auto mode.

1. Confirm the decisions D1 to D10.
2. In Staging, with the connector or the dashboard: `updateAuthkitSettings`
   with `isGoogleOauthEnabled`, `isAuthkitDynamicClientRegistrationEnabled`,
   and `isAuthkitClientIdMetadataDocumentEnabled` true; the default scopes of
   DCR `openid profile email offline_access` in the dashboard; and
   `createOrganization` "Thermus work slice" with the external ID
   `thermus-work-slice`. Read each setting back.
3. Probe once in a browser: open the AuthKit sign-in page and check that it
   offers "Continue with Google". Note whether a Google sign-in asks for a
   TOTP enrollment (gap 12). Do not complete a sign-in before step 5, so that
   step 5 shows the first sign-in.
4. Check the prerequisites: `"$LIGHTPANDA_BIN" version` gives `1.0.0`,
   `src/user-portal/dist/` exists or `npm run build:user-portal` makes it,
   `.env.local` has the three Axiom lines, `openssl version` works, ports 46443
   and 8080 are free, and `claude --version` is 2.1.231 or later.

Done when: the connector reads back the three settings and the organization,
and each prerequisite is present.

### Step 1: the acceptance test, red

1. Write `auth-workos-mcp-url-fetch.test.ts` as [Tests](#tests) specifies.
2. Write the entry point with `composeWorkSliceApplication()` as a stub that
   throws, so that the build passes and the test fails at run time.

Done when: the focused command fails for that reason.

### Step 2: the production seams, TDD

1. `openWorkOSConnection()` and the `parts` record of
   `composeWorkOSApplication()` (D6), with the case of
   `hosted-workos.test.ts`. The three offline tests change their third
   argument.
2. `stopSignal()` exported from `src/index.ts`, with a unit test,
   `test/unit/stop-signal.test.ts`.
3. `server-only-modules.test.ts` passes without a change.

Done when: `npm run check` passes.

### Step 3: the test support

1. Move `observeFetches()`, `MARKDOWN_LOG_LIMIT`, and `assertPinnedRenderer()`
   to `test/support/work-slice/`, with their unit test. The basic slice imports
   them.
2. `LocalHttpsSite.start(settings, options)` with `certificate` and
   `application` (D7), with the new integration case.

Done when: the moved and changed tests pass, and the basic slice test passes.

### Step 4: the composition, the entry point, and the launcher

1. `composeWorkSliceApplication()` until the acceptance test passes in both
   eras.
2. The entry point: the settings, the renderer check, the Axiom logging, the
   connection, the front, the instructions, the stop. Each function at most
   60 lines, 3 parameters, and a complexity of 10.
3. The launcher script with its unit test, and the package script.
4. The README of the slice and the slice list.
5. `npx knip` and `habit-hooks`.

Done when: `npm run check` and `habit-hooks` pass, and the launcher starts and
stops cleanly without a client.

### Step 5: the slice run

The goal. Record the output of each checkpoint; write no key.

1. Start the launcher through the staging launcher. Checkpoint: stderr shows
   the settings without the secrets; stdout shows the trust command, the
   client command, the Axiom link, the scope name, and the APL filter.
2. Trust the certificate. Open the portal. Sign in with Google. Checkpoint:
   the portal shows the name of the Google account and "no product access";
   WorkOS has the new user; the Axiom log has no error.
3. Add the user to the organization with the role `user`. Reload. Checkpoint:
   the portal shows the product access with the role `user`.
4. `claude mcp add-json` with the pinned scopes and `NODE_EXTRA_CA_CERTS`, then
   `claude mcp login thermus-hosted`. Checkpoint: the browser shows the AuthKit
   consent page, "Allow access" returns to Claude Code, and `claude mcp list`
   shows the server as connected. If Claude Code reports an incompatible
   authorization server, use the alternative of D3.
5. A new Claude Code session reads `https://example.com/` through the tool.
   Checkpoint: the answer gives the page; Axiom has the three lines of the
   call, and the completion record has the authority
   `workos:client_01M4VDKB7C7T2GV2NWPS84HADP`, the user ID, and the tenant
   with the organization ID.
6. The checks of the walk, point 7. Checkpoint: `401`, then `403`, then `401`
   after the expiry.
7. Ctrl+C. Checkpoint: exit status 0, free ports, the stop line in Axiom.
   Remove the client entry.

Done when: the seven checkpoints pass, with the date and the scope name in the
pull request notes.

### Step 6: the gate proof, the documents, the required runs, and the pull request

1. Change the social-provider proof (D1) and run the complete hosted live gate
   through the staging launcher. Record the result as the gate policy says.
2. Update the documents: `README.md` (the script and the hosted section),
   `docs/README.md`, the slice list, `docs/testing/test-list.md`,
   `docs/implementation/test-gate-policy.md` (the Staging configuration),
   `docs/design/authentication-design.md` (the dashboard configuration row
   and the AuthKit metadata row), `docs/reference/mcp-fetch-tool.md`, and
   this plan.
3. The required runs of the [test gate policy](test-gate-policy.md#required-runs):
   `npm run check`, `habit-hooks` with an empty snooze file, the focused
   command, `npm run test:acceptance`, `npm run test:integration`,
   `npm run test:container` (because `package.json` changes), and
   `npm run test:hosted-live`.
4. A draft pull request first, then Ready after the runs.

Done when: the pull request is Ready with the evidence of step 5 and the runs.

## Work split

The manager writes this plan, does step 0 with the owner, reviews each part,
and does step 5. Subagents, each on Opus 5.5, in their own worktrees with a
disjoint file set:

- A: step 1 and step 3 (the acceptance test, the moved helpers, the front
  options).
- B: step 2 (the production seams). A and B start together from this plan.
- C: step 4, after A and B land.
- D: the documents of step 6, after step 5 passes.

## Risks and checks

| Risk | Check | Response |
| --- | --- | --- |
| Claude Code and the WorkOS DCR do not agree. | Step 5, point 4. | The pre-registered client of D3. |
| The token has no `scope` claim. | Step 5, point 5: the endpoint answers `401`, and the operator log has no report. | Pin the scopes (D4). If the pin does not reach the request, add `scopes_supported` to the metadata. |
| AuthKit asks for a TOTP enrollment after the Google sign-in. | Step 0, point 3. | Complete it. The session still has no MFA evidence. |
| The browser refuses the certificate. | Step 5, point 2. | The Keychain trust command, or the warning page of the browser. |
| The Google consent screen shows the WorkOS name. | Step 5, point 2. | Expected with the built-in credentials. Own credentials are out of scope. |
| Automatic membership by domain adds the user to an organization. | Step 5, point 2: the portal shows access before the operator step. | Not expected: no `thermus.ai` domain is verified. Record it if it happens. |
| The 300-second token expires during the walk. | Step 5, point 5. | Claude Code refreshes with the refresh token. The pin has `offline_access`. |
| Port 46443 is busy. | `lsof` in step 0. | The live gate runs. Wait for it. |
| The changed gate proof fails for another reason. | Step 6, point 1. | A failed gate is not a pass; correct it before Ready. |
| The Google sign-in page changes the AuthKit driver of the gate. | Step 6, point 1. | The driver clicks "Continue with email" by its name, so the extra button does not change it. |

## Out of scope

- The fetch tool in the hosted edition in production, and TLS in the Thermus
  server. The production deployment has a TLS front.
- Google sign-in as an MFA-completed sign-in.
- Automatic onboarding by email domain, and a default role that gives access.
  They need a product decision and live proofs.
- Own Google OAuth credentials.
- Claude Desktop and other MCP clients.
- A live test of the slice in the hosted live gate.
