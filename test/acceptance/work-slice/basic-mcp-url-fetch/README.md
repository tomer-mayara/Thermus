# Basic MCP URL fetch work slice

Purpose: start the fetch tool with the mock provider of the acceptance tests,
connect an LLM client to the tool, and monitor each fetch in Axiom.

- Entry point: `basic-mcp-url-fetch.ts`. Acceptance test: `basic-mcp-url-fetch.test.ts`.
  The entry point also exports the composition for the tests and runs only
  when it is executed directly.
- Command: `test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.sh`.
  You can start it from any directory; from another directory, give its full
  path. This launcher script sets the settings of the slice to the defaults
  below and goes to the repository root. Then it runs the entry point with the
  pinned Node runtime of pnpm, `pnpm exec node --import tsx …`, with the
  arguments of the launcher. A signal to the process of the launcher stops the
  server, as Ctrl+C does. A setting with a value before the call keeps that
  value. The launcher writes the five settings to stderr before the start, but
  never `AXIOM_API_KEY`. If `AD_RULES_FILE` is not a file, the launcher stops
  and shows the `touch` command that makes an empty file.
- Before you start the launcher, make sure that you have these items. The slice
  reads the settings of the server:
  - `PUBLIC_BASE_URL` with the address of the listener. Default:
    `http://127.0.0.1:8080`.
  - `AD_RULES_FILE` with the absolute path of a rules file. Default:
    `ad-rules.txt` at the repository root. An empty file gives no ad rules.
  - `LIGHTPANDA_BIN` with the absolute path of the pinned Lightpanda 1.0.0.
    Default: `.cache/lightpanda/1.0.0/lightpanda` at the repository root, where
    the recipe of the [Lightpanda runtime guide](../../../../docs/lightpanda-runtime.md#install-the-pinned-release)
    installs it. If the executable shows a different version, the slice stops
    before it listens.
  - `AXOIM_ENDPOINT_URL` with the Axiom ingestion endpoint. Default:
    `https://us-east-1.aws.edge.axiom.co`. `AXIOM_SYSTEM_LOG_TEST_DATA_SET` with
    the dataset. Default: `system-log-test`, the only dataset that the slice
    accepts. The log goes to that dataset. The launcher exports these two
    settings, and an exported value comes before the value in `.env.local`. To
    change them, set them in the shell, not in `.env.local`.
  - `AXIOM_API_KEY`, which has no default. Set it in the shell or in
    `.env.local` at the repository root. The slice reads that file itself.
  - Public network access, for the pages and for Axiom.
  - Optional: `LISTEN_HOST` and `LISTEN_PORT`. The launcher does not set them.
    The defaults are `127.0.0.1` and 8080, and the port must be free. For a
    different port, change `PUBLIC_BASE_URL` to the same port. The slice
    refuses `LISTEN_PORT=0`, because the client needs the URL before the server
    listens.
- stdout shows the instructions: the client command, the Axiom link, the scope
  name of the run, and an APL filter. The log goes to Axiom only. The console
  shows only the export failures and, when the script fails, one `FATAL` line.
  Stop the script with Ctrl+C.

The slice shows that an LLM client gets web pages as Markdown through the real
MCP server, HTTP bridge, cleaning pipeline, and pinned renderer. The mock
provider accepts each Bearer token. The slice composes the production parts,
`createToolOperations`, `fetchToolServers`, `MCPServer`, `routeLocalRequests`,
`composeApplication`, and `serveApplication`, with the test-only mock provider.
Only the mock provider and the two log lines with the full URL and the Markdown
are slice-only. The acceptance test shows the same path offline, with a renderer
double. The manual run also shows the client, the renderer, and the export to
Axiom.

The slice registers both production tools. Its extra content logging wraps
only fetch; search keeps its private production records.

One fetch call writes three log lines in this sequence:

1. `work-slice fetch started: <requested URL>`
2. `work-slice fetch completed: <requested URL> gave <n> characters of Markdown:`,
   then the Markdown. If the Markdown has more than 65,536 code points, the
   line keeps the first 65,536 and shows the number of the other characters.
   If there is an error, the ERROR line `work-slice fetch failed: <requested URL>: <message>`
   comes in place of this line.
3. The production completion record `{"event":"mcp.tool.completed",...}`.

The decisions and the runbook are in the [Basic MCP URL fetch work slice plan](../../../../docs/implementation/basic-mcp-url-fetch-plan.md).
The [work slice guide](../README.md) lists the slices.
