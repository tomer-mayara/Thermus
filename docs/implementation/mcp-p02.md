# MCP-P02 implementation record

Ticket: `02309709-ecae-4199-8100-425e6c8f1973`. Depends on MCP-P01.
The [MCP plan](mcp-server-plan.md) defines the remaining P03 scope.

## Delivered behavior

MCPServer owns shutdown cancellation and tracks request work separately from
tool tasks. Each request builder receives its frozen trusted context and a
request lifetime. The fetch tool combines its SDK signal with that lifetime and
tracks the complete handler, including its completion record. This keeps legacy
work owned after the HTTP handler returns. Finished tasks leave active tracking.

Shutdown refuses new work, cancels active work in both HTTP eras, and waits for
cleanup. The entry point starts listener close, then passes the drain promise to
application close. Provider resources stay open until MCP tasks and listener
drain finish. Repeated and concurrent closes share cleanup. Owned resource close
failures remain visible, including failures that the SDK would otherwise catch.

Authentication already in progress is awaited. After shutdown, it cannot start
access resolution or build another request server. Aborting an incomplete body
cancels its stream; the SDK remains the only body parser and keeps its 4 MiB
limit. Startup failure releases opened resources and process signal listeners,
and preserves startup and cleanup failures.

The HTTP bridge detaches a cancelled body reader and lets Node discard unread
bytes without destroying the response socket. This preserves an early SDK 413
response and later keep-alive requests. Its partial-body disconnect behavior
remains covered by handler-double tests.

The renderer releases its listener and readiness timer at cancellation, requests
one child kill across timeout and cancellation, and waits for the child callback.
Late callbacks cannot publish success or repeat cleanup. Each concurrent call
keeps its own state. Completion records retain P01 semantics and record observed
cancellation before generic fetch failure. A disconnected client might receive
no response.

Synchronous parsing is not preempted by cancellation. Existing size and depth
guards still bound it. Production Better Auth and hosted HTTP 503 stay in place.
This slice adds no shutdown framework, production auth bypass, stdio tool,
renderer provisioning, or production fetch-tool composition.

## Test-first evidence

Before production changes, the real-client HTTP shutdown acceptance failed in
both eras: exit 1; 2 tests, 0 pass, 2 fail, 0 skipped, 0 todo. Modern shutdown
returned before held fetch cleanup; legacy shutdown did not abort its signal.

Focused tests then reproduced duplicate renderer cleanup, the entry point's
listener-before-cancellation order, leaked stop listeners after startup logging
failure, missing MCP ownership, and suppressed cleanup failures. The new
acceptance cases finish green with the implemented lifetime.

Manager review accepted the delegated renderer, application/HTTP, MCP lifecycle,
and request-isolation work. Unit tests use public collaborator doubles. Real
listener/provider and entry behavior belongs to integration tests. HTTP
acceptance uses real SDK clients in 2026-07-28 and 2025-11-25 with controlled
fetcher and pipeline dependencies; it stays offline and renderer-free.

## Candidate verification

The candidate contains commits `6f33ee7`, `53f120d`, and `c498578`. The commands
below ran on their complete implementation. The final document commit records
the results and changes no executable file. Counts are
tests/pass/fail/cancelled/skipped/todo.

Dependencies were installed with `pnpm install --frozen-lockfile` (exit 0).
`pnpm exec node --version` reports `v24.20.0`. Renderer tests use
`LIGHTPANDA_BIN="$PWD/.cache/lightpanda/1.0.0/lightpanda"`; it reports 1.0.0 and
its SHA256 is `955440053a84754dd64c62f970449a56a2b350cdf43ea5f2e809a73047b8173d`.
The documented Axiom test settings were supplied from the local environment.

| Command | Exit | Result |
| --- | --- | --- |
| `npm run build` | 0 | Clean compiled output |
| Focused compiled command below | 0 | 485/485/0/0/0/0 |
| `npm run check` | 0 | Unit 2029/2029/0/0/0/0; portal unit 6/6/0/0/0/0; build 10/10/0/0/0/0; portal acceptance 4/4/0/0/0/0. Type checks and portal build passed. |
| `npm run test:integration` | 0 | 254/254/0/0/0/0 |
| `npm run test:acceptance` | 0 | Server 177/177/0/0/0/0; portal 4/4/0/0/0/0 |
| `npm run test:interface` | 0 | 83/83/0/0/0/0, including Better Auth, renderer contracts, and live Axiom exports |
| `npm run test:container` | 0 | 8/8/0/0/0/0; both images built and all cases ran without outbound access |
| `habit-hooks` | 1 | 2 function-length, 26 comment, and 5 file-length findings; retained reasons are below. No test counts apply. |

Normal acceptance does not enable the container cases. The separate container
command above ran and passed all eight cases. Each reported test passed; none
was cancelled, skipped, or left as todo.

An earlier dependency preflight, `docker build --progress=plain --target
dependencies --tag thermus-mcp-p02-dependency-check .`, exited 1 because Cargo
crate downloads had HTTP/2 errors. It ran no test. The final container gate
above succeeded without a Dockerfile or network-policy change. An initial
compiled build also found assertion-driven TypeScript narrowing in the new
renderer acceptance test; the assertion was corrected before all final runs.

The focused command ran after the clean build and selected every new or changed
test, plus related auth, streaming, and fetcher checks:

```sh
node --test \
  "dist/test/unit/mcp/*.test.js" "dist/test/unit/http/*.test.js" \
  "dist/test/unit/website-fetcher/*.test.js" \
  dist/test/unit/application-lifecycle.test.js \
  dist/test/unit/application.test.js dist/test/unit/application-operator-log.test.js \
  dist/test/integration/server-stop-signals.test.js \
  "dist/test/integration/mcp/*.test.js" \
  dist/test/integration/auth/mcp-context.test.js \
  dist/test/integration/auth/local-installation.test.js \
  "dist/test/acceptance/mcp/*.test.js" \
  dist/test/acceptance/auth/mcp-access.test.js \
  dist/test/acceptance/architecture/auth-boundaries.test.js \
  dist/test/interface/auth/better-auth.test.js \
  dist/test/interface/website-fetcher-cancellation.test.js
```

The [test inventory](../testing/test-list.md) lists the executable cases and the
[gate policy](test-gate-policy.md) defines the required runs.

Habit findings are reviewed with these ownership constraints in mind:

- The renderer's render method and its promise callback keep one child's
  timer, listener, kill request, and completion state in one call scope. A split
  only to reduce line count would scatter that ownership.
- The HTTP input adapter keeps one stream's backpressure and event-listener
  cleanup in one scope. Its callbacks all serve that stream lifetime.
- MCPServer keeps the HTTP authentication gate, bound request lifetime, and
  resource cleanup together. These operations jointly prevent admission during
  shutdown. Its lifetime test file specifies that one public contract.
- HTTP lifecycle and renderer cancellation test files keep their resource
  doubles beside the corresponding startup, close, and cancellation cases.
- HTTP isolation acceptance keeps its two-user fixture and both protocol-era
  scenarios together so the result and completion records can be compared with
  each request's cleanup gates.
- Application comments define security routes, provider ownership, basic
  change records, and the reason for observing drain errors immediately. Entry
  comments explain edition-specific imports and shutdown/signal order. HTTP
  comments explain Node/Fetch differences, streaming and disconnect behavior,
  header preservation, client-address trust, and preserving refusal responses
  when a body reader cancels. The MCP comments define full-handler tracking,
  duplex transport close reentry, SDK body cancellation, and best-effort
  completion logging. The HTTP startup test
  comment records Node's delayed handle release. These reasons stay explicit.

New test non-null assertions were removed. The snooze file remains `[]`.
