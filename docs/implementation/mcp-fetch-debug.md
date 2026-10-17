# MCP fetch debug script

## Required behavior

Give an operator a command under `script/` that calls Thermus without an LLM
client. The command accepts a Bearer credential, a page URL, and a reason.
It connects to the MCP endpoint, calls `getURLAsMarkdown`, and writes the
returned Markdown to standard output without a JSON wrapper.

The default endpoint is `https://app.thermus.ai/mcp`. An endpoint option permits
local debugging. Read the credential from an environment variable or standard
input. Do not print the credential. Keep diagnostics on standard error and use
a nonzero exit status for invalid input, authentication failure, transport
failure, timeout, or a failed tool result. Close the MCP connection on exit.

## Acceptance criteria

- Given an endpoint that accepts the supplied credential, when the command
  fetches a page with a reason, it prints the exact returned Markdown.
- Given an invalid credential or a failed tool call, when the command runs,
  it fails with a useful diagnostic and prints no Markdown or credential.
- Given a server that does not finish, when the command reaches its timeout,
  it fails and closes its connection.

## Authentication boundary

The hosted backend currently accepts WorkOS Connect OAuth access tokens. The
customer API-key interface is a design preview. This command sends the supplied
credential as Bearer authentication; it does not add customer API-key support
to the backend, issue credentials, or change their expiration.

## Command and checks

[The script guide](../../script/README.md) gives the setup and commands. The
script runs from source with the pinned Node runtime and the existing MCP client
SDK. It negotiates the modern protocol and falls back to the legacy protocol.
The deadline includes credential input and aborts pending HTTP requests.

The [test inventory](../testing/test-list.md#mcp-fetch-debug-command) gives the
focused offline command. The acceptance tests run the actual executable against
a local MCP SDK server through the production HTTP bridge. Their credentials and
authorization gate are test doubles; no hosted OAuth credential is used.
