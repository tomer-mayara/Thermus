# MCP-P01 implementation record

## MCP-P01: HTTP fetch with supplied dependencies

Ticket: `6792e30e-bbd2-483e-958d-21db4ced6da6`. The ticket has no dependency.
This file records the implemented slice and its historical verification before
rebase. The [full MCP plan](mcp-server-plan.md) defines the remaining P02 and P03
scope.

The request builder reuses `MCPServer` authentication and context binding. It
accepts a trusted `RequestContext` and returns an SDK `Server` or `McpServer`.
Existing high-level probe tools remain tests of that seam. The fetch tool uses
public low-level list and call handlers, declares the tools capability, and
projects results for the selected SDK protocol era. The SDK owns negotiation,
JSON-RPC envelopes, and the 4 MiB/413 request-body rule.

`getURLAsMarkdown(url, reason)` uses one strict input schema. The operation
receives the URL, context, and per-call signal; the reason stays at the MCP/log
boundary. Tests supply fetcher and pipeline dependencies. The operation checks
product permission, URL semantics, the shared 10 MiB UTF-8 HTML limit before
pipeline work, and the Markdown result type. It preserves exact Markdown,
including empty success, and replaces failures with safe text.

The call boundary writes one best-effort JSON completion record with canonical
identity fields, safe input fields, outcome, and duration. Logger failures cannot
change the tool outcome. Cancellation reaches renderer cleanup and prevents
later pipeline stages and success. Synchronous parsing is not preempted.

`NoAuthProvider` exists only in test support. There is no production auth mode,
No Auth route, new OAuth endpoint, profile lookup, POST tool, cache, exporter
setup, or new stdio feature. Better Auth and hosted HTTP 503 behavior stay in
place. See the [tool contract](../reference/mcp-fetch-tool.md).

## Historical evidence before rebase

These runs were recorded for commit
`ca3241cfd8bab9cd255c4615a7e34c24fb13bea4` before rebase onto
`611b2353a57517279eb8d9ea179304ec15330190`. They are not gate evidence for the
combined candidate. The base adds live Axiom exports to OTel acceptance and
interface tests; the current [gate policy](test-gate-policy.md) applies.

The first Given/When/Then HTTP acceptance run used the real SDK client and the
production loopback HTTP bridge. Before implementation, both the modern
`2026-07-28` case and legacy `2025-11-25` case failed because the tool was absent:
2 tests, 0 pass, 2 fail, 0 skip, 0 todo.

Before the builder refactor, the SDK characterization passed in both eras:
2 tests, 2 pass, 0 fail, 0 skip, 0 todo. It proved the public low-level handlers,
capability, result projection, unknown-tool error, malformed JSON refusal, and
4 MiB body refusal. Focused failing tests then drove the implementation.

Cancellation tests characterize a client limitation: legacy `callTool` sends a
cancel notification to a new stateless request. Legacy server cancellation is
therefore tested by aborting the real HTTP stream through the public SDK fetch
option. Modern `callTool` forwards its signal to that stream. No SDK patch or
stateful routing was added.

Historical gate evidence is recorded with that commit and its ticket proof of
work. The [test inventory](../testing/test-list.md) gives executable cases and
commands. The [gate policy](test-gate-policy.md) defines the required runs.

The complete candidate passed `npm run check` (1,997 unit, 6 portal unit, 10
build, and 4 portal acceptance tests), `npm run test:integration` (251 tests),
`npm run test:acceptance` (163 server and 4 portal tests), and
`npm run test:interface` (80 tests with verified Lightpanda 1.0.0), and
`npm run test:container` (8 tests with outbound access denied). The final built
focused run passed 396 tests, including every new or changed test file and the
auth boundary and Better Auth interface checks. Each command exited 0; each
test passed, with no failed, cancelled, skipped, or todo test. The exact focused
command is in the commit and ticket proof.

`habit-hooks` exited 1 with 14 comment findings and two file-length findings.
The URL-validation complexity finding was corrected. These findings are kept
for the following reasons; `.habit-hooks/snooze.json` remains `[]`:

- The three pipeline context comments define the units and distinct meaning
  of removal counts, skipped work, and ordered findings.
- The dispatch comment explains why a failure in both log methods is allowed
  to be swallowed. This is the required best-effort completion contract.
- The fetcher comment states its public HTTP-error contract.
- The nine existing hosted test-fixture comments identify absent memberships,
  token construction, defaults, and real versus doubled package boundaries.
- `local-access.test.ts` remains one existing access integration specification;
  its only change selects the new builder option. `get-url-as-markdown.test.ts`
  keeps the input, result, permission, failure, and cancellation contract of one
  operation together. A split only to meet the line limit would not improve
  either test's scope.

## Deferred work

- P02 supplies shutdown cancellation.
- P03 supplies production rule and runtime composition.
- POST, cache, exporter setup, and a verified local stdio tool are outside P01.
