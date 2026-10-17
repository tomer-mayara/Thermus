# Notes

- Record the stated reason without scoring it or comparing it with page content.
- Block/step up large files (or requests)
- Step
- Looks into AI caching support

# Tests

## MCP fetch debug command

`test/unit/script/fetch-url.test.ts` checks CLI input, help, credential input,
and the stdin deadline. `test/acceptance/script/fetch-url.test.ts` runs the actual
script against an MCP SDK server through the production HTTP bridge. It checks
exact and empty Markdown, the `getURLAsMarkdown` arguments, environment and stdin
credentials, modern JSON and SSE, legacy negotiation, refused authentication,
HTTP failures, failed and unexpected tool results, invalid protocol data,
connection failures, redirects, and cancellation of hung requests. All use local
fake credentials and need no live provider or renderer.

```sh
npm run build && node --test dist/test/unit/script/fetch-url.test.js dist/test/acceptance/script/fetch-url.test.js
```

See [the script guide](../../script/README.md) for use and the current hosted
authentication limit.

## Free hosted signup (FS-01)

The [FS-01 record](../implementation/fs-01.md) keeps the complete-candidate
results. The original FS-01 cases use test document text. FS-04 adds the
production document proofs below.

- Unit: `test/unit/auth-workos/workos-signup*.test.ts` covers current verified
  identity, acceptance metadata in the initial create, one User grant, concurrency,
  unknown writes, restart, revocation, strict form fields, and frozen documents.
  Current-user read tests distinguish a deleted user (404) from provider failures
  (401, 403, 429, and 503) during inspection and activation.
- Integration: `test/integration/auth/workos-signup-routes.test.ts` covers HTTP
  responses, cookies, request limits, and cancellation;
  `test/integration/auth/workos-connection.test.ts` checks the real production
  SDK connection's retry and timeout settings with a local transport double.
- Acceptance: `test/acceptance/auth/hosted-workos-signup.test.ts` drives the
  composed application through HTTP with the WorkOS API fake.
  `serveWorkOSSite()` of `test/support/in-process/workos-site.ts` starts it
  with the signup fake. It checks closed signup, the notice and agreement,
  personal User access, revoked access, existing roles, and fresh email
  verification. Deleted-user GET and POST offer fresh sign-in with the full
  notice and no activation writes. Signed-out old forms return 401 with a usable
  sign-in link. A fresh sign-in can activate for its new subject. Current-user
  outages remain 503.
- Interface: `test/interface/auth/workos-signup.test.ts` checks single-attempt
  writes after provider faults. `test/interface/auth/workos-signup.live.ts`
  checks concurrent creation and acceptance metadata in disposable Staging
  organizations. Only `npm run test:interface:workos-signup` selects the live file.

### Approved production documents (FS-04)

The [FS-04 record](../implementation/fs-04.md) tracks the complete candidate.
Signup remains off by default. The source-owned bundle preserves the exact
FS-03 bytes and versions under the separate owner implementation approval.
The frozen private manifest keeps its historical review status.

[V] Real production startup with signup omitted keeps GET, HEAD, and old POST closed, sends no policy bytes, and makes no provider request
[V] Real production startup with signup enabled only in a test shows the complete notice before sign-in, the complete terms and notice after sign-in, and the exact unchecked agreement; byte hashes and lengths match the frozen source, and acceptance retains its version IDs and hashes
[V] Corrupt approved terms or notice bytes and hashes fail composition before any provider request
[V] Literal policy markup remains escaped text before and after sign-in; scoped wrapping CSS has its exact CSP hash, scripts remain denied, and the form remains same-origin

Focused command after a clean build:

```sh
node --test dist/test/acceptance/auth/hosted-workos-signup.test.js dist/test/integration/auth/workos-signup-routes.test.js dist/test/unit/auth-workos/workos-signup-documents.test.js
```

### Portal and MCP handoff (FS-02)

The [FS-02 record](../implementation/fs-02.md) keeps its validation results.

- Unit inspection cases cover existing access without another agreement,
  retained records, other workspaces, failures, and cancellation with no writes.
  Cleanup tests limit personal-record recovery to fixture-owned users.
- Signup route integration and composed acceptance cover Continue, the portal
  return path, retained-record support, cookies, and provider failures.
- Portal acceptance covers free access, the configured MCP endpoint, native
  client steps, and separate browser workspace selection. Account guidance
  acceptance keeps signup closed while offering signup, invitation, and support
  paths. MCP acceptance keeps 401/403/500 behavior and proves guidance never
  grants access or runs a denied tool.
- The hosted live gate adds two Staging cases. They use a TEST ONLY agreement,
  a real browser, Connect PKCE, and an MCP SDK client. They check new activation,
  exact acceptance fields, User-only access, the actual token workspace,
  browser-B/token-A isolation, revoked A refusal, and continued B access.
  The SDK uses the gate's loopback HTTP listener behind its HTTPS front.
  The fetched public reference page is `https://example.com/`.
  Pending and retained-without-membership cases remain offline proofs.

### Signup close and reopen (FS-05)

`test/acceptance/auth/hosted-signup-restart.test.ts` uses test documents and
the local WorkOS API fake. It closes the listener and application, then starts
new application instances with the same provider state and browser cookie.
The case checks that closed signup refuses the original form without a provider
request while existing browser and MCP access still work. After another stop
and membership revocation, reopened signup requires support, keeps the retained
marker, and cannot replay the grant. The personal workspace stays denied while
another authorized workspace remains usable through the browser and MCP.
This is local acceptance coverage. It does not open production signup or replace
the separately authorized deployed checks in [FS-05](../implementation/fs-05.md).

Focused command after a clean build:

```sh
node --test dist/test/acceptance/auth/hosted-signup-restart.test.js
```

## Unit

**MCP Server**

[V] Connects to the MCP server and runs server/discover; advertises protocol 2026-07-28 and the thermus identity (`test/unit/mcp/discovery.test.ts`)
[V] Lists `getURLAsMarkdown(url, reason)` with the same strict schema used for validation (`test/unit/mcp/fetch-tool-schema.test.ts`, `fetch-tool-server.test.ts`)
[V] Checks string types, required fields, extra properties, URL semantics, reason whitespace, and code-point limits including supplementary characters; accepted inputs are not truncated (`fetch-tool-schema.test.ts`)
[V] Uses operation and logger doubles to check exact projected text, safe argument errors, safe unknown-tool errors, and one completion attempt per dispatched call (`fetch-tool-server.test.ts`)
[V] Keeps operation errors and logger failures from exposing causes, replacing results, or repeating work (`fetch-tool-server.test.ts`)
[V] Formats canonical authority, subject, and tenant fields; removes URL userinfo, query, and fragment; includes only a valid bounded reason or field-status codes; escapes line breaks and omits unknown tool names, raw arguments, credentials, and causes (`test/unit/mcp/tool-completion-record.test.ts`)
[V] Cancels owned work and waits for its cleanup; repeated close calls share one result (`test/unit/mcp/lifetime.test.ts`)
[V] Removes completed tasks from active work, preserves cleanup errors, waits for in-progress authentication, and refuses work after shutdown (`test/unit/mcp/lifetime.test.ts`)
[V] Returns the HTTP response of a cancelled modern call before its owned cleanup ends; close still waits for that cleanup (`test/unit/mcp/request-lifetime-isolation.test.ts`)
[V] Keeps request context and cancellation separate between connections (P02 unit and HTTP acceptance cases below)
[V] Supplies production rules and runtime dependencies to the self-hosted server (P03 unit, integration, and acceptance cases below)
[] Lists `postURLAsMarkdown(url, params, reason)` with its URL input schema (deferred)

Dispatch unit tests double the operation and logger. Real permission checks and
operation/pipeline collaboration belong to integration tests below. HTTP
acceptance uses the real MCP client and bridge with supplied dependencies.

**MCP request context binding** (`test/unit/mcp/request-context-binding.test.ts`)

The SDK middleware runs with verifier and access resolver doubles. Shared auth
records are type-only imports; these cases execute no shared-auth behavior.

[V] Supplies the verified user and tenant context to the tool handler; request headers and tool arguments cannot replace that context, and the OAuth client ID is never a user or tenant (`test/unit/mcp/request-context-binding.test.ts`)
[V] Keeps user and tenant context separate for sequential and concurrent requests, including resolutions that finish in reverse order, a slow request body, and overlapping tool handlers (`test/unit/mcp/request-context-binding.test.ts`)
[V] Binds a frozen copy of the decided context; later changes to the resolver's records cannot reach the request (`test/unit/mcp/request-context-binding.test.ts`)
[V] Keeps reverse-bound contexts and lifetime signals separate; one request abort leaves its peer active, and shutdown awaits both held cleanups (`test/unit/mcp/request-lifetime-isolation.test.ts`)

**Access context** (`test/unit/auth/access-context.test.ts`)

[V] Combines the explicit permissions of every independent grant; no highest-role check replaces the complete grant set
[V] Gives a Super Admin grant alone no product access; no role inherits the permissions of another role
[V] Keeps every grant and the same permission set for any grant order, and lists a shared permission once
[V] Denies every permission check when the context has no grants
[V] Stops work with a safe `AccessDeniedError` (`Access denied`, reason `permission-required`); repeated checks change nothing
[V] Copies only the contract fields, freezes the context and its collections, and ignores later changes to the input records
[V] Omits the organization for an installation user and refuses a context without a tenant ID

**Deployment configuration** (`test/unit/config/deployment-config.test.ts`)

[V] Returns the self-hosted and hosted records with the exact MCP resource and metadata URLs for root and sub-path base URLs
[V] Accepts only `self-hosted` or `hosted` in `DEPLOYMENT`; no other setting selects or changes the edition, and `AUTH_MODE`, mock, and paid-feature settings have no effect
[V] Reads only the settings of the selected edition from the supplied record and ignores `process.env`; the hosted edition reads only `DEPLOYMENT` and `PUBLIC_BASE_URL`, also when every `WORKOS_*` setting has a value
[V] Gives the same hosted record without WorkOS settings and with valid, invalid, or empty `WORKOS_*` values; no WorkOS value turns on a provider or access
[V] Rejects a missing, relative, padded, non-HTTPS, credential, query, or fragment URL; allows HTTP only for a self-hosted loopback host; WorkOS values do not change these rejections
[V] Rejects a missing or relative `DATA_DIR`
[V] Rejects hosted stdio, also with WorkOS settings, and accepts self-hosted stdio at this layer
[V] Names the setting and the rule in each error, without a setting value or a WorkOS value; returns frozen records
[V] Uses listen host `127.0.0.1` and port 8080 when `LISTEN_HOST` and `LISTEN_PORT` are missing or empty; returns a frozen address for valid hosts and ports from 0 to 65535
[V] Rejects a `LISTEN_PORT` that is not a whole number from 0 to 65535 and a `LISTEN_HOST` with spaces or control characters, without the value in the message; reads only `LISTEN_HOST` and `LISTEN_PORT`
[V] `loadPublicUrls()` makes the public base, MCP resource, and metadata URLs from `PUBLIC_BASE_URL` for each edition; it requires the setting, applies the HTTPS rule of the edition, gives a frozen record, and reads no `process.env`

**Ad rules file** (`test/unit/config/ad-rules-file.test.ts`)

Only the server reads `AD_RULES_FILE`. A file-read double stands in for `readFileSync` where a test needs a read failure or a read count.

[V] Rejects a missing or empty `AD_RULES_FILE` with the required-setting message, and a relative path (`ad-rules.txt`, `./`, `../`, or `~/`) without its value
[V] Reports `ENOENT` for a missing file, `EISDIR` for a directory, `EACCES` for a permission failure, and `unknown error` for a read error without a string code; keeps the cause and shows no path
[V] Rejects invalid UTF-8 without the path or the contents and keeps the decoder error as the cause
[V] Returns the exact text of an empty file, a comment-only file, CRLF lines with a blank line and a supplementary character, and a line that is not rule syntax; removes a UTF-8 byte order mark at the start
[V] Reads the path one time for each load; a later load gets the changed text
[V] Reads only `AD_RULES_FILE` from the supplied record and ignores `process.env`

```sh
npm run build && node --test dist/test/unit/config/ad-rules-file.test.js
```

**Local authentication migrations** (`test/unit/auth-better-auth/local-auth-migrations.test.ts`)

These tests run the pinned Better Auth packages with an in-memory `node:sqlite` database and the production provider settings.

[V] The shipped `0001-better-auth.sql` is the exact `compileMigrations()` output for the pinned provider settings on an empty database
[V] After the shipped migrations, Better Auth plans no table, column, or index change, and its schema check passes
[V] The installation table holds one identity: a second row or another singleton value fails; three accounts can still be added

**HTTP bridge** (`test/unit/http/server-requests.test.ts`, `server-responses.test.ts`, `server-lifecycle.test.ts`, `server-close.test.ts`, `server-close-request-body.test.ts`)

These tests run `startHttpServer()` on a loopback port with test handlers. Raw socket requests check request targets that `fetch` would change.

[V] Listens on the configured host and a free port and reports the real address, with an IPv6 host in brackets; rejects a port in use and keeps no server; stops listening when the address cannot become a URL
[V] Gives the handler the public origin with the path and query of the target; the `Host` and forwarded headers cannot change it
[V] Refuses the absolute form, `*`, `//`, `\`, and `#` targets with 400 and `TRACE` with 501, without a handler call
[V] Replaces every client copy of `x-thermus-client-address` with the socket address and keeps all other headers
[V] Streams a large JSON request body to the handler; a request body that the handler does not read does not block the next request on the connection
[V] Cancels body consumption without losing an early refusal response or the next keep-alive request; a disconnected partial body rejects its reader
[V] Returns the status, status text, headers, separate `Set-Cookie` headers, and body; streams events as they arrive, follows client back-pressure, and sends no body for `HEAD`
[V] Answers a handler that throws or rejects with a generic 500 and a log line without request data; ends the connection when a streamed body fails
[V] Aborts the request signal and cancels the response body when the client disconnects
[V] `close()` ends idle connections at once, refuses new connections, lets running responses finish, ends a response that never ends after the grace period, and gives the same result for repeated calls
[V] `close()` ends a connection that has sent no bytes at once, also the unused connection that a fetch client opens after it aborts a streamed response that the handler leaves open
[V] After a response finishes, `close()` ends its connection as soon as Node has read the complete request: unread 600 B, 64 KiB, and 1 MiB bodies, a 1 MiB body that the handler reads, and a request without a body close before the grace period when the handler answers after close starts; a client that still sends an unread body keeps its connection until it sends the rest, also when the response finished before close
[V] Creates and clears the close deadline once; repeated failed closes retain the same error
[V] Startup failure after listen closes the listener once and preserves both startup and cleanup errors

**HTML escape of the product pages** (`test/unit/html/html-escape.test.ts`)

The three escapes of the WorkOS notice pages, the bundled local pages, and the account pages were the same table and the same regex. `escapeHtml()` in `src/html/html-escape.ts` is the one copy. The test browsers decode the same five entities.

[V] Escapes each of the five characters `&`, `<`, `>`, `"`, and `'` to its entity: `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;`
[V] Escapes several characters in one text and keeps the other text
[V] Escapes an entity again: `&lt;` gives `&amp;lt;`. The escape does not look for entities, so each caller escapes a value one time only
[V] Keeps plain text unchanged, also text with a slash, a backtick, an equals sign, or a non-ASCII character such as `é` or an emoji
[V] Gives the empty string for the empty string
[V] Escapes a text with all five characters so that `decodeHtml()` of the test browsers gives the input again

Run the focused test:

```sh
npm run build && node --test dist/test/unit/html/html-escape.test.js
```

**Application lifecycle** (`test/unit/application-lifecycle.test.ts`)

MCP and provider resources are public collaborator doubles; listener drain is a
controlled promise. Real listener/provider order is integration coverage below.

[V] Starts MCP cleanup while listener drain is pending and waits for both before closing providers
[V] Shares cleanup across concurrent and later close calls
[V] Closes each resource once and preserves MCP, listener, and provider cleanup errors

**Stop-signal wait** (`test/unit/stop-signal.test.ts`)

Since 2026-10-15, `src/index.ts` exports `stopSignal()`. An `EventEmitter` is the double for process signals. This helper removes its handlers on the first signal. The auth WorkOS MCP URL fetch slice now uses its own stop wait below so repeated forwarded signals cannot interrupt its later cleanup. The production entry and `test/integration/server-stop-signals.test.ts` keep their existing contract.

[V] Given a double for the process signals, the wait registers `SIGINT` and `SIGTERM`; when it gets `SIGTERM`, it gives `SIGTERM` and removes both listeners
[V] Given a wait that is disposed before any signal, a later signal finds no listener, and the wait gives nothing

```sh
npm run build && node --test dist/test/unit/stop-signal.test.js
```

**Work slice stop wait** (`test/unit/test-support/stop-signal.test.ts`)

Three source cases passed in the reviewed 20-case shutdown focus. An
`EventEmitter` replaces process signals at the public helper interface. The
slice installs `test/support/processes/stop-signal.ts` before asynchronous
startup and keeps its signal handlers until the site closes and logging flushes.

[V] Captures a startup signal and retains both handlers until disposal
[V] Keeps the first signal when repeated SIGINT and SIGTERM arrive during cleanup
[V] Disposes twice after failed startup without removing another owner's handler or resolving a stop result

```sh
npm run build && node --test dist/test/unit/test-support/stop-signal.test.js
```

**Better Auth runtime lifecycle** (`test/unit/auth-better-auth/better-auth-runtime.test.ts`)

Doubles stand in for the data-directory lock, the local installation, and the provider at their public interfaces.

[V] Locks the data directory, opens the installation, starts the provider with the installation ID, secret, and database, and reports tenant `local:<installation-id>`
[V] A lock failure opens nothing; an installation failure releases the lock; a provider failure closes the installation and then releases the lock; each original error reaches the caller
[V] When a cleanup step also fails, the remaining cleanup still runs and the caller gets both errors in a `SuppressedError`
[V] `close()` closes the installation and then releases the lock one time, also for repeated and concurrent calls; a close failure still releases the lock and reaches the caller
[V] Loads a resource-server client only for the configured MCP resource, keeps its secret private, and updates the stored client through the installation interface

**Local provider options** (`test/unit/auth-better-auth/local-provider-options.test.ts`)

The tests set process environment variables and restore them at the end of each test.

[V] Use the installation secret, turn telemetry off, and set `advanced.disableOriginCheck` to `false`
[V] Keep public authentication rate limits, exempt only private token introspection, and use the bundled authorization error page for root and prefixed public URLs
[V] Enable the provider's signed public-client metadata lookup for the internal consent page
[V] Throw `ProviderEnvironmentError` when `BETTER_AUTH_SECRETS`, `BETTER_AUTH_TRUSTED_ORIGINS`, or `BETTER_AUTH_TELEMETRY` has a value; the message names the variable but not its value
[V] Build without an error for empty values of those variables, `NODE_ENV=test`, `TEST=1`, and a telemetry endpoint without `BETTER_AUTH_TELEMETRY`

**Data-directory lock** (`test/unit/auth-better-auth/data-directory-lock.test.ts`)

[V] A second lock from the same process or from another process fails with `DataDirectoryInUseError` until the holder releases it or ends, also after `SIGKILL`
[V] A lock that another process holds fails at once, in less than one second; the lock does not wait for its holder
[V] Three processes that lock one fresh directory at the same time: exactly one gets the lock, and each other process gets `DataDirectoryInUseError`, in each of 50 rounds
[V] A second release does nothing; the lock leaves only `data-directory.lock` in the directory
[V] A missing directory or a regular file in its place fails with `DataDirectoryUnavailableError` and creates nothing

**Local installation** (`test/unit/auth-better-auth/local-installation.test.ts`)

[V] A fresh data directory gets one installation UUID, a generated secret, and the migrated database; `auth.sqlite` and `auth.secret` have mode `0600`
[V] A second open keeps the identity and secret; two fresh directories get different identities and secrets; a second close does nothing
[V] Retained data with a deleted, dropped, or invalid installation identity, or with provider tables only, fails closed with a restore message and changes no data
[V] Retained data without `auth.secret`, with an invalid secret, or with another schema version fails closed, writes no new secret, and puts no secret in the message
[V] A secret and an empty database from an interrupted first start give a new installation identity with that secret
[V] Writes and reloads the resource-server client with mode `0600`; rejects malformed client files without exposing their content

**Bundled authentication pages** (`test/unit/auth-better-auth/local-auth-pages*.test.ts`)

A provider-handler double records the adapted requests and supplies responses. The real-provider behavior is covered by the browser acceptance suite.

[V] Serves only sign-in, consent, and authorization-error pages with escaped text, no external assets, and restrictive response headers
[V] Reads the client name through the provider's signed-query check and the account through its session handler before displaying consent
[V] Forwards the original browser cookie, origin, fetch metadata, trusted client address, and abort signal for authentication posts; the signed public metadata read omits the cookie
[V] Preserves successful redirects and each session cookie; maps provider refusals and failures to safe page text without repeating passwords or provider messages
[V] Rejects invalid methods, content types, oversized forms and queries, and ambiguous form fields; cancels an oversized or aborted body before calling the provider

Run the focused page tests:

```sh
npm run build && node --test dist/test/unit/auth-better-auth/local-auth-pages*.test.js
```

**Local user administration** (`test/unit/auth-better-auth/local-user-administration.test.ts`, `local-user-administration-revocation.test.ts`, `local-user-administration-clients.test.ts`)

A stateful double stands in for the supported Better Auth operations. Its password hash contains the password, so a test that finds no password in the output also finds no hash there.

[V] Adds an enabled account with the email in lower case through the provider's create operation, which hashes the password
[V] Refuses an email that an account already has, in any letter case, before it asks for a password
[V] Refuses a password with fewer than 8 or more than 128 characters, with the limits in the message; accepts 8 and 128 characters
[V] Gives an invalid-email error that does not repeat the email
[V] Lists each account with only its ID, email, and disabled state, in email order; pages through more than one provider page of 100 rows
[V] Resets only the password of the target with the provider hash and deletes only the sessions of the target; the ID and the state stay, also for a disabled account; the peer keeps its password and sessions
[V] Refuses an unknown email and an account without a password login before the prompt, and a password outside the length rule after it; nothing changes
[V] Disables only the target without a ban expiry and deletes only its sessions; a second disable ends its sessions again; an unknown email changes nothing
[V] Registers a public native client with the approved metadata through a new session of the selected enabled account, deletes only that session, and keeps the browser session of the account
[V] Refuses an unknown or disabled account before the prompt, a wrong password, a ban at sign-in, an empty or control-character name, and each redirect URI outside the loopback `http` form, without the URI in the message
[V] Gives approved loopback redirect URIs to the provider exactly as written
[V] Deletes the registration session also when the client creation fails; reports a cleanup failure, and both failures together
[V] Creates the confidential introspection client during native-client registration when needed, and keeps its secret out of command output

**Local administration opener** (`test/unit/auth-better-auth/local-administration-opener.test.ts`)

The runtime opener double supplies provider operations and records cleanup. The
concrete administration opener exposes only the command role and close function.

[V] Returns the five-operation administration role and transfers cleanup to the caller
[V] Reuses the runtime close promise and outcome on repeated close calls
[V] Closes opened resources if construction fails before ownership transfers, and preserves the primary and cleanup errors
[V] Passes through an opening failure that already contains a cleanup failure

Run only these tests:

```sh
npm run build && node --test dist/test/unit/auth-better-auth/local-administration-opener.test.js
```

**Hidden line input** (`test/unit/terminal/hidden-line-input.test.ts`)

`PassThrough` streams stand in for a pipe and for a terminal with `isTTY` and `setRawMode`.

[V] Gives each piped line in order, also when two lines arrive in one chunk, without `\r\n` endings; gives a last line without a line ending; gives `undefined` after the input ends
[V] Writes each prompt and a line break to the prompt stream, and never the line text
[V] Reads a typed terminal line with raw mode on only during the read; no stream gets the typed text; two reads in a row work
[V] Gives `undefined` for Ctrl-C and Ctrl-D, and for input that ended before the read; rejects with the input error of a failed pipe or terminal, with raw mode off
[V] Adds no listener to the input before the first read; `close()` can run two times and ends the reading of a pipe that stays open

**Operator log lines** (`test/unit/application-operator-log.test.ts`)

A logger double records the lines that `operatorFailureReporter()`, `accountFailureReporter()`, and `accountChangeRecorder()` write.

[V] Gives each MCPServer failure report to the operator as one error line that names the failed step and keeps the cause, also for a cause that is not an error; writes no info line
[V] Gives each account failure report to the operator as one error line with the path and the cause, also for a cause that is not an error
[V] Writes each privileged change record to the operator log as one info line, `Account change record: <JSON>`; a line break in a value stays inside the JSON, so each record stays on one line

Run only these tests:

```sh
npm run build && node --test dist/test/unit/application-operator-log.test.js
```

**Application routing** (`test/unit/application.test.ts`)

[V] Routes the complete request to MCP, provider-owned discovery and OAuth endpoints, or bundled pages under the configured public path
[V] Refuses private provider routes, the hosted organization and onboarding paths, unrelated paths, and near-matching path suffixes without calling a route owner
[V] Hosted routing: sends the MCP resource and both protected-resource metadata paths to the MCP handler and each other path under the configured public path to the account routes, with the complete request; paths outside the public path give 404 without a handler call
[V] Hosted routing: the browser routes of the provider (sign-in, callback, sign-out, and session) answer before the account routes, and every other path keeps its owner

**Hosted account routes** (`test/unit/hosted-admin/account-routes.test.ts`)

`BrowserSessionDouble` gives a configured session state for each `Cookie` header value. `SignedInSessionDouble` gives a signed-in session with its form token, its MFA evidence (completed by default), its cookie effects, and a configured answer to an organization switch. `AccessResolverSpy` gives configured decisions, a test-only operation double records each call and gives a configured answer, and the failure reporter records each report. The tests import the access contracts as types only. The other `account-routes-*.test.ts` files below use the same fixtures.

[V] Gives the browser session only the `Cookie` header of the request; gives the operation the original request, with its body unread, and the decided context of a signed-in session with allowed access, and returns the operation answer
[V] Keeps the context of each request when two users of different organizations overlap and their access resolutions finish in reverse order
[V] Gives the operation a frozen copy of the decided context; later changes to the resolver's records, such as another organization or added grants, cannot reach it
[V] For a signed-out session, gives 401 with the cookie effects of the session to account, organization, and billing requests, also with forged cookies, bearer tokens, organization IDs, and form input; reads no body, and runs no access resolution, organization read, organization switch, or operation
[V] Gives 403 without the reason for each denial reason and runs no operation
[V] Gives 404 after allowed access when no operation exists
[V] Gives a session lookup failure to the caller and runs no access resolution, operation, or report
[V] Sends each notice page as fixed HTML without a form, script, or other resource, with `Cache-Control: no-store`, a Content Security Policy that allows nothing, `nosniff`, and `X-Frame-Options: DENY`

**Hosted account route failures and cookie effects** (`test/unit/hosted-admin/account-routes-effects.test.ts`)

[V] Refuses an allowed decision without a tenant ID before the operation with the 500 failure page, and gives the operator a report with the path and the cause
[V] For a failed access lookup or operation after a sign-in that refreshed the session, gives the 500 failure page with the refreshed session cookie, and gives the operator the path and the cause
[V] For operation answers that cannot carry the session cookies, an error response and an answer whose body was already read, gives the 500 failure page with the session cookies, and gives the operator the cause (a `RangeError` and a `TypeError`)
[V] For a failed operation of a request that the client aborted, gives the failure to the caller and no report to the operator
[V] Gives the operation answer, also a redirect whose headers cannot change, with its status, headers, and body, and with the session cookies before its own cookies
[V] Gives the session cookie effects, in their order, with the 401, 403, and 404 refusal pages
[V] Under a public URL path, the 403 page of a denial links to the organization page under that path

**Hosted organization page** (`test/unit/hosted-admin/account-routes-organization-page.test.ts`)

This file and the two selection files below also use `fixtures/organization-routes-fixtures.ts`: `serveAnn()`, the session and switch cookies, the form token, and the selection post. `OrganizationAdministrationDouble` gives the configured authorized organizations of each user subject, or a configured failure, and records each list and each selection check. `SignedInSessionDouble` records each organization switch and gives a configured switch answer or failure. `formsIn()` from `test/support/drivers/browser/hosted-browser.ts` reads the forms of a page.

[V] For a GET and a HEAD request, lists each authorized organization of a signed-in user with a selection form that posts the form token of the session, the organization ID, and the return destination; marks the selected organization; sends the session cookies, `form-action 'self'`, and the other page headers, and no script, style, or other resource; runs no access resolution or operation
[V] Shows organization names and IDs with HTML characters as text
[V] For a public URL with and without a final slash, and without a return destination, each form posts to the selection route under the public path and returns to the organization page there
[V] Without an authorized organization, gives the guidance to accept an invitation or to contact the operator, with the session cookies and without a form, also with forged organization values; resolves no tenant access
[V] Under a public URL without a final slash, gives 400 with the session cookies and lists no organization for a return destination that is an absolute URL, a URL without a scheme, a path with a backslash, a relative path, a path outside the public path, or a path that only starts like it (`/teamevil/` for `/team`), or that has dot segments (also encoded), a query, a fragment, a control character, or a space; also for an empty value, a very long path, and two values
[V] Gives 405 with `Allow: GET, HEAD` and the session cookies to POST, PUT, and DELETE requests for the organization page, and lists no organization
[V] For a failed organization list, gives the 500 failure page with the session cookies, and gives the operator the path and the cause

**Selection input checks** (`test/unit/hosted-admin/account-routes-selection-input.test.ts`)

Each refusal comes before an organization check and a session switch.

[V] Gives 403 with the session cookies to a post from a foreign origin, a `null` origin, another scheme, another port, or without an origin, and does not read its body
[V] Gives 403 with the session cookies to a post without a form token, with an empty or a longer token, with the token of another session, or with two tokens; the token check comes first, so a wrong token with an unknown field also gets 403; refuses an empty token also when the form token of the session is empty
[V] Gives 400 with the session cookies to a post with no, an empty, two, or a very long organization ID, an ID with a space or a control character, no or two return destinations, an absolute, another-host, or dot-segment destination, an organization name, or an unknown field
[V] Gives 415 to JSON and multipart form data, and 413 to a post larger than 16 KiB, with and without a `Content-Length`
[V] When the client disconnects while the body is read, stops the reading and cancels the body, gives the failure to the caller, and checks, switches, or reports nothing

**Organization selection** (`test/unit/hosted-admin/account-routes-selection.test.ts`)

[V] Switches the session to an authorized organization for a same-origin post with the form token of the session, also with a forged `X-Organization-Id` header; gives 303 to the destination with `Cache-Control: no-store`, an empty body, and the session cookies before the switch cookies; runs no access resolution
[V] Under a public URL path, redirects to the destination under that path on the public origin
[V] Gives 403 with the session cookies and no switch when the service refuses an organization of another user or an inactive or unknown organization, also with forged organization values in the query and headers
[V] Gives 403 for a `refused` switch and 401 for a `signed-out` switch, with the session cookies and then the switch cookies, and no redirect
[V] Gives the 500 failure page with the session cookies and no redirect for a failed organization check or switch, and gives the operator the path and the cause
[V] Gives 405 with `Allow: POST` to GET and PUT requests for the selection route
[V] For a signed-out session, gives 401 to the organization page and to a selection post with the form token of another session, and lists, checks, or switches no organization

**Member and invitation pages** (`test/unit/hosted-admin/account-routes-administration-pages.test.ts`)

This file and the two files below also use `fixtures/administration-routes-fixtures.ts`. `serveAdministration()` serves the routes for Ann: a signed-in session with a refreshed session cookie, a form token, and MFA evidence, and allowed access to Acme with User and Admin. The fixtures also give member and invitation overviews and one valid post for each change. `OrganizationAdministrationDouble` gives the configured overview, refusal, change result, or failure, and records each call with its actor and its request. A setup can give a session whose sign-in did not complete MFA, a session without a form token, another access decision, or another public URL. `formsIn()` from `test/support/drivers/browser/hosted-browser.ts` reads the forms of a page.

[V] For a GET and a HEAD request with forged organization values in the query and headers, gives the service the user of the decided context with the MFA evidence of the session and the organization of the context; the members page shows the seat count, each member with its status and roles, a link to the invitations page, and one form for each change with the form token, the organization, the membership, its revision, the role, and the action; sends the session cookies and the page headers with `form-action 'self'`, and no script, style, or other resource
[V] For each identity policy, the invitations page has a send form with an email field for each role that the actor can invite, a resend and a revoke form for each pending invitation of a role of the actor, each invitation with its role and state, a link to the members page, and the policy text of the directory
[V] The invitations page says that the acceptance of a pending invitation gives the role that the page shows, and that for an accepted, revoked, or expired invitation the sign-in service can show the current role of the member instead
[V] For an unknown identity policy, the invitations page claims no strict address match
[V] Shows provider values with HTML characters as text on both pages: email addresses, roles, IDs, revisions, and the organization
[V] Without an invitation, the invitations page says "There are no invitations." and still offers a send form for each invitable role
[V] For a session whose sign-in did not complete MFA, gives the service that evidence, and each page gets the 403 MFA notice with the session cookies and no form
[V] When the service denies the actor, each page gets 403 with a link to the organization page and the session cookies
[V] When the access resolver denies access, each page gets 403 before the service runs
[V] Gives 405 with `Allow: GET, HEAD` and the session cookies to POST, PUT, and DELETE requests for both pages, and does not ask the service
[V] For a failed overview, each page gets the 500 failure page with the session cookies, and the operator gets the path and the cause
[V] Under a public URL path, each form posts under that path, and each link points under it
[V] For a decided context without an organization, each page gets the 403 access denial, and the service is not asked

Run only these tests:

```sh
npm run build && node --test dist/test/unit/hosted-admin/account-routes-administration-pages.test.js
```

**Grant and invitation changes** (`test/unit/hosted-admin/account-routes-administration-changes.test.ts`)

[V] For a valid grant, invitation, resend, and revoke post, also with a forged `X-Organization-Id` header, and an `applied` or `unchanged` answer, gives the service the actor with the MFA evidence of the session and no form token or cookie; the browser gets 303 to the members or invitations page with `Cache-Control: no-store`, an empty body, and the session cookies
[V] For a session whose sign-in did not complete MFA, gives the service that evidence, and each post gets the 403 MFA notice with the session cookies
[V] Gives each change exactly the fields of its form
[V] Gives each post 403 for `denied` and `mfa-required`, 409 for `stale`, `not-pending`, and `address-in-use`, and 503 for `unsupported`, each with its notice, the session cookies, and no redirect
[V] Gives forged roles and actions to the service unchanged, also Super Admin, an account disable, a membership deactivation, a credential reset, and a Super Admin invitation; the denial of the service gives 403
[V] For a change that fails in the service, gives the 500 failure page with the session cookies and no redirect, and gives the operator the path and the cause
[V] Gives 401 to a change post of a signed-out session and 403 when the resolver denies access, before any form check; does not ask the service

Run only these tests:

```sh
npm run build && node --test dist/test/unit/hosted-admin/account-routes-administration-changes.test.js
```

**Change input checks** (`test/unit/hosted-admin/account-routes-administration-input.test.ts`)

Each refusal comes before a call of the service.

[V] Gives 403 with the session cookies to change posts from a foreign origin, a `null` origin, another scheme, or without an origin, and does not read the body
[V] Gives 403 with the session cookies to change posts without a form token, with an empty or a longer token, or with the token of another session, also with an unknown field
[V] Gives 403 to change posts with two form tokens and to each post of a session without a form token
[V] For each change, gives 400 with the session cookies to a post with a missing, repeated, or empty field, a value with a space or with 257 characters, or an unknown field
[V] Gives 400 to an invitation with an address without an `@`, with two, with a space or a line break, with an empty part, or with more than 254 characters
[V] Gives 409 with the out-of-date notice and the session cookies to change posts for another organization than the one of the session
[V] Gives 415 to JSON and 413 to a change post larger than 16 KiB, with the session cookies
[V] Gives 405 with `Allow: POST` and the session cookies to GET and PUT requests for each change route

Run only these tests:

```sh
npm run build && node --test dist/test/unit/hosted-admin/account-routes-administration-input.test.js
```

**Organization administration** (`test/unit/organizations/organization-administration.test.ts`)

`OrganizationDirectoryDouble` gives the configured memberships of each user subject, or a configured failure, and records each membership read. A test can change the memberships between calls, as the provider state changes. The change recorder fails the test on each record, because a list or a selection check keeps no change record. The tests import the access contracts as types only.

[V] Gives an empty list for a user without a membership, so the user gets the onboarding guidance and no default organization
[V] Lists only active memberships whose grants give at least one application permission, in directory order; an inactive membership, a role without an application permission, and a membership without a grant are not listed
[V] Marks only an authorized organization that the session selected; a selected inactive membership, a role without an application permission, an organization without a membership, and no selection mark nothing
[V] Reads the current memberships for each list; an earlier list is frozen and does not change
[V] Gives an authorized organization for selection from the current directory read of the session user
[V] Refuses a selection of an inactive membership, a role without an application permission, a membership without a grant, an organization of another user, an unknown organization, an empty ID, or an ID in another letter case
[V] Refuses a selection of a membership that became inactive after the list
[V] Gives a failed directory read to the caller unchanged, for a list and for a selection check

**Grant authority** (`test/unit/organizations/organization-administration-grants.test.ts`)

This file and the five files below use `fixtures/administration-fixtures.ts`. It gives the memberships of two organizations: in Acme, members with Super Admin alone, all three roles, User plus Admin, Admin alone, User alone, and only the default role, an inactive member, and a pending member; in Globex, User memberships of two of these users and a member with User plus Admin. `invitationsWith()` adds a pending, an accepted, a revoked, and an expired User invitation and a pending Admin invitation in Acme, and a pending User invitation in Globex. Each actor completed MFA unless a test says otherwise, and its session selected Globex, so that only the organization of the request can decide. The service gets a fixed clock and a recorder that keeps each change record; `recordLines()` checks that each record is frozen and has only the fields of the contract. `OrganizationDirectoryDouble`, in `test/support/doubles/organizations/organization-directory-double.ts`, is a stateful double of the whole `OrganizationDirectory` contract: a change takes effect in the later reads, each grant change needs the current revision of the membership, and an acceptance activates only the role of the invitation. A test can lay out the pages of each read, make a page fail, queue a result or a failure (before or after the effect) for the next change, hold the changes to run them at the same time, and accept or expire an invitation as the provider does. `test/support/doubles/organizations/change-answers.ts` keeps the queued answers and the held changes, and `test/support/doubles/organizations/directory-double-records.ts` the seeds and the record helpers of the double. Each invitation of the double has a token, as a provider record has it, so that a test can show that no token reaches an overview or a record. The double records each read and change. The tests import the access contracts as types only.

[V] Super Admin alone grants Admin to itself and then, with that Admin authority, User to itself, without another person; a User grant before the Admin grant is denied, and each request is recorded
[V] Denies each grant and revoke for the actor itself and for other members, with no directory change and one record for each request: User changes by Super Admin alone, Admin changes by Admin alone, User and Admin changes by User alone, and Super Admin changes by a member with all three roles and by Admin alone
[V] A member with Admin and Super Admin grants Admin to one member and User to a member with only the default role, with each authority; the directory changes only the requested role
[V] A Super Admin revokes Admin from a User plus Admin member, and an Admin revokes User from another member; each removal removes only its role, and the grants of the other organization stay
[V] An Admin with User revokes its own User grant; only that grant goes, and its Admin authority still works for the next change
[V] A member with all three roles revokes its own Admin grant; its next User change is denied, and its retained Super Admin authority grants Admin to itself again
[V] The revoke of the last application grant leaves the membership active with only the default role, which gives no permission; the organization list of the member then has only its other organization

Run only these tests:

```sh
npm run build && node --test dist/test/unit/organizations/organization-administration-grants.test.js
```

**Grant targets and checks** (`test/unit/organizations/organization-administration-targets.test.ts`)

[V] Denies, before the target is read, an Admin request to revoke Admin or Super Admin, to deactivate, disable, reset the credentials of, or remove a member, to grant the default role, or with an empty role or action or a role and action in capital letters; no grant changes, and the record keeps the requested action
[V] Denies a change of a target membership of another organization, an unknown, inactive, or pending target, and a change by an actor with no membership, only User, or an inactive membership in the organization of the request; no grant changes, and the record says `denied`
[V] After a Super Admin revokes the Admin grant of an Admin, the current read denies the next change of that Admin
[V] Requires MFA for an actor whose sign-in did not complete it, also for a member with all three roles, before any read; no grant changes, and each record says `mfa-required`
[V] Gives `unchanged` with no directory change for a grant of a role that the target has and a revoke of a role that it lacks
[V] Gives the directory one change of one role with the revision that the actor saw; the record has only the time of the clock, the actor authority and subject, the organization, the target membership, the action, the role, and the outcome

Run only these tests:

```sh
npm run build && node --test dist/test/unit/organizations/organization-administration-targets.test.js
```

**Safe grant changes** (`test/unit/organizations/organization-administration-changes.test.ts`)

[V] Gives `stale` with no directory change for a request with an older revision of the target, and records it
[V] A retry of an applied grant after another actor revoked it is `stale` and never restores the revoked access
[V] Two actors change the same membership at the same time from the same revision: one change is `applied` and the other `stale`, so the grant that the second actor wanted to revoke stays
[V] A directory change that fails after or before its effect reaches the caller and is recorded as `unknown`; a retry of the same request is then `stale` and changes nothing again, or is applied one time
[V] Gives the `unsupported` or `stale` answer of the directory to the caller and records it; the service makes no second attempt and no change of its own
[V] Fails and records `unknown` for a directory change without a result, with an unknown result, or with a result without an outcome
[V] Gives a failed membership or target read to the caller before any change; the record says `failed`, and the directory changes nothing

Run only these tests:

```sh
npm run build && node --test dist/test/unit/organizations/organization-administration-changes.test.js
```

**Members and the User seat summary** (`test/unit/organizations/organization-administration-members.test.ts`)

[V] Reads each member page of the organization with the explicit statuses `active`, `inactive`, and `pending` and follows the cursors; lists each member with its status and the roles that give an application permission; counts each active membership with User once
[V] Each active member offers only the changes of the roles that the actor manages: User for an Admin, Admin for a Super Admin, and both for a member with both; a missing role gives a grant and a present role a revoke; inactive and pending members offer no change
[V] Lists and counts a membership that two pages repeat one time; the record of the later page decides, also for a changed status
[V] Counts no seat for members with only Admin, only Super Admin, or only the default role, and for inactive or pending members with User
[V] Gives a page failure after earlier pages to the caller, with no partial count
[V] Fails for a cursor that the directory gave before and for a page that names itself as the next page, instead of reading pages without end
[V] Fails after 1,000 pages when each page gives a new cursor
[V] Neither lists nor counts a page record of another organization
[V] Refuses the overview with `denied` for a User without Admin or Super Admin, an Admin of another organization, and an Admin with an inactive membership, and with `mfa-required` for an Admin whose sign-in did not complete MFA; reads no member page and keeps no record
[V] Gives a frozen overview: the overview, its members, their roles and changes, and each change

Run only these tests:

```sh
npm run build && node --test dist/test/unit/organizations/organization-administration-members.test.js
```

**Invitation changes** (`test/unit/organizations/organization-administration-invitations.test.ts`)

[V] An Admin invites only User, a Super Admin only Admin, and a member with both each of them; each sent invitation names only its own role; no customer invites Super Admin or the default role, and each refusal is recorded
[V] Refuses a User invitation by a User without Admin or an Admin of another organization with `denied`, and by an Admin whose sign-in did not complete MFA with `mfa-required`; nothing is sent, and the refusal is recorded
[V] Gives `unsupported` when the directory cannot send an invitation safely; a send that fails reaches the caller and is recorded as `unknown`
[V] Gives `address-in-use` when the directory refuses the address of an invitation, because it belongs to a member or has a pending invitation for another role, and records that outcome
[V] An Admin resends and then revokes a pending User invitation, each one time; a second resend or revoke gives `not-pending` without a directory change; each record has the role of the invitation
[V] Refuses a resend and a revoke with `not-pending` for an accepted or expired invitation, and with `denied` for an Admin invitation by an Admin, a User invitation by a Super Admin alone, an invitation of another organization, an unknown invitation, and an invitation by a User without Admin; the directory changes nothing, and each request is recorded
[V] When the invited person accepts after the service read the invitation as pending, the `not-pending` answer of the directory to the revoke reaches the caller, and the acceptance stays
[V] Sends nothing and gives `unchanged` while an invitation to the same address for the same role is pending, also for a retry after an unknown outcome and for the address in other letter case; sends an invitation for another role, and a new invitation after a revoke; the check reads only the explicit state `pending`, and each request is recorded
[V] The denied record of a revoke of an invitation of another organization names no role; the denied record of an invitation of the organization keeps its role

Run only these tests:

```sh
npm run build && node --test dist/test/unit/organizations/organization-administration-invitations.test.js
```

**Invitation overview** (`test/unit/organizations/organization-administration-invitation-overview.test.ts`)

[V] Reads the invitation pages with the explicit states `pending`, `accepted`, `revoked`, and `expired`; lists each invitation of the organization one time with its role and state, also when two pages repeat it; offers a resend and a revoke only for a pending invitation of a role that the actor manages; gives the invitable roles and the identity policy of the directory; copies no invitation token; the overview is frozen
[V] A Super Admin alone can invite and change only Admin, and a member with both roles both; the overview gives the `provider-rules` policy of the directory
[V] Gives a failed invitation page to the caller, and does not list a record of another organization
[V] Refuses the invitation overview with `denied` for a User without Admin or Super Admin and with `mfa-required` for an Admin whose sign-in did not complete MFA; reads no invitation page

Run only these tests:

```sh
npm run build && node --test dist/test/unit/organizations/organization-administration-invitation-overview.test.js
```

**Hosted MCP endpoint and metadata** (`test/unit/mcp/protected-resource-endpoint.test.ts`)

AUTH-06 removed `UnavailableMcpEndpoint` and its unit test. A double stands in for the MCP server.

[V] Gives the RFC 9728 document with the MCP resource and the AuthKit issuer as its one authorization server at the root metadata path and at the path of the resource, without a call to the MCP server
[V] Answers HEAD with 200, the JSON content type, and no body
[V] Answers another method on a metadata path with 405 and `Allow: GET, HEAD`, without a read of the body or a call to the MCP server
[V] Gives each MCP request and each request of another path unchanged to the MCP server
[V] Closes the MCP server when it closes, and refuses an authorization server without https when it is made

**WorkOS settings** (`test/unit/auth-workos/workos-settings.test.ts`)

[V] Gives the five WorkOS settings exactly as written in a frozen record
[V] Names each missing or empty setting in one error, without a value
[V] Refuses a key without `sk_`, a client ID without `client_`, an issuer that is not an https origin or has a path or a final slash, a redirect URI on another origin, outside the public path, with a query or a fragment, or not in its parsed form, and a cookie password shorter than 32 characters; each message names the setting and the rule but not the value
[V] Derives the authority `workos:<client ID>` and the browser issuer only from the client ID

**Sealed session cookies** (`test/unit/auth-workos/session-cookies.test.ts`)

[V] Seals the session envelope in a `__Host-` cookie with a versioned value, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and a `Max-Age` of 30 days, and the sign-in envelope in a `__Host-` cookie of 10 minutes; each opens to the same content, and each seal has its own random IV
[V] Clears each cookie with an empty value, the same attributes, and `Max-Age=0`
[V] Gives no content, and does not throw, for another cookie password, any changed character, a non-canonical text, a value of the other cookie, a value that is not an envelope, and an authentic seal of another shape
[V] Finds the session cookie among other cookies; two cookies with its name give no content, and a cookie whose name only starts with its name is not it
[V] Keeps the Set-Cookie value below 4,096 bytes with a 2,500-character WorkOS seal
[V] Compares two secrets in constant time; another length or an empty secret is never equal

**WorkOS browser session** (`test/unit/auth-workos/workos-browser-session.test.ts`, `workos-browser-session-refresh.test.ts`, `workos-browser-session-sign-in.test.ts`, and `workos-browser-session-end.test.ts`)

A narrow double of the SDK part (`test/unit/auth-workos/fixtures/workos-session-client-double.ts`) gives scripted checks, refreshes, and exchanges.

[V] Without the session cookie, the session is signed out without a cookie change and without a WorkOS call; a cookie that does not open is signed out with the cleared cookie
[V] A seal whose access token verifies is signed in as the WorkOS user in the environment authority, with the organization of the session, the profile, the CSRF token, and the MFA evidence, without a cookie change
[V] `invalid_session_cookie`, `no_session_cookie_provided`, and a damaged seal (`InvalidCharacterError`, `Invalid expiration`) sign out with the cleared cookie and run no refresh; a key-set outage or another SDK error rejects without a refresh, so the cookie stays
[V] `invalid_jwt` and `ERR_JWKS_NO_MATCHING_KEY` give one refresh in the organization of the session, with one new cookie that keeps the CSRF token and the MFA evidence
[V] A terminal refresh refusal signs out with the cleared cookie; a retryable refresh failure or a thrown SDK error rejects, so a recoverable session is not erased
[V] An organization switch refreshes the newest seal into the organization and sends one new cookie; a 4xx refusal changes no cookie; a refresh into another organization is refused but keeps the new seal; an ended session signs out; an outage rejects
[V] A sign-in start makes the AuthKit URL with PKCE for the redirect URI and the client ID, and a sign-in cookie with the state, the verifier, the return path, and a 10-minute expiry
[V] A callback with the same state exchanges the code with the verifier, clears the sign-in cookie, and sets a session cookie with a new CSRF token; only a `Password` sign-in under explicit Required policy gives MFA evidence; two sign-ins get two CSRF tokens
[V] A missing, unopenable, or expired sign-in cookie, an AuthKit error, a missing, empty, or repeated code or state, and another state refuse the sign-in with the cleared sign-in cookie and no exchange; a 4xx refusal of the code is `code-refused`; another exchange failure rejects
[V] The end of a session gives the WorkOS logout URL of the `sid` in the seal, also after the access token expired, and the cleared cookie; without a usable seal, it gives only the cleared cookie; the logout route reads the CSRF token without a WorkOS call

**WorkOS session MFA evidence policy** (`test/unit/auth-workos/workos-browser-session-mfa.test.ts`)

These six unit cases use the session-client double to isolate the WorkOS session package. All six passed in the final candidate check.

[V] The default unproven mode gives a new Password session no MFA evidence
[V] Explicit unproven mode gives Password and Google callback cookies false evidence
[V] Reading a prior true cookie masks its evidence and preserves identity and CSRF
[V] Refresh and organization selection keep both session and replacement-cookie evidence false

```sh
npm run build && node --test dist/test/unit/auth-workos/workos-browser-session-mfa.test.js
```

**WorkOS callback onboarding seam** (`test/unit/auth-workos/workos-sign-in-onboarding.test.ts`)

The two source and compiled cases passed on 2026-10-15; the final complete-candidate gates also passed. These unit specifications use the session-client double and an onboarding policy double. They keep the policy call after the trusted code exchange and before the browser cookie. They do not use real WorkOS.

[V] Given an opt-in policy and a trusted Google exchange, the policy receives the exchange before its returned seal enters the cookie, and the cookie has no MFA evidence
[V] Given an exchange without a sealed session, sign-in fails before onboarding can create a grant

```sh
npm run build && node --test dist/test/unit/auth-workos/workos-sign-in-onboarding.test.js
```

**WorkOS session routes** (`test/unit/auth-workos/workos-session-routes.test.ts`, `workos-session-routes-sign-in.test.ts`, and `workos-session-routes-logout.test.ts`)

A double of the browser session records each call (`test/unit/auth-workos/fixtures/session-routes-fixtures.ts`).

[V] Takes only the sign-in, callback, sign-out, and session paths of the public base URL, with or without its final slash; another path gets 404
[V] The session path gives 200 JSON with the email, the name, the organization, the MFA evidence, and the CSRF token, or 401 `{"signedIn":false}`, each with the cookie effects of the session; absent values are left out; POST gets 405 JSON
[V] The sign-in path starts a sign-in that returns to the base path or to one valid return path of at most 1,024 path characters, and sends the browser to AuthKit with the sign-in cookie; an invalid or repeated return path gets 400; POST gets 405
[V] A completed callback goes to the return path on the public origin with the cleared sign-in cookie and the session cookie; a refused callback gets the 400 page with an escaped link to the sign-in path; a stored return path that is not a page of this service goes to the base path; POST gets 405
[V] The sign-out with the session token from the public origin ends the session and goes to the WorkOS logout URL with the cleared cookie; without a usable session it goes to the base URL; another token gets 403 and ends nothing
[V] The sign-out checks the method (405), the origin before the body (403, also without `Origin` or with `null`), the content type (415), the 16 KiB limit with and without `Content-Length` (413), a client abort, and exactly one CSRF token and no other field (400)
[V] A failure of the session check, the sign-in start, the callback, or the sign-out gives a 500 page, or 500 JSON for the session path, without a cookie change, and one operator report; an aborted request gets no report

**WorkOS grant reads** (`test/unit/auth-workos/workos-organizations.test.ts`)

A double of the narrow SDK part records each read. Each call of organization administration fails the test, so access resolution reads no member, invitation, or organization and writes no role.

[V] Gives one frozen grant for each role of the active membership, in the order of the membership, with its application permissions, after one exact membership read with the status `active` and one role read
[V] Keeps each role an independent grant, without a highest role, and gives the default role a grant without a permission
[V] Gives undefined without an active membership, without a role read, and reads WorkOS again for each call
[V] Keeps only application permissions and accepts the mapped permissions in any order
[V] Refuses a membership without a role list, a membership role that the organization does not have, a mapped role with other application permissions, a missing mapped role, and another role with an application permission, with a `HostedRoleConfigurationError` that names the role and the rule
[V] Refuses an answer with more than one membership, a next page, or a membership of another user, organization, or status, and gives each failed WorkOS read to the caller

**WorkOS organization memberships** (`test/unit/auth-workos/workos-organizations-memberships.test.ts`)

AUTH-07W added these tests. A double of the narrow SDK part gives the page of each `after` cursor and records each read. Each call of organization administration fails the test. AUTH-08W removed the tests of the member and invitation methods before AUTH-08W; the three files below test these methods now.

[V] Gives one frozen active membership for each organization, with the WorkOS organization name and the grants of the hosted role mapping, after one read of the user with the explicit status `active` and the limit 100, and one role read for each organization
[V] Reads each page with the `after` cursor of the page before and stops at the page without a cursor
[V] Gives a frozen empty list and no role read without an active membership; gives a user of another authority, also with the same subject, no membership and sends WorkOS no read
[V] Gives a membership with only the default role one grant without a permission, keeps only application permissions, and reads WorkOS again for each call
[V] Fails, without a membership, a grant, or a role read, for an inactive or pending membership, a membership of another user, a membership without an organization name, two active memberships in one organization, a repeated page cursor, and more than 10 pages, where it stops after the tenth read; no error names the user
[V] Refuses a membership without a role list, a default role with `product:access`, and a membership role that the organization does not have, with a `HostedRoleConfigurationError` that names the organization and the rule; gives each failed membership or role read to the caller

**WorkOS member reads** (`test/unit/auth-workos/workos-organizations-members.test.ts`)

AUTH-08W added this file and the two files below. They share `WorkOSOrganizationsDouble`, in `fixtures/workos-organizations-double.ts`: a double of the SDK client of the directory that answers from the records of a test, records each call in order, and changes the roles and the update time of a membership at a role write, as WorkOS does. Its organization reads give Acme the external ID `customer-acme`, as each customer organization of the operator runbook has one, and give Globex none. Its invitations have a token and a link, so that a test can show that no result holds them. A failed call that is not a configuration error must name no user ID, address, or invitation credential.

[V] Reads one member page with exactly the named statuses, the limit 100, and the cursor, then one role read of the organization and one user read for each member, in page order; gives a frozen page with the email, status, grants, and revision of each member and the WorkOS cursor as `next`
[V] Starts the user read of a member only after the user read of the member before it answered
[V] Gives a membership with only the default role one grant without a permission; gives the last page, with the cursor `null` or empty, no `next`; gives an empty page without a role or user read
[V] Fails before any WorkOS call for a read without a status, and without a role or user read for a membership of another organization or of a status that the read did not name
[V] Refuses a membership without a role list with a `HostedRoleConfigurationError` that names the organization and the rule; gives each failed membership, role, or user read to the caller
[V] Reads one member by its ID in any organization, with one membership read, one role read of its organization, and one user read; a WorkOS 404 of the membership gives `undefined` without another read; an answer with another ID fails; each other failure, also a 404 of the user read, reaches the caller
[V] Gives one state of a membership the same revision by ID, on a page, and with its roles in another order; a later update time, another status, or one role less or more gives another revision

Run only these tests:

```sh
npm run build && node --test dist/test/unit/auth-workos/workos-organizations-members.test.js
```

**WorkOS grant changes** (`test/unit/auth-workos/workos-organizations-grants.test.ts`)

[V] Grants Admin in Acme with one membership read, one read of Acme, and then exactly one `assignRole()` of `admin` on the organization resource, named by the external ID of Acme (`resourceTypeSlug: 'organization'` and `customer-acme` as `resourceExternalId`); User stays, and the result is a frozen `applied`
[V] Revokes User in Globex, which has no external ID, with one read of Globex, the organization of the current membership, and one `removeRole()` that names the resource by the organization ID of Globex; Admin stays; the revoke of the only role makes one `removeRole()` and no replacement of the role set or membership change
[V] Gives `stale` without an organization read or a write for a WorkOS 404 of the membership and for a membership that another administrator changed after the actor saw it
[V] Gives `unsupported` without an organization read or a write for a grant and a revoke on an inactive membership, a pending membership, and an active membership that a directory connection manages
[V] A repeated grant with the revision from before it and a grant of User with the revision from before its revoke are `stale` after only a membership read, without a second write, so a repeated post never repeats a write or returns a revoked grant
[V] Gives a failed `assignRole()` or `removeRole()` to the caller after the one write, without a repeat; gives a failed membership read (500 or 400) to the caller without a write; fails without a write for an answer with another ID and for a membership without a role list
[V] Gives a failed read of the organization of the membership (503 or 404) to the caller without a write; fails without a write when WorkOS answers that read with another organization

Run only these tests:

```sh
npm run build && node --test dist/test/unit/auth-workos/workos-organizations-grants.test.js
```

**WorkOS invitations** (`test/unit/auth-workos/workos-organizations-invitations.test.ts`)

[V] Reads one invitation page of the organization with the limit 100 and the cursor, and keeps only the named states; each frozen record has only the ID, the organization, the address, the role, and the state, and no token or link; each state stays as WorkOS gives it, and an accepted invitation keeps its role
[V] Counts a pending invitation whose expiry time is at or before the clock time as `expired`, and asks the clock again for each read
[V] Gives the last page, with the cursor `null` or empty, no `next`, and reads an empty page without a cursor; fails before any WorkOS call for a read without a state
[V] Fails for an invitation of another organization or without an organization, also in a state that the read does not name, for a record without a role in a named state, and for a pending invitation without a valid expiry time; leaves a record without a role in a state that the read does not name out of the page; gives a failed read to the caller
[V] Reads one invitation by its ID in any organization; a passed expiry time gives `expired`; a WorkOS 404 and an invitation without an organization give `undefined`; an answer with another ID and an organization invitation without a role fail; a 500 or a 400 reaches the caller
[V] Sends one invitation with exactly the address, the organization, and the one role; the answer must be a pending invitation of that organization and role to the same address in any letter case, else the send fails; 400 `email_already_invited_to_organization` and `user_already_organization_member` give a frozen `address-in-use`; 400 `invalid_role`, the member code with 422, a 500, and a send without an answer reach the caller
[V] Resends or revokes a pending invitation with one call, and the answer must be that invitation in the state after the change (`pending` or `revoked`), else the change fails; a 400 refusal gives a frozen `not-pending` after one read when the invitation is accepted, revoked, expired, or pending after its expiry time, and the original error when it is still pending or the read gives 404; a 500 or a 404 of the change reaches the caller without a read
[V] Gives the invitation identity policy `provider-rules`

Run only these tests:

```sh
npm run build && node --test dist/test/unit/auth-workos/workos-organizations-invitations.test.js
```

**Operator runbook driver** (`test/unit/auth-workos/operator-runbook.test.ts`)

The ticket `9255ad59-3484-43bd-bdf5-e6e391e07bd6` added these tests of the test-support driver of the [operator runbook](../implementation/hosted-organization-setup.md), `test/support/hosted-live/operator-runbook.ts`. A stateful double of the narrow SDK part (`test/unit/auth-workos/fixtures/runbook-client-double.ts`) keeps one membership, records each write, and can add a change of another person or a failure at a write. The hosted live gate proves the WorkOS side.

[V] A grant to an active membership with User and Admin sends one role assignment of `super-admin` on the organization resource with the external ID of the organization, and no other write; the record is `applied` with the roles before and after
[V] A revocation sends one removal of `super-admin` on the same resource and no other write; the other role stays, and without another role the default role counts as `applied`
[V] A customer change of another role at the same time as the operator write still gives `applied` for the grant and for the revocation, and the record keeps the current roles
[V] A grant without a membership creates it with only `super-admin`
[V] An inactive or pending membership stops the grant, the revocation, and the inspection after an unknown outcome without a write; a grant in place and an absent grant for a revocation give `unchanged` without a write
[V] A membership that someone deactivates during the grant, or a grant that someone removes at once, gives `unknown`
[V] A grant write that fails before or after its effect gives `unknown` and no second write; the inspection after it gives `applied` for a grant in place and `stopped` for an absent grant
[V] An organization without an external ID stops the grant and the revocation before a write

**Billing** (`test/unit/billing/billing-free.test.ts`)

`BillingFree` is the only `Billing` implementation until the owner chooses a payment provider. No paid billing test exists yet; the [AUTH-11 specification](../design/billing-design.md#auth-11-implementation-specification) lists the planned tests.

[V] Rejects an empty or missing organization ID with a `TypeError` from `stateOf` and `updateSeats`
[V] Rejects a seat count that is negative, fractional, NaN, infinite, or above `Number.MAX_SAFE_INTEGER` with a `RangeError`
[V] Refuses input with a rejected promise, never a synchronous throw; a refused call confirms no state
[V] Accepts 0 seats and `Number.MAX_SAFE_INTEGER` seats and confirms the free plan with no billed seat
[V] Gives frozen state records that keep the free state

**Audit Trail**

[] Support OTLP protocol
[] Generate a user token we can use in audit trail

**Console logger** (`test/unit/logging/console-logger.test.ts`)

[V] Writes one line to stderr by default or to a supplied writable stream
[V] Includes the timestamp, level label, level color, message, and final newline
[V] Includes the caller file and line, including filenames with parentheses and files beside the logging directory
[V] Starts at INFO by default and applies each constructor threshold from DEBUG through NONE
[V] Applies threshold changes, hides all levels at NONE, and resumes when the threshold is lowered
[V] Writes the message of an `Error`, a string as it is, and the text of another value, such as a number or a plain object, from `error()` and `fatal()` after the caller file and line
[V] Writes both messages of a `SuppressedError` from `error()` and `fatal()`: first the failure, then the cleanup failure; also for a nested `SuppressedError`
[V] Gives the same text from `BaseLogger.messageOf()`, for a caller that composes a longer line

**OTel logger** ([test contract and commands](otel-logger.md))

[V] Preserves the log methods, default INFO level, thresholds, and caller location of `BaseLogger`
[V] Maps each accepted level to an OpenTelemetry severity and preserves the message body
[V] Exports OTLP log records through the SDK to a loopback receiver with the Axiom headers
[V] Sends acceptance and interface log records to Axiom's `system-log-test` dataset on every run and checks the exporter result
[V] Sends one additional test log to `system-log-test` through the separate live interface command

**Renderer network policy**

[V] Rejects blocked IPv4 and IPv6 ranges, obfuscated loopback addresses, mixed DNS answers, and failed DNS before renderer launch
[V] Accepts public addresses and checks every DNS answer again on each fetch
[V] Passes the native network policy and disables proxy environment settings on every renderer launch
[V] Rejects URL-supplied flags and unsupported schemes; fails when Lightpanda is missing or cannot apply the required policy

**Clean HTML Ads**

[V] Removes documented ad targets, honors element-hiding exceptions, and leaves HTML unchanged when no host matches
[V] Counts unsupported procedural actions as skipped
[V] Counts unsupported selector and procedural work again on a repeated ad invocation
[V] Returns an updated context, preserves metadata, adds to existing counts, and does not mutate the input
[V] Keeps nested selector matches within the 256 element depth limit
[V] Rejects 5,000 nested elements before it gets selectors for the page URL, for matching and non-matching hosts
[V] Rejects 5,000 unclosed nested template elements followed by text for matching and non-matching hosts without a parser stack overflow
[V] Completes EOF recovery for an unclosed HTML template inside an SVG title and preserves the source content
[V] Removes an unclosed matching ancestor and its template content at EOF, while preserving preceding content
[V] Removes the matched explicit body after foreign-content and template EOF recovery
[V] Checks depth when generic hiding is disabled
[V] Collects nested class and ID tokens for generic selectors
[V] Accepts parsed element depth 256 and rejects depth 257 (254 and 255 nested divs in the body)
[V] Allows template content at depth 256 without counting its document fragment and rejects template children at depth 257
[V] Accepts depth 256 and rejects depth 257 for unclosed nested template content at end of file
[V] Counts script, style, span, and template elements toward the limit
[V] Propagates the depth error for deeply nested divs and unclosed nested templates and does not invoke later pipeline steps
[V] Preserves the next paragraph and its source text when an ad paragraph omits its end tag
[V] Preserves the next list item and its attributes when an ad item omits its end tag
[V] Preserves following elements after omitted paragraph end tags inside list items and before dialog, search, menu, and hgroup
[V] Preserves a table after an ad paragraph with an omitted end tag in a fragment without an explicit html element or doctype
[V] Preserves non-ad tables between reconstructed formatting matches and counts overlapping selectors per DOM node
[V] Removes an explicit ad body that reaches end of source, with and without a doctype
[V] Preserves Unicode, comments, attributes, and source formatting
[V] Preserves nested list boundaries and parent end tags around explicit, nested, adjacent, and overlapping ad matches
[V] Preserves text and repeated body and html end tags during parser recovery
[V] Preserves leading text, doctypes, and non-breaking spaces when an implied head closes without a token; preserves source and counts with no match and keeps explicit-body behavior
[V] Keeps leading text and matching element source offsets when an implied head closes without a token
[V] Keeps parent reads bounded for deeply nested malformed HTML at end of file
[V] Counts each ad element once and keeps selector exceptions
[V] Keeps source scans, requested slice units, and slice calls within fixed linear budgets for 32, 128, and 512 short-line, minified, and long-whitespace-gap ad matches; preserves exact output and counts
[V] Preserves CRLF whitespace, unrelated whitespace-only lines, supplementary Unicode, and counts across nested, adjacent, duplicate, and source-boundary matches
[V] Preserves lone-line behavior for multiline matches, spaces and tabs at EOF, source-start matches followed by a final LF, and non-breaking spaces

**Prompt Injection Remover**

[V] Removes zero-width format characters and reports detection categories without changing skipped
[V] Counts independent hidden targets and comments, excludes covered descendants, and preserves prior counts and metadata without mutating input
[V] Counts parser copies of one authored hidden source once and does not count an empty implied hidden element
[V] Counts hidden text nodes and replaced content independently
[V] Keeps categories and warnings unique across fresh inputs and repeated stages
[V] Removes hidden display-none text and HTML comments while keeping visible content
[V] Cleans the hidden-text fixture without adding removal markers
[V] Preserves authored removal markers in text, code, and attributes
[V] Preserves an authored marker in a link payload without reporting it
[V] Preserves authored markers formed across removed hidden spans or comments
[V] Removes hidden elements and comments in nested template bodies and preserves source offsets
[V] Reports resource tags and hidden, visible, and final exfil-shaped URLs in template bodies once
[V] Removes adjacent and nested hidden ranges without adding markers
[V] Reports final links formed by removal of comments or hidden elements
[V] Retains reports from removed URLs and reports final URLs without duplicate reasons
[V] Normalizes invisible characters before URL checks and counts each category once
[V] Preserves visible content and context without mutating the input
[V] Rejects HTML larger than 10 MiB by UTF-8 byte size
[V] Reports exfil-shaped URLs and keeps them in the HTML
[V] Removes inherited zero-font-size text and keeps descendants with visible font-size or font shorthand overrides
[V] Keeps visible images inside zero-font-size parents and removes hidden images
[V] Uses unitless `font-size` in full quirks mode and rejects nonzero unitless sizes in standards and limited-quirks modes
[V] Resolves font-size declaration order and `!important` rules without changing the font shorthand grammar
[V] Keeps sizes with named deferred `var()`, `env()`, and `attr()` functions unknown, including typed `attr()` raw syntax; invalid raw values and nameless `env()` or `attr()` do not replace an earlier size
[V] Removes whole subtrees for display:none, zero opacity, content-visibility:hidden, zero scale, and collapsed height with hidden overflow
[V] Composes supported matrix, scale, rotation, and resolvable translate functions in CSS order before checking the projected plane
[V] Checks composed pure-translation X/Y offsets, keeps cancelling X/Y and `em` translations and matrix compensation, removes truly offscreen results, keeps a mirrored wide plane visible, and applies the unresolved `translate3d()` offscreen heuristic to X/Y only
[V] Removes collapsed composed transforms and known singular operands, but keeps unresolved lists when they do not prove collapse
[V] Keeps transforms whose combined projection is visible, including rotations in the rendered plane with zero diagonal matrix values
[V] Keeps content visible when matrix lists use invalid comma or plus separators
[V] Keeps content visible for invalid lists with singular operands, malformed matrices, or invalid function arguments
[V] Decodes escaped transform names before visibility checks and recognizes collapsed matrices
[V] Applies transform declaration order and `!important`, and leaves deferred `var()`, `env()`, and `attr()` values unknown
[V] Hides zero numeric or percentage Z scales, keeps small nonzero numeric or percentage Z scales, and checks near-zero X and Y scales
[V] Applies `transform-style` declaration order and `!important`; supported opacity, overflow, filter, clipping, isolation, masking, blend, and paint-containment values flatten `preserve-3d`
[V] Applies `clip` grouping only with a valid winning `position:absolute` or `fixed`
[V] Composes affine parent and child planes in confirmed preserved 3D contexts; a collapsed parent plane alone does not hide the full subtree
[V] Removes hidden direct text and images while checking flat and preserved descendants for restored visible planes
[V] Keeps child planes unknown when transform-style, grouping values, or perspective need unresolved layout or style data
[V] Still removes singular transforms and whole subtrees hidden by display or opacity rules in a preserved 3D context
[V] Keeps a collapsed flat subtree hidden
[V] Treats sparse full documents and HTML fragments as HTML at every line and tag density
[V] Removes hidden spans from sparse HTML, including spans inside fenced-looking text
[V] Keeps visible Markdown punctuation, text inside `pre` and `code`, and encoded tag examples

**Raw inline control context** (`test/unit/html-cleaner-pipeline/prompt-injection-remover/controls/raw-inline-emoji-joiners.test.ts`)

[V] Preserves exact HTML source, authored entities, replacement characters, prior findings, counts, and input immutability for a permitted split joiner
[V] Maps numeric emoji neighbors, literal CRLF, decoded CR references, ANSI deletions, and the original leading BOM
[V] Removes and reports invalid or isolated joiners and bidi controls; does not borrow context from block, break, image, comment, hidden, script, style, or template boundaries
[V] Checks controls in raw attributes, hidden content, and control-split tag and attribute names; checks permits again when cleanup forms hidden markup
[V] Keeps original payload scatter evidence and shared document, proportional, floor, and cluster limits across joiners, variation selectors, tag characters, and blank fillers
[V] Adds no document allowance for synthetic run separators and keeps supplementary control widths in source deletions
[V] Uses raw checks for unmappable decoded source and keeps ANSI-aborted payload controls in the scatter gate
[V] Maps 150,000 candidates in one text node within the test time limit

**Supported CSS Visibility Rules**

[V] Applies inline and eligible local style rules after the default sanitizer pass
[V] Applies importance, inline specificity, selector specificity, and source order
[V] Applies important selector specificity when the less-specific rule comes later
[V] Handles type, universal, ID, class, attribute, and combinator selectors
[V] Matches selectors against the browser-compatible HTML tree, including implied table bodies
[V] Applies inline importance on explicit `html` and `body` elements
[V] Removes content hidden by explicit `html` or `body` selectors and styles
[V] Removes direct text hidden by implied or explicit document elements
[V] Keeps separate visibility for parser-reconstructed formatting elements that share a source tag
[V] Removes attributes when every reconstructed copy of a source tag is hidden
[V] Keeps hidden title and link attributes removed when text ends at the same source offset as a reconstructed tag
[V] Checks CSS-hidden content formed by a previous removal and keeps visible inline overrides
[V] Keeps visible source tags and reconstructed copies when a removal changes a sibling selector match
[V] Keeps an implied table body's visibility when a hidden caption and its first row are removed
[V] Checks new hidden children and ancestors while keeping unchanged visible content
[V] Applies a formed stylesheet to new targets and resets saved visibility for each invocation
[V] Checks hiding attributes that a formed tag adds to an implied or explicit document element
[V] Removes hidden attributes on duplicate document tags, keeps URL findings, and preserves visible duplicate tags
[V] Clears resolved visible styles on duplicate document tags before Markdown conversion
[V] Keeps decoded control findings from cleared style values, including duplicate document tags, without duplicate reports or a second entity decode
[V] Preserves visible text after parser-created formatting copies without source locations
[V] Removes hidden content from parser-created copies without source locations
[V] Preserves unrelated attributes on reconstructed source tags
[V] Decodes escaped attribute selector `i` and `s` flags
[V] Uses ASCII-only case folding for the attribute selector `i` flag
[V] Uses default ASCII-insensitive matching for `rel` and honors its `s` flag
[V] Splits class and `~=` attribute values only at HTML whitespace
[V] Matches escaped nonbreaking spaces in class names and accepts escaped leading digits in ID selectors
[V] Treats an escaped `*` as a type name and does not fetch linked stylesheets
[V] Rejects a selector list with invalid ID or attribute selector forms, while accepting an escaped leading digit
[V] Rejects a whole rule when its selector list has an unsupported selector
[V] Skips pseudo selectors, namespace selectors, invalid selector forms, and inactive media rules
[V] Rejects selector matching when a selector or document exceeds its stated complexity budget
[V] Rejects over-budget documents without returning partial HTML or Markdown
[V] Handles uppercase and escaped units and function names
[V] Keeps visible text for invalid declarations, malformed escaped values, and unresolved variables
[V] Keeps same-color text visible when its background image is unresolved
[V] Keeps same-color text visible when a background shorthand or color is unresolved and still applies independent hiding rules
[V] Normalizes inline styles in nested template content while keeping embedded stylesheet rules outside templates
[V] Preserves visible text, unrelated attributes, and Layer 1 findings
[V] Preserves attributes after a Unicode tag name in the source
[V] Does not fetch linked stylesheets or CSS imports
[V] Limits output growth from a selected shared background image while preserving visible Markdown text
[V] Rejects repeated descendant selectors within a subprocess time limit and keeps ordinary combinators working

**HTML to Markdown Pipeline**

[V] Removes ad targets before Markdown conversion and keeps the removal count
[V] Returns empty Markdown when sanitization removes all content
[V] Propagates a step error without calling the next step
[V] Does not mutate the input context
[V] Preserves sanitizer findings and warnings through Markdown conversion
[V] Rejects oversized HTML before Markdown conversion
[V] Withholds HTML with an unsourced hidden body before Markdown conversion and keeps URL findings
[V] Keeps hidden payload out of the next step for deeply nested HTML, with safe output or complete withholding
[V] Keeps visible descendants, images, and rotated content in the final Markdown and removes hidden text and collapsed content
[V] Checks exact final Markdown for deferred font sizes, composed transforms and offsets, preserved 3D descendants, and quirks-mode font sizes
[V] Omits the fenced offscreen payload from final Markdown and retains the hidden-HTML finding
[V] Removes hidden payload after an ad with an omitted paragraph end tag and keeps following visible text

**Pipeline cancellation** (`test/unit/html-cleaner-pipeline/pipeline/pipeline-cancellation.test.ts`)

[V] Stops before the first step, between steps, and before return when the per-call signal is cancelled
[V] Refuses a cancelled call with no steps and prevents success after cancellation in the last step
[V] Keeps concurrent and later calls, their input records, results, and cancellation separate with step doubles

**HTML to MD**

[V] Converts surviving HTML text to Markdown
[V] Preserves visible plain text and HTML fragments without `html` or `body` tags
[V] Uses supplied empty, plain-text, or fragment HTML at a URL with a site-specific extractor
[V] Keeps fragment metadata and resolves relative links at a URL with a site-specific extractor
[V] Escapes plain-text angle tokens, such as email addresses and generic type names, before HTML parsing
[V] Keeps schema headline metadata for empty and nonempty documents without restoring removed body content from schema `articleBody` or `text`
[V] Keeps body content when the document omits the closing `</head>` tag
[V] Keeps text and element siblings before and after an existing body in source order, with or without document metadata
[V] Keeps line breaks and fenced Markdown for styled `<code>` and bare `<pre>` blocks
[V] Keeps relative indentation in preformatted fragments, including nested indentation, tabs, and leading whitespace
[V] Keeps removed ad targets out of the Markdown
[V] Returns Markdown instead of raw HTML
[V] Returns empty output for a document with an empty body and no embedded page content
[V] Returns empty Markdown for empty, whitespace-only, and fully sanitized input with no embedded page content
[V] Sets a null title and preserves findings when cleaning leaves empty HTML or only HTML whitespace
[V] Removes duplicate inherited findings and warnings for empty and whitespace-only input without mutating the input
[V] Preserves URL, HTML, and existing counts in a new context without mutating the input
[V] Keeps prior counts and unique decoded findings on a repeated converter invocation
[V] Extracts the title from a full document
[V] Makes no network requests for preferred async site extractors when the document has content
[V] Makes no network requests when the API fallback receives an empty document
[V] Extracts embedded Substack `body_html` synchronously and sanitizes generated page content
[V] Preserves local content and resolves relative links with finalUrl
[V] Resolves relative, root-relative, and protocol-relative links after same-host and cross-host redirects
[V] Applies ad rules for the final host after redirects, in both host-change directions
[V] Preserves direct content when requestedUrl and finalUrl match
[V] Removes literal and entity-decoded controls from DOM text, attributes, Markdown, and title; reports the control finding once
[V] Removes controls before Markdown escaping and code-fence selection, including generated Substack code with literal, decimal, and hexadecimal controls
[V] Checks logical text runs across inline spans and preserves contextual Persian ZWNJ and emoji ZWJ across highlighted spans
[V] Ends text runs at block, line-break, and image boundaries; maps deletions to original nodes and preserves inline formatting
[V] Preserves formatting and link boundaries when an encoded ANSI sequence repeats visible text
[V] Removes and reports isolated joiners
[V] Removes all four prohibited controls from links in generated extractor content
[V] Preserves ordinary ampersands, copyright signs, and supplementary characters; preserves valid emoji joiners in the title during the control check
[V] Cleans controls from link and image destinations before URL serialization
[V] Keeps visibly escaped entity examples through LinkeDOM attribute serialization and Defuddle's serialize/reparse step
[V] Does not parse converted output as HTML or decode another entity layer during control checks
[V] Keeps an escaped image example in noscript as text without converting it to an image
[V] Keeps top-level noscript fragment text and escaped image examples in body order and preserves metadata in an explicit or unclosed head
[V] Keeps real image elements in noscript available to Defuddle
[V] Keeps a real fallback image and an escaped image example visible when both appear in noscript
[V] Keeps a picture fallback and escaped example separate, with one real image
[V] Uses a noscript fallback for a lazy image outside a figure and keeps escaped examples visible
[V] Keeps nested escaped noscript code as text
[V] Emits one escaped noscript example after repeated extractor callbacks
[V] Preserves parser behavior for malformed entities and invalid code points
[V] Keeps a less-than sign in a quoted image attribute and omits event handlers from Markdown
[V] Keeps table cells with preformatted code and removes internal code markers
[V] Keeps schema headline text with CSS comments and literal or escaped slashes; omits schema `articleBody` and `text`
[V] Escapes a single equals sign after plain text so it does not become a heading underline
[V] Removes raw controls from plain-text input before Markdown escaping and reports each finding once

**HTML Fetcher**

[V] Returns requestedUrl, finalUrl, and HTML for direct and redirected fetches
[V] Preserves the exact requested URL
[V] Rejects missing or invalid fetch metadata

**Lightpanda Website Fetcher**

[V] Uses a nonempty constructor argument as the exact executable path, including spaces, without a shell or version subprocess (`test/unit/website-fetcher/website-fetcher-runtime.test.ts`)
[V] Uses lightpanda from PATH when the constructor gets no executable or an empty one
[V] Ignores LIGHTPANDA_BIN in `process.env`; only the constructor argument selects the executable
[V] Gives each renderer run the server environment of that time and `LIGHTPANDA_DISABLE_TELEMETRY=true`, also when the server environment does not set the variable or sets it to `false`; the server environment does not change
[V] Gives a `WebsiteFetchLaunchError` for a missing executable that keeps the cause, reports the selected path and runtime setup document without the requested URL, and does not fall back to another executable
[V] Passes the supported readiness options and keeps the 60000 ms timeout and 32 MiB output limit
[V] Returns HTML with the requested and final URLs on immediate success
[V] Returns complete HTML after 6.5 seconds without killing a renderer that completes before the 20-second deadline (`test/unit/website-fetcher/website-fetcher-lightpanda-deadline.test.ts`)
[V] Stops the child at the 20-second readiness deadline, waits for its callback, then rejects with `WebsiteFetchReadinessTimeoutError`, budget `20000`, message `Lightpanda readiness limit exceeded after 20000 ms`, and no partial HTML
[V] Preserves a child result or error when the child has already exited at the deadline, and rejects a late success when the child was still running at the deadline
[V] Cancels the readiness timer after success or a process error
[V] Preserves process timeout and output limit errors, reports a missing executable (ENOENT) and a permission error (EACCES) with their launch error messages, and keeps a synchronous launch failure without a system error code
[V] Keeps an HTTP failure when the child exits before the readiness deadline
[V] Reports a readiness failure when an HTTP error callback arrives after the deadline
[V] Reports HTTP status failures with WebsiteFetchHttpError and preserves the status and process cause when available
[V] Preserves a failed HTTP status from renderer errors with exit code 1, including bot challenges
[V] Uses --json and --fail-on-http-error while preserving the readiness, timeout, output, and network-blocking options

**Fetcher launch errors** (`test/unit/website-fetcher/website-fetcher-launch-errors.test.ts`)

[V] Gives a `WebsiteFetchLaunchError` with kind `launch` for `ENOENT` (failure `missing`) and `EACCES` (failure `cannot-start`), also when the output holds a failed HTTP status; it is not a `WebsiteFetchHttpError`, keeps the process error as its cause, names the executable and the runtime guide, and shows no URL
[V] Gives a `cannot-start` launch error with the code `ENOEXEC` when Node refuses the start at once, and with the code `UNKNOWN` when Node throws a start failure without a system error name
[V] Keeps the system limits `EAGAIN`, `EMFILE`, `ENFILE`, and `ENOMEM` and a kill that fails with `EPERM` as process errors, not launch errors
[V] Changes a launch error code that is not a system error name to `UNKNOWN`, so a report cannot show other text
[V] Keeps an HTTP 404 error, the process timeout, a signal, and the output limit distinct from launch errors
[V] Starts no renderer for a DNS failure with the code `ENOTFOUND`, and the failure is not a launch error

**Fetcher cancellation** (`test/unit/website-fetcher/website-fetcher-cancellation.test.ts`)

[V] Starts no DNS or renderer work for an already cancelled signal
[V] Prevents renderer startup after cancellation during a DNS success or failure
[V] Kills an active child once, waits for its callback, and returns cancellation before success, process error, or HTTP error
[V] Removes the abort listener and readiness timer on success, failure, synchronous launch failure, and cancellation
[V] Checks cancellation again after output parsing before returning success
[V] Shares one child kill across readiness timeout and later cancellation
[V] Releases the listener and readiness timer at cancellation, awaits child completion, and ignores repeated callbacks
[V] Cancels one of two concurrent fetches without changing the peer's signal, resources, or result

**Fetcher concurrent calls** (`test/unit/website-fetcher/website-fetcher-concurrent-calls.test.ts`)

[V] One fetcher with a configured executable runs two concurrent calls with the same executable, arguments, and process options, each with its own URL; each call gets its own result

**Local renderer fixture launcher** (`test/unit/test-support/network-fixture.test.ts`)

[V] Uses the selected executable for default, empty, and configured LIGHTPANDA_BIN values, including a path with spaces
[V] Permits only the trusted localhost fetch scope and keeps the launch options of the fetcher, also its renderer environment
[V] Rejects another executable or a public-site fetch through the fixture launcher

**Renderer process double** (`test/unit/test-support/renderer-process-double.test.ts`)

`kill` on a `ChildProcess` that did not start sends the signal to the whole process group of the test runner. `RendererChildDouble` in `test/support/doubles/website-fetcher/renderer-process-double.ts` stands in for the renderer child process and has a `kill` that sends no signal. Each renderer child in the fetcher unit tests is this double. The offline acceptance tests get one for each launch from `RendererProcessDouble`. The renderer setup report test of the server composition and the renderer shutdown cases also give this double as the renderer child.

[V] Records `SIGKILL` and sends no signal to a process when the readiness deadline or a cancellation of a running fetch requests a kill

**Outbound fetch guard** (`test/unit/test-support/outbound-fetch-guard.test.ts`)

The WorkOS SDK proofs, the Better Auth proofs, the local MCP access tests, and the fixtures of the WorkOS browser session had the same guard. Each replaced `globalThis.fetch` in a `before` hook and put the real fetch back in an `after` hook. `guardOutboundFetch()` in `test/support/isolation/outbound-fetch-guard.ts` is the one copy. Its `before` hook installs the guard of `outboundFetchGuard()`, and its `after` hook releases the guard. `guardOutboundFetch()` also gives the record of the refused requests. The Better Auth telemetry proof checks this record before the end of its block. Each caller keeps its own refusal and finding; the two WorkOS callers let requests to `127.0.0.1` through to the local fake. `deny-network.ts` and `foreign-origin-probe.ts` block `fetch` for a whole child process and stay as they are.

[V] Refuses a request to a public URL with an `Error` that has the refusal message, and adds the URL to the record of the guard at once; the release puts the real fetch back and then fails with the finding, which lists the URL
[V] Records the URL of a refused `Request` object and of a refused `URL` object
[V] With `allowLoopback`, sends a POST with a body and a `Request` object through the real fetch to a local server on `127.0.0.1`, with their method and body; the answers come back, and the release passes and puts the real fetch back
[V] With `allowLoopback`, still refuses and records a request to a public URL and a request to `localhost`
[V] `guardOutboundFetch()` in a describe block replaces the real fetch for the tests of the block and puts it back after them; the record that it gives is empty while no request was refused

**HTML entities of the test browsers** (`test/unit/test-support/html-entities.test.ts`)

The three decoders of `HostedBrowser`, `LocalBrowser`, and the local auth page fixtures were the same table and the same regex. `decodeHtml()` in `test/support/drivers/browser/html-entities.ts` is the one copy.

[V] Decodes each of the five entities that the product pages write: `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;`
[V] Decodes several entities in one text and keeps the other text
[V] Decodes one time only: `&amp;lt;` gives `&lt;`
[V] Keeps plain text, an unknown named entity such as `&eacute;`, and a numeric entity other than `&#39;` such as `&#40;` unchanged
[V] Gives the empty string for the empty string

**Operator log reader of the server sites** (`test/unit/test-support/operator-log.test.ts`)

`ServerProcess`, `ServerContainer`, and `InProcessServer` each parsed the listening line and the tenant line of the operator log. `ServerContainer` and `InProcessServer` also parsed the completion records. `HostedImageServer` of `test/support/container/hosted-image-gate.ts` waited for the listening line with its own text of the line. `listeningUrlIn()`, `tenantIn()`, `completionLinesIn()`, and `completionRecordsIn()` in `test/support/drivers/operator-log.ts` are the one copy; each site keeps the log in its own form: the text of the child process, the text of `docker start --attach`, or the messages of its logger.

[V] Gives no listening URL before the `Listening on` line arrives, and the URL of that line when other lines are around it
[V] Gives the local tenant of the tenant line; gives none without that line or before the full stop of that line arrives, so it gives only a complete ID
[V] Gives the completion records of an output in their order, also when other lines and a JSON line of another event are between them and when the console logger writes the time, the level, and the call site before each record; an output without a record gives none
[V] Gives the same URL, tenant, and records for the messages of the in-process logger, joined with line breaks, as for the console text of the same messages

**Cookie jar of the test browsers** (`test/unit/test-support/cookie-jar.test.ts`)

`HttpAgent`, `LocalBrowser`, and `HostedBrowser` each parsed the Set-Cookie lines of an answer and made the Cookie header. `keepCookies()` and `cookieHeaderOf()` in `test/support/drivers/browser/cookie-jar.ts` are the one copy; each browser keeps its own `Map` and its own transport.

[V] Keeps a new cookie from a Set-Cookie line by its name, without its attributes
[V] Replaces the value of a cookie with the same name and keeps its place in the jar
[V] Applies several lines for one cookie in their order, so the last line wins
[V] Drops a cookie on `Max-Age=0` in any letter case and at any position in the line; the other cookies stay
[V] Drops a cookie whose value is empty (`name=; Path=/`)
[V] Skips a line without a cookie name; the jar does not change
[V] Removes the spaces around the name and the value
[V] Gives no Cookie header for an empty jar
[V] Gives the `name=value` pairs in the order that the jar got them, joined by `; `
[V] Seeds a jar from the pairs of a Cookie header, and the jar gives the same header

**Hosted live SDK errors** (`test/unit/test-support/sdk-errors.test.ts`)

The fixture registry, the operator runbook driver, and the operator setup proofs had the same `statusOf()` helper. `test/support/hosted-live/sdk-errors.ts` is the one copy.

[V] Gives the numeric status of an object, also of an error of a refused SDK call
[V] Gives a status of another type (a string, null, or an object) unchanged
[V] Gives undefined for an Error without a status
[V] Gives undefined for null, undefined, and a string

**Built-in mock sync** (`test/unit/test-support/builtin-mocks.test.ts`)

`controlledRenderer()`, `RendererProcessDouble.install()`, and `permitIPv4Fixture()` had the same sequence after their mocks of Node built-in modules. `syncBuiltinMocks()` in `test/support/doubles/website-fetcher/builtin-mocks.ts` is the one copy: it syncs the ESM exports, and at the end of the test it restores all mocks of the test and syncs again. Nine test files outside `test/support` call it too, after their mocks of `execFile`, `lookup`, or `readFileSync`.

[V] After a mock of `lookup` of `node:dns/promises`, the named ESM export `lookup` is the mock in the test; at the end of the test the named export and the module property are the original function again
[V] Mocks of two built-in modules, `node:dns/promises` and `node:child_process`, made before one sync, are both restored at the same end of the test, in the named exports and in the module properties

**Axiom export headers** (`test/unit/test-support/axiom-test-export.test.ts`)

`openAxiomLogging()`, `createOtlpFixture()`, and the live Axiom interface test each wrote the two headers of their OTLP exporter. `axiomExportHeaders()` in `test/support/in-process/axiom-test-export.ts` is the one copy; each exporter keeps its own timeout.

[V] Builds exactly the `Authorization` header with the API key as a bearer token and the `X-Axiom-Dataset` header with the dataset

**Operator log spy** (`test/unit/test-support/operator-log-spy.test.ts`)

The three hosted WorkOS acceptance specifications, `LocalHttpsSite` of the hosted live gate, and the hosted organization and administration integration tests each had the same class that recorded the operator log lines with the prefix `INFO` or `ERROR`. `OperatorLogSpy` in `test/support/doubles/application/operator-log-spy.ts` is the one copy. The operator log lines unit test and the local installation integration test keep their own logger, because it records each message without a prefix.

[V] Records `info` and `error` calls in turn as `INFO <message>` and `ERROR <message>` lines, in the order of the calls
[V] Records the lines in the same spy when `info` and `error` are taken off the spy and called without it
[V] Keeps the lines of each spy apart: each of two spies has only its own line

**Hosted test configuration** (`test/unit/test-support/hosted-config.test.ts`)

Eight files loaded the same hosted test configuration: the three hosted WorkOS acceptance specifications, the hosted MCP access guidance specification, three integration tests, and `test/support/in-process/hosted-organization-site.ts`. The integration tests are the tests of the WorkOS organization reads, of the hosted account routes, and of the origin check at the hosted MCP endpoint. The access guidance specification wrote the public base URL with the slash at the end; the loader gives the same configuration for both forms. `hostedConfig` in `test/support/fixtures/hosted-config.ts` is the one copy: the hosted edition at the public base URL `https://thermus.example/team`. Ten more files loaded the hosted edition at the root of the host, `https://thermus.example/` or the same URL without the slash: the hosted signup and MFA policy specifications, the onboarding and MFA specifications of the auth WorkOS work slice, the integration tests of the hosted administration, the hosted organizations, the local installation, and the WorkOS connection, and the hosted signup and fetch sites. `hostedRootConfig` in the same module is the one copy of it. Each is a test setting of the hosted environment, not literal test data. A settings record that a test gives to a process or to the loader stays in its test.

[V] Is the hosted edition at the public base URL `https://thermus.example/team/`, with the slash that the loader adds
[V] Has the MCP resource URL `https://thermus.example/team/mcp` and a resource metadata URL on the same origin
[V] Has, at the root of the host, the public base URL `https://thermus.example/` and the MCP resource URL `https://thermus.example/mcp`; the origin without the slash loads the same values

**Hosted WorkOS site** (`test/unit/test-support/workos-site.test.ts`)

The three hosted WorkOS acceptance specifications and the hosted MCP access guidance specification each composed the same site in their own `openSite()`. The three specifications also had the same call of `server/discover` at the MCP endpoint. A second site in `test/support/in-process/` composed the same site with the signup fake for the hosted signup and account guidance specifications. The hosted MFA policy specification and the onboarding specification of the auth WorkOS work slice composed the application themselves. `serveWorkOSSite()` in `test/support/in-process/workos-site.ts` is the one copy. It starts the WorkOS fake with the organizations of the test. When the test asks for it, it adds the signup fake of `test/support/doubles/workos/workos-signup-fake.ts`. Then it gives the fake to the set-up function of the test. It serves the real hosted composition with the WorkOS provider, `composeWorkOSApplication()`, behind the real HTTP server on a loopback port. A test can give the hosted configuration, the MFA policy of the connection, the MCP tool server of the composition, `buildServer`, and the signup setting. Without a configuration, the site uses `hostedConfig`. Without an MFA policy, the fake gives its own policy, Optional. Without a `buildServer`, the MCP server of the composition has no tools. Without a signup setting, signup is closed. The site gives the fake, the transport, the public base URL, an `OperatorLogSpy`, `discover()`, and, when the test asked for it, the signup fake. `composeApplicationWithWorkOSFake()` in the same module is the one place that composes the real hosted application against the fake. The MCP cases of the local HTTPS test server give that application to `LocalHttpsSite`. `WorkOSServerSite`, the site type of `signInThroughServer()`, is in the same module.

[V] Answers `server/discover` at the MCP endpoint with 401 without a token, with 200 for the Connect token of a User, and with 403 for the Connect token of a member with only Admin; the operator log of the site has no `ERROR` line
[V] Writes an `ERROR` line of the application to the operator log of the site when a membership read outage gives 500 at the MCP endpoint
[V] With a `buildServer` that gives a test-only tool, the Connect token of a User lists that tool; without a `buildServer`, `tools/list` gets HTTP 404 with the JSON-RPC error -32601 "Method not found"
[V] With the Required MFA policy, a password sign-in through the server gives the portal session the MFA evidence; without an MFA policy, the session has no MFA evidence
[V] With the signup fake and signup with the test documents, the signup page gives 200 with the full notice, and the signup fake has no personal organization
[V] With signup but without approved documents, `serveWorkOSSite()` rejects with the document error of the composition
[V] With the hosted configuration at the root of the host, the site has the public base URL `https://thermus.example/`, and `server/discover` without a token gets 401 with the resource metadata of the root
[V] Has the public base URL of the hosted test configuration and a fake without memberships when the test gives no set-up
[V] Closes its server when the test that opened it ends, so that a later request to the site fails

**Hosted role catalog** (`test/unit/test-support/hosted-roles.test.ts`)

Three support modules had the role catalog of the hosted edition. The WorkOS fake had it as `environmentRoles`, and `test/support/hosted-live/settings.ts` of the hosted live gate as `hostedRolePermissions`. `test/support/in-process/hosted-organization-site.ts` had it as its grants. `memberRole` was in that site and in `test/support/doubles/organizations/directory-double-records.ts`. The signup fake, `test/support/doubles/workos/workos-signup-fake.ts`, had the catalog too, for the personal organizations of signup. `test/support/fixtures/hosted-roles.ts` is the one copy. `hostedRolePermissions` gives each environment role with its application permissions, as the WorkOS staging environment defines them. `user` has `product:access`, `admin` has `user-grants:manage`, `super-admin` has `admin-grants:manage` and `billing:manage`, and `member` has no permission. `userGrant`, `adminGrant`, `superAdminGrant`, and `memberRole` are the grants of these roles. The fake answers with the catalog, the live gate checks the staging environment against it, and the organization site grants from it. Thus the fake and the live gate cannot drift apart. The signup fake gives each personal organization the organization JSON and the role JSON of the WorkOS fake. Thus a personal organization also lists its roles in the order of the catalog. The unit tests of `OrganizationAdministration` keep their own User, Admin, and Super Admin grants. The unit tests of `WorkOSSignup` keep their own role list. The hosted account integration test keeps its own grants too. Each test shows its data. `roleGrantOf()` of the directory double keeps its own map of User and Admin, because it refuses each other role.

[V] Lists the roles `user`, `admin`, `super-admin`, and `member` in this order, the order in which the WorkOS fake lists the roles of an organization
[V] Gives each of `userGrant`, `adminGrant`, `superAdminGrant`, and `memberRole` the name of its role and exactly the permissions of that role in the catalog
[V] Gives the role `member` no permission
[V] Has no permission in two roles

**Form by label of the hosted browser** (`test/unit/test-support/form-labelled.test.ts`)

Three functions found the form of a page by its button text. They were `formFor()` in `test/support/in-process/hosted-organization-site.ts`, `formNamed()` in `test/support/hosted-live/portal-visit.ts` of the hosted live gate, and a local `formNamed()` in `test/acceptance/auth/hosted-workos-administration.test.ts`. `formLabelled()` in `test/support/drivers/browser/hosted-browser.ts`, next to `formsIn()`, is the one copy. When no form has the button text, `formLabelled()` fails with the message of the two `formNamed()` copies. This message gives only the button texts of the page, because the fields hold the form token of the session. The message of `formFor()` also gave the fields of each form.

[V] Gives the form with the button text, with its action and its hidden fields, from the forms that `formsIn()` reads from a page
[V] Fails with an `AssertionError` when no form has the button text; the message names the text and lists the button texts of the page, without a field value such as the form token
[V] Fails with a message that names the text and lists no button text, `[]`, when there is no form

**Hosted members of the organization tests** (`test/unit/test-support/hosted-members.test.ts`)

`test/support/in-process/hosted-organization-site.ts` had three layers: the site, its fixture data, and DSL steps. Step 7b of the [test code refactoring plan](../implementation/test-code-refactoring-plan.md) split it. `test/support/fixtures/hosted-members.ts` has the fixture data. `authority` is the authority of the provider double, `hosted-provider-double`. `userOf()` makes a user, and `member()` makes a membership. `members` has the memberships of the organization tests, and `administrationMembers` has the memberships of the administration tests. Before, `administrationMembers` was in `test/support/dsl/hosted-administration.ts`. The site keeps the composition. It gives `authority` to the directory double and to the MCP identities. When a test gives no memberships, the site uses `members`.

[V] Gives a membership in each of the five organizations of the tests, `org-a` to `org-e`, the name of that organization: Acme, Globex, Initech, Umbrella, or Hooli; the membership is active and has the given grants
[V] Gives a membership in another organization the organization ID as its name
[V] Gives a user without an organization the authority `hosted-provider-double` and no `selectedOrganizationId`
[V] Gives a user with an organization that organization as `selectedOrganizationId`
[V] In `members`, nora has no membership; mia is a User in Acme, an Admin in Globex, and inactive in Initech; and otto is the only member of Umbrella
[V] In `administrationMembers`, Acme has four active memberships with User: otto, cy, fay, and una, and Globex has three: cy, una, and ben; the User grants of ivy, which is inactive, and of pia, which is pending, do not count

**Access steps of the hosted organization tests** (`test/unit/test-support/hosted-access.test.ts`)

Step 7b also moved the DSL steps of the site to `test/support/dsl/hosted-access.ts`. `statusesOf()` gives the status of each page that a browser opens, and `contextAt()` gives the request context of a page. `destinationPaths`, the four destinations of the site, is the default of `statusesOf()`. Each step takes a browser that can open a path, `Pick<HostedBrowser, 'open'>`. Thus the test gives a stub browser that answers by path.

[V] `statusesOf()` gives the status of each path, in the order of the paths
[V] Without paths, `statusesOf()` opens the four destinations `portal`, `administration/users`, `administration/admins`, and `billing`
[V] `contextAt()` gives the request context of a page that answers 200 with the context in JSON
[V] `contextAt()` fails with an `AssertionError` when the page answers 403; the message begins with the body of the answer

**Run-time paths of the test support code** (`test/unit/test-support-paths.test.ts`)

`test/support/processes/module-paths.ts` is the one module that computes run-time paths from the support code to other folders and to the repository root, rule D8 of the [test code layout](test-code-layout.md): the program entry `dist/src/index.js`, the repository root, the network blocker, the SQL tracer, the foreign origin probe, the work-slice shutdown probe, the three hosted process preloads `lingeringHostedHandle`, `heldHostedIdentity`, and `heldHostedCleanup`, the hosted portal fixture and its preload `hostedPortalPreload`, the Lightpanda stub `lightpandaStub`, the three container scripts `containerEdgeScript`, `containerPageScript`, and `containerProbeScript` of `test/support/container/`, the identity preload `hostedImageIdentity` of the hosted image gate, and, since 2026-10-15, the portal build `src/user-portal/dist/` that the local HTTPS site serves. The compiler cannot check such a path. The hosted live setup specification, the Better Auth interface proofs, the local command provider loading specification, the ad rules deployment test, the Lightpanda digest check, the local HTTPS site, the container gate, and the hosted image gate read their paths from it. Before, the local HTTPS site computed the portal build from its own place. That path was correct only from `dist/`. From the source, where the auth WorkOS MCP URL fetch work slice runs the site, the path was one folder above the repository root. Before Step 9b of the [test code refactoring plan](../implementation/test-code-refactoring-plan.md), `container-gate.ts` and `container-site.ts` computed the paths of the three container scripts. The test also covers `failingAdCleaner` of `test/support/processes/server-preloads.ts` and `trustedAdRulesFile` of `test/support/fixtures/ad-rules.ts`.

[V] Given a build, each of the program entry, the network blocker, the SQL tracer, the foreign origin probe, the work-slice shutdown probe, the three hosted process preloads, the hosted portal preload and the index page of the hosted portal fixture, the Lightpanda stub, the identity preload of the hosted image gate, the failing ad cleaner preload, the trusted ad rules file, and the three container scripts names a file that exists
[V] Given the repository, the portal build is the `dist/` folder of the portal source `src/user-portal/`, and that source folder exists; the build itself exists only after `npm run build:user-portal`, which `npm run check` runs after the unit tests
[V] Given a build, the repository root is the folder of `package.json`

The matrix has 17 file paths and two structural cases, or 19 tests. When
the work-slice shutdown probe came, it added one generated file-existence
case, and the matrix had ten file paths and two structural cases, or twelve
tests. That new path case and both real launcher-chain cases passed from
source: 3/3 in 1 suite, with zero failures, cancellations, skips, or todo
cases. Log:
`/tmp/thermus-pr108-path-refactor-focused.log`. The final complete check, integration, acceptance, and container commands
also passed after this test-only path correction.

```sh
npm run build && node --test dist/test/unit/test-support-paths.test.js
```

**MCP SDK client driver** (`test/unit/test-support/mcp-sdk-client.test.ts`)

Sixteen setups in fifteen files built an SDK `Client` with a `versionNegotiation` option and connected it. They were in `LocalMcpUser`, `openFetchSite()`, the two work-slice acceptance tests, the SDK HTTP contract test, the MCP access and failure report tests, the HTTP fetch refusal, fetch cancellation, DNS cancellation, request isolation, and renderer shutdown tests, the two cases of the HTTP shutdown test, the MCP discovery unit test, and the signup cases of the hosted live gate. `connectMcpClient()` in `test/support/drivers/mcp/mcp-sdk-client.ts` is the one copy. Each caller keeps its own transport, because the auth and the fetch differ. Each caller closes the client itself. If the connection or the era check fails, the driver closes the client.

[V] Connects to an SDK server with the defaults in protocol version 2026-07-28; the client lists the tools of the server
[V] Connects in the era 2025-11-25 through the legacy negotiation of the SDK; the client lists the tools of the server
[V] Stops the version probe of a server that does not answer after the default connect timeout of 5,000 ms
[V] Stops the version probe after a connect timeout of 10,000 ms
[V] Stops the version probe after its own 5,000 ms with `probe: true`, also when the connect timeout is 10,000 ms
[V] Fails the era check when an SDK server offers only protocol version 2025-06-18 to a connection in the era 2025-11-25, and closes the client
[V] Gives the client of that connection with `checkEra: false`; the client uses protocol version 2025-06-18

**Image build: Lightpanda digest check** (`test/unit/image/check-lightpanda-digest.test.ts`)

The test runs `docker/check-lightpanda-digest.sh` with `sh`. A `sha256sum` double gives the check the digest of the asset, because the unit suite has no Lightpanda asset. The expected digests come from `docs/lightpanda-runtime.md`.

[V] Given the digest that the runtime guide records for `linux/amd64` or `linux/arm64`, the check accepts the asset without output
[V] Given another digest for `linux/amd64` or `linux/arm64`, also the digest of the other Linux asset, the check stops the build with an error that names the platform, the digest of the asset, and the recorded digest
[V] Given a target architecture without a Lightpanda 1.0.0 Linux asset, the check stops the build with an error that names the supported platforms

```sh
npm run build && node --test dist/test/unit/image/check-lightpanda-digest.test.js
```

**Work slice fetch lines** (`test/unit/test-support/fetch-operation-spy.test.ts`)

`fetchOperationSpy()` and `MARKDOWN_LOG_LIMIT` write the fetch lines of both work slices. They are in `test/support/doubles/mcp/fetch-operation-spy.ts`, and the test imports them from there. Before 2026-10-15, they were private to the entry point of the basic slice, and the test was `test/unit/work-slice/basic-mcp-url-fetch.test.ts`. The cases did not change. A double stands in for the fetch operation, and a recording logger stands in for the log. The tests need no renderer, no Axiom settings, and no network access.

[V] `fetchOperationSpy()` writes the started line before the operation runs; then, below the limit, the completed line has the number of characters and the whole Markdown
[V] Counts code points, not UTF-16 units; above the limit, the completed line keeps the first code points without a split surrogate pair and ends with `[cut: <n> more characters]`, and the caller still gets the whole Markdown; the default limit is 65,536 code points
[V] When the operation fails with an `Error`, a cancellation `DOMException`, or a value that is not an `Error`, writes one ERROR line with the message and throws the same value again
[V] Gives the operation the same URL, request context, and signal

```sh
npm run build && node --test dist/test/unit/test-support/fetch-operation-spy.test.js
```

**Work slice launcher script: basic MCP URL fetch** (`test/unit/work-slice/basic-mcp-url-fetch-script.test.ts`)

The test runs `test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.sh` with `bash` from a temporary directory. A `pnpm` double first on `PATH` writes one JSON line with its arguments, its working directory, the five settings, and whether `AXIOM_API_KEY` is set, but never the value of the key. Each run gets only `PATH`, `HOME`, and the settings of the case. Thus the test reads no `.env.local`, no `ad-rules.txt` of the repository, and no renderer.

[V] Given only `AD_RULES_FILE` with an empty file and `AXIOM_API_KEY`, pnpm exec runs the entry point with the pinned Node runtime in the repository root with the defaults of the other four settings and the key; stderr lists the five settings, and no output shows the key
[V] Given each of the five settings with a custom value, pnpm gets each value unchanged, and stderr lists these values
[V] Given extra arguments, pnpm exec gets them after the entry point
[V] Given an `AD_RULES_FILE` that does not exist, the script exits with status 1 and a message that names `AD_RULES_FILE` and the `touch` command, and pnpm does not run
[V] Given a pnpm that exits with status 3, the script exits with status 3

```sh
npm run build && node --test dist/test/unit/work-slice/basic-mcp-url-fetch-script.test.js
```

**Work slice launcher script: auth WorkOS MCP URL fetch** (`test/unit/work-slice/auth-workos-mcp-url-fetch-script.test.ts`)

The 13 source and compiled cases passed on 2026-10-15 with the slice organization default and override checks. The harness `test/unit/work-slice/fixtures/auth-workos-mcp-url-fetch-script-harness.ts` copies `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.sh` into a temporary root with an empty `ad-rules.txt` and a portal build, `src/user-portal/dist/index.html`, and runs the copy with `bash` from a temporary directory. A `pnpm` double first on `PATH` writes one JSON line with its arguments, its working directory, the eleven settings, whether each of `WORKOS_API_KEY`, `WORKOS_COOKIE_PASSWORD`, and `AXIOM_API_KEY` is set, and the length of the cookie password, but never the value of a secret. An `openssl` double records each call, gives a fixed value for `rand -base64 32`, and writes test files for `req`. Each run gets only `PATH`, `HOME`, and the settings of the case. Thus the test reads no `.env.local`, no file of the real repository root, and no renderer, and it runs no real OpenSSL. The settings include `THERMUS_SLICE_ORGANIZATION_ID`: the staging default is `org_01M4YYEQ6V2ZBM3RQEEV8CKFEA`, and a custom organization is passed unchanged. The file has 13 cases: the case of a missing WorkOS setting runs for each of the three settings.

[V] Given only the three WorkOS settings and `AXIOM_API_KEY`, when the script runs from another directory, pnpm exec runs the entry point with the pinned Node runtime in the repository root with the defaults of the other settings, the redirect URI on the public base URL, a new cookie password from `openssl rand`, and the keys; stderr lists the eleven settings after the certificate line, and no output shows a secret
[V] Given each setting with a custom value, a cookie password, and a TLS directory with both files, pnpm gets each value unchanged, openssl does not run, the files stay, and stderr lists the eleven values without the secrets
[V] Given a `PUBLIC_BASE_URL` with a final slash and no `WORKOS_REDIRECT_URI`, the redirect URI is the callback on that base without a double slash
[V] Given no `WORKOS_API_KEY`, no `WORKOS_CLIENT_ID`, or no `WORKOS_AUTHKIT_ISSUER` (three cases), the script exits with status 1 and a message that names the missing setting and the staging launcher and shows no value, and neither openssl nor pnpm runs
[V] Given the three WorkOS settings with empty values, the script exits with status 1, and the message names the three settings
[V] Given no certificate files, the first of two runs makes `key.pem` and `cert.pem` with `openssl req` in the default TLS directory, which only the owner can read (the directory `0700`, the key `0600`), and says so on stderr; the second run calls no `openssl req` and keeps the files
[V] Given a TLS directory with `cert.pem` only, the script makes a new `key.pem` and `cert.pem`
[V] Given an `AD_RULES_FILE` that does not exist, the script exits with status 1 and a message that names `AD_RULES_FILE` and the `touch` command; it makes no certificate, and pnpm does not run
[V] Given a repository root without the portal build, the script exits with status 1 and a message that names the missing `index.html` and `npm run build:user-portal`; it makes no certificate, and pnpm does not run
[V] Given extra arguments, pnpm exec gets them after the entry point
[V] Given a pnpm that exits with status 3, the script exits with status 3

```sh
npm run build && node --test dist/test/unit/work-slice/auth-workos-mcp-url-fetch-script.test.js
```

### Planned Cache Key Tests

No cache key helper exists yet. The required unit test inputs and expected results are listed in the [planned cache key design](../design/cache-design.md#required-key-tests). All cases are pending. Do not mark them executed until the helper is implemented and each test passes after a RED → GREEN run.

## Integration

**Entry shutdown and startup cleanup** (`test/integration/server-stop-signals.test.ts`)

[V] Registers stop handlers before the listening log and removes them after SIGINT or SIGTERM
[V] Starts MCP cleanup before real listener drain, refuses new connections, and keeps the real provider lock until both finish
[V] Releases the provider lock and listener after startup logging fails, removes signal listeners, and retains a simultaneous MCP cleanup failure

**Work slice signals through the real launcher chain** (`test/integration/work-slice/shutdown-signals.test.ts`)

Two source cases passed in the reviewed 20-case shutdown focus. The child
script `test/support/processes/work-slice-shutdown-probe.ts` runs real `pnpm`
and `tsx` with an outer signal forwarder and the slice stop helper. It uses
no WorkOS, renderer, or Axiom connection. This collaboration across the real
child-process/launcher boundary is integration coverage. The source pass does
not prove real Axiom delivery.

Each signal case now uses its own offline local-dependency fixture without
install-state metadata. This reproduced the Render failure: pnpm installed
before the probe ran and wrote to stderr. The probe disables dependency
verification only for its own pnpm invocation. The required frozen install still
runs before tests; missing Node or tsx still fails startup. This signal check must
not reinstall dependencies beside other tests that import them. Both regression
cases failed before the change and pass with the invocation setting.

[V] SIGINT sent to the process group and forwarded again during asynchronous cleanup preserves the first signal, reaches the flush marker, and exits the whole chain with 0
[V] The same process-chain behavior holds for SIGTERM
[V] Both signal cases retain empty stderr, the exact pinned runtime, and unchanged fixture and dependency-tree entries even when dependency install state is missing

```sh
npm run build && node --test dist/test/integration/work-slice/shutdown-signals.test.js
```

**MCP SDK HTTP contract** (`test/integration/mcp/sdk-http.test.ts`)

[V] Uses public low-level SDK handlers and tools capability through the real HTTP bridge in modern 2026-07-28 and legacy 2025-11-25
[V] Projects exact text with `projectCallToolResult(result, undefined)` and gives a safe unknown-tool InvalidParams error
[V] Leaves malformed JSON and the 4 MiB/413 body refusal to the SDK, with no tool dispatch

**MCP fetch operation** (`test/integration/mcp/get-url-as-markdown.test.ts`)

[V] Calls the real shared permission helper before fetch and refuses a context without product:access
[V] Validates URL semantics and code-point bounds, sends the signal to both dependencies, and preserves requested/final URL metadata and exact Markdown
[V] Gives safe fetch or processing failures without causes or partial output and skips processing after a failed fetch
[V] Rejects HTML above the shared 10 MiB UTF-8 limit before all pipeline work and accepts the exact byte boundary
[V] Preserves completed empty Markdown even with withholding warnings, and rejects absent or nonstring Markdown
[V] Classifies cancellation before generic errors and checks again after each asynchronous stage

**MCP operation and real pipeline** (`test/integration/mcp/get-url-as-markdown-pipeline.test.ts`)

[V] Preserves exact empty success for empty source, ad-only source, hidden-only source, internal scan failure, and scan exhaustion
[V] Uses the final host for ad rules and the final URL for relative links while preserving requested URL spelling
[V] Rejects oversized HTML before the ad stage, even when ads could reduce its size, and retains the existing depth refusal

**MCP dispatch, operation, and real pipeline** (`test/integration/mcp/get-url-as-markdown-mcp.test.ts`)

[V] Returns exact redirected Markdown through an SDK client with one safe completion record
[V] Preserves empty success after real sanitizer scan failure or exhaustion
[V] Observes SDK cancellation during a real sanitizer stage, prevents Markdown conversion, and records cancellation once

**Renderer setup reports of the operation** (`test/integration/mcp/renderer-setup-report.test.ts`)

The operation runs with the real permission helper and with fetcher, pipeline, and reporter doubles. The last case adds the real tool server and an SDK client.

[V] Gives only the fixed `readiness_timeout` category and `20000` budget to the readiness reporter, without the private cause or stderr; the client gets only `Page fetch failed`, and no pipeline work starts
[V] Keeps the safe client failure if the readiness reporter throws
[V] Gives no readiness report for an untyped error whose message copies the readiness timeout text
[V] Gives cancellation priority over a readiness timeout and writes no readiness report
[V] Gives a renderer launch failure (`ENOENT` or `EACCES`) to the operator reporter one time with only the failure class and the code; the client still gets only `Page fetch failed` without a cause, and no processing starts
[V] Gives no renderer setup report for an HTTP 404 error, the readiness limit, the process timeout, or a blocked destination
[V] Keeps the safe fetch error when the reporter throws, and gives only the cancellation and no report for a call that is cancelled when the renderer cannot start
[V] Gives the same client result and the same `fetch_failed` record for a renderer launch failure, an HTTP error, and a readiness timeout; only the launch failure gives a setup report, and only the readiness timeout gives a readiness report

**Renderer setup reports of the server composition** (`test/integration/fetch-tool-renderer-setup-report.test.ts`)

`createFetchOperation` and `fetchToolServers` run with trusted test rules, the real pipeline and fetcher, and a process double at `child_process.execFile`. Each launch gives a `RendererChildDouble` as the renderer child. No renderer runs.

[V] Given renderer starts that fail with `ENOENT` and `EACCES` two times each and then with `ENOEXEC` at once, each call gets `Page fetch failed` and a `fetch_failed` record, and the operator log gets exactly one line for each code, in order, with the exact report text

[V] Given two readiness timeouts with private causes, each call gets the safe fetch failure and each timeout sends one fixed JSON readiness report; this remains true when the application logger throws

Focused commands:

```sh
npm run build && node --test dist/test/integration/mcp/sdk-http.test.js dist/test/integration/mcp/get-url-as-markdown.test.js dist/test/integration/mcp/get-url-as-markdown-pipeline.test.js dist/test/integration/mcp/get-url-as-markdown-mcp.test.js dist/test/integration/mcp/renderer-setup-report.test.js dist/test/integration/fetch-tool-renderer-setup-report.test.js
```

**MCP Authentication**

HTTP request integration tests use `IdentityVerifierSpy` and `AccessResolverSpy` from `test/support/doubles/auth/`, and `FailureReporterSpy` and the test-only factory tools from `test/support/doubles/mcp/`. The verifier spy supplies configured claims or errors and rejects unknown tokens. Its claims can be incomplete, so that tests reach the boundary checks. The resolver spy gives a configured decision, failure, or delayed decision for each user subject, records its calls, and denies an unknown user. `FailureReporterSpy` records each failure report that MCPServer gives to the operator callback. Test-only factory tools report the context that MCPServer binds to each request; production code registers no such tool. MCPServer adapts the verifier to the SDK's OAuthTokenVerifier. These tests run the real SDK middleware and the canonical shared-auth rejection class. This collaboration makes them integration tests, even with verifier and resolver doubles.

[V] Maps IdentityVerifier claims to SDK auth information, supplies the original token, and keeps changes to SDK scopes separate from verifier claims (`test/integration/mcp/identity-verifier-sdk-adapter.test.ts`)
[V] Puts frozen copies of the actual user, issuer, client, scope, issue time, expiration, and audience claims in `AuthInfo.extra` (`test/integration/mcp/identity-verifier-sdk-adapter.test.ts`)
[V] Rejects an identity without a user, issuer, client ID, issue time, expiration, or audience, or with the client ID as the user subject, as `invalid_token` (`test/integration/mcp/identity-verifier-sdk-adapter.test.ts`)
[V] Reports a provider rejection only as `invalid_token` and passes an unexpected provider failure on as a failure (`test/integration/mcp/identity-verifier-sdk-adapter.test.ts`)
[V] Gives the cause of an unexpected provider failure one time to the adapter's failure callback; an accepted token, a provider rejection, and an identity without a usable user give nothing (`test/integration/mcp/identity-verifier-sdk-adapter.test.ts`)
[V] IdentityVerifierSpy rejects unknown tokens and keeps verification call records separate between instances (`test/integration/mcp/identity-verifier-sdk-adapter.test.ts`)
[V] Requires a Bearer token for server/discover, tools/list, and tools/call; missing tokens return HTTP 401 with a Bearer challenge and the protected-resource metadata URL (`test/integration/mcp/auth.test.ts`)
[V] Rejects a missing Authorization header with HTTP 401 before token verification or MCP dispatch (`test/integration/mcp/auth.test.ts`)
[V] Rejects a malformed Authorization header with HTTP 401 before token verification or MCP dispatch (`test/integration/mcp/auth.test.ts`)
[V] Returns HTTP 401 with invalid_token when the verifier rejects a token, including a malformed token or an untrusted issuer, before access resolution (`test/integration/mcp/auth.test.ts`, `test/integration/mcp/auth-claims.test.ts`)
[V] Returns HTTP 401 with invalid_token for an expired token or a token with no expiration or issue time (`test/integration/mcp/auth-claims.test.ts`)
[V] Returns HTTP 401 with invalid_token when the verified token audience is missing or does not match the MCP resource (`test/integration/mcp/auth-claims.test.ts`)
[V] Returns HTTP 403 with insufficient_scope and the required scope in the Bearer challenge when a verified token lacks permission (`test/integration/mcp/auth-claims.test.ts`)
[V] Allows a token for the MCP resource with a future expiration and all required scopes to reach the requested MCP operation (`test/integration/mcp/auth.test.ts`, `test/integration/mcp/access-resolver.test.ts`)
[] Serves protected-resource metadata without a token; identifies the MCP resource, trusted authorization server, and supported scopes, without allowing anonymous tool access
[V] Verifies each token once, gives only the verified user to the access resolver, and binds the decided context with the verified claims to the request (`test/integration/mcp/access-resolver.test.ts`)
[V] Rejects token details that cannot establish the required user or tenant context: an identity without a usable user, or an allowed decision without a tenant ID (`test/integration/mcp/identity-verifier-sdk-adapter.test.ts`, `test/integration/mcp/access-resolver.test.ts`)
[V] Checks every request again; a valid request does not authorize a later request with a missing or rejected token (`test/integration/mcp/access-resolver.test.ts`)
[V] Returns a safe HTTP 403 access_denied without a Bearer challenge for each denial reason and MCP method, distinct from the SDK insufficient_scope response, before the request factory or MCP dispatch (`test/integration/mcp/access-resolver.test.ts`)
[V] Returns a generic HTTP 500 for an access resolver failure or an allowed decision without a tenant ID, with no private details, request factory, or MCP dispatch (`test/integration/mcp/access-resolver.test.ts`)
[V] Stops before MCP dispatch, the fetcher, and the pipeline after any authentication or scope failure (`test/integration/mcp/auth.test.ts`, `test/integration/mcp/auth-claims.test.ts`, `test/integration/auth/mcp-context.test.ts`)
[V] Returns a server error if token verification fails unexpectedly; performs no MCP dispatch or access resolution and exposes no token or internal error details (`test/integration/mcp/auth.test.ts`)
[V] Gives one `token-verification` report that keeps the cause to the operator callback when token verification fails unexpectedly; the client still gets the generic 500 (`test/integration/mcp/auth.test.ts`)
[V] Gives one `access-resolution` report that keeps the cause to the operator callback for an access resolver failure or an allowed decision without a tenant ID; the client still gets the generic 500 (`test/integration/mcp/access-resolver.test.ts`)
[V] Puts no bearer token, cookie, password, or proxy credential from the request in a failure report (`test/integration/mcp/auth.test.ts`, `test/integration/mcp/access-resolver.test.ts`)
[V] Reports no failure for a missing or malformed Authorization header, a rejected token, rejected claims, a missing scope, or an access denial (`test/integration/mcp/auth.test.ts`, `test/integration/mcp/auth-claims.test.ts`, `test/integration/mcp/access-resolver.test.ts`)

Real issuer, signature, and key rotation checks belong in authentication interface tests. Browser OAuth flows and provider compatibility need separate integration and acceptance tests. A fake verifier does not prove those behaviors.

Run these MCP integration tests:

```sh
npm run build && node --test dist/test/integration/mcp/auth.test.js dist/test/integration/mcp/auth-claims.test.js dist/test/integration/mcp/identity-verifier-sdk-adapter.test.js dist/test/integration/mcp/access-resolver.test.js
```

**Local token verification and access** (`test/integration/auth/better-auth-provider-verification.test.ts`, `better-auth-provider-introspection.test.ts`, `better-auth-provider-access.test.ts`)

Provider doubles supply keys, introspection responses, and current user records. Signed test tokens exercise the verifier's public contract. The real shared-auth rejection class and context creation make this integration coverage.

[V] Accepts only a signed local access token with the expected type, algorithm, issuer, resource, user, session, client, scope, and time claims
[V] Refuses malformed, forged, foreign, expired, wrong-purpose, and incomplete tokens before introspection
[V] Keeps the raw token and decoded private claims out of expected rejection errors, while preserving unexpected provider failures
[V] Introspects each accepted token and refuses a token whose session ended; missing client credentials and provider failures remain unexpected errors
[V] Reads current user state on every access decision; enabled users share one installation tenant, while foreign, missing, and banned users get no access

Run the focused provider tests:

```sh
npm run build && node --test dist/test/integration/auth/better-auth-provider-*.test.js
```

**MCP access context** (`test/integration/auth/mcp-context.test.ts`)

These tests run MCPServer with the real access contracts through a test-only protected tool. The tool checks its permission, then records fetch and clean steps in its trusted tenant. Doubles stand in for the identity verifier, the access resolver, and the operator failure callback.

[V] Keeps four concurrent members in two tenants in their own trusted contexts while their resolutions finish in reverse order and their protected work overlaps
[V] Checks access again for each request: after a User grant is revoked, the next request with the same token gets no protected work
[V] Runs no tool, fetch, or clean step after HTTP 401 for a missing or rejected token, 403 insufficient_scope, 403 access_denied, or a generic 500
[V] Gives the operator one `access-resolution` report with the cause for an access lookup outage, and no report for a missing or rejected token, a missing scope, or an access denial
[V] Refuses protected work when the grants lack the required permission, for example Admin without User

**Local installation** (`test/integration/auth/local-installation.test.ts`)

These tests run the real application, Better Auth runtime, MCPServer, and provider with SQLite files in temporary data directories. The self-hosted application gets the server settings with the trusted test rules in `AD_RULES_FILE`, so it also makes the real fetch tool composition.

[V] A fresh data directory gives one logged `local:<installation-id>` tenant; the application holds the data-directory lock until it closes; MCP requests without a token or with a forged token get 401 with the Bearer challenge and give no failure report, and other paths get 404
[V] Two applications that start at the same time on a fresh directory: one starts, the other fails with `DataDirectoryInUseError`, and one installation identity exists
[V] A restart keeps the tenant and the IDs of enabled and disabled accounts
[V] With zero accounts or only a disabled account, startup succeeds, the disabled account cannot sign in (`BANNED_USER`), and MCP requests stay denied
[V] A copy of the complete stopped data directory keeps the tenant, the user IDs, and a browser session that its secret signed
[V] A client that an enabled account registers through the provider has the installation ID as `reference_id` and no `user_id`
[V] Retained data without its installation identity, and retained data with a damaged provider schema, stop startup and release the data-directory lock
[V] The hosted deployment selects the WorkOS provider instead of the local runtime: without the WorkOS settings it refuses to start with `WorkOSSettingsError`; with them, an account request and an MCP request with a forged token get 401, the log names the WorkOS client and issuer, and two close calls give one result

**Application startup with refused ad rules** (`test/integration/application-ad-rules.test.ts`)

These tests call `createApplication()` with the self-hosted configuration, the real rules reader, and the real ad cleaner on a fresh temporary data directory. A test double makes the native adblock-rs parser fail.

[V] With `AD_RULES_FILE` that names a missing file, the application rejects with `AD_RULES_FILE could not be read (ENOENT).` before it opens the data directory or reports a tenant
[V] With trusted rules and a native rule parser that fails, the application rejects with `The ad cleaner could not load the rules in AD_RULES_FILE.`, keeps the parser error only as the cause, and opens no data directory

```sh
npm run build && node --test dist/test/integration/application-ad-rules.test.js
```

**Hosted account routes with doubles** (`test/integration/auth/hosted-account.test.ts`)

These tests run the real hosted composition, `composeHostedApplication()`, with the real account routes and access contracts. No WorkOS setting, SDK, or credential exists. `BrowserSessionDouble` gives explicit signed-in sessions, `SignedInSessionDouble`, with the organization that each session selected. `MembershipDirectoryDouble` resolves access from configured memberships with `createRequestContext()`. The test-only `AccountOperationSpy` checks one permission for each operation and records its work in the trusted context. An MCP endpoint double stands in for the replaceable MCP part. The failure reporter and the change recorder of the composition keep nothing.

[V] Members of two organizations and one user with a session in each organization overlap and resolve in reverse order; each operation works only in the organization of its own session, also with forged organization IDs in the query, headers, and form
[V] Independent Super Admin, Admin, and User plus Admin grants give each context every grant and only the union of their explicit permissions; Super Admin alone gives no product access, and Admin alone gives no billing; each refusal is the operation's `permission-required`
[V] A session without a selected organization, an inactive membership, an identity of another authority, and a missing session get the 403 or 401 page before any operation, with no default organization, tenant, or role
[V] MCP and metadata requests go to the MCP endpoint without a browser session lookup, a path outside the public path gives 404, and two closes of the application close the MCP endpoint one time

Run only these tests:

```sh
npm run build && node --test dist/test/integration/auth/hosted-account.test.js
```

**Hosted organization onboarding and selection with doubles** (`test/integration/auth/hosted-organizations.test.ts`)

These tests open the shared site of `test/support/in-process/hosted-organization-site.ts` in one process with `openOrganizationSite()`: the real hosted composition, `composeHostedApplication()`, with the real account routes, `OrganizationAdministration`, access contracts, and MCPServer, and one set of memberships. Doubles stand only at the provider boundaries: `BrowserSessionStore` for the browser session, `MembershipDirectoryDouble` for the membership directory, and `IdentityVerifierSpy` for the MCP token verifier. `HostedBrowser` keeps the cookies of each answer, as a browser does. The test-only `AccountOperationSpy` gives the destinations, which each check one permission, and a test-only MCP tool records its context. `accountFailureReporter()` writes to an `OperatorLogSpy` (`test/support/doubles/application/operator-log-spy.ts`). No WorkOS setting, SDK, or credential exists.

[V] A session that selected an organization where its membership is inactive gets the onboarding guidance from a directory read of the session user only, also with forged organization values; each tenant page gets 403 from current access resolution, with no context, tenant, or role
[V] Memberships change after the page was shown: the current read refuses the deactivated organization without a switch and selects the new one; the destination then works in that organization with its current permission
[V] After a browser selects another organization, only that browser session changes: an MCP token and a second browser session of the same user keep their organization
[V] Selections of the organization of another user, with forged organization values in the query, the headers, and a second form field, read only the memberships of the session user, get 403 or 400, and switch no session; the other user keeps its organization
[V] Super Admin alone and User alone select the same organization, and each destination and the MCP tool check their own permission: Super Admin reaches only Admin-grant administration and billing, and User reaches only the product and the tool
[V] During an outage of the organization reads after the provider refreshed the session, the organization page and a selection get the 500 failure page with the refreshed session cookie; the operator log gets one line with the path and the cause for each; no session switches, and the browser keeps its session
[V] The production hosted application with the WorkOS provider asks for a sign-in (401) without a cookie or a form on the organization page, a selection, and a tenant page with the session cookie, form token, and organization values of the doubles; the log has only the WorkOS startup line

Run only these tests:

```sh
npm run build && node --test dist/test/integration/auth/hosted-organizations.test.js
```

**Hosted organization administration with doubles** (`test/integration/auth/hosted-administration.test.ts`)

These tests open the shared site of `test/support/in-process/hosted-organization-site.ts` in one process with `openOrganizationSite()`, with the memberships of `administrationMembers` in `test/support/fixtures/hosted-members.ts`. In Acme, these are members with Super Admin alone, all three roles, User plus Admin (two members), Admin alone, User alone, and only the default role, an inactive member, and a pending member; in Globex, User memberships of two of these users and a member with User plus Admin. The real hosted composition, account routes, `AdministrationRoutes`, `OrganizationAdministration`, access contracts, and MCPServer run with doubles only at the provider boundaries. `BrowserSessionStore` keeps the MFA evidence of each session. `MembershipDirectoryDouble` extends `OrganizationDirectoryDouble`, so that one stateful set of memberships, grants, revisions, and invitations gives the access resolution and the organization work, and a grant change takes effect in the next access resolution. `IdentityVerifierSpy` verifies the MCP tokens. The site keeps each change record. `HostedBrowser` opens the pages and submits their forms, as a person does. `accountFailureReporter()` writes to an `OperatorLogSpy` (`test/support/doubles/application/operator-log-spy.ts`). No WorkOS setting, SDK, or credential exists. These tests prove application policy with doubles, not WorkOS behavior.

[V] Direct service calls on the directory of the site follow the rules of the forms: a Super Admin grants Admin and then User to itself, an Admin cannot grant Admin, and a User plus Admin member revokes its own User grant; the next MCP requests use the current grants, the members page of that member still works, its other organization keeps its grants, and each call is recorded
[V] An Admin and a Super Admin post changes of the same member from pages with the same revision, and the directory runs both at the same time: one gets 303, the other 409 with the out-of-date notice, and the grant that the second actor wanted to revoke stays; the records say `applied` and `stale`
[V] A directory change that fails after its effect, after the provider refreshed the session, gives the 500 failure page with the refreshed session cookie, one operator log line with the path and the cause, and an `unknown` record; a retry of the same form gets 409 and changes nothing again, and the page then shows the current grant
[V] When the directory cannot make a change safely, a grant post and an invitation post each get 503 with the notice; nothing changes, and each record says `unsupported`
[V] With `accountChangeRecorder()`, a grant change and an invitation each give the operator log one info line with the record; no line holds the form token, the session cookie, or the invitation token
[V] During an outage of the member pages after the provider refreshed the session, the members page gets the 500 failure page with the refreshed session cookie and no partial count; the operator log gets one line with the path and the cause
[V] The production hosted application with the WorkOS provider asks for a sign-in (401) without a cookie or a form on the member and invitation pages and each change, with the session cookie, form token, and values of the doubles; the log has only the WorkOS startup line

Run only these tests:

```sh
npm run build && node --test dist/test/integration/auth/hosted-administration.test.js
```

**WorkOS Connect verification** (`test/integration/auth/workos-provider-verification.test.ts`)

`WorkOSAuthProvider` runs with local signing keys and the real `InvalidAccessTokenError`. These tests show the application side of the [live results](../design/authentication-design.md#live-provider-proofs), not WorkOS behavior.

[V] A Connect user token of the AuthKit issuer for the MCP resource gives the user in the WorkOS authority with the organization of the token, the actual issuer and client, the scopes, the time claims, and the MCP resource; a token without `org_id` gives no selected organization
[V] Requires no particular scope, keeps only the named scopes, and gives tokens of two MCP clients of one user the one authority with their own client IDs
[V] Accepts 30 seconds of clock skew in both directions
[V] Refuses another issuer, another audience, a browser-token shape, an M2M shape (no `sid`, or `sub` equal to `client_id`), an expired token, an issue time in the future, HS256 and `alg: none`, another key under the published key ID, an unknown key ID, and a token without `sid`, `scope`, or `client_id`, or with an empty `org_id`, as an invalid token whose error shows neither the token nor its claims
[V] Reads the AuthKit key set one time for two checks, and throws a key-set failure (500, a timeout, a refused connection) as an unexpected error, not as a token rejection

**WorkOS access resolution** (`test/integration/auth/workos-provider-access.test.ts`)

[V] Makes the tenant only from the authority and the organization
[V] Allows an active membership with every grant and the union of their permissions after one fresh read; Admin and Super Admin alone are allowed with their grants, and the default role alone gives a context without a permission
[V] Denies a missing active membership with `membership-inactive`, a missing or empty organization with `organization-required`, and another authority with `account-inactive`, without a read for the last two
[V] Gives a failed grant read to the caller, so access fails closed
[V] Gives Connect tokens of one user in one organization from two MCP clients the same tenant, and another organization another tenant

**WorkOS browser session with the pinned SDK** (`test/integration/auth/workos-browser-session.test.ts` and `workos-browser-session-switch.test.ts`)

The real `WorkOSBrowserSession` runs with the pinned SDK against the local fake WorkOS API (`test/integration/auth/fixtures/workos-session-fixtures.ts`). `allowOnlyLoopbackRequests()` of that file calls `guardOutboundFetch()` of `test/support/isolation/outbound-fetch-guard.ts`. Thus a replaced `fetch` lets only requests to `127.0.0.1` through and records no request that leaves the machine.

[V] A completed AuthKit sign-in exchanges the code with the verifier of the AuthKit URL, and the new session cookie authenticates as the WorkOS user with the MFA evidence of the password sign-in
[V] A valid access token is checked against the browser key set without a refresh or a cookie change
[V] An expired access token refreshes through `POST /user_management/authenticate` with the stored refresh token in the organization of the session; the one new cookie keeps the CSRF token
[V] An ended session (400 `invalid_grant`) signs out with the cleared cookie; a key-set or API outage rejects without a refresh, and the same cookie works after the outage
[V] An organization switch refreshes with the organization ID and keeps the CSRF token; `organization_membership_not_found` refuses the switch without a cookie change
[V] The end of a session with an expired access token gives the logout URL of its `sid` without a request to WorkOS

**WorkOS provider with the pinned SDK** (`test/integration/auth/workos-provider-directory.test.ts`)

The real `WorkOSOrganizations` and `WorkOSAuthProvider` run with the pinned SDK against the local fake WorkOS API.

[V] Verifies a token and resolves combined grants after one key-set read, one filtered membership read, and one role read
[V] Allows the default role without a permission, and denies a missing membership after only the membership read
[V] Refuses a permissive default role, a missing mapped role, and a membership without roles with a `HostedRoleConfigurationError`
[V] Gives a 500 answer of either read to the caller

**WorkOS organization reads with the real organization service and routes** (`test/integration/auth/workos-provider-organizations.test.ts`)

AUTH-07W added these tests. The real `WorkOSBrowserSession`, `WorkOSOrganizations`, and `WorkOSAuthProvider` run with the pinned SDK against the local fake WorkOS API of `test/support/doubles/workos/workos-fake.ts`, in the test process, together with the real `OrganizationAdministration`, account routes (`composeHostedApplication()`), and MCPServer. `AccountOperationSpy` gives the destinations of the product and of the User and Admin administration, each with its permission; the billing page is the real page of the routes. These tests do not show what the WorkOS service sends; the hosted live gate does.

[V] A member with only Super Admin selects its organization for the billing page: the billing page with the Free plan and the Admin-grant destination accept it with exactly the `super-admin` grant from a current WorkOS read; the product page, the User administration, and the MCP tool refuse it, so no Admin or User grant is inferred
[V] A member with User in one organization, Admin in a second, an inactive membership in a third, and only the default role in a fourth is offered only the first two; each destination, also the billing page, checks the permission of the selected organization only
[V] The organization page gives WorkOS one read of the memberships of the session user with the explicit status `active` and the limit 100, and one role read for each active organization; a selection makes the same current reads before the refresh into the selected organization
[V] The real organization service over the WorkOS reads authorizes only a current active membership with an application permission, also when the session user or the request names another organization; a user of another authority gets no organization and causes no WorkOS read
[V] When WorkOS answers the membership of another user, an inactive membership, or a default role with `product:access`, the organization page and a selection each get the 500 failure page with an operator report, show neither an organization nor the onboarding guidance, and switch nothing

**WorkOS organization administration with the real organization service** (`test/integration/auth/workos-provider-administration.test.ts`)

AUTH-08W added these tests. The real `WorkOSOrganizations` and `WorkOSAuthProvider` run with the pinned SDK against the local fake WorkOS API of `test/support/doubles/workos/workos-fake.ts`, in the test process, together with the real `OrganizationAdministration`, called directly as a service, and the real access resolution of Connect tokens. The fake keeps organizations, users, the roles of each membership as single-role assignments, and invitations, as the probes of WorkOS staging showed. Acme has the external ID `customer-acme`, as each customer organization of the operator runbook has one, and Globex has none. As WorkOS does, the fake accepts a role write only on the resource of the organization of the membership, named by the external ID of the organization, or by the organization ID when the organization has none. In Acme, Sam has only Super Admin, Dan Super Admin and Admin, Cal only Admin, Ada and Hal User and Admin, Bea only User, Eve an inactive membership that had User and Admin, and Gus only the default role; in Globex, Bea and Pia have User. `BillingRecorder` keeps each seat update. Each test checks the result, the change records, and the WorkOS requests that change something. These tests do not show what the WorkOS service sends; the hosted live gate does.

[V] Sam with only Super Admin cannot change User, grants Admin and then User to itself, and grants Admin again after it revoked it; Cal with only Admin cannot grant Admin; Dan grants Admin to Bea; each applied change is one single-role WorkOS write on the resource of Acme, named by its external ID, no other membership changes, and billing gets one seat count
[V] After Dan revokes Admin from Ada and Cal revokes User from Hal, the Connect token of Ada from before the changes keeps product access while each administration operation of Ada is denied, and the token of Hal gives no product access while Hal still manages User and grants it to itself again
[V] After Cal revokes the only grant of Bea in Acme, WorkOS keeps the membership active with only the default role; the service lists only Globex and refuses a selection of Acme, the Acme token of Bea resolves without a permission, and its Globex token keeps product access
[V] In Globex, which has no external ID, Pia with User and Admin revokes User from Bea; the one single-role WorkOS write names the resource of Globex by its organization ID, Bea keeps User in Acme, and billing gets the one User seat of Pia in Globex
[V] Direct service calls of Dan that name memberships of Globex, the inactive Eve, a pending membership from an invitation, Super Admin, an unknown role, the actions disable, deactivate, reset-password, and delete, or a resend and a revoke of a Globex invitation are each denied with a record; WorkOS gets no write, and no membership or invitation changes
[V] Dan without completed MFA gets `mfa-required`, and an actor of another authority with the subject of Dan gets `denied`, for each operation; each change has its record, and WorkOS gets no request at all
[V] A grant whose WorkOS answer is a 500 and a revoke whose connection closes, each after WorkOS applied it, fail after one write with an `unknown` record; a retry of the same request is `stale` without a write, also after another administrator undoes the change
[V] A grant of User by Cal and a revoke of its own Admin by Dan, from the same revision at the same time, are each `applied` or `stale`; each applied change is one single-role write, and the final roles are exactly the start roles with each applied change
[V] A change of Bea in WorkOS before Dan asks and a change of Gus between the check of the service and the write of the directory each give `stale` without a write; the directory reads Gus again just before its write
[V] For the inactive Eve, the service denies a revoke and the directory answers `unsupported`; an Admin invitation makes the membership pending with only Admin, and the acceptance makes it active with only Admin; WorkOS gets only the send, and no membership create, update, deactivation, reactivation, or deletion
[V] Cal invites only User and Sam only Admin; the Admin invitation gives no User; a repeated send of the same address and role in another letter case sends nothing; the WorkOS refusals of an invited address and of an active member give `address-in-use`
[V] The invitation overview shows the WorkOS state of accepted, revoked, expired, and pending invitations without a token or link; only the pending invitation is resent and revoked, and each other change is `not-pending` with its record and without a WorkOS change
[V] Member pages of two that repeat one membership on the next page give each membership of Acme once with its status and application roles; the seats and the billing update count each active User membership once
[V] During an outage of the later member pages and of the invitation reads, each overview fails without a partial result; a grant keeps its `applied` record while its seat update fails and billing gets no count; a send fails with a `failed` record before any WorkOS send

Run only these tests:

```sh
npm run build && node --test dist/test/integration/auth/workos-provider-administration.test.js
```

The command after the protected portal request below also selects this file, with its glob `workos-provider-*.test.js`.

**MCP required permission** (`test/integration/mcp/required-permission.test.ts`)

[V] With `product:access` required, a context with the User grant reaches the tool, and a context with Admin only, Super Admin only, the default role, or no grant gets the 403 `access_denied` of a denial before the factory or MCP dispatch
[V] Without the option, an allowed context without a permission reaches the tool as before
[V] An allowed decision without a trusted tenant still gives the generic 500 and one `access-resolution` report

**Protected portal request** (`test/integration/auth/portal-access.test.ts`)

[V] User plus Admin gives the organization and the roles that give a permission, without a highest role, and `Cache-Control: no-store`
[V] Admin only, the default role only, and no grant give 403 `{"access":"denied"}` without organization data
[V] Another path gives 404, and another method gives 405 with `Allow: GET, HEAD`

Run only these tests:

```sh
npm run build && node --test dist/test/integration/auth/workos-provider-*.test.js dist/test/integration/mcp/required-permission.test.js dist/test/integration/auth/portal-access.test.js
```

**Local command dispatch and lifecycle** (`test/integration/auth/local-auth-command-lifecycle.test.ts`, `local-auth-command-users.test.ts`, `local-auth-command-clients.test.ts`)

Doubles stand in for hidden input, opening and closing resources, and the
provider. The real command, configuration loader, and concrete
`BetterAuthUserAdministration` run. The command, config, and Better Auth implementation
are separate logical packages. These tests retain the previous command unit
cases as integration coverage; moving their files does not change their scope.

[V] Gives exit status 2 and the usage for an unknown command, a missing or extra target, an option, and an incomplete client registration, without the arguments in the message, without a prompt, and without opening data
[V] Opens administration with the self-hosted data directory and public URLs and closes it after the command; a hosted configuration, with or without WorkOS settings, or an incomplete configuration gives status 1 without opening data
[V] Gives status 1 and the lock message for each command when another process holds the data directory, before any prompt
[V] Closes the opened resources after a failed command; reports a close failure, and both failures together
[V] Asks for a new password two times for add and reset-password, and one time for client registration; refuses different entries and ended input
[V] Prints the added account, the account table or the first-account hint, the reset and disable results, and the client ID, without passwords or hashes
[V] Keeps a disabled account disabled after a reset and says so; ends only the sessions of the target

**Local command role boundary** (`test/integration/auth/local-auth-command-boundary.test.ts`)

An administration role double stands in for the provider implementation. The
real configuration loader still runs, so these are integration tests.

[V] Supplies neutral settings to the opener and dispatches through the five-operation role
[V] Keeps password reads lazy, writes output before close, and closes after operation or output failure
[V] Preserves operation and cleanup errors together
[V] Reports opening and cleanup errors without invoking the role or claiming ownership of close

**Local auth command processes** (`test/integration/auth/local-auth-command.test.ts`, `local-auth-command-lock.test.ts`, `local-auth-command-grants.test.ts`)

These tests run the built entry point, `dist/src/index.js`, as separate processes with the real provider and SQLite files in temporary data directories. Passwords go through standard input. Each process refuses outbound network access and can record its SQL statements. Sign-in, authorization, and introspection run through the provider handler in the test process while no command or server runs.

[V] Two commands that start at the same time on a fresh directory: one initializes the installation and keeps the lock while it waits for its password, and the other fails with the lock error; one installation identity and one account exist
[V] A server start fails with the lock error while a command waits for its password; the command still completes
[V] add refuses the email of an enabled or a disabled account in another letter case before the prompt; each account keeps its ID, state, and password
[V] add refuses an invalid email, passwords outside the length rule, different entries, and ended input with status 1 and a safe message; no account exists
[V] A password or an option among the arguments gives status 2 without the password in the output and creates no data
[V] A missing target, two targets, and an unknown email give status 2 or an unknown-account error without a prompt; no account changes
[V] With only a disabled account, add gives access to a new account; the disabled account keeps its ID and stays disabled
[V] reset-password and a second disable keep the ID and the state of a disabled account; only its new password reaches the `BANNED_USER` check
[V] A client registration keeps the sessions and tokens of its account; a reset then ends only the session, MCP token, and pending authorization code of the target, and the peer's pending code still gives a token
[V] Two exact redirect URIs persist for the installation and no registration session stays; authorization accepts another loopback port and refuses another path
[V] Each SQL statement on a provider table comes from the provider's database adapter; no statement comes from the command modules, and no SQL text contains a password

Run only these tests:

```sh
npm run build && node --test dist/test/integration/auth/local-auth-command*.test.js
```

**Local MCP access** (`test/integration/auth/local-access.test.ts`)

These tests run `BetterAuthProvider` as the verifier and the access resolver of a real MCPServer with the real Better Auth provider and SQLite files in temporary data directories. A test-only protected tool records its trusted context and its fetch and clean steps. Sign-in, consent, and the code exchange run through the provider handler. With `guardOutboundFetch()` of `test/support/isolation/outbound-fetch-guard.ts`, the test process refuses outbound `fetch` calls and records each attempt.

[V] Two local users each call the protected tool with their own session-bound token: each request has its own user subject in the one `local:<installation-id>` tenant with the same `user` grant and `product:access` permission, and the verified claims name the local issuer, the approved client, and the MCP resource
[V] A user disabled while its session and token stay valid gets 403 `access_denied` after token verification, a deleted user gets 401, no tool runs for them, and the peer still works
[V] When one user's sessions end, only that user's token gets 401 and the peer keeps working
[V] More than 100 protected requests remain accepted without a shared introspection quota; ending one session still rejects its next request and preserves peer access
[V] A changed payload, a token of another installation, an ID token, an access token without the MCP resource, an expired token, and a malformed value each get 401 before any tool runs and give no operator report
[V] With `openid` required, a token with only the `profile` scope gets the SDK's 403 `insufficient_scope` with the required scope in its challenge
[V] Without a resource-server client, or with a wrong client secret, a valid token gets a generic 500 and one `token-verification` report without the token
[V] After a disable, sign-in, the pending code, a refresh request, a new authorization without the sign-in page, and the old token all fail; the peer keeps working
[V] After the runtime closes and opens again, the token is still accepted, and a new authorization needs no sign-in or consent
[V] Only the registered redirect URI, on any loopback port, gets a code; another path, a client metadata URL as client ID, and an unknown client go to the bundled authorization error page

Run only these tests:

```sh
npm run build && node --test dist/test/integration/auth/local-access.test.js
```

**Server start and stop** (`test/integration/server-stop-signals.test.ts`)

These tests run `serve()` from `src/index.ts` with the real hosted application and HTTP bridge on a loopback port. The `serveApplication()` case uses an application double in place of the hosted application. An `EventEmitter` is the double for the process signal registration. A logger double records, for each line, the stop signals that have a handler.

[V] Registers the `SIGINT` and `SIGTERM` handlers after the startup lines and before the `Listening on` line; after `SIGINT` or `SIGTERM`, writes `Stopping after <signal>` and removes both handlers
[V] Given a listen port that another server uses, rejects with the listen error before the `Listening on` line, and no stop handler stays registered
[V] `serveApplication()` with an application double and a signals double writes `Listening on` first, serves a request, writes `Stopping after SIGTERM` after the signal, calls `close` one time with the listener drain, and frees the port

Run only these tests:

```sh
npm run build && node --test dist/test/integration/server-stop-signals.test.js
```

**WorkOS MFA evidence with the pinned SDK** (`test/integration/auth/workos-browser-session-mfa.test.ts`)

These two integration cases connect the real browser session to the pinned SDK and a local WorkOS API fake. They establish the downgrade of existing cookie evidence, not actual MFA completion. Both cases passed in the final complete integration command.

[V] Reading a real SDK session cookie with prior MFA evidence masks it in unproven mode, for both a current and an expired access token
[V] Organization selection preserves identity and emits only replacement cookies without MFA evidence

```sh
npm run build && node --test dist/test/integration/auth/workos-browser-session-mfa.test.js
```

**Slice Google onboarding with WorkOS and organization services** (`test/integration/auth/workos-google-onboarding.test.ts`)

The 34 source and compiled cases passed on 2026-10-15; the final complete-candidate gates also passed. These integration specifications connect the opt-in policy to the real organization directory, change recording, and pinned WorkOS SDK against a local API fake. They establish application collaboration, not real Google or WorkOS service behavior. The policy remains absent from normal hosted composition.

[V] Concurrent eligible callbacks create one explicit User membership, select its organization in each session, and update seats once; repeated callbacks do not rewrite roles
[V] Existing active non-User, pending, and inactive memberships retain roles and status without a new organization session
[V] Other domains, subdomains, suffix domains, malformed addresses, unverified email, and non-Google methods read and change no membership
[V] An existing active User with other roles selects the target organization without a role write; domain normalization accepts surrounding whitespace and uppercase letters
[V] Role removal is not restored on another sign-in; hard deletion permits a later new enrollment
[V] An ambiguous create is recorded as unknown and is not blindly repeated; a read-back of the created active User can reconcile the session
[V] Refresh failure rejects the callback; a later callback selects the existing User without another create
[V] A refresh with another user, another organization, no seal, or a refusal returns no session
[V] Membership read outages or results outside the requested user, organization, and role contract fail before create

```sh
npm run build && node --test dist/test/integration/auth/workos-google-onboarding.test.js
```

**Local HTTPS test server of the hosted live gate** (`test/integration/auth/hosted-live-site.test.ts`)

The earlier eleven source and compiled cases passed on 2026-10-15 with the RHD-01 complete-candidate gates. RHD-02 changes the default front to forward the portal to production and adds the pinned renderer startup prerequisite; its results are pending in the [RHD-02 record](../implementation/rhd-02.md#verification). These integration cases start `LocalHttpsSite` with the real HTTP server. The failed-start and certificate cases stay in the entry file. The sibling test-case modules `hosted-live-site/mcp.ts` and `hosted-live-site/cancellation.ts` add the MCP and lifecycle cases. Their fixture data is in `test/integration/auth/fixtures/https-site-fixtures.ts`. The entry file and the sibling modules send each HTTPS request through one protocol driver, `test/support/drivers/browser/https-client.ts`. The MCP cases connect the real hosted composition and fetch server to the pinned SDK against a local WorkOS fake, with a fetch-operation double. `composeApplicationWithWorkOSFake()` of `test/support/in-process/workos-site.ts` composes that application. They prove HTTP and application collaboration, not real Google or renderer behavior. The complete-site cases listen on port 46443, so the hosted live gate and the manual slice must be stopped first.

[V] Given a missing portal build, start rejects with a setup message and file-system cause and leaves no listener
[V] Given no OpenSSL, start rejects with the spawn error, closes the default application, and leaves no listener
[V] Given certificate files, a logger, and an application function, the HTTPS front serves that certificate and portal, forwards requests, reports handler failure, and closes the application once
[V] An authenticated MCP POST forwards the body and verified identity and returns the result; missing or invalid token and current User-role removal start no protected work
[V] Disconnecting an authenticated MCP client cancels active fetch work and records no success
[V] A client disconnect before response headers cancels its backend request
[V] Streaming headers reach the client before the first chunk; disconnecting after a chunk cancels the upstream stream
[V] A backend failure after a chunk fails the HTTPS response instead of completing with truncated content
[V] Closing with active backend work cancels through application cleanup before the listener deadline and waits for the request to drain

[V] A custom application that ignores the drain argument still keeps site close pending until the response drains
[V] A custom application whose cleanup throws still drains the response before site close reports that failure

Run only these tests:

```sh
npm run build && node --test dist/test/integration/auth/hosted-live-site.test.js
```

Run the integration suite with `npm run test:integration`. `npm run check` does not select it.

## Interface

**Better Auth local provider** (`test/interface/auth/better-auth.test.ts`)

These proofs run the pinned Better Auth 1.7.7 packages with an in-memory `node:sqlite` database. They use the provider's HTTP handler and server APIs. They need no renderer or network access; with `guardOutboundFetch()` of `test/support/isolation/outbound-fetch-guard.ts`, a blocked `fetch` records no outbound request. The [authentication plan](../design/authentication-design.md#pinned-provider-proof) records the proven contracts. The `NODE_ENV` and `TEST` proofs run `dist/test/support/processes/foreign-origin-probe.js` in a new Node process with only that variable. The `NODE_ENV` proof needs the new process, because the provider reads `NODE_ENV` when its modules load. That process also blocks `fetch` and reports its outbound requests.

[V] Rejects public signup over HTTP and from the server API, and rejects email password reset; no account exists
[V] Rejects a duplicate email in another letter case through the private create operation and keeps the original account
[V] Lists each account ID, email, and disabled state without credentials
[V] Resets one user's password and ends that user's sessions; the old password and session fail, the new password signs in the same user, and the peer session stays
[V] Disables one user and ends that user's sessions; sign-in gives `BANNED_USER`, the user ID stays, and the peer can sign in
[V] Registers the approved clients with a server sign-in of an enabled account and then deletes that session; the installation owns the clients, they serve another user, and a disabled account cannot sign in to register
[V] Issues a JWT access token bound to the MCP resource, the user, the client, and the browser session after PKCE authorization with the resource indicator, without a refresh token
[V] Lets the linked resource-server client introspect MCP tokens; refuses a public client and a wrong secret; reports an unknown token inactive
[V] Reports a user's MCP access token inactive after that user's sessions end and keeps the peer's token active
[V] Completes discovery, authorization, and code exchange with the MCP TypeScript SDK 2.3.1 client and a pre-registered public client, without a refresh token; when the token is no longer accepted, the SDK authorizes again, and the live browser session completes that without consent
[V] Refuses dynamic registration, advertises no registration endpoint, and serves the protected-resource and authorization-server metadata
[V] Refuses `offline_access` at authorization and in client registration, refuses the refresh grant in client registration and at the token endpoint, and lists neither in the metadata
[V] Reports a user's MCP token inactive after that user signs out in the browser and keeps the peer's token active
[V] Resets one user's password; that user's old password and MCP token fail, the new password gives a new active token, and the peer's token stays active
[V] Disables one user; sign-in, the exchange of a pending authorization code, a new authorization, a refresh request, and the old MCP token fail, and the peer's token stays active
[V] Rejects a foreign origin, a missing or `null` origin with a cookie, a cross-site sign-in navigation, and a foreign callback URL with HTTP 403
[V] Limits sign-in to three attempts in 10 seconds for each client address with HTTP 429 and `X-Retry-After`; another address can still sign in
[V] Refuses the private admin, client-management, client-secret rotation, and session-JWT routes over HTTP; the resource-server secret still works
[V] Stops startup with `ProviderEnvironmentError` for `BETTER_AUTH_SECRETS`, for `BETTER_AUTH_TRUSTED_ORIGINS` with a foreign origin, and for `BETTER_AUTH_TELEMETRY=1` with a telemetry endpoint; each message names the variable but not its value, and no outbound request occurs
[V] With `NODE_ENV=test` or `TEST=1` in a new Node process, rejects a sign-in with valid credentials from a foreign origin with `403 INVALID_ORIGIN`, adds no session, and makes no outbound request

Run these proofs offline:

```sh
npm run build && node --test dist/test/interface/auth/better-auth.test.js
```

**WorkOS SDK** (`test/interface/auth/workos.test.ts`)

The 38 source and compiled cases passed on 2026-10-15 after the explicit User-create proof was added; the final complete-candidate gates also passed. These proofs run the pinned `@workos-inc/node` 11.0.0 and `jose` 6.2.12 against a local fake of the WorkOS API (`test/support/doubles/workos/workos-fake-api.ts`) and local signing keys (`test/support/doubles/workos/jwt-signing-key.ts`). They show what the SDK sends, how it reads answers, and how it reports failures; they do not show what the WorkOS service does. They need no renderer or network access; with `guardOutboundFetch()` of `test/support/isolation/outbound-fetch-guard.ts`, a replaced `fetch` records no request that leaves the machine. The [authentication plan](../design/authentication-design.md#pinned-workos-sdk-proof) records the proven contracts and the findings.

[V] Gives an AuthKit sign-in URL with the client ID, the exact redirect URI, `response_type=code`, `provider=authkit`, an S256 challenge, and a fresh state and verifier for each call; an organization ID adds `organization_id`
[V] Exchanges a code with the verifier and the API key as `client_secret`, and returns the user, both tokens, and an iron seal that hides the tokens; a refused code throws `OauthException` with `invalid_grant`
[V] Authenticates a seal against the browser key set and returns `sid` as the session ID, the organization, the roles, and the permissions, with one key-set read
[V] Gives `invalid_session_cookie` for a wrong cookie password, a changed or invalid character in the encrypted part, and a value that is not a seal, and `no_session_cookie_provided` for an empty value, without a key-set read
[V] Throws `InvalidCharacterError` for an HMAC part that is not valid base64url, and `Invalid expiration` for an expiration part that is not a number
[V] Gives `invalid_jwt` for an expired token, another issuer, and a forged signature; without the issuer option, accepts another issuer
[V] Throws `ERR_JWKS_NO_MATCHING_KEY`, not a failure result, for a token with an unknown key ID
[V] Throws `ERR_JOSE_GENERIC`, `ERR_JWKS_TIMEOUT` after 5 s, or `TypeError` for a key set that answers 500, does not answer, or refuses the connection
[V] Keeps the browser key set for 10 minutes, so an outage changes no result until then and throws after; reads a new key ID at most once in 5 minutes
[V] Refreshes with the stored refresh token and the current organization, and returns a new seal with the rotated token; the old seal still opens and sends the old token
[V] Switches the organization with a refresh that sends the requested organization
[V] Gives terminal failures for `invalid_grant`, `mfa_enrollment`, and `sso_required`, each after one request with `maxRetries: 0`
[V] Gives retryable failures for 500, 429 (with `retryAfter` 7, or `NaN` for a date), a timeout, and a dropped or refused connection, each after one request
[V] Throws for a 401, another 4xx, and a 5xx answer that is not JSON, instead of a failure result
[V] With the default of 3 retries, sends 4 refresh requests with one generated `Idempotency-Key` and waits at most 60 s for each `Retry-After`
[V] Gives the logout URL with the session ID and the return URL and posts the session revocation; a seal that does not authenticate, also one with an expired access token, gets an error instead of a logout URL
[V] Lists memberships with the exact user, organization, status, and limit query; keeps `role` and `roles`; an answer without `roles` gives no `roles` field
[V] Pages memberships with the `after` cursor; `autoPagination()` returns only the first page after a limit, and reads the first page again and waits 350 ms between pages without one
[V] Lists the roles of an organization with their permissions in one unpaged request
[V] Writes the complete role set with `PUT`, and creates, deactivates, and reactivates memberships, with no `If-Match`, no version, and no `Idempotency-Key` with `maxRetries: 0`
[V] An explicit User membership create sends `role_slug: user` with `maxRetries: 0`, no absence precondition, and no idempotency key, and reads the returned active status and role set
[V] With the default retries, gives each membership create one generated `Idempotency-Key` and each role-set update none
[V] Loses one of two concurrent role-set updates that start from the same read
[V] Sends one role for each invitation and drops a role set
[V] Reads one membership and one user by ID with one GET each; the membership keeps `id`, `organizationId`, `status`, `updatedAt`, `directoryManaged`, and `roles`, and the user its email; a 404 `entity_not_found` throws `NotFoundException` with that status and code
[V] Assigns and removes one role with a POST and a DELETE of the same JSON body (`role_slug`, `resource_type_slug` `organization`, and `resource_external_id`) at `/authorization/organization_memberships/<id>/role_assignments`, without `If-Match` or `Idempotency-Key` with `maxRetries: 0`; `assignRole()` returns the role assignment, and `removeRole()` gives `undefined` for a 204 without a body and for a 200
[V] Reads one organization by ID with one GET to `/organizations/<id>`, and gives its ID and its external ID; the external ID is `null` when the answer has `external_id` `null` and when the answer has no `external_id`
[V] Lists the invitations of an organization with `organization_id`, `limit`, `after`, and `order=desc`, follows the `after` cursor, and reads one invitation by ID; each invitation keeps `token` and `acceptInvitationUrl`, so the directory must drop them
[V] Sends an invitation with exactly `email`, `organization_id`, and `role_slug`; the 400 refusals `email_already_invited_to_organization`, `user_already_organization_member`, and `invalid_role`, without an `errors` list, each throw `GenericServerException` with status 400 and that code, not `BadRequestException`
[V] Resends an invitation with the body `{}` and revokes it with an empty body, and returns each answer; a 400 `invite_not_pending` answer to a revoke throws `GenericServerException` with status 400 and that code
[V] Verifies a Connect token with jose against the AuthKit key set, the exact issuer, the MCP audience, and RS256, and rejects another issuer, another audience, an expired token, a forged signature, and HS256
[V] Accepts an M2M-shaped token without `sid` whose `sub` equals its `client_id`, so the MCP verifier needs its own rule
[V] Refuses a new key ID during the key-set cooldown and accepts it after one new read
[V] Keeps a withdrawn key until the cache age passes and then rejects its tokens
[V] Keeps results through a key-set outage with fresh cached keys; after the cache age or without cached keys, throws a key-set error, not a token rejection
[V] Uses the jose defaults: a 30 s cooldown and a 10 min cache age

Run these proofs offline:

```sh
npm run build && node --test dist/test/interface/auth/workos.test.js
```

**Renderer network policy**

[V] Blocks literal and DNS loopback targets before a connection
[V] Blocks a DNS change, IPv6 loopback, a redirect, a script resource, fetch, XHR, and WebSocket to a blocked address
[V] Allows an IPv4 loopback fixture only inside the test scope, preserves production readiness options, and ignores proxy environment settings

**HTML Fetcher**

[V] Fetches a page without JavaScript (https://quotes.toscrape.com) and returns rendered HTML
[V] Fetches a page with JavaScript (https://quotes.toscrape.com/js/) and returns rendered HTML
[V] Returns a direct fetch result through Lightpanda
[V] Traces a redirect chain through Lightpanda and resolves Markdown links against the final URL
[V] Returns local HTTP 200 content and successful redirects; reports local HTTP 403, 404, 429, and 500 responses as HTTP errors
[V] Reports local 403 and 429 bot challenges as HTTP errors, both directly and after two redirects

The unit suite runs without an installed renderer or public network access:

```bash
pnpm test:unit
```

Use the pinned runtime for the local renderer interface tests. [Runtime setup](../lightpanda-runtime.md#verify-rendering) gives the checksum recipe and separate local fixture and public-site smoke commands. The controlled local interface suite passed 29 tests with Lightpanda 1.0.0 on macOS ARM64 for this change. Other platform binaries were not exercised. The public-site smoke tests remain a separate check.

**LinkeDOM Serialization**

[V] ESM and CommonJS preserve escaped numeric entities, ordinary entities, quotes, and query ampersands after attribute serialization and reparsing

**Sanitizer Deletion Positions**

[V] Reports exact UTF-16 deletion ranges for ANSI passes, Unicode controls, contextual joiners, emoji tags, and BOM handling
[V] Keeps sanitizer output and findings the same when deletion reporting is enabled

**Defuddle Extracted DOM**

[V] Passes decoded selector-based Substack and generated Discourse content to the callback before URL conversion

**Defuddle Emoji Joiners** (`test/interface/defuddle-emoji-joiners.test.ts`)

[V] Keeps the exact woman-technologist code points from contiguous literal, decimal, and hexadecimal input
[V] Keeps a literal joiner in a separate span or text node, including a sequence split across three spans

**Website Fetcher Readiness** (`test/interface/website-fetcher-readiness.test.ts`)

[V] Returns the completed asynchronous DOM after its 500 ms request delay, before the full wait budget
[V] Rejects when overlapping requests prevent network idle, kills the child at 20 seconds, waits for child completion, and returns no partial HTML

**Website fetcher cancellation** (`test/interface/website-fetcher-cancellation.test.ts`)

[V] An already cancelled signal starts no fixture connection or renderer
[V] Cancellation of the real Lightpanda 1.0.0 process waits for its SIGKILL exit and removes the signal listener

Run the applicable local renderer interface cases with the pinned runtime:

```sh
npm run build && node --test dist/test/interface/website-fetcher-cancellation.test.js dist/test/interface/website-fetcher-http.test.js dist/test/interface/website-fetcher-network.test.js dist/test/interface/website-fetcher-readiness.test.js dist/test/interface/website-fetcher-redirects.test.js
```

**Axiom logging** (`test/interface/logging/axiom-logging.test.ts`)

`openAxiomLogging()` of `test/support/in-process/axiom-test-export.ts` runs with the production `OtelLogger`, the real OpenTelemetry SDK, and the OTLP HTTP exporter against a loopback OTLP receiver, never against Axiom. The test needs no Axiom settings and no public network access. The closed-port case takes about 9 seconds, because the exporter retries a refused connection until its deadline.

[V] Given one INFO line, `close()` resolves after one OTLP JSON POST to `/v1/logs` with the Axiom `Authorization` and `X-Axiom-Dataset` headers, the scope name, and the record; the console gets no line
[V] Given a receiver that refuses the export with HTTP 401, the console gets one failure line with the error name and the HTTP status, without the error message or the response body; `close()` rejects with the count, `1 log export`
[V] Given two refused batches, the console gets two failure lines, and `close()` rejects with the plural count, `2 log exports`
[V] Given a closed loopback port, the console gets one failure line with the system error name `ECONNREFUSED`, without an HTTP status or the address; `close()` rejects with the count

```sh
npm run build && node --test dist/test/interface/logging/axiom-logging.test.js
```

## Acceptance

**MCP HTTP fetch tool** (`test/acceptance/mcp/http-fetch.test.ts`, `http-fetch-refusals.test.ts`, `http-fetch-cancellation.test.ts`)

The real SDK client reaches the production HTTP bridge on loopback in modern
2026-07-28 and legacy 2025-11-25. Test initialization supplies the operation's
fetcher and pipeline. `NoAuthProvider` is confined to test support and supplies
fixed synthetic identity fields through the normal verifier/resolver seam.
These cases are offline and renderer-free.

[V] Lists the shared strict schema and returns one exact Markdown text entry with one safe completion record
[V] Refuses invalid named arguments and unknown tools before fetch and records dispatched failures
[V] Preserves Bearer 401, access-decision 403, and operation-level product permission denial before fetch
[V] Preserves safe failures and completed empty success, without titles, warnings, or partial output
[V] Keeps the trusted identity despite forged headers and arguments
[V] Cancels a per-call fetch through HTTP and prevents later work and successful completion

Modern client cancellation aborts its call stream. Legacy cancellation coverage
aborts that stream through the public SDK fetch option. A legacy cancel
notification alone cannot reach a call on a different stateless request server.

**MCP HTTP shutdown and request isolation** (`test/acceptance/mcp/http-shutdown.test.ts`, `http-renderer-shutdown.test.ts`, `http-request-isolation.test.ts`, `http-cancelled-shutdown.test.ts`)

These cases use the real SDK client and HTTP bridge in both eras. Shutdown uses
the application lifetime with a provider cleanup probe. Fetcher, pipeline, and
identity/access collaborators are supplied through public interfaces. These
cases stay offline and use no renderer.

The renderer shutdown cases use the real fetcher with the process and DNS
doubles of `controlledRenderer`. The renderer child is a `RendererChildDouble`, and
the cases check the signals that it records. No renderer executable runs. They
observe the child, readiness timer, abort listener, and delayed process
callback through the real MCP HTTP path.

[V] Cancels active work before listener drain and awaits fetch cleanup before provider close
[V] Refuses new connections, skips later pipeline work, records cancellation once, and permits repeated close
[V] Kills the renderer child and removes its timer/listener once, awaits the process callback before provider close, and refuses late success
[V] Keeps trusted identities, tenants, reasons, signals, exact results, and completion records separate when calls finish in reverse order
[V] Cancels one client call without cancelling a peer; shutdown cancels all active calls, including legacy work
[V] Waits for both independent cleanup tasks even when one finishes first
[V] Rechecks authentication and access after a prior success and never reuses the earlier context after a refusal
[V] After a client cancels a call while the fetcher waits, the server stop that follows the `cancelled` record does not wait for the client connections
[V] RHD-01: a request cancelled during token verification or access resolution stops waiting before the identity call settles and cannot start a tool server after its late result

```sh
npm run build && node --test "dist/test/acceptance/mcp/*.test.js"
```

**RHD-01 protected hosted fetch and bounded waits**

The production hosted opener uses the real WorkOS adapter against a local fake,
trusted test rules, the real cleaning pipeline, the HTTP bridge, and a renderer
process double. The cancellation cases use request and provider doubles at
public boundaries. The CLI deadline cases start the built hosted process with
preloads for stalled cleanup and a residual library handle. Identity-wait cases
prove clean CLI exit before the deadline. These are offline proofs; they
are not WorkOS, real-renderer, image, or Render deployment proofs.

[V] `test/acceptance/mcp/hosted-fetch-tool.test.ts`: a current Connect User lists and calls the tool, gets cleaned Markdown and a safe record, and missing or revoked access is refused before rendering
[V] The same file: an overlapping call gets the safe busy result and a `busy` record; success, failure, and cancellation release the shared slot only after settlement
[V] `test/acceptance/mcp/http-dns-cancellation.test.ts`: client cancellation and shutdown in both protocol eras end the wait before DNS answers and prevent renderer startup
[V] `test/acceptance/mcp/http-authentication-cancellation.test.ts`: disconnect and shutdown stop token/access waits and prevent dispatch after a late result
[V] `test/acceptance/auth/hosted-request-cancellation.test.ts`: disconnect and shutdown stop account session/access waits and prevent the protected operation
[V] `test/acceptance/mcp/hosted-process-shutdown.test.ts`: stalled cleanup or a residual handle causes an error exit at the fixed 10-second hosted CLI deadline, while shutdown during MCP/account/session identity waits exits cleanly
[V] `test/unit/mcp/single-fetch-operation.test.ts`: one shared slot refuses overlap without queuing and returns capacity only after settlement
[V] `test/unit/website-fetcher/website-fetcher-dns-wait.test.ts`: the five-second wait, abort, late completion, residual lookup ownership, and recovery do not change the resolver policy or start late rendering
[V] `test/unit/http/request-cancellation.test.ts`, `test/unit/auth-workos/workos-session-routes-cancellation.test.ts`, and `test/unit/hosted-admin/account-routes-cancellation.test.ts`: request waits release their listeners and do not advance after cancellation

The [RHD-01 record](../implementation/rhd-01.md#verification) gives focused
commands, recorded red steps, and the gate results.

**RHD-02 hosted portal, startup, health, and MCP Origin**

These specifications use the production opener, a static portal fixture, trusted
rules, and a version-command fixture or child-process double. They need no
WorkOS network call. The manager-confirmed focused run passed all 151 cases
across 19 new or changed emitted test files, and the complete acceptance
rerun passed 333 backend and four portal cases. The dedicated container gate
passed all 13 cases and covers the 20th changed test file on local Linux
ARM64. Implementation and verification are complete: the Optional MFA
hosted-live profile passed 77/77 in 16 suites, including the production portal
CSP and sign-out. The [RHD-02 record](../implementation/rhd-02.md#verification)
gives the results. PR #116 is stacked on PR #115; both await owner review.

[V] `test/acceptance/auth/hosted-portal.test.ts`: the public root and built JavaScript load with the production CSP; health is constant; account and MCP still require sign-in
[V] `test/unit/hosted-portal/hosted-portal.test.ts`: startup refuses missing, invalid, symlinked, or empty assets and absent build references; GET/HEAD use the preloaded files, safe missing paths give 404, and other requests retain body, signal, and cleanup
[V] `test/acceptance/auth/hosted-startup.test.ts`: missing renderer, missing or invalid portal, and non-root hosted base prevent listening with safe failures; the public root needs no sign-in, while protected routes retain their refusals
[V] `test/unit/hosted-renderer-startup.test.ts` and `test/interface/hosted-renderer-startup.test.ts`: absolute executable, exact version, fixed timeout and output bounds, safe failure, and telemetry-off behavior
[V] `test/acceptance/auth/hosted-mcp-origin.test.ts`: absent/exact origins keep protected MCP behavior; foreign, malformed, and opaque origins get 403 before WorkOS; metadata stays public
[V] `test/integration/auth/hosted-mcp-origin.test.ts` and `test/unit/application.test.ts`: all MCP methods, repeated/invalid origins, configured port authority, no authentication work on refusal, and unchanged metadata/browser/account/self-hosted delegation

[V] `test/unit/test-support/server-preloads.test.ts`: adding a preload retains existing settings, preserves both preloads in order, and leaves the supplied settings unchanged (two cases, covered by the manager-confirmed unit run)

[V] `test/acceptance/mcp/hosted-process-shutdown.test.ts`: the three held-identity cases retain shutdown under one second, clean exit, and no deadline error, with a 15-second total test allowance and timeout-phase diagnostics

Build before these focused commands. The portal acceptance uses the explicit
fixture mapping; it does not establish the packaged image contract.

```sh
npm run build
node --test dist/test/unit/hosted-portal/hosted-portal.test.js dist/test/unit/hosted-renderer-startup.test.js dist/test/unit/application.test.js dist/test/unit/test-support/server-preloads.test.js
node --test dist/test/interface/hosted-renderer-startup.test.js dist/test/integration/auth/hosted-mcp-origin.test.js
node --test dist/test/acceptance/auth/hosted-portal.test.js dist/test/acceptance/auth/hosted-startup.test.js dist/test/acceptance/auth/hosted-mcp-origin.test.js
```

**Self-hosted fetch tool with real Better Auth** (`test/acceptance/mcp/self-hosted-fetch-tool.test.ts`)

Each test runs the production `serve()` in the test process with `InProcessServer`: real Better Auth on SQLite files, trusted test rules, and the real cleaning pipeline. `RendererProcessDouble` stands in for the Lightpanda process and DNS at the Node `child_process.execFile` and DNS APIs, so no renderer runs. The real SDK HTTP client connects in modern 2026-07-28 and legacy 2025-11-25. These cases are offline and renderer-free.

[V] Given a real Better Auth token in each era, the client lists `getURLAsMarkdown` with the shared schema and gets one exact cleaned Markdown entry; the final URL selects the rules and resolves the links, the requested URL keeps its spelling, the server keeps the rules that it read at startup after the file changes, the renderer gets the production arguments, limits, and environment with `LIGHTPANDA_DISABLE_TELEMETRY=true`, and each call writes one safe completion record
[V] Given forged credentials (a changed token payload or a malformed token), a token that a password reset revoked, and a token of a user that `users disable` disabled, each call gets 401 in both eras, and a banned user with a live session gets 403; no fetch, cleaning, or completion record happens, and a peer with a current token still gets the cleaned page
[V] Given an empty rules file, the ad rules do nothing, and the hidden content is still removed
[V] Given HTML that the sanitizer withholds, HTML deeper than the ad cleaner limit, and a failed render, the client gets exact empty success, `Page processing failed`, or `Page fetch failed` without partial Markdown; no record holds a cause or page text

```sh
npm run build && node --test dist/test/acceptance/mcp/self-hosted-fetch-tool.test.js
```

**Renderer setup report** (`test/acceptance/mcp/renderer-setup-report.test.ts`)

Each test runs the production `serve()` in the test process with `InProcessServer`, real Better Auth on SQLite files, and trusted test rules. An authorized SDK client calls `getURLAsMarkdown`. The first two tests let Node start a missing executable and a file without execute permission, so the server gets the real `ENOENT` and `EACCES`; no renderer runs. Their address-literal URL needs no DNS lookup. The third test uses `RendererProcessDouble`. These cases are offline.

[V] Given `LIGHTPANDA_BIN` that names a missing executable, two calls each get `Page fetch failed` and a `fetch_failed` record, and the operator log has exactly one error line: the report that names the missing renderer (`ENOENT`) and the runtime guide, without the URL, the reason, the token, the executable path, the renderer arguments, or the process error
[V] Given a server that reported its missing executable, after the operator puts a file without execute permission at that path, two more calls still get `Page fetch failed` and `fetch_failed` records, and the log gets one more report, which names an executable that cannot start (`EACCES`)
[V] Given a renderer process double, an HTTP 404 error and a blocked destination each give `Page fetch failed` and a `fetch_failed` record, and the server writes no renderer setup report

```sh
npm run build && node --test dist/test/acceptance/mcp/renderer-setup-report.test.js
```

**Self-hosted startup with the ad rules file** (`test/acceptance/mcp/self-hosted-rules-startup.test.ts`)

Each test starts the built server, `dist/src/index.js`, as a separate Node process with outbound access denied and a temporary data directory. A preload can make the native rule parser fail with a private message.

[V] Given `AD_RULES_FILE` that is unset, empty, a relative path, a missing file, a directory, or a file that is not UTF-8, the server stops with status 1 before it listens; its only `FATAL` line is the matching rules message, it shows no path or rule text, and it creates no data
[V] Given an installation with one account and a missing rules file, the server stops with status 1 before it listens and changes no data file; a later `users list` shows the account
[V] Given a native rule parser that fails with a private message, the server stops with status 1 before it listens; its only `FATAL` line is `The ad cleaner could not load the rules in AD_RULES_FILE.`, it does not show the private message, and it creates no data
[V] Given an empty file or a file with only a comment, the server listens, an MCP request without a token gets the Bearer challenge, and `SIGTERM` stops it with status 0
[V] Given `LIGHTPANDA_BIN` that names a missing executable, the server listens, because startup does not run or check the renderer, and `SIGTERM` stops it with status 0

**Server-only modules** (`test/acceptance/mcp/server-only-modules.test.ts`)

The built entry point runs in separate processes with an import hook that blocks the rules reader, the renderer, the cleaning pipeline, and adblock-rs. Operator commands must remain isolated from those modules. Both production server branches must load the protected fetch composition. RHD-01 focused verification passed.

[V] Given the guard, the operator adds two users, lists them, registers a client, resets a password, and disables a user; each command exits with status 0, loads no server-only module, and writes no renderer setup report
[V] Given the guard, WorkOS settings, and trusted rules, hosted startup fails before listening because it must load the fetch composition; without the guard, missing trusted rules stop hosted startup before listening
[V] Given the guard and trusted rules, the self-hosted server stops with status 1 before it listens, and its `FATAL` line shows the guard message, so the guard sees the modules that the server loads

```sh
npm run build && node --test dist/test/acceptance/mcp/self-hosted-rules-startup.test.js dist/test/acceptance/mcp/server-only-modules.test.js
```

**Renderer gate setup** (`test/acceptance/mcp/renderer-gate-setup.test.ts`)

The test runs the built renderer gate file in a separate `node --test` process with bad prerequisites. It needs no renderer.

[V] Given `LIGHTPANDA_BIN` that is unset, relative, a missing file, or an unsupported Lightpanda version, the explicit renderer gate fails with its setup error, and no gate test passes, is skipped, or is left as todo

```sh
npm run build && node --test dist/test/acceptance/mcp/renderer-gate-setup.test.js
```

**Renderer gate** (`test/acceptance/mcp/get-url-as-markdown.runtime.ts`)

The production `serve()` runs in the test process with real Better Auth, the real cleaning pipeline, trusted test rules, and the pinned Lightpanda 1.0.0 from `LIGHTPANDA_BIN`. The pages are local HTTP fixtures on `127.0.0.1`. The test-only `permitIPv4Fixture` seam lets the renderer reach only that address. The gate needs no public network access and no Axiom credentials.

[V] Given the pinned renderer and a real Better Auth token in each protocol era, after the user signs in and consents on the bundled pages, the client gets exact cleaned Markdown from a local JavaScript page, and the server writes one safe completion record
[V] Given a local server whose environment does not set `LIGHTPANDA_DISABLE_TELEMETRY`, with a new `HOME`, the client gets exact cleaned Markdown from a local JavaScript page, and the renderer run has telemetry off: it writes no telemetry install ID (`iid`) in its data directory, so it starts no telemetry sender and tries no connection to `telemetry.lightpanda.io`
[V] Given a redirect that changes the host and the path, `requestedUrl` keeps the accepted spelling, and the final URL selects the ad rules and resolves the relative links
[V] Given hidden content, HTML that the sanitizer withholds, an HTTP error, and a DOM deeper than 256 levels, the hidden content is removed, withheld HTML gives exact empty success, and the failures give `Page fetch failed` and `Page processing failed` without partial Markdown; the server writes no renderer setup report
[V] Given a page whose script completes after 6.5 seconds, the client gets the rendered Markdown within the fixed 20-second readiness allowance
[V] Given a page that never reaches network idle, the child stops before the fetch completes, the client gets `Page fetch failed` without partial Markdown, and the server writes one safe `readiness_timeout` report and one `fetch_failed` completion record
[V] Given a page that keeps the renderer waiting, a modern client cancellation stops the renderer child, the client gets no Markdown, and the server writes one `cancelled` record
[V] Given a legacy call that keeps the renderer waiting, server shutdown cancels it; the renderer child stops before the server finishes stopping, and the server writes one `cancelled` record

Run the renderer gate with the pinned runtime. The `.runtime.ts` name keeps the file out of `npm test` and `npm run test:acceptance`:

```sh
npm run test:mcp:renderer
```

**Work slice: basic MCP URL fetch** (`test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.test.ts`)

`createWorkSliceApplication()` composes the production parts with the mock provider and the trusted rules fixture, `test/support/fixtures/trusted-ad-rules.txt`. The entry point `basic-mcp-url-fetch.ts` exports `createWorkSliceApplication()` and runs only when it is executed directly. The test starts the production HTTP bridge itself. `RendererProcessDouble` stands in for the Lightpanda process and DNS, and a recording logger stands in for the log. The real SDK HTTP client connects in modern 2026-07-28 and legacy 2025-11-25. These cases are offline and renderer-free.

[V] Given the work-slice application with the mock provider, the trusted rules fixture, and a renderer double that serves `https://news.example/story`, when an MCP client in each protocol era with the token `any-token` lists the tools and calls `getURLAsMarkdown` with that URL and a reason, then the client gets the cleaned Markdown without the paragraph that the fixture rule for `news.example` removes, the log has the started line, the completed line, and one completion record, and `close()` stops the application
[V] Given the work-slice application, when a request has no `Authorization` header, then it gets 401 with a Bearer challenge, a request to another path gets 404, no renderer starts, and the log has no fetch line

The manual entry point `basic-mcp-url-fetch.ts` next to this file is not a test, and the [README of the slice](../../test/acceptance/work-slice/basic-mcp-url-fetch/README.md) describes it.

```sh
npm run build && node --test dist/test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.test.js
```

**Work slice: auth WorkOS MCP URL fetch** (`test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.ts`)

`composeWorkSliceApplication()` composes the production hosted composition with WorkOS, `composeWorkOSApplication()`, with the fetch tool as its `buildServer`. In the test, the fetch tool uses the trusted rules fixture, and `fetchOperationSpy()` writes its fetch lines. The entry point `auth-workos-mcp-url-fetch.ts` exports `composeWorkSliceApplication()` and runs only when it is executed directly. The test starts the production HTTP bridge itself. `WorkOSFake` gives the pinned SDK a local fake of the WorkOS API with the organization `org_01ACME` (Acme) and the sign-in method `GoogleOAuth`. The browser signs in through the server with `signInThroughServer()` and `HostedBrowser`. `RendererProcessDouble` stands in for the Lightpanda process and DNS, and a recording logger stands in for the log. The real SDK HTTP client connects in modern 2026-07-28 and legacy 2025-11-25. These cases are offline and renderer-free. They prove the application side, not WorkOS behavior: the manual run must separately show Google sign-in, Claude Code registration and browser consent, the real renderer, and Axiom delivery. The separate real Google/client/Axiom manual walk passed; the validation record states its evidence limits. The file has five cases: the first case runs in each protocol era.

[V] Given the slice application, Ada with the role `user` in Acme, and a renderer double that serves `https://news.example/story`, when Ada signs in with Google through the server, then her session is signed in to Acme with `mfaCompleted: false`, and her portal access names Acme and the role `user`; when an MCP client in each protocol era with her Connect token for Acme lists the tools and calls `getURLAsMarkdown` with that URL and a reason, then the client gets the cleaned Markdown without the paragraph that the rules remove, the log has the started line, the completed line, and one completion record with the authority `workos:client_test`, the subject `user_01ADA`, the tenant `workos:client_test:org_01ACME`, and the status `success`, and `close()` stops the application
[V] Given Dee with a non-`thermus.ai` Google address and no membership, sign-in creates no automatic membership, portal access is refused, and the organization page gives onboarding guidance; her Connect token for Acme gets 403 `access_denied` without a renderer or fetch line; after an external change gives her a User membership, the next MCP request returns Markdown and records her WorkOS identity
[V] Given no token, a browser token of Ada, and a Connect token for another resource, each call of `getURLAsMarkdown` gets 401 with a Bearer challenge that names the protected-resource metadata, no renderer starts, and the log has no fetch line; the metadata names the MCP resource and the AuthKit issuer of the world as its only authorization server
[V] Given Ben with Admin only in Acme, his Connect token gets 403 `access_denied` at the tool, no renderer starts, and the log has no fetch line

The manual entry point `auth-workos-mcp-url-fetch.ts` next to this file is not a test, and the [README of the slice](../../test/acceptance/work-slice/auth-workos-mcp-url-fetch/README.md) describes it.

```sh
npm run build && node --test dist/test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.js
```

**Slice sessions always have unproven MFA** (`test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mfa.test.ts`)

These two offline acceptance cases exercise the slice composition with the real HTTP-facing application and a WorkOS API fake. The slice remains unproven even when provider settings explicitly select Required. These cases passed in the final complete acceptance command.

[V] Password and Google sign-ins with User, Admin, and Super Admin keep product access and false session MFA evidence
[V] Members, invitations, billing, and a grant POST are refused without changing memberships

```sh
npm run build && node --test dist/test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mfa.test.js
```

**Hosted WorkOS Optional and Required MFA contracts** (`test/acceptance/auth/hosted-workos-mfa-policy.test.ts`)

These three offline acceptance cases verify the provider setting through normal hosted composition. `serveWorkOSSite()` of `test/support/in-process/workos-site.ts` serves it behind the real HTTP server on a loopback port. The Optional behavior is the default; only explicit Required settings can use the password-MFA contract. These cases passed in the final complete acceptance command.

[V] Omitted and explicit Optional policy give Password sessions no MFA evidence and refuse the members page
[V] Explicit Required policy preserves positive administration behavior for the password-MFA contract

```sh
npm run build && node --test dist/test/acceptance/auth/hosted-workos-mfa-policy.test.js
```

**Automatic slice Google onboarding** (`test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-onboarding.test.ts`)

The three source and compiled cases passed on 2026-10-15; the final complete-candidate gates also passed. These three offline acceptance specifications use the real hosted composition; the slice case starts its HTTP server with a WorkOS API fake and renderer double. The case of the normal hosted composition starts it with `serveWorkOSSite()` of `test/support/in-process/workos-site.ts`. A trusted Google result enters through the browser callback before a separately minted Connect token calls MCP. It does not complete the real client OAuth flow.

[V] Given a new verified `thermus.ai` Google user without a membership, the callback grants explicit User access and selects the slice organization; `/session` has that organization without MFA evidence, portal access succeeds, and a separate organization Connect token returns Markdown; a Connect token without an organization is refused
[V] Normal hosted composition without a policy signs in the same eligible user without creating a membership or granting portal access
[V] Missing `THERMUS_SLICE_ORGANIZATION_ID` stops slice composition before any enrollment request

```sh
npm run build && node --test dist/test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-onboarding.test.js
```

**Direct auth import boundaries** (`test/acceptance/architecture/auth-boundaries.test.ts`)

The tests use the existing ESLint configuration against source snippets at the
protected paths. They check direct static and type imports, named/type/star/namespace
re-exports, and literal dynamic imports. Computed imports and transitive dependencies
are outside this check.

[V] Refuses provider imports in shared auth and the three neutral local files, including installed provider packages and subpaths
[V] Refuses transport implementations and MCP SDK packages in shared auth, while allowing the HTTP client-address contract
[V] Refuses provider and local command/parser implementations in MCP and hosted-account consumers, also the WorkOS provider files and `@workos-inc/node`
[V] Allows public contracts, neutral config, organization use cases, the HTTP header, provider-owned browser adapters, and composition roots
[V] Checks exact protected paths and path segments without refusing similar unrelated names

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/architecture/auth-boundaries.test.js
```

**Test type boundaries** (`test/acceptance/architecture/test-type-boundaries.test.ts`)

The tests use the same ESLint configuration against source snippets at example
paths under `test/`. They check the rules D2 and D3 of the
[test code layout](test-code-layout.md#dependency-rules): the rules of the test
type axis. The three architecture specifications share the import forms and the
assertions of `test/acceptance/architecture/fixtures/import-guards.ts`. Computed
imports and transitive dependencies are outside this check.

Since 2026-10-15, rule D2 has no exception. The unit test of the work-slice
fetch lines imports them from test support. Thus the lint block of the
exception and its three cases are gone. One case shows that the former
exception is refused.

[V] D2: refuses an import of another test type from each of the four test types; allows support code, own fixtures, the same type, `src`, and packages
[V] D2, the former exception: `test/unit/test-support/fetch-operation-spy.test.ts` may not import the entry point of either work slice; it may import `test/support/doubles/mcp/fetch-operation-spy.ts`
[V] D3: refuses the fixtures of another unit package, also from a fixture file; allows own fixtures, shared support fixtures and doubles, and the package fixtures from a nested folder
[V] Checks exact path segments without refusing names that only resemble a test type folder

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/architecture/test-type-boundaries.test.js
```

**Test support boundaries** (`test/acceptance/architecture/test-support-boundaries.test.ts`)

The tests use the same ESLint configuration and the same import forms against
source snippets at example paths under `test/`, most of them under
`test/support/`. They check the rules D1 and D4 to D7 of the
[test code layout](test-code-layout.md#dependency-rules): the rules of the
support layer axis. Computed imports and transitive dependencies are outside
this check.

[V] D1: refuses an import of a test type folder from `test/support/`, also through `test/`; allows `src`, packages, and support code
[V] D4: refuses an import of `test/support/dsl/` from `test/support/drivers/`, also through `support/` and `test/support/`; D1 still applies; allows `src`, packages, and the other support folders
[V] D5: refuses an import of `test/support/dsl/` or `test/support/drivers/` from `test/support/doubles/` and `test/support/fixtures/`, also through `support/` and `test/support/`; D1 still applies; allows `src`, packages, and the other support folders
[V] D6: takes the scripts that the sites send into containers from `test/support/processes/module-paths.ts`, today the three container scripts in `test/support/container/`; D6 covers each one, refuses each of its imports that is not a `node:` module, and allows `node:` modules; a new script path in `module-paths.ts` without a D6 entry in the ESLint configuration fails the specification
[V] D6, the identity preload: `test/support/container/hosted-image-identity.ts` runs in the server process of the hosted image, not alone in a container, so D6 does not cover it, and D1 allows its imports of `src`
[V] D7: refuses each `*.test.ts` file under `test/support/` as a whole, also in `drivers/` and `doubles/`; allows a test of support code in `test/unit/test-support/`
[V] Checks exact path segments without refusing names that only resemble a test type folder or a support folder

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/architecture/test-support-boundaries.test.js
```

**MCP access context** (`test/acceptance/auth/mcp-access.test.ts`)

A real MCP client calls MCPServer through its HTTP fetch interface. Doubles stand in for the identity verifier and the access resolver.

[V] Given two members of different organizations, each call uses only its verified user and trusted tenant, also with forged tenant headers and arguments; AuthInfo.extra carries the actual verified claims
[V] Given independent Super Admin and User grants, the context holds both grants and every permission that they give
[V] Given Admin and Super Admin without User, the protected tool refuses before any fetch or clean step
[V] Given an inactive membership, the server denies access with HTTP 403 before any request tool exists
[V] Given no token or a rejected token, the client must authenticate; no access resolution or protected work runs
[V] Given an access lookup outage, the client gets a generic server error and no protected work runs

**MCP failure reports** (`test/acceptance/auth/mcp-failure-reports.test.ts`)

A real MCP client calls MCPServer through its HTTP fetch interface with a bearer token and a session cookie. Doubles stand in for the identity verifier, the access resolver, and the operator failure callback.

[V] Given an identity provider outage or an access lookup outage, the client gets a generic server error, and the operator gets one report that names the failed step, keeps the cause, and holds no bearer token or session cookie
[V] Given a rejected token, a token without the required scope, or an inactive membership, the client is refused and the operator gets no failure report

**Free billing** (`test/acceptance/billing/free-billing.test.ts`)

The tests use `BillingFree` through the `Billing` interface. They do not cover paid billing.

[V] Given a new hosted organization, its billing is on the free plan, and no seat is billed
[V] Given active User seats that go from 3 to 5, to 4, and to 0, each update confirms the free plan with no billed seat
[V] Given a repeated count or an older count, the result does not change
[V] Given two organizations, a seat change in one does not change the other

`npm run test:acceptance` runs every acceptance test, except the container gate suite, which it skips. `npm run check` does not select the acceptance directory.

**Hosted startup with WorkOS** (`test/acceptance/auth/hosted-startup.test.ts`)

AUTH-06 replaced the placeholder specification, `hosted-placeholder.test.ts`. Each test starts the built server, `dist/src/index.js`, as a separate Node process with hosted settings. The process refuses outbound network access and reports each attempt. These offline tests are no proof of WorkOS behavior and no hosted live gate pass. RHD-01 supplies trusted fixture rules for normal hosted startup and adds a missing-rules refusal case; focused verification passed.

[V] With valid WorkOS settings but no trusted rules file, startup stops before listening with the safe `AD_RULES_FILE` error
[V] Without WorkOS settings, startup stops before it listens with a `FATAL` line that names each missing WorkOS setting, and the server uses no network
[V] With refused WorkOS values, startup stops before it listens; the line names each setting and its rule but not the value
[V] With valid WorkOS settings, forged bearer tokens, cookies, organization IDs, and form input give no access or session: MCP gets 401 with the Bearer challenge of the metadata, each account, organization, member, invitation, and billing path gets 401, a forged callback gets 400, a forged session cookie is only cleared, the output shows no secret or tenant, and the server uses no network
[V] The sign-in redirects to the WorkOS AuthKit sign-in with the client ID, the registered redirect URI, an S256 challenge, a state, and a sign-in cookie; the protected-resource metadata names the AuthKit issuer; the log names the client and the issuer; no network is used
[V] Test and demonstration settings (`NODE_ENV=test`, `AUTH_MODE=mock`, `THERMUS_DEMO`, and a test session setting) with the session cookie, form token, and organization values of the doubles still ask for a sign-in without a cookie, and the output names no organization, tenant, or user
[V] An invalid common setting, also with every WorkOS setting, stops startup before it listens with a `FATAL` line that names the setting and the rule but not the value

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/hosted-startup.test.js
```

**Hosted WorkOS composition** (`test/acceptance/auth/hosted-workos.test.ts`)

The real hosted composition with the WorkOS provider runs behind the real HTTP server on a loopback port. `serveWorkOSSite()` of `test/support/in-process/workos-site.ts` starts it. `test/support/doubles/workos/workos-fake.ts` gives the pinned SDK a local fake of the WorkOS API with users, memberships, the hosted roles, sign-ins, refreshes, and AuthKit-signed Connect tokens. The hosted roles are the role catalog of `test/support/fixtures/hosted-roles.ts`. `HostedBrowser` keeps the cookies of each answer. These tests prove the application side, not WorkOS behavior; the hosted live gate proves the flows against WorkOS.

[V] A sign-in through the server and the callback give one sealed `HttpOnly`, `Secure`, `SameSite=Lax` session cookie, clear the sign-in cookie, and give the portal session the profile, the organization, the MFA evidence of the password sign-in, and a form token
[V] A callback with another state, without the sign-in cookie, with an AuthKit error, or with a refused code gives 400 and no session
[V] Only User gives product access to the protected portal request; Admin only, the default role, and no membership get 403, and a removed membership denies the next request of an existing session
[V] A signed-in user without a membership gets the onboarding guidance, and each tenant page stays refused
[V] An expired access token gives a refresh with one new session cookie and the same form token
[V] An ended session gives 401 and a cleared cookie; a refresh outage gives 500, keeps the cookie, and the session works after the outage
[V] The sign-out from the site origin with the form token clears the cookie and redirects to the WorkOS logout URL of the session; another origin or another token changes nothing
[V] At the MCP endpoint, Connect tokens of User in the organization of the token are served; Admin only, the default role, no organization, and no membership get 403
[V] A browser token, an M2M-shaped token, an expired token, a token for another resource, and no token get 401 with the Bearer challenge of the metadata
[V] The protected-resource metadata names the MCP resource and the AuthKit issuer
[V] A browser session in one organization and an MCP token in another each keep their own organization
[V] A membership read outage gives 500 without protected work at the MCP endpoint and the portal request, and operator reports without the token
[V] With a `buildServer` in the parts of `composeWorkOSApplication()` that gives a test-only tool, the Connect token of a User lists that tool; without a `buildServer` in the lower-level test composition, the endpoint has no tool list: `tools/list` gets HTTP 404 with the JSON-RPC error -32601 "Method not found"
[V] `openWorkOSConnection()` gives the WorkOS settings of the environment and writes one operator line that names the client and the AuthKit issuer; without WorkOS settings, it rejects with the settings error and writes no line

Since 2026-10-15, `composeWorkOSApplication()` takes the parts record `{ logger, buildServer? }` as its third argument. `openWorkOSConnection()` is its own export (decision D6 of the [auth WorkOS MCP URL fetch plan](../implementation/auth-workos-mcp-url-fetch-plan.md)). The last two cases cover these seams. The RHD-01 acceptance file `test/acceptance/mcp/hosted-fetch-tool.test.ts` covers the production opener; the development work-slice test covers its separate composition.

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/hosted-workos.test.js
```

**Hosted WorkOS organization onboarding and selection** (`test/acceptance/auth/hosted-workos-organizations.test.ts`)

AUTH-07W added these specifications. The real hosted composition with the WorkOS provider and the WorkOS organization reads, `composeWorkOSApplication()`, runs behind the real HTTP server on a loopback port. `serveWorkOSSite()` of `test/support/in-process/workos-site.ts` starts it. The local fake WorkOS API of `test/support/doubles/workos/workos-fake.ts` answers the membership reads of a user with the explicit statuses, in pages by the `after` cursor (`membershipPageSize`), and with the organization names (`organizationNames`). The browser signs in through the server with `signInThroughServer()` of `test/support/dsl/workos-sign-in.ts`, which `hosted-workos.test.ts` uses too, and `HostedBrowser` keeps the cookies of each answer. These tests prove the application side, not WorkOS behavior; the hosted live gate proves the same flows against WorkOS.

[V] Given signed-in users without an authorized active organization in WorkOS (no membership, only an inactive membership, or only the default role), each gets the invitation and operator guidance without an organization or a form, and the protected portal request, the member and invitation pages, and the MCP endpoint refuse each of them, with no default tenant or role
[V] Given a member whose memberships WorkOS gives on several pages, with User and Admin in one organization, User in a second, an inactive membership in a third, and only the default role in a fourth, only the first two are offered, with their WorkOS names; the selection of the second gives 303 to the portal with a new session cookie, and the portal and the billing page check the current grants there
[V] Given forms that name the inactive organization, the default-role organization, the organization of another user, or an unknown organization, also with forged organization values in the query and the headers, each selection gets 403, WorkOS gets no switch, and the session keeps its organization
[V] Given memberships that change in WorkOS after the organization page was shown, the current read decides: the deactivated organization is refused without a switch, and the organization of a new membership is selected
[V] Given only Super Admin in an organization, its selection for the billing page opens the billing page with the Free plan, but the protected portal request and the MCP endpoint refuse it: no User grant is inferred
[V] Given a selection from another origin, without an origin, or with another form token, each gets 403 before any organization read, and WorkOS gets no switch
[V] Given a session whose access token expired, a selection, a refused selection, and a WorkOS membership outage each answer with the refreshed session cookie: the 303, which also has the cookie of the switch after it, the 403, and the 500 failure page with an operator report; an outage never shows the onboarding guidance

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/hosted-workos-organizations.test.js
```

**Hosted WorkOS organization administration** (`test/acceptance/auth/hosted-workos-administration.test.ts`)

AUTH-08W added these specifications. The real hosted composition with the WorkOS provider and the WorkOS organization administration, `composeWorkOSApplication()`, runs behind the real HTTP server on a loopback port. `serveWorkOSSite()` of `test/support/in-process/workos-site.ts` starts it. The local fake WorkOS API of `test/support/doubles/workos/workos-fake.ts` keeps organizations, users, the roles of each membership as single-role assignments, and invitations, as the probes of WorkOS staging showed. A test can repeat a membership on the next page (`membershipPageOverlap`) and make the later member pages fail (`laterMembershipPageOutage`). The memberships of Acme and Globex are the same as in `test/integration/auth/workos-provider-administration.test.ts`. Acme has the external ID `customer-acme`, as each customer organization of the operator runbook has one, and the fake accepts a role write on Acme only when it names the resource of Acme by that external ID. The browser signs in through the server with `signInThroughServer()`, and `HostedBrowser` opens the pages and submits their forms. The operator log keeps the change records. These tests prove the application side, not WorkOS behavior; the hosted live gate proves the same flows against WorkOS.

[V] Given Sam with only Super Admin and a sign-in with MFA, its members page offers no User change; Sam grants Admin to itself and then User, each with 303 and one single-role assignment on the resource of Acme, named by its external ID; the User seats go from 3 to 4, and each change has one record without a credential
[V] Given Cal with only Admin, Sam with only Super Admin, and Dan with both, a forged Admin grant of Cal and a forged User grant of Sam get 403 without a WorkOS write, and the Admin grant of Dan to Bea is applied
[V] Given Dan with Admin and Super Admin, Dan revokes its own Admin and grants it again with the Super Admin that it kept; the revoke removes only Admin, and the User forms go away with it and come back after the regrant
[V] Given Ada and Hal with User and Admin, each with a browser session and an MCP token, after Dan revokes Admin from Ada and User from Hal, the next Admin request of Ada and the next MCP request of Hal get 403, while Ada keeps MCP access and Hal its Admin pages
[V] Given Bea with only User in Acme and User in Globex, after Hal removes its last grant in Acme, WorkOS keeps the membership with only the default role; Bea gets 403 in Acme at the next request and has no seat there, and keeps its identity, Globex, and its Globex MCP access
[V] Given a members page of Dan, a post after WorkOS changed Bea and a repeated post of an applied grant form after a later revoke each get 409 without a WorkOS write, so no old form restores a revoked grant
[V] Given Dan in Acme, forged posts that name the inactive Eve, memberships of Globex, Super Admin, or the actions disable, deactivate, and reset-password each get 403; WorkOS gets no write, and no grant changes; the inactive membership has no change form
[V] Given a sign-in without MFA evidence, the members and invitations pages and a grant post with the form token of the session each get the 403 MFA notice, and WorkOS gets no member, invitation, or role read or write
[V] Given Dan, a User invitation of a new address, a repeat in another letter case, an Admin invitation of that address, and an Admin invitation of the active Ada give one accepted WorkOS send with only User, no send for the repeat, and 409 address in use for the two sends that WorkOS refuses; the resend and the revoke are each one WorkOS change; the page shows the state that WorkOS gives, and no page or log line holds the token or the link
[V] Given Eve with an inactive membership that had User and Admin, after Hal invites Eve as User and Eve accepts in AuthKit, the membership is active with only User; no earlier Admin returns, the invitations page shows the acceptance, the User seats count Eve, and its MCP access works
[V] Given Cal with only Admin, a User invitation whose expiry passed while WorkOS still says pending, and a pending Admin invitation, the page offers only "Invite as User" and shows the User invitation as expired and the Admin invitation as pending; a forged Admin invitation gets 403 and a resend of the expired User invitation 409, without a WorkOS change
[V] Given WorkOS member pages of two that repeat one membership on the next page, the members page counts each active User membership once, Ada, Bea, and Hal, and Admin-only, Super-Admin-only, default-role, inactive, and pending memberships count zero; each member read names the organization and the three statuses
[V] Given a WorkOS outage on a later member page, the members page and a User grant to Gus each get the 500 failure page with an operator report and no partial count; the applied grant keeps its record although its seat update failed

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/hosted-workos-administration.test.js
```

**Hosted organization onboarding and selection** (`test/acceptance/auth/hosted-organizations.test.ts`)

Each test starts the shared site of `test/support/in-process/hosted-organization-site.ts` with `serveOrganizationSite()`: the real hosted composition behind the real HTTP server, `startHttpServer()`, on a loopback port. `HostedBrowser` sends each request with `node:http` and keeps the cookies of each answer, as a browser does. Doubles stand only at the provider boundaries. `BrowserSessionStore` is a stateful browser session whose cookie key changes at each refresh, as with rotating refresh tokens, so a browser that does not get the new cookie is signed out. `MembershipDirectoryDouble` reads one configured set of memberships for access resolution and for the organization list. A real MCPServer verifies tokens with `IdentityVerifierSpy` and runs a test-only tool. `AccountOperationSpy` gives the selection destinations, which each check their own permission. No account request may fail: a failure report fails the test. No WorkOS setting, SDK, or credential exists. These offline tests prove application policy, not WorkOS behavior, and are no hosted live gate pass.

[V] Given signed-in users with no membership, an inactive membership, or only a role without an application permission, the organization page tells them to accept an invitation or to contact the operator and offers no organization; each tenant page gets 403, with no default tenant or role, and the 403 page links to the organization page
[V] Given User access in one organization, Admin access in a second, and an inactive membership in a third, only the two active organizations are offered; the selection of the second gives 303 with a new session cookie to the User administration page, where only that organization and its own permissions apply, and the page then marks it as selected
[V] Given forms that name an inactive membership, an organization of another user, or an unknown organization, also with forged organization values in the query and headers, each selection gets 403, and the session keeps its organization without a switch
[V] Given only Super Admin in an organization, its selection for the billing page gives billing and Admin-grant administration there, but the product page, User administration, and the protected MCP tool stay refused; no Admin or User grant is inferred

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/hosted-organizations.test.js
```

**Hosted organization requests** (`test/acceptance/auth/hosted-organization-requests.test.ts`)

These tests use the same site behind the real HTTP server on a loopback port, with the same doubles. The failure reporter records each report. These offline tests prove application policy, not WorkOS behavior, and are no hosted live gate pass.

[V] Given a session that the provider refreshes at each request, selection posts from another site or without an origin, without the form token or with a wrong one, or with an invalid return destination or an extra field are refused without a switch, and the refreshed session cookie still reaches the browser; a valid post then gets the refreshed cookie and then the cookie of the switch, the browser keeps the switched session, and no failure is reported
[V] Given an ended session, the organization page gets 401 with a cookie that clears the session; given an outage of the session lookup, the organization page and a selection get a server failure without a cookie and without a sign-in request, and the session stays; no organization is read or switched
[V] Given a Super Admin that selected an organization, no route creates, resumes, renames, or changes the settings of an organization: a POST to the organization page gets 405 with `Allow: GET, HEAD`, a selection with an organization name, a settings value, or a resume value gets 400, `organizations/new`, `organizations/settings`, and `organizations/resume` get 404 because no such route exists, the session gets no further switch, and no failure is reported

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/hosted-organization-requests.test.js
```

**Hosted grant management** (`test/acceptance/auth/hosted-grants.test.ts`)

Each test of this file and the three files below starts the shared site behind the real HTTP server on a loopback port with `serveAdministrationSite()` from `test/support/dsl/hosted-administration.ts`. The site has the memberships of the AUTH-08 tests, the MCP token of five Acme members for Acme and of two of them also for Globex, and a failure reporter that records each report. `HostedBrowser` opens the members and invitations pages and submits their forms, as a person does. The doubles are the doubles of the organization tests: `BrowserSessionStore`, which also keeps the MFA evidence of each session; `MembershipDirectoryDouble`, one stateful directory of memberships, grants, revisions, and invitations that also resolves access; and `IdentityVerifierSpy` for the real MCPServer with a test-only tool. `AccountOperationSpy` gives the product page. The site keeps each change record. No WorkOS setting, SDK, or credential exists. These offline tests prove application policy with doubles, not WorkOS behavior, and are no hosted live gate pass.

[V] Given a Super Admin with no other grant, the members page offers no User change; it grants Admin to itself and then, with that Admin authority, User to itself, each with 303 to the members page and without another person; the product page and the MCP tool stay refused until the User grant, also with Admin, and then both work; both grants are recorded
[V] Given User plus Admin with a browser session and MCP tokens in two organizations, after a Super Admin revokes the Admin grant, the next members page and a form shown before are refused, while the product page and the MCP tool still work; the other organization keeps its grants and its MCP access, and the revoke and the refused change are recorded
[V] Given User plus Admin, after the Admin revokes its own User grant, its members page still works, and the product page and the MCP tool are refused on the next request
[V] Given User, Admin, and Super Admin, the member revokes its own Admin grant, then has no User change on its members page, and grants Admin to itself again through its remaining Super Admin authority, without another person; its User grant and its MCP access stay
[V] Given a browser session and MCP tokens of a User in two organizations, after an Admin removes its last application grant in the selected organization, the next product and MCP requests there are refused with no default access; the membership stays active with only the default role, the organization page offers only the other organization, and there the selection, the product page, and the MCP token still work

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/hosted-grants.test.js
```

**Hosted grant change refusals** (`test/acceptance/auth/hosted-grant-refusals.test.ts`)

[V] Given an Admin without Super Admin, forged forms that grant Admin or Super Admin, revoke the Admin or Super Admin grant of a combined-role member, or deactivate, disable, or reset that member each get 403 with the refusal notice; `members/deactivate`, `members/disable`, and `members/reset` get 404 because no such route exists; no grant changes, and each refusal is recorded with its requested action
[V] Given members of two organizations, the members page of an Admin of one shows only its members; the Admin revokes a grant there and gets 403 for a form that names a member of the other organization; the other organization keeps its grants and MCP access
[V] Given an Admin whose sign-in did not complete MFA, the members page and a grant post with the form token of its session each get the 403 MFA notice; no grant changes, and the refused change is recorded as `mfa-required`
[V] Given a session that the provider refreshes at each request, grant posts from another site or without an origin, without the form token or with a wrong one (403), for another organization (409), or with an extra field (400) are refused before any change, and the refreshed session cookie reaches each answer; a valid post then gets 303 with the refreshed cookie, the browser keeps its session, and only that change is recorded

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/hosted-grant-refusals.test.js
```

**Hosted invitations** (`test/acceptance/auth/hosted-invitations.test.ts`)

The tests accept an invitation through the directory double, as the provider does, and seed the other invitation states in it.

[V] Given an Admin and a Super Admin, the invitations page offers the Admin only "Invite as User" and the Super Admin only "Invite as Admin"; each sends its invitation with 303 to the invitations page; a forged Admin or Super Admin role from the Admin and a forged User role from the Super Admin get 403; an accepted Admin invitation gives Admin without User, so the members page works and the product page gets 403; each request is recorded
[V] Given pending, accepted, revoked, and expired invitations, the page shows each state as the directory gives it and offers a resend and a revoke only for the pending User invitation; the Admin resends and revokes it, a second resend gets 409, a forged revoke of an Admin invitation or of an invitation of another organization gets 403, and of an accepted invitation 409; the record for the other organization names no role, and no invitation token reaches a page or a record
[V] Given a directory that enforces the invited address and then one that accepts by its own rules, the invitations page claims a strict address match only for the first
[V] Given an inactive membership with User and Admin and a pending membership with User, an Admin invites the first address as User and a Super Admin the second as Admin; after each acceptance, the membership is active with only the role of its invitation, so no invitation restores a grant outside the authority of its sender
[V] Given a pending User invitation, a second send to the same address, also in other letter case, sends nothing and returns to the invitations page with 303; after another Admin revokes the invitation, a new send is a new invitation; each send and the revoke are recorded
[V] Given a Super Admin whose sign-in did not complete MFA, the invitations page and an invitation post with the form token of its session each get the 403 MFA notice; nothing is sent, and the refused invitation is recorded as `mfa-required`

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/hosted-invitations.test.js
```

**Hosted User seat summary** (`test/acceptance/auth/hosted-seats.test.ts`)

[V] Given members on several pages, repeated at the page boundaries, an Admin and a Super Admin see 4 active User seats in one organization, and an Admin of the other organization sees 3; Admin-only, Super-Admin-only, default-role, pending, and inactive memberships and a pending invitation do not count; each read names the statuses and follows the cursors; a User alone gets 403 and no count; no failure is reported
[V] Given a member page or an invitation page that fails to load, each page gives the 500 failure page without a partial count, list, or form, and the operator gets the path and the cause

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/hosted-seats.test.js
```

**Self-hosted startup** (`test/acceptance/auth/self-hosted-startup.test.ts`)

Each test starts the built server, `dist/src/index.js`, as a separate Node process on a loopback port with a temporary data directory. Account setup uses the Better Auth runtime in the test process while no server runs. When startup fails before the server listens, the test also checks that the process writes a `FATAL` line and exits with status 1, not by a signal.

[V] Given a fresh data directory, a start, stop, and second start persist one installation identity, report the same `local:` tenant, and exit with status 0 after `SIGTERM`
[V] Given eight servers that start at the same time, each gets `SIGTERM` in the same tick in which its `Listening on` line arrives; each run writes `Stopping after SIGTERM` and exits with status 0, not by the signal
[V] Given eight servers that start at the same time, each gets `SIGINT` in the same tick in which its `Listening on` line arrives; each run writes `Stopping after SIGINT` and exits with status 0, not by the signal
[V] Given zero accounts, startup succeeds, MCP requests get a Bearer challenge, and no public route creates an account
[V] Given only a disabled account, startup succeeds, MCP requests stay denied, and the account keeps its ID
[V] Given two servers that start at the same time on a fresh directory, one serves, the other stops with a lock error before it listens, and one installation identity exists
[V] Given a running server, a second server with the same data directory stops with a lock error before it listens, less than five seconds after its launch; each data file keeps its content, and the running server still serves
[V] Given retained data without its installation identity, startup stops before it listens, asks for a restore, and creates no new identity
[V] Given a restored copy of the complete data directory, the server starts with the same tenant; a restore without `auth.secret` stops before it listens
[V] Given `BETTER_AUTH_SECRETS`, `BETTER_AUTH_TRUSTED_ORIGINS`, or `BETTER_AUTH_TELEMETRY` with a value, startup stops before it listens with a `FATAL` line that names the variable but not its value
[V] Given an unknown command, the process stops with status 2 before it listens, does not repeat the arguments, and creates no local data
[V] Given the hosted edition with a `DATA_DIR` setting and WorkOS settings, the server serves the WorkOS edition, which asks for a sign-in, reports no local tenant, stops with status 0, and creates no local data

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/self-hosted-startup.test.js
```

**Lazy local command provider loading** (`test/acceptance/auth/local-command-provider-loading.test.ts`)

The built entry point runs in a separate process with an import hook that fails
if a rejected command loads a provider module.

[V] Given malformed syntax, invalid configuration, or a hosted edition, the command reports the applicable error without loading the local provider
[V] Given an accepted local command, the provider import guard blocks the load, so the test proves that the guard is active

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/local-command-provider-loading.test.js
```

**Offline local user and client commands** (`test/acceptance/auth/local-user-commands.test.ts`)

Each test runs the built entry point as a separate process with the passwords on standard input and outbound network access refused. The server runs as its own process for the startup and lock cases. Sign-in, authorization, and introspection run through the provider handler in the test process while no server runs. A test-only resource-server client introspects the tokens.

[V] Given a stopped server, add and list with hidden passwords refuse a duplicate email in another letter case and list each enabled state without credentials; each password signs in its account, no command uses the network, and the server keeps its tenant
[V] Given two users with sessions and MCP tokens, reset-password for one ends only its old password, session, and token; its ID and enabled state stay, its new password works, and the peer stays usable
[V] Given two users with sessions, MCP tokens, and a pending code, disable for one ends its sign-in, session, token, pending code, new authorization, and refresh; the list shows it disabled with its ID, and the peer stays usable
[V] Given a live server, each command fails with the lock error, asks for no password, and changes nothing; after the server stops, add recovers the zero-account installation, and the server keeps its tenant

**Offline approved MCP client registration** (`test/acceptance/auth/local-client-registration.test.ts`)

[V] Given the Thermus program, an unknown command gives usage that names `thermus users` and `thermus clients register`
[V] Given a fresh Thermus installation with an approved client, a user signs in on a page that names Thermus and discovers an MCP server with the `thermus` identity
[V] Given an enabled account, client registration with an exact loopback redirect URI persists the client in the data directory, leaves no registration session, and lets a user authorize; unknown, disabled, and wrong-password targets and non-loopback, fragment, and credential redirect URIs give safe errors and register nothing

Run only the tests of the offline commands:

```sh
npm run build && node --test dist/test/acceptance/auth/local-user-commands.test.js dist/test/acceptance/auth/local-client-registration.test.js
```

**Self-hosted browser-to-MCP authorization** (`test/acceptance/auth/self-hosted.test.ts`)

Each test runs the built server and the offline commands as separate processes that refuse outbound network access and report each attempt. A test-only browser sends the page requests with `node:http`, so its `Origin` and `Sec-Fetch-*` headers stay exactly as written. The MCP TypeScript SDK client uses a pre-registered native client ID. Both reach the server at its listen address and use the public URLs of `PUBLIC_BASE_URL`.

[V] Given two enabled accounts with separate approved native clients, each user signs in and consents on the bundled pages, and each SDK client works with a resource-bound token for its own client, user, and session and without a refresh token, in the one workspace; an expired token leads to a new authorization without the pages, and no process uses the network
[V] Given two users with tokens, a reset of one user's password while the server is stopped makes that user's old password, old token, and a refresh request fail after the restart; the new password gives a new token without a new consent, and the peer's token, session, and consent still work
[V] Given two users with tokens, a disable of one user while the server is stopped makes that user's token fail after the restart; the sign-in page refuses the account without a session cookie, no refresh is possible, and the peer keeps working
[V] Given a running server, both discovery documents describe only the local provider; sign-up, registration, introspection, the provider sign-in, session, admin, and client routes give 404; a client metadata URL as client ID and an unregistered redirect URI go to the bundled error page, which shows only the error code; no account or client is added, and the server fetches nothing
[V] Given the bundled pages, a sign-in or consent post from a foreign origin, a cross-site sign-in navigation, and a consent post with the session cookie but without an origin get 403 and add no session; the user can then sign in and consent from the server origin
[V] A changed consent signature reveals no client or account details and authorizes no redirect; the valid signed consent still completes, and the client metadata endpoints stay private
[V] Given the bundled sign-in page, the fourth sign-in from one client address within ten seconds gets 429 with `Retry-After` and signs no one in, also with the correct password

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/self-hosted.test.js
```

**Authentication routes under a public URL path** (`test/acceptance/auth/self-hosted-routes.test.ts`)

[V] With a prefixed public URL, the real provider serves both resource metadata paths and both issuer metadata paths with the correct issuer and resource; resource metadata accepts GET and HEAD and refuses POST
[V] An unknown client goes to the bundled error page under that prefix; unsupported page methods and old root routes remain closed, with no outbound connection

```sh
npm run build && node --test dist/test/acceptance/auth/self-hosted-routes.test.js
```

**Self-hosted evaluation container** (`test/acceptance/auth/self-hosted-container.test.ts`)

The suite builds the image of the current candidate two times; the second build is the replacement image. It runs the server and the bundled commands in containers of the image with the real provider and SQLite on Docker volumes. The containers get only the image settings and `PUBLIC_BASE_URL`. An internal Docker network gives them no route out. An edge container forwards the test connections to the server and records each outbound DNS query. Before each case, a lookup of a control name must appear in the record, and the case requires no other query. The test-only browser and the MCP SDK client of each user reach the server through the edge. Before each server container starts, the suite copies the trusted rules fixture `test/support/fixtures/trusted-ad-rules.txt` to `/etc/thermus/ad-rules.txt` in it; command containers get no rules file. The image holds the pinned Lightpanda 1.0.0. In the two renderer cases, `NODE_OPTIONS` loads the test-only page seam `test/support/container/container-page.ts` into the server. The seam serves a JavaScript page on port 8090 of the container, gives the lookup of `localhost` a public address, and logs each renderer launch and each connection and request of the page. With `CONTAINER_GATE_PAGE=permitted`, it lets the renderer reach `127.0.0.1` for the page; with `blocked`, the renderer starts with the production options. The hosted image acceptance specification loads the same seam with the third mode, `hosted`. The seam keeps the telemetry settings of the image and the fetcher. The suite does not reach a public page, and it is not a renderer gate pass.

[V] Given a fresh image and data volume, stopped-server command containers add two users and register a native client for each; after the server container starts, each user signs in and consents on the bundled pages, and each SDK client works with a resource-bound token for its own user, client, and browser session in the one tenant; a fetch tool call with an address-literal URL gets `Page fetch failed` and a `fetch_failed` record, because the container has no route out, and the server log gets no renderer setup report; a token that is no longer accepted leads to a new authorization without the pages, a refresh request gets `unsupported_grant_type`, and no container tries an outbound connection
[V] Given two users with tokens and consents, a restart, a new container, and a container of the rebuilt image on the same volume each keep the tenant, the user IDs, the clients, the signing keys, the sessions, the consents, and the tokens of both users usable
[V] Given a tar backup of the complete stopped volume, a restore into a new volume keeps the tenant, the user IDs, the tokens, the sessions, and the consents; a fresh volume gets a new tenant; a restore without the installation identity or without `auth.secret` stops the server before it listens, asks for a restore, and gets no new identity
[V] Given a server container with trusted rules and the permitted page seam, `LIGHTPANDA_BIN` in the running container names `/opt/lightpanda/1.0.0/lightpanda`, which reports `1.0.0`; an authorized SDK client gets the exact cleaned Markdown of the local JavaScript page, which the renderer of the image loads with its script; the trusted rules of the final host apply; the server writes one safe `success` record; the server container stops with status 0, and no container tries an outbound connection, also no telemetry lookup
[V] Given a server container with the blocked page seam and the production renderer options, calls for the loopback address, for the private address of the container, and for `localhost`, which the seam gives a public address, each get `Page fetch failed` and one `fetch_failed` record; the fetcher starts no renderer for the two addresses; the renderer starts for `localhost` and blocks its loopback socket; the page gets no connection, and no container tries an outbound connection
[V] Given an image build with another file in place of the Lightpanda download, the build stops with `Lightpanda SHA256 check failed for linux/<architecture>` and makes no image; the build needs no network access for the asset
[V] Given a fresh volume and a server container without the trusted rules file, the server stops before it listens with the `FATAL` line `AD_RULES_FILE could not be read (ENOENT).` and writes nothing to the volume; a command container, which reads no rules, still adds an account
[V] Given two users with tokens, a stopped-server password reset of one user ends only its token and old password, and the user signs in again without a new consent; a later disable of the other user ends only its token and sign-in; the peer keeps working each time
[V] Given a live server container, one-off command containers on the same volume and a command in the server container fail with the lock error, ask for no password, and change no account
[V] Given an installation that starts with zero accounts and later has only a disabled account, a command container that adds an account while the server is stopped gives MCP access through the installation client, and the tenant stays the same
[V] Given a signed-in local user, hosted, paid, and private-provider paths give 404 and add no account, and MCP lists only `getURLAsMarkdown`; starting the self-hosted image with `DEPLOYMENT=hosted`, valid WorkOS settings, trusted rules, and its pinned renderer stops before listening because the portal build is absent, with safe FATAL output, exit code 1, no local tenant or fresh-volume data, and no outbound calls (RHD-02 dedicated gate: 13/13 passed)
[V] Given the image and the compose file, the image holds the compiled `dist/src` of this build, the shipped migrations, the pinned production packages with a working native ad blocker, and the pinned Lightpanda 1.0.0 at `LIGHTPANDA_BIN=/opt/lightpanda/1.0.0/lightpanda`, which root owns with mode `0755`, which the `node` user cannot change, and which loads the CA certificates of the image, and no source, test output, or development package; it runs as `node` with production settings, no telemetry setting except `LIGHTPANDA_DISABLE_TELEMETRY=true`, a `0700` data directory, and `AD_RULES_FILE=/etc/thermus/ad-rules.txt`, but no rules file; the compose service mounts only that volume and the operator's `ad-rules.txt` read-only, which Compose must not make, starts with an init process, and publishes port 8080 on `127.0.0.1`

Run the container gate. It needs Docker Engine with Buildx and Compose:

```sh
npm run test:container
```

`npm test` and `npm run test:acceptance` select this file but skip its suite. Only `npm run test:container` is a container gate pass.

**Hosted image acceptance** (`test/acceptance/auth/hosted-image.test.ts`)

This dedicated acceptance specification builds and runs the final hosted image
for Linux AMD64. The ordinary `test` and `test:acceptance` command globs
explicitly exclude `hosted-image.test.js`. It needs Docker Engine with Buildx and an AMD64 builder/runtime,
native or emulated. Image build downloads need network access or cached pinned
inputs; the renderer needs public HTTPS egress to `https://example.com/`.
The tests use no live WorkOS or Axiom credential. The
[hosted image gate](../implementation/test-gate-policy.md#hosted-image-gate)
gives the command and prerequisites. The final Linux AMD64 gate passed
8/8 tests under bundled Linux Rosetta, with zero failures, cancellations,
skips, or todo cases. [RHD-03](../implementation/rhd-03.md) records the result.

The real CLI case uses the image unchanged with placeholder runtime settings.
The fetch cases mount two test-only seams: the provider seam
`test/support/container/hosted-image-identity.ts` and the page seam
`test/support/container/container-page.ts` with `CONTAINER_GATE_PAGE=hosted`.
These seams supply a fixed Connect User and permit the local JavaScript fixture. They keep
the final image's real cleaner, renderer, production dependencies, and production
entry point. The image case reads the files of the image with the `hosted-image`
probe of `test/support/container/container-probe.ts`. The gate sends the probe
on standard input, so the image holds no test file.
The public HTTPS case uses the renderer's normal TLS verification.
This proves packaged application behavior and does not prove WorkOS behavior.
The gate has a 60-minute total allowance for the build and image cases. Its
failed-check case injects a failure into an existing unit file, before the
later suites. Production readiness and shutdown bounds stay unchanged.

[V] Given the final image, its metadata and files show Linux AMD64, the checked portal, production packages, working native cleaner and shipped rules, Lightpanda 1.0.0, CA certificates, non-root execution, and no development tools or test output
[V] Given the unmodified image and placeholder runtime settings, the real CLI serves portal assets and CSP, responds to health, requires MCP authentication, and refuses a foreign Origin
[V] Given the unmodified image and placeholder credentials with signup enabled only in the test, a visitor sees the complete byte-exact approved notice before sign-in and no activation form
[V] Given the provider seam's Connect User, the real renderer fetches public HTTPS with verified TLS and returns the controlled page's JavaScript output after the native cleaner applies the shipped policy
[V] Given private targets, overload, disconnect, and active-renderer SIGTERM, private calls fail before rendering, excess work fails promptly, cancellation settles before capacity is reused, and shutdown exits with status 0 within the bound
[V] Given missing rules, a missing renderer, an empty cookie password, or an HTTP public base URL, the real CLI exits with status 1 before listening and shows no secret
[V] Given a final image with its portal hidden by an empty mount, startup fails before listening with a safe portal error
[V] Given a copied context with an injected failing offline test, the final-target build fails and creates no runtime image

Run the dedicated final Linux AMD64 gate:

```sh
npm run test:container:hosted
```

**Hosted rules policy** (`test/acceptance/hosted-ad-policy.test.ts`)

The owner selected a pinned EasyList snapshot for the hosted rules. The
candidate includes the snapshot, provenance, and license. The specification
loads it through the real native cleaner and public cleaning pipeline. It is
included in `build:hosted` and the normal acceptance selection. The worker
reported a red source run before replacement and a green 1/1 source run after
replacement. The final host offline selection passed 90/90 and the full
acceptance command passed 334 backend cases plus four portal cases, including
the emitted policy test. The final Linux AMD64 image gate also passed 8/8. The
[RHD-03 record](../implementation/rhd-03.md)
tracks the final candidate results. The [rules reference](../reference/ad-rules.md#hosted-image-policy)
links the pinned source, license, scope, and update process.

[V] Given the pinned EasyList snapshot and an `aside` with class `ad-banner-container`, the native cleaner removes that element and preserves ordinary article content and the similar class `ad-banner-container-story`

Run the emitted specification after a clean build:

```sh
npm run build && node --test dist/test/acceptance/hosted-ad-policy.test.js
```

**Hosted live gate setup** (`test/acceptance/auth/hosted-live-setup.test.ts`)

These cases run the compiled hosted live file in a new Node process, as `npm run test:hosted-live` runs it after its build, with the TAP reporter and outbound access denied. They need no portal build. Without it, the local HTTPS test server of the gate starts nothing and rejects at once with the message that names `npm run build:user-portal`. The gate process then exits.

[V] Without WorkOS settings, the gate exits 1 with one failed test, no passed, skipped, or todo test, a setup error that names each missing setting, and no outbound network attempt
[V] Refuses a production API key and requires a staging key; the output shows no setting value
[V] Counts an empty `WORKOS_API_KEY`, `WORKOS_CLIENT_ID`, or `WORKOS_AUTHKIT_ISSUER` as missing
[V] Refuses an AuthKit issuer that is not an absolute `https` URL without spaces, a username, a password, a query, or a fragment, and shows no value
[V] With staging settings and outbound access denied, the live proofs run, try the network, and fail; no test passes or is skipped, and the API key does not show
[V] Only `test:hosted-live` selects the hosted live file, and the acceptance suite selects this specification

```sh
npm run build && node --test dist/test/acceptance/auth/hosted-live-setup.test.js
```

**Hosted live gate** (`test/acceptance/auth/hosted.live.ts`, `npm run test:hosted-live`)

These live tests need the WorkOS staging environment, its settings, and the prerequisites of the [hosted live gate](../implementation/test-gate-policy.md#hosted-live-gate-auth-06). Run r5 ran the provider proofs and the AUTH-06 cases on 2026-10-14 through the staging launcher, after the owner saved the dashboard settings, and each of them passed. AUTH-07W added its provider proofs and cases after run r5. In AUTH-07W run r1 on 2026-10-14, one proof failed, and that proof changed after the run. AUTH-07W run r2 ran the complete command on 2026-10-14, and each of its 57 tests passed. The ticket `9255ad59-3484-43bd-bdf5-e6e391e07bd6` changed the Super Admin steps of the runbook to single-role writes and added three operator proofs; its run r1 ran the complete command on 2026-10-14, and each of its 60 tests passed. AUTH-08W added its provider proofs and cases after AUTH-07W run r2. A run of only the AUTH-08W tests, with the name pattern `AUTH-08W`, passed the 16 of them that existed then; the ninth provider proof came after it. AUTH-08W run r3 ran the complete command three times on 2026-10-14: the first run passed each of its 74 tests; the second run, after the merge of main and the organization read of the role writes, failed 3 of its 77 tests with transient `500` pages in organization C; the third run, on commit 9b47df0, passed each of its 77 tests. `[V]` marks a test that passed in run r5, or, for the AUTH-07W tests, in AUTH-07W run r2 and in run r1 of that ticket, or, for the AUTH-08W tests, in the third complete run of AUTH-08W run r3; `[ ]` marks a test that has not passed. On 2026-10-15, the auth WorkOS MCP URL fetch work slice changed two AUTH-06 provider proofs for decision D1 of its [plan](../implementation/auth-workos-mcp-url-fetch-plan.md). Now the sign-in page must offer Google as its only social provider. The AuthKit metadata must name the registration endpoint and support client ID metadata documents. The historical Required-profile candidate passed both changed proofs on 2026-10-15: exit 0, 77/77 tests in 17 suites, with zero failures, cancellations, skips, and todo cases. The [slice validation record](../implementation/auth-workos-mcp-url-fetch-validation.md) gives the result; the resumed fresh-account Google/client/Axiom manual walk also passed. The command passes only when every test passes. The [authentication plan](../design/authentication-design.md#live-provider-proofs) records the results.

The MFA-policy revision has two 77-case profiles under the same complete command. Optional is selected by omitted or `optional` `WORKOS_MFA_POLICY`; explicit `required` selects Required. The entries marked `[V]` above preserve historical Required-profile evidence. Both revised profiles passed on 2026-10-15: Optional 77/77 in 16 suites and Required 77/77 in 17 suites, each exit 0 with zero failures, cancellations, skips, or todo cases. Shared Staging Optional was restored and verified.

[V] Provider preflight requires `mfaEnabled: true` and `mfaRequired` matching the selected profile before live tests or login; a mismatch fails the run
[V] Optional keeps normal browser, Connect, refresh, revocation, and organization flows with no application MFA evidence, including refreshed and switched sessions
[V] Optional replaces eight positive administration cases with refusal and invitation-acceptance counterparts; administration GETs and writes get 403 without effects
[V] Required retains the eight positive administration cases under explicit runtime Required and provider Required settings
[V] Both profiles retain operator/API administration contract proofs, which do not authorize Optional browser sessions

```sh
node ~/.config/thermus/with-workos-staging.cjs npm run test:hosted-live
WORKOS_MFA_POLICY=required node ~/.config/thermus/with-workos-staging.cjs npm run test:hosted-live
```

AUTH-06 provider proofs (`test/acceptance/auth/hosted-live/` and the read-only checks of `hosted.live.ts`):

[V] The AuthKit authorization-server metadata names the exact issuer, the AuthKit key set, the authorization code grant, S256 PKCE, the client registration endpoint `<issuer>/oauth2/register`, and `client_id_metadata_document_supported: true` (changed and passed in the complete gate on 2026-10-15)
[V] The AuthKit key set and the browser-session key set have signing keys with key IDs, and jose accepts them
[V] WorkOS accepts the staging API key for a read of organizations
[V] The saved redirect URI is exactly `https://localhost:46443/callback`, the default; no CORS origin is saved; the MCP resource indicator `https://localhost:46443/mcp` is saved
[V] The environment roles have exactly the permissions of the hosted role mapping, as the role catalog of `test/support/fixtures/hosted-roles.ts` gives them, and no other role has an application permission
[V] Provider preflight checks MFA against the selected Optional or Required profile, allows password sign-in, and refuses passkeys
[V] The hosted sign-in page offers email sign-in and Google as its only social provider (changed for decision D1 and passed in the complete gate on 2026-10-15)
[V] In the Required profile, a new user signs in with the password and a TOTP enrollment before the callback; the callback has the code and the state; the method is `Password`
[V] The browser access token is an RS256 token of the environment client with a `session_` sid, no audience, no organization, and a 300-second lifetime; the sealed session is shorter than 3,800 characters
[V] In the Required profile, a later sign-in asks for the TOTP code, not a new enrollment
[V] A user with two memberships chooses the organization at AuthKit; the token has its `org_id`, both roles, and their combined permissions
[V] A refresh switches the organization in the same session; an organization without a membership gives `organization_membership_not_found`, and the session still refreshes
[V] The browser refresh token is not rotated in staging; a replay works at once and after 31 seconds
[V] An operator revocation gives `invalid_grant` without retry, removes the session from the list, and the issued access token verifies until it expires
[V] The WorkOS logout URL ends the session
[V] After the logout, the browser goes through the logout of the AuthKit domain to the default Sign-out URI `https://localhost:46443/`
[V] A visit to the AuthKit domain goes through `initiate_login` of WorkOS to the Initiate login URI `https://localhost:46443/login` before any sign-in page
[V] A public PKCE client authorizes through AuthKit with the password, the MFA step, and the consent; the callback has the code and the state
[V] The code exchange gives a bearer access token, a refresh token, and an ID token
[V] The Connect access token is RS256 without `typ`, from the AuthKit issuer for the MCP resource, with the user, the MCP client, an `app_consent_` sid, the organization, the scope, `auth_time`, and a 300-second lifetime, and no role or permission claim
[V] A Connect refresh rotates the refresh token and keeps the user, consent, organization, client, and audience
[V] The MCP checks refuse a browser access token and an M2M token by the audience
[V] The deletion of the authorized application ends the consent: the refresh gives `invalid_grant`, and the issued access token verifies until it expires
[V] Membership reads give the complete role lists of independent and combined grants, Admin alone, and the default role `member` without a permission
[V] The explicit status filter separates active and inactive memberships, and the `after` cursor reads six memberships exactly once in pages of 2
[V] The roles of an organization are the four environment roles with their exact permissions

AUTH-06 cases of the hosted server (`test/acceptance/auth/hosted-live/hosted-server.ts`), with the local HTTPS test server at `https://localhost:46443/`:

[V] A member with User and Admin signs in through the portal with MFA; the server keeps a sealed `__Host-thermus-session` cookie (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`); the portal shows the product access of the organization; the session has MFA evidence
[V] A user without a membership gets no product access, a 403 portal request, and the onboarding guidance
[V] Admin alone and the default role alone get a 403 portal request
[V] A Connect grant of a User works at the MCP endpoint; without a token, the endpoint gives 401 with the metadata URL; the metadata names the AuthKit issuer
[V] A browser access token and an M2M token get 401 at the MCP endpoint
[V] A browser session in one organization and an MCP grant in another keep their own organizations
[V] An Admin-only member gets 403 `access_denied` at the MCP endpoint
[V] An external sign-in through the Initiate login URI `/login` signs the user in
[V] The sign-out clears the cookie, ends the WorkOS session, and lands on the Sign-out URI with the signed-out portal; the `form-action` of the portal allows the AuthKit domain
[V] After the 300-second lifetime, a session refreshes with one new cookie and the same form token; a revoked session gives 401 with a cleared cookie; an MCP grant whose consent was revoked works until its token expires and then gives 401

AUTH-07W provider proofs (`test/acceptance/auth/hosted-live/operator-setup.ts`). They run the steps of the [operator runbook](../implementation/hosted-organization-setup.md) with the pinned SDK against the staging environment, through the test-support driver `test/support/hosted-live/operator-runbook.ts`, and read the result with the real `WorkOSOrganizations`. Since the ticket `9255ad59-3484-43bd-bdf5-e6e391e07bd6`, each Super Admin change of the runbook is one role assignment on the organization resource or its removal, and three proofs show the resource and a customer change at the same time. No proof covers the completed operator MFA that the runbook requires: the WorkOS API cannot show it, so it is a manual precondition. On 2026-10-14, the owner removed this proof from AUTH-07W; the decision ticket `ae984833-e115-4da9-bebe-7c4b1fb1a025` decides how it is enforced and proven. The run makes its own operator organization and users (`test/support/hosted-live/organization-fixtures.ts`) and deletes them at the end:

[V] The operator locates or creates the organization by its external ID: the organization exists once; a second create with the same external ID is refused with `external_id_already_used`, also with an idempotency key, and a second locate step finds the organization without a change
[V] A Super Admin grant to a verified identity without a membership gives exactly the role `super-admin`; the application reads only the Super Admin grant, no Admin and no User, and a second grant changes nothing
[V] A grant and then a revocation of Super Admin keep User and Admin at each step; the identity and its membership in another organization do not change
[V] A membership made without a role has its default role `member` as a role assignment on the authorization resource of type `organization` with the external ID of the organization; a role assignment that names the organization ID is refused with `404` `entity_not_found` and changes nothing; a Super Admin grant adds `super-admin` and keeps `member`
[V] A Super Admin grant to a membership with User and Admin, while a customer removes Admin with a single-role write after the inspection of the runbook and before its write, adds only `super-admin`, and the removal of Admin stays
[V] A Super Admin revocation of a membership with only Super Admin, while a customer grants User in the same order, removes only `super-admin`, and the User grant stays
[V] The revocation of Super Admin, the only grant of a membership, keeps the membership active: WorkOS gives it only the default role; the organization service then lists no organization for the identity, and the identity stays
[V] A replacement grants Super Admin to the new identity first, so that the organization keeps a Super Admin at each step; the old identity loses only Super Admin and keeps User
[V] A recovery stops at the inactive membership of the lost Super Admin without a create or a reactivation, and grants Super Admin to another verified identity
[V] After an unknown outcome, the inspection writes nothing for a grant in place, also after a later customer User grant, where a blind create would leave both grants; after a later revocation, it stops without a write, so that the removed grant stays removed
[V] After an unknown outcome for an inactive membership, the inspection finds it with the explicit statuses and stops without a create or a reactivation; the membership stays inactive with its roles
[V] Each operator record of the run names the actor, the organization, the target, the action, the time, and the outcome; each grant change names the roles before and after; no record holds a credential

AUTH-07W cases of the hosted server (`test/acceptance/auth/hosted-live/organization-server.ts`), with the same local HTTPS test server. The run registers the first four cases before the AUTH-06 cases and the expiry case after them, so that the 300-second wait of the AUTH-06 cases also lets the access token of the selection session expire:

[V] Users with only an inactive membership or only the default role get the invitation and operator guidance without a form, and the billing page and the protected portal request refuse them
[V] A member with User and Admin in A, User in B, and an inactive membership in the operator organization is offered only A and B, with their WorkOS names; the selection of B gives 303 with a new session cookie, and the session and the portal are in B
[V] In the same session, selections of an organization without a membership and of the inactive membership, and selections from another origin or with another form token, each get 403 without a switch; the session stays in B
[V] An identity that the operator made Super Admin of the operator organization is offered that organization, opens the billing page with the Free plan, and gets 403 for the protected portal request; a customer grant of Super Admin gets 403 with a change record; after the operator revokes Super Admin, the next request of the same session is refused, and the organization page gives the onboarding guidance
[V] After the access token of the selection session expired, a refused selection gets 403 with the refreshed session cookie; the form token stays the same, and the session stays in B

AUTH-08W provider proofs (`test/acceptance/auth/hosted-live/administration-proofs.ts`). They run the single-role writes of WorkOS with the pinned SDK, and the directory methods of the real `WorkOSOrganizations`, against the staging environment, in organization D. D has no external ID, so the proofs cover an organization without one, whose resource WorkOS names by the organization ID. The run makes organizations C and D and 25 users, each with a password and a verified email (`test/support/hosted-live/administration-fixtures.ts`), and deletes them at the end:

[V] An assignment of Admin on the organization resource of D, named by its organization ID, adds only Admin and changes the update time; the role assignment has the organization ID of D as the external ID of its resource; the same assignment again gives the same role assignment and changes neither the roles nor the update time
[V] Assignments of Admin and Super Admin at the same time both stay, and User stays
[V] The removal of Admin, which the membership does not have, succeeds and changes neither the roles nor the update time
[V] A single-role write that names the organization resource of B gets 404 `entity_not_found` and changes neither the roles nor the update time
[V] The directory grants Admin on the revision of a page and keeps User; the same request again, and the old request again after a later revoke of Admin, are each `stale` without a write, so the revoked grant does not return
[V] The revoke of User, the only application role in D, keeps the membership active with only the default role `member`, whose grant gives no permission; the membership in B keeps User
[V] A grant of Admin and a revoke of User on an inactive membership and on a pending membership from an invitation are each `unsupported`; WorkOS keeps the status, the roles, and the update time of each
[V] Member reads in pages of two give, for each status filter, exactly the memberships of a direct WorkOS read; the User seat count counts each active membership with User once, and Admin only, Super Admin only, the default role, pending, and inactive count zero
[V] An Admin invitation to an identity without a membership gives a pending Admin invitation and a pending membership with only `admin`; a User invitation to that address in capital letters and an Admin invitation to an active member are `address-in-use` without a second invitation; the resend and the revoke are applied, the revoked invitation is listed only as revoked, and its membership stays pending without access; a second resend and revoke are `not-pending`; no result holds the token or the link

AUTH-08W cases of the hosted server (`test/acceptance/auth/hosted-live/administration-server.ts`), with the same local HTTPS test server, in organization C. C has the external ID `thermus-live-<run ID>-c`, as each customer organization of the operator runbook has one, so each grant change of the directory in these cases names the resource of C by that external ID. The run registers them after the first four AUTH-07W cases and before the AUTH-06 cases:

[V] An Admin-only member gets 403 and a `denied` change record for a forged Admin grant of a Super Admin; its members page offers no Admin change, and WorkOS keeps only `super-admin`
[V] An identity with only Super Admin signs in with MFA, sees no User change, and grants Admin and then User to itself, each with 303; WorkOS has `super-admin`, `admin`, and `user`, the User seats grow by one, and the operator log has an `applied` record of each grant without a credential
[V] The same Super Admin revokes its own Admin and grants it again with the Super Admin that it kept, each with 303; between them, its members page offers no User change; WorkOS has the three roles at the end
[V] After the administrator revokes Admin from a member with User and Admin, its next members page gets 403 and its MCP token still works; after the administrator grants Admin again and revokes User, the MCP token gets 403 and the members page opens
[V] After the administrator revokes the only User grant in C of a member that also has User in B, its next portal request gets 403, its organization page offers only B, the members page shows it active without a role, and WorkOS keeps C active with only `member` and B with `user`
[V] Grant posts that name a membership of A, an inactive membership of C, the role `super-admin`, or the actions disable, deactivate, and reset-password each get 403 and change nothing; a post on the revision of a page after another administrator assigned Admin in WorkOS, on the resource of C named by its external ID, gets 409 without a write
[V] Invitation forms of the administrator: a User and an Admin invitation and a repeated User invitation get 303; an Admin invitation to the pending address and a User invitation to an active member get 409 address in use; the resend and a third invitation with its revoke get 303; WorkOS has one invitation to each address, the pending membership of the Admin invitation has only `admin`, the page shows each state with forms only for pending invitations, each change has its record, and no page or log line holds an invitation token or link
[V] Each invitee opens its invitation link and completes the AuthKit sign-in with MFA through `/invite`: the User invitee is active with only `user` and opens the portal; the Admin invitee, whose inactive membership had User and Admin, is active with only `admin`, gets 403 for the portal, and opens the members page; the invitations page shows both accepted, the members page shows the User seats of WorkOS, and no page or log line holds an invitation token or link

**Small-text cutoff** (`test/acceptance/small-text-cutoff.test.ts`)

[V] Given 11px, 12px, and 13px text, keeps only text at or above the default 12px cutoff in final Markdown and reports one removal with `hidden-html`
[V] Uses a custom 8px cutoff; a zero cutoff keeps small visible text while existing zero-font, near-zero-font, and hidden-attribute checks remain active
[V] Keeps larger child text and images under a small parent
[V] Applies inherited, embedded stylesheet, `em`, `%`, `rem`, and absolute point font sizes
[V] Keeps enlarged and reduced text at the effective 12px boundary and removes text just below it
[V] Composes parent and child scales to keep restored child text
[V] Removes proven tiny text and keeps unresolved fonts, font calculations, transforms, and projected planes

Run these acceptance tests separately; `npm run check` does not select the acceptance directory:

```sh
npm run build && node --test dist/test/acceptance/small-text-cutoff.test.js
```

**Literal inline emoji joiners** (`test/acceptance/literal-inline-emoji-joiners.test.ts`)

[V] Given a woman-technologist emoji with the joiner in a separate span, a separate text node, or three spans, keeps exact final Markdown code points
[V] Produces the same Markdown and empty findings for literal, decimal, and hexadecimal joiners

**Emoji joiners** (`test/acceptance/emoji-joiners.test.ts`)

[V] Given a contiguous literal, decimal, or hexadecimal woman-technologist emoji, keeps its exact code points in final pipeline Markdown
[V] Keeps encoded joiners in separate inline spans and text nodes through the pipeline
[V] Removes and reports prohibited bidi controls and joiners in ASCII words for all three encodings

Run these tests separately; `npm run check` does not select the acceptance or interface directories:

```sh
npm run build && node --test dist/test/acceptance/emoji-joiners.test.js dist/test/acceptance/literal-inline-emoji-joiners.test.js dist/test/interface/defuddle-emoji-joiners.test.js
```

**Pipeline counters** (`test/acceptance/pipeline-counters.test.ts`)

[V] Given ads, hidden siblings, a comment, encoded controls, and unsupported ad work, returns separate removal and unsupported-attempt counts with unique detection categories; repeated sanitizer and converter stages preserve the counts and input metadata

Run this acceptance test separately; `npm run check` does not select the acceptance directory:

```sh
npm run build && node --test dist/test/acceptance/pipeline-counters.test.js
```

**Visibility and parsed source ranges**

[V] Keeps visible font overrides and images when an earlier removal forms a zero-font-size parent
[V] Removes hidden local text and keeps visible child planes when an earlier removal forms a preserved 3D parent
[V] Uses parsed parents for font inheritance around tables and in template content
[V] Keeps a visible override under a zero-font-size document body in quirks mode
[V] Keeps visible content outside hidden tables and removes overrides inside display-none ancestors
[V] Keeps visible table cells between hidden merged text segments, including character references
[V] Keeps visible children under mask shorthands and parent perspective
[V] Removes offscreen text and images while it keeps descendants restored by transforms or layout offsets
[V] Resolves mask shorthand order and important mask-image declarations
[V] Keeps valid transform declarations when later raw syntax is invalid, and keeps named deferred values unknown
[V] Applies perspective declaration order and important priority; rejects invalid raw values and negative lengths
[V] Keeps non-replaced inline text when its own transform does not apply, and uses display declaration order and important priority
[V] Removes collapsed inline-block boxes, images, and boxes made block by positioning, float, or flex/grid rules
[V] Keeps transforms with unknown display applicability unresolved, and still removes display-none content
[V] Keeps default inline del and ins text and unclassified element defaults; applies a known display value on a custom element
[V] Keeps font-size overrides and images inside a zero-font-size class, including when an important CSS rule overrides inline display
[V] Applies importance, specificity, and source order across font and font-size declarations
[V] Keeps visible class rotations, preserved child planes, and parent perspective while removing collapsed class subtrees
[V] Keeps exact table source between merged hidden text segments with class font sizes
[V] Applies a formed font-size parent to retained descendants and keeps their visible overrides
[V] Keeps distinct saved declarations for reconstructed formatting copies, including nested copies that share source tags
[V] Rejects empty env() and attr() transform values so they cannot replace a valid hiding transform
[V] Resolves compound mask and mask-border sources, omitted sources, multiple layers, deferred values, and declaration priority
[V] Keeps non-collapsed child planes after compound masks flatten the parent
[V] Keeps flex/grid applicability and preserved transform context through nested display:contents wrappers
[V] Keeps font overrides, perspective uncertainty, and restored translated children through display:contents wrappers
[V] Ignores boxless wrapper offsets and keeps positioned descendants whose layout offsets are unresolved
[V] Keeps projective planes with unresolved Z origins and still removes singular full matrices
[V] Removes local and inherited offscreen input values, keeps visible inputs, and keeps descendants whose transforms return them to view
[V] Keeps a nearly singular matrix with a resolved or unresolved inverse, and keeps a preserved child whose inverse restores the parent plane
[V] Removes a truly singular operand when another transform has unresolved geometry but the complete declaration has a supported valid form
[V] Keeps a flat child restored by an inverse transform, including finite coefficients that exceed the exact decimal proof budget
[V] Removes zero-font text-entry input values from effective author rules, including class rules and explicit font inheritance
[V] Keeps input values with default, visible, or unresolved fonts under zero-font parents, and keeps images and native input controls
[V] Keeps known inherited offsets and planes through unstyled elements with unknown box defaults
[V] Keeps inherited offsets when an unknown box has an explicit none, initial, or unset transform
[V] Removes replaced HTML images with display:contents and keeps visible images with default or unresolved display
[V] Keeps invertible local and accumulated matrices, including Z translations, non-planar matrix3d values, and nested preserved contexts
[V] Removes meter and progress fallback text with display:contents and respects display declaration priority
[V] Rejects malformed deferred function headers, reserved variable names, and empty attribute namespace prefixes
[V] Keeps valid deferred values unknown, including nested and empty fallbacks, escaped names, and typed attributes
[V] Keeps native control text under zero-font parents unless an effective author font rule hides it
[V] Keeps a visible table formatting copy when copies with the same parent and source have conflicting styles
[V] Uses ASCII case matching for input types and treats a Unicode lookalike as an invalid text type
[V] Applies a collapsed transform to the blockified HTML root and keeps its visible identity controls
[V] Keeps a visible button label when display:contents removes its box
[V] Flattens preserved 3D contexts for content-visibility:auto, respects class, reset, and important declarations, and keeps deferred grouping unknown
[V] Applies deferred class font and transform replacements and class unitless font sizes in each parser mode
[V] Applies overflow axis grouping, shorthand resets, and important declarations from class rules
[V] Keeps finite composed transforms when binary rounding makes distinct projected columns equal
[V] Keeps the true root font size when an SVG element is named html, for visible and zero rem sizes
[V] Keeps zero-font input elements with missing or empty values and reports no hidden payload
[V] Keeps visible axes after numeric cancellation in local and preserved matrix compositions, including unknown exact proof
[V] Ignores transforms on inline and run-in flow list items and applies them to atomic inline flow-root list items
[V] Keeps preserved child planes unknown when box applicability is unresolved, including identity transforms and contents wrappers
[V] Keeps descendants that invert near-zero flat scales, including intermediate wrappers and near-edge-on rotations
[V] Accumulates flat parent and child transforms while retaining true edge-on flat collapse
[V] Applies known singular transforms to roots with inherited or deferred display and keeps identity controls
[V] Keeps restored child planes through unresolved contents boundaries and ignores a contents wrapper's own transform
[V] Keeps deferred overflow axes unknown, respects longhand order and importance, and retains confirmed flattening controls
[V] Removes exact zero scales with supported scalar calc wrappers and keeps deferred and compound math unknown
[V] Applies transforms to default native control and fieldset boxes, with explicit display and native font controls
[V] Rejects known invalid math siblings before singularity proof and cascade selection, with source-order and important controls
[V] Keeps projective coefficients unknown when they underflow or round to an affine row
[V] Preserves inherited local state through exact identity lists at unknown box boundaries while keeping child planes unknown
[V] Removes edge-on text and images after in-plane rotations while keeping restored planes and exact nonzero matrix controls
[V] Keeps matrix offsets unresolved when the authored linear part only rounds to a pure translation
[V] Keeps visible text and images after local and inherited offset cancellation or overflow, including embedded CSS and contents wrappers
[V] Requires proven zero ancestor offsets before a relative-unit fallback and retains actual offscreen and restored-child controls
[V] Applies offset error bounds through the independent public hidden-element check

**Build output** (`test/unit/build-output.test.ts`, `pnpm test:build`)

The real npm commands also prove that ordinary suites exclude the standard-named
hosted image test, keep ordinary tests and a similarly named neighbor, and that
the dedicated hosted image command selects only the image gate. The fixture
image test performs no Docker operation.

[V] All test commands exclude output from renamed and deleted tests
[V] Unit, integration, acceptance, and interface commands keep their suite selection
[V] Fresh and stale-output fixture tests produce the same current test names, complete emitted file set, and file bytes, including test source maps
[V] Repeated builds remove deleted production modules and source maps
[V] Builds preserve source and files outside the owned output when called from another directory
[V] Builds reject symlink and regular-file output paths without deleting their data
[V] Typecheck does not emit files or clear existing output
