# MCP fetch debug OAuth upgrade plan

Status: **Implemented; final gates in progress**. Date: **2026-10-17**.

## Purpose and current behavior

Before this upgrade, [fetch-url.mjs](../../script/fetch-url.mjs) accepted a
supplied Bearer credential, connected through the pinned MCP client, called
`getURLAsMarkdown` with `{url, reason}`, and printed exact Markdown. It did not
sign in or refresh. The [original specification](mcp-fetch-debug.md) records
that boundary. The [script guide](../../script/README.md) describes current use.

Add browser OAuth preparation before the existing token-only MCP transport.
Initial public CLI support is only for `https://app.thermus.ai/mcp` and its fixed
issuer/client/resource tuple. Staging and local OAuth sites use controlled test
configuration, not a production endpoint override. Arbitrary `--endpoint`
values, including self-hosted servers, still need explicit Bearer input.
API keys, backend credential changes, and self-hosted OAuth are outside scope.

## Command behavior

Add `--login`, `--logout`, and `--non-interactive` to the existing options.
Add no token argument or login-timeout option.

1. `--api-key-stdin` reads stdin to EOF and replaces `THERMUS_API_KEY`.
2. Otherwise, a present `THERMUS_API_KEY` selects explicit Bearer mode.
3. Otherwise, hosted fetch uses a valid saved OAuth grant or refreshes it.
4. A missing grant starts browser authorization only when stdin and stderr are
   terminals and `--non-interactive` is absent. Redirected stdout remains valid.

Empty or invalid explicit input fails. Explicit mode has no OAuth, cache,
browser, or refresh side effect. Its existing deadline and endpoint checks stay.
Non-interactive OAuth can use or refresh saved credentials. If login is needed,
it fails with an instruction to run `--login` interactively.

`--login` always starts fresh browser authorization. It ignores the cache for
authentication and succeeds only after fresh authorization and a safe save.
It leaves the old record intact until atomic replacement, without claiming it
is still valid remotely. A failure after replacement follows the new-record
rules below.
It requires interactive mode. `--logout` removes the local grant or failure
marker under the same lock; it works without a terminal. It does not remove the
lock file, revoke remote authorization, end a browser session, or cancel a
running request that already holds a token. Say this in the local diagnostic.

Login/logout reject URL, reason, explicit credential input, and each other.
If `THERMUS_API_KEY` is present, give a useful instruction to unset it first.
Fetch still requires a URL and reason. Use:

```sh
pnpm exec node script/fetch-url.mjs --login
pnpm exec node script/fetch-url.mjs --url 'https://example.com/' --reason 'Inspect the page content'
pnpm exec node script/fetch-url.mjs --logout
```

Fetch success prints exact Markdown; controls print no stdout. Diagnostics
use sanitized local stderr. Failure exits with status 1 and no Markdown. Keep
current MCP protocol negotiation and result checks.

## First prerequisite: prove the public client contract

Use one Thermus-owned **first-party Connect OAuth application**, set to Public
with PKCE, without a client secret. The client ID is public configuration.
Fix issuer/client/resource together per deployment. Prove Staging before the
full cache; register production and ship its public ID before release.
No WorkOS platform API key or confidential secret belongs in this script.
Public discovery currently advertises CIMD support and no registration endpoint.
That is public metadata, not proof of privileged provider settings. This design
needs no CIMD route, DCR change, dynamic registration, or registration cache.

Request only `openid offline_access`. Pass the exact MCP resource on
authorization, code exchange, and refresh. Prove the first-party browser and
workspace authorization shape; do not promise a third-party consent screen.
Its token must pass the existing
[WorkOSAuthProvider](../../src/auth/hosted-auth/workos/workos-auth-provider.ts):
RS256; exact AuthKit issuer and MCP audience; usable `sub`, `sid`, `client_id`,
`scope`, `iat`, `exp`; `sub` different from `client_id`; and `org_id` for the
intended authorized workspace. Verify refresh and backend acceptance too.
Do not assume every public application supplies the same organization context.

Use the fixed callback `http://127.0.0.1:46481/callback`. This is the simplest
exact registration for this release, not an OAuth requirement. Prove a real
WorkOS redirect reaches this listener; fail if the port is busy. Do not silently
change ports or redirect URIs. Existing
[staging fixtures](../../test/support/hosted-live/staging-fixtures.ts) use
`isFirstParty: false` and an intercepted callback, so they do not prove this
first-party application or actual callback contract.

Device flow was considered: Connect supports it, but documentation/discovery
does not prove device resource/audience targeting for this application. Keep
one code+PKCE flow. See [device authorization](https://workos.com/docs/reference/workos-connect/cli-auth/authorize-device).

## Small OAuth implementation using the pinned SDK

Use `@modelcontextprotocol/client` **2.3.1** exports:
`discoverOAuthProtectedResourceMetadata`, `discoverAuthorizationServerMetadata`,
`startAuthorization`, `validateAuthorizationResponseIssuer`,
`exchangeAuthorization`, and `refreshAuthorization`.
Use SDK PKCE S256 and protocol encoding; own callback, deadlines, and token state.

Do not integrate `auth()`, `OAuthClientProvider`, or `finishAuth` into the MCP
transport. The high-level flow can log remote error messages, retry, or fall
back to a browser. An OAuth transport can step up scopes and repeat requests.
Prepare authentication first, then pass one immutable access token to the
existing token-only transport. No worker, console override, redaction framework,
or client-side JWT authorization module is needed. The backend remains the
identity and access authority. Discard unused ID tokens and profile data.

Discover complete protected-resource and authorization-server metadata before
authentication or refresh. Keep it only in memory. Require the configured
resource, advertised expected authorization server, and exact expected issuer.
Require the endpoints and PKCE S256 support needed for this flow; reject missing
metadata. Use no legacy discovery fallback or issuer-validation bypass.
Require HTTPS authorization and token endpoints on that issuer's origin, with
no embedded credentials or fragments. Reject network redirects and issuer or
resource changes. Discovery must not cause an arbitrary endpoint to receive
a credential.

Bind the callback listener to `127.0.0.1` before opening the browser on the
same machine. Accept only GET on the exact callback path, exactly one matching
random state, and exactly one nonempty `code` or `error`, never both parameters.
Reject duplicate relevant parameters, malformed values, and oversized requests.
Unrelated requests do not complete authorization. Validate state and use
`validateAuthorizationResponseIssuer` before handling a remote OAuth error;
report only a local diagnostic. Validate `iss` if supplied; require it only when
metadata advertises `authorization_response_iss_parameter_supported: true`.
Current live metadata does not advertise it. Pass received `iss` to
`exchangeAuthorization`, which checks it too, and use the original redirect URI
and PKCE verifier for exchange. Keep expected issuer/resource in memory. Clear
pending state after completion or cancellation.

Open the authorization URL with process arguments, never through a shell.
If browser launch fails, print the generated authorization URL on stderr for
manual opening. Return only local completion text to the callback browser.
Never log tokens, codes, verifiers, callback URLs, provider errors, or profile
data. Test the selected SDK helpers for unwanted diagnostics; do not route raw
SDK errors to console. The browser can stay open after cancellation.

## One private credential record and one lock

OAuth storage is a user-owned POSIX directory, mode 0700, files mode 0600,
outside the repository. Use an absolute `XDG_STATE_HOME` plus
`thermus/mcp-fetch/`, or `~/.local/state/thermus/mcp-fetch/` when unset.
Reject a relative configured path, unsafe ownership/modes, symlinks, and wrong
file types. Fail OAuth clearly on unsupported permissions or durable local
filesystem operations; explicit Bearer mode remains available. Credentials are
plaintext protected by these local permissions, not an encrypted vault.

Keep one versioned ready record containing the exact endpoint/issuer/client
binding, access token, optional refresh token, scope when supplied, and absolute
access `expiresAt`. Validate record version, shape, and exact binding on load.
Malformed records give a local recovery/login diagnostic, with no silent
fallback. No registration, discovery, PKCE, email/name, or profile is persisted.

Require token response `token_type` to equal Bearer, case-insensitively. Check
credential strings with the existing Bearer syntax and 65536-character maximum.
Require finite positive integer `expires_in`; derive conservative absolute
expiry from token request start, with a safe integer result in the supported
date range. Apply a 30-second refresh margin; never reset expiry on load or
infer it from an ID token. Unknown/invalid response expiry fails safely.
Without a refresh token, usable access serves until near expiry, then requires
explicit login. Do not infer refresh support or a 30-day OAuth lifetime.

Adapt the existing built-in `node:sqlite` separate lock-file
[`BEGIN IMMEDIATE` pattern](../../src/auth/local-auth/better-auth/data-directory-lock.ts)
inside the script cache module. Validate/create the private file safely before
SQLite opens it; load SQLite only in OAuth mode. Fail fast if busy. The OS
releases the lock when the process dies. Keep the stable lock inode, including
on logout. No PID file, stale-lock timer, or manual stale-lock protocol is needed.
Follow DRY3; add no shared lock framework or new dependency.

Hold the lock through read, authentication preparation, and durable save.
Release it before MCP uses its immutable token. Before any refresh POST,
atomically and durably replace ready credentials with a versioned
`login-required` marker for the same tuple, containing no old refresh token.
Keep the refresh token only in memory. Abort before sending if the marker cannot
be saved. Use private temporary files, file fsync, atomic replacement, and
directory sync on a supported local filesystem.

On refresh success, save the new ready record durably before using its access
token. The helper preserves the old refresh token if the response omits a new
one. Failures before ready replacement leave the marker. If replacement succeeds
but directory sync fails, or the process dies after replacement, disk can hold
the new ready record. The current failed run stops. The next run can use only a
fully validated new ready record; marker, corrupt, or ambiguous state requires
explicit `--login`, even interactively. Never restore or blindly replay
pre-refresh credentials. Atomic local writes cannot undo remote token rotation.
Discovery failure before the marker preserves the prior record. Fresh login
preserves that record until replacement succeeds. Add no rollback, recovery
journal, or background service.

## Deadlines, errors, and request safety

Use a fixed five-minute authentication budget. Each OAuth network request has
at most 10 seconds within that budget and no automatic retry. The existing
fetch timeout remains 60000 ms by default, range 100..300000. In OAuth mode it
starts after preparation and durable save. Explicit mode still includes stdin,
negotiation, and tool work in its original total deadline.

Refresh at most once before MCP. Never open a browser, refresh, or retry inside
a tool call. After MCP 401, fail with a login instruction. After 403, explain
workspace or access refusal; login is not guaranteed to repair it. A timeout,
lost response, or uncertain tool outcome must not repeat the call. Network or
provider errors give local sanitized diagnostics, not remote error text.

On success, errors, SIGINT, and SIGTERM, abort and settle owned pending
operations, including file writes, before releasing the lock. A timed-out write
must not overwrite a newer grant. Close listeners, MCP clients, timers, and
temporary files. Do not kill the user's browser. Refresh cancellation follows
the marker/new-record rules above; it never restores pre-refresh credentials.
Requests after local logout can finish with their previously acquired token.

## BDD evidence and implementation order

Write failing acceptance scenarios first through the actual command. Use
private test seams for the fixed hosted profile and TTY/browser boundary, or a
PTY. The existing spawn driver pipes stdin and stderr. Every process test must
set an absolute private `XDG_STATE_HOME`; clearing HOME is insufficient because
`os.homedir()` can resolve the real user. Add no production OAuth endpoint flags.
Local OAuth uses a private profile and TLS fixture/CA that preserve production
HTTPS validation. Do not disable TLS or weaken endpoint checks for tests.
Then use focused TDD for the behavior each scenario needs; refactor when green.

- Explicit stdin wins over present environment input, and invalid explicit
  input fails with no OAuth or cache activity.
- Missing credentials start one browser flow only interactively; `--login`
  always starts fresh, while cached fetch reuses a valid absolute expiry.
- Expired access refreshes once; rotation and an omitted replacement token
  produce the correct saved grant. Missing refresh credentials require login
  near expiry; invalid expiry fails and later loads never extend it.
- Failed or interrupted refresh before replacement leaves the marker. After
  replacement, only a fully validated new ready record can be used; ambiguous
  state requires login and never replays old credentials. Kill/reacquire proves
  OS locks.
- Concurrent commands fail fast at the lock. Local logout removes only the
  grant; fresh login replaces it only on success.
- Bad callback state/issuer or discovery/request resource binding, unsafe cache
  permissions, denied login, busy port, timeout, and cancellation fail safely
  and release owned resources.
- Non-interactive mode and local/custom endpoints do not start browser OAuth.
  MCP failures never retry the tool; stdout is exact and stderr omits secrets.

First prove the first-party provider contract with a minimal real script/browser
flow. Next add the small SDK preparation path with local doubles and helper
interface tests for state/resource binding and safe diagnostics. Then add cache,
absolute expiry, crash-marker, and concurrency cases. Finally prove the complete
script in Staging and run complete-candidate gates. Unit tests cover useful
local rules; do not copy a large behavior list into every test layer.

Expected changes: the script and README; small script OAuth/cache modules;
existing script unit/acceptance tests and focused helper interface tests;
protocol drivers/sites in `test/support/` per the
[test layout](../testing/test-code-layout.md); dedicated hosted-live script
coverage; and the test inventory/validation record. Keep architecture small.

## Provider proof and implementation gates

The real Staging proof must run the actual script, first-party Public+PKCE
client, real loopback HTTP callback, workspace authorization, backend MCP fetch,
expiry, refreshed-token acceptance, and repeat use. Verify remote authorization
removal separately from current membership removal. The JWT verifier does not
introspect consent: authorization removal can stop refresh while issued access
JWTs remain valid until expiry, subject to configured clock tolerance.
Membership/role removal is checked on each request. Local logout promises no
immediate remote revocation. Follow live fixture ownership and cleanup rules.

Follow the [test gate policy](test-gate-policy.md) with pinned Node 24.20.0.
Run focused changed tests before commits. `npm run build:hosted` includes
`npm run check` and the full integration glob equivalent to
`npm run test:integration`; record these nested results on the same complete
candidate and do not repeat passed runs without a change or unresolved failure.
Also run `habit-hooks` with empty snooze, `npm run test:acceptance`, focused
`test/interface/auth/workos.test.ts` after build, final Linux AMD64
`npm run test:container:hosted`, and `npm run test:hosted-live` when Staging is
available. `script/` is a hosted build input. Local-double or pattern passes do
not replace full hosted gates. Record unavailable, skipped, or zero-test runs
accurately, with candidate, commands, exit status, and counts.

## Provider configuration and evidence

Both dedicated Connect applications were created as first-party Public OAuth
clients. WorkOS read-back confirms no client secrets and exactly one default
callback: `http://127.0.0.1:46481/callback`. Existing application settings and
shared MFA policy were not changed.

| Environment | Application | Public client ID |
| --- | --- | --- |
| Staging | `app_01M561HD70Q2MCKKVM0J2SBDPY` | `client_01M561HD70DB58BEKMSF8GCAQN` |
| Production | `app_01M561NFVXQ7R0PJFPD3ZCPKDJ` | `client_01M561NFVWJDE1SQ4EFMKS38C6` |

The Staging prerequisite passed through a real browser and HTTP callback. Its
issuer was `https://reasonable-field-33-staging.authkit.app`; its resource was
`https://localhost:46443/mcp`. WorkOS returned the required user, client,
workspace, issuer, audience, and session claims, with `openid offline_access`.
Access lifetime was 300 seconds in this run. Refresh rotated the refresh token.
The hosted MCP composition accepted both access tokens. After membership
deactivation it returned 403 and did no protected work. This first proof used
fixed fetch output; it did not prove the renderer or the finished CLI.

The production tuple is the public client above, issuer
`https://spontaneous-mountain-26.authkit.app`, and resource
`https://app.thermus.ai/mcp`. Production configuration was read back; no user
authorization or fetch was run against production during setup.

The actual-script Staging proof also passed. It selected workspace B from two
memberships, fetched with the real pinned renderer, reused the saved grant, and
refreshed without a browser. Fresh login replaced the grant. Remote authorization
removal left the unexpired JWT usable but stopped refresh; the script kept a
login-required marker and recovered through fresh login. Local logout removed
the saved grant while leaving remote authorization and a copied JWT usable.
The test aged its private saved expiry to trigger refresh; it did not wait for
the WorkOS access token's natural expiry. Owned users, organizations, and private
state were removed after the test.

## Implementation review and validation

The implementation keeps command parsing and MCP transport in `fetch-url.mjs`.
OAuth preparation, browser callback/launcher ownership, and private storage each
have one module. A shared error class carries only local diagnostics. There is
no new dependency, backend authorization change, registration cache, or token
argument. The store also removes validated orphan temporary files under its
lock after an interrupted write.

Acceptance tests were written and observed failing before implementation.
The manager reviewed the CLI/OAuth, credential-store, and live-proof work and
signed off each part. All commands used pinned Node 24.20.0.

| Check | Result |
| --- | --- |
| Focused changed script, SDK interface, storage, and support-path tests | Exit 0; 140 passed; no failures, cancellations, skips, or todo cases. |
| `npm run build:hosted` | Exit 0. Includes `npm run check`: 2735 backend unit, 19 portal unit, 13 build, and 16 portal acceptance tests; then 459 integration, 120 hosted, and 9 real-renderer tests. All passed. |
| `npm run test:acceptance`, with the existing Axiom test settings supplied only to the child process | Exit 0; 412 backend and 16 portal tests passed; no failures, cancellations, skips, or todo cases. |
| `node --test dist/test/interface/auth/workos.test.js` | Exit 0; 38 passed; no failures, cancellations, skips, or todo cases. |
| Focused live FS-02 signup handoff after its guide assertion correction | Exit 0; both cases passed; no failures, cancellations, skips, or todo cases. |
| Dedicated Staging provider and actual-script proofs, final source rerun | Exit 0; 2 passed in 32.4 seconds; no failures, cancellations, skips, or todo cases. |
| `habit-hooks` | Exit 1; 28 reviewed findings retained with reasons below. Snooze remains `[]`. |

The first acceptance run failed only because the worktree lacked the Axiom
ingest settings. The complete rerun above used the existing test settings from
the main checkout without copying its environment file or printing secrets.
The first complete hosted live run passed 78 of 79 cases. The one failure waited
for instruction text removed by the earlier agent-picker change. The corrected
test checks the default agent, selects Codex, and checks its endpoint command and
current consent text. Its session, workspace, Connect token, and real MCP fetch
checks remain. The focused rerun passed; the complete rerun is pending.

Retained style findings: the four exported token, discovery, callback, and
launcher functions support narrow security-boundary tests. Production calls
them internally; the exported names are used by tests. Keeping them with their
lifecycle owner avoids extra single-use modules. Two file-size findings cover
the cohesive credential transaction and its storage/crash specification; the
200-line threshold is not a useful split point. Twenty existing comments explain
source/emitted paths, test layout, and the shared callback port that requires
the signup suite to run last; they remain applicable. The store's one flat
credential-admission guard
keeps an explained complexity exception so its validation rule stays together.

Sources checked **2026-10-17**: [Connect OAuth](https://workos.com/docs/authkit/connect/oauth),
[WorkOS MCP](https://workos.com/docs/authkit/mcp),
[Connect tokens](https://workos.com/docs/reference/workos-connect/token),
[RFC 8252](https://www.rfc-editor.org/rfc/rfc8252), and the locally pinned
SDK 2.3.1 helper contracts.
