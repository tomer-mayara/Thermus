# S2-03b activity-driven audit settings snapshots

The original [PR #243](https://github.com/tomer-mayara/Thermus/pull/243), stacked
over S2-03a in [PR #242](https://github.com/tomer-mayara/Thermus/pull/242), added
activity-driven settings snapshots with a refusing downstream sink. That PR
retains the historical candidate's review evidence. S2-03c later supplied
bounded dispatch.

The 25 October correction below supersedes the original rule that discarded the
event which started a settings load. The current contract keeps that event in
bounded memory until the load decides admission. Historical checks do not verify
this correction; its follow-up PR must record new regression and candidate checks.
Source specifications alone do not establish customer delivery or release readiness.

## Capture and settings authority

[AuditSnapshots](../../src/logs/audit/audit-snapshots.ts) implements AuditEventSink
beside customer capture. A fresh enabled snapshot forwards a detached, frozen
event with its saved revision. A fresh disabled snapshot refuses the event. An
unknown or expired snapshot schedules one asynchronous settings load and keeps
the triggering event in a bounded pending batch. Other events for that tenant may
join the same batch within its count and byte limits. The product response never
waits for a settings read or export.

A successful, current, unexpired load projects its result to enabled/revision
metadata. If enabled, it first reports that observation to the collector, then
admits the pending events once in arrival order under that observed revision.
Disabled, absent, invalid, failed, or late results discard the batch permanently.
Close clears pending content too. Backoff and exhausted capacity refuse new
content. A later Enable or recovery cannot revive discarded events.

The initial settings read decides admission; it cannot prove enabled state at
the event timestamp. An Enable concurrent with that pending read can be observed
and authorize the batch. There is no history query or retained failed batch to
replay. The collector still reads current settings before each send and requires
the exact captured revision. A changed destination never retargets old work.

Resident snapshots hold enabled/revision metadata only. Pending batches hold
bounded projected events, but no endpoint, credential, or ciphertext. Both
enabled and disabled snapshots refresh only on eligible activity. Failed refresh
makes capture unknown with bounded failure-backoff metadata until later activity
starts a new load. Add no idle polling, refresh timer, cache framework, durable
event buffer, or automatic replay.

## Fixed bounds and lifetime

| Resource | Production bound |
| --- | --- |
| Enabled/disabled snapshot freshness | 30 seconds |
| Failed-load backoff | 5 seconds |
| Load caller deadline | 2.5 seconds |
| Concurrent or scheduled loads | 2 |
| Pending events per load | 16 |
| Pending serialized UTF-8 event bytes per load | 1 MiB |
| Serialized bytes per event | 131,072 |
| Pending capture across both loads | At most 32 events and 2 MiB |
| Resident entries plus load reservations | 256 combined map entries |
| Accounted snapshot/backoff metadata | 256 KiB |
| Trusted tenant ID | Existing 1,024 UTF-8-byte bound |
| Saved revision | 128 UTF-8 bytes |

Active-read reservations are separate from resident snapshots. Resident byte
accounting reserves tenant UTF-8 bytes, the full 128-byte revision allowance, and
128 bookkeeping bytes. A load reserves tenant bytes and 256 bookkeeping bytes,
including an expired resident retained after eviction. This is fixed accounting,
not JavaScript heap measurement. Pending payload has its own count and serialized
byte limits. The collector retains its separate 128-event/8-MiB global queue
bounds; these accounts do not measure total JavaScript heap.

An absolute 2.5-second deadline starts with the load's first event. Later events
share that deadline; they cannot extend it. Expired work cannot start a read or
apply a result, even before its timer callback runs. Timeout clears all pending
payloads. Because the store read contract has no cancellation signal, an active
timed-out read keeps its global and per-tenant metadata reservation until the
underlying promise settles. Late completion cannot restore evicted, timed-out,
or closed state. Unexpired failure backoff cannot be bypassed through eviction;
saturated admission drops activity instead of adding unbounded work. Eviction
runs on activity. Only admitted loads need deadline timers.

The collector's separate 30-second age starts when it accepts a revision-bound
event. Pending capture can add up to 2.5 seconds before that admission, for up to
32.5 seconds of content retention across these owners. Physical read or native
send cleanup can retain charged metadata after content is cleared.

Close stops admission and scheduled callbacks, invalidates pending loads,
and clears retained snapshots and pending payloads. It does not wait for an
uncooperative store promise. At most two started unresolved reservations remain until settlement.
Hosted composition closes snapshots before the existing SQL runtime;
the SQL owner retains its separate work deadlines and shutdown responsibility.
Without hosted settings storage, retain S2-03a's discard AuditLog. The local
edition does not open SQL or load tenant destination settings.

## Public contracts and composition

The snapshot correction leaves the AuditLog event projection, MCP/web capture
APIs, and settings-store read/save contract unchanged. The later actor-name
addition carries optional `actor.name` beside the authoritative actor IDs in the
same detached event. Pending copies and byte accounting include that name; a
profile failure omits it before capture and does not change settings admission.
It adds no profile read to the snapshot owner.
`AuditSnapshots.writeAuditEvent` returns a boolean admission result and never waits for SQL. `true` can mean provisional
admission to a pending batch; it is not proof of dispatch or receipt. A fresh
enabled snapshot, or a successful enabled load, sends one detached, frozen
`{destinationRevision, event}` to `RevisionBoundAuditSink.admit`.
The event's frozen `organizationId` is the trusted tenant; no separate mutable
routing value is added. False or a throwing downstream means refused capture.
`close()` is synchronous and idempotent. The private state owner fixes the
production bounds. Clock/bound overrides support controlled compositions; no
per-organization setting or product UI is added.

[Hosted composition](../../src/app/hosted-workos-application.ts) creates one
snapshot owner and AuditLog after storage opens and shares them between real MCP
and web routes. Its optional composition inputs are `toolOperations`, `auditSink`,
and `snapshotOptions`. Explicit `audit` and `buildServer` overrides retain their
precedence. An explicit AuditLog creates no unused snapshot owner. Without
storage, the discard default remains; local composition is unchanged. A local
disposable stack closes snapshots if construction fails. Normal close stops
snapshots before closing storage. Existing provider calls, authorization,
settings credentials, and product outcomes remain unchanged.

## Specifications and check status

The follow-up acceptance specifications start red for the first event after
startup/restart and freshness expiry. They require its query/result or Admin
metadata to reach the observed enabled revision without a warm-up request.
Failure specifications require permanent disposal after disabled, failed, late,
or closed loads. Hosted acceptance combines real MCP and invitation routes to
check their shared owner, restart behavior, tenant isolation, and unchanged
public outcomes. Unit cases use held promises for slow reads and controlled
clocks for expiry/backoff. The acceptance site's immediate-turn load barrier
applies only to immediate fake
reads. It is not proof that an arbitrary pending read has settled. Advancing
time alone starts no read; no timing sleeps are used.

Focused tests cover load deduplication, pending FIFO, byte/count/load bounds,
shared absolute deadlines, failure backoff, timeout reservations, eviction, late
results, immutable pending copies and tenant/revision binding, downstream
refusal, and close. Hosted lifecycle integration checks storage closure and
late-result exclusion. S2-03a's redaction, content
bounds, trusted routing, and tool/Admin outcome isolation stay in force. The
[test inventory](../testing/test-list.md) names the source specifications.

The original PR retains its development commands, evidence limits, complete
candidate checks, metrics, review tier, architecture comparison pins, and manager
sign-off. A development pass is not a full gate pass. The follow-up PR must keep
its own current evidence separate from that historical record.

Before commit, run selected new/changed tests with their focused commands. The
manager selects full-candidate checks against `origin/main`, including inherited
source changes, under the test gate policy. Source changes require the ordinary
suite, typecheck, portal build, applicable production gates, habit-hooks, metrics,
review-tier evidence, and component-registry review. Do not add `npm run check`
to repeat ordinary stages. Missing prerequisites or omitted selected runs are
recorded as not run. This correction adds no Level 2 container, datastore,
provider, deployment, or polling service. The existing collector and sender
still own customer completion sends.
