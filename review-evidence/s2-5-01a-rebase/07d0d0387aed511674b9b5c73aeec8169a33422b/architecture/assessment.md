<details>
<summary>Architecture assessment and comparison provenance</summary>

Candidate: `07d0d0387aed511674b9b5c73aeec8169a33422b`. Trusted main merge base:
`581f30cfaa32b01399422b087b0f0bdc3b800f70`. This is PR #251, compared as a
complete candidate against main. Its direct base is main. The final source-free commit changes the implementation rebase note and adds the immutable base metric record. All 18 reviewed code/test/registry evidence file hashes remain identical to the source-reviewed candidate `e1e55dc04f5afa1e46eab5946067683fa496aaa6`. The new note marks old-head results historical and keeps live/container results and required human approval in the maintained comments. `final-pin-review.json` records the bounded document review; this worker ran no tests.

Fact d changes the existing organizations-owned public directory declaration by
+6/-0 lines: `MembershipManagement`, `OrganizationMember.management`,
`MembershipDeletionResult`, and `OrganizationDirectory.deleteMembership`.
`internalInterface` declares this callable/input-output change and requires T2;
`sensitiveBehavior` declares membership deletion and unknown management evidence
and requires T1. Use the highest tier, T2 Need architect. There is no added
component, source dependency edge, public module, container, provider, datastore,
or deployment change. The raw reader remains inside the workos owner; app binds
it through the existing WorkOS client. Its construction is separate from the
organizations-owned role and from calls made through that role.

All 13 registry Mermaid blocks match the base byte-for-byte, in the same order.
The two inventory files name and hash every view. The worker read the full
registry and checked Context, hosted containers, hosted authentication,
collaboration overview, default sign-in landing, member read, source-owner
mapping, ownership, behavior/resource rules, and deployment. Unaffected local,
tool-processing, logging and rendering views remain accurate: this change adds
no process or relationship there. Only the member-read prose changes, at candidate
[lines 899–910](https://github.com/tomer-mayara/Thermus/blob/07d0d0387aed511674b9b5c73aeec8169a33422b/architecture/components.md#L899-L910).
[Base registry](https://github.com/tomer-mayara/Thermus/blob/581f30cfaa32b01399422b087b0f0bdc3b800f70/architecture/components.md)
and [candidate registry](https://github.com/tomer-mayara/Thermus/blob/07d0d0387aed511674b9b5c73aeec8169a33422b/architecture/components.md)
remain current maps. The comparison in the main description is a supplementary
L3 view derived from prose and code, not an edited registry view.

The [contract](https://github.com/tomer-mayara/Thermus/blob/07d0d0387aed511674b9b5c73aeec8169a33422b/src/accounts/organizations/organization-directory.ts#L88-L113)
adds an exact-ID operation and leaves admission and safety to the caller. The
[adapter](https://github.com/tomer-mayara/Thermus/blob/07d0d0387aed511674b9b5c73aeec8169a33422b/src/accounts/providers/workos/workos-organizations.ts#L165-L173)
performs no membership reread or alternate deletion. A normal void completion
means applied. Only status 422 with code
`organization_membership_directory_managed` means unsupported and proves no
effect. Other errors retain their identity and throw with unknown effect. The
new operation has no application caller: a repository-wide production search
finds only its contract and implementation. No browser route or administration
method gains removal. Thus this slice has no admission/serialization/current
actor/last-Admin authorization, receipt, storage, or recovery mechanism. Later
slices own those requirements; the controlled-wire acceptance tests are not
live deletion evidence. S2.5-02 remains the release hold.

The [raw reader](https://github.com/tomer-mayara/Thermus/blob/07d0d0387aed511674b9b5c73aeec8169a33422b/src/accounts/providers/workos/workos-organizations.ts#L399-L430)
uses the shared SDK transport to retain missing/null/invalid management facts
before SDK normalization. One GET retains each operation's filters, cursor,
limit, order, role slugs and metadata. Membership IDs are encoded as one path
segment and dot segments fail before transport. Explicit false maps to ordinary,
true maps to external, and every other value maps to unknown. The
[revision](https://github.com/tomer-mayara/Thermus/blob/07d0d0387aed511674b9b5c73aeec8169a33422b/src/accounts/providers/workos/workos-organizations.ts#L326-L344)
includes normalized management along with timestamp, status and sorted grant
slugs. Member/page records retain all current grants. Their existing sequential
user display reads and role-catalog reads still occur; one membership GET does
not mean one remote request for the complete member operation.

The [composition](https://github.com/tomer-mayara/Thermus/blob/07d0d0387aed511674b9b5c73aeec8169a33422b/src/app/hosted-workos-application.ts#L128-L147)
keeps both the raw membership reader for WorkOSOrganizations and upstream
`userManagement` for WorkOSAuthProvider's optional actor-name read. The
[connection](https://github.com/tomer-mayara/Thermus/blob/07d0d0387aed511674b9b5c73aeec8169a33422b/src/app/hosted-workos-application.ts#L80-L94)
keeps zero retries and the five-second request timeout; the reader adds no client
or lifetime. Existing callers retain their authority and role checks:
OrganizationAdministration uses memberships for organization selection,
authorization and billing; directory-reads uses member pages for complete
administration reads; WorkOSAuthProvider uses active grants; signup checks
existing memberships. The administration overview continues to filter display
roles and seat counts, and it does not add management to its public projection.
The revision field can change because management now participates in its hash.
No cross-container browser/MCP removal contract is added. Billing, identity,
web route composition, signup and role-catalog neighbors are omitted from the
focused drawing; their retained relationships are described here and in the
registry.

Strongest changed callable: `OrganizationDirectory.deleteMembership`.
Review question: can it affect only the named membership, and can a caller
distinguish proven no effect from uncertain effect? The L3 view locates the
contract and adapter; the main description's behavior notes state exact target,
outcomes, failure phase and delivery limits. The contract, unit specification,
controlled-wire acceptance specification and connection specification make the
answer explicit. An L4 drawing would repeat those short operations without
answering a further question, so it is omitted. The raw reader is internal to
workos; it does not create another component or authorize removal. No ADR was
requested for this bounded extension.

Diagram v7 is the authoritative standalone source and matches the embedded
Mermaid block byte-for-byte. Existing mmdc 12.0.0 parsed and rendered SVG/PNG
with the retained configuration. The PNG is exactly 800 × 1195. Worker visual
inspection at normal width passed title clearance, labels, boundaries, arrow
targets and crossings. Neutral label backgrounds stay readable. Green text
marks added contracts inside existing owners; amber marks changed meaning;
no operation is removed. The first command used unsupported `-w`; the corrected
`--size` commands passed. Drafts v1–v6 are retained, with v7 improving height
and keeping labels inside the boundary. No dependency was added.

The worker made no production, test, tracked document, branch, PR, or external
service change, and ran no tests. New-base test/metric/gate results belong in
the maintained Validation and Quality review comments. Old-head pass claims
are stale. `provenance-final.json` binds all source hashes and checked line bounds;
`render-report-final.json` binds source and render hashes. These records are
retained with the review evidence linked from the PR.
The manager inspected v5 at 800px and found labels, title, boundaries and arrows clear. The manager requested shorter composition/remote labels, a neutral SDK edge, a raw GET-before-default label, no prose legend, and separate tier/reason lines. Compact v7 applies each request, was rerendered, and passed worker visual inspection at 800 × 1195. The manager then inspected compact v7 at 800px and approved readable labels/title, correct boundaries/targets, neutral SDK edge, distinct relation kinds, no unrelated crossings, and the L3-plus-notes rationale for no L4. See `manager-review-final.md`, pinned to Mermaid SHA-256 `a60f5fdbf0e7f60de9c6a3b2daffc744c1b94394df1c3a9eff6a2ffd7ec5cbfc`. Independent authorized human architect approval of
the final candidate remains required; agent review does not provide it.

</details>
