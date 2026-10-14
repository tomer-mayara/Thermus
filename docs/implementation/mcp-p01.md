# MCP-P01 implementation record

## MCP-P01: HTTP fetch with supplied dependencies

Ticket: `6792e30e-bbd2-483e-958d-21db4ced6da6`. The ticket has no dependency.
This file records the implemented slice, historical verification, and the gate
repair below. The [full MCP plan](mcp-server-plan.md) defines the remaining P02
and P03 scope.

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

## Gate repair after rebase on 2026-10-14

The branch was rebased onto pinned base
`96e9dfd53e232d37a763c2ab2fa3a5cbbda1cdb8`. The test-inventory conflict keeps
the completed P01 cases, canonical identity fields, and the named deferred
`postURLAsMarkdown(url, params, reason)` tool. The base's `Hello` log fixtures
and code-review-agents submodule revision remain intact.

Before the repair, the non-login worker selected Node 22.14.0; the login shell
selected Node 24.20.0. `pnpm typecheck && pnpm test:unit` passed on Node 24.20.0
but reproduced the saved failure on Node 22.14.0: exit 1, 1,997 tests,
1,899 passes, 98 failures, and no cancelled, skipped, or todo tests.
The older runtime lacks `mock.property`, `AsyncDisposableStack`,
`SuppressedError`, and SQLite APIs used by the existing tests and application.

`package.json` now pins the development runtime with
`devEngines.runtime` to Node 24.20.0 and allows pnpm to download it.
`pnpm runtime set node 24.20.0 --save-dev --yes` generated the runtime lock
entries, including platform checksums. No existing dependency version changed.
`.nvmrc` selects the same version as this pin and the existing Docker image.
Production code and all existing tests remain unchanged by the repair.

Manager review accepted the delegated runtime change. In a non-login shell,
`pnpm exec node --version` now reports `v24.20.0`. A runtime probe checks the
four missing APIs above and exits 0. The exact pipeline command uses the pinned
runtime without a login-shell setup or global runtime change.

The following runs use the complete repaired candidate. Counts are
tests/pass/fail/cancelled/skipped/todo.

| Command | Exit | Result |
| --- | --- | --- |
| `pnpm install --frozen-lockfile` | 0 | The lockfile is current; no dependency resolution or lockfile change. No test counts apply. |
| `pnpm typecheck && pnpm test:unit` in the non-login worker | 0 | Unit 1997/1997/0/0/0/0; portal unit 6/6/0/0/0/0. Type checks passed. |
| `npm run check` | 0 | Unit 1997/1997/0/0/0/0; portal unit 6/6/0/0/0/0; build 10/10/0/0/0/0; portal acceptance 4/4/0/0/0/0. Type checks and portal build passed. |
| `npm run test:integration` | 0 | 251/251/0/0/0/0 |
| `npm run test:acceptance` | 1 | Server 163/162/1/0/0/0. The live Axiom test requires the absent `AXIOM_API_KEY`. The command did not reach portal tests; `check` ran those above. |
| `LIGHTPANDA_BIN="$PWD/.cache/lightpanda/1.0.0/lightpanda" npm run test:interface` | 1 | 83/81/2/0/0/0. Only the two live Axiom tests failed, for the absent key. |
| `npm run test:container` | 1 | 8/0/0/8/0/0. Image setup failed in the native dependency installation; no acceptance case ran. |
| Focused command below | 0 | 487/487/0/0/0/0 |
| `habit-hooks` | 1 | The same 14 comment findings and two file-length findings; retained reasons are above. No new finding. Snooze file remains `[]`. |

The Lightpanda executable reports 1.0.0 and its SHA256 matches the runtime guide.
The full acceptance, interface, and container gates are not green. Supply the
documented Axiom test settings and restore crate download access before Ready,
then rerun these gates.

To diagnose the image failure, this command retried its dependency stage:

```sh
docker build --progress=plain --target dependencies \
  --tag thermus-mcp-p01-r4-build-probe .
```

It exited 1 with no test count. Cargo reported HTTP/2 framing errors and could
not download `thiserror` 1.0.69 from `static.crates.io`. The native `adblock-rs`
postinstall exited 101. The retry did not produce an image. Dockerfile and
production telemetry settings were not changed.

The built focused command covers the original failing fixtures, P01 tests,
retained auth checks, and the public renderer cancellation contract:

```sh
npm run build && \
LIGHTPANDA_BIN="$PWD/.cache/lightpanda/1.0.0/lightpanda" node --test \
  "dist/test/unit/mcp/*.test.js" "dist/test/unit/website-fetcher/*.test.js" \
  dist/test/unit/config/deployment-config.test.js \
  dist/test/unit/config/listen-address.test.js \
  dist/test/unit/html-cleaner-pipeline/pipeline/pipeline-cancellation.test.js \
  dist/test/unit/html-cleaner-pipeline/prompt-injection-remover/hidden-html/hidden-text.test.js \
  "dist/test/integration/mcp/*.test.js" \
  dist/test/integration/auth/local-access.test.js \
  dist/test/integration/auth/mcp-context.test.js \
  dist/test/acceptance/auth/mcp-access.test.js "dist/test/acceptance/mcp/*.test.js" \
  dist/test/acceptance/architecture/auth-boundaries.test.js \
  dist/test/interface/auth/better-auth.test.js \
  dist/test/interface/website-fetcher-cancellation.test.js
```

## Deferred work

- P02 supplies shutdown cancellation.
- P03 supplies production rule and runtime composition.
- POST, cache, exporter setup, and a verified local stdio tool are outside P01.
