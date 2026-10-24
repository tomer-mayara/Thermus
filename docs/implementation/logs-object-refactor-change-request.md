# Change request: cohesive objects for system and audit logs

Date: 2026-10-24

Review baseline: `b5e8ec09ee6a4a357811dcf5b1726119609e9e03`

Status: CR implementation complete in PRs #240, #241, and #244; restacked
through PR #245. Current-candidate checks and reviews are recorded separately.
This status does not record merge or release.

## Purpose and scope

Refactor selected ownership boundaries in `src/logs/**`. The requested
`src/logger/**` path does not exist at the reviewed revision. Keep system
diagnostics and customer audit events as separate typed pipelines. Preserve
their observable behavior, transport implementations, limits, and failure rules.

This CR selects two source refactors: system sink composition and explicit
settings sender injection. A third, independent slice adds sender
characterization tests. Keep the current private attempt function. This CR adds
no general logging framework, directory rename, production OpenTelemetry
activation, or audit destination implementation.

## Stack placement and implementation record

The CR was reviewed at the top of Slice 2. Evidence links below pin that review
revision; they do not claim that all those APIs exist in PR #240.

| PR | Required work | Dependency |
| --- | --- | --- |
| #240 | Compose SystemLogger with explicit console and OTel sinks; migrate all callers. | System logging exists in parent #239. |
| #241 | Require the settings sender at each constructor. | This PR first adds DestinationSettingsService and saved Test. Preserve its merge of #238. |
| #242–#243 | Rebase and preserve the explicit dependencies. | Capture and snapshots add construction sites. |
| #244 | Extend cancellation clearing and socket-settlement characterization. | This PR first adds tracked sender settlement and payload clearing. |
| #245 | Rebase and verify the integrated result. | No additional refactor is needed. |

These placements keep each candidate buildable without moving later features
into the sender foundation. The CR slices remain logically independent, but
slices 2 and 3 depend on the existing APIs introduced by their assigned PRs.
The implementation record in each PR must distinguish passing characterization,
new-contract red/green steps, fresh checks, and outstanding gates.

## Implementation outcome and evidence

| Slice | Implementation record | Outcome |
| --- | --- | --- |
| System sink composition, PR #240 | [a8e7917](https://github.com/tomer-mayara/Thermus/commit/a8e7917147a00b30d5d2014c75e19ad2833d19fc) | Concrete SystemLogger requires SystemLogSink. ConsoleSystemLogSink and OtelSystemLogSink own output. All constructors, work slices, and SDK support use composition. |
| Required settings sender, PR #241 | [243acef2](https://github.com/tomer-mayara/Thermus/commit/243acef2e92748e9cf54ed137b42f777f4cdea3f) | DestinationSettingsService requires its sender role. Production and the real process probe supply OtlpAuditSender; read/Save tests supply explicit roles. |
| Sender characterization, PR #244 | [b2acfe82](https://github.com/tomer-mayara/Thermus/commit/b2acfe82e3c24529eca007a83b6999e655052e74) | Held-close warning cases check the same sent Buffer before and after abort, pending physical settlement, and the original warning without cancellation. New export-authorization callers supply explicit Test sender roles. |

Existing system threshold, source, and failure-text characterizations passed
before the refactor. The new injected-sink contract had a failing BDD acceptance
specification and focused failing unit specifications before the implementation
made them green. Settings injection used passing behavior characterization and
typecheck to identify missing arguments. The sender's held-close checks passed
against its existing behavior; no unchanged behavior was forced to fail.

Development evidence is retained in each PR's review artifacts under
`ast-report/logs-refactor-development/`: the system slice record, the
`settings-injection/` record, and the `settlement-characterization/` record.
These records state their local commands and limits. They do not replace checks
or review of the current complete candidate.

The changes preserve thresholds, local time, caller location, failure text,
synchronous system write failures, nonthrowing audit capture, and sender limits
and lifetime. The same production sender still serves saved Test and export.
The private attempt function and transport helpers remain. No attempt class,
common transport wrapper, logging framework, or production OTel activation was
added. This structural CR did not repair or waive the known redaction defect.
The later #245 merge preparation includes its separate behavior correction,
with failing specifications and the [S2-03a correction record](admin-s2-03a.md#redaction-correction).

## Imagined design discussion

The following conversation describes the review baseline above. It is original,
AI-authored synthesis. The voices use Robert C. Martin-inspired and Sandi
Metz-inspired perspectives. Neither author
participated in this review or endorsed its conclusions. The dialogue is not a
quotation or a claim about what either author would actually say.

The references support questions, not a required pattern. Martin's
[Functional Classes](https://blog.cleancoder.com/uncle-bob/2023/01/18/functional-classes.html)
allows cohesive function libraries as well as objects. Metz's
[What does OO afford?](https://sandimetz.com/blog/2018/21/what-does-oo-afford)
informs useful messages between collaborators. Her
[The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction)
warns against sharing code whose rules differ.

**Martin-inspired voice:** SystemLogger owns threshold policy, failure text,
timestamp preparation, and caller location. ConsoleSystemLogger and
OtelSystemLogger change only the final write. An injected SystemLogSink would
make that boundary explicit: the logger prepares one record and calls
`writeSystemLog(record)`. Transport code would no longer inherit the logger's
public methods.

**Metz-inspired voice:** That can help, but the present inheritance is not a
substitution failure. Both subclasses honor the parent contract. AuditLog already
has a sink, but symmetry alone does not justify another layer. Keep
SystemLogSink narrow and avoid a common system-and-audit record.

**Martin-inspired voice:** Agreed. Record preparation already has one owner.
The selected design makes the two output roles explicit collaborators, rather
than logger subtypes. This is a design choice, not a correction to inheritance.
Keep SystemLogger.messageOf and fatal at the entrypoint. Audit capture must
contain failures; system output can throw. Neither synchronous call promises
that eventual network delivery has finished.

**Metz-inspired voice:** The audit sender deserves a closer look. It has shared
admission state, but each attempt also has a payload, cancellation, DNS work,
a checked TLS socket, and cleanup. A reusable AuditHttpsTransport that forwards
to the current functions would hide the sequence without owning its lifetime.
Does the current attempt already own that work?

**Martin-inspired voice:** Yes. The private attempt function already receives a
prepared request, clears payload on abort, and orders DNS, checked TLS, HTTP,
and awaited socket cleanup. OtlpAuditSender.start knows none of those details.
A class would not reduce that client's knowledge. Keep the function and its
local lifetime. Reconsider a class only if a new, concrete missing invariant is
identified outside this CR.

**Metz-inspired voice:** Keep that division precise. The sender builds the
public outcome race and settled promise. An outcome can finish while native
work still holds admission. A parsed warning waits for socket close;
cancellation during that wait can return cancelled. Preserve this in the
payload-clearing characterization.

**Martin-inspired voice:** There is also avoidable concrete construction inside
settings policy. DestinationSettingsService accepts a sender role but imports
and creates OtlpAuditSender by default. Require that collaborator explicitly and
leave concrete selection with app composition. The current production
composition already shares one sender between Test and export; this change
makes that choice explicit at other construction sites too.

**Metz-inspired voice:** Agreed. Keep its saved-revision checks and tenant-bound
credential rules together. Do not split it merely to reduce method count.
Collector, snapshots, SQL runtime, store, and codec already have useful roles.
Keep data records and bounded calculation functions. Apply DRY3; preserve
intentional policy differences.

**Martin-inspired voice:** What would an encoding or response class own? Those
modules contain cohesive OTLP knowledge, but need no identity or shared lifetime.
The attempt needs their results, not more objects to configure.

**Metz-inspired voice:** Keep those functions. Also keep the event records and
named-field mappings. An event subclass hierarchy adds no needed common behavior.
Introduce polymorphism only when real callers and repeated variation justify it.

## Review baseline evidence and limits

The review inspected all 24 files under `src/logs`, relevant composition,
callers, and tests. It ran no tests or performance measurements. Existing tests
below were characterization candidates at that review, not fresh passing
results. The implementation outcome above records the later work.

[SystemLogger](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/system/system-logger.ts#L15)
uses a template method. Its current output implementations have narrow write
overrides. The eight-frame stack scan excludes the system logging directory;
extra forwarding frames or file moves can therefore change caller location.
Exact location cases already exist for
[console callers](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/unit/logging/system/console-logger.test.ts#L65)
and [OTel callers](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/unit/logging/system/otel-logger.test.ts#L78).
External `messageOf` callers at this revision are tests and test support. Keep
the static method to avoid unrelated migration.

[Hosted composition](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/app/logging-storage.ts#L35)
already shares one sender between destination Test and collector export. The
[service default](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/destination-settings-service.ts#L40)
still permits hidden concrete selection elsewhere. Remove that default.

The sender already separates
[public outcome from native settlement](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/audit-send.ts#L18).
[start](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/otlp-audit-sender.ts#L67)
owns shared admission and public cancellation policy;
[beginAttempt and attempt](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/otlp-audit-sender.ts#L37)
hide synchronous preparation, payload clearing, sockets, and physical phase
order. The proposed class boundary already exists. Retain these functions.

Save-time and send-time destination checks are not equivalent. Compare
[destination-endpoint](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/destination-endpoint.ts#L3)
with [public-audit-destination](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/public-audit-destination.ts#L24).
They differ in syntax, literal address policy, and when DNS checks
occur. Preserve these differences. Any alignment needs a separate behavior
specification and review.

## Deep-review corrections

| Earlier mistake or gap | Selected correction |
| --- | --- |
| The attempt class was required in the discussion and table, but optional in the slice. Its client-knowledge test already passed. | Retain the private function; add the missing characterization only. |
| Sink composition was justified as creating one preparation owner. That owner already exists. | Select explicit output roles as a design choice; claim no inheritance defect. |
| Preserved runtime behavior obscured changed construction contracts. | Name both source API migrations and update every caller. |
| A zero-filled Buffer alone could pass after ordinary final cleanup. | Check known content and pending promises before abort, then clearing while close is still held. |
| Shared sender admission could be confused with Test's separate outer cap. | Preserve both caps and their distinct result shapes. |

## Owners and useful messages

The table covers every source file at the review baseline without requiring one
class per file. Its pinned links retain the original names and proposed treatment.

| Files at the review baseline | Owner or role; proposed messages and treatment |
| --- | --- |
| [system-logger](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/system/system-logger.ts), [console-system-logger](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/system/console-system-logger.ts), [otel-system-logger](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/system/otel-system-logger.ts) | SystemLogger owns threshold and record preparation. ConsoleSystemLogSink and OtelSystemLogSink implement synchronous `writeSystemLog(record)`. Keep `info`, `error`, other levels, `setLevel`, and static `messageOf`. |
| [audit-log](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/audit-log.ts), [audit-event-projection](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/audit-event-projection.ts), [audit-content](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/audit-content.ts) | AuditLog owns the nonthrowing capture boundary through `toolCompleted`, `administrationChanged`, and `destinationChanged`. Keep named projection, redaction, and bounded-text functions. |
| [audit-snapshots](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/audit-snapshots.ts), [audit-snapshot-state](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/audit-snapshot-state.ts) | AuditSnapshots owns metadata freshness, load reservations, and future capture admission through `writeAuditEvent` and `close`. Snapshot records remain data. Snapshots never authorize a send. |
| [audit-collector](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/audit-collector.ts), [audit-collector-state](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/audit-collector-state.ts) | AuditCollector owns revision-bound content, byte/item accounts, tenant order, retries, and disposal through `admit`, `settingsObserved`, and `close`. Keep bounds and retry calculations as functions. |
| [destination-settings-service](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/destination-settings-service.ts), [destination-test](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/destination-test.ts), [destination-endpoint](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/destination-endpoint.ts) | Settings service owns `read`, `save`, `test`, and `authorizeExport` policy. DestinationTestLifetime owns its separate admission lifetime. Require the existing sender role; retain endpoint validation as a function. |
| [destination-credential-codec](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/destination-credential-codec.ts) | Codec owns a copied, valid key and tenant-bound `encrypt`/`decrypt`. Keep this object; do not expose its key or merge it with persistence. |
| [destination-settings-store](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/destination-settings-store.ts), [pg-destination-settings-store](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/pg-destination-settings-store.ts), [bounded-sql-runtime](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/bounded-sql-runtime.ts) | Store contract carries settings data. Pg store owns tenant-scoped atomic `read`/`save`; SQL runtime owns bounded `run` and idempotent `close`, including late native work. Keep these distinct. |
| [audit-send](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/audit-send.ts), [otlp-audit-sender](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/otlp-audit-sender.ts), [public-audit-destination](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/public-audit-destination.ts), [audit-https-connection](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/audit-https-connection.ts), [otlp-audit-request](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/otlp-audit-request.ts), [otlp-audit-encoding](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/otlp-audit-encoding.ts), [otlp-audit-response](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/logs/audit/otlp-audit-response.ts) | Sender owns shared admission and `start`/`send`. The private attempt function owns prepared payload and physical work. Preserve send contracts and safe outcomes. Keep DNS/address, TLS, HTTP, encoding, and response functions; no transport class. |

## Implementation slices and acceptance criteria

The sections below retain the selected specification. The outcome record above
states its completed implementation. Each slice changes a separate concern and
uses the stack dependencies listed above. Each source refactor follows its own
characterization; none requires a sender class. Apply
[repository behavior-first guidance](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/docs/coding-principles.md#L9):
establish passing characterization before structural changes. For a genuinely
new source behavior or contract, add its failing BDD specification and use
focused red/green TDD. Do not force an unchanged acceptance case to fail.

### 1. Compose system output through SystemLogSink

Make SystemLogger concrete and inject a synchronous sink with
`writeSystemLog(record)`. Its plain prepared record carries `level`, local
timestamp text `time`, and `message` with caller location. Keep source capture
before output delegation. Replace the old logger constructors at every caller
with logger-plus-sink composition. This intentionally changes source construction
APIs while preserving runtime behavior. Add no forwarding compatibility wrappers.
Include the executable [basic MCP](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.ts)
and [WorkOS MCP](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.ts)
work slices, [SDK support](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/support/in-process/axiom-test-export.ts),
and [Axiom live test](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/interface/logging/system/otel-logger-axiom.live.ts)
in the construction migration.

Observable criteria:

- Given each threshold, including NONE, when levels are logged or `setLevel`
  changes it, then only admitted messages reach the sink, once each.
- Given an admitted call, when the logger returns, then a focused sink spy has
  already received its prepared record. A thrown write escapes synchronously.
- Given Error, SuppressedError, or other input, when error/fatal is called, then
  existing failure text and caller file/line remain correct.
- Given console output, when a record is written, then stderr receives the
  existing local timestamp, color, label, message, and newline. Given OTel,
  then severity number/text and body remain correct without console formatting.
- Given a failing Audit sink, when capture runs, then it still contains that
  failure. Keep distinct typed system and audit messages.

Run the existing threshold, source, and failure-text characterizations first.
Add focused red/green tests for the new sink contract; do not duplicate the
existing threshold matrix. Keep INFO as the default, `SystemLogger.messageOf`,
and the narrow `SystemLog` role. [Entrypoint run](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/src/index.ts#L28)
still needs `fatal`. Compose console output there; retain custom `Writable`
support, stderr output, and untouched stdout.

Keep OTel as an internal adapter with its
[SDK lifetime contract](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/docs/testing/otel-logger.md#L25).
It ignores formatted local time as today;
the SDK assigns its event timestamp. Composition owns the SDK provider,
exporter, flush, and shutdown. Synchronous `writeSystemLog` does not promise
completed network delivery. Do not activate OTel in production.

### 2. Require the settings sender explicitly

Remove the concrete sender import and constructor default from the settings
service. Its existing sender role becomes a required third argument: an
intentional source-construction contract change. App composition already
selects one OtlpAuditSender for Test and export; its own default can remain.
Update every construction site. Unit read/save callers can use a role double.
Real runtime harnesses, including
[the Test process probe](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/support/processes/audit-destination-test-probe.ts#L45),
must explicitly supply the real sender. Do not replace delivery with a no-op.

Observable criteria:

- Given two exports and two Tests holding four native attempts, with room in
  Test's separate outer cap, when another saved Test runs against a stable
  revision, then it returns `{ status: 'tested', revision, outcome: { kind:
  'busy' } }`. Public cancellation retains native admission until settlement.
  Test's own full outer cap instead returns `{ status: 'busy' }`.
- Given saved settings, when Test runs, then saved fields supply its synthetic
  event and credential; unsaved/stale input does not send, and a changed revision
  after sending prevents obsolete confirmation.
- Given a captured revision, when export or a retry starts, then a fresh read
  authorizes that exact enabled revision. Changed settings discard old content
  without retargeting it. Corrupt credentials and storage errors remain safe.

Retain the existing
[production composition shared-cap case](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/integration/logging/audit/logging-storage-export.test.ts#L13),
[authorization cases](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/unit/logging/audit/export-authorization.test.ts#L21),
and [dispatch acceptance cases](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/acceptance/logging/audit/collector-dispatch.test.ts#L5).
Preserve Save's revision conflict, unchanged-ciphertext, and uncertain-write rules.
Saved Test may use disabled saved settings; export requires the exact enabled
revision. These are existing guardrails, not new policy. Review the required
argument and removed concrete dependency; use typecheck to verify migrated
callers. Add no runtime missing-argument guard, source-shape test, or factory.

### 3. Characterize sender clearing and socket settlement

This small test-only slice changes no transport source. Retain synchronous
preparation before any await, no caller event/destination retention, the private
attempt function, and native helpers. Source review confirms these ownership
rules.

Extend the existing pending-close test with Buffer assertions, then add one
no-cancellation control. Use its controlled HTTPS request double through the
existing sender boundary:

- Given a completed warning response and held socket close, retain the same
  nonempty Buffer supplied to `request.end`. Verify its known prepared content
  and verify both `outcome` and `settled` are pending. When the caller aborts,
  then that same Buffer is zero-filled before close is released, the public
  outcome is cancelled, and `settled` remains pending. Release close in cleanup
  and verify fulfilled settlement.
- Given the same completed warning and held close without cancellation, when
  close is released, then the previously pending promises fulfill with the
  original warning and completed settlement. Reuse the fixture.

These checks distinguish abort clearing from final cleanup. Add no debug API,
concurrency matrix, or claim about GC, native HTTP/TLS copies, or
immutable string erasure. Keep dropping the authorization reference on abort.

Existing tests retain the wider contract: four native attempts, five-second
deadline, no sender queue/retry, separate public outcome and settlement, and
admission release only after native completion. Late DNS cannot connect after
cancellation. Both promises fulfill with safe values. Keep the current
[settlement tests](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/unit/logging/audit/otlp-audit-sender.test.ts#L141),
[pending-close case](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/unit/logging/audit/otlp-audit-sender.test.ts#L188),
and [real receiver contract](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/test/integration/logging/audit/audit-sender.runtime.ts#L14).

Retain all-answer public DNS validation and limits, address pinning, peer and
certificate checks, TLS minimum version, explicit HTTP headers, checked socket
use, request/response/header limits, and OTLP outcome mapping. Preserve all safe
outcomes, bounded Retry-After, unsupported success encoding, oversized-header
handling, and exclusion of raw transport diagnostics from results and logs.

## Verification and completion boundary

The initial proposal changed no runtime architecture. The implementation makes
system output roles and settings construction dependencies explicit. Use the
[registry workflow](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/docs/implementation/component-registry-workflow.md)
to keep the current system map accurate when prose or drawings change. Assess
public contract and architecture impact from the complete candidate.

For a complete candidate with any source change, run `npm test`, `npm run typecheck`, and
`npm run build:user-portal`, plus the selected gates required by the
[test gate policy](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/docs/implementation/test-gate-policy.md).
For a standalone slice 3 candidate that changes only the sender unit tests,
run the unit group (`npm run test:unit`) under that policy. A shared fixture
change also selects its consuming groups. A candidate that includes source
changes uses the source selection above, even if its last commit only adds tests.
Run each selected changed test locally, including applicable tests
outside the ordinary suite. Do not add duplicate `npm run check`. Apply
habit-hooks, applicable ast-metrics evidence, and review-tier rules from
[AGENTS.md](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/AGENTS.md).
The initial review recorded no test execution. The implementation evidence above
records later checks and their limits. Current-candidate checks and reviews stay
with each PR; this CR grants no human approval, ADR, merge, or release decision.

The inherited redaction defect recorded in
[admin-s2-04](https://github.com/tomer-mayara/Thermus/blob/b5e8ec09ee6a4a357811dcf5b1726119609e9e03/docs/implementation/admin-s2-04.md#L8)
was handled as a separate behavior fix in #245, with its own failing acceptance
and unit specifications. It is not part of this structural refactor. Stack merge,
release, and rollout work remain outside this CR.
