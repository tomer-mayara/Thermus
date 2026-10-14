# MCP HTTP fetch tool

MCP-P01 adds `getURLAsMarkdown(url, reason)` with dependencies supplied by test
initialization. Production rule loading and application wiring remain in P03.
Shutdown cancellation remains in P02. There is no POST tool or new stdio tool.

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
syntax checks. Production retains Better Auth and the hosted HTTP 503 behavior.

The HTTP acceptance cases use the real SDK client and production HTTP bridge
with fetcher and pipeline doubles. Normal integration and acceptance runs stay
offline and renderer-free. See the [test inventory](../testing/test-list.md) and
[test gate policy](../implementation/test-gate-policy.md).
