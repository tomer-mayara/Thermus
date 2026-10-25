## Quality review

Candidate: `076e661d830b969bf233522e1163c22cd1934361`. Actual parent/merge base: `0530dd634fe8302b55d4a0669463ef733199cc40` (PR #255). Full-main process base: `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`; newer main `581f30cfaa32b01399422b087b0f0bdc3b800f70` is not integrated by this repair.

**T2 Need architect**
Architecture: T2: declarations changed in 1 public module.
Reasons: `architecture.declarations_changed` and `internalInterface` require T2; `sensitiveBehavior` also requires T1. The highest tier applies. The [checker](metrics/pr-review.json) has no local blockers and preliminary local eligibility. **Overall merge remains blocked** by required independent authorized human architect approval of this candidate and parent-stack integration. No approval or de-escalation is claimed. The main description owns the single authoritative comparison and folded declaration diff.

The [committed impact](candidate/.pr-impact.json) declares only `internalInterface` and `sensitiveBehavior`. The new operation changes collaboration between existing Organizations and WorkOS components. Current actor authority, complete current grants, raw management evidence, direct/page agreement, last-Admin checks, exact deletion, durable admission/receipts, unknown holds, no replay and existing lifetime bounds remain. Email enrichment leaves only the safety scan. No client/cross-container contract, component, dependency, schema, deployment, recovery, provider setting or policy change is introduced. This is the answer to the sensitive-behavior and interface policy questions; no new ADR is needed for this narrow existing-boundary change.

### Metrics and simplicity

The [full process](metrics/process.md) completed all four sections. Delta, Review and full-main CRAP report retained goal misses; Architecture passed. These are complete reports, not tool failures. [Every finding and reason](review/metric-dispositions.json), the [concise review](review/metric-dispositions.md), [native review](metrics/review.json) and [actual-parent CRAP](metrics/crap.json) retain exact scope and provenance.

- Removal checks stay at file MI **61.02**, with complete safety ordering in one owner. The type-only directory has no runtime MI.
- WorkOS file MI moves **47.08 → 45.14** against the actual parent. The native **53 → 45** finding compares the full stack with main. Keep one provider interpretation owner and one shared facts projection; a generic reader or separate guard files would obscure the facts/display boundary. The new page has three paths and the projection one.
- All **14 machine-classified changed/new function rows** have measured **100% own-character coverage** and meet their goals: maximum CRAP **9 changed / 3 new**. Machine identity classifications, including unchanged callbacks conservatively called new, are retained without claiming new authorship.
- The full-main report retains 30 findings: six high, 16 medium, eight low. Inherited lifetime, coordinator, SQL adapter and SDK-test reasons are linked with hashes. The new high in the ignored cache evidence packager reflects explicit inventory/path/candidate guards; it is outside the committed production candidate. All locations and reasons remain in the report.
- Full-main coverage-mapping gaps remain `composeLoggingStorage` [1,2] and `encodeAuditEvent` [4,20]; neither changes here. The encoder's inherited bound-20 exception expires 2026-12-23. `eventAttributes` 16 is an inherited advisory target miss below the changed-function limit. No exception is added, expanded or used for this increment.

The native global dependency report retains a pre-existing unresolved CSS import and withholds its edge/cycle delta. That limits the native report alone. The authoritative checker and manual review of all changed imports establish this increment's unchanged edge set; no UI/CSS import changes. Global unknown coverage bands and historical coverage estimates stay explicit in the full process report.

Checker information is fully disposed in the linked metric review: 49 public modules with one changed snapshot; import-dependent declarations for `administration-overviews` (two paths), `customer-roles` and `organization-administration` remain identical. Transitive type touch does not itself change their public behavior. The WorkOS MI note uses the full-main baseline as explained above; local eligibility is preliminary and never supplies human approval.

### Habit Hooks and review

[Final Habit Hooks](checks/habit-hooks-final.log) reports 465 retained findings: seven complexity, five parameter, 436 comment and 17 size findings. Exit 1 reflects those retained findings, each with a [per-location reason](review/habit-dispositions.json) and [review](review/habit-dispositions.md). One new non-null assertion was fixed with an explicit existence check; its 19 cases and final ordinary suite passed. Snooze remains `[]`. Initial findings and correction history are retained. Existing size/complexity findings preserve cohesive safety/provider/test owners; the new contract comment states a network-work constraint absent from its return type.

The manager reviewed the implementation worker's BDD/TDD record and code, the independent domain review, final metrics dispositions, status documentation, source/input binding, 800px diagram and browser screenshot. [Manager sign-off](review/manager-review-final.json) and [domain review](review/review-domain.md) record that scope. No new defect remains in the repair. Agent review is not independent human approval. Removal stays unreleased and S2.5-02 is not Done; its release/owner ledger remains authoritative.

<details>
<summary>Architecture assessment and comparison provenance</summary>

Candidate: `076e661d830b969bf233522e1163c22cd1934361`. Actual parent/merge base: `0530dd634fe8302b55d4a0669463ef733199cc40` (PR #255).
Compare/classify this R1 increment against that parent. The complete-stack main
merge base is `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`; newer main Audit features remain
separate. This branch implements the repair; removal remains unreleased and
S2.5-02 is not Done.

The public [directory contract](https://github.com/tomer-mayara/Thermus/blob/076e661d830b969bf233522e1163c22cd1934361/src/accounts/organizations/organization-directory.ts#L101-L123) adds
`OrganizationMemberFacts` and `memberFactsPage`. The extending display record
retains its fields; the [declaration snapshot](https://github.com/tomer-mayara/Thermus/blob/076e661d830b969bf233522e1163c22cd1934361/docs/api-surface/src/accounts/organizations/organization-directory.d.ts#L1-L74)
changes in this existing public module only. Review meaning: the new operation
must preserve every safety fact and failure/stop/page rule while avoiding
per-member user reads. [Before checks](https://github.com/tomer-mayara/Thermus/blob/0530dd634fe8302b55d4a0669463ef733199cc40/src/accounts/organizations/membership-removal-checks.ts#L1-L55)
called display pages; [after checks](https://github.com/tomer-mayara/Thermus/blob/076e661d830b969bf233522e1163c22cd1934361/src/accounts/organizations/membership-removal-checks.ts#L1-L55) call facts.
The [WorkOS operation](https://github.com/tomer-mayara/Thermus/blob/076e661d830b969bf233522e1163c22cd1934361/src/accounts/providers/workos/workos-organizations.ts#L149-L174) uses the
same mapping/scope guards. Direct target, display/seat reads, current actor,
last-Admin, pagination, exact delete, receipts and lifetime retain their rules.
No component/edge/public-module set, L2/deployment, external integration setting,
client/cross-container contract or recovery change. Impact declares
`internalInterface` and `sensitiveBehavior`; complete checker results stay in the
maintained Quality review.

All 15 registry Mermaid blocks match the actual parent byte-for-byte. Focused
[registry prose](https://github.com/tomer-mayara/Thermus/blob/076e661d830b969bf233522e1163c22cd1934361/architecture/components.md#L299-L322) records
facts versus display; [before registry](https://github.com/tomer-mayara/Thermus/blob/0530dd634fe8302b55d4a0669463ef733199cc40/architecture/components.md)
and [after registry](https://github.com/tomer-mayara/Thermus/blob/076e661d830b969bf233522e1163c22cd1934361/architecture/components.md) remain current
maps. Checked context, hosted containers/authentication/removal components,
collaboration, Members display runtime, behavior ownership and deployment.
The inventory and verified before/after source/test/doc bounds are in
[final provenance](architecture/provenance-final.json) and its two final inventory files.

The main summary alone embeds `summary-comparison-final.md`. Its standalone
`comparison-final.mmd` is byte-identical to reviewed v2 and to the embedded block.
The existing 800×753 PNG/SVG and parse/render report remain valid: same Mermaid
and registry bytes, effective font 17.3px, no external requests. Labels, title,
boundaries and arrows passed worker and manager inspection. Original working
sources/reports are preserved; [final render report](architecture/render-report-final.json) binds the reused render
to this candidate. No redundant render/build/test/metrics/cloud action ran here.

Strongest callable: `OrganizationDirectory.memberFactsPage`. L3 plus the four
behavior notes and field/failure/stop/page tests answer the review question above;
L4 would repeat adapter internals. No ADR is required by this scope. Manager
review covered source, v2 and browser image, then explicitly reviewed the later
source-free status docs and test existence guard. Source hashes match reviewed
v2; only that test guard differs among the prior code/test evidence. No new
defect found. Independent authorized human architect approval of this exact
candidate is still required; agent review is not that approval. Fresh metrics and the final checker are recorded above. [Comparison source](architecture/comparison-final.mmd), [800px render](architecture/renders-v2/comparison-v2-800.png), and the [architecture assessment](architecture/assessment-final.md) are retained as accessible artifacts.

</details>
