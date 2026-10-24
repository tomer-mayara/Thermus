# S2-03c bounded audit delivery

This candidate is stacked over S2-03b in PR #243. It implements the bounded
customer dispatch in the [organization admin plan](../design/organization-admin-plan.md#s2-03c--bounded-queue-and-current-revision-dispatch).
Complete-candidate results and review are recorded in the PR and
[local review index](../../ast-report/s2-03c-final/README.md). Source specifications
do not establish a gate pass or a production release.

## Capture and authority

Hosted storage composition creates one destination service, one `AuditCollector`,
and one `OtlpAuditSender`. MCP and protected Admin capture share the existing
`AuditLog` and activity snapshots. A fresh enabled snapshot supplies an immutable
event and captured revision to the collector. Cold, disabled, and expired
snapshots still drop the current event. Admission is synchronous and does not
wait for SQL, DNS, or export. Without hosted storage, and in the local edition,
capture retains its discard sink. An explicitly supplied audit sink takes precedence.

Before each attempt, `DestinationSettingsService.authorizeExport` reads exactly
one full current saved version. It checks enabled state and the exact captured
revision, then recovers that version's credential through its existing owner.
A missing, disabled, or different revision drops matching old work without
retargeting it. Read failure starts no send. No SQL transaction spans network work.
A later Save can race an authorized send; data already sent cannot be recalled.

A successful, current, unexpired snapshot metadata load also reports its observed
revision to the collector. Disabled or absent settings report no active revision.
The collector cancels existing work with a different revision, or all work on
that no-active-revision observation. Failed loads report no observation. These
notifications create no state for unknown tenants. They are scoped to activity
loads and the collector's own fresh authorization; Save and Test reads do not
broadcast changes. Opaque revisions have no global ordering. A late observation
can conservatively drop work, but cannot revive or retarget it.

## Fixed bounds and lifetime

The collector has one item and serialized-envelope byte account across queued,
authorization-waiting, sending, and retry-backoff work. The envelope contains the
captured revision and event. Defaults are:

| Resource | Bound |
| --- | --- |
| Items | 128 global; 16 per tenant |
| Serialized UTF-8 envelope bytes | 8 MiB global; 1 MiB per tenant |
| Serialized event bytes | 131,072 |
| Admitted tenants | 32 |
| Active export work | 2 global; 1 per tenant |
| Total age from admission | 30 seconds, without reset |
| Fresh authorization read | 2.5 seconds, also limited by remaining age |
| Authorization cycles | 3, including read failures and sender busy outcomes |
| Retry delay | 250 ms exponential base, capped at 2 seconds, plus 0–25% jitter |

Tenant FIFO includes backoff; later work cannot bypass it. Only temporary read
failure, sender busy, and typed transient send failure permit retry. Each retry
requires a new authorization read. `Retry-After` is a minimum delay, even above
the exponential cap; work is dropped if that delay does not fit its remaining
age. Permanent failure, partial rejection, warning, cancellation, and unconfirmed
outcomes do not retry. Loss and duplicates remain possible; no durable replay or
exactly-once receipt is promised.

A read deadline, total age, observed change, or close clears the collector's event
reference and aborts its attempt. An unresolved read or native send keeps a
charged metadata reservation until physical settlement. It cannot send late or
release admission early. Each item releases accounting once. The byte account
bounds serialized content and records; it does not measure JavaScript heap.

`TrackedAuditSender.start` separates the caller outcome from physical settlement.
The sender prepares its request synchronously so its asynchronous native frame
holds no original event or destination record. Abort zeroes and clears its owned
body buffer and authorization reference, including during uncancellable DNS.
Native admission remains held until DNS/socket cleanup finishes. Data already
handed to the operating system or receiver cannot be recalled.

The same sender instance serves saved Test and export, sharing four native
DNS/TLS/HTTP slots and the existing request, response, address, credential, and
five-second attempt limits. Both also use the same SQL runtime with two active
and four pending calls. Test retains its separate four-operation lifetime limit,
one-shot behavior, disabled-destination exception, and post-read revision check.
The collector has its separate two-active-work limit. There is no additional
combined Test/export transaction limit.

Hosted close stops snapshots first, then collector admission and pending content,
then closes SQL. Close aborts attempts without waiting for uncooperative DNS or
store promises. Their metadata reservations remain until settlement. The existing
10-second process shutdown deadline is unchanged. No event SQL write, history,
worker service, idle polling, or new infrastructure is added. System diagnostics
remain separate and content-free for tool records.

## Specifications and review limits

Acceptance specifications cover public capture through the production hosted
assembly, stale revisions, overload, outages, observation, and shutdown. Focused
unit steps cover accounting, FIFO, retries, fixed age, cancellation, alias safety,
and sender payload lifetime. Integration specifications exercise shared Test/export
native admission and actual PostgreSQL and Collector collaboration. The
[test inventory](../testing/test-list.md#customer-audit-logs--api-foundation)
lists their source files. Development red/green logs are retained under
`ast-report/s2-03c-development/`; final gate and review evidence belongs to the
local review index and PR.

The controlled Collector uses an isolated network. It does not prove public
Internet egress, production configuration, continued receipt, or durable Collector
storage. S2-04 still requires the owner rollout, approved disclosure review,
free-capacity checks, and deployment/recovery evidence. The approved legal bundle
is unchanged. Release review must account for the newly enabled export of bounded
customer content; prior implementation records describe their historical slices.
