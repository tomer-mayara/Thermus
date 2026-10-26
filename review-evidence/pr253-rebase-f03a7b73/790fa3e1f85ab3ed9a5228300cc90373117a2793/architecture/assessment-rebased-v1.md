# Rebased architecture assessment v1

Base: `f03a7b73b2c27dc26477d5378a3356f28744a367`. Reviewed gate head:
`fa5d4d7f57ef270df2a056ad523ec22e3b5032b6`. Main at review:
`8c6d204e8588a664438ba8934ab36670b802525f`. These are code-review pins, not a claim
that later document/metrics commits have been checked. The manager must refresh
final provenance before publication. The new parent is the actual merge base.

## Reconstruction and scope

Read AGENTS.md, coding principles, the component registry workflow, report and
architecture rules. Reconstructed the increment from old parent/head source,
new parent/current source, contracts, composition and test specifications, then
checked earlier drawings and immutable artifacts. The current parent adds Audit
actor display metadata, captured event timestamps and bounded pending snapshot
events; those are inherited. They do not add removal behavior or repair R1.

All 28 source, test and SQL paths in the original S2.5-01b increment are byte-equal
to the original head. `increment-source-test-equivalence.json` records each hash.
No source behavior was changed by this worker, and no test or live call was run.
The parent and current registry retain those inherited Audit changes. The close
conflict now records both snapshot pending-content cleanup and removal-first
shutdown. The plan conflict retains the internal rollout status and treats old
validation as historical. Exact conflict stages and decisions are retained.

## Owners and relationships

- Organizations owns current authority, target facts, last-Admin decisions, removal
  lifetime, intent/result/store contracts, and safe recording. Private coordinator,
  checks and lifetime modules are parts of this existing component.
- Audit-logs implements the store contract in its existing SQL adapter. App supplies
  the same object and bounded pool for destination settings and removal. Admission
  is one conditional upsert keyed by organization. It replaces only a terminal row.
  Completion scopes organization, operation and outcome, preventing stale settlement.
- Organizations calls the supplied adapter at runtime. Audit-logs imports its type
  contract from organizations on the existing allowed type edge. Runtime calls and
  source dependencies have different directions; no new owner edge is introduced.
  App's existing construction dependencies are omitted from the focused view where
  they do not explain the change.
- WorkOS keeps the exact-ID delete operation already present in the new parent.
  Removal is its new caller. Optional neutral read signals guard each remote read
  substep; existing callers omit them. Signals stop later work, not sent HTTP.
  Current target reads and member pages still fetch email. That retained display
  work causes the known R1 availability/hold defect.
- No browser or MCP route invokes removal in this increment. Existing member display,
  invitation, signup, access and Audit paths remain. `ChangeRecording.record` becomes
  public and bounded removal outcomes join `ChangeOutcome`; invitation results keep
  their meaning. Customer Audit removal capture remains in S2.5-01c. The new parent's
  optional display name is not removal authority.

## Authority, order, outcomes and resources

Current Admin authority is checked before SQL. Post-admission checks reread actor,
exact target and revision, ordinary management, all grants and active pages. Later
duplicate IDs win. Direct and paged target facts must agree; a usable Admin must
remain and the actor must still have Admin grants. Ten pages bound the active scan.
SQL clients are released before provider HTTP. No SQL transaction spans the provider.

Before admission, failure/stop returns unavailable without dispatch. Uncertain
admission returns unknown and sends nothing. A possible provider effect remains
held. A known pre-send refusal or proven provider outcome can settle only the same
operation. An uncertain final write needs its matching terminal receipt; absence,
pending, wrong organization, replacement or mismatch cannot prove completion.
Pending intent has no lease or expiry. Current Members reads do not clear it.
Independent provider/operator writes remain outside the serialization guarantee.

The 30-second monotonic owner lifetime is independent of browser disconnect. Its
signal prevents later remote read substeps. Sent SDK calls keep the existing
five-second timeout and zero retries. Expiry/close prevents deletion and new
completion work, but cannot undo a sent request. A terminal SQL write already in
flight may commit its own receipt after the public caller receives unknown.
Administration closes before snapshots, Collector and SQL; MCP cleanup runs in
parallel. Parent snapshot content is cleared at close. Durable settings, pending
intent and terminal receipts survive; export queues remain memory-only.

The migration is additive in the existing private PostgreSQL datastore and uses
the existing connection/configuration. Runtime remains SELECT/INSERT/UPDATE, no
DELETE/DDL, with forced RLS and no API-role access. These are source/migration
facts, not fresh live grant evidence. Missing SQL stops removal without making
product or MCP access depend on SQL. Local edition topology remains unchanged.

## Registry inventory

There are 15 Mermaid blocks at the gate head and 13 at the actual parent. All
parent Mermaid bytes match the old parent's sequence; all current bytes match the
old complete head. Eight views remain unchanged. Hosted containers, hosted auth,
Audit storage and collaboration change; the combined deployment block becomes
separate local/hosted views, and membership removal gains a focused view. The
checker reports this as two added and five edited views, as before. The split
changes presentation; topology is unchanged. Both deployment alternatives retain
the recorded-target/live-evidence limits. Parent Audit changes are prose only.

| # | View | Gate-head lines | Disposition |
| --- | --- | --- | --- |
| 1 | Context | 30–47 | Unchanged bytes |
| 2 | C4 containers: hosted edition | 61–86 | Added or edited; parsed, rendered, inspected |
| 3 | C4 containers: local edition | 95–116 | Unchanged bytes |
| 4 | Selected C4 components: tool processing in the Node server | 146–175 | Unchanged bytes |
| 5 | Selected C4 components: hosted authentication in the Node server | 198–222 | Added or edited; parsed, rendered, inspected |
| 6 | Selected C4 components: hosted membership removal in the Node server | 263–281 | Added or edited; parsed, rendered, inspected |
| 7 | Selected C4 components: hosted Audit logs settings and delivery in the Node server | 329–346 | Added or edited; parsed, rendered, inspected |
| 8 | Selected C4 components: system and audit logs in the Node server | 414–430 | Unchanged bytes |
| 9 | Selected C4 components: local authentication in the Node server | 654–673 | Unchanged bytes |
| 10 | Collaboration overview | 701–731 | Added or edited; parsed, rendered, inspected |
| 11 | Scenario: MCP page fetch and renderer cancellation | 773–825 | Unchanged bytes |
| 12 | Scenario: hosted default sign-in landing | 844–890 | Unchanged bytes |
| 13 | Scenario: hosted member read | 911–971 | Unchanged bytes |
| 14 | Self-hosted Compose | 1042–1056 | Added or edited; parsed, rendered, inspected |
| 15 | Recorded hosted Render target | 1067–1088 | Added or edited; parsed, rendered, inspected |

Source-owner mapping, runtime/member-read scenarios, context, shared Audit capture,
container/deployment choices and behavior/resource text were checked. The unchanged
member-read sequence remains a display read and makes no removal claim.

## Callable contracts and L4 decision

The strongest changed callable is `OrganizationAdministration.removeMember(actor,
request)`. Review question: who owns current authority and exact target checks,
when can deletion occur, and what proves completion after uncertain storage/provider
work? The new `RemovalOperationStore` callable contract also names admit/read/complete
results. L3 plus the four adjacent behavior notes answers that question at the
real component owners, including durable hold, receipt and lifetime rules. L4 would
repeat private phase helpers, so omit it. The optional directory stop contract is
covered at WorkOS and the lifetime notes. Declaration diffs are saved; this is an
observable internal callable contract change, not a claim of no contract change.
No new ADR is required by this narrow rebase.

## Rendering and source binding

`main-comparison-rebased-v1.md` embeds `comparison-rebased-v1.mmd` byte-for-byte.
That source equals the prior final comparison; its meaning was rechecked against
the updated parent before accepting it. All seven embedded changed registry sources
match the earlier final sources byte-for-byte. Fresh offline parsing and rendering
was performed for these seven diagrams plus the comparison, avoiding reuse of old
pixels. `render-inputs.json` binds the source hashes; `renders-v1/render-report-v2.json`
records Mermaid/Playwright/browser versions, asset hash, SVG/PNG hashes, dimensions
and no external requests.

Fresh inspection at native 800 px passed all eight images: labels are readable,
titles clear, scope boundaries and arrow targets correct, and no observed crossing
through labels or unrelated boxes. Neutral label backgrounds remain. Short labels
retain exact protocol/ownership details in adjacent prose. Registry links resolve.
Manager review of these fresh artifacts remains required.

## Review and limits

Architecture facts remain: a new public store module, declarations changed in
three existing public modules, and registry views changed. No component-set or
source-edge addition. The semantic flags remain deployment/recovery, component
responsibility and internal interface; sensitive behavior and policy also apply.
T2 Need architect remains required. This is a semantic assessment; the manager's
fresh full checker supplies the canonical result and complete candidate blockers.

S2.5-R1 remains open in this PR and must stay beside the main comparison. The later
PR #257 repair is outside this rebase. The prior controlled reproduction shows an
availability/held-operation defect, not a last-Admin bypass or production benchmark.
Old pass evidence stays historical. Fresh complete-candidate checks, parent
integration, R1 resolution in this PR, and independent authorized human architect
approval remain holds. No agent review supplies that approval. No release, migration,
provider change, deployment, restore or live removal was performed.
