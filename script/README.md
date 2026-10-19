# Fetch a URL through MCP

`fetch-url.ts` calls Thermus `getURLAsMarkdown` without an LLM client. It sends
`{url, reason}` and writes the returned Markdown to standard output. It uses the
MCP SDK for protocol negotiation and JSON or SSE responses.

The default endpoint is `https://app.thermus.ai/mcp`. Sign in through WorkOS in
your browser, or supply a Bearer credential yourself. The hosted backend accepts
**WorkOS Connect OAuth access tokens** with Thermus access. It does not accept
customer API keys.

Install the repository dependencies, including the client SDK and pinned Node:

```sh
pnpm install --frozen-lockfile
pnpm exec node --version
```

The version must be `v24.20.0`. Run all commands from the repository root. No
build is needed to run the script.

## Source layout

[`fetch-url.ts`](fetch-url/fetch-url.ts) is the command entry point. Its helper modules
live in `fetch-url/helper/`: [`oauth.ts`](fetch-url/helper/oauth.ts) coordinates OAuth,
[`browser.ts`](fetch-url/helper/browser.ts) handles browser sign-in,
[`credential-store.ts`](fetch-url/helper/credential-store.ts) stores credentials, and
[`errors.ts`](fetch-url/helper/errors.ts) defines command errors. Internal token parsing,
metadata discovery, callback parsing, and OS browser launch stay private.
The tests use the same `prepareOAuth()` and `browserAuthorization()` entry
points as the command. They check saved credentials, HTTP callback responses,
and the manual browser fallback.

## Sign in and fetch

Run this from a terminal on the same machine as your browser:

```sh
pnpm exec node script/fetch-url/fetch-url.ts --login
pnpm exec node script/fetch-url/fetch-url.ts \
  --url 'https://example.com/' \
  --reason 'Debug the page conversion' > page.md
```

The browser signs you in and selects your workspace when needed. Return to the
terminal after it finishes. The callback uses `http://127.0.0.1:46481/callback`;
that local port must be free. If the script cannot open your browser, it prints
the authorization URL on stderr for you to open on the same machine.

You can also run the fetch command first. With no supplied credential and no
saved grant, it starts sign-in when stdin and stderr are terminals. Redirecting
stdout to a Markdown file is supported. `--login` always starts a fresh
authorization and replaces the saved grant only after a successful exchange.
Do not pass a page URL, reason, or explicit credential with `--login` or
`--logout`.

Later fetches reuse the saved access token or refresh it before the request.
WorkOS sets the token lifetime; the script does not set a 30-day expiration.
Authentication has a five-minute limit, with a ten-second limit for each OAuth
network request. The fetch deadline starts after authentication finishes.

Use `--non-interactive` for a job that must not open a browser. It can use or
refresh an existing grant. If sign-in is needed, it fails with a local
instruction. OAuth is supported only for the default hosted endpoint. Other
endpoints require explicit credentials.

## Saved credentials and logout

On a supported POSIX local filesystem, the script stores one grant under
`$XDG_STATE_HOME/thermus/mcp-fetch/`, or
`~/.local/state/thermus/mcp-fetch/` when `XDG_STATE_HOME` is unset. A configured
`XDG_STATE_HOME` must be absolute. The directory is private (0700), and its
files are private (0600). Symlinks and unsafe ownership or permissions are
refused. Credentials are plaintext protected by file permissions, not an
encrypted vault.

One command at a time can prepare or change credentials. A second command
fails promptly if the store is busy. The lock is released before the MCP
request starts. An interrupted or failed refresh can require `--login`; the
script does not retry a refresh token whose use is uncertain.

```sh
pnpm exec node script/fetch-url/fetch-url.ts --logout
```

Logout removes the local grant or failure marker. It keeps the lock file.
It does not revoke WorkOS authorization, end the browser session, or stop an
MCP request that already has an access token.

## Supply a credential

Explicit input bypasses OAuth and local credential storage. Even an empty
explicit value selects this mode and fails validation; it does not start
sign-in. Unset `THERMUS_API_KEY` before using browser OAuth.

Read the credential without echo in zsh, then pass it through the environment:

```sh
read -rs 'THERMUS_API_KEY?Connect OAuth access token: '
export THERMUS_API_KEY
printf '\n'
pnpm exec node script/fetch-url/fetch-url.ts \
  --url 'https://example.com/' \
  --reason 'Debug the page conversion' > page.md
unset THERMUS_API_KEY
```

For stdin, use the same hidden read and send the value through a pipe. Stdin
replaces the environment value and must reach EOF:

```sh
read -rs 'THERMUS_API_KEY?Connect OAuth access token: '
printf '\n'
printf '%s' "$THERMUS_API_KEY" | pnpm exec node script/fetch-url/fetch-url.ts \
  --api-key-stdin \
  --url 'https://example.com/' \
  --reason 'Inspect Markdown output'
unset THERMUS_API_KEY
```

Keep credentials out of command arguments and shell history. `THERMUS_API_KEY`
is the environment variable name; its name does not add API-key support to the
server.

Use `--endpoint` to select another MCP server. The endpoint must use HTTPS, or
HTTP on loopback (`localhost`, `127.0.0.0/8`, or `::1`). Redirects are refused.
Only select an endpoint that you trust with the supplied credential.

```sh
pnpm exec node script/fetch-url/fetch-url.ts \
  --endpoint 'http://127.0.0.1:8080/mcp' \
  --url 'https://example.com/' \
  --reason 'Debug the local server' \
  --timeout-ms 10000
```

`--timeout-ms` sets the deadline for negotiation and the tool call. In explicit
credential mode it also includes stdin input.
The default is 60000 ms; accepted values are 100 through 300000 ms. A timeout
aborts network work and closes the MCP client. The script also closes the client
after success or failure.

Success returns exit status 0, with exact Markdown on stdout, including an empty
result. Failures return status 1, with a diagnostic on stderr and no Markdown.
Remote error text is omitted because it can contain credentials. Use the server
logs for details. Run `pnpm exec node script/fetch-url/fetch-url.ts --help` for the options.

Run the focused offline tests after a clean build:

```sh
pnpm run build
pnpm exec node --test "dist/test/unit/script/*.test.js" "dist/test/interface/script/*.test.js" "dist/test/acceptance/script/*.test.js"
```

# Measure and review code quality

The ten ast-metrics commands and their helpers are in
[`code-quality/`](code-quality/README.md). That guide explains CRAP before
the command sections, which follow the review process order. It gives the
source layout, Usage/Options contracts, and the complete ordinary/live test
inventory. Select affected tests from that inventory; the full list does not
require a run of every file. The documentation contract runs each command's
help without child processes and checks the same test set in the README and
[test inventory](../docs/testing/test-list.md#ast-metrics-commands).
The coverage command defaults to both complete unit parts: emitted Node tests
and source portal tests. Repeat `--suite unit|integration|acceptance` for
independently selected package suites. It builds once, preserves exact package
selections, retains each capture identity, and unions compatible coverage. Nested
or broader commands defer collection; missing shutdown evidence rejects capture.
No option expands the selected test scope. Trend charts split at changes in
suite set. Older D3 records without `captureProvenance` retain their historical
unit-only schema; pre-D3 unknown records stay unknown. Its
`ast-metrics-coverage.live.ts` and the separate
`ast-metrics-architecture-coverage.live.ts` have the same collector limit under
the [test gate policy](../docs/implementation/test-gate-policy.md#ast-metrics-focused-and-live-contracts).
Both use private output reports. Structural `ast-metrics-architecture.live.ts`
uses `--no-coverage` and starts no suite. The report always includes community
and source-folder component graphs, their legends, and import evidence.
Snapshots retain normalized source dependency pairs for offline reports;
legacy missing evidence remains unavailable. Exploratory architecture is read-only;
`--record` verifies and records a missing base on `origin/main`. Use
`ast-metrics-process.ts` for the complete review; it reuses compatible
coverage and collects only with an explicit eligible request. It prints and
saves the four report sections to `ast-report/process.md`. The baseline
wrapper reports ignored entry counts before and after a permitted refresh;
it adds no baseline exception.

Manual `ast-metrics-backfill.ts --count N` (default 10) records missing exact
first-parent commits of `origin/main` in oldest-selected-first order. It needs
complete history, preserves existing records, and runs no suites or coverage.
Repository gap checks cover only the interval between displayed first-parent
record endpoints; all stored full commit identities count. Offline reports with
a store state that snapshot dates cannot prove gaps.

Test-only architecture reports explain that base estimates use head coverage,
or that no coverage comparison was made. Offline test-only claims require known,
equal source fingerprints and declared test paths without source changes.
The owner approved cleaner → MCP and website-fetcher → auth path restrictions
through the review wrapper, a file cap of 40 paths with LOC 150 unchanged,
and a strict new-function warning above 10 paths on 2026-10-19. Implementation
is complete; selected tests, typechecking, and all 13 affected live cases pass.
The native capability cases explain why the
wrapper is needed; they do not prove those project rules. The verified
pre-crash flush/stop/seal protocol is implemented. Complete acceptance and unit
capture passed in order `[acceptance, unit]`: 853 emitted plus 16 portal
acceptance tests, then 3,544 emitted plus 19 portal unit tests, all with zero
failures and skips. Both earlier captures are verified. That proof did not
select integration. The 13 live cases include two
collecting cases, ten structural cases, and one CRAP case with verified imported
unit coverage. Only known crash fixtures opt in to the seal
IPC listener with `THERMUS_COVERAGE_CRASH=1`. Ordinary captured forks have no
injected message listener; OAuth uses a synchronous prepared nonce without
one. No approval expands test selection.

The loader follow-up uses capture-manifest version 4 and
`normal-exit-or-sealed-or-loader-1`. It observes the actual `tsx` loader thread
through `module.register()` under both capture preload modes for actual
asynchronous loaders. It verifies a capture/PID/thread/owner/nonce exchange after genuine owner exit listeners finish. It requires an intact
checkpoint, a distinct later V8 flush, and normal owner completion. The loader
parks without stopping coverage. A manually emitted exit event cannot stop
capture. Its private genuine-exit guard is specific to pinned Node 24.20.0;
missing guard evidence fails closed. A require preload first records an incomplete
loader participant and the observer binds its owner to that same marker.
Noncooperating ordinary workers, including the unreferenced esbuild worker from
a direct require-preload `tsx` invocation, remain unverified. Manifest versions
1, 2, and 3 keep their original rules.

The complete real integration capture at `4f5cf524` passed all 535 tests in
44 suites with zero failures, cancellations, skips, or todos. Its version-4
archive has 226 raw files and all 113 participants: 109 normal-exit owners plus
four real `tsx` internal loaders, each with matching owner and handshake,
intact checkpoint, and one distinct later flush. Strict archived reimport
produced a byte-identical report with the original `["integration"]` capture
identity; the default coverage report stayed unchanged. This complete capture
is separate from the protocol fixtures. The earlier `c620cf8f` run passed tests
but remained unverified because four loaders had raw-only evidence.
