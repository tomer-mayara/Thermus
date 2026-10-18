# Fetch a URL through MCP

`fetch-url.mjs` calls Thermus `getURLAsMarkdown` without an LLM client. It sends
`{url, reason}` and writes the returned Markdown to standard output. It uses the
MCP SDK for protocol negotiation and JSON or SSE responses.

The default endpoint is `https://app.thermus.ai/mcp`. The hosted backend currently
accepts a **WorkOS Connect OAuth access token** with Thermus access. The customer
API-key UI is a design preview. Customer API keys need a separate backend change.
This script sends a supplied Bearer credential. It does not sign in, issue a
credential, refresh a token, or change its expiration.

Install the repository dependencies, including the client SDK and pinned Node:

```sh
pnpm install --frozen-lockfile
pnpm exec node --version
```

The version must be `v24.20.0`. Run all commands from the repository root. No
build is needed to run the script.

Read the credential without echo in zsh, then pass it through the environment:

```sh
read -rs 'THERMUS_API_KEY?Connect OAuth access token: '
export THERMUS_API_KEY
printf '\n'
pnpm exec node script/fetch-url.mjs \
  --url 'https://example.com/' \
  --reason 'Debug the page conversion' > page.md
unset THERMUS_API_KEY
```

For stdin, use the same hidden read and send the value through a pipe. Stdin
replaces the environment value and must reach EOF:

```sh
read -rs 'THERMUS_API_KEY?Connect OAuth access token: '
printf '\n'
printf '%s' "$THERMUS_API_KEY" | pnpm exec node script/fetch-url.mjs \
  --api-key-stdin \
  --url 'https://example.com/' \
  --reason 'Inspect Markdown output'
unset THERMUS_API_KEY
```

Keep credentials out of command arguments and shell history. `THERMUS_API_KEY`
is the environment variable name; its name does not add API-key support to the
server.

Use `--endpoint` to select another MCP server. The endpoint must use HTTPS, or
HTTP on loopback (`localhost`, `127.0.0.0/8`, or `::1`). Redirects are refused.
Only select an endpoint that you trust with the supplied credential.

```sh
pnpm exec node script/fetch-url.mjs \
  --endpoint 'http://127.0.0.1:8080/mcp' \
  --url 'https://example.com/' \
  --reason 'Debug the local server' \
  --timeout-ms 10000
```

`--timeout-ms` sets the total deadline for stdin, negotiation, and the tool call.
The default is 60000 ms; accepted values are 100 through 300000 ms. A timeout
aborts network work and closes the MCP client. The script also closes the client
after success or failure.

Success returns exit status 0, with exact Markdown on stdout, including an empty
result. Failures return status 1, with a diagnostic on stderr and no Markdown.
Remote error text is omitted because it can contain credentials. Use the server
logs for details. Run `pnpm exec node script/fetch-url.mjs --help` for the options.

Run the focused offline tests after a clean build:

```sh
pnpm run build
pnpm exec node --test dist/test/unit/script/fetch-url.test.js dist/test/acceptance/script/fetch-url.test.js
```

# Measure and review a pull request with ast-metrics

Three commands wrap the ast-metrics CLI for the process "Code quality review
with ast-metrics" in [AGENTS.md](../AGENTS.md). They carry the correct syntax
of the tool; do not call `ast-metrics` directly in that process. Run them from
the repository root; no build is needed. The `ast-metrics` executable must be
on PATH (`brew install ast-metrics/tap/ast-metrics` on macOS; the process is
verified with 0.43.1). The
[ast-metrics review guide](../docs/implementation/ast-metrics-review.md)
explains what each command reports, the configuration, and the limits of the
tool.

## Measure the delta

```sh
pnpm exec node script/ast-metrics-delta.mjs [--base REF] [--min SCORE] [--no-compare]
```

Lists each TypeScript file that the branch adds or changes against the merge
base with `--base` (default `origin/main`), with its maintainability score:
the production files under `src/` first, lowest first, then the other files,
then the files without a measurement. Committed, staged, unstaged, untracked,
and renamed files count; deleted files do not. The goal of `--min` (default
85, an integer from 0 to 128) applies to the production files; a test file or
a support file is listed with `no goal`. Exit status 1 when a production file
is below the goal, else 0. The run writes the HTML report to `ast-report/`,
with `compare.html` for the comparison with the base; `--no-compare` skips
the comparison.

## Review the delta

```sh
pnpm exec node script/ast-metrics-review.mjs [--base REF] [--max-findings N]
```

Prints the Markdown review of `ast-metrics review` against `--base` (default
`origin/main`) and writes it to `ast-report/review.md`: files whose score
dropped, new functions with more than 10 decision paths, new rule
violations, and the summary of the change. Exit status 1 when a finding of
severity high exists, else 0. Update the branch from the base first.

## Ask the MCP server

```sh
pnpm exec node script/ast-metrics-mcp.mjs file <path> [--json]
pnpm exec node script/ast-metrics-mcp.mjs complex [--limit N] [--max-cyclomatic N]
pnpm exec node script/ast-metrics-mcp.mjs risky [--limit N]
pnpm exec node script/ast-metrics-mcp.mjs overview
pnpm exec node script/ast-metrics-mcp.mjs tools
pnpm exec node script/ast-metrics-mcp.mjs call <tool> ['<json arguments>']
```

Starts `ast-metrics mcp`, makes one call over standard input and output,
prints the answer, and lets the server exit; no server stays behind. `file`
prints the score, the decision paths, and the lines of each function in a
file, lowest score first; `--json` prints the raw answer. The path is
relative to the current folder, or absolute inside the repository.
`--timeout-ms` sets the deadline (default 60000 ms; after a timeout the
command stops the server). Exit status 1 with one diagnostic line on stderr
for a file that is not in the analysis, an unknown tool, a timeout, a server
that exits before it answers, or a missing executable.

Run the focused offline tests after a clean build, and the live test with the
real executable on PATH:

```sh
pnpm run build
pnpm exec node --test dist/test/unit/script/ast-metrics-delta.test.js dist/test/unit/script/ast-metrics-review.test.js dist/test/unit/script/ast-metrics-mcp.test.js dist/test/acceptance/script/ast-metrics-delta.test.js dist/test/acceptance/script/ast-metrics-review.test.js dist/test/acceptance/script/ast-metrics-mcp.test.js
pnpm exec node --test dist/test/acceptance/script/ast-metrics-mcp.live.js
```
