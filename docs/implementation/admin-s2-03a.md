# S2-03a customer capture and System log content isolation

This ticket is stacked over [PR #241](https://github.com/tomer-mayara/Thermus/pull/241).
It adds customer audit capture at the public MCP and current-Admin web boundaries.
Settings snapshots and Collector delivery remain in S2-03b and S2-03c.

## Required behavior

Capture validated fetch or search input and the final public tool text after
safe error and cancellation mapping. Use the trusted organization, actor, and
operation ID. Exclude invalid arguments, unknown tools, request metadata, raw
exceptions, and intermediate HTML. Keep the client result unchanged.

The Audit log owner projects named fields, redacts recognized credentials, and
bounds the exported copy in UTF-8 bytes. Large results have a truncation marker
and original and captured sizes. System completion records retain operation,
tool, status, duration, and opaque identity fields, without tool content.

Invitation send, resend, and revoke and Audit logs Save and Test use the current
web access context for audit routing. A submitted organization ID is not routing
authority. Capture failure must not change an action outcome or repeat a provider
write. The synthetic destination Test record stays separate from its Admin action.

## Implementation and evidence

The draft starts with acceptance tests that fail on missing capture and the
existing System content leak. Focused tests then drive the event, boundary, and
failure-isolation changes. The final record will list the fixed limits, trust
rules, selected checks, architecture review, and remaining delivery scope.
