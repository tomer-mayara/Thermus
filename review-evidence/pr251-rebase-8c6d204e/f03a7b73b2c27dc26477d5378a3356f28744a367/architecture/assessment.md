<details>
<summary>Architecture assessment and comparison provenance</summary>

Final candidate: `f03a7b73b2c27dc26477d5378a3356f28744a367`. Trusted main merge base:
`8c6d204e8588a664438ba8934ab36670b802525f`. PR #251 is compared directly
against main. The source-reviewed candidate is
`fd7fa0b1e53d653f92168b75ba4d65618a9138a8`. Final source-free changes need the
pin refresh below before publication. This worker ran no tests.

The review started with current base/head code, contracts, callers, specifications,
and registry, before reading prior PR text. Fact d changes the existing
organizations-owned directory declaration by +6/-0 lines: `MembershipManagement`,
`OrganizationMember.management`, `MembershipDeletionResult`, and
`OrganizationDirectory.deleteMembership`. `internalInterface` declares the
within-container contract and composition change and requires T2;
`sensitiveBehavior` declares deletion and unknown evidence and requires T1.
The resulting review tier remains **T2 Need architect**. Independent authorized
human architect approval must cover the final head. Agent review cannot supply it.
The manager must use the final checker's exact Architecture reason and all other
reasons; this assessment does not replace that checker or final eligibility.

There is no new component, source edge, public module, container, external
provider, datastore, or deployment change. The existing app owner binds the raw
reader inside workos, through its existing client. The organizations owner retains
the directory contract and administration rules. Components and edges remain in
the existing trusted rules. No ADR was requested for this bounded extension.

All 13 registry Mermaid blocks match the base byte-for-byte in the same order.
The four inventories also prove equality with the prior base and candidate.
Checked affected and adjacent views are Context, hosted containers, hosted
authentication, collaboration overview, default sign-in landing, member read,
source-owner mapping, ownership, behavior/resource rules, and deployment.
Unchanged local, tool, Audit/logging and renderer views need no edit. The new
base adds three prose lines about captured Audit timestamps; those lines remain
present. Only member-read prose changes in this PR, at final registry lines
902–913. The registry stays a current map; the main summary's L3 comparison is
supplementary and derives from prose and code.

[Base registry](https://github.com/tomer-mayara/Thermus/blob/8c6d204e8588a664438ba8934ab36670b802525f/architecture/components.md)
and [final registry](https://github.com/tomer-mayara/Thermus/blob/f03a7b73b2c27dc26477d5378a3356f28744a367/architecture/components.md#L887-L934)
locate the unchanged owners and new prose.
[Base contract](https://github.com/tomer-mayara/Thermus/blob/8c6d204e8588a664438ba8934ab36670b802525f/src/accounts/organizations/organization-directory.ts#L81-L105)
and [final contract](https://github.com/tomer-mayara/Thermus/blob/f03a7b73b2c27dc26477d5378a3356f28744a367/src/accounts/organizations/organization-directory.ts#L88-L116)
show the exact-ID operation and caller-owned admission/safety rules.
[Base adapter](https://github.com/tomer-mayara/Thermus/blob/8c6d204e8588a664438ba8934ab36670b802525f/src/accounts/providers/workos/workos-organizations.ts#L145-L157)
has reads and invitation changes but no deletion callable.
[Final deletion](https://github.com/tomer-mayara/Thermus/blob/f03a7b73b2c27dc26477d5378a3356f28744a367/src/accounts/providers/workos/workos-organizations.ts#L165-L173)
makes one SDK call for the supplied membership ID. It does not read the target,
change another target, or repeat the write. Normal void completion reports
applied. Only status 422 plus `organization_membership_directory_managed`
reports unsupported and proves no effect. Every other error throws unchanged
with unknown effect, including a timeout, lost reply, or 404. A later absence
cannot convert that failure into success.

[Final raw reader](https://github.com/tomer-mayara/Thermus/blob/f03a7b73b2c27dc26477d5378a3356f28744a367/src/accounts/providers/workos/workos-organizations.ts#L399-L430)
uses the shared SDK transport before the SDK can default missing/null evidence
to false. Each membership GET/list preserves filters, cursor, limit, order,
role slugs and page metadata with one request. Exact-ID reads encode one path
segment and reject dot segments before transport. Explicit false maps to
ordinary, true to external, and all other values to unknown.
[Management and revision](https://github.com/tomer-mayara/Thermus/blob/f03a7b73b2c27dc26477d5378a3356f28744a367/src/accounts/providers/workos/workos-organizations.ts#L331-L344)
retain that normalized evidence along with the timestamp, status and sorted
role slugs. Member/page results retain every current grant. The full member
operation still performs role-catalog and sequential user display reads; one
membership GET does not mean one total remote request.

[Base composition](https://github.com/tomer-mayara/Thermus/blob/8c6d204e8588a664438ba8934ab36670b802525f/src/app/hosted-workos-application.ts#L128-L147)
and [final composition](https://github.com/tomer-mayara/Thermus/blob/f03a7b73b2c27dc26477d5378a3356f28744a367/src/app/hosted-workos-application.ts#L128-L147)
show the added reader binding and retained upstream actor-name binding.
The shared [client setup](https://github.com/tomer-mayara/Thermus/blob/f03a7b73b2c27dc26477d5378a3356f28744a367/src/app/hosted-workos-application.ts#L80-L94)
keeps zero retries and a five-second request timeout. No new resource or
lifetime is added. WorkOSAuthProvider still asks the directory for active grants;
its optional profile read still cannot grant access. OrganizationAdministration
still checks current memberships for selection, overview authority and billing.
Directory pagination remains bounded and complete. Signup's existing access
check still reads memberships. Administration overview projection keeps its
display-role and seat filters; it does not expose management. Its revision can
change when management changes. These unchanged callers were traced through
their public interfaces, beyond the three owners in the focused drawing.

A production search finds only the deletion contract and implementation, with
no application caller. No browser, administration, or MCP operation gains removal.
This boundary adds no admission, current-authority, last-Admin, serialization,
receipt, storage, or recovery rule. Later slices own those rules. Billing,
identity, web routes, signup and role-catalog neighbors are omitted from the
focused drawing; their retained relations remain in the registry. Controlled-wire
acceptance and connection specifications cover outcomes, exact targeting,
retained other membership/account/factors, unknown management and timeout/retry
rules. They do not establish live deletion proof. S2.5-02 remains the release hold.

Strongest changed callable: `OrganizationDirectory.deleteMembership`. Review
question: can it affect only the named membership, and can callers distinguish
proven no effect from uncertain effect? The L3 view locates the contract and
adapter; four behavior notes give the target, outcomes, failed write phase and
delivery limits. The short contract and specifications answer the question.
An L4 drawing would repeat that operation without explaining a further issue,
so it is omitted. The internal raw reader does not create a component or
authorize removal.

The source/test delta from prior head
`07d0d0387aed511674b9b5c73aeec8169a33422b` to the reviewed head is byte-identical
to the upstream source/test delta from prior main
`581f30cfaa32b01399422b087b0f0bdc3b800f70` to the new base: one Audit encoder
and three Audit test files. The encoder preserves the captured timestamp in
both time fields; it does not affect the membership boundary. All 13 focused
source/contract/specification files compared with prior head are unchanged.
The conflict choices retain PR impact intent and main's immutable
`docs/metrics/2026-10-25-581f30cf.json`; no product behavior was invented by
conflict resolution. The appended implementation note preserves both prior
validation histories and names the new base without claiming new checks.

The standalone Mermaid source is byte-identical to the prior approved v7 and
the prior published main description, SHA-256
`a60f5fdbf0e7f60de9c6a3b2daffc744c1b94394df1c3a9eff6a2ffd7ec5cbfc`.
Focused source/contract and all registry-view bytes prove semantic equivalence.
The retained mmdc 12 SVG/PNG and configuration hashes match the prior render.
The embedded source matches byte-for-byte. Fresh worker inspection of the
800 × 1195 PNG passes title clearance, label size, scope boundaries, arrow
targets and unrelated crossings. Composition, source and runtime arrows are
distinct; label backgrounds and the SDK edge stay neutral. Green marks additions
inside existing amber owners. No operation is removed. No new renderer run is
needed for identical source. Prior manager sign-off remains historical; fresh
manager sign-off of this rebase assessment is pending.

The prior complete evidence and initial remote PR history must remain linked
as history. Their test/metric passes do not establish this candidate's results.
Use the manager's new validation, metric and eligibility evidence for the final
head. This local cache is not an accessible GitHub evidence link. Publication
and readback belong to the manager.

</details>
