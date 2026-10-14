# MCP-P03 implementation record

Ticket: `53db3dd7-56b9-415b-92e8-de6303d3eb3e`. Depends on MCP-P01 and MCP-P02.
The [MCP plan](mcp-server-plan.md) defines the scope.

## Delivered behavior

The self-hosted server now registers the HTTP tool `getURLAsMarkdown`.
`createApplication(config, logger, environment)` takes the server environment as
a third argument. Its self-hosted branch loads `src/fetch-tool.ts` by dynamic
import and calls `fetchToolServers(environment, logger)` before it opens the
Better Auth runtime, which holds the data-directory lock and the database. Thus
a rules failure holds no resource and changes no data.

`fetchToolServers` reads `AD_RULES_FILE` one time. Then it makes one
`HtmlToMarkdownPipeline` with `CleanHtmlAdsAdblockRs`,
`PromptInjectionRemoverSanitizer`, and `CleanHtmlToMarkdownDefuddle`, one
`WebsiteFetcherLightpanda(environment.LIGHTPANDA_BIN)`, and one operation,
`createGetURLAsMarkdown({ fetcher, pipeline })`. It returns the `buildServer`
function of `MCPServer`. Each MCP request gets its own SDK `Server` from
`createFetchToolServer(context, { operation, logger }, lifetime)`. Completion
records go to the application logger. In production, each dispatched
`tools/call` gives one `INFO` line of JSON.

`requestedUrl` stays the exact accepted spelling. The renderer's `finalUrl`
selects the ad rules and resolves relative links. The hosted edition still
answers 503, also with supplied credentials. This slice adds no POST tool, stdio
tool, cache, OAuth provider, rule subscription, rule updater, or exporter setup.
`NoAuthProvider` stays test-only.

## Ad rules file

`AD_RULES_FILE` is a server-only setting.
[`readAdRulesFile(environment)`](../../src/config/ad-rules-file.ts) reads it.
`loadDeploymentConfig` does not read it. The local account and client commands
share that loader and never read the rules. The commands and the hosted
placeholder do not load the rules reader, the renderer, the cleaning pipeline,
or adblock-rs. An acceptance test proves this with a module-load guard.

The value is the absolute path of a trusted file. The server reads the file one
time, with one `readFileSync` call and no check before the read. It decodes the
bytes as strict UTF-8 and removes a UTF-8 byte order mark at the start. There is
no size limit, because the operator trusts the file. There is no syntax check:
the native parser ignores lines that it cannot parse. An empty file, or a file
with only comments, makes the ad cleaner a no-op, as the
[ad rules reference](../reference/ad-rules.md) tells. There is no updater: a
changed file takes effect at the next server start.

For each of these errors, the server writes one `FATAL` line and exits with
status 1 before it listens. No message shows the path or the file contents. A
read, decoder, or parser failure keeps the original error as `cause`:

- `AD_RULES_FILE is required. Set it to the absolute path of a trusted ad rules file.`
  for an unset or empty value;
- `AD_RULES_FILE must be an absolute path.` for a relative path;
- `AD_RULES_FILE could not be read (<code>).` with the error code, for example
  `ENOENT`, `EISDIR`, or `EACCES`. The code is `unknown error` when the error
  has no string code;
- `AD_RULES_FILE must contain UTF-8 text.` for text that is not UTF-8;
- `The ad cleaner could not load the rules in AD_RULES_FILE.` when the native
  adblock-rs parser fails. The parser message is not shown.

## Runtime and image limits

The delivered runtime is a local Node process with the pinned Lightpanda 1.0.0
of the [runtime guide](../lightpanda-runtime.md). The server reads
`LIGHTPANDA_BIN` from its environment record at startup and passes it to the
`WebsiteFetcherLightpanda` constructor. The fetcher no longer reads
`process.env`. A nonempty value is the exact executable path. An empty or unset
value selects `lightpanda` on `PATH`.

Startup does not run or check the renderer. A server with a missing executable
starts. Each page fetch then fails with the tool error `Page fetch failed` and a
`fetch_failed` record. The fetcher error names the missing executable and
points to the runtime guide. It stays inside the server: no client answer and no
completion record contains it. The operator must verify the runtime with the
runtime guide before use.

The image sets `AD_RULES_FILE=/etc/thermus/ad-rules.txt` and makes the directory
`/etc/thermus`, but it has no rules file. `compose.yaml` mounts `./ad-rules.txt`
from the directory of `compose.yaml` read-only at that path, with
`bind.create_host_path: false`. Without the file, Compose stops with
`bind source path does not exist` and makes no directory in its place. This
applies to each Compose command that starts a container of the service, also
`docker compose run --rm thermus users ...`. Thus the operator makes the file
before the first such command. An empty file, for example from
`touch ad-rules.txt`, gives the documented no-op. A trusted Adblock Plus list
that the operator chose and checked can be used instead. A rules change needs a
new server container, `docker compose up -d --force-recreate thermus`, because
a restarted container keeps its old mount. `.gitignore` ignores
`/ad-rules.txt`, and `.dockerignore` keeps it out of the image build.

A server container without the rules file stops before it listens with
`AD_RULES_FILE could not be read (ENOENT).` and writes nothing to the volume.
Command containers do not read the rules.

The image still has no Lightpanda renderer. A server container lists
`getURLAsMarkdown`, but each page fetch in it fails with `Page fetch failed`.
This slice claims no container rendering. Renderer image provisioning is
separate future work.

## Tests and gates

The [test inventory](../testing/test-list.md) lists each case with its focused
command. The [gate policy](test-gate-policy.md) defines the required runs.

- Explicit renderer gate: `npm run test:mcp:renderer` builds and runs
  `test/acceptance/mcp/get-url-as-markdown.runtime.ts`. The `.runtime.ts` name
  keeps it out of `npm test` and `npm run test:acceptance`. It needs
  `LIGHTPANDA_BIN` with the pinned Lightpanda 1.0.0. Its pages are local HTTP
  fixtures on `127.0.0.1`, and the test-only `permitIPv4Fixture` seam lets the
  renderer reach only that address. It needs no public network and no Axiom
  credentials. Its six cases cover both protocol eras with sign-in and consent
  on the bundled pages, a redirect that changes the host and the path, hidden
  content, sanitizer withholding, an HTTP error, a DOM deeper than 256 levels,
  a modern client cancellation, and a legacy call during server shutdown.
- Renderer gate setup: `test/acceptance/mcp/renderer-gate-setup.test.ts` runs
  the gate four times with bad prerequisites. Each run must fail with a message
  that starts with `Renderer gate setup failed:`, and no gate test can pass, be
  skipped, or be left as todo. A passing default acceptance suite never counts
  as rendered end-to-end proof.
- Offline acceptance with the real provider:
  `test/acceptance/mcp/self-hosted-fetch-tool.test.ts` runs the production
  `serve()` in the test process with real Better Auth, the real cleaning
  pipeline, and a renderer process double at the Node `child_process.execFile`
  and DNS APIs. It covers both eras, rules that stay as read at startup, the
  renderer launch arguments and limits, forged, revoked, and disabled-user
  credentials (401), a banned user with a live session (403), empty rules,
  sanitizer withholding, a too-deep DOM, and a failed render.
- Startup: `test/acceptance/mcp/self-hosted-rules-startup.test.ts` covers each
  rules failure, retained data, the no-op files, and a missing renderer.
  `test/acceptance/mcp/server-only-modules.test.ts` covers the module-load
  guard for the commands, the hosted placeholder, and the server.
- Integration: `test/integration/application-ad-rules.test.ts` covers a missing
  rules file and a failing native parser at the `createApplication` interface.
- Unit: `test/unit/config/ad-rules-file.test.ts`,
  `test/unit/website-fetcher/website-fetcher-runtime.test.ts`, and
  `test/unit/website-fetcher/website-fetcher-concurrent-calls.test.ts`.
- Container gate: each server container gets the trusted rules fixture
  `test/support/fixtures/trusted-ad-rules.txt`, copied with
  `docker container cp` to `/etc/thermus/ad-rules.txt` before it starts. Command
  containers get no rules file. The containers still get only the settings of
  the image and `PUBLIC_BASE_URL`, with the normal telemetry settings and the
  outbound denial. A new case starts a server container without the rules file:
  it stops before it listens with the `FATAL` line and writes nothing to its
  volume, and a command container still adds an account. The first case also
  calls the tool with the address-literal URL `https://93.184.216.34/page`. It
  gets `Page fetch failed` and a `fetch_failed` record, and no container tries
  an outbound connection. Tool lists in the gate now show `getURLAsMarkdown`.
  The image inspection case checks `AD_RULES_FILE`, the missing rules file in
  the image, and the Compose bind mount. The gate now has nine cases; it had
  eight. It does not prove renderer behavior.
- Changed tests: server processes in the auth acceptance and integration tests
  get `AD_RULES_FILE` from `selfHostedServerSettings(directory)` in
  `test/support/local-runtime.ts`. Commands still use
  `selfHostedSettings(directory)`. Self-hosted tool lists now expect
  `['getURLAsMarkdown']`. `test/support/mcp-protocol-eras.ts` holds the protocol
  era list and the client negotiation option of the MCP acceptance tests.
- New test support: `in-process-server.ts` runs the production `serve()` in the
  test process. `renderer-process-double.ts` stands in for the renderer process
  and DNS. `server-preloads.ts` and `fail-ad-cleaner.ts` make the native rule
  parser fail in a server process. `fixtures/trusted-ad-rules.txt` holds the
  trusted test rules. All of them are in `test/support/`.

## Test-first evidence

The new acceptance files were written before the production change. They failed:

- Rules startup: 9 of 14 cases failed. The file then also held the three
  module-load cases, which are now in `server-only-modules.test.ts`. The 5
  cases that passed specify behavior that had to stay: the no-op rules files
  and a missing renderer start the server, and the commands and the hosted
  placeholder load no server-only module.
- Offline fetch tool: 5 of 5 cases failed with `Method not found`.
- Renderer gate: 4 cases failed with `Method not found`, and the 2 cases that
  wait for the renderer reached their test timeout.
- Renderer gate setup: the test failed, because its nested `node --test` run
  inherited `NODE_TEST_CONTEXT` and skipped the gate file. The test now removes
  that variable for the nested run.

The two integration cases in `test/integration/application-ad-rules.test.ts`
came after the production change. They add coverage at the `createApplication`
interface; they are not test-first evidence.

## Review notes

- A modern client cancellation stops the renderer at once. The server stop that
  follows can wait about four seconds for the HTTP connection of the cancelled
  call. This is existing HTTP bridge and SDK behavior, outside this slice.
- A legacy client can get no answer for a call that the server shutdown
  cancels. Thus the renderer gate closes that client after shutdown. It does not
  wait for the SDK request timeout.
- While the manager checked the timing of the two waiting cases, a temporary
  copy of the renderer gate with extra timing output failed one time in the
  legacy shutdown case. Its assertion output was not kept. Later, 19 runs of
  that case passed, 3 of them with the unchanged gate file. Each run of the gate
  on the candidate passed.
- The Compose mount was checked with Docker Engine 29.5.2 and Compose 5.6.0 on
  colima, with a small probe service and the same bind settings. Without
  `ad-rules.txt`, `docker compose up` and `docker compose run` stop with
  `bind source path does not exist` and make no directory. After an editor-style
  replacement of the file (a new file renamed over the old one),
  `docker compose restart` gave the container no file, and
  `docker compose up -d --force-recreate` gave it the new file. The guides
  therefore tell the operator to make a new container after a rules change.

## Candidate verification

The candidate contains commits `4f50763`, `b3965b8`, `7acdea7`, and `acea742`.
The commands below ran on the clean working tree of `acea742`. The final
document commit records the results and changes no executable file. Counts are
tests/pass/fail/cancelled/skipped/todo.

`pnpm exec node --version` reports `v24.20.0`. Renderer tests use
`LIGHTPANDA_BIN="$PWD/.cache/lightpanda/1.0.0/lightpanda"`; it reports 1.0.0 and
its SHA256 is `955440053a84754dd64c62f970449a56a2b350cdf43ea5f2e809a73047b8173d`,
the macOS ARM64 digest of the runtime guide. The documented Axiom test settings
came from the local environment. The container gate used Docker Engine 29.5.2
with Buildx 0.38.0 and Compose 5.6.0.

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | The lockfile is up to date. |
| `npm run check` | 0 | Unit 2053/2053/0/0/0/0; portal unit 6/6/0/0/0/0; build 10/10/0/0/0/0; portal acceptance 4/4/0/0/0/0. Type checks and the portal build passed. |
| Focused command below | 0 | 277/277/0/0/0/0 |
| `npm run test:integration` | 0 | 256/256/0/0/0/0 |
| `npm run test:acceptance` | 0 | Server 197/197/0/0/0/0; portal 4/4/0/0/0/0. The container suite is skipped and runs no test, as the gate policy states. |
| `npm run test:interface` | 0 | 83/83/0/0/0/0, including Better Auth, the renderer contracts, the public-site smoke test, and the live Axiom exports |
| `npm run build && node --test dist/test/interface/auth/better-auth.test.js` | 0 | 23/23/0/0/0/0 |
| `npm run test:mcp:renderer` | 0 | 6/6/0/0/0/0 with Lightpanda 1.0.0 |
| `npm run test:container` | 0 | 9/9/0/0/0/0; both images were built and all cases ran without outbound access |
| `habit-hooks` | 1 | 2 function-length, 93 comment, and 6 file-length findings; the reasons to keep them are below. No test counts apply. |

Each reported test passed. None was cancelled, skipped, or left as todo. The
focused command ran after a clean build. It selected each new or changed test
file, with the local renderer interface tests:

```sh
LIGHTPANDA_BIN="$PWD/.cache/lightpanda/1.0.0/lightpanda" node --test \
  dist/test/unit/config/ad-rules-file.test.js \
  "dist/test/unit/website-fetcher/*.test.js" \
  dist/test/integration/application-ad-rules.test.js \
  dist/test/integration/auth/local-installation.test.js \
  dist/test/integration/auth/local-auth-command-lock.test.js \
  dist/test/integration/auth/hosted-administration.test.js \
  dist/test/integration/auth/hosted-organizations.test.js \
  dist/test/integration/server-stop-signals.test.js \
  "dist/test/acceptance/mcp/*.test.js" \
  dist/test/acceptance/auth/self-hosted.test.js \
  dist/test/acceptance/auth/self-hosted-startup.test.js \
  dist/test/acceptance/auth/self-hosted-routes.test.js \
  dist/test/acceptance/auth/local-user-commands.test.js \
  dist/test/acceptance/auth/local-client-registration.test.js \
  dist/test/interface/website-fetcher-cancellation.test.js \
  dist/test/interface/website-fetcher-http.test.js \
  dist/test/interface/website-fetcher-network.test.js \
  dist/test/interface/website-fetcher-readiness.test.js \
  dist/test/interface/website-fetcher-redirects.test.js
```

Habit findings are kept for these reasons:

- Function length: the renderer's render method and its promise callback keep
  one child's timer, listener, kill request, and completion state in one call
  scope, as the [P02 record](mcp-p02.md) tells. P03 changed only where the
  executable comes from.
- Comments: 59 findings are on new lines. They give reasons, constraints, or
  the contract of a test double: why the rules load before the data directory,
  why the messages hide the path and the contents, why one read has no check
  before it, the byte order mark, why the parser error stays only the cause,
  why the gate copies the rules file into the container, why the nested gate
  run removes `NODE_TEST_CONTEXT`, why the gate closes the legacy client, the
  sign-in limit of one process, the ban without session deletion, and how the
  fixtures make the sanitizer withhold HTML. The other 34 are earlier comments
  in changed files; the P02 record gives their reasons.
- File length: four files were long before this slice. P03 changed only their
  assertions, settings, or one shared import. Two files are new. The renderer
  gate must stay one file that its own command selects; its fixtures, setup
  checks, and site helper serve all six cases. The offline fetch tool file
  keeps one installation, renderer double, and story fixture for its five
  cases, and its refusal case compares refused users with a peer on the same
  server. The rules startup file was split, so the module-load cases have their
  own file.

This slice also corrected a complexity finding in the first container case. An
earlier run reported unused files in `dist-manager/`, an ignored local build
output that is not part of the candidate; it was removed. The snooze file
remains `[]`.
