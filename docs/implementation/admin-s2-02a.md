# S2-02a isolated audit Collector sender

This candidate adds a callable one-shot sender in `src/logs/audit/`. It does
not establish release readiness. No production caller connects AuditEventSink,
destination settings, or MCP capture to this sender. The optional Test action,
queue, retries, settings credential loading, and shutdown dispatch remain later
Slice 2 work. System diagnostics keep their separate owner and configuration.

## Public contract

[`OtlpAuditSender`](../../src/logs/audit/otlp-audit-sender.ts) exposes
`send(destination, event, signal?)`. It accepts a supplied
`{ endpoint, auth }` record, one already projected `AuditEvent`, and an optional
`AbortSignal`. Auth is `{ type: 'none' }` or
`{ type: 'bearer', token }`. The returned promise carries the
[`AuditSendOutcome`](../../src/logs/audit/audit-send.ts) union.
The sender loads no stored settings or encrypted credential and retries no request.

[`AUDIT_SEND_LIMITS`](../../src/logs/audit/audit-send.ts) fixes the bounds below.
This record describes source behavior. Complete-candidate review evidence
records local checks and review; this document supplies no human approval.

| Outcome kind | Caller meaning |
| --- | --- |
| `accepted` | The response confirms full acceptance. |
| `warning` | A valid response has zero rejected records and a nonempty diagnostic. |
| `partial_rejection` | A valid response reports rejection of the supplied record. |
| `permanent_failure` | The request cannot be retried under the sender policy. |
| `transient_failure` | A later caller may retry under its own attempt and lifetime limits. |
| `unconfirmed` | Acceptance is unknown; this outcome does not authorize a retry. |
| `cancelled` | The caller cancelled the operation. |
| `busy` | All operation slots are occupied; nothing is queued. |

| Fixed bound | Value |
| --- | --- |
| Active operations per sender instance | 4, with no pending queue |
| Caller deadline | 5 seconds, including DNS, TLS, request, and response |
| Encoded request body | 256 KiB |
| Response body | 16 KiB |
| Response headers | 16 KiB |
| Bearer token | 8 KiB |
| Endpoint | 2,048 characters |
| DNS answers | 32 |
| Retry-After | At most 24 hours; a larger value is refused, not shortened |

The [encoder](../../src/logs/audit/otlp-audit-encoding.ts) emits one OTLP log
record with named event fields, `thermus.audit` service and scope, and a decimal
uint64 nanosecond timestamp. It adds no arbitrary source fields. This is metadata
projection, not the later tool-input and result redaction feature.

The [response interpreter](../../src/logs/audit/otlp-audit-response.ts) confirms
acceptance only for HTTP 200 with JSON content type and valid success JSON.
`{}` is valid. A partial-success object with zero rejected records and no
diagnostic, including an empty object, gives `accepted`. A nonempty diagnostic
with zero rejected records gives `warning`; one rejected record gives
`partial_rejection`. HTTP 429, 502, 503, and 504 are
transient even with a bounded malformed or HTML error body. Other HTTP status
values are permanent failures. Malformed success and oversized responses are
unconfirmed and nonretryable. Only a transient outcome permits the caller to
apply its retry policy.

## Security and lifetime

The [destination boundary](../../src/logs/audit/public-audit-destination.ts)
accepts public HTTPS destinations without userinfo, query, fragment, whitespace,
or backslash. Collector paths are preserved. Every DNS answer
must be public. The selected address is pinned for TLS connection; the peer
address and TLS certificate and hostname must pass in the
[TLS owner](../../src/logs/audit/audit-https-connection.ts) before HTTP headers, auth,
or event content are sent. Each invocation uses this check. Redirects are not
followed. Customer requests do not inherit system OTel headers or credentials.

A DNS lookup can outlive caller timeout or cancellation. Its slot remains
occupied until the native lookup settles. Results use safe reason values and
exclude raw response diagnostics, credentials, and event content.

## Verification scope

The dedicated `npm run test:logging:collector` gate builds and runs
[`audit-sender.runtime.ts`](../../test/integration/logging/audit/audit-sender.runtime.ts).
It needs Docker Engine, OpenSSL, the Node 24 test image, and the pinned
OpenTelemetry Contrib Collector 0.163.2 image.
The [site](../../test/support/container/audit-sender-site.ts) creates an internal
Docker bridge with public-shaped IPv4 addresses and a generated trusted test
certificate. It runs the unchanged sender DNS, peer-address, and TLS checks
against a minimal TLS receiver and a Collector with None and Bearer receivers
and a local file exporter. It adds no allow-private production option or
customer credentials. The image digest is retained in the fixture source.

The runtime specifications inspect actual POSTs and Collector records, reject
wrong Bearer auth, reject hostname and trust failures before HTTP, reject a
changed loopback answer, refuse redirects, and cancel a stalled response before
a later send. The client has distinctive system OTel headers and environment
settings to expose accidental inheritance. Local execution results belong in
the complete candidate review evidence.

This network is isolated. It proves controlled socket and protocol behavior,
not public Internet reachability. These checks do not replace an actual
endpoint smoke check before release. Live Supabase
TLS, role, recovery, capacity, and free-tier checks remain the separate release
gates described in the organization administration plan.
