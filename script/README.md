# Fetch a URL or search through MCP

`fetch-url.ts` calls Thermus `getURLAsMarkdown` without an LLM client. It sends
`{url, reason}` and writes the returned Markdown to standard output. It uses the
MCP SDK for protocol negotiation and JSON or SSE responses.

`search/search.ts` calls Thermus `search` with `{query, reason}` and writes the
exact results Markdown to standard output. It uses the same authentication,
protocol negotiation, and deadline options as the fetch command.

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
[`errors.ts`](fetch-url/helper/errors.ts) defines command errors.
[`public-tool-failure.ts`](fetch-url/helper/public-tool-failure.ts) checks the exact
public tool failure text that the command can print. Internal token parsing,
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

Search and fetch share this grant and lock. Login in either command saves the
grant for both commands. Logout in either command removes it for both.

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
The script preserves only exact approved public errors from a tool failure
with one text item. These include `Page fetch failed`, safe fetch details such
as `Page fetch failed: HTTP 429`, and the other fixed public messages in the
[MCP debug command contract](../docs/reference/mcp-fetch-tool.md#debug-command).
Unknown text, changed spelling, added text, invalid HTTP status numbers, or extra
content items give a generic tool failure diagnosis. Other result fields are
never printed. The [public fetch failure contract](../docs/reference/mcp-fetch-tool.md#public-fetch-failures)
lists all details. Hosted details require the updated server to be deployed;
the script also accepts generic failures from older servers. Use the server
logs for operator diagnostics. Run `pnpm exec node script/fetch-url/fetch-url.ts --help` for the options.

Verify script changes with relevant type, lint, and manual command checks.

# Search through MCP

Run the search command from the repository root after the dependency installation
above. No build is needed:

```sh
pnpm exec node script/search/search.ts --login
pnpm exec node script/search/search.ts \
  --query 'Lightpanda browser documentation' \
  --reason 'Find the official browser documentation' > results.md
```

The query must contain 1 to 512 Unicode scalar values and at least one
non-whitespace character. Lone UTF-16 surrogates are refused. The reason must
contain 1 to 2000 Unicode code points and at least one non-whitespace character.
The command sends accepted query and reason text unchanged.

Use `--non-interactive` to reuse or refresh the shared grant without opening a
browser. Use `--logout` to delete the shared local grant. As with fetch, unset
`THERMUS_API_KEY` before `--login` or `--logout`; use these options without a
query, reason, or explicit credential. Browser sign-in and token refresh use the
same hosted profile and callback port as fetch.

Explicit Bearer input uses `THERMUS_API_KEY` or `--api-key-stdin`. Stdin replaces
the environment credential and must reach EOF. Custom endpoints need explicit
input. For example, after the hidden credential read shown above:

```sh
printf '%s' "$THERMUS_API_KEY" | pnpm exec node script/search/search.ts \
  --api-key-stdin \
  --query 'Lightpanda browser documentation' \
  --reason 'Find the official browser documentation' \
  --timeout-ms 10000
```

The default endpoint is `https://app.thermus.ai/mcp`. `--endpoint` accepts HTTPS
or loopback HTTP and refuses redirects. `--timeout-ms` bounds negotiation and
the search call, including stdin in explicit mode. It defaults to 60000 ms and
accepts 100 through 300000 ms. The search deadline starts after OAuth finishes.
SIGINT, SIGTERM, and timeout abort network work and close the MCP client.

Success returns status 0 and the exact Markdown, including `No search results.`
or an empty result. Failure returns status 1, a safe `search:` diagnostic on
stderr, and no Markdown. Only exact approved search failure text from one text
item is printed. Unknown text, extra content, or a private suffix gives the
fixed message `Search failed. Check the query and server logs.` Other result
fields are never printed. The [search contract](../docs/reference/mcp-search-tool.md#debug-command)
gives the allowed errors. Run `pnpm exec node script/search/search.ts --help`
for all options.

[`search.ts`](search/search.ts) is the entry point.
[`search-input.ts`](search/helper/search-input.ts) checks query and reason limits.
[`public-tool-failure.ts`](search/helper/public-tool-failure.ts) checks safe search
errors. Search reuses the existing OAuth, browser, credential store, and error
helpers under `fetch-url/helper/`.

Verify search script changes with relevant type, lint, and manual command checks.

# Measure and review code quality

The ten ast-metrics commands and their helpers are in
[`code-quality/`](code-quality/README.md). That guide explains CRAP before
the command sections, which follow the review process order. It gives the
source layout and Usage/Options contracts. Use relevant type, lint, help,
and manual report checks for changes to these commands.
The coverage command defaults to both complete unit parts: emitted Node tests
and source portal tests. Repeat `--suite unit|integration|acceptance` for
independently selected package suites. It builds once, preserves exact package
selections, retains each capture identity, and unions compatible coverage. Nested
or broader commands defer collection; missing shutdown evidence rejects capture.
No option expands the selected test scope. Trend charts split at changes in
suite set. Older D3 records without `captureProvenance` retain their historical
unit-only schema; pre-D3 unknown records stay unknown. The report always includes community
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

The complete real integration capture at `88bfbf71` passed all 535 tests in
44 suites with zero failures, cancellations, skips, or todos. Its version-4
archive has 226 raw files and all 113 participants: 109 normal-exit owners plus
four real `tsx` internal loaders, each with matching owner and handshake,
intact checkpoint, and one distinct later flush. Strict archived reimport
produced a byte-identical report with the original `["integration"]` capture
identity; the default coverage report stayed unchanged. This complete capture
is separate from the protocol fixtures. The earlier `c620cf8f` run passed tests
but remained unverified because four loaders had raw-only evidence.

# Compute the review tier and merge eligibility

[`pr-review/check.ts`](pr-review/check.ts) reports T0 Auto merge, T1 Team review,
or T2 Need architect, with every matching reason. Merge eligibility is separately
`eligible` or `blocked`; blockers are not review tiers. The checker uses the
trusted merge-base [rules](../docs/implementation/pr-review-rules.yaml), candidate
facts, and base/head-bound impact evidence. Root `.pr-impact.json` holds the
committed declaration; local checks use a copy stamped with actual base/head
identities as the check guide specifies. Its local result is preliminary and
does not prove completed local checks or human approval. Follow "Review tier and merge
eligibility" in [AGENTS.md](../AGENTS.md). The
[check guide](pr-review/README.md) gives options, evidence, output, and tests.

# Operate the tenant fleet

[`fleet/fleet.ts`](fleet/fleet.ts) is the fleet script of the tenant services
of SO-09. It uses the Render adapter of the tenant platform and the tenant
registry of the control plane: it imports them from `src`, so it has the same
write guard, retry bounds, and conditional registry statements. It has the six
commands of the answers of 27 October 2026:

| Command | What it does | Writes |
| --- | --- | --- |
| `list` | One line for each row of the registry whose service name starts with `TENANT_NAME_PREFIX`, or that has no service yet: the organization, the state, the plan, the service, the digest, the last use, the update time, and the failure reason. | none |
| `status --organization <id>` | The row of the organization, its newest deploy on Render, and its internal address. | none |
| `request --organization <id>` | Reads the organization in WorkOS and refuses an organization that WorkOS does not have. Without a row, it inserts a `requested` row inside `FREE_TENANT_LIMIT`, as signup and the gateway do. A `deleted` row becomes `requested` again inside the cap, as a new request without its old service: the repair "delete, then request". A row in another state stays as it is. The provisioner of the control plane then creates the service. | the registry |
| `upgrade --image <reference@sha256:...> (--organization <id> \| --all) [--batch-size 1..3]` | Deploys the image by digest to the live tenants of the prefix with the Render API deploy with `imageUrl`, in batches of at most three (default three). The deploys of a batch go one after the other, then the batch waits until each deploy is live or failed, every 5 s for at most 15 minutes. The wait follows the deploy that Render names in its `201` answer; a newer deploy with another ID superseded it, which stops the upgrade. After a `202` answer without the deploy, the wait takes the first new deploy, and the line says that its identity is unconfirmed. A deploy that reaches `live` counts as healthy, and the registry records the digest only when that deploy names the requested digest. A live deploy without a digest (`digest unconfirmed`) or with another digest leaves the registry digest as it is. The upgrade stops after the first batch with a deploy that does not reach live with the requested digest; later batches do not start. A suspended tenant is left as it is. | Render, the registry |
| `suspend --organization <id>` | Suspends the service of a `live` tenant, then sets the row `suspended` from `live` on that service. A suspended tenant costs nothing. The next MCP call of the organization resumes it, as after the idle sweep of the control plane: the calls of about a minute get `503` with `Retry-After: 60` until the tenant is live. | Render, the registry |
| `resume --organization <id>` | Resumes the service of a `suspended` tenant without an MCP call, sets the row `deploying` on that service, waits until the first new deploy after the resume is live, and sets the row `live` on that service. Render names no deploy in the answer of a resume, so the line says that the identity of that deploy is unconfirmed. When the provisioner of the control plane records the row `live` first, the line says that another writer changed it. | Render, the registry |
| `delete --organization <id>` | Deletes the Render service of the tenant through the adapter, then sets the row `deleted` from the state and the service that it read. A row that another writer changed meanwhile, also a new provision of the organization with a new service, stays as it is. A row without a service only becomes `deleted`. The weekly organization sweep of the control plane uses the same removal. | Render, the registry |
| `summary` | Prints the line of the daily summary of the control plane, `Tenant fleet summary: <JSON>`, made now from this registry, Render, and WorkOS. | none |

Each write command prints what it will do and waits for one answer. Only the
exact answer `yes` lets the write go; another answer, or the end of the
input, writes nothing. A write that the platform refuses or cannot do changes
no row. The registry follows the platform: the service changes first, and
then the row changes only from the state and the service that the command
read, so a change of the provisioner or the gateway at the same time is not
overwritten. A delete, a revive, and a new provision give the row a new
service, so a slow command cannot change the replacement row, also when it is
in the same state again (manager decision of 31 October 2026).

A suspended tenant comes back at the next MCP call of its organization (SO-10).
The gateway of the control plane sets the row `deploying` and sends one resume
call to Render; the provisioner records the row `live` when the deploy of the
resume is live. Until then, each call gets `503` with `Retry-After: 60`. A
resume that Render refuses or limits sets the row back to `suspended` with one
operator report, and the next call tries again. `resume` brings a tenant back
without a call, for example before a demonstration.

Settings, from the environment. Each refusal names the variable, never its
value, and the script never prints a key:

| Variable | Commands | Meaning |
| --- | --- | --- |
| `DATABASE_URL`, `DATABASE_CA_CERT_PATH` | each | The tenant registry, with the runtime role `thermus_logging`. |
| `RENDER_API_KEY` | `status`, `upgrade`, `suspend`, `resume`, `delete`, `summary` | The fleet key: the API key of the owner's Render user, in `.env.local` of the main checkout. It is not the key of the control plane, so the fleet uses another rate-limit bucket (plan section 4.2). |
| `RENDER_OWNER_ID` | the same | The workspace of the tenants: `tea-db8i6ceq1p3s73dev9og`, Thermus AI. The script refuses My Workspace, `tea-d3mlbrvdiees73ca4rdg`. |
| `WORKOS_API_KEY`, `WORKOS_CLIENT_ID` | `request`, `summary` | The WorkOS environment of the organizations. In development, run the script through the WorkOS Staging launcher. |
| `TENANT_NAME_PREFIX` | each | The prefix of the tenant services, with the rule of the control plane; default `thermus-tenant-`. Staging uses `thermus-spike-tenant-`. |
| `TENANT_PLAN_FREE` | `summary` | The Render plan of a free tenant, for the cost of the summary: about 7 USD a month for a running free tenant, and about 25 USD for another plan. |
| `FREE_TENANT_LIMIT` | `request` | The cap of a request, with the rule of the control plane; default 25. |

The script works only on the rows of its prefix. It refuses each row that
names the production service `srv-db8mnqg473hc739d529g`, before any call, and
the adapter refuses each write for that service and for a service that the
registry does not own. Exit code 0: the command ended, also after an answer
other than `yes`. 1: a step failed; the message says what changed. 2: a usage
error or a refused setting, before any call.

Run it from the repository root. A command that reads WorkOS runs through the
Staging launcher in development; `node --env-file` keeps a variable that the
launcher already set:

```sh
TENANT_NAME_PREFIX=thermus-spike-tenant- RENDER_OWNER_ID=tea-db8i6ceq1p3s73dev9og \
  node --env-file=/Users/tomermayara/git/Thermus/.env.local --env-file=<registry settings file> \
  script/fleet/fleet.ts status --organization org_01HX...
TENANT_NAME_PREFIX=thermus-spike-tenant- TENANT_PLAN_FREE=0.5c-512mb RENDER_OWNER_ID=tea-db8i6ceq1p3s73dev9og \
  node ~/.config/thermus/with-workos-staging.cjs node --env-file=/Users/tomermayara/git/Thermus/.env.local \
  --env-file=<registry settings file> script/fleet/fleet.ts summary
```

The key rotation of the gateway and the repair of a `failed` row are runbooks,
not commands: [tenant fleet runbooks](../docs/implementation/tenant-fleet-runbooks.md).
The [SO-09 record](../docs/implementation/self-onboarding-s1.md#so-09-fleet-script-and-organization-sweep)
gives the manual checks. Verify script changes with type, lint, and manual
command checks on `thermus-spike-*` tenants in Thermus AI.

# Deploy a hosted image digest

The deploy job of [`.github/workflows/hosted-image.yml`](../.github/workflows/hosted-image.yml)
runs [`release/deploy-hosted-image.ts`](release/deploy-hosted-image.ts) with Node
and no installed package. `check` checks the deploy request of the manual
dispatch and makes no network call. `deploy` checks it again, deploys the digest
to the Render web service with the Render API deploy with `imageUrl`, waits for
`live`, and checks `/healthz`. It reads the inputs from `DIGEST`, `SERVICE_ID`,
`CONFIRM_PRODUCTION`, and `GITHUB_REF`, and the key from `RENDER_API_KEY`; it
never prints the key. [Hosted release](../README.md#hosted-release) gives the
rules. [`deploy-request.ts`](release/deploy-request.ts) holds the request rules,
[`render-api.ts`](release/render-api.ts) the API client,
[`render-answers.ts`](release/render-answers.ts) the fields of the answers, and
[`public-health.ts`](release/public-health.ts) the health check. Verify changes
with type, lint, and manual checks, and with a dispatch against a disposable
`thermus-spike-*` web service.

# Rehearse the SO-12 release

[`release/rehearsal/rehearsal.ts`](release/rehearsal/rehearsal.ts) is the helper
of the SO-12 rehearsal, part B of the
[release record](../docs/implementation/self-onboarding-s2-release.md#3-rehearsal).
It makes the calls that the fleet script, the release workflow, and the probes
do not make: the create of the staging control plane `thermus-spike-control` as
a Git build with its variables and the secret file of the database CA (R1), the
host settings (R2), the switch to the image (R4), the variables of the gateway
switch (R7) and of the rollback (R14), the OAuth resource of the staging control
plane (R3b), the WorkOS Staging objects of the run (R6, R9, R13), the Connect
tokens and the MCP calls, the browser steps of the portal, the reads of the
staging database, and the cleanup of the WorkOS objects. It also cancels a Git
build and watches the deploys and the events after an update (the changed order
of the manager decision of 31 October 2026). The deploys go through the release
workflow, and the tenants through the fleet script: `fleet -- <command>` runs
`fleet/fleet.ts` with `DATABASE_URL` from `STAGING_DATABASE_URL`, the CA, the
workspace Thermus AI, and the prefix `thermus-spike-tenant-`. The MCP call
accepts the marker words of the hosted image gate, because the words of
`https://example.com/` changed.

Guards:

- Each Render call to a service goes through the guarded client of the Render
  probes: it names `thermus-spike-control` or a `thermus-spike-tenant-*`
  service that the command found by its name first, and never the production
  service `srv-db8mnqg473hc739d529g`.
- Each WorkOS command needs the values of the WorkOS Staging launcher. The
  helper refuses each other client ID or issuer, because `.env.local` holds
  the WorkOS values of another environment.
- The database reads need `STAGING_DATABASE_URL` with the user
  `thermus_logging.kgiidcbufczoyifzxvtf` on the pooler of the staging project,
  and verify TLS with the CA of `REHEARSAL_CA_PATH`.
- The helper makes each new secret (the cookie password, the settings key, and
  the gateway key pair) in memory and sends it to Render in the body of the
  call only. It prints each secret variable as its length only.
- The IDs of the run, the passwords of its test users, and its Connect tokens
  are in `state.json` in the folder of `REHEARSAL_STATE_DIR`, which must have
  mode 700. The cleanup deletes the folder.

Run it from the repository root, through the WorkOS Staging launcher, with the
fleet key file of the main checkout:

```sh
REHEARSAL_STATE_DIR=<private folder, mode 700> REHEARSAL_CA_PATH=<CA PEM file> REHEARSAL_RUN_ID=<YYYYMMDD-HHMM> \
  node ~/.config/thermus/with-workos-staging.cjs node --env-file=/Users/tomermayara/git/Thermus/.env.local \
  script/release/rehearsal/rehearsal.ts <command> [options]
```

`node script/release/rehearsal/rehearsal.ts` without a command prints the
commands. Exit code 0: the command ended. 1: a step failed. 2: a usage error
or a refused setting. Verify changes with type, lint, and manual checks on
`thermus-spike-*` services in Thermus AI and WorkOS Staging.
