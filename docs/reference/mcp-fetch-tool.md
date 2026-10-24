# MCP HTTP fetch tool

MCP-P01 adds `getURLAsMarkdown(url, reason)` with dependencies supplied by test
initialization. MCP-P02 adds shutdown cancellation and request isolation. MCP-P03
registers the tool in the self-hosted server with trusted rules and the local
renderer. [RHD-01](../implementation/rhd-01.md) adds protected
hosted fetch and bounded request waits.
[MCP-PIPE-01](../implementation/mcp-pipe-01.md) extracts the protected fetch
use case from MCP and keeps the tool's input and result contract unchanged.
[MCP-PIPE-02](../implementation/mcp-pipe-02.md) adds operation identity to
completion records and carries that identity through the protected operation.
[MCP-PIPE-03](../implementation/mcp-pipe-03.md) adds the outgoing observation
step and a local executor that validates its result and attempts a fixed record.
[MCP-PIPE-04](../implementation/mcp-pipe-04.md) converts the cleaner adapter to
the incoming step and carries typed withholding to the MCP boundary.
See [production composition](#production-composition). There is no
POST tool or new stdio tool.

## Request and result

Discovery describes the tool as: "Fetch a known web page URL as Markdown.
For web searches, use search instead of fetching a search engine results URL.
Give the reason the agent needs the page." Both editions also expose the
[search tool](mcp-search-tool.md).

The tool lists and validates one JSON Schema. Its input is an object with exactly
two required string properties, `url` and `reason`. Extra properties are refused.

- `url` has 1–8,192 Unicode code points. It is an absolute HTTP or HTTPS URL with
  no userinfo.
- `reason` has 1–2,000 Unicode code points and is not whitespace-only. It states
  why the agent needs the page. The server records it without scoring it or
  comparing it with the page.

Accepted values are never truncated. Supplementary characters count as one code
point. The fetcher receives the original URL spelling. The fetched page carries
that `requestedUrl` and its `finalUrl` through the pipeline.

A success has one text content entry with the exact Markdown string. Empty
Markdown is a success. The tool adds no title, footer, warning, or JSON wrapper.
The low-level SDK server declares the tools capability and supplies `tools/list`
and `tools/call` handlers. It projects each tool result with
`projectCallToolResult(result, undefined)` for the selected protocol era.

## Authentication and failures

`MCPServer` verifies Bearer credentials and resolves access before it builds a
request server. `buildServer(context, lifetime)` receives the frozen trusted
`RequestContext` and the request lifetime, and returns an SDK `Server` or
`McpServer`. Headers and tool
arguments cannot replace its authority, subject, or tenant. Missing or malformed
Bearer credentials retain HTTP 401; a denied access decision retains HTTP 403.
The neutral `FetchPage` use case also requires `product:access` before it
fetches the page, including when a caller invokes it without MCP.

| Failure | Observable result |
| --- | --- |
| Unknown tool | Safe InvalidParams error, code `-32602` |
| Invalid named arguments | `isError: true`, `Invalid tool arguments` |
| Missing product permission | `isError: true`, `Access denied` |
| Hosted capacity occupied | `isError: true`, `Server busy. Try again later.`; completion status `busy` |
| Fetch failure | `isError: true`, one safe text result from [public fetch failures](#public-fetch-failures); no HTML processing |
| Oversized HTML, thrown pipeline failure, or absent/nonstring Markdown | `isError: true`, `Page processing failed`; no partial output |
| Observed per-call cancellation | Work stops; no successful result |

`ProcessHtmlStep` checks the shared 10 MiB UTF-8 HTML limit before the first
pipeline stage or parser, including ad removal. Ordinary empty input or
complete removal can return allowed empty Markdown.
A typed `scan_failed` or `scan_limit` result withholds content and produces a
blocked incoming record. Only this known incoming withholding maps to exact
empty MCP success, with completion `success`, no error flag, and no structured
content. Generic blocks, unknown codes, invalid output, or thrown failures give
`Page processing failed`. Warnings are retained but never parsed to decide
release. Existing depth and sanitizer limits still apply.

The SDK owns negotiation, envelopes, and its 4 MiB request-body limit with HTTP
413. The HTTP bridge streams the request to it. Tool validation adds no second
body parser or alternate JSON-RPC implementation.

## Debug command

Use the debug command to fetch a page through MCP:

```sh
pnpm exec node script/fetch-url/fetch-url.ts --url 'https://example.com/' --reason 'Inspect the page content'
```

Hosted Thermus uses browser OAuth when no explicit credential is present. Use
`--login` to sign in first in an interactive terminal, or `--non-interactive`
to use a saved grant. Use `--help` for explicit Bearer credentials and custom
endpoints.

The command writes exact Markdown to stdout on success. On failure, it exits
with status 1 and leaves stdout empty. A tool error with exactly one text item
preserves these public diagnoses on stderr: `Page processing failed`,
`Page fetch failed`, the exact detailed messages below,
`Server busy. Try again later.`, `Request cancelled`,
`Invalid tool arguments`, and `Access denied`. Unknown messages or extra content
items use a generic tool failure diagnosis. Other tool fields are never printed.
The hosted server must have this change deployed to return detailed failures.
The command still accepts the generic `Page fetch failed` from older servers.

## Production composition

The self-hosted server registers the tool. Its application branch loads
[`src/app/fetch-tool.ts`](../../src/app/fetch-tool.ts) and calls
`createToolOperations(environment, logger)` before it opens the Better Auth
runtime. That call reads the [ad rules file](ad-rules.md#server-rules-file) one
time. Then it makes these parts one time:

- a fetch `HtmlToMarkdownPipeline` with `CleanHtmlAdsAdblockRs`,
  `PromptInjectionRemoverSanitizer`, and the default
  `CleanHtmlToMarkdownDefuddle`, in that order;
- one `WebsiteFetcherLightpanda` with the server's `LIGHTPANDA_BIN` value;
- one `ProcessHtmlStep` that wraps the existing pipeline, checks its input
  size, and allows string Markdown or blocks with a typed scan code;
- one `ObserveRequestStep` and a core-owned `StepRecordSink` adapted to the
  application logger;
- one protected `createFetchPage` use case with the fetcher, incoming step,
  required outgoing step and record sink, and
  [renderer setup report](#renderer-setup-report) and
  [failure diagnostics](#fetch-failure-diagnostics) of the application logger;
- one thin `createGetURLAsMarkdown` adapter that returns released Markdown or
  maps known withholding to exact empty text in the existing MCP
  string-returning operation.

The same factory creates the protected search operation with `SearchPipeline`
and `SearchEngineBraveHttp`. It shares the fetcher, ad cleaner, sanitizer,
outgoing step, record sink, and setup reporter with fetch. Its
search-only `BraveHTTPResultCleanup` runs after full-page sanitation and before
its converter, which enables `preserveSearchResults`. Cleanup selects organic
result fields and builds an ordered list of title links and optional surviving
descriptions. Fetch keeps its existing conversion path. The shared fetcher
retains one abandoned DNS guard across both operations. Each application has its own
resources and setup warning state.

`createToolOperations` returns both operations. Then the branch calls
`fetchToolServers(operations, logger)`, which returns the `buildServer` function
of `MCPServer`. Each MCP request gets its own SDK `Server` from
`createFetchToolServer(context, { operations, logger }, lifetime)`. Completion
records attempt a JSON write to the application logger for each dispatched
`tools/call`, with an `ERROR` fallback if the `INFO` write throws.
`requestedUrl` keeps the exact accepted spelling. The
renderer's `finalUrl` selects the ad rules and resolves relative links.
The request server exposes both operations. Search has a separate
[result and completion contract](mcp-search-tool.md).

The neutral page-fetch code lives under `src/pipelines/page-fetch/`. It owns
semantic URL validation, step execution, and the protected fetch sequence.
The shared [step protocol](../../src/pipelines/execution/pipeline-step.ts) and
[record-sink contract](../../src/pipelines/execution/step-record.ts) live under
`src/pipelines/execution/`. Separate `executeOutgoingStep` and
`executeIncomingStep` functions enforce the two trusted roles. The MCP schema uses the same
URL rules while retaining SDK schema conversion at the transport boundary.
The cleaner-owned adapter stays under `src/pipelines/html-processing/`; the
neutral use case depends on the `PipelineStep` role contract. The transitional
`PageProcessor` port is removed. Import rules enforce this boundary, including
type-only imports.

The operation uses readonly `ExecutionContext { signal, operationId }` as its
third argument. The MCP adapter, hosted wrapper, and development spy forward
the same object to `FetchPage`; both steps and the fetcher receive its same
signal. The core validates identity once after its existing cancellation, permission, and semantic URL guards, before fetching.
Hosted cancellation/busy checks still precede the core. There is no optional
context fallback or second identity allocation inside the operation.

Direct callers supply a 36-character hyphenated hexadecimal UUID with version
1–8 and variant 8/9/a/b. Letter case is accepted and preserved. Nil/max UUIDs,
braces, compact forms, whitespace, extra text, and wrong version/variant are
refused with `Invalid execution context`, without raw identity text or a cause.

The outgoing step runs after those guards and before fetch. `ObserveRequestStep`
only allows the exact input string unchanged; it performs no policy processing.
`PipelineStep<Input, Output, Code extends BlockCode = BlockCode>` defines
`execute(input, signal): Promise<StepResult<Output, Code>>`. Its result is allow
with output or block with a closed code. The executable contract has no ID.
Trusted executor bindings select `outgoing.observe_request` and
`incoming.process_html` for records. `OutgoingStep` binds string input and output
and permits only `blocked`; `IncomingStep` binds `WebsiteFetchResult` input,
string output, and the full incoming block-code set. The incoming step
receives the fetched page and allows only string Markdown. It runs the fixed
HTML pipeline once, with each cleaner stage once in the same order.

Steps receive only input and signal. The outgoing executor checks the decision,
code, and exact original string before recording allow or starting fetch.
Block, throw, unknown/malformed result, or changed/nonstring output stops fetch
and processing with `Page fetch failed`, `isError: true`, and completion
`fetch_failed`. Cancellation takes priority. No raw step cause reaches the client.

After fetch, the incoming executor validates the result against its trusted
binding before recording allow or releasing content. It accepts `scan_failed`
and `scan_limit` only for incoming withholding. The trusted executor selects
the direction and its code rules. A generic incoming block, unknown code, malformed result,
or nonstring output gives the fixed processing error. Oversize input fails
inside the entered incoming step, produces a failed record, and starts no cleaner.

The neutral `FetchPageOutcome` is either `{ status: 'released', markdown }` or
`{ status: 'withheld', code }`. Withheld carries no payload. The MCP adapter
explicitly maps known withholding to empty text. Empty Markdown without a typed
signal remains released and records allowed.

Better Auth verifies each token and checks the current account before the tool
runs. A forged token, a token that a password reset revoked, and a token of a
user that `users disable` disabled get HTTP 401. A banned user with a live
session gets HTTP 403. These refusals happen before any fetch or cleaning and
write no completion record.

Self-hosted startup does not run or check the renderer. A renderer launch
failure gives a safe `Page fetch failed: Renderer could not start` detail and a
`fetch_failed` record. The tool does not pass on the fetcher error or its cause.
The operator log gets a
[renderer setup report](#renderer-setup-report) instead. The container image
holds the pinned renderer, as the
[runtime guide](../lightpanda-runtime.md#container-image) tells, so a server
container renders pages with the same fetcher options.

The hosted opener uses `createHostedToolOperations` and `fetchToolServers`.
One `OperationCapacity` wraps both full operations in that application.
WorkOS Connect tokens and the current User grant protect each request. Missing
or revoked access is refused before fetching. The slot covers DNS, rendering,
outgoing work, cleaning, and cleanup across requests and both operations;
there is no queue or capacity setting. A cancelled caller gets cancellation
before busy.
An abort does not free the slot before settlement. A busy call writes its own
safe completion record with status `busy`. RHD-01 adds no onboarding or
deployment. [RHD-02](../implementation/rhd-02.md) adds portal serving, local
health, startup checks, and hosted MCP Origin validation. Hosted startup checks
the pinned renderer before listening; self-hosted startup keeps its deferred
renderer failure behavior. Test fixtures do not select production ad rules.

## Renderer setup report

A renderer setup failure is a renderer process that cannot start. The fetcher
then rejects with a `WebsiteFetchLaunchError`; the [website fetcher
reference](website-fetcher.md) gives its contract. The operation gives the
optional `reportRendererSetupFailure` dependency a new value with only two
fields: `failure`, which is `missing` for `ENOENT` or `cannot-start` for each
other code, and `code`, the system error name or `UNKNOWN`. The error message
and its cause stay out of the report, because the cause holds the renderer
arguments with the URL. A reporter that throws does not change the tool result.
A cancelled call gives no report.

The server writes the report as one `ERROR` line of the application
logger:

```text
Renderer setup failure: the Lightpanda executable is missing (ENOENT). Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.
Renderer setup failure: the Lightpanda executable cannot start (EACCES). Each page fetch fails until you correct this. See docs/lightpanda-runtime.md.
```

The line names the failure class, the code, and the
[runtime guide](../lightpanda-runtime.md#renderer-setup-report). It holds no URL,
reason, renderer arguments, page text, token, executable path, or process output.

The server writes the report one time for each code in the life of its process.
Thus a renderer that stays missing adds one line, not one line for each call. A
new code, for example `EACCES` after the operator puts a file without execute
permission at the path, adds one new line. A corrected file at the same path
needs no restart; a changed `LIGHTPANDA_BIN` needs one, because the server reads
it at startup. After a correction, a recurrence of a reported code writes no new
line until the next server start. The client gets the safe launch detail below,
and the completion record stays `fetch_failed`. Other fetch failures, such as
HTTP errors, timeouts, signals, DNS failures, blocked destinations, and system
limits such as `EMFILE`, write no renderer setup report. The local commands
load no renderer and write no report. The hosted server uses the same safe
reports as the self-hosted server.

## Renderer readiness report

The renderer has a fixed 20-second readiness allowance, including navigation.
When it stays active at the deadline, the fetcher stops the child and waits for
its completion. The client gets `Page fetch failed: Renderer readiness timed out`,
no partial Markdown, and one completion record with `fetch_failed`.

The application logger writes one correlated failure event for each readiness timeout.
The event includes `category: 'readiness_timeout'`, `phase: 'renderer_process'`,
`budgetMs: 20000`, and the operation ID. Available safe exit fields are included.
Cancellation takes priority and writes no failure diagnostic. The optional
`reportRendererReadinessTimeout` dependency remains available to other compositions;
the server uses the unified reporter below, so it does not duplicate this event.
See the [runtime guide](../lightpanda-runtime.md#renderer-readiness-report).

## Public fetch failures

`FetchPage` converts a typed `WebsiteFetchFailure` to a page-fetch-owned
`PageFetchFailure`. This public error has only an approved message, with no raw
cause or diagnostic. MCP returns that message in one text item with
`isError: true` and completion status `fetch_failed`. It returns no partial
Markdown and starts no HTML processing after a failed fetch.

Each detailed message starts with `Page fetch failed: `:

| Observed failure | Detail after the prefix |
| --- | --- |
| HTTP failure with a valid status from 400 to 599 | `HTTP NNN`, for example `HTTP 429` |
| HTTP failure without a valid status | `HTTP request failed (status unavailable)` |
| Renderer readiness deadline | `Renderer readiness timed out` |
| DNS deadline | `DNS lookup timed out` |
| Renderer launch failure | `Renderer could not start`, optionally followed by ` (ENOENT)`, ` (EACCES)`, ` (ENOEXEC)`, or ` (ENOTDIR)` |
| Known DNS failure | `DNS lookup failed` |
| Known renderer request timeout | `Renderer request timed out` |
| Known connection failure | `Renderer connection failed` |
| Known TLS failure | `Renderer TLS failed` |
| Known redirect limit | `Renderer redirect limit exceeded` |
| Known transfer failure | `Renderer transfer failed` |
| Renderer output limit | `Renderer output limit exceeded` |
| Killed, interrupted, or failed renderer process | `Renderer process was killed`, `Renderer process was interrupted`, or `Renderer process failed` |

The formatter validates observed typed facts. It does not use arbitrary error
messages, causes, URLs, credentials, paths, or process output. Unknown failures
retain `Page fetch failed`. A failed HTTP status in output from an interrupted
process does not make HTTP the cause of that interruption. The details do not
identify which network component failed or who returned an HTTP response.
Cancellation takes priority and retains `Request cancelled`.

The CLI preserves only these exact detailed messages and the fixed public
messages in the debug command contract. Changed spelling, added text, invalid
HTTP status numbers, and extra content items use the generic tool failure
diagnosis. Operator reports and completion records keep their existing fields.

## Fetch failure diagnostics

For each fetcher failure, the operation attempts one `reportFetchFailure` call.
The server writes one JSON `ERROR` event and joins it to `mcp.tool.completed`
with the same `operationId`. For example:

```json
{"event":"renderer.fetch.failed","category":"http","phase":"renderer_result","httpStatus":429,"exitCode":22,"operationId":"8b7bcf65-ddaf-45a8-b26f-374280b74eb1"}
```

The renderer boundary selects these fields from observed facts:

- `category`: `http`, `renderer`, `validation`, `launch`, `readiness_timeout`,
  `dns_timeout`, or `unknown`.
- `phase`: `renderer_result`, `renderer_process`, `renderer_launch`,
  `destination_policy`, `url_validation`, or `unknown`.
- `httpStatus`: an integer from 100 to 599, when the JSON supplies one.
- `rendererErrorCode`: an exact known Lightpanda error name, or `unknown`.
- `exitCode`: an integer from 0 to 255; `processErrorCode`: a fixed known
  Node error name, or `unknown`; `signal`: a known platform signal;
  `killed`: the Boolean value from the process callback, when supplied.
- `metadata`: `absent` for empty output or `invalid` for a rejected JSON envelope.
  `budgetMs` identifies a known local deadline. Destination validation can include
  `reason`: `blocked_destination`, `no_addresses`, or `dns_pending`.
  Renderer validation uses `invalid_http_status`, `invalid_result`, or
  `invalid_final_url`; requested URL validation uses `invalid_url` or
  `unsupported_protocol`.

An untyped failure has category and phase `unknown`. Missing facts stay absent.
The event has no URL, query, reason text, credentials, headers, command path,
HTML, stdout, stderr, arbitrary message, cause, or stack. Reporter failures do
not change the public result. Successful and cancelled fetches write no event.
The separate setup warning remains limited to one warning per safe code.

A killed or signalled process keeps process failure precedence, even with exit
code 22 or a failed HTTP status in partial output. An observed HTTP status can
still be included. An HTTP status, including 429, does not establish which
server or proxy returned it. `OperationTimedout` does not establish whether DNS,
TCP, TLS, or transfer timed out. These events report observed facts.

<a id="outgoing-step-records"></a>

## Step records

For each entered step, the executor attempts one synchronous
`StepRecordSink.record(event)` call. Composition supplies the sink; the core
imports no concrete application logger. The fixed event has these fields:

```ts
{
  event: 'pipeline.step.completed',
  operationId,
  stepId: 'outgoing.observe_request' | 'incoming.process_html',
  outcome,
  durationMs,
  code?,
}
```

| Outcome | Code |
| --- | --- |
| `allowed` | Absent |
| `blocked` | `blocked`, or incoming `scan_failed` / `scan_limit` |
| `failed` | `step_failed` or `invalid_step_result` |
| `cancelled` | `cancelled` |

The operation ID is the validated UUID from the same dispatched call. The
step ID comes from the trusted role binding. A supplied step ID cannot
select another role. Duration is a finite non-negative rounded integer,
capped at `Number.MAX_SAFE_INTEGER`; invalid clock data uses 0.
No input, output, raw error, URL, reason, HTML, Markdown, header, credential,
warning, or exfiltration target is serialized into the event.

Only explicit allow with the exact original URL advances to fetch. Incoming
allow must contain a string before it can release content. Unknown decisions
and codes fail closed; known scan codes also fail closed in the outgoing role.
The outgoing production step does not use policy to block requests; controlled test steps exercise
these executor boundaries.

A sink exception cannot change the result, repeat a step/fetch, or skip
cleanup. New step records use one guarded write attempt and no fallback.
The separate completion writer below keeps its existing fallback. Neither
record type has a durable or exactly-once delivery guarantee.

Calls stopped before step entry have no step event, including schema, permission,
URL, operation-ID, and hosted busy refusals. An active step settles after its
owned cleanup. Abort or `AbortError` observed before its record wins over a late
result; no later fetch or release follows. A later fetch/incoming cancellation
does not rewrite an earlier completed step record. The hosted slot stays owned through settlement.

Readers select the event type and operation ID. With a healthy sink, each
entered step has one exact event and each dispatched call has one actual MCP
completion; a step event cannot resolve `firstCompletion`. Step records contain
no request or page content. Completion records below use the same content
exclusion.

## Completion records

Every envelope-valid dispatched call attempts one JSON-encoded completion
record in `finally`. Fetch and search use the trusted authority, subject, and
tenant; the operation ID; the recognized tool label or a fixed unknown label;
the completion status; and elapsed time. The formatter receives no argument
object. These internal System records omit URL, query, reason, result, raw
exceptions, and request metadata, including for invalid arguments.

A separate customer `AuditLog` captures validated input and final public text
after SDK projection and safe failure/cancellation mapping. It uses the trusted
context, redacts recognized credentials, and bounds only the exported copy.
Invalid arguments and unknown tools have no customer event. The client result
stays complete; fetch withholding retains its existing empty-success projection.
Hosted capture uses activity-driven enabled/revision snapshots when settings
storage is available. Cold, disabled, or expired snapshots drop the current
event; loads affect only future activity and never wait in the tool response.
Hosted storage supplies bounded asynchronous delivery. Each attempt reads one
current saved version and requires its enabled state and exact captured revision;
old work is dropped without retargeting. Queue pressure, expiry, and failures can
lose events, and retries can duplicate them. Product responses do not wait for
export. Capture does not prove client receipt or Collector storage. See the
[dispatch record](../implementation/admin-s2-03c.md) for fixed bounds and lifetime.
See the [capture record](../implementation/admin-s2-03a.md) for fixed bounds and
[search records](mcp-search-tool.md#execution-and-logging) for the search contract.

Dispatch generates the UUID with Node `randomUUID` before tool-name and argument
checks. Dispatched unknown, invalid, denied, busy, and cancelled calls therefore
retain a completion ID, even if no fetch starts. Client request IDs, `_meta`, and
arguments cannot choose it. HTTP/auth/body/envelope refusals before dispatch
still have no tool completion. The ID is log metadata; it adds no MCP argument,
response wrapper, or structured content.

Record readers select `mcp.tool.completed` and the operation ID. A different
event must not resolve a completion wait. Concurrent calls keep distinct IDs;
each call keeps its ID and signal through settlement and cleanup. Invalid
supplied identity cannot start fetching or reach records as unchecked text.

The URL path and the verbatim reason can contain sensitive text. These fields
remain part of the completion contract; the record is not a redacted content audit.

Records contain no unknown tool name, raw argument object, request headers,
token, HTML, Markdown, or error cause. Envelope, body, and authentication refusals
occur before dispatch and are separate from tool completion records.

The record writer guards both `logger.info` and its `logger.error` fallback.
Logging failure cannot change the result, replace an error, or repeat a fetch.
These records are best effort; they are not durable audit storage.

## Cancellation and test composition

Each call supplies an `ExecutionContext` to the operation. Its same `AbortSignal`
reaches both standard steps, the fetcher, and the HTML pipeline.
Cancellation is checked before work, between asynchronous stages, and before
return. Renderer cancellation stops the child and releases per-call resources.
Synchronous parsing cannot be preempted by cancellation; the existing HTML size
and depth guards bound that work. The renderer keeps its existing timing,
output, and network limits.

The modern SDK client forwards a call's cancellation to its HTTP stream. The
legacy SDK client instead sends `notifications/cancelled`; with stateless HTTP,
that notification reaches a new server instance and cannot cancel the earlier
call. A legacy caller must abort that call's HTTP stream. The acceptance test
uses the client's public fetch option to do this and checks that the SDK closes
the request server and signals the active operation. It does not claim that the
legacy `callTool` signal alone stops server work.

`MCPServer` owns a shutdown signal. Each request lifetime combines it with that
request's signal. Pass the lifetime to `createFetchToolServer` as its third
argument. The tool combines that signal with the SDK call signal and registers
its complete handler task, including its completion record. This keeps legacy
work owned after the SDK returns an HTTP response. Cancelling a request cannot
cancel a peer. Shutdown cancels every active request in both protocol eras.

The entry point starts `listener.close()` to refuse new connections, then calls
`application.close(listenerDrain)` without first awaiting the listener. The
application starts MCP cancellation, awaits active work and listener drain, and
then releases provider resources. RHD-01 connects request and shutdown signals
before token verification and access resolution. Cancellation ends those waits
and prevents a late result from starting a tool server. Provider calls without
a cancellation API can settle later, with their rejection still observed.
Tool handlers retain ownership of their real cleanup until it settles. The
request body remains a stream with the SDK as its only parser; abort also
cancels an incomplete body.
MCPServer awaits body-transfer cleanup and retains a failure to cancel the body.

`listener.close()` ends idle keep-alive connections at once. It also ends each
connection from which the server has read no bytes, because Node's HTTP server
keeps such a connection open as if a request were active. Node starts a request
only after it reads bytes, so such a connection has no work. A request that the
server has not read yet is refused, as is a connection that the server has not
accepted yet. Node's `fetch` can open such a connection after it aborts a
request. In Node 24.20.0, with undici 7.29.0, undici keeps the aborted request
in its queue, connects again, and then drops the request. When the client has
another open connection to the server, as the SDK client does after
`server/discover`, the new connection stays open until the client's idle
timeout, 4 seconds by default. Because the listener ends this connection, a
client cancellation does not delay the server stop that follows. The connection
of the cancelled call closes when the client aborts it. A connection with a
request in progress keeps the drain and the grace period, 5 seconds by default.

When shutdown starts while a request is still in authentication, MCPServer
ends the wait without waiting for the identity result. No tool server starts
from a late result. A connected client can get a generic `500`; a disconnected
client can get no response. The SDK has not read the request body. Node counts a connection as idle only after
it has read the complete request, and the response can finish before that:
Node stops reading an unread body at its buffer limit and discards the rest
after the response, and a handler can answer while Node still reads the body.
Thus `listener.close()` ends the connection of a finished response when Node
has read the complete request, not when the response finishes. The refusal
does not delay the server stop. A client that has not sent all of the body
keeps its connection until it sends the rest, up to the grace period. To end
the connection earlier can reset it, and the client can then lose the
response.

The hosted CLI starts a fixed 10-second deadline on `SIGINT` or `SIGTERM`.
Normal cleanup allows a clean process exit. If cleanup stalls or a library
handle keeps the process alive, the deadline writes
`Hosted shutdown exceeded 10000 ms` and exits with status 1. The timer stays
referenced while `serve()` waits for cleanup, so a stalled wait reaches the
explicit deadline. After `serve()` exits, the timer is unreferenced: a clean
process can exit, while a residual handle still reaches the deadline. Self-hosted operation
has no new deadline. This is a failure bound, not proof of graceful cleanup.

The first application close call supplies the listener drain promise. Repeated
and concurrent close calls share cleanup. Owned transports and request servers
close once, and cleanup failures remain visible even when the SDK catches them.
Startup failure releases resources that already opened and preserves the
startup error. A cancelled call records `cancelled`, not a fetch failure, and
cannot publish success. A disconnected client might receive no response.

`NoAuthProvider` exists only in `test/support/doubles/auth/no-auth-provider.ts`. The
tests and the [basic MCP URL fetch work slice](../../test/acceptance/work-slice/basic-mcp-url-fetch/README.md)
inject it as both `IdentityVerifier` and `AccessResolver`. It accepts supplied
token contents and returns a fixed synthetic identity and workspace, only
`product:access`, a distinct client ID, a synthetic issuer, the configured
resource, current finite times, and empty scopes. It does not bypass Bearer
syntax checks. Production retains Better Auth and the hosted WorkOS provider.
The work slice is a development script outside `src/`; no server setting
selects the provider.

The [auth WorkOS MCP URL fetch work slice](../../test/acceptance/work-slice/auth-workos-mcp-url-fetch/README.md)
supplies its own `buildServer` to `composeWorkOSApplication()` for a local run.
The real WorkOS provider checks each Connect token and the current grant before
the tool runs. The completion record has the WorkOS identity. The slice remains
a development script outside `src/`, with its own onboarding and Axiom logging.
Production RHD-01 does not enable those slice policies.

The P01 and P02 HTTP acceptance cases use the real SDK client and production
HTTP bridge with fetcher and pipeline doubles. The P03 offline fetch tool
acceptance cases run the production `serve()` with real Better Auth, the real
pipeline, and a renderer process double. Normal integration and acceptance runs
need no renderer. The complete acceptance suite also includes the Axiom logger
test and needs its test credentials/network access. The explicit renderer gate,
`npm run test:mcp:renderer`, runs the pinned Lightpanda through the tool. See
the [test inventory](../testing/test-list.md) and
[test gate policy](../implementation/test-gate-policy.md#renderer-gate-mcp-p03).
