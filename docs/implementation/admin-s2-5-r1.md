# S2.5-R1 — Membership safety facts

Status: the source repair and 511 focused cases pass in the working candidate;
complete-candidate checks and independent architect review remain pending.
This increment is
[PR #257](https://github.com/tomer-mayara/Thermus/pull/257), stacked on S2.5-02 at
`0530dd634fe8302b55d4a0669463ef733199cc40`. This is branch implementation status,
not a claim that the repair is on main or released.

## Problem and result

The removal safety scan used display pages. Their WorkOS adapter read every
member's email, which the safety decision does not use. The confirmed
100-member case with simulated 300 ms user lookups reached the 30-second limit
before deletion and left a pending operation. This is a controlled regression
case, not a production latency measurement or an organization-capacity promise.

The directory now defines `OrganizationMemberFacts` and
`memberFactsPage(MemberPageRequest)`. Facts contain membership ID, identity
subject, organization, status, management evidence, every grant and revision.
`OrganizationMember` extends those facts with email. The WorkOS facts page checks
response scope, reads the current role catalog, keeps raw management evidence
and all roles, and returns the cursor without reading users. It keeps stop checks
around each remote read. Empty pages need no role or user read.

Only the removal safety scan uses the new operation. Its direct `member()` target
read keeps one email lookup. Members display and seat counts keep their existing
display pages and current email reads. The target comparison excludes email and
compares every safety field, with grant and permission order normalized.

The generic page reader, later-record handling, ten-page removal limit, current
Admin checks, last-Admin safety and exact deletion remain. The 30-second
monotonic lifetime, five-second WorkOS timeout with no SDK retry, durable hold,
matching terminal receipt, shutdown, unknown-outcome and no-replay rules remain.
No cache, parallel enrichment, larger deadline, automatic hold release, store,
schema, provider setting or deployment change is included.

## Development and verification

The acceptance specification was written before the source change. Through the
real WorkOS adapter and public administration operation, the 100-member fixture
returned `unknown` where `applied` was required. Both monotonic time and fake
timers use milliseconds. The expected result requires exact deletion after
admission, a matching terminal receipt and retention of the acting Admin.

Focused facts-page and coordinator tests were added before their corresponding
source changes. They cover explicit scope and cursor, every safety field, current
role mapping, management/revision parity with direct reads, no paged user reads,
failed reads, current actor and later-page last-Admin facts, stale target facts,
full pagination and stop behavior. Removal pause/failure seams now use facts
pages; display enrichment tests remain on display pages. A pinned-client
integration test checks raw WorkOS response mapping and the absence of user HTTP
requests on the facts path.

The worker's retained red/green logs show these focused steps; the manager
confirmed the implementation and 511 focused cases (465 plus 46) on 25 October
2026:

| Step | Observed result |
| --- | --- |
| Regression acceptance before source changes | Failed: `unknown`, expected `applied`. |
| Facts-page contract before implementation | Failed: `memberFactsPage` did not exist. |
| Facts mapping plus existing member reads | 57 passed. |
| Coordinator with display pages unavailable, before scan switch | Failed: `unavailable`, expected `applied`. |
| First coordinator/lifetime run | 69 passed; one cancelled, then exit 130. The new target-user pause also stopped fixture warmup, so the test needed a pause guard. |
| Corrected facts/target pause seams | 73 passed; no cancelled, skipped or todo cases. |
| Pinned-client raw facts integration | Four passed. |
| Latest focused regression/organization/WorkOS groups | 465 passed; no failures, cancellations, skips or todo cases. |
| Hosted display/removal acceptance cases | 46 passed; no failures, cancellations, skips or todo cases. |

The passing regression performs one direct-target user lookup, advances 300 ms
of simulated time, deletes only the User after admission, retains the Admin and
reads the exact matching applied receipt from the store fake. It does not prove
PostgreSQL durability. Preserve the failed pause-seam run as test-fix history.
The PR Validation record must retain command scope and accessible log artifacts
and bind them to the final candidate. Complete-candidate gates are still pending;
earlier stack passes are historical evidence until that candidate passes its
selected gates.

## Architecture and remaining gates

The existing directory public declaration changes. The increment requires
**T2 Need architect** review of the current candidate. `internalInterface` records
the changed Organizations/WorkOS interface and collaboration inside the hosted
Node server. `sensitiveBehavior` records the changed removal preflight work while
its authorization and integrity rules stay. No client or cross-container contract
changes. Registry prose distinguishes safety facts from display data; its
component, runtime and deployment drawings remain accurate without edits.

The focused L3 comparison shows the same component owners and the scan's old/new
operation. `OrganizationDirectory.memberFactsPage` is the strongest changed
callable contract. L3 plus the field, failure, stop and pagination notes answer
whether the new operation preserves safety without display work; L4 would repeat
adapter internals. No new decision record is required by this repair scope.

Public declaration generation changes only `organization-directory.d.ts`. The
manager must complete the selected source checks and metrics, review the complete
candidate and retain current-head approval evidence. The [S2.5-02 ledger](admin-s2-5-02.md) owns the separate release
and owner gates. This repair does not close them, release removal or make
S2.5-02 Done.
