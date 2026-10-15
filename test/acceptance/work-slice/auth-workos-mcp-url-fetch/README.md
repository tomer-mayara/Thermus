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

The initial setup ran on 2026-10-14 in the Staging environment
`environment_01M4VDKATD5PXZT4H01EHCMR2A`, with the WorkOS connector:

- Google sign-in is on, with the built-in Google credentials of WorkOS. The
  Google consent screen shows the WorkOS name.
- Dynamic Client Registration (DCR) and Client ID Metadata Documents (CIMD)
  are on, so that Claude Code registers itself at AuthKit.
- The organization "Thermus work slice" is
  `org_01M4YYEQ6V2ZBM3RQEEV8CKFEA`, with the external ID `thermus-work-slice`.
  The launcher sets this organization as the slice onboarding target. It needs
  no verified WorkOS organization domain and no change to the default role.

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
   any AuthKit challenge. The server uses the trusted WorkOS result to enroll
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
   keeps its own token for the MCP resource. The pinned scopes give the token the `scope` claim,
   which the server requires. `offline_access` gives a refresh token, so the
   access token of 300 seconds renews without a new sign-in.
6. Start a new Claude Code session with the same `NODE_EXTRA_CA_CERTS`, and
   ask: "Use the thermus-hosted tool getURLAsMarkdown to read
   https://example.com/ and tell me its title." Check that the authenticated
   request uses the real HTTPS MCP endpoint, the pinned renderer fetches the
   page, the client receives Markdown, and Axiom shows the three lines of the
   same call, as below. Do not copy keys, tokens, cookies, or authorization
   codes into output or pull request notes.
7. Check the validation. A request with a wrong Bearer token gets `401` with
   the metadata challenge. After the owner removes the role `user`, the next
   tool call gets `403 access_denied` and writes no fetch line. Sign in with
   Google again and verify that the role stays removed. Then the owner gives
   the role back and deletes the authorized application of the
   user in WorkOS. The token works until it expires, after at most 300
   seconds. Then the refresh fails.
8. Stop with Ctrl+C. Remove the client entry with
   `claude mcp remove thermus-hosted`.

A Google sign-in gives no MFA evidence. Thus the members and invitations pages
of the portal refuse that session. The portal access and MCP need no MFA
evidence.

## Slice onboarding policy

Only this opt-in slice enables onboarding. The normal hosted application has
no enrollment policy and keeps the `member` default role without product
access. This change enables no production onboarding and sets no WorkOS
organization domain or default User role.

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

## Proof still required

Keep PR #108 in Draft until the browser-first live walk and the complete
required gates pass on the final candidate. The [validation record](../../../../docs/implementation/auth-workos-mcp-url-fetch-validation.md)
gives the completed checks, retained findings, and open proof. Offline tests use a WorkOS fake,
a renderer double, and a recording logger. They prove application behavior.
The real walk must separately prove Google authentication, Connect browser
consent and its token, the authenticated HTTPS MCP fetch, real renderer output,
Axiom delivery, wrong-token refusal, and refusal after a current User-role
removal. Record safe observations and test counts without secrets. A WorkOS
configuration read-back or an offline pass is not this live proof.

## Log lines

The connection to WorkOS writes one line at the start:
`Hosted authentication uses WorkOS: the client <client ID> and the AuthKit issuer <issuer>.`
The start writes `Listening on https://localhost:46443/` when the HTTPS front
listens, and the stop writes `Stopping after <signal>`. One tool call writes three log
lines in this sequence:

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
`composeWorkOSApplication`, `createFetchOperation`, and `fetchToolServers` with
the test-only HTTPS front `LocalHttpsSite`. The onboarding policy, fetch tool
behind the hosted MCP endpoint, and two lines with the full URL and the
Markdown are slice-only. The acceptance tests show the application path
offline, with a fake WorkOS API and a renderer double, in both MCP protocol
eras. The onboarding acceptance cases also check the first callback, the
normal hosted default, and required slice configuration. The manual run must
also show Google sign-in, client registration and consent, the renderer, and
the export to Axiom; it remains pending until recorded.

The decisions and the steps are in the [Auth WorkOS MCP URL fetch work slice plan](../../../../docs/implementation/auth-workos-mcp-url-fetch-plan.md).
The [work slice guide](../README.md) lists the slices.
