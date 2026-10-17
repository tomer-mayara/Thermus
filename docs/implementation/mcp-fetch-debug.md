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
