# S2.5-R1 minimum repair scope

Reviewed SHA: `806ccc573c6ae09c411a47a755d6dd9316343f8f`.
No tracked file or source change was made for this review.

## Minimum contract change

Add one facts-only page operation to the existing `OrganizationDirectory` contract. Reuse `MemberPageRequest` unchanged: organization, explicit statuses, cursor and optional stop signal. The return is the existing `Page<T>` with a facts type that contains exactly the current `OrganizationMember` fields except email: membershipId, subject, organizationId, status, management, every grant and revision.

The clearest small type shape is `OrganizationMemberFacts` for those fields and `OrganizationMember extends OrganizationMemberFacts` with email. An equivalent `Omit<OrganizationMember, 'email'>` is technically sufficient; do not create a new module or parallel directory interface merely for the type. Example operation name: `memberFactsPage(request): Promise<Page<OrganizationMemberFacts>>`. It is an explicit operation, not a display/enrichment boolean.

Change only the removal scan to use this operation. Its support predicate and snapshot/refusal helpers can take the facts type; full `OrganizationMember` records still satisfy it. Keep the existing general pagination helper, latest-record handling, ten-page bound and all safety comparisons. Keep Members display, seat counts and other existing callers on their current contract unless a separate requirement justifies moving them.

WorkOS facts pages must list memberships once per page, check organization/status response scope, get the current role catalog, retain every role, map management evidence, compute the same revision, and return the cursor. They must make no getUser call. Keep stop checks around each remote read. Use the existing raw membership reader and existing SDK client limits. The adapter can reuse a small per-record facts calculation where that avoids a second implementation of management/grant/revision rules; do not introduce a generic reader framework. Display pages must still supply current emails through their established contract.

## Direct target read

Leave `member(membershipId, signal)` unchanged. It makes one email lookup, a constant cost, and gives the direct current target whose immutable safety snapshot is compared against the later complete pages. This repair removes the N-dependent email work without adding a second direct-target API. The target's email remains irrelevant to the safety comparison. A broader email-free direct read may be considered separately; it is not required to fix the reproduced failure.

## Required behavioral coverage

Start with a BDD case through the public removal operation that reproduces the current 100-member, 300-ms-per-getUser failure. After repair it must report applied, persist the exact terminal receipt, delete only the intended membership, and leave the Admin. Time is in milliseconds on both monotonic and fake timer clocks. The fixture must route through the real WorkOS adapter; an organizations-only double that returns ready-made facts cannot prove removal has eliminated provider enrichment. Reuse the existing controlled provider and durable-store acceptance composition where practical; keep narrow adapter/provider collaboration tests in the integration group under repository definitions.

Then specify the narrow provider boundary: explicit organization/status filters, cursor, every raw role and management state, same revision semantics, current role mapping, no user enrichment, scope failures, failed later pages, and signal stop before subsequent reads. Do not just assert that the new method was called.

Retain the behavioral last-Admin and stale-target cases with decisive facts on later pages. Redirect mocks that currently pause or alter `memberPage` to the new facts operation for removal tests; otherwise a stale test seam can stop exercising the intended race/failure. Keep the existing member/display email and enrichment-stop cases on the display path. Cover direct target vs facts-page equality for all safety fields and reversed grant order. Unknown extra roles and missing management evidence must still fail closed.

The controlled capacity case proves removal of this avoidable cost; it does not promise that every 1,000-member organization completes within 30 seconds. Role-catalog, membership and SQL work still has the same budgets. Do not add parallelism, caches, larger deadlines, automatic hold release, retry or recovery changes. Refresh the public declaration snapshot, impact declaration, registry assessment and required source checks under repository policy. The existing exported directory contract changes, so the repair requires current-candidate architecture review.

## Final inline finding

Best location: `src/accounts/organizations/membership-removal-checks.ts`, line 24 only. That line introduces the display-oriented page into the safety path. Cite `src/accounts/providers/workos/workos-organizations.ts:154-156,262-266` as supporting evidence in the text. The defect is the collaboration, so a long inline range across the adapter is less clear.

Suggested title: `[P2] Read membership facts without per-member email enrichment`.
The precise impact is conditional and reproduced: with 100 active members and successful getUser calls at 300 ms each, the request reaches the 30-second limit before DELETE, returns unknown, leaves the durable row pending, and makes the next request busy. It is not a claim that provider traffic was timed in production.
