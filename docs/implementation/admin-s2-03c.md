# S2-03c bounded audit delivery

The original candidate was stacked over S2-03b in PR #243. It added the bounded
customer dispatch in the [organization admin plan](../design/organization-admin-plan.md#s2-03c--bounded-queue-and-current-revision-dispatch).
That candidate's results and review remain in
[PR #244](https://github.com/tomer-mayara/Thermus/pull/244). Source specifications
do not establish a gate pass or a production release.

## Capture and authority

Hosted storage composition creates one destination service, one `AuditCollector`,
and one `OtlpAuditSender`. MCP and protected Admin capture share the existing
`AuditLog` and activity snapshots. A fresh enabled snapshot supplies an immutable
event and captured revision to the collector. The
[25 October snapshot correction](admin-s2-03b.md#capture-and-settings-authority)
keeps bounded events during startup or freshness refresh, then binds them once to
a successful enabled read. Fresh disabled state and disabled, failed, or late
load results discard content. This supersedes the original warm-up drop rule.
Capture admission is synchronous and does not wait for SQL, DNS, or export.
Without hosted storage, and in the local edition, capture retains its discard
sink. An explicitly supplied audit sink takes precedence.

Customer events can include optional `actor.name` beside the authoritative
`actor.authority` and `actor.subject`. The name is a bounded event-time profile
snapshot, including in a synthetic Test event. Dispatch preserves this captured
value; it does not refresh the profile, change tenant authority, or change
retry, delivery, and disposal rules. Missing or invalid names retain ID-only
events. System logs keep their existing opaque identity fields.

Before each attempt, `DestinationSettingsService.authorizeExport` reads exactly
one full current saved version. It checks enabled state and the exact captured
revision, then recovers that version's credential through its existing owner.
A missing, disabled, or different revision drops matching old work without
retargeting it. Read failure starts no send. No SQL transaction spans network work.
A later Save can race an authorized send; data already sent cannot be recalled.

A successful, current, unexpired snapshot metadata load also reports its observed
revision to the collector before forwarding its pending events. Disabled or
absent settings report no active revision.
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

The 30-second collector age starts at collector admission. The separate pending
capture batch can retain an event for up to 2.5 seconds before that point; it has
its own 32-event/2-MiB aggregate limits across two loads. Total content retention
across pending capture and collector work can therefore reach 32.5 seconds.

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


## Logging object CR follow-up

The [logging object CR](logs-object-refactor-change-request.md) keeps the sender's
private attempt function and existing transport helpers. Its additional
characterization retains the exact nonempty Buffer passed to the HTTP request.
After a warning response, both promises remain pending while socket close is
held. Abort clears that Buffer before close, returns cancellation, and leaves
physical settlement pending. Without cancellation, close permits the original
warning and settlement to finish. Both cases release close in cleanup.

The restack retains the required settings sender and distinct System sink roles.
Read, Save, and export-authorization test compositions now supply explicit local
Test sender stubs. Production composition continues to share one real sender
between saved Test and export. This follow-up changes no production behavior.
The 26 existing sender cases and 50 related composition cases passed before the
follow-up. The added checks characterize existing behavior; no false red step was
introduced. Current local evidence is under
`ast-report/logs-refactor-development/settlement-characterization/`.
