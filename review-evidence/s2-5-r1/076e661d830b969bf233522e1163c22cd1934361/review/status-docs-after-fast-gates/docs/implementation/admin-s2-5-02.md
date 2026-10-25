# S2.5-02 integrated verification and release controls

Status: S2.5-R1 completes the source repair and selected behavioral checks in
PR #257. Independent human architect review of the current candidate remains
pending. PRs #253 and #255 are Draft again. The
[stack review](admin-s2-5-stack-review.md) records the finding and focused checks;
[S2.5-R1](../design/organization-admin-plan.md#s25-r1--read-safety-facts-without-display-hydration)
is implemented on its repair branch; its [record](admin-s2-5-r1.md) gives the
current behavioral gate results, red/green history, cleanup and limits. The PR
Validation and Quality review records retain earlier candidate evidence and
review status. Actual release remains pending. This is
[PR #255](https://github.com/tomer-mayara/Thermus/pull/255), stacked on
[S2.5-01c / PR #254](https://github.com/tomer-mayara/Thermus/pull/254) at
`2271545702a8f1ec28c6f7dd913fec7024ecadeb`. The ticket is not released or Done.
The [plan](../design/organization-admin-plan.md#s25-02--integrated-verification-runbooks-and-release)
retains the release exit. This document is the sole current Slice 2.5 release
gate ledger. The actual Slice 1/S2-04 release and owner notice decisions remain
prerequisites. The source repair and passing gates do not supply current-head
human approval or release authorization.

## Repair candidate and final checks

**P2 — remove display-only hydration from the safety scan.** Before the repair,
the coordinator's complete active-member check used the WorkOS `memberPage`
display path, which serially fetches email for each member. The safety decision
does not use email.
A cache-only probe through the real adapter and coordinator models one active
Admin, an ordinary User target and 100 active memberships. Each successful user
lookup advances the controlled clock by 300 ms. At 100 lookups and 30,000 ms,
removal returns unknown with no DELETE, the durable row remains pending, and the
next valid request returns busy. The manager independently reran the probe with
the same assertions and result. This is conditional simulated-latency evidence,
not a live latency benchmark or a new organization-capacity promise.

S2.5-R1 now reads complete safety pages through `memberFactsPage` without
per-member display hydration. The single direct-target display read remains.
Keep full grants/permissions, management evidence, revisions, pagination,
actor/target consistency, last-Admin checks, the 30-second budget and all lifetime,
receipt and no-replay rules. Do not replace the extra reads with a parallel email
flood, cache, mirror, larger deadline or feature flag. The regression acceptance
specification failed before source changes; facts and
coordinator tests also recorded their expected red steps. The repair record
reports 465 focused checks, including the regression, and 46 hosted
display/removal acceptance cases passing. The selected complete-candidate
behavioral gates also pass, with ordinary/typecheck/portal repeated after the
test-only assertion cleanup. The plan owns the implementation requirements.
The maintained PR Validation and Quality review records retain current candidate
pins, coverage/metrics, tier decisions and review holds. This ledger keeps
current-head human architect approval and release gates open.

## What this increment verifies

Four integrated acceptance cases use the real hosted HTTP composition and real
verified-TLS PostgreSQL with the restricted runtime role. They cover removal of
an ordinary User and the acting Admin, current counts, last-Admin protection,
portal/MCP denial in the removed workspace, usable selection with a retained
session or required reauthentication, and preservation of both accounts, other
memberships, and personal-factor sentinels. Reauthentication deliberately ends
controlled provider sessions; other-workspace access then signs in again.

The enabled-export case uses real SQL settings, authorization, snapshots and
queue, with a controlled transport failure. The SQL-outage case stops its actual
disposable PostgreSQL container: removal sends no provider DELETE while current
portal access and the MCP `getURLAsMarkdown` pipeline still work. WorkOS and the
renderer are controlled in these cases. Factor sentinels prove scope only; they
do not prove live factor behavior or the deferred MFA design.

The separate live case uses fresh exact-ID WorkOS staging fixtures, the real
hosted application, Chromium password sign-in, actual MCP requests and disposable
PostgreSQL. Its journal records owned IDs before proof and verifies cleanup.
It never scans old fixtures. It creates no MFA, SSO, Directory Sync, WorkOS Audit
Logs, paid feature, cloud SQL project, or new production service. The live journey confirms explicit ordinary-management evidence, stale/foreign/
User/form-token refusals, exact User/Admin deletion, next checked portal/MCP
denial, counts, last-Admin refusal, emitted self-removal guidance, accounts and
other-workspace access. A fresh app invitation creates a different membership
with only Admin. Its acceptance uses the privileged provider API, so this case
does not establish recipient/link rules. No fresh fixture has an existing factor
available and no MFA API is called. Those are explicit evidence limits.

The first live run passed the journey but failed immediate organization-cleanup
reads. Exact-ID readback later returned 404 for all three. A bounded read-only
poll now accounts for that visibility delay without retrying DELETE; the rerun
passes the journey and all cleanup checks. Final local run identities, later
review corrections and complete-gate results belong in the PR Validation record.

The original S2.5-02 cases characterize the existing leaf implementation. Their first runs
found a TypeScript mock seam and fixture expectations to correct; those failures
are not claims of new source behavior or manufactured TDD red steps. In that predecessor increment, production source, public declarations,
dependencies, deployment and registry views stayed unchanged from its actual
parent. R1 changes the directory contract and safety scan as its record states.

## Behavioral gate evidence

The [R1 record](admin-s2-5-r1.md#selected-behavioral-checks) gives the repaired
candidate's passing selected gates. Current candidate pins, commands, artifacts,
coverage/metrics, eligibility and review holds belong to the maintained
Validation and Quality review records in
[PR #257](https://github.com/tomer-mayara/Thermus/pull/257).

### Historical S2.5-02 gate results

These results cover the implementation and test bytes of
`b429c308f013478cd99ee69f22a9f53d5e3687d4`, with later document-only changes.
They do not claim that every earlier run used that committed SHA. The PR
Validation record retains full commands, timestamps, failure/retry history, and
evidence. These are predecessor results, not a second certification of the
repaired candidate. The R1 record supersedes their behavioral gate status.
Independent current-head human review, actual release and owner decisions remain
open.

| Selected check | Latest result |
| --- | --- |
| `npm test` | Passed: 4,997 backend and 49 portal tests. |
| Private PostgreSQL gate | Passed: 26 cases, including the four integrated removal cases. |
| Audit Collector gate | Passed: 10 cases. |
| Members Chromium gate | Passed: one case. |
| Scoped WorkOS removal proof | Passed: one case and exact-fixture cleanup. |
| Full WorkOS live selection | 29 selected; 28 passed and one failed with HTTP 408. The affected five-case group then passed 5/5. Preserve the first failure; it was not an initial full-command pass. |
| Native self-hosted container gate | Passed: 11 cases. |
| Final Linux AMD64 hosted image gate | Passed: 7/7, six subcases and their parent. The isolated retry log is retained in the PR validation evidence. |
| Typecheck and portal build | Passed. |
| Public API snapshot check | Passed: 49 snapshots. |
| Fresh selected coverage | Passed: 3,219 backend and 29 portal unit tests; 1,120 integration tests; 594 backend and 20 portal acceptance tests. Verified capture covers 172 source files from 1,321 processes. |

The PR keeps the earlier quality reports and manager review as history. The
repaired candidate has its own maintained evidence. Earlier actual Slice 1/S2-04
release,
independent required review, exact notice approval/integration/publication/
presentation, production storage/capacity, and deployed removal journey remain
separate gates below. The ticket is not Done.

## Restore control drill

The disposable drill takes a data-only snapshot before an intent. A separate
coordinator process sends one controlled deletion, receives an applied answer,
and pauses before durable completion. Independent evidence retains the operation
ID, exact target and answer. The drill kills that sender and verifies it exited.
It revokes the runtime role's effective INSERT/UPDATE on the removal table while
keeping SELECT, closes old sessions, and restores only scoped table data without
ACL or role replay. It restores LOGIN while keeping the DML hold.

A fresh real coordinator then sees the restored empty ledger and refuses a
reduction without a provider DELETE. The current SQL adapter conservatively
reports `unknown` for the rejected admission; the independent call observer and
effective privileges prove no deletion in this controlled drill. The first manual
run expected `unavailable`; the corrected run records the actual result without
changing source. Reconciliation rebuilds the exact captured pending row, uses an
exact-operation compare-and-set to record the independently proved applied result,
and preserves replacement memberships and a later Admin grant. Only then does
the disposable owner restore the reviewed grants. All seven stages pass and the
owned container is removed.

This proves the specified local control, not the absence of all possible late
WorkOS effects. Process exit, a membership read, a 404, time, or a restored empty
table cannot settle an unknown remote operation. The
[removal runbook](admin-s2-5-02-removal-runbook.md) keeps that limit explicit.
[Slice 4](admin-s4-recovery.md) still owns future settings backup; this drill adds
no production backup prerequisite or recovery-service promise.

## Current storage and release facts

Read-only checks on 25 October confirm the selected Supabase project
`rnqktgtgrvvqptbaosth` belongs to organization `jcizlbmzvltfcwponins`, on Free,
`ACTIVE_HEALTHY`, `us-west-2`, PostgreSQL `17.11.0.003`. Its database uses
10,991,283 bytes, with 13 sessions observed and `max_connections=60`. Logging
settings exist; `thermus_admin.membership_removal_operations` does not. No cloud
migration or setting was changed. Current cycle egress was not returned by this
inventory and still needs the release check. Supabase's [current pricing](https://supabase.com/pricing)
retains a $0 Free plan, 500 MB database allowance, 5 GB egress and inactivity
pausing; these limits are not an uptime or backup promise.

WorkOS staging still uses password authentication with MFA Off and SSO/social
methods disabled. Its [pricing](https://workos.com/pricing) lists AuthKit user
management free up to one million users. These proofs do not resolve separate
production MFA entitlement or the deferred MCP-exemption branch. No new
infrastructure cost or paid feature was accepted.

The Render connector has no selected workspace, so this turn has no fresh
Render deployment observation. The dated [S2-04 ledger](admin-s2-04.md#evidence-and-release-holds)
remains historical evidence, not proof of current release. Before deployment,
confirm the intended workspace and release target; do not select another account
or infer rollout from a healthy older deployment.

## Notice, help and owner gates

The complete [successor bundle](../legal/organization-removal-2026-10-25-proposal-v1/README.md)
contains Terms, Privacy, the unchanged agreement checkbox, Audit help and Members
help. Its manifest pins all bytes, hashes, versions and the proposed 25 October
effective date. Review revision 3 also corrects inherited Audit help and Privacy claims to
match the current Bearer-only Axiom/Custom form and save-before-Test behavior;
revision 2 corrected a retained no-removal statement.
Prior bundles and frozen source bytes remain intact. The current runtime still
selects the earlier audit documents; it does not read this Markdown proposal.

| Gate | State and owner action |
| --- | --- |
| Deployment preflight | Before any push, merge or configuration action that can trigger deployment, hold intermediate/automatic deployments and verify the actual controls and target. Pin and keep the intended no-removal deployed candidate through earlier release and removal preparation. No remote control change is claimed by this record. |
| Repair, stack and independent review | R1 source repair and selected behavioral checks are complete. Obtain independent authorized human architect approval of the current candidate and follow the maintained PR quality/eligibility records. Keep #253 and #255 Draft until their checks and review permit Ready. Merge parents only with their required approvals/checks; refresh this increment and all affected evidence for its actual final head. |
| Actual earlier release | Identify a no-removal candidate and finish actual Slice 1/S2-04 activation, notice, invitation dispositions and destination journey in their release records. A merged code candidate or healthy deployment alone is not that release. |
| Exact notice approval | Owner reviews all five complete documents, manifest and data-flow review, confirms effective date and existing-organization handling. A later date needs revised bytes/hashes and approval. |
| Notice and help integration | After approval, add a successor frozen runtime bundle without overwriting history, select the approved versions, integrate help at the chosen location, and verify signup/acceptance records. |
| Publication and presentation | Publish only the approved scope; verify public URLs and deployed desktop/mobile copy, versions, links and agreement presentation. Not performed by this PR. |
| Production storage and $0 capacity | After repaired-candidate and notice approvals, apply the additive removal migration while the identified earlier no-removal release runs. Check least privilege, private API denial, pool/TLS setup, current usage and bounded proof. No new paid resource. |
| Removal rollout | After the deployment preflight and all required gates, publish/deploy the exact approved removal SHA and documents, then run a scoped deployed journey and retain receipts, safe audit and current access evidence. Pending. |

## Ordered release sequence

1. Before any push, merge or configuration action that can trigger deployment,
   hold every intermediate and automatic deployment. Verify the actual repository,
   branch/SHA, Render workspace/service, deploy hooks/controls and existing database
   target. Pin and keep the intended no-removal deployed candidate. The dated
   auto-deploy setting or an older healthy deployment does not prove current
   controls. No remote control change is claimed by this record. Do not use the
   absent table as the exposure gate: combined code can already show Remove and
   its old runtime notices do not describe removal.
2. With the intended no-removal candidate pinned, complete actual Slice 1/S2-04
   release. Record inherited native-flow/mailbox dispositions, approved current
   notices, and deployed Save/Test/Enable/MCP/Admin export proof. Keep that candidate
   deployed during the following removal preparation and additive data setup.
3. Complete S2.5-R1. Obtain owner approval of the exact complete successor package,
   effective date, existing-organization handling and help placement. Integrate
   approved frozen runtime documents and help without replacing history. Run the
   selected complete-candidate checks and obtain required current-head review.
   Preserve the deployment hold until the final candidate and data setup are ready.
4. While the identified no-removal release remains deployed, apply the reviewed
   additive removal schema/grants in the intended existing project. Verify effective
   runtime privileges, private API denial, TLS/pool setup and bounded $0 headroom.
   Hold the removal candidate until both data setup and approved runtime copy are
   ready. Do not start another service or accept a paid feature.
5. Publish the exact approved public copy and deploy only the exact approved removal
   SHA, frozen notice versions and help. Verify direct/slash public URLs, desktop/
   mobile runtime copy, links and agreement-version recording. Then perform the
   bounded deployed Members removal, current counts, last-Admin, self-removal,
   portal/MCP denial, preserved other access and safe audit journey. Retain exact
   receipts and environment/candidate pins; best-effort audit absence cannot settle
   an unknown operation.
6. Record the owner release decision only after all ledger gates close. On rollback,
   retain pending/terminal operation rows and the reviewed schema/grants; stop old
   write-capable senders as the runbook requires. Never erase a hold to make the
   prior application run. A source rollback or current membership read cannot undo
   or settle a possible provider effect.

Missing storage fails closed before provider deletion, but it is not a feature
visibility or legal-notice switch. The successor proposal remains unapproved and
unpublished; this sequence grants no production write or publication authority.

The [user/operator runbook](admin-s2-5-02-removal-runbook.md) covers fresh-invitation
rejoin, last-Admin refusal, honest unknown results, no blind retry, operator/IdP
restrictions, sender containment and restore holds. The future settings backup
now selects only the logging table; a shared-schema restore must keep removal
holds outside restored rows. These procedures authorize no production recovery.
