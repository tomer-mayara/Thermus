# Quality review

Candidate: `2271545702a8f1ec28c6f7dd913fec7024ecadeb`.
Actual parent: `0ff3f6cdde5be4124df0ed2ab002844d5db1c502` (PR #253).
Complete-candidate main merge base: `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.

**T2 Need architect.** Architecture: T2: declarations changed in 3 public modules;
2 registry views edited. [The checker](metrics/pr-review.json) reports local
eligibility `eligible`, with no blocker or undeclared fact. Overall merge remains
**blocked** by unmerged parent #253 and missing independent authorized human
architect approval of this candidate. Agent review and labels are not human
approval. No de-escalation, merge or production activation occurred.

## Tier and policy answers

The three declaration changes are AuditLog's removal event, the exact native
removal form parser, and the overview's required removable hint. The two edited
registry views describe hosted removal and system/customer logging. These facts
and the contract, component and internalInterface flags require T2. The protected
security path `account-form.ts`, sensitiveBehavior and policy flags also require
T1 review; T2 covers both levels. The committed declaration and stamped comparison
are retained under [candidate](candidate/.pr-impact.json) and
[impact evidence](metrics/impact.json). No fact is undeclared.

- **Admission, trust and permissions:** Web verifies current selected access,
  method, configured Origin, bounded exact fields and CSRF before one coordinator
  call. The coordinator still owns fresh actor/target/revision, all grants,
  last-active-Admin protection, one durable operation and uncertain completion.
  The overview hint only decides whether to show a form. The trusted tenant from
  access, never the submitted organization, selects customer Audit capture.
- **Observable contract:** Members gains native confirmation and Cancel. The POST
  returns a fixed applied/refused/busy/unknown result independently of the next
  Members GET, with no replay form. Self-removal uses existing identity-only
  selection, saved-start/signup and reauthentication paths. Current portal/MCP
  checks refuse removed access. Other membership/account/factor scope remains.
  AuditLog adds removal action, membership ID and safe outcomes; projection also
  checks action-to-target pairing for existing invitation events. Valid invitation
  capture stays compatible. Export remains best effort and cannot settle or replay
  a removal. WorkOS password authentication stays behind the existing interfaces.
- **Checks and decision makers:** The policy adds one dedicated real-Chromium
  Members gate. It removes no test-gate requirement and changes no approval rule.
  No new dependency, schema, environment setting, MFA policy or paid service is
  introduced. S2.5-02 still owns scoped live removal, restore/recovery, updated
  versioned notices and owner rollout. No new ADR was requested by an authorized
  decision maker; T2 alone does not require one.

## Metrics and retained findings

[The full process](metrics/process.md) completed Delta, Review, CRAP and
Architecture on the final candidate against main. Its first three sections report
goal misses; Architecture passes. These are completed reports, not tool failures.
The parent-bound checker applies the incremental goals and finds no local blocker.
[Parent MI snapshots](metrics/snapshot-base.json), [head snapshot](metrics/snapshot.json),
[function rows](metrics/crap.json) and [full native review](metrics/review.json)
remain unchanged. No report or coverage value was edited.

All 11 production files existed in the parent. Nine measured files remain below
MI 85, one is above it, and the CSS-only module has no executable MI. No new-file
exception is needed. The complete [source review](review/changed-source-dispositions.md)
retains exact values, function paths and source hashes. Rounded values below are
for reading only.

| File | Parent MI → head MI | Reason retained |
| --- | --- | --- |
| administration-overviews.ts | 75.80 → 76.85 | Keep displayed grants, one-seat count and display eligibility on the same member facts. |
| membership-removal-checks.ts | 56.89 → 61.02 | One domain owner retains current authority, exact target, complete pages and last-Admin ordering; shared support check reduces target-refusal paths. |
| account-form.ts | 61.60 → 59.84 | Reuse the existing bounded, exact-once, CSRF-first native-form boundary. |
| account-pages.ts | 73.88 → 72.76 | Fixed outcome data and read-only links avoid dynamic state, flash storage and replay. |
| account-routes.ts | 60.08 → 59.44 | Comment-only correction; function bodies/signatures and paths are identical. No runtime refactor is justified by this score change. |
| administration-pages.ts | 64.90 → 61.88 | Explicit escaped native HTML needs no client state or modal framework; page maximum remains three paths. |
| administration-routes.ts | 56.14 → 51.27 | Keep trusted actor/tenant scope and safe capture in their existing owner; a second router would duplicate that boundary. Removal is separate from invitation outcomes. |
| members-style.ts | N/A | CSS text only; browser proof checks layout and keyboard use. |
| audit-event-projection.ts | 37.00 → 35.19 | Explicit action-to-target validation permits only named bounded metadata; a generic serializer would weaken the contract. |
| audit-log.ts | 88.06 → 88.06 | Type vocabulary changes; capture methods retain identical bodies and failure isolation. |
| otlp-audit-encoding.ts | 54.63 → 54.32 | One finite event union maps to explicit OTLP attributes with existing byte/numeric checks. |

Every new and changed function meets its applicable CRAP goal. The largest new
value is administrationTarget: 11.004348377, 11 paths and 96.7% mapped coverage.
The new route is 7 with 100% coverage. Changed eventAttributes is 16 with 100%
coverage: below the changed-function limit of 30. Its report's advisory target
of 15 is not the new-function requirement; splitting a third target choice solely
to lower the number would not reduce the decisions. No CRAP exception is used.
The other changed-function values and all classifications are in the retained
rows. Some anonymous callbacks are classified as new by the tool; their scores
also meet the new-function goal.

The unchanged encodeAuditEvent function has four paths but no mapped share in
this capture. Keep that coverage unknown, with conservative CRAP interval [4,20]
and reason `unchanged by this PR`. The complete-main process also retains the
parent's one-path composeLoggingStorage mapping gap: interval [1,2], not a measured
percentage. No new or changed 01c function has an unknown assessment.

The native review's incremental concerns are the rule file's total complexity 43
(spread across functions with at most nine paths), new eleven-path explicit target
projection and encoder growth from 15 to 16 paths. Their reasons are above and in
the source review. The two changed test files' Halstead estimates grow with exact
form/unsupported-target and overview cases; they are estimates, not observed bugs,
and tests have no production MI goal. Keep the cohesive behavior matrices.

Five high full-stack findings are unchanged by 01c: removal lifetime/coordinator
MI, WorkOS adapter MI, the SQL adapter MI and the WorkOS connection test MI.
[The parent review](https://github.com/tomer-mayara/Thermus/blob/e87fa04a948f840ea021c2f83797b774fbd4ec86/review-evidence/s2-5-01b/0ff3f6cdde5be4124df0ed2ab002844d5db1c502/QUALITY.md)
retains their full dispositions. The lifetime keeps one timer/stop/result owner;
the coordinator keeps admission, one dispatch and operation-bound completion;
WorkOS keeps provider interpretation and guarded reads together; SQL keeps short
atomic statements on the existing pool; its integration test keeps the SDK timeout
and exact write-count contract visible. The inherited new-file MI bounds are
43.67 (coordinator), 56.89 (checks), and 73.50 (lifetime), expiring 2026-12-24.
Checks now improves to 61.02. No exception is added or enlarged by 01c. The lifetime
class-level finding of 70 differs from its file MI of 73.50.

Other inherited notes retain the same reasons: 31-line app composition shows close
ordering; declaration/SQL coupling counts existing type contracts and owner pairs;
the storage-failure test keeps settings/removal outage isolation together. The
native review also inspects ignored local cache helpers and copied declarations,
including the evidence pin helper. Those non-candidate tooling findings are kept
in the full report with their real paths, not presented as shipped production
regressions or hidden by editing the metrics configuration.

## Checker notes and habit-hooks

Every informational note has a reason:

- All 49 public modules verify; three snapshots change for the parser, display
  hint and removal capture contract described above.
- otlp-audit-sender has two affected imports (AuditLog and encoding), but identical
  public declarations. audit-send likewise retains its declaration. They keep the
  same bounded sending/current-revision behavior while accepting the encoded
  removal event through the existing event union.
- organization-administration imports the changed overview but retains its own
  declarations. Its existing memberOverview result now carries the display hint;
  the removal callable and current safety checks remain the same.
- The test-gate policy removes no lines, so its removal-path review rule is N/A.
  The policy flag still declares the added browser check.
- The increment is 137 production lines and 1,196 total lines, below the note
  thresholds. The checker counts 32 added and two removed test declarations:
  the two removals are renamed existing scenarios, not lost cases. Actual ordinary
  backend executions increase by 77; no skip or todo is added.
- Local eligibility is preliminary. The manager checked the complete candidate,
  all selected local gates and parent state. Required human approval is pending.

Final `habit-hooks --branch origin/main --no-snooze` exits 1 with 437 retained
findings: six complexity, five parameter, 410 comment and 16 size findings.
[The dispositions](review/habit-dispositions.md) and
[per-location inventory](review/habit-dispositions.json) account for every one.
Explicit per-operation arguments keep call state off shared services; security and
uncertainty comments explain real contracts; cohesive source/test owners stay
intact. The new non-null assertion and two stale comments were corrected. No
unresolved correction remains and snooze is `[]`; this is not a zero-finding claim.

## Architecture provenance and manager review

[Before registry](https://github.com/tomer-mayara/Thermus/blob/0ff3f6cdde5be4124df0ed2ab002844d5db1c502/architecture/components.md)
and [after registry](https://github.com/tomer-mayara/Thermus/blob/2271545702a8f1ec28c6f7dd913fec7024ecadeb/architecture/components.md)
are pinned. All 15 views were inventoried; only hosted membership removal and
system/audit logging changed. No component set, dependency pair, container,
datastore, provider or deployment topology changes. Existing web→organizations
and web→audit-logs edges get removal use; that is not a new source dependency.

The single main-description comparison is exact `architecture/comparison-v5.mmd`,
a supplementary L3 view reconstructed from code and registry prose. Hosted Node
server owners stay inside one container; PostgreSQL and WorkOS are supporting
peers. Stable relationships remain neutral; changed responsibilities are amber;
new removal calls are green. Adjacent notes retain current authority, exact target,
30-second/ten-page inherited bounds, single dispatch, durable uncertainty, capture
order and safe navigation. Capture follows the coordinator outcome and precedes
HTTP response; it does not prove receipt or settle a hold. Existing directory,
store, provider, queue and export lifetimes remain.

L4 is omitted. The strongest changed contract is AuditLog.administrationChanged's
removal payload, alongside the exact bounded parser and overview hint. L3 plus
notes answers who owns tenant authority, input validation, completion and replay.
A function-level diagram would repeat fields without clarifying another boundary.
Unchanged callers were traced; valid invitation events, customer sending, current
portal/MCP access and identity-only recovery retain their contracts.

All three final diagrams parse and render at 800px. The manager inspected labels,
title clearance, bounds and arrow targets, then approved fixes to capture-arrow
crossing and app composition/title spacing. Embedded registry sources, render
inputs and PNG/SVG hashes match; the PR embeds the exact approved comparison.
[Final provenance](architecture/final-provenance.json),
[manager review](architecture/manager-review.md), versioned drafts and earlier
renders retain that history. The manager also reviewed delegated source/tests,
fixed the reauthentication test to follow the emitted link, and inspected the
real narrow browser screenshot. [Independent review](review/final-independent.md)
is agent source/test review, with its execution limits stated. It supplies no
human approval. Final source hashes match the reviewed source; no deployment or
migration is claimed.
