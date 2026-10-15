# Basic MCP URL fetch: work slice plan

Status: done; refactored onto production seams on 2026-10-14.
Date: 2026-10-14. Branch: `claude/basic-mcp-url-fetch-d00f84`.
Entry point: `test/acceptance/work-slice/basic-mcp-url-fetch.ts`.
The owner accepted the defaults of each decision on 2026-10-14, with one
change: the entry point lives under `test/acceptance/work-slice/`, not under
`script/`, and that folder has a `README.md` that describes each work slice.

Progress on 2026-10-14: steps 1 to 4 are done and signed off. The new tests
pass 53 of 53 with the command of [Tests](#commands). `npm run check` passes
with 2,282 unit tests, 8 portal unit tests, 10 build tests, and 4 portal
acceptance tests. `npm run typecheck`, `habit-hooks`, and `npx knip` pass; the
only knip finding is the older `other-renderer` binary. The worktree first needed
`pnpm install --frozen-lockfile`, because its `node_modules` lacked `jose`,
`@workos-inc/node`, and `playwright`; the install came from the local store.
Step 0 and step 5 ran on 2026-10-14 on the owner's Mac. The recipe installed
Lightpanda 1.0.0 with a correct SHA256 under `.cache/lightpanda/1.0.0/`, and
the three Axiom lines went into `.env.local` of the worktree. The slice run,
scope name `thermus-work-slice-988df9ee-3fa8-4edc-8bbd-905218a32193`:

1. The script listened on `http://127.0.0.1:8080` and printed the client
   command, the Axiom link, the scope name, and the APL filter.
2. `claude mcp add` with the static header, then `claude mcp get`, showed the
   server as connected in Claude Code 2.1.289.
3. A non-interactive Claude Code session called `getURLAsMarkdown` for
   `https://example.com/`. The log had the started line, the completed line
   with 957 characters of Markdown, and one completion record with the status
   `success`, in about 450 ms. The live page has no heading now, only a
   title, so the answer named none; the pipeline dropped nothing.
4. Every export was accepted: no failure line, and `close()` resolved. The
   ingest token cannot query (`403`, `query` with action `read`). The owner
   then connected the Axiom MCP connector, and a query with the APL filter of
   the script found the five events of the run in `system-log-test`, in
   order: the listening line, the started line, the completed line with the
   Markdown, the completion record, and the stop line. The field names are
   confirmed: `scope.name`, `body`, `severity_text`, `severity_number`, and
   `service.name`, which is `unknown_service:node`.
5. `SIGINT` gave `Stopping after SIGINT`, exit status 0, and a free port. The
   Claude Code entry was removed again.

Step 6 runs of 2026-10-14 on the complete candidate: `npm run test:integration`
passed 350 of 350, and `npm run test:acceptance` passed 235 of 235 plus the 4
portal acceptance tests, with the Axiom settings and network access.
`npm run test:container` passed 12 of 12 in about four minutes with Docker
Engine 29.5 on `linux/arm64` and left no gate resource behind. On the complete
candidate, the new tests passed 53 of 53, `npm run check`, `npm run typecheck`,
`habit-hooks`, and `npx knip` passed, and the documents of step 6 were updated.
The pull request of the branch records each run.

Refactoring on 2026-10-14: the owner asked why the slice keeps its own settings
reader, logger, and composition instead of the production mechanisms. The slice
now uses `loadPublicUrls`, `createFetchOperation`, `fetchToolServers`,
`routeLocalRequests`, `composeApplication`, `serveApplication`,
`BaseLogger.messageOf`, and `OtelLogger` from production; production gained
these seams where it had private copies. Only the mock provider and the
page-text lines stay slice-only, by decision.

The slice ran again after the refactoring, on 2026-10-14, with the settings
of the server: `PUBLIC_BASE_URL=http://127.0.0.1:8080`, an empty
`AD_RULES_FILE`, and the pinned renderer. Scope name
`thermus-work-slice-e6a5d85b-905a-4f37-b110-56dacc4e79a3`. The console stayed
empty. Claude Code connected with the static header, and a non-interactive
session read `https://www.iana.org/help/example-domains` through the tool and
summarized it. Axiom held the four events of the run, now with the production
call sites: `index.ts` for the listening line, `work-slice-application.ts`
(now in the entry point) for the started and completed lines, and
`fetch-tool-server.ts` for the record.
`SIGINT` gave exit status 0, so every export was accepted.

On 2026-10-14, the owner merged pull request 80 as `1ed55aa`. The owner
decided to keep `openAxiomLogging()` in test support until the audit-trail work
makes the Axiom export a production feature. The launcher script
`test/acceptance/work-slice/basic-mcp-url-fetch.sh` came in a second pull
request. It runs the entry point through `pnpm exec node --import tsx`, the
pinned Node runtime of pnpm, and not through the package script: pnpm passes a
signal to that child, but the package script puts a shell wrapper and the
`tsx` CLI between them, and a signal to the wrapper stops nothing. A smoke run
on 2026-10-14, scope `thermus-work-slice-6b704cb0-c370-4daf-af43-875d1cd20cfe`,
started the slice from another directory; `SIGINT` to the process of the
launcher gave exit status 0, a free port, and the listening and stop lines in
Axiom.

## Goal

One script starts the MCP fetch tool for a local LLM and shows each fetch in
Axiom. The slice has three steps:

1. Start the MCP server with the mock provider that the acceptance tests use.
   The provider accepts any Bearer token.
2. Give the LLM client the server as its internet access, and fetch one URL
   through it.
3. Watch the Axiom logs. See the URL go out and the Markdown page come back.

The slice is a development tool. It changes no production behavior and no
production setting. The product keeps Better Auth and the hosted WorkOS
provider.

## Starting point

| Part | State | Where |
| --- | --- | --- |
| Mock provider | Exists. Tests only. | `test/support/auth/no-auth-provider.ts` |
| MCP server with the Bearer checks | Exists. | `src/mcp/mcp-server.ts` |
| Fetch tool, operation, and completion record | Exists. | `src/mcp/fetch-tool-server.ts`, `src/mcp/get-url-as-markdown.ts` |
| Production fetch composition | Exists, but only behind Better Auth. It does not expose the fetcher or the pipeline. | `src/fetch-tool.ts`, `src/application.ts` |
| HTTP bridge | Exists. | `src/http/server.ts` |
| OTel logger adapter | Exists. No production wiring. | `src/logging/otel-logger.ts` |
| Axiom settings reader | Exists. Tests only. The dataset is fixed to `system-log-test`. | `test/support/axiom-test-export.ts` |
| Work slice folder and entry point | Missing. | `test/acceptance/work-slice/` |
| A log line with the URL before the fetch | Missing. The completion record comes after the call and cuts the URL to origin and path. | |
| A log line with the Markdown | Missing. Records exclude page text on purpose. | |
| LLM client configuration | Missing. No client has a Thermus entry. | |
| Pinned renderer on this Mac | Missing. `lightpanda` on PATH is a nightly build. | |
| Axiom settings in the worktree | Missing. They are in `.env.local` of the main checkout only. | |

## Decisions

Each decision has a default. Confirm or change it before step 1.

| ID | Decision | Default | Alternative |
| --- | --- | --- | --- |
| D1 | Layout | The entry point and its acceptance test in `test/acceptance/work-slice/`, with a `README.md` for the work slices. The composition in the entry point, which the tests import; it runs only when executed directly. The package script `work-slice:basic-mcp-url-fetch`. The entry point is not a `*.test.ts` file, so no suite selects it, as with the `.runtime.ts` and `.live.ts` files. | A `script/` directory. It needs a change of the `include` list of `tsconfig.json`. |
| D2 | Page text in the logs | The slice logs the full requested URL before the fetch and the Markdown after it, cut at 65,536 code points. These two lines come from the slice only. The production completion record stays as it is. | Log only the Markdown length. |
| D3 | Axiom dataset and settings | Reuse `axiomTestSettings()`: `AXIOM_API_KEY`, `AXOIM_ENDPOINT_URL`, and the dataset `system-log-test`, from the environment or from `.env.local`. | A new reader for a dedicated dataset. |
| D4 | LLM client | Claude Code with a static `Authorization` header. | Codex with `http_headers` in `~/.codex/config.toml`. |
| D5 | Renderer | `LIGHTPANDA_BIN` is required and must report 1.0.0. The script checks this before it listens. | Accept the nightly build on PATH. The documents do not support it. |
| D6 | Ad rules | `AD_RULES_FILE` is required, as for the server. An empty file gives no rules. The production reader loads the file. | Optional, with no rules when it is not set. The slice used this rule until the refactoring of 2026-10-14. |
| D7 | Bearer token | Any non-empty token. The printed client command uses `local-dev`. | None. |
| D8 | Proof | An offline acceptance test with the renderer double and a recording logger. The manual run proves the Axiom export, and the pull request records it. | Also a `.live.ts` test of the Axiom wiring. |

## Design

### Files

```
src/logging/base-logger.ts                            error() and fatal() accept a failure; BaseLogger.messageOf(failure) renders it
src/config/deployment-config.ts                       loadPublicUrls(environment, deployment), now exported
src/fetch-tool.ts                                     createFetchOperation(environment, logger) and fetchToolServers(operation, logger)
src/mcp/get-url-as-markdown.ts                        the FetchOperation type, now exported
src/index.ts                                          serveApplication(open, options), ProcessSignals, and ServeOptions, now exported
test/acceptance/work-slice/README.md                  A short description of each work slice
test/acceptance/work-slice/basic-mcp-url-fetch.ts     The entry point and the composition: createWorkSliceApplication(), observeFetches(), MARKDOWN_LOG_LIMIT; it runs only when executed directly
test/acceptance/work-slice/basic-mcp-url-fetch.test.ts   The acceptance test
test/acceptance/work-slice/basic-mcp-url-fetch.sh     The launcher script: the settings with their defaults, then the entry point with the pinned Node runtime of pnpm
test/support/axiom-test-export.ts                     axiomTestSettings() and openAxiomLogging(settings, scopeName, console?)
test/unit/work-slice/basic-mcp-url-fetch.test.ts      observeFetches()
test/unit/work-slice/basic-mcp-url-fetch-script.test.ts   The launcher script with a pnpm double
test/interface/logging/axiom-logging.test.ts          openAxiomLogging() against a loopback OTLP receiver
```

The slice added these seams to `src/` by the owner's rule. When production has
a mechanism, the slice uses that mechanism. When production lacks a mechanism,
the slice adds the mechanism to production. `src/index.ts` and the local
commands had private copies of the failure message rule, and the slice had the
third copy, so DRY3 made one shared rule. The rule now lives in `BaseLogger`,
because the owner asked for the logger abstraction instead of a one-function
module. `loadPublicUrls()` was private in `deployment-config.ts`, and the serve
sequence of `serveApplication()` was inside `serve()`. `fetchToolServers()` did
not expose the operation, so `createFetchOperation()` now makes the operation.
`src/application.ts`, `src/auth/local-auth/local-auth-command.ts`, and
`src/mcp/fetch-tool-server.ts` use the new exports. No production behavior
changes. `tsconfig.json` does not change, because `test/` is already in its
`include` list. The entry point is also the composition module. It runs only
when it is executed directly, with the guard of `src/index.ts`, so the tests
import it.

### Settings

The slice reads the settings of the server with the production loaders. Thus
one shell setup serves the server and the script.

| Variable | Rule | Default |
| --- | --- | --- |
| `LISTEN_HOST`, `LISTEN_PORT` | Read with `loadListenAddress()`. The entry point refuses port 0, because the client needs the URL before the server listens. | `127.0.0.1`, `8080` |
| `PUBLIC_BASE_URL` | Required. Read with `loadPublicUrls()` and the rule of the self-hosted edition: `https`, or `http` on a loopback host. The MCP resource is `<base>/mcp`. | None |
| `LIGHTPANDA_BIN` | Required. An absolute path. `createFetchOperation()` gives the path to the fetcher. The entry point runs `version` and requires `1.0.0` before it listens. | None |
| `AD_RULES_FILE` | Required. `createFetchOperation()` loads the file with `readAdRulesFile()`, as for the server. An empty file gives no rules. | None |
| `AXIOM_API_KEY`, `AXOIM_ENDPOINT_URL` | Read by `axiomTestSettings()`, also from `.env.local` in the current directory. | None |

The launcher script `test/acceptance/work-slice/basic-mcp-url-fetch.sh` gives
defaults to `PUBLIC_BASE_URL`, `AD_RULES_FILE`, `LIGHTPANDA_BIN`,
`AXOIM_ENDPOINT_URL`, and `AXIOM_SYSTEM_LOG_TEST_DATA_SET`. The
[work slice guide](../../test/acceptance/work-slice/README.md) lists them.

### Composition

`createWorkSliceApplication(environment, logger)` composes the production parts
with the mock provider, in this order:

1. The public URLs: `loadPublicUrls(environment, 'self-hosted')`.
2. The operation: `createFetchOperation(environment, logger)`, wrapped by
   `observeFetches()`. See [Logging](#logging). `createFetchOperation()` makes
   the production pipeline, the fetcher with `LIGHTPANDA_BIN`, and the renderer
   setup reporter.
3. The mock provider: `new NoAuthProvider(new URL(mcpResourceUrl))`. It is the
   verifier and the access resolver.
4. The MCP server: `new MCPServer({ auth: { verifier, accessResolver,
   resourceMetadataUrl, expectedResource }, buildServer, reportFailure })`.
   `buildServer` is `fetchToolServers(operation, logger)`. `reportFailure` is
   `operatorFailureReporter(logger)` from `src/application.ts`.
5. The routes: the production `routeLocalRequests()`. The MCP path goes to
   `mcp.fetch(request)`. The provider paths and the pages get `404`, because
   the slice has no OAuth provider and no pages. The client sends a static
   header and does no OAuth discovery.
6. The application: `composeApplication(handle, mcp)`.

The entry point gives `createWorkSliceApplication()` to `serveApplication()` of
`src/index.ts`. `serveApplication()` starts the listener and registers the stop
handlers before it writes the `Listening on` line. At the stop,
`serveApplication()` uses the production close order. First,
`listener.close()` starts. Then the application stops the MCP work and awaits
the listener drain.

The slice keeps no copy of a production composition.

### Logging

The slice uses the production `OtelLogger`. The log goes to Axiom only. The
console gets only the export failure lines.

`openAxiomLogging(settings, scopeName, console?)` in
`test/support/axiom-test-export.ts` builds one `OTLPLogExporter` with the Axiom
headers, one `BatchLogRecordProcessor` with `scheduledDelayMillis: 1_000` and
`exportTimeoutMillis: 10_000`, and one `LoggerProvider`. It returns the
`OtelLogger` and a `close()` that calls `provider.shutdown()`, which flushes.
The scope name is `thermus-work-slice-<run id>`, with a new run ID for each
start. The script prints it. The OTel tests use the same approach to find their
records in Axiom.

`observeFetches(operation, logger)` wraps the operation and writes the two
lines of the slice:

```text
work-slice fetch started: <requested URL>
work-slice fetch completed: <requested URL> gave <n> characters of Markdown:
<Markdown, cut at 65,536 code points>
```

A failed call writes `work-slice fetch failed: <requested URL>: <fixed
message>` as an `ERROR` line and throws the same error again. Then the tool
answers as before.

Each MCP call gives three lines in Axiom, in this order: the started line, the
completed line, and the production completion record
`{"event":"mcp.tool.completed",...}`. The record has `status`, `durationMs`,
the synthetic authority `https://synthetic-auth.thermus.invalid`, and the URL
cut to origin and path.

The Axiom limit is 1 MB for one field. The cut keeps each line inside it: 65,536
code points are at most 256 KiB of UTF-8.

A refused or failed export must not stay silent, because the slice exists to
watch the log. The export wrapper writes one console line for each failed
export, with the error name and the HTTP status but never the response body,
and `close()` rejects with the count of the failed exports after the shutdown.
The entry point then writes the `FATAL` line and exits with status 1.

The instructions for the user go to stdout. The log lines go to Axiom only.

### Client configuration

The server refuses a request without a well-formed
`Authorization: Bearer <token>` header with `401`, before the mock provider
runs. The challenge names a metadata URL that the script does not serve. Thus
the client must send a static header with each request. Claude Code supports
this:

```bash
claude mcp add --transport http thermus-local http://127.0.0.1:8080/mcp --header "Authorization: Bearer local-dev"
```

Run the command from the directory where you start Claude Code, or add
`--scope user`. The script prints the command with the real address. For
Codex, the equivalent is:

```toml
[mcp_servers.thermus_local]
url = "http://127.0.0.1:8080/mcp"

[mcp_servers.thermus_local.http_headers]
Authorization = "Bearer local-dev"
```

Claude Desktop custom connectors use OAuth only. They need an `mcp-remote`
proxy with the header. The plan does not cover that.

### Unchanged production behavior

- The fetched URL must be a public address. `assertPublicDestination()` and
  the renderer block loopback and private ranges.
- The tool requires `reason`. The LLM supplies it from the tool schema.
- The completion record keeps its format. The two new lines come from the
  script only.

## Tests

### Acceptance

File: `test/acceptance/work-slice/basic-mcp-url-fetch.test.ts`. Offline. It
uses `RendererProcessDouble` for the renderer and DNS, a recording logger for
the log, and the real MCP SDK HTTP client through the real HTTP bridge. It runs
for both protocol eras of `mcpProtocolEras`.

- Given the work-slice application with the mock provider, the trusted rules
  fixture, and a renderer double that serves `https://news.example/story`, when
  an MCP client with the token `any-token` lists the tools and calls
  `getURLAsMarkdown` with that URL and a reason, then:
  - the client gets the cleaned Markdown of the page, without the paragraph
    that the fixture rule removes;
  - the log has, in order, the started line with the URL, the completed line
    with the Markdown, and one completion record with the status `success`
    and the synthetic authority;
  - `close()` stops the listener and the MCP server.
- Given the work-slice application, when a request has no `Authorization`
  header, then it gets `401` with a `Bearer` challenge, no renderer starts, and
  the log has no fetch line.

### Unit

- `test/unit/work-slice/basic-mcp-url-fetch.test.ts`: `observeFetches()` with
  an operation double: the started and completed lines, the cut at the limit,
  the failed line, and the error that passes through.
- The production seams have their own cases: the failure cases of
  `console-logger.test.ts` for `BaseLogger.messageOf()`, a `loadPublicUrls()`
  case in `deployment-config.test.ts`, and a `serveApplication()` case in
  `test/integration/server-stop-signals.test.ts`.

### Interface

- `test/interface/logging/axiom-logging.test.ts`: `openAxiomLogging()` against
  a loopback OTLP receiver, never Axiom: the headers, the scope name, and the
  record of one export, with no console line; a refused export with HTTP 401
  and a closed port each give one console line without the body, and `close()`
  rejects with the count. The closed-port case takes about 9 seconds, because
  the exporter retries a refused connection until its deadline.

### Commands

```bash
npm run build && node --test dist/test/unit/work-slice/*.test.js dist/test/unit/logging/console-logger.test.js dist/test/unit/config/deployment-config.test.js dist/test/integration/server-stop-signals.test.js dist/test/interface/logging/axiom-logging.test.js dist/test/acceptance/work-slice/*.test.js
```

## Steps

Steps 0 to 6 record the first delivery, before the refactoring of 2026-10-14.
The folder `test/support/work-slice/` of steps 1 to 3 does not exist now; the
composition is in the entry point. For a new run, the slice also needs
`PUBLIC_BASE_URL` and `AD_RULES_FILE`, as the server does. The log lines go to
Axiom only, so the script terminal shows no log line. The
[work slice guide](../../test/acceptance/work-slice/README.md) lists the
settings.

### Step 0: prerequisites on this Mac

1. Install the pinned renderer. Run the recipe block of
   [Lightpanda runtime](../lightpanda-runtime.md#install-the-pinned-release)
   from the repository root. It saves the executable in
   `.cache/lightpanda/1.0.0/`, which Git ignores. Then select it:

```bash
export LIGHTPANDA_BIN="$(pwd -P)/.cache/lightpanda/1.0.0/lightpanda"
"$LIGHTPANDA_BIN" version
```

The output must be `1.0.0`.

2. Put the Axiom settings in the worktree. Copy only the three `AXIOM` lines
   from `.env.local` of the main checkout into `.env.local` of the worktree.
   Git ignores the file. Do not copy the WorkOS lines; the slice does not need
   them.

3. Make sure that port 8080 is free, or set `LISTEN_PORT`:

```bash
lsof -nP -iTCP:8080 -sTCP:LISTEN
```

The Compose container of the self-hosted edition publishes the same port when
it runs.

4. Confirm the decisions D1 to D8.

Done when: the version command prints `1.0.0`, and `.env.local` of the
worktree has the three Axiom lines.

### Step 1: the acceptance test, red

1. Write `test/acceptance/work-slice/basic-mcp-url-fetch.test.ts` as
   [Tests](#tests) specifies.
2. Write `test/support/work-slice/work-slice-server.ts` as a stub with the
   agreed signature of `startWorkSliceServer()`. The stub throws. Thus the
   build passes, and the test fails at run time.
3. Run the focused command. The test fails, because the stub throws.

Done when: the test file exists, and the focused run fails for that reason.

### Step 2: the settings and the logger, TDD

1. Write `work-slice-settings.test.ts`, then `work-slice-settings.ts`.
2. Write `work-slice-logger.test.ts`, then `work-slice-logger.ts` with
   `WorkSliceLogger` and `openAxiomLogging()`.
3. Keep each function at 60 lines or less, with 3 parameters or less and a
   complexity of 10 or less. `habit-hooks` enforces the parameter and
   complexity limits for each file. It does not enforce the line limit under
   `test/`, but the modules keep it.

Done when: both unit tests pass with the focused command.

### Step 3: the composition, green

1. Write `work-slice-server.test.ts` for `observeFetches()` and the route
   function, then `work-slice-server.ts` with `startWorkSliceServer()`.
2. Run the acceptance test until it passes in both eras.

Done when: the acceptance test and the three unit tests pass.

### Step 4: the entry point

1. Write `basic-mcp-url-fetch.ts`: read the settings, check the renderer
   version, open the Axiom logging, start the server, print the instructions,
   wait for `SIGINT` or `SIGTERM`, then close the server and the logging. A
   startup failure writes one `FATAL` line and exits with status 1.
2. Add the package script
   `"work-slice:basic-mcp-url-fetch": "tsx test/acceptance/work-slice/basic-mcp-url-fetch.ts"`.
   `tsx` runs the TypeScript directly, as `pnpm dev` does. Plain Node type
   stripping fails on the `enum` in `base-logger.ts`.
3. Write `test/acceptance/work-slice/README.md`: one short section for each
   work slice, with its purpose, its entry point, the command, what it needs,
   and what it proves.
4. Run `npx knip`. It treats each file under `test/` as an entry, because a
   package script runs `node --test`, so it cannot catch a wrong script path.
   The dry runs of the entry point prove the path.
5. Run `habit-hooks` and correct each finding.

Done when: `npm run check` and `habit-hooks` pass, and the script starts and
stops cleanly without a client. The last check needs step 0.

### Step 5: the slice run

This is the goal. Record the output of each checkpoint.

1. Start the launcher script from the worktree root. From another directory,
   give its full path. It sets the settings to their defaults and runs the entry point with
   the pinned Node runtime of pnpm:

```bash
test/acceptance/work-slice/basic-mcp-url-fetch.sh
```

Checkpoint: stderr shows the five settings that the script sets. stdout shows
the client command, the Axiom dataset link, and the scope name of this run.
The `Listening on` line goes to Axiom only.

2. In another terminal, add the server to Claude Code and check the
   connection:

```bash
claude mcp add --transport http thermus-local http://127.0.0.1:8080/mcp --header "Authorization: Bearer local-dev"
claude mcp list
```

Checkpoint: the list shows `thermus-local` as connected. This proves the
protocol negotiation and the Bearer header. If it fails, the acceptance test
has already proven the SDK client, so the difference is in the client. Then try
Codex (D4).

3. Start a new Claude Code session, because a session reads the tool list
   when it starts. Ask:
   `Use the thermus-local tool getURLAsMarkdown to read https://example.com/ and tell me its first heading.`

Checkpoint: the answer names the heading `Example Domain`. The script terminal
shows the started line, the completed line with the Markdown, and the
completion record with `"status":"success"`.

4. Open the dataset in Axiom:
   <https://app.axiom.co/thermus-ai-spao/datasets/system-log-test>. Filter by
   the scope name that the script printed:

```text
['system-log-test']
| where ['scope.name'] == "thermus-work-slice-<run id>"
| sort by _time asc
```

The run of 2026-10-14 confirmed the field names: `scope.name` holds the scope,
`body` the line, and `severity_text` the level. If the filter finds nothing,
search the text: `['system-log-test'] | search "work-slice fetch"`.

Checkpoint: Axiom shows the three lines of the call: the URL that went out,
the Markdown that came back, and the completion record.

5. Stop the script with Ctrl+C. Checkpoint: it writes
   `Stopping after SIGINT`, flushes, and exits with status 0. Then remove the
   client entry: `claude mcp remove thermus-local`.

Done when: the five checkpoints pass. Write the date, the scope name, and the
APL result into the pull request notes. Do not paste the API key.

### Step 6: documents, required runs, and the pull request

1. Update the documents:
   - `README.md`: the script in the Scripts list and one paragraph on work
     slices that points to `test/acceptance/work-slice/README.md`.
   - `docs/reference/mcp-fetch-tool.md`: the sentence about `NoAuthProvider`
     also names the slice script.
   - `docs/testing/test-list.md`: the new acceptance and unit cases with their
     focused commands.
   - `docs/README.md`: this plan moves to `archive/` when the slice is done.
     The runbook of step 5 stays in `README.md`.
2. Do the required runs of the
   [test gate policy](test-gate-policy.md#required-runs):
   - `npm run check`
   - `habit-hooks`, with `.habit-hooks/snooze.json` kept as `[]`
   - the focused command of the new tests
   - `npm run test:acceptance`, because `test/acceptance/` changes. It needs
     the Axiom settings and public network access for the OTel logger test.
   - `npm run test:integration`. The change touches no `src/` file, but the
     policy says to run a suite when you are not sure.
   - `npm run test:container`, because `package.json` is a build input of the
     image. Only its scripts block changes.
3. Open a draft pull request. Record each command, its exit status, and the
   test counts. Mark it Ready after the runs pass.

Done when: the pull request is Ready with the evidence of step 5 and the runs
of step 6.

## Work split

The manager writes this plan, reviews each part, and runs step 5. Subagents
take these parts:

- A: step 1 and step 2, the acceptance test, the settings, and the logger.
- B: step 3 and step 4, the composition and the entry point. A and B can start
  together from this plan. B uses the acceptance test of A when it lands.
- C: step 6, the documents, after step 5 passes.

Each subagent starts on Opus 5.5 and follows the coding principles and the
test rules of AGENTS.md.

## Risks and checks

| Risk | Check | Response |
| --- | --- | --- |
| Claude Code and the SDK server do not agree on a protocol version or a session mode. | `claude mcp list` in step 5. | Use Codex (D4), or read the version in the first request of the client. |
| The nightly renderer on PATH runs instead of 1.0.0. | The version check at start. | Install 1.0.0 (step 0). |
| HTTPS pages fail in the renderer for a certificate reason. | The first fetch. | The macOS build loads the system certificates, and the smoke test passed on this platform. A failure shows `Page fetch failed` and a renderer log line. |
| The Axiom field names differ from the plan. | Step 5, point 4. | Closed on 2026-10-14: the names match the filter of the script. |
| Page text goes to the shared test dataset. | D2. | Log only the length instead. |
| Port 8080 is busy. | `lsof` in step 0. | Set `LISTEN_PORT`, and use the same port in `PUBLIC_BASE_URL`. |
| Claude Code keeps an old tool list. | Step 5, point 3. | Start a new session after `claude mcp add`. |
| A Markdown page is larger than the cut. | The completed line shows the full length. | Raise the cut constant. Stay below the 1 MB field limit. |
| A bad `AD_RULES_FILE` shows the parser message in the local `FATAL` line. | The slice does not wrap the parser error as `src/fetch-tool.ts` does. | Closed on 2026-10-14: the slice uses `createFetchOperation()`, which wraps the parser error. |
| The script does not find `.env.local`. | The script stops at start with the message of `axiomTestSettings()`. | Run from the worktree root, or export the variables. |

## Out of scope

- A production development mode, an auth flag, or a metadata document for
  OAuth discovery.
- A query of Axiom from the script. The ingest token cannot query. The user
  watches the dataset page.
- Changes to the completion record or to the behavior of `src/fetch-tool.ts`.
  The refactoring of 2026-10-14 only split its composition.
- Claude Desktop, which needs an OAuth proxy for a static header.
