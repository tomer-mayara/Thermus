# S2-02b saved Audit destination Test

## Planned follow-up: Save and Test

The Admin action will be named **Test**. It will save the current form first,
then test that confirmed saved revision. A failed or uncertain Save must stop
the Test. The Audit settings page will show the result in its normal layout,
without a separate plain notice page. The export switch will be saved as shown.
Test will remain optional and will send one synthetic event even when export
is off. Admin, tenant, Origin, CSRF, revision, and credential checks still apply.

The implementation starts with a failing acceptance case, then focused tests
for save-before-test ordering, failure handling, and safe result display.

[Draft PR #241](https://github.com/tomer-mayara/Thermus/pull/241) adds an optional
Test action for a current Admin. It is stacked over PR #240 and includes the
settings read/Save dependency from PR #238, merged into this branch. The
comparison with #240 therefore includes both settings read/Save and Test.

## Logging object CR follow-up

The settings service now requires its DestinationTestSender argument. App
composition and the real process probe select OtlpAuditSender explicitly. Tests
that only read or save use a role double; Test-specific doubles remain explicit.
The service no longer imports or constructs the concrete transport. This source
API change keeps saved-version, credential, deadline, cancellation, and result
rules unchanged. No missing-argument runtime guard or new factory is added.

The branch preserves the exact PR #238 side-parent
`e64a49c6cdbc6f5d7a47d2bfc0fd61907e3dca81`. Earlier results in this record describe
the original candidate. Fresh CR verification and current revision pins are
recorded in `ast-report/logs-refactor-checks/pr241/` and the PR review evidence.
No human approval or merge is recorded by this follow-up.

## Behavior and authority

The hosted Audit logs page has a **Test saved destination** button. Its POST
route uses current Admin access, the trusted tenant and actor, exact form fields,
Origin, and CSRF checks. It accepts password authentication, as the settings page
does. Link visibility grants no authority.

`DestinationSettingsService.test` takes a submitted settings snapshot and saved
revision. One fresh full saved-version read supplies its endpoint, auth, enabled
state, encrypted credential, and revision. The destination owner validates that
version and recovers its credential. A stale or absent revision stops Test. A
changed endpoint, auth, Enable, or nonblank Token requires Save first. Blank
Token means the saved credential, as on the settings page.

Test sends one `audit.destination.test` event, including when export is disabled.
It uses the saved endpoint and credential. The event contains the trusted tenant,
actor, time, `synthetic.type=destination_test`, and `destination.revision`; it
contains no token, tool input/result, source location, or exception stack. Test
calls no Save and changes no destination state. It adds no retry, history,
polling, or Enable prerequisite.

After the attempt settles, a fresh saved-state read must confirm the submitted
revision before the service returns the sender outcome. A changed or absent
revision returns `conflict`; a failed read returns `unconfirmed`. Both suppress
the sender result. No SQL lock spans network work. A later Save can race an
attempt; sent data cannot be recalled.

## Bounds and outcomes

Each destination service has one sender and one Test admission owner. Test
permits four active operations and has a five-second caller deadline, including
settings reads and sender work. A cancelled or timed-out operation retains its
Test slot until its callback, including late store reads, settles. Late reads
cannot start a send. Caller cancellation reaches the sender. The sender can
settle its caller while native DNS cleanup remains pending; its separate sender
slot remains occupied until that work ends. These are per-service bounds;
S2-03c must add shared aggregate dispatch accounting.

The existing sender preserves public HTTPS address checks, pinned peer and TLS
hostname checks before HTTP/auth, zero redirects, explicit None/Bearer auth,
bounded request/response sizes, and one attempt. No system OTel environment or
headers become customer settings. Test does not weaken the address policy or
add a private-network bypass.

The public operation returns `tested` with a confirmed revision and typed sender
outcome, or `conflict`, `unavailable`, `unsaved`, `busy`, `cancelled`, or
`unconfirmed`. The page maps these and sender outcomes to fixed safe text. It
does not show receiver diagnostics, endpoint credentials, or exception causes.
Every result explains that Test proves neither continued delivery nor durable
storage, and is not required to enable export.

## Verification selection and limits

The source change selects `npm test`, `npm run typecheck`, and
`npm run build:user-portal`, plus the applicable self-hosted container, hosted
offline/image, PostgreSQL, Collector, and live System Axiom interface gates from the
[test gate policy](test-gate-policy.md). The manager records each complete
candidate result. Each new or changed test also needs its selected focused or
dedicated command before the commit. `npm run check` is not an extra run.

The [test inventory](../testing/test-list.md) lists the executable
specifications. Operation and web unit cases use public collaborator doubles;
acceptance cases cover saved-only behavior and obsolete-result suppression.
Real route/service/codec/sender/Collector collaboration uses the dedicated
Collector group with a supplied store and decided Admin context. Its isolated
network proves protocol and synthetic labels;
it does not prove public Internet egress, live settings rollout, continued
delivery, durable Collector storage, or the later capture and queue features.

## BDD and TDD evidence

Operation acceptance first failed because the saved Test operation was absent.
Web acceptance first failed because the Test button was absent. Focused unit
cases then failed on the missing operation, route, and synthetic projection.
The real Collector case also failed at the missing operation before it passed.
A later unit case exposed a synchronous sender throw that skipped the required
post-read; the service now catches both synchronous and asynchronous failures
and still confirms the revision. No test substitutes a private egress bypass.

Review moved browser-site composition into `test/support/in-process` and
replaced new non-null assertions with explicit checks. A named local
`matchesSavedSettings` predicate separates the blank-token and visible-field
rule from operation order. The synthetic event's supporting interface stays
internal; consumers use the exported `AuditEvent` union.

## Contract and architecture review

Against PR #240, this candidate also includes PR #238's current-Admin settings
read/Save surface, credential codec, and app service composition. Its dependency
PR remains separate. Existing member and MCP permissions are unchanged.
Against main, the complete candidate retains the storage, System/Audit split,
and isolated sender contract changes described in the linked earlier records.

S2-02b adds `DestinationSettingsService.test` and the typed result described
above. The logging object CR makes its supplied sender required; composition
selects one real sender per service at this slice. Existing
read and Save results stay unchanged. `AuditEvent` gains the synthetic variant;
the encoder handles its named fields. Existing `AuditLog` methods and the
synchronous `AuditEventSink` contract stay unchanged. Nothing connects tool or
administration capture to production export. Web routes gain Test with the
current trusted context; a supplied read/Save-only service fails closed for Test.
The local form/notice helpers change only to render that route and its results.

All 13 registry drawings are reviewed. Relative to PR #240, six change: context,
hosted containers, hosted settings components, log components, collaboration
overview, and deployment. No process or component owner is added. The hosted
server gains an explicit customer Collector call. The focused L3 comparison
and behavior notes explain saved credentials, pre/post revision checks, safe
outcomes and both lifetimes; an L4 sequence would repeat them. Versioned source,
renders, pins and manager review are retained with the PR evidence.

## Quality review

File inspection keeps these cohesive boundaries despite the MI goal of 85.
The exception file records bounds and expiry dates. These are goal misses,
not passing MI values. No baseline or threshold is relaxed.

| Changed source file | MI | Reason to retain |
| --- | ---: | --- |
| `logs/audit/destination-settings-service.ts` | 42.4 | Credential and revision rules stay visible in one owner. Test has 14 paths after the saved-form predicate refactor; distinct refusal and cancellation phases stay explicit. |
| `logs/audit/destination-test.ts` | 73.8 | Admission, deadline and late callback cleanup form one lifetime; the largest function has three paths. |
| `logs/audit/otlp-audit-encoding.ts` | 59.3 | Named event projection and encoded limits share one wire contract; the largest function has eight paths. |
| `interfaces/web/account/logging-routes.ts` | 51.2 | Current authority, exact forms and recovery belong to the route boundary. Two form-guard copies do not justify another parser framework. |
| `interfaces/web/account/logging-page.ts` | 72.9 | One escaped native form carries Save and Test without client state. |
| `interfaces/web/account/logging-test-page.ts` | 71.8 | Exhaustive fixed notices keep receiver diagnostics out of user responses; its function has two paths. |

`AuditLog` remains above the file goal. Inherited storage, sender and settings
boundaries retain the reasons recorded in [S2-01a](admin-s2-01a.md#quality-review),
[S2-02a](admin-s2-02a.md#quality-review), and [S2-01b](admin-s2-01b.md). The full
candidate reports remeasure them. The encoder's prior source-coverage mapping
limit has an explicit CRAP bound of 20; current evidence must either resolve it
or retain that limit. Emitted coverage alone is not verified source coverage.

Habit-hooks review keeps these findings with reasons:

- Distinct destination, form, revision and response guards enforce different
  refusals. The Test operation keeps pre-read, send and post-read order visible.
  The existing portal state and store fake retain their bounded test behavior.
- The Test API separates trusted tenant, submitted fields, trusted actor and
  cancellation. The Audit owner does not import the web identity context to
  reduce the parameter count. Existing request and composition parameters keep
  their distinct transport and lifetime meanings.
- New non-null assertions and the unused event-interface export are removed.
  Inherited fixture assertions follow setup and existing explicit outcomes;
  they do not hide production null states. They retain the S2-01b review reasons.
- The Test case file groups one operation's outcomes. The Docker site owns one
  disposable network, certificates, clients and cleanup. Existing larger
  composition, MCP, test and lint-policy files retain those responsibilities.
- The unused `using deadline` binding is required for process shutdown disposal.
  Comments explain trust, contract, cancellation, isolation and protocol limits;
  they do not disable tests or rules. The snooze file stays empty.

The complete-candidate reports retain each high finding, its owner and reason.
Function goals use fresh, verified coverage and explicit unknown bounds; none
is inferred from a file score. Raw goal-miss exits are distinct from tool errors.

## Review status

The runtime and contract changes require **T2 Need architect**. The final PR
review evidence records the actual candidate, command results, local tier
checker, complete metrics and manager sign-off. This committed record specifies
the scope, selection and retained reasons; it does not itself certify those
later runs. Independent human architect approval is still required before merge.
The registry and agent review do not provide that approval. No CI, merge,
release, or live rollout is claimed here.
