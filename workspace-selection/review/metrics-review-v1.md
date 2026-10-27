# Final candidate metric dispositions

Base: `77477864d8238b9141e9619b6bcbb6b0aa7fb11b`.
Measured source candidate: `16c8e174f503f79c5011fe9ac7e157578ff49d74`.
Final candidate: `2907d105f85c9596401312d7082af86a5711df06`.

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
- Coverage is verified unit plus integration at source head 16c8e174, with the
  same source/build fingerprints in the combined captures. These suites were
  already selected by the source candidate. No acceptance or live execution is
  claimed as measured by that coverage. Base CRAP uses head coverage as an
  estimate; 78 base functions lack an estimated covered share.
- The unchanged unresolved main.ts → style.css import leaves generated dependency
  evidence incomplete. Manual source/import/registry review supplements that
  limitation; an incomplete graph is not proof of absent edges or cycles. Global
  and component reports retain their full context rather than being copied here.

## Immutable record and final-head input bridge

The only tracked change from measured/reviewed source head 16c8e174 to final head
2907d105 is docs/metrics/2026-10-27-77477864.json. A recursive Git comparison checks
every tracked entry's mode, object type and object ID; all other entries are
identical. This covers source, tests, design prose, registry, impact declaration,
public declarations, package/lock/build inputs and quality policy.

The new record is 105,849 bytes, SHA-256
`be3d37c7e8e2feccd918a4403fab5b4c89c978c6853c6c73f9d9517a8bb7be04`.
It records trusted base 77477864, with its source fingerprint, and explicitly labels
the base CRAP values as head-derived estimates using coverage at 16c8e174. The
record bytes are preserved unchanged. This review did not edit or regenerate it.

Keep v2 architecture/source review pinned to 16c8e174. The separate
final-head-input-bridge.json and pr-architecture-comparison-final.md connect that
review to 2907d105 without relabelling earlier test/coverage runs. The same Mermaid
source and PNG remain valid because all affected code, registry views and behavior
are identical; manager's diagram review is preserved. Final process/checker
provenance still needs the actual final head and verified compatible coverage.

Machine evidence: metrics-review-v1.json records focused scores, changed/new
function rows, report hashes observed during review, coverage status and limits.
No MCP server, test suite, build or metric collection was started by this reviewer.
