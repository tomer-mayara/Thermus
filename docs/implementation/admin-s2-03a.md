# S2-03a customer capture and System log content isolation

This candidate is stacked over [PR #241](https://github.com/tomer-mayara/Thermus/pull/241).
It adds customer audit capture at the public MCP and protected web boundaries.
The default sink drops events. Settings snapshots and bounded Collector dispatch
remain S2-03b/c. A controlled sink can establish capture; it cannot establish
client receipt, customer delivery, continued delivery, or durable storage.

## Capture and trust

[MCP](../../src/interfaces/mcp/fetch-tool-server.ts) retains a copy of validated
`{url, reason}` or `{query, reason}` and captures one completion after SDK result
projection and safe error/cancellation mapping. Its trusted RequestContext supplies
the tenant and actor; the generated operation ID also correlates the System
completion. Invalid arguments, unknown tools, `_meta`, raw exceptions, and
intermediate HTML have no customer event. The public result stays unchanged.
Fetch withholding still produces empty text with success, as it did before this
change. Search withholding produces the safe `Search content withheld` error.

[Invitation routes](../../src/interfaces/web/account/administration-routes.ts)
capture send, resend, and revoke metadata. [Audit logs routes](../../src/interfaces/web/account/logging-routes.ts)
capture Save and Test outcomes. The current access decision supplies tenant and
actor independently of submitted fields. A stale A form naming B records its
stale outcome only in trusted tenant A; it cannot send to B. Permission-denied
Audit logs actions with trusted context use that context without parsing settings.
CSRF/origin refusals, invalid forms, settings reads, and requests without trusted
context produce no customer event. Invitation records keep a known send role;
resend/revoke do not invent a role that their boundary did not read.

An invitation check failure remains `failed`. A provider write whose outcome is
not confirmed remains `unknown`. Save/Test keep their fixed service outcome;
no endpoint, token, settings payload, revision, or sender response enters the
Admin action event. One Test action event is separate from the existing labelled
`audit.destination.test` synthetic record sent by the saved-destination Test.
No sender result, retry work, or settings-read diagnostic captures itself.

The web boundary does not route existing ChangeRecord entries to customers:
those entries can contain a request-supplied organization ID. They stay internal.
[ChangeRecording](../../src/accounts/organizations/change-records.ts) now isolates
record construction/emission failure. A completed write stays complete, the
original check/provider failure keeps its phase, and no provider write repeats.
Each boundary also catches a throwing supplied capture API. Capture refusal or
sink failure has no export-error feedback containing the cause or tool content.

## Event projection and bounds

[AuditLog](../../src/logs/audit/audit-log.ts) exposes `toolCompleted`,
`administrationChanged`, and `destinationChanged`. The event names are
`mcp.tool.completed`, `organization.changed`, and `audit.destination.changed`.
It copies named fields, not arbitrary caller objects. Audit events have no
file/line, stack, or generic message field and no System log forwarding path.
`AuditEventSink.writeAuditEvent` finishes synchronously; `false` means refused
admission. The caller does not await export or retry a refused event.

| Limit | Fixed bound |
| --- | --- |
| Exported result | 65,536 UTF-8 bytes, including the truncation marker |
| Complete event | 131,072 serialized JSON UTF-8 bytes |
| Each opaque organization, actor, operation, or target string | 1,024 UTF-8 bytes; unsupported metadata drops the event |
| Product input | Existing fetch URL 8,192 code points, search query 512 scalars, and reason 2,000 code points |

The [projection owner](../../src/logs/audit/audit-event-projection.ts) reserves
serialized input and metadata before assigning result space. It preserves valid
input spelling and accounts for JSON escaping, including lone-surrogate URL
input and control characters in reasons. The result copy ends at Unicode
boundaries and uses `\n[TRUNCATED]` when truncated. Its result record contains
`text`, `originalBytes`, `capturedBytes`, and `truncated`. Original size describes
the complete public text before redaction; captured size describes the exported
copy, including redaction and marker. The source result stays complete.

[Redaction](../../src/logs/audit/audit-content.ts) recognizes textual credential
fields for access/refresh/ID token, token, API key, password/passwd, secret,
client secret, authorization, and bearer. Recognized URL parameter names also
include key, auth, session/session ID, code, signature/sig, AWS signing
credentials/security tokens, and Google signing credentials. Name matching is
case-insensitive and includes supported separator forms and percent-encoded URL
parameter names. It applies to tool input and result copies. Request cookies,
Authorization headers, sign-in forms, and logging credentials are not capture
inputs. Fixed pattern recognition cannot promise that arbitrary free text is
secret-free. No general text serializer or product input-size change is added.

### Redaction correction

The final #245 integration candidate corrects a later review finding: a recognized
URL credential could consume a following public JSON field or Markdown delimiter.
The public `AuditLog` acceptance case failed first. Focused unit cases then cover
quoted values and URI keys, public prefixes, ordinary Markdown links and titles,
autolinks, raw URL punctuation, and escaped or incomplete credential values.
The focused run passed 59 tests and the affected audit groups passed 282. The
complete-candidate PR review owns the separate full-gate results.

Validated `input.url` uses full query-value redaction. Text copies preserve complete
quoted enclosures, ordinary Markdown destinations with at most one inner
parenthesis level, and complete autolinks. Unsupported or incomplete markup uses
the conservative full-value rule and can still lose adjacent public syntax.
This bounded recognizer does not parse complete JSON or Markdown documents.
It preserves the credential-name policy, event shape, byte limits and original
product result. It adds no transport or storage behavior.

Review also rejected a draft that retried escaped quotes as opening quotes.
The fixed matcher excludes those openings. A local 64 KB malformed-string sample
fell from about 1.5 seconds to below 2 milliseconds; retained manual samples are
regression evidence, not a latency guarantee. No timing assertion was added to
the behavior suite. Red/green logs and review evidence are retained under
`ast-report/merge-stack/redaction-repair/` in the integration workspace.

The [OTLP encoder](../../src/logs/audit/otlp-audit-encoding.ts) copies the new named
input/result fields and Admin action event into its existing bounded request.
This extends the declared event format; no customer completion dispatch caller
is added. App supplies one AuditLog to hosted MCP and web; local MCP also uses a
discard sink. SQL continues to store settings only, without event history or an
export buffer.

## Specifications and check selection

Acceptance specifications cover real MCP HTTP/pipeline capture, final outcomes,
tenant isolation, signed-in invitation/Save/Test capture, and completed actions
under throwing/refused sinks or a failed internal post-write recorder. Focused
projection tests cover maximum valid input, JSON escaping, multibyte output,
redaction, and fixed bounds. Boundary tests cover current trusted context and
throwing capture APIs. The [test inventory](../testing/test-list.md) lists these
files. The complete candidate's retained review evidence records actual run
results; source specifications alone are not a gate pass.

Selection uses the complete candidate against `origin/main`, including the
stacked settings and sender changes. It requires `npm test`, typecheck, portal
build, renderer, self-hosted container, hosted offline build and Linux AMD64 image,
logging PostgreSQL, and logging Collector. Hosted-live is N/A: authentication,
WorkOS reads/writes, provider arguments, and authorization are unchanged. The
ChangeRecording change isolates only local recording failure after the unchanged
provider operation; it changes no provider call, retry, or payload. A missing
prerequisite or omitted selected gate is recorded as not run. Habit-hooks,
source metrics, review-tier checks, and architecture review also apply. Do not
add `npm run check` to repeat ordinary unit/portal stages.

## Privacy and release limits

The dated [23 October data-flow review](../legal/organization-signup-2026-10-23/data-flow-review.md)
describes the earlier fetch System record with URL origin/path and reason.
This candidate reduces that collection: fetch and search System completions keep
only operation, tool, status, duration, and opaque identities. The approved legal
bundle is unchanged. Its versioned disclosure is not new customer-export consent
or proof of delivery. This candidate adds no deployment, cutover, or release.
When S2-03c enables customer export, the release owner must review the actual
data flow and approved customer disclosures before release.

The [component registry](../../architecture/components.md) records capture at
MCP/web and projection at audit-logs, with the discard default. No Level 2
container, datastore, provider, or deployment topology changes in S2-03a. The
T2 architecture comparison and complete-candidate manager review remain separate
review artifacts; an agent review does not supply independent human approval.
