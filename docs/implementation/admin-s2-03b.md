# S2-03b activity-driven audit settings snapshots

This candidate is stacked over S2-03a in [PR #242](https://github.com/tomer-mayara/Thermus/pull/242).
Implementation and execution evidence are pending. This record states the intended
scope and fixed bounds; it does not claim a passing test, customer delivery, or
release readiness.

## Intended behavior

Add one snapshot owner beside customer capture. Eligible activity from a trusted
tenant uses only an available fresh snapshot. Unknown, disabled, expired, or
failed snapshots drop the current event. Activity may schedule one asynchronous
settings load; the product response never waits for it. A successful load affects
future events only and cannot restore dropped content.

Project each settings read immediately to enabled/revision metadata. Retain no
endpoint, credential, ciphertext, or triggering event. Bind admitted events to the
trusted tenant and saved revision. S2-03b supplies a discard downstream sink;
S2-03c owns bounded queues, fresh-store authorization before attempts, and dispatch.
A fresh snapshot alone does not authorize a remote send.

Both enabled and disabled entries refresh only on eligible activity. A failed
refresh makes capture unknown until a later activity-driven load succeeds. Keep
bounded failure-backoff metadata. No idle polling, refresh timer, cache framework,
pre-Enable content buffer, or automatic event replay is added.

## Fixed bounds and lifetime

| Resource | Intended bound |
| --- | --- |
| Enabled/disabled snapshot freshness | 30 seconds |
| Failed-load backoff | 5 seconds |
| Load caller deadline | 2.5 seconds |
| Concurrent or scheduled loads | 2 |
| Resident snapshot/backoff entries | 256 |
| Accounted snapshot/backoff metadata | 256 KiB |
| Trusted tenant ID | Existing 1,024 UTF-8-byte bound |
| Saved revision | 128 UTF-8 bytes |

Keep active-read reservations separate from resident snapshots. Since the store
read contract has no cancellation signal, a timed-out read keeps its global and
per-tenant reservation until the underlying promise settles. Late completion
cannot restore evicted, timed-out, or closed state. Unexpired failure backoff
cannot be bypassed through eviction; saturated admission drops activity instead
of adding unbounded pending work. Eviction runs on activity. Only active loads
need deadline timers.

Close stops admission and scheduled callbacks, invalidates pending generations,
and clears retained snapshots. It does not wait for an uncooperative store
promise. Hosted composition closes snapshots before the existing SQL runtime;
the SQL owner retains its separate work deadlines and shutdown responsibility.
Without hosted settings storage, retain S2-03a's discard AuditLog. The local
edition does not open SQL or load tenant destination settings.

## Specification and checks

Start with failing acceptance specifications for cold enabled restart, cached
disabled state followed by remote Enable, and failed-read recovery. The current
event must drop and only later activity may capture under the new revision.
Use controlled load-completion signals and a controlled clock, without timing
sleeps. Advancing time alone must start no read.

Drive focused owner tests for freshness, load deduplication, byte/count/load
bounds, failure backoff, timeout reservations, eviction, late results, and close.
Integration specifications combine real AuditLog, the snapshot owner, a settings
store, and a controlled downstream sink for two tenants. Preserve S2-03a's
redaction, content bounds, trusted routing, and tool/Admin outcome isolation.

Before commit, run selected new/changed tests with their focused commands. The
manager selects full-candidate checks against `origin/main`, including inherited
source changes, under the test gate policy. Source changes require the ordinary
suite, typecheck, portal build, applicable production gates, habit-hooks, metrics,
review-tier evidence, and component-registry review. Do not add `npm run check`
to repeat ordinary stages. Record missing prerequisites or omitted selected
runs as not run. Actual commands, results, source contracts, registry changes,
and architecture evidence will be added after implementation and review.
