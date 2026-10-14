# MCP HTTP fetch tool

MCP-P01 adds `getURLAsMarkdown(url, reason)` with dependencies supplied by test
initialization. MCP-P02 adds shutdown cancellation and request isolation. MCP-P03
registers the tool in the self-hosted server with trusted rules and the local
renderer; see [production composition](#production-composition). There is no
POST tool or new stdio tool.

## Request and result

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
The operation also requires `product:access` before it fetches the page.

| Failure | Observable result |
| --- | --- |
| Unknown tool | Safe InvalidParams error, code `-32602` |
| Invalid named arguments | `isError: true`, `Invalid tool arguments` |
| Missing product permission | `isError: true`, `Access denied` |
| Fetch failure | `isError: true`, `Page fetch failed`; no pipeline work |
| Oversized HTML, thrown pipeline failure, or absent/nonstring Markdown | `isError: true`, `Page processing failed`; no partial output |
| Observed per-call cancellation | Work stops; no successful result |

The operation checks the shared 10 MiB UTF-8 HTML limit before the first pipeline
step, including ad removal. A successful pipeline can return empty Markdown
after empty input, complete removal, or sanitizer withholding. Warnings do not
create a new failure contract. Existing depth and sanitizer limits still apply.

The SDK owns negotiation, envelopes, and its 4 MiB request-body limit with HTTP
413. The HTTP bridge streams the request to it. Tool validation adds no second
body parser or alternate JSON-RPC implementation.

## Production composition

The self-hosted server registers the tool. Its application branch loads
[`src/fetch-tool.ts`](../../src/fetch-tool.ts) and calls
`fetchToolServers(environment, logger)` before it opens the Better Auth runtime.
That call reads the [ad rules file](ad-rules.md#server-rules-file) one time. Then
it makes these parts one time:

- one `HtmlToMarkdownPipeline` with `CleanHtmlAdsAdblockRs`,
  `PromptInjectionRemoverSanitizer`, and `CleanHtmlToMarkdownDefuddle`, in that
  order;
- one `WebsiteFetcherLightpanda` with the server's `LIGHTPANDA_BIN` value;
- one operation, `createGetURLAsMarkdown({ fetcher, pipeline,
  reportRendererSetupFailure })`, with the
  [renderer setup report](#renderer-setup-report) of the application logger.

It returns the `buildServer` function of `MCPServer`. Each MCP request gets its
own SDK `Server` from `createFetchToolServer(context, { operation, logger },
lifetime)`. Completion records go to the application logger: one `INFO` line of
JSON for each dispatched `tools/call`. `requestedUrl` keeps the exact accepted
spelling. The renderer's `finalUrl` selects the ad rules and resolves relative
links.

Better Auth verifies each token and checks the current account before the tool
runs. A forged token, a token that a password reset revoked, and a token of a
user that `users disable` disabled get HTTP 401. A banned user with a live
session gets HTTP 403. These refusals happen before any fetch or cleaning and
write no completion record.

Startup does not run or check the renderer. Without a usable renderer, each page
fetch fails with `Page fetch failed` and a `fetch_failed` record. The tool does
not pass on the fetcher error. The operator log gets a
[renderer setup report](#renderer-setup-report) instead. The container image has
no renderer, so a server container lists the tool, but each page fetch in it
fails in this way. Renderer image provisioning is separate future work.

The hosted edition does not register the tool. Since AUTH-06, its MCP resource
checks WorkOS Connect tokens, and its MCP server has no tool. P03 adds no POST
tool, stdio tool, cache, OAuth provider, rule subscription, rule updater, or
exporter setup.

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

The self-hosted server writes the report as one `ERROR` line of the application
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
line until the next server start. The client result stays `Page fetch failed`,
and the completion record stays `fetch_failed`. Other fetch failures, such as
HTTP errors, timeouts, signals, DNS failures, blocked destinations, and system
limits such as `EMFILE`, write no report. The local commands and the hosted
edition load no renderer and write no report.

## Completion records

Every envelope-valid dispatched call attempts one JSON-encoded completion
record in `finally`. It includes the trusted authority, subject, and tenant; the
recognized tool label or a fixed unknown label; safe input fields or field-status
codes; the completion status; and elapsed time. A safe URL omits userinfo, query,
and fragment. A reason is included only when it is a bounded, structurally valid
string. JSON encoding escapes line breaks.

Records contain no unknown tool name, raw argument object, request headers,
token, HTML, Markdown, or error cause. Envelope, body, and authentication refusals
occur before dispatch and are separate from tool completion records.

The record writer guards both `logger.info` and its `logger.error` fallback.
Logging failure cannot change the result, replace an error, or repeat a fetch.
These records are best effort; they are not durable audit storage.

## Cancellation and test composition

Each call supplies its `AbortSignal` to the operation, fetcher, and pipeline.
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
then releases provider resources. Authentication already in progress is awaited;
shutdown prevents it from starting the next stage. The request body remains a
stream with the SDK as its only parser; abort also cancels an incomplete body.
MCPServer awaits body-transfer cleanup and retains a failure to cancel the body.

The first application close call supplies the listener drain promise. Repeated
and concurrent close calls share cleanup. Owned transports and request servers
close once, and cleanup failures remain visible even when the SDK catches them.
Startup failure releases resources that already opened and preserves the
startup error. A cancelled call records `cancelled`, not a fetch failure, and
cannot publish success. A disconnected client might receive no response.

`NoAuthProvider` exists only in `test/support/auth/no-auth-provider.ts`. Tests
inject it as both `IdentityVerifier` and `AccessResolver`. It accepts supplied
token contents and returns a fixed synthetic identity and workspace, only
`product:access`, a distinct client ID, a synthetic issuer, the configured
resource, current finite times, and empty scopes. It does not bypass Bearer
syntax checks. Production retains Better Auth and the hosted WorkOS provider.

The P01 and P02 HTTP acceptance cases use the real SDK client and production
HTTP bridge with fetcher and pipeline doubles. The P03 offline fetch tool
acceptance cases run the production `serve()` with real Better Auth, the real
pipeline, and a renderer process double. Normal integration and acceptance runs
stay offline and renderer-free. Only the explicit renderer gate,
`npm run test:mcp:renderer`, runs the pinned Lightpanda through the tool. See
the [test inventory](../testing/test-list.md) and
[test gate policy](../implementation/test-gate-policy.md#renderer-gate-mcp-p03).
