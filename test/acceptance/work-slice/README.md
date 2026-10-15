# Work slices

A work slice is a manual run of one thin path through the product. The slice
uses the real parts. Where the product has no part at this time, it uses a
test-only part. Each slice has a folder here with its entry point, its launcher
script, its acceptance test, and a `README.md`. Its plan is in
`docs/implementation/`. No test suite selects the entry point.

- [Basic MCP URL fetch](basic-mcp-url-fetch/README.md): start the fetch tool
  with the mock provider of the acceptance tests, connect an LLM client to the
  tool, and monitor each fetch in Axiom.
- [Auth WorkOS MCP URL fetch](auth-workos-mcp-url-fetch/README.md): start the
  hosted edition with the real WorkOS provider and the fetch tool, sign in to
  the portal with Google, connect Claude Code with its own Connect token, and
  monitor each fetch in Axiom.
