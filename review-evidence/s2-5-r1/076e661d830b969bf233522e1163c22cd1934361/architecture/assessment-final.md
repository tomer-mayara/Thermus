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
`provenance-final.json` and its two final inventory files.

The main summary alone embeds `summary-comparison-final.md`. Its standalone
`comparison-final.mmd` is byte-identical to reviewed v2 and to the embedded block.
The existing 800×753 PNG/SVG and parse/render report remain valid: same Mermaid
and registry bytes, effective font 17.3px, no external requests. Labels, title,
boundaries and arrows passed worker and manager inspection. Original working
sources/reports are preserved; `render-report-final.json` binds the reused render
to this candidate. No redundant render/build/test/metrics/cloud action ran here.

Strongest callable: `OrganizationDirectory.memberFactsPage`. L3 plus the four
behavior notes and field/failure/stop/page tests answer the review question above;
L4 would repeat adapter internals. No ADR is required by this scope. Manager
review covered source, v2 and browser image, then explicitly reviewed the later
source-free status docs and test existence guard. Source hashes match reviewed
v2; only that test guard differs among the prior code/test evidence. No new
defect found. Independent authorized human architect approval of this exact
candidate is still required; agent review is not that approval. Fresh metrics
and final checker remain the manager's maintained records. Publish retained
artifacts with accessible links; cache paths alone are not publication evidence.

</details>

Machine-readable binding: `provenance-final.json`. Manager review binding: `manager-review-final.md`.
