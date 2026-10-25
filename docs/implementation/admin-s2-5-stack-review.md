# Slice 2.5 stack review — 25 October 2026

Reviewed implementation head: `806ccc573c6ae09c411a47a755d6dd9316343f8f`.
Actual S2.5-02 parent: `2271545702a8f1ec28c6f7dd913fec7024ecadeb`.
Complete-stack main base: `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.

**One confirmed P2 remains open.** PRs #253 and #255 are Draft again. The source repair is
planned as [S2.5-R1](../design/organization-admin-plan.md#s25-r1--read-safety-facts-without-display-hydration),
not implemented. The [S2.5-02 ledger](admin-s2-5-02.md) is the sole current
removal release gate ledger. This review does not mark the stack ready or released.

## Finding and required repair

The coordinator's complete active-member safety scan calls the display-oriented
`memberPage`. The [WorkOS adapter](../../src/accounts/providers/workos/workos-organizations.ts)
serially reads each member's user to hydrate email. The
[safety checks](../../src/accounts/organizations/membership-removal-checks.ts)
use membership, subject, organization, status, grants, management and revision;
they do not use email. All page enrichment occurs after durable admission.

A cache-only probe through the real WorkOS adapter and coordinator used 100
active memberships, including one acting Admin and an ordinary User target.
Membership, role-catalog and store calls completed promptly. Each successful
user lookup advanced controlled monotonic time and timers by 300 ms. The direct
target lookup and 99 page lookups consumed 30,000 ms. The result was:

```json
{"activeMembers":100,"simulatedLatencyPerUserMs":300,"elapsedMonotonicMs":30000,"userEnrichmentReads":100,"deletes":0,"first":"unknown","second":"busy","operationOutcome":null}
```

The manager independently reran the probe and its assertions with the same result.
This confirms a conditional availability defect: successful display reads can
use the operation budget and leave an unnecessary durable hold without deletion.
It is simulated-latency evidence, not a production benchmark, live provider
measurement or runtime throughput SLA. The existing timeout and hold behave
conservatively; clearing the hold or extending the deadline is not the repair.

S2.5-R1 must add a narrow safety-facts page without per-member display hydration.
The existing one direct-target display read may remain. Preserve all grants and
permissions, explicit management evidence, revisions, pagination, duplicate
handling, actor/target consistency, complete Admin count, deadline/stop checks,
exact deletion and no replay. The plan specifies acceptance first and focused TDD.

## Review evidence and limits

The independent reviews passed **204 existing focused tests** on the reviewed
implementation: 111 domain/provider/lifetime, 16 store/real-SQL/restart, and 77
web/audit/self-removal/browser cases. These are focused review results, not a new
complete-candidate gate pass. The 111-case output was returned in the tool session;
no complete raw log was saved. The first web command used Node without the
required TypeScript loader: four files failed to load, while audit unit cases ran.
The corrected `--import tsx` commands passed. Keep that invocation failure in the
history; it was not a product assertion failure.

The browser check used the existing portal build, controlled WorkOS and Chromium
at 390 by 844 pixels. It checked keyboard confirmation/cancel, labels, loaded
assets, no overflow, exact deletion and no result-page form. No new screenshot
was saved. The SQL fixtures used only their disposable containers/volumes. This
review made no fresh live-provider or cloud observation and performed no migration,
deployment, legal publication or production write.

The earlier complete gate results, first failures, retries, coverage provenance
and exact test-byte binding remain in the
[immutable reviewed-head evidence](https://github.com/tomer-mayara/Thermus/tree/339b5716dab08f2195c2d88330a7707b776fca52/review-evidence/s2-5-02/806ccc573c6ae09c411a47a755d6dd9316343f8f).
They do not close R1 or certify its future changed bytes. Local fresh review
reports/probe outputs are retained under `.cache/s25-review/`; those local files
are not published GitHub artifacts. No missing raw log or screenshot is inferred
from the earlier evidence package.

Controlled sentinels prove factor scope, not live factor semantics. The staging
rejoin used privileged invitation acceptance, so it does not close recipient/link
or inherited mailbox gates. Controlled SQL result-loss and process-crash tests
do not prove a live provider's eventual fate. The empty-snapshot, data-only restore
drill proves its narrow external-row hold; it does not prove arbitrary whole-project
restore or unrelated nonempty-row restoration. Current access reads and a 404
cannot settle a possibly live deletion.

## Simplicity and plan decisions

- Retain one coordinator, one pending row per organization, exact operation identity,
  conditional terminal receipts, the shared bounded SQL runtime and one lifetime.
  The review found no further confirmed safety defect in storage, web or audit scope.
- Remove the unused display work from the page safety scan. Do not add a parallel
  email flood, cache, mirror, larger deadline, feature flag, lease, replay worker,
  second store, status API or generic recovery framework.
- Keep one native confirmation, one checked POST, distinct fixed results and the
  existing read-only selection/sign-in navigation. Keep removal separate from
  invitation orchestration because their completion rules differ.
- Keep Audit best effort and trusted-tenant scoped. A first event may be dropped
  while its snapshot loads; the integrated export case warms that snapshot. No
  audit durability or replay requirement is added.
- Use one current state table and evidence matrix in the
  [plan](../design/organization-admin-plan.md#slice-25--password-only-membership-removal).
  Preserve expanded acceptance/TDD requirements in its pinned history and ticket
  records. Use the release ledger for ordered deployment, notice and owner gates.
- Missing SQL prevents provider deletion but is not a visibility or notice switch.
  First hold and verify actual deploy controls and target before any push, merge
  or configuration action that can trigger deployment. Pin and keep the intended
  no-removal deployed candidate while earlier release completes and the repair and
  approved runtime text are prepared/reviewed. Then apply additive data setup and
  deploy the exact approved removal SHA. No remote control change is claimed here.
  Preserve operation rows through rollback.

The successor notice/help proposal remains unapproved and unpublished. Its bytes
and hashes are unchanged by this review. Settings backups remain Slice 4 work;
role changes and MFA remain Slice 3 work. Required final checks, human review,
owner decisions and deployed proof remain in the current ledger.
