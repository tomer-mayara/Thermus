# S2-03b activity-driven audit settings snapshots

This [PR #243 candidate](https://github.com/tomer-mayara/Thermus/pull/243) is
stacked over S2-03a in [PR #242](https://github.com/tomer-mayara/Thermus/pull/242).
It implements activity-driven settings snapshots with a downstream sink that
refuses every event by default. Complete-candidate results and review are
recorded in the PR and local [review index](../../ast-report/s2-03b-final/README.md).
Source specifications alone do not establish a gate pass, customer delivery,
or release readiness.

## Capture and settings authority

[AuditSnapshots](../../src/logs/audit/audit-snapshots.ts) implements the existing
AuditEventSink beside customer capture. Eligible activity from a trusted
tenant uses only an available fresh snapshot. Unknown, disabled, expired, or
failed snapshots drop the current event. Activity may schedule one asynchronous
settings load; the product response never waits for it. A successful load affects
future events only and cannot restore dropped content.

The owner projects each settings read immediately to enabled/revision metadata. It retains no
endpoint, credential, ciphertext, or triggering event. It binds admitted events to the
trusted tenant and saved revision. S2-03b supplies a discard downstream sink;
S2-03c owns bounded queues, fresh-store authorization before attempts, and dispatch.
A fresh snapshot alone does not authorize a remote send.

Both enabled and disabled entries refresh only on eligible activity. A failed
refresh makes capture unknown until a later activity-driven load succeeds. Keep
bounded failure-backoff metadata. No idle polling, refresh timer, cache framework,
pre-Enable content buffer, or automatic event replay is added.

## Fixed bounds and lifetime

| Resource | Production bound |
| --- | --- |
| Enabled/disabled snapshot freshness | 30 seconds |
| Failed-load backoff | 5 seconds |
| Load caller deadline | 2.5 seconds |
| Concurrent or scheduled loads | 2 |
| Resident entries plus load reservations | 256 combined map entries |
| Accounted snapshot/backoff metadata | 256 KiB |
| Trusted tenant ID | Existing 1,024 UTF-8-byte bound |
| Saved revision | 128 UTF-8 bytes |

Active-read reservations are separate from resident snapshots. Resident byte
accounting reserves tenant UTF-8 bytes, the full 128-byte revision allowance, and
128 bookkeeping bytes. A load reserves tenant bytes and 256 bookkeeping bytes,
including an expired resident retained after eviction. This is fixed accounting,
not JavaScript heap measurement. The separate count bound also applies.

An absolute 2.5-second deadline starts when work is admitted. Expired work cannot
start a store read or apply a result, even before its timer callback runs. Since the store
read contract has no cancellation signal, a timed-out read keeps its global and
per-tenant reservation until the underlying promise settles. Late completion
cannot restore evicted, timed-out, or closed state. Unexpired failure backoff
cannot be bypassed through eviction; saturated admission drops activity instead
of adding unbounded pending work. Eviction runs on activity. Only active loads
need deadline timers.

Close stops admission and scheduled callbacks, invalidates pending loads,
and clears retained snapshots. It does not wait for an uncooperative store
promise. At most two started unresolved reservations remain until settlement.
Hosted composition closes snapshots before the existing SQL runtime;
the SQL owner retains its separate work deadlines and shutdown responsibility.
Without hosted settings storage, retain S2-03a's discard AuditLog. The local
edition does not open SQL or load tenant destination settings.

## Public contracts and composition

The existing AuditLog event projection, MCP/web capture APIs, and settings-store
read/save contract are unchanged. `AuditSnapshots.writeAuditEvent` returns a
boolean admission result and never waits for SQL. A fresh enabled snapshot sends
one detached, frozen `{destinationRevision, event}` to `RevisionBoundAuditSink.admit`.
The event's frozen `organizationId` is the trusted tenant; no separate mutable
routing value is added. False or a throwing downstream means refused capture.
`close()` is synchronous and idempotent. The private state owner fixes the
production bounds. Clock/bound overrides support controlled compositions; no
per-organization setting or product UI is added.

[Hosted composition](../../src/app/hosted-workos-application.ts) now creates one
snapshot owner and AuditLog after storage opens and shares them between real MCP
and web routes. New optional composition inputs are `toolOperations`, `auditSink`,
and `snapshotOptions`. Explicit `audit` and `buildServer` overrides retain their
precedence. An explicit AuditLog creates no unused snapshot owner. Without
storage, the discard default remains; local composition is unchanged. A local
disposable stack closes snapshots if construction fails. Normal close stops
snapshots before closing storage. Existing provider calls, authorization,
settings credentials, and product outcomes remain unchanged.

## Specifications and check status

Acceptance specifications start red for cold enabled restart, cached disabled
state followed by remote Enable, and failed-read recovery. The current event
drops; only later activity captures under the loaded revision. Hosted acceptance
also combines real MCP and invitation routes to prove their shared owner,
restart behavior, tenant isolation, and unchanged public outcomes. Unit cases
use held promises for slow reads and controlled clocks for expiry/backoff. The
acceptance site's immediate-turn load barrier applies only to immediate fake
reads. It is not proof that an arbitrary pending read has settled. Advancing
time alone starts no read; no timing sleeps are used.

Focused tests cover load deduplication, byte/count/load bounds, absolute deadlines,
failure backoff, timeout reservations, eviction, late results, immutable tenant/
revision binding, downstream refusal, and close. Hosted lifecycle integration
checks storage closure and late-result exclusion. S2-03a's redaction, content
bounds, trusted routing, and tool/Admin outcome isolation stay in force. The
[test inventory](../testing/test-list.md) names the source specifications.

The local ignored [review status](../../ast-report/s2-03b-development/review-status.md)
records development commands and evidence limits. The PR and review index
retain complete-candidate runs, metrics, review tier, architecture comparison
pins, and manager sign-off. A development pass is not a full gate pass.

Before commit, run selected new/changed tests with their focused commands. The
manager selects full-candidate checks against `origin/main`, including inherited
source changes, under the test gate policy. Source changes require the ordinary
suite, typecheck, portal build, applicable production gates, habit-hooks, metrics,
review-tier evidence, and component-registry review. Do not add `npm run check`
to repeat ordinary stages. Missing prerequisites or omitted selected runs are
recorded as not run. No new Level 2 container, datastore, provider, deployment,
settings snapshot polling service, or customer completion send is added.
