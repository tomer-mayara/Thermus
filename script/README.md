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
