# Work slices

A work slice is a manual run of one thin path through the product. The slice
uses the real parts. Where the product has no part at this time, it uses a
test-only part. Each slice has an entry point in this folder, an acceptance test
next to the entry point, and a plan in `docs/implementation/`. No test suite
selects the entry point.

## Basic MCP URL fetch

Purpose: start the fetch tool with the mock provider of the acceptance tests,
connect an LLM client to the tool, and monitor each fetch in Axiom.

- Entry point: `basic-mcp-url-fetch.ts`. Acceptance test: `basic-mcp-url-fetch.test.ts`.
- Command, from the repository root: `pnpm work-slice:basic-mcp-url-fetch`.
- Before you start the script, make sure that you have these items. The script
  reads the settings of the server:
  - `PUBLIC_BASE_URL` with the address of the listener, for example
    `http://127.0.0.1:8080`.
  - `AD_RULES_FILE` with the absolute path of a rules file. An empty file gives
    no ad rules.
  - `LIGHTPANDA_BIN` with the absolute path of the pinned Lightpanda 1.0.0. If
    the executable shows a different version, the script stops before it listens.
  - `AXIOM_API_KEY` and `AXOIM_ENDPOINT_URL`, in the environment or in `.env.local`
    of the current directory. The log goes to the dataset `system-log-test`.
  - Public network access, for the pages and for Axiom.
  - Optional: `LISTEN_HOST` and `LISTEN_PORT`. The defaults are `127.0.0.1` and
    8080, and the port must be free. For a different port, change
    `PUBLIC_BASE_URL` to the same port. The script refuses `LISTEN_PORT=0`,
    because the client needs the URL before the server listens.
- stdout shows the instructions: the client command, the Axiom link, the scope
  name of the run, and an APL filter. The log goes to Axiom only. The console
  shows only the export failures and, when the script fails, one `FATAL` line.
  Stop the script with Ctrl+C.

The slice shows that an LLM client gets web pages as Markdown through the real
MCP server, HTTP bridge, cleaning pipeline, and pinned renderer. The mock
provider accepts each Bearer token. The slice composes the production parts,
`createFetchOperation`, `fetchToolServers`, `MCPServer`, `routeLocalRequests`,
`composeApplication`, and `serveApplication`, with the test-only mock provider.
Only the mock provider and the two log lines with the full URL and the Markdown
are slice-only. The acceptance test shows the same path offline, with a renderer
double. The manual run also shows the client, the renderer, and the export to
Axiom.

One tool call writes three log lines in this sequence:

1. `work-slice fetch started: <requested URL>`
2. `work-slice fetch completed: <requested URL> gave <n> characters of Markdown:`,
   then the Markdown. If the Markdown has more than 65,536 code points, the
   line keeps the first 65,536 and shows the number of the other characters.
   If there is an error, the ERROR line `work-slice fetch failed: <requested URL>: <message>`
   comes in place of this line.
3. The production completion record `{"event":"mcp.tool.completed",...}`.

The decisions and the runbook are in the [Basic MCP URL fetch work slice plan](../../../docs/implementation/basic-mcp-url-fetch-plan.md).
