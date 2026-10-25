# Slice 2.5 plan and evidence review

Reviewed HEAD `806ccc573c6ae09c411a47a755d6dd9316343f8f` against actual parent
`2271545702a8f1ec28c6f7dd913fec7024ecadeb`. Read-only review, 25 October 2026.
I read AGENTS.md and docs/coding-principles.md. I read the four Slice 2.5
implementation records, the global member rules and slice plan, the new integrated
and live tests and their support, the proposed legal package and data-flow review,
and the relevant Slice 1/2/recovery runbooks. I made no source or tracked document
changes and ran no test or live operation. Cached evidence is dated evidence,
not a fresh observation. The untracked S1 production-cutover draft is outside
this review.

## Conclusion

The implementation is ready for detailed source review and candidate review;
the documents do not establish a released feature. The three implementation
increments and the integrated proof increment are distinct and coherent. There
is no circular *functional* dependency: provider boundary -> coordinator -> UI
-> integrated proof. The actual Slice 2 release is a release prerequisite, not
a prerequisite for writing or testing removal.

The core design is already small: one coordinator, the existing SQL runtime,
one current row per organization, exact membership deletion, fixed outcomes,
and existing selection/access paths. Do not add a status service, reconciliation
worker, retry queue, lease, second store, MFA branch, or automatic repair.
The most useful cleanup is a short current plan with one release ledger.

## Findings to correct in the current plan

### 1. P2: Name the actual release candidate and sequence

`docs/design/organization-admin-plan.md:2420` requires actual Slice 2 release.
`docs/implementation/admin-s2-5-02.md:148` repeats this, while lines 150-153 list
notice integration, storage migration and rollout without pinning the exact
candidate for the earlier release. The combined candidate already renders the
Remove action (`src/interfaces/web/account/administration-routes.ts:123`,
`:131`) and has its checked POST (`:156`). Missing SQL prevents deletion; it
does not define a feature exposure switch. The current frozen runtime documents
still say there is no removal (`admin-s2-5-02.md:142`).

This is a plan ambiguity, not a demonstrated source defect: "release Slice 2
first" cannot safely mean "deploy whichever combined branch is current, then
do the removal table later". Pin one sequence:

1. Complete Slice 1/2 release on an identified Slice 2 candidate that has no
   removal UI, including its approved current notices and export journey.
2. Finish removal successor notice/help integration and its checks/review.
3. Apply the reviewed additive removal migration to the named existing project,
   verify privileges/TLS/API isolation, then deploy the exact approved removal
   candidate and run its bounded deployed journey.

If the owner instead wants a combined release, record that scope decision and
one combined set of disclosures and deployment evidence. Do not invent a new
feature flag merely to resolve wording. Make source/data ordering and rollback
explicit; retain operation rows on rollback.

### 2. P2: Do not use the inherited release records as a current checklist

`docs/implementation/admin-s1-staging-release-verification.md:9` says production
signup remains closed. The later S2-04 ledger at `admin-s2-04.md:101` records a
live deployment, and its Slice 1 row and the plan at lines 930-932 record enabled
signup and two production accounts. The older record is dated, so this is not
proof of a runtime error. It is unsafe as the current actionable status: the
Slice 2.5 reader is sent through several records whose "current" sections
describe different days. The plan's top date is also 24 October while the
Slice 2.5 status includes 25 October.

Keep old evidence immutable. Add a short supersession note to historical
records and a single dated current release ledger. That ledger must distinguish
"still needed", "already proved on SHA/environment", and "owner disposition
needed". Do not repeat already closed TLS/CA/setup or backups as open work.

### 3. P2: Separate controlled composition requirements from live-provider exits

The plan's combined journey (`organization-admin-plan.md:2829`) requires existing
factors. Its live step at :2865-2871 permits no live factor observation when no
factor is available in the confirmed free scope. The implementation record
correctly explains this, but the current Done paragraph compresses the evidence
types again. A future worker could interpret "actual provider/store/UI" as a
new paid/MFA-factor gate or treat the controlled sentinels as live proof.

Use a small evidence matrix instead of the generic completion statement:

| Requirement | Current evidence | Still required |
| --- | --- | --- |
| Exact deletion, account and other-membership access | Scoped real WorkOS staging case, real hosted composition and disposable SQL | Scoped deployed target check |
| Factor scope | Controlled sentinels plus exact deletion API call; no live MFA API used | Retain explicit live-factor limit; no enrollment or paid-feature gate |
| Native invitation recipient/link behavior | Privileged API acceptance does not prove it | Inherited Slice 1 proof or explicit authorized disposition |
| SQL contention, faults, restart, lifetime | Existing controlled SQL/process suites | Candidate compatibility, then deployed migration/privilege proof |
| Self-removal session variants | Controlled retained-session and forced-reauth cases; live emitted guidance followed | Deployed current-selection/access check |
| Export and SQL outage independence | Real SQL with controlled sender/provider; actual SQL container stop | Existing Slice 2 deployed export journey, plus bounded removal audit check |

`test/acceptance/auth/hosted-removal.live.ts:230` explicitly uses privileged
acceptance. It must never close the native invitation or mailbox/reset/consumer
gates. The source/data-flow review at :14 says these need the S2.5-02 proof;
mark the staging account/rejoin part proved and retain its native/deployed limits.
Do not rerun already completed proof solely because old prose uses future tense.

### 4. Lower priority: Keep one rule owner and move historical steps out of the current plan

The global member rules at plan :437-468, the common rule at :2461-2497, the
01b steps, the 02 steps and the 230-line runbook repeat the same uncertain-write
rules. The documents are consistent on the key points I checked, but repeated
wording makes future drift likely. The detailed TDD plans also remain in future
tense although the implementation records contain observed steps.

Keep the global rules as the contract. Keep the runbook as the operational
procedure. Keep ticket records as history. Replace most of the current slice's
historical Red/Green text with status, evidence links and remaining actions.
Do not delete historic failures, exact candidate pins or approval history.

The restore procedure is technically justified: loss of a pending row can remove
the safety hold. It does not justify a backup product, periodic drill, retention
policy or restore service in Slice 2.5. The disposable control drill has already
run; keep its evidence and the essential "hold outside restored data" condition.
The current release list should not turn the long recipe into new implementation
work. Slice 4 remains the owner of settings backup and recovery selection.

## Essential invariants to retain

1. Delete only the exact ordinary active supported membership. Never delete the
   global account, other memberships or personal factors. Rejoin creates a fresh
   membership through a new authorized invitation.
2. Check current actor/organization/target/grants/management/revision after durable
   admission. Count the complete bounded current active Admin set with required
   permissions. Refuse incomplete/unknown facts. Pending invitations and inactive
   Admin records do not count.
3. Commit intent before WorkOS. Permit one unresolved removal per organization.
   Release SQL clients before HTTP. Busy means no queued work. Apply fixed time
   and page bounds. Stop future local read/dispatch work on deadline/shutdown.
4. A possible remote effect stays held across restart. Never replay an unknown
   deletion or clear a hold from elapsed time, a read or an erased/restored row.
   Settle only the same operation with a proved terminal result. A terminal SQL
   write already in flight may finish after an unknown response.
5. POST completion is separate from the next Members GET. Keep applied/refused/
   busy/unavailable/unknown distinct. Reuse identity-only selection or sign-in
   after self-removal. Current portal/MCP checks enforce removal.
6. Capture only safe trusted-tenant metadata. Export failure cannot change the
   removal result, clear intent, or cause another deletion.
7. External operator/IdP changes are a maintenance constraint, not an atomicity
   claim. Restore holds must survive outside restored rows until exact independent
   reconciliation; no automated recovery is promised.

These rules map to current owners: membership-removal-checks.ts,
membership-removal.ts, membership-removal-lifetime.ts, the SQL adapter and
administration routes. The integrated tests support them within their explicit
controlled boundaries. I found no reason to replace these owners.

## Precise replacement outline for the Slice 2.5 section

1. **Status, as of 25 October 2026:** provider, coordination and Members behavior
   implemented in #251/#253/#254; integrated/staging/control evidence in #255;
   not released; no new removal source feature is planned. Pin the reviewed head
   and actual parent. Link the four implementation records once.
2. **Scope:** ordinary active User/Admin membership removal and self-removal under
   password authentication. Link the global rules. State role/MFA and settings
   backup ownership once.
3. **Evidence:** use the matrix above, with exact cached record links and dates.
   Preserve first failures and retries in validation history, not the plan body.
4. **Remaining decisions:** existing-organization notice/renewed-agreement handling;
   effective date; help placement; inherited native-flow/mailbox release
   disposition; sequential or explicitly combined release candidate.
5. **Remaining implementation:** only successor frozen document bundle selection,
   approved help integration and affected acceptance/version-recording checks,
   plus any real source defect found by independent review. Do not call the
   unapproved Markdown package runtime integration.
6. **Release sequence:** identify exact candidates and intended environment; close
   earlier release; approve exact complete successor bytes; integrate and review;
   publish and read back approved copy; apply/check the additive migration;
   deploy approved candidate; run a small deployed Members/portal/MCP/audit journey;
   retain rows on rollback and record the final release decision.
7. **Exit:** all applicable checks/reviews, owner decisions, current target/capacity,
   approved deployed text, migration privilege checks and deployed journey have
   evidence. Only then mark S2.5-02 Done. Source merge and staging pass remain
   separate states.

## Actual remaining blockers supported by the reviewed records

- Required independent current-candidate human review and parent merges are not
  proved by an agent signoff or local eligible result.
- Earlier actual Slice 1/2 release, native-flow dispositions and deployed
  Save/Test/Enable/MCP/Admin export journey are not closed by these removal tests.
- The successor five-document package is unapproved; runtime still selects the
  earlier bundle. Existing-organization handling, effective date, help placement,
  frozen source integration, publication and actual presentation remain open.
- The dated 25 October inventory says the production removal table does not
  exist. Migration/privilege/API isolation and deployed removal proof are open.
- Current target identity and bounded $0 capacity need release-time verification;
  no fresh Render deployment observation is supplied by this increment. Do not
  turn that into a new paid resource or broad-load capacity prerequisite.

No settings-backup service, role editor, MFA entitlement, new status API,
unbounded production investigation, or repeated full-stack reimplementation is
required to close this plan.
