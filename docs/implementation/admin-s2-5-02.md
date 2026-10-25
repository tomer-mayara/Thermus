# S2.5-02 integrated verification and release controls

Status: implementation and behavioral gates pass, 25 October 2026. Final
quality review and actual release remain pending. This is
[PR #255](https://github.com/tomer-mayara/Thermus/pull/255), stacked on
[S2.5-01c / PR #254](https://github.com/tomer-mayara/Thermus/pull/254) at
`2271545702a8f1ec28c6f7dd913fec7024ecadeb`. The ticket is not released or Done.
The [plan](../design/organization-admin-plan.md#s25-02--integrated-verification-runbooks-and-release)
retains the release exit. The actual S2-04 release and owner notice decisions
remain prerequisites.

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

The new cases characterize the existing leaf implementation. Their first runs
found a TypeScript mock seam and fixture expectations to correct; those failures
are not claims of new source behavior or manufactured TDD red steps. Production
source, public declarations, dependencies, deployment and registry views remain
unchanged from the actual parent.

## Latest complete-candidate gate results

These results cover the implementation and test bytes of
`b429c308f013478cd99ee69f22a9f53d5e3687d4`, with later document-only changes.
They do not claim that every earlier run used that committed SHA. The PR
Validation record retains full commands, timestamps, failure/retry history, and
evidence. Behavioral gates pass; final quality review, actual release and owner
decisions remain open.

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

Final quality review remains pending. The earlier actual S2-04 release,
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
| Stack and independent review | Merge #251, #253 and #254 in order only after their required current-candidate approvals and checks; review this increment separately. |
| Actual earlier release | Complete the actual S2-04 activation, notice and destination journey in its ledger. A merged code candidate is not that release. |
| Exact notice approval | Owner reviews all five complete documents, manifest and data-flow review, confirms effective date and existing-organization handling. A later date needs revised bytes/hashes and approval. |
| Notice and help integration | After approval, add a successor frozen runtime bundle without overwriting history, select the approved versions, integrate help at the chosen location, and verify signup/acceptance records. |
| Publication and presentation | Publish only the approved scope; verify public URLs and deployed desktop/mobile copy, versions, links and agreement presentation. Not performed by this PR. |
| Production storage and $0 capacity | After all release approvals, apply the reviewed removal migration to the intended existing project with owner credentials; check least privilege, private API denial, pool/TLS setup, current usage and bounded proof. No new paid resource. |
| Removal rollout | Confirm the intended Render target, complete applicable release gates, then run a scoped deployed journey and retain receipts, safe audit and current access evidence. Pending. |

The [user/operator runbook](admin-s2-5-02-removal-runbook.md) covers fresh-invitation
rejoin, last-Admin refusal, honest unknown results, no blind retry, operator/IdP
restrictions, sender containment and restore holds. The future settings backup
now selects only the logging table; a shared-schema restore must keep removal
holds outside restored rows. These procedures authorize no production recovery.
