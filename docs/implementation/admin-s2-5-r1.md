# S2.5-R1 — Membership safety facts

Status on 26 October 2026: the source repair is implemented in
[PR #257](https://github.com/tomer-mayara/Thermus/pull/257). The checks and
review holds below retain their original candidate scope. The user directly
reported architect approval of the entire original Slice 2.5 stack on 26 October.
Current candidate pins, validation and approval reconciliation are in the PR's
[Validation](https://github.com/tomer-mayara/Thermus/pull/257#issuecomment-6403840671) and
[Quality review](https://github.com/tomer-mayara/Thermus/pull/257#issuecomment-6403840871).
The original S2.5-02 parent was `0530dd634fe8302b55d4a0669463ef733199cc40`.
This implementation record claims no current gate pass, merge or release.

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
The test-only assertion cleanup replaced a non-null assertion with explicit
presence checks; its exact facts test passed 19 cases. Final Habit Hooks reports
465 retained findings and no non-null assertion, with an empty snooze file.
The maintained Validation and Quality review records in
[PR #257](https://github.com/tomer-mayara/Thermus/pull/257) retain final candidate
pins, commands, log links, retry history, coverage and metrics, tier decisions
and review holds. Earlier stack runs remain historical evidence.

## Selected behavioral checks

The complete candidate passed the selected behavioral gates. The ordinary suite,
typecheck and portal build were repeated after the test-only assertion cleanup.
Production source stayed fixed during these gates.

| Selected check | Result |
| --- | --- |
| Full ordinary `npm test` | Passed after assertion cleanup; exact backend/portal counts are in PR Validation. |
| Typecheck and portal build | Passed after assertion cleanup. |
| Private PostgreSQL | 26 passed, including integrated removal and restart cases. |
| Customer Collector | 10 passed. |
| Members Chromium | One passed at 390 × 844; manager inspected the image. |
| WorkOS staging live selection | 29 passed, including scoped removal and exact-fixture cleanup. |
| Native self-hosted container | 11 passed. |
| Linux AMD64 hosted container | Seven passed, including the nested hosted offline build/checks. |

The Docker gates used the task-owned `thermus-s25-r1` Colima profile with an
explicit per-command context. After retaining evidence, the manager deleted that
VM, its container data and `colima-thermus-s25-r1` context. Before/after records
show the global `colima` context and all six shared container IDs unchanged.
The gate results do not establish a production deployment, live removal-table
migration, approved notice selection or an organization-capacity guarantee.
The controlled regression uses prompt membership/catalog calls and a store fake;
SQL durability and staging provider behavior have their separate gate evidence.

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

Public declaration generation changes only `organization-directory.d.ts`.
The maintained PR Validation and Quality review records give the current
candidate's evidence and eligibility. Independent authorized human architect
approval of that candidate remains required; agent review does not supply it.
The [S2.5-02 ledger](admin-s2-5-02.md) owns the separate release and owner gates.
This repair does not close them, release removal or make S2.5-02 Done.
