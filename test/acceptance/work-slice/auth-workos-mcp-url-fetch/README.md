# Auth WorkOS MCP URL fetch work slice

Purpose: start the hosted edition with the real WorkOS provider and the fetch
tool. A person signs in to the portal with Google, connects Claude Code with
its own Connect token, and monitors each fetch in Axiom.

- Entry point: `auth-workos-mcp-url-fetch.ts`. Acceptance test:
  `auth-workos-mcp-url-fetch.test.ts`. The entry point also exports the
  composition for the tests and runs only when it is executed directly.
- Command, through the staging launcher, which gives the three WorkOS
  settings:

  ```sh
  node ~/.config/thermus/with-workos-staging.cjs test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.sh
  ```

  You can start it from any directory; from another directory, give the full
  path of the launcher script. The launcher script
  `auth-workos-mcp-url-fetch.sh` refuses to start without `WORKOS_API_KEY`,
  `WORKOS_CLIENT_ID`, or `WORKOS_AUTHKIT_ISSUER`. Its message names each
  missing setting and the staging launcher, and shows no value. The script
  sets the other settings to the defaults below, makes the certificate when it
  is missing, and goes to the repository root. Then it runs the entry point
  with the pinned Node runtime of pnpm, `pnpm exec node --import tsx …`, with
  the arguments of the launcher. A signal to the process of the launcher stops
  the slice, as Ctrl+C does. Its unit test is
  `test/unit/work-slice/auth-workos-mcp-url-fetch-script.test.ts`.
- stdout shows the instructions: the portal and the MCP endpoint, the trust
  command, the sign-in steps, the Claude Code commands, the
  Axiom link, the scope name of the run, and an APL filter. The log goes to
  Axiom only. The console shows only the export failures and, when the slice
  fails, one `FATAL` line. Stop the slice with Ctrl+C.

## One-time setup in WorkOS Staging

Configure the WorkOS environment for this browser-first Google OAuth slice:

- Enable Google OAuth. Staging can use the built-in Google credentials of
  WorkOS; its Google consent screen then shows the WorkOS name.
- Enable Dynamic Client Registration (DCR) and Client ID Metadata Documents
  (CIMD), so that Claude Code can register itself at AuthKit.
- Set provider MFA to Optional. The default runtime setting is
  `WORKOS_MFA_POLICY=optional`. Password and Google sign-ins give no MFA
  evidence to the application, and administration stays refused. The slice
  always uses unproven MFA evidence, even with a `required` runtime setting.
- Configure `THERMUS_SLICE_ORGANIZATION_ID` for an existing organization in
  that environment. The staging launcher default is
  `org_01M4YYEQ6V2ZBM3RQEEV8CKFEA`, external ID `thermus-work-slice`, currently
  named "Thermus AI". The organization name does not select access.
- A verified organization domain or SAML connection is not required. If
  either is already configured, preserve it and disable domain SSO
  enforcement (`domainSsoRequired: false`), domain capture
  (`setDomainCaptureEnabledDomains: []`), and domain JIT provisioning
  (`isDomainJitProvisioningEnabled: false`) for this slice. These settings
  let Google OAuth reach the callback and let the slice policy govern User
  enrollment. Do not replace existing resources or change the default role.

The shared Staging environment is `environment_01M4VDKATD5PXZT4H01EHCMR2A`.
The [validation record](../../../../docs/implementation/auth-workos-mcp-url-fetch-validation.md)
keeps the provider read-backs, historical gates, and completed live proof.

The registered URIs of Staging serve the slice without a change: the redirect
URI `https://localhost:46443/callback`, the sign-out URI
`https://localhost:46443/`, the initiate login URI
`https://localhost:46443/login`, and the MCP resource indicator
`https://localhost:46443/mcp`. The hosted live gate uses the same origin, so
the gate and the slice cannot run at the same time.

## Settings

A setting with a value before the call keeps that value. The launcher exports
each value, and an exported value comes before the value in `.env.local`.

| Setting | Default | Rule |
| --- | --- | --- |
| `DEPLOYMENT` | `hosted` | The slice is the hosted edition. |
| `PUBLIC_BASE_URL` | `https://localhost:46443` | The slice refuses another origin or a path: the HTTPS front listens at this origin, and WorkOS Staging has its URIs. |
| `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, `WORKOS_AUTHKIT_ISSUER` | None | Required. The staging launcher gives them. |
| `WORKOS_REDIRECT_URI` | `<PUBLIC_BASE_URL>/callback` | The registered callback. |
| `WORKOS_MFA_POLICY` | `optional` | Valid values are `optional` and `required`. Required is an explicit contract that the provider requires MFA for password sign-in. The slice always treats MFA as unproven, regardless of this value. |
| `WORKOS_COOKIE_PASSWORD` | A new value of `openssl rand -base64 32` for each start | At least 32 characters. A new value ends the browser sessions of the start before. |
| `AD_RULES_FILE` | `ad-rules.txt` at the repository root | It must be a file. An empty file gives no ad rules. |
| `LIGHTPANDA_BIN` | `.cache/lightpanda/1.0.0/lightpanda` at the repository root | The pinned Lightpanda 1.0.0 of the [Lightpanda runtime guide](../../../../docs/lightpanda-runtime.md#install-the-pinned-release). The slice stops before the start if the version is different. |
| `AXOIM_ENDPOINT_URL` | `https://us-east-1.aws.edge.axiom.co` | The Axiom ingestion endpoint. |
| `AXIOM_SYSTEM_LOG_TEST_DATA_SET` | `system-log-test` | The only dataset that the slice accepts. |
| `AXIOM_API_KEY` | None | Set it in the shell or in `.env.local` at the repository root. |
| `THERMUS_SLICE_ORGANIZATION_ID` | `org_01M4YYEQ6V2ZBM3RQEEV8CKFEA` | Required by the slice composition. The launcher supplies the staging default; an explicit value selects another configured slice organization. |
| `THERMUS_TLS_DIR` | `.cache/thermus-local-tls` at the repository root | The directory of `key.pem` and `cert.pem`. Git ignores `.cache/`. |

The launcher writes the settings to stderr before the start, one `NAME=value`
line each. It never writes `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, or
`AXIOM_API_KEY`. If `AD_RULES_FILE` is not a file, the launcher stops and shows
the `touch` command that makes an empty file. If the portal build
`src/user-portal/dist/index.html` is missing, the launcher stops and shows
`npm run build:user-portal`. `LISTEN_HOST` and `LISTEN_PORT` have no effect:
the Thermus listener behind the HTTPS front listens on `127.0.0.1` with a free
port.

When `key.pem` or `cert.pem` is missing, the launcher makes a new self-signed
certificate with OpenSSL for `localhost`, `127.0.0.1`, and `::1`. It is valid
for 365 days and has the serverAuth key usage, which macOS requires. The
certificate is its own authority: `CA:TRUE`, the default of
`openssl req -x509`. The browser trusts it as a root, so a person with
`key.pem` can make certificates that the browser trusts for each site. Thus
only the owner must read `key.pem`. The launcher writes it under `umask 077`,
with the mode 0600. When both files exist, the launcher keeps them, so that the
trust of the walk stays. For a new certificate, delete the two files and trust
the new certificate again. This command removes the trust again:

```sh
security remove-trusted-cert "<repository root>/.cache/thermus-local-tls/cert.pem"
```

The certificate itself stays in the login keychain. Keychain Access can delete
it.

## The walk

1. One-time setup in WorkOS Staging, as above.
2. Start the launcher through the staging launcher. Trust the certificate one
   time. macOS asks for your password. The slice prints this command with the
   full path:

   ```sh
   security add-trusted-cert -r trustRoot -k ~/Library/Keychains/login.keychain-db "<repository root>/.cache/thermus-local-tls/cert.pem"
   ```

3. Open `https://localhost:46443/`, click Sign In, click "Continue with
   Google", and sign in with a verified `@thermus.ai` Google account. Complete
   any AuthKit steps that the confirmed configuration requires. When AuthKit
   returns its code, the server uses the trusted WorkOS result to enroll
   an eligible user without a membership, with the explicit role `user`.
4. Check the portal after the callback. The session selects the configured
   slice organization and the portal shows product access with the role
   `user`. Check the organization page too. Existing memberships keep their
   roles and status; an existing member without User still has no product
   access. No operator grant is needed for an eligible new user.
5. Connect Claude Code. Claude Code reads `NODE_EXTRA_CA_CERTS` for the OAuth
   and MCP requests. Run `claude mcp add-json` in the directory where you
   start Claude Code, or add `--scope user`. The slice prints these commands
   with the full path:

   ```sh
   export NODE_EXTRA_CA_CERTS="<repository root>/.cache/thermus-local-tls/cert.pem"
   claude mcp add-json thermus-hosted '{"type":"http","url":"https://localhost:46443/mcp","oauth":{"scopes":"openid profile email offline_access"}}'
   claude mcp login thermus-hosted
   ```

   This is a separate browser OAuth flow for Connect. AuthKit can reuse the
   Google sign-in, but the portal cookie is not an MCP credential. Select the
   slice organization if AuthKit asks, and click "Allow access". Claude Code
   keeps its own token for the MCP resource. The pinned scopes give the token
   the `scope` claim,
   which the server requires. `offline_access` gives a refresh token, so the
   access token of 300 seconds renews without a new sign-in.
6. Start a new Claude Code session with the same `NODE_EXTRA_CA_CERTS`, and
   ask: "Use the thermus-hosted tool getURLAsMarkdown to read
   https://example.com/ and tell me its title." Check that the authenticated
   request uses the real HTTPS MCP endpoint, the pinned renderer fetches the
   page, the client receives Markdown, and Axiom shows the three lines of the
   same call, as below. Do not copy keys, tokens, cookies, or authorization
   codes into output or pull request notes.
7. Check the validation. A wrong Bearer token gets `401` with the metadata
   challenge. Remove the role `user`; the next client operation must get
   `access_denied` and write no fetch line. The client can refresh before that
   operation, so this check does not require identical token bytes. Sign in
   with Google again and verify that the role stays removed. Restore User
   and check that the client can fetch again. If Claude reports that it needs
   authentication, run `claude mcp login thermus-hosted` under the existing
   approved grant.

   Then delete only that user's authorized application in WorkOS. Revocation
   stops renewal. The automated live proofs check the JWT lifetime of up to
   300 seconds and show that an issued JWT can still verify until its expiry.
   The Claude client used in this walk refreshes proactively for each
   operation, so revoked consent can fail on the very next operation, before
   that JWT expires. An immediate refresh failure does not show that the
   unexpired JWT was rejected. For the manual expiry check, wait beyond the
   last known token expiry and retry; record the renewal refusal without
   printing the token.
8. Stop with Ctrl+C. Remove the client entry with
   `claude mcp remove thermus-hosted`.

The slice gives no MFA evidence for any sign-in method. Product access and
MCP remain available with a current User grant. Members, invitations, billing,
and administration writes remain refused, even for an Admin or Super Admin.
The slice also ignores prior cookie evidence and keeps replacement cookies
without it. It has no step-up UI and does not prove that a user completed MFA.

## Slice onboarding policy

Only this opt-in slice enables onboarding. The normal hosted application has
no enrollment policy and keeps the `member` default role without product
access. This change enables no production onboarding and changes no existing
organization name, domain, SAML connection, or default role. Google OAuth is
required; existing domain routing and JIT must not bypass the callback policy.

The callback accepts eligibility only from the trusted WorkOS authentication
result: `authenticationMethod` is `GoogleOAuth`, `emailVerified` is true, and
the email domain is exactly `thermus.ai`. A different domain, a suffix such as
`thermus.ai.example`, an unverified email, or another sign-in method gets no
automatic membership. The browser signs in before the client requests Connect
authorization. A client-first flow does not run this callback policy.

For the target organization, an absent membership can be created with the
explicit role `user`. An active membership keeps its roles; Admin-only and
members without User are not upgraded. Pending and inactive memberships are
not changed. Removing User or deactivating the membership therefore keeps
access refused. A hard-deleted membership is indistinguishable from a new
user and can enroll again on an eligible sign-in. Use role removal or
deactivation when access must stay revoked.

The slice serializes enrollment for one user in one process. WorkOS writes
and concurrent operator or other-process changes are not one atomic
transaction. The slice does not blindly retry an ambiguous membership write.
An unresolved write can block another create for the lifetime of that slice
process. A failed callback issues no new authorized browser session; inspect
WorkOS state before another attempt. A successful read-back of an active User
membership can reconcile a lost write response without repeating the write.

## Recorded validation

Validation is complete and the candidate is prepared for owner review. The
[validation record](../../../../docs/implementation/auth-workos-mcp-url-fetch-validation.md)
gives the final checks, retained findings, provider read-backs, and manual
proof. Offline tests use a WorkOS fake, a renderer double, and a recording
logger to prove application behavior.

The real walk passed the Google callback, selected organization, automatic
User membership, separate Connect flow, authenticated HTTPS MCP fetch, Axiom
delivery, current-role refusal, renewal, and post-expiry consent refusal. The
corrected launcher shutdown and its Axiom delivery passed. Both complete
hosted-live MFA profiles and all requested final local gates passed. Shared
Staging Optional was restored and verified. The record states the resumed
fresh-account timeline and distinguishes client refresh from the separate
automated exact-JWT proof. Record observations without secrets. This is not
merge approval.

## Log lines

The connection to WorkOS writes one line at the start:
`Hosted authentication uses WorkOS: the client <client ID> and the AuthKit issuer <issuer>.`
The start writes `Listening on https://localhost:46443/` when the HTTPS front
listens, and the stop writes `Stopping after <signal>`. The slice records
the first startup or stop signal and keeps both signal handlers through site
cleanup and logging flush. Repeated forwarded signals do not replace the
first signal or interrupt that cleanup. The validation record includes the
passing real launcher shutdown and Axiom stopping record. One tool call writes three log lines in
this sequence:

1. `work-slice fetch started: <requested URL>`
2. `work-slice fetch completed: <requested URL> gave <n> characters of Markdown:`,
   then the Markdown. If the Markdown has more than 65,536 code points, the
   line keeps the first 65,536 and shows the number of the other characters.
   If there is an error, the ERROR line `work-slice fetch failed: <requested URL>: <message>`
   comes in place of this line.
3. The production completion record `{"event":"mcp.tool.completed",...}` with
   the WorkOS identity: the authority `workos:<client ID>`, the user ID as the
   subject, and the tenant `workos:<client ID>:<organization ID>`.

A call that the server refuses with `401` or `403` writes no fetch line.

The slice composes the production parts `openWorkOSConnection`,
`composeWorkOSApplication`, `createToolOperations(...).fetch`, and `fetchToolServers` with
the test-only HTTPS front `LocalHttpsSite`. The onboarding policy and the two
lines with the full URL and the Markdown are slice-only; the fetch tool behind
the hosted MCP endpoint is in production since commit 080dd065. The acceptance tests show the application path
offline, with a fake WorkOS API and a renderer double, in both MCP protocol
eras. The onboarding acceptance cases also check the first callback, the
normal hosted default, and required slice configuration. The validation
record separates the completed manual behavior, including corrected shutdown
delivery, from the offline application and provider-contract results.

The decisions and the steps are in the [Auth WorkOS MCP URL fetch work slice plan](../../../../docs/implementation/auth-workos-mcp-url-fetch-plan.md).
The [work slice guide](../README.md) lists the slices.
