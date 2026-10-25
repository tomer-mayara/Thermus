# Architecture report handoff — v2

Working draft only. Parent/merge base: `0530dd634fe8302b55d4a0669463ef733199cc40` (PR #255). Planning head: `1a192d743a4c71ae6faebfd00f7ae6fd4c72ea0e` plus source/test/docs changes. Final commit is pending. Do not publish draft head as proof of the working changes.

## Main description material

Removal's complete safety scan used the WorkOS display path, including one sequential email read per member. R1 adds a facts page to the existing directory and changes only that scan. The direct target and display/seat reads retain email. The 100-member regression with 300 ms simulated user reads now uses one user lookup, deletes only the intended membership after admission, and checks its exact receipt while retaining the Admin. The store is a fake; PostgreSQL durability and live timing need their selected evidence.

Expected review: **T2 Need architect**. Final generated Architecture reason line belongs here after the checker. Fact d: one changed declaration, `organization-directory.d.ts`, adds `OrganizationMemberFacts` and `memberFactsPage`; the display record's existing fields remain through extension. Fold `declaration-diff-v2.patch` under that fact. No component/public-module set or edge change and no registry Mermaid change. The committed impact sets `internalInterface` and `sensitiveBehavior`; all other flags false. `architecture.modelUpdated=true` records the focused prose change only. The directory interface between Organizations and WorkOS changes inside the hosted Node server. No observable client/cross-container contract or integration setting changes.

Embed exactly the Mermaid block and adjacent notes from `summary-comparison-v2.md`. It is the authoritative comparison; do not repeat it in a supporting comment.

Outstanding: complete-candidate gates/metrics/checker, final commit evidence, accessible artifacts and independent current-head human architect approval. Keep the PR Draft and keep separate S2.5-02 release/owner gates visible. Final generated blockers may add to this list.

## Quality review architecture section material

<details>
<summary>Architecture assessment and comparison provenance</summary>

Incremental comparison uses actual parent `0530dd634fe8302b55d4a0669463ef733199cc40`, not newer main `581f30cfaa32b01399422b087b0f0bdc3b800f70` with separate Audit features. Final head must replace the working pin. The branch implements the repair; this report does not claim main/release status. `provenance-working-v2.json` records parent/current file hashes, line counts and selected real code anchors.

All 15 Mermaid blocks of `architecture/components.md` are inventoried. Parent and working v2 content hashes match for every block. Checked affected context, hosted containers, hosted authentication/removal components, collaboration, hosted Members display scenario, behavior/resource ownership and deployment. The facts/display prose update keeps the registry current; unchanged diagrams still show the same owners, supplied directory and WorkOS/SQL collaboration. No L2/deployment change. Existing Audit/SQL diagrams stay accurate; source owners and storage are unchanged.

`OrganizationDirectory.memberFactsPage` is the strongest changed callable contract. Review question: does it retain every safety fact and failure, stop and page rule while avoiding per-member user enrichment? L3 plus the four behavior notes, field mapping, direct/page agreement and narrow provider tests answer that question. L4 omitted because it would repeat the adapter's internal mapping without resolving another boundary question. No ADR is required by this scope; an authorized decision maker can still require one.

The supplementary comparison is source-derived and scoped to the hosted Node server, with real Organizations/WorkOS component owners. Red removes `memberPage` from the scan only, green adds `memberFactsPage`, and stable direct-target/display/deletion and SDK HTTPS relationships remain neutral. App/web gates, SQL admission/receipts, audit capture, actor/role-catalog reads and exact delete are condensed in the notes. Methods remain call labels, not components.

V2 source: `comparison-v2.mmd`; embedded candidate body: `summary-comparison-v2.md`; renders: `renders-v2/comparison-v2-800.png` and `.svg`; tooling/provenance: `renders-v2/render-report-v1.json`. Existing local Mermaid/Playwright Chromium parsed/rendered with a width of 800px and no package install or external requests. PNG is 800x753 with effective font 17.3px. Title clearance, labels, container boundaries, arrow targets and neutral label backgrounds pass visual review. V2 PNG is byte-identical to inspected v1 (`c6385fe2cd2aa2217de328437503171fc608df8216f35dfa6b0d54d43af7920d`). Embedded Mermaid equals standalone bytes.

Manager reviewed source/notes and inspected v1 PNG; approved scope and L4 omission. V2 applies the requested explicit five-second SDK/no-retry bound. Diagram semantics are unchanged and rerendered. See `manager-review-v2.md`. Final committed revisions require pin refresh and manager sign-off before publication. These cache paths are local review material, not GitHub artifact links; retain/upload artifacts and replace them with accessible links.

</details>

## Verification of documentation work

Manual code/contract/caller review completed. All 282 relative Markdown file links in the five edited Markdown files resolve. `.pr-impact.json` parses. `git diff --check` passes for the six owned files. No extra executable test was added for prose/configuration. No broad suite/build/metrics ran in this documentation task. Source/testing/impact edits are held; manager owns active serial gates and final commit.
