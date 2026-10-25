# R1 architecture assessment — draft v1

Actual parent and merge base: `0530dd634fe8302b55d4a0669463ef733199cc40` (PR #255). Draft head: `1a192d743a4c71ae6faebfd00f7ae6fd4c72ea0e` plus the working tree. No final candidate SHA is claimed. `origin/main` currently resolves to `581f30cfaa32b01399422b087b0f0bdc3b800f70`; it is not the R1 comparison base. The newer main Audit features are outside this increment. This assessment describes implementation on the R1 branch, not released/main-current behavior.

## Reconstructed delta

Before consulting earlier PR drawings, read the parent's and working source contracts, WorkOS adapter, removal checks, generic page reader, removal coordinator/lifetime and registry. The directory public module gains `OrganizationMemberFacts` and `memberFactsPage(MemberPageRequest): Promise<Page<OrganizationMemberFacts>>`. `OrganizationMember` retains the same fields by extending the facts type and adding email. The only intended new runtime caller is the removal scan. Source changes are still in progress, so this draft is not completion evidence.

Classification: `internalInterface=true` because an existing within-container directory interface and Organizations/WorkOS collaboration change. `sensitiveBehavior=true` records changed work in sensitive removal preflight with the same authorization and integrity guarantees. Other flags are false: no C4 container, external integration, client/cross-container observable contract, deployment, shared state, architecture-wide pattern, component responsibility, dependency package or development policy changes. Public declaration fact d is expected; manager will regenerate/check snapshots. Expected tier: **T2 Need architect**, pending independent current-candidate human architect approval and all selected gates.

## Supplementary L3 comparison

The source is `comparison-v1.mmd`. It is derived from source and registry prose. Components retain the same owners and L2 container. Red removes the display operation from the safety caller only; `memberPage` itself remains. Green adds the facts operation to that caller. Neutral relationships survive. Methods are arrow labels, not new components.

1. Before, the complete active-member safety scan called `memberPage`, which read each member's email in sequence. After, `memberFactsPage` returns the same membership ID, subject, organization, status, management evidence, every grant and revision, with no user enrichment. WorkOS still reads memberships and the current role catalog for each nonempty page.
2. The direct `member()` target read and Members display/seat reads retain their current email path. The direct/page safety comparison excludes email, keeps sorted full grants and permissions, and remains sensitive to identity, scope, status, management and revision. The known display role/default/missing-management fail-closed rules remain.
3. The same generic page reader retains ordered pages, newest duplicate handling, repeated-cursor failure and the ten-page safety limit (WorkOS page size 100). Current actor authority is checked again after scanning; last-Admin and all pre-dispatch refusals still belong to Organizations. These are current remote reads, not a provider transaction.
4. Durable admission precedes the scan; only exact-ID deletion follows successful safety checks. Matching receipt completion, unknown effects, no automatic hold release/replay, 30-second monotonic lifetime, stop checks around remote reads and existing SDK/SQL bounds remain. Removing avoidable enrichment does not promise that every 1,000-member organization completes in 30 seconds.

Retained composition and remote work omitted from the focused drawing: app/web request gates and lifetime wiring, audit-logs SQL admission/receipts and best-effort capture, actor membership reads, direct target lookup, role-catalog mapping, and exact delete. No L2 or deployment change. No new ADR is required by the present task; an authorized decision maker may require one.

## Registry and L4

Every registry Mermaid block is inventoried in `inventory-parent.json` and `inventory-working-v1.json`; compare content hashes, not block order. Expected affected checked views: Context; hosted containers; hosted authentication components; hosted membership-removal components; collaboration overview; hosted member-read scenario; behavior/resource ownership; deployment. Registry drawings remain accurate because source owners, roles, component relationships and process/datastore boundaries stay. Add facts/display detail to the membership-removal prose; do not edit Mermaid to create needless diagram fact e.

Strongest changed callable contract: `OrganizationDirectory.memberFactsPage`. Review question: does the new safety read preserve every decision fact and failure/stop/pagination rule while avoiding per-member user reads? L3 plus the four behavior notes and narrow contract/adapter tests answer this question. Omit L4 because additional internal call detail would repeat the existing adapter's field mapping and page rules without resolving another boundary question. Acceptance regression uses the real adapter/coordinator; ready-made facts doubles alone cannot establish that user enrichment is absent.

## Pending evidence

Render and inspect v1 at 800px, check embedded Mermaid byte identity, refresh for stable source, retain parent/final code paths with line bounds, manager review and final candidate pins. No green result, completed repair, current human approval or release is claimed here. Source worker owns red/green evidence; manager owns complete-candidate checks, metrics and final declaration snapshots.
