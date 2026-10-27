# New-base final candidate metric dispositions — v3

Base: `f6b523967223da5ebddafdef1a508d3936cee01c`.
Measured source candidate: `7b46dca42c17ead64263339fd638f39ccb693a0d`.
Final candidate: `feaddbdec5f9e2cc7bf8e07050a4d5e7aa5e5769`.

Retain the two existing low file-MI scores and the one canonical high
maintainability-regression finding. No necessary source fix or metric exception
was found. This is an independent source/metric judgment, not human architect
approval. Raw process Delta and Review remain goal misses; do not call the whole
process a clean pass. CRAP and Architecture passed within their stated scope.

## Retained production findings

| Finding | Result | Concrete reason |
| --- | --- | --- |
| Existing route file below MI 85; high maintainability-regression | src/interfaces/web/account/account-routes.ts: MI 59.4408 → 54.0304, drop 5.4104; LOC 176 → 197; paths 47 → 62, 23 functions | The added conditions keep display authority bound to the session subject, authority, selected workspace, usable tenant, product permission and exact Admin grant. The new optional read needs separate denial/error/abort behavior so the picker remains a recovery page. These are required conditions, not overlapping business jobs. The effectful lookup is already a focused 11-line/3-path method, the identity/role predicate is a focused 7-line/7-path function, and picker orchestration is 11 lines/7 paths. Their measured 100% coverage and CRAP 3/7/7 support the bounded change. Keep those decisions visible together at the route owner. |
| Existing page file below MI 85 | src/interfaces/web/account/organization-selection-page.ts: MI 66.8578 → 65.6762; paths 4 → 5; 2 functions | The change adds one optional Admin-menu branch and safe base-aware destinations in the existing native page renderer. Keep the page, escaped form/menu output and content-derived CSS CSP hash together. The changed renderer has 2 paths, 100% coverage and CRAP 2; the unchanged form-row projection has 3 paths and CRAP 3. A new template abstraction would add indirection without separating a different invariant. |
| Style module not measured | src/interfaces/web/account/organization-selection-style.ts: 59-line CSS string, no functions | Function MI/CRAP is N/A for this data module. Its style content, CSP coupling and browser behavior remain reviewed. Do not invent a numeric pass or add an exception for a missing function metric. |

There is no coherent small extraction that is needed for this behavior. Moving
the one-use lookup and predicate into another module could lower the route file's
score by relocating code, while adding a module boundary and hiding which GET
phase uses the policy. Removing or merging identity/permission checks would weaken
the visible invariant. A wider route decomposition is a separate design change;
it would require new-file metric assessment, refreshed coverage and all applicable
source gates. Its cost is not justified by an identified correctness or cohesion
defect in these three focused functions. No source edit is recommended here.

The high finding is retained for that design reason, not merely because the file
was below 85 on main. Record the exact drop and reason in Quality review. There is
no new production file below 85 and no CRAP miss requiring an exception entry.

## Other findings and measurement limits

- The canonical review wrapper has one high finding and no medium/low finding.
  The embedded native review warns at 10 paths for
  test/support/drivers/browser/workspace-selection-browser.ts:22,
  WorkspaceSelectionBrowser.inspectPicker. The repository policy requires more
  than 10, so this is a native-only informational finding. Its bounded role
  expectations, link loop, computed-style window guard and optional screenshot
  output verify one picker interaction. Test functions have no production MI/CRAP
  goal. Retain the native diagnostic and explain the wrapper's threshold; do not
  alter either report or split the helper solely to move the counter.
- Every changed or tool-classified-new function has verified 100% unit/integration
  coverage and CRAP at most 7. Required identity/assessment misses, unmeasured
  changed functions and CRAP target misses are zero. File MI remains a separate
  measure from these function scores.
- The tool classifies the unchanged withCookies filter callback as new after
  parent/function matching. Source comparison proves its body unchanged; its
  CRAP 1 at 100% also meets the new-function goal. This mapping detail creates no
  unknown required identity and is not used to hide a miss.
- Coverage is verified unit plus integration at source head 7b46dca4, with the
  same source/build fingerprints in the combined captures. These suites were
  already selected by the source candidate. No acceptance or live execution is
  claimed as measured by that coverage. Base CRAP uses head coverage as an
  estimate; 81 base functions lack an estimated covered share.
- The unchanged unresolved main.ts → style.css import leaves generated dependency
  evidence incomplete. Manual source/import/registry review supplements that
  limitation; an incomplete graph is not proof of absent edges or cycles. Global
  and component reports retain their full context rather than being copied here.

## Immutable record and final-head input bridge

The only tracked change from measured/reviewed source head 7b46dca4 to final head
feaddbde is docs/metrics/2026-10-27-f6b52396.json. A recursive Git comparison checks
every tracked entry's mode, object type and object ID; all other entries are
identical. This covers source, tests, design prose, registry, impact declaration,
public declarations, package/lock/build inputs and quality policy.

The new record is 105,871 bytes, SHA-256
`1b1bfbe60458430892d08855a76c4bb8194d254c165f170a20a5534f5fc31f87`.
It records trusted base f6b52396, with its source fingerprint, and explicitly labels
the base CRAP values as head-derived estimates using coverage at 7b46dca4. The
record bytes are preserved unchanged. This review did not edit or regenerate it.

Keep v3 architecture/source review pinned to 7b46dca4. The separate
final-head-input-bridge-v3.json and pr-architecture-comparison-final-v3.md connect that
review to feaddbde without relabelling earlier test/coverage runs. The manager-approved v3 Mermaid
source and PNG remain valid because all affected code, registry views and behavior
are identical; manager's diagram review is preserved. Final process/checker
provenance still needs the actual final head and verified compatible coverage.

Machine evidence: metrics-review-v3.json records focused scores, changed/new
function rows, report hashes observed during review, coverage status and limits.
No MCP server, test suite, build or metric collection was started by this reviewer.


## Fresh new-base evidence and inherited limits

This review reads the preserved source reports under
ast-report/workspace-selection-refresh/metrics-source and a byte-preserved copy
of the observed standalone CRAP report. Their original base/head pins and hashes
are in metrics-review-v3.json. The source process completed all four sections:
Delta and Review retain the stated MI misses; CRAP and Architecture passed.
The final-head snapshots/process/checker rerun is still in progress and is not
claimed passed by this review.

Fresh verified coverage at 7b46dca4 collected both complete unit and integration
suites: 196 files/scripts across 767 processes. Every changed or tool-classified-new
row has 100% coverage and CRAP at most 7. Required changed-function identity,
assessment and coverage misses are zero. No metric exception is added or used.
Base/head provenance uses Node 24.20.0, TypeScript 7.0.2 and the same measurement
method; the final record-only bridge does not justify changing original capture
pins. The tool must separately verify compatible reuse for final-head reports.

The new-base global context differs from the old-base review: 212 production files,
1630→1635 functions, modularity 0.34→0.34, cross share 0.21→0.21, four native
communities and one unchanged community cycle. No new/gone community edge is
reported. The persistent unresolved main.ts→style.css local import still makes
component-edge/cycle changes incomplete, so manual source/registry review remains
necessary. The app component retains 3 unknown functions unrelated to the picker;
81 base functions lack a head-derived estimated covered share. These are retained
analysis limits, not new numeric escalation rules or proof that all production
functions have measured zero risk.

All source/input and design/registry bytes are identical between 7b46dca4 and
feaddbde except the added immutable historical base record. The record references
base f6b52396 and head-derived coverage 7b46dca4, and its exact hash is preserved.
The old v1 metric review and old-base record remain historical; neither is
silently relabelled as this new-base run. No image, live, hosted-build or
self-hosted-container completion is inferred while those gates finish.
