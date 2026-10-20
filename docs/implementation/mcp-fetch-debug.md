# MCP fetch debug script

The [OAuth upgrade](mcp-fetch-debug-oauth-plan.md) extends this original
specification with browser sign-in, saved credentials, refresh, and local
logout. Explicit Bearer input keeps the behavior specified below.

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
- Given a typed fetch failure with an approved public detail, when the server
  returns one text error item, the command preserves that exact message on
  stderr and leaves stdout empty. It still accepts `Page fetch failed` from
  older servers. Hosted details require deployment of the updated server.
- Given unknown error text, an invalid HTTP status, added text, or extra content
  items, when the command receives the result, it uses the generic tool failure
  diagnostic and prints no result fields or partial Markdown.
- Given a server that does not finish, when the command reaches its timeout,
  it fails and closes its connection.

## Authentication boundary

The hosted backend currently accepts WorkOS Connect OAuth access tokens. The
customer API-key interface is a design preview. Explicit credential mode sends
the supplied credential as Bearer authentication. Browser OAuth obtains tokens
from WorkOS; it does not add customer API-key support to the backend or change
the provider's token lifetime.

## Command and checks

[The script guide](../../script/README.md) gives the setup and commands. The
script runs from source with the pinned Node runtime and the existing MCP client
SDK. The [public fetch failure contract](../reference/mcp-fetch-tool.md#public-fetch-failures)
lists the exact approved details. The command does not infer details from
arbitrary remote text or diagnostic fields. It negotiates the modern protocol
and falls back to the legacy protocol.
In explicit mode, the deadline includes credential input and aborts pending
HTTP requests. OAuth preparation has a separate budget before the fetch starts.

The [test inventory](../testing/test-list.md#mcp-fetch-debug-command) gives the
focused offline command. The acceptance tests run the actual executable against
a local MCP SDK server through the production HTTP bridge. Their credentials and
authorization gate are test doubles; no hosted OAuth credential is used in
those offline cases. The upgrade adds dedicated Staging provider proofs.
