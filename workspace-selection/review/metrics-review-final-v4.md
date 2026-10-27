# Final candidate metric dispositions — v4

Base: `a421afc056ce3e400f2779c75683ea45270b96cb`.
Measured source candidate: `e36e34c9304444312b52d76cc1c91aa365ccc719`.
Final candidate: `44753a72a7c1cecbf076e1448c26a4ae4b93a9f2`.

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
- Coverage is verified unit plus integration at source head e36e34c9, with the
  same source/build fingerprints in the combined captures. These suites were
  already selected by the source candidate. No acceptance or live execution is
  claimed as measured by that coverage. Base CRAP uses head coverage as an
  estimate; 81 base functions lack an estimated covered share.
- The unchanged unresolved main.ts → style.css import leaves generated dependency
  evidence incomplete. Manual source/import/registry review supplements that
  limitation; an incomplete graph is not proof of absent edges or cycles. Global
  and component reports retain their full context rather than being copied here.

## Fresh final-head reports and input bridge

The reports under ast-report/workspace-selection-release-refresh/metrics pin
base a421afc056ce3e400f2779c75683ea45270b96cb and final head
44753a72a7c1cecbf076e1448c26a4ae4b93a9f2. The full process completed:
Delta and Review retain their stated MI goal misses; CRAP and Architecture passed.
The manager reports standalone CRAP exit 0, and its current-head report has no
required identity, assessment, coverage or goal miss. Nine changed/tool-new rows
all have 100% covered share and CRAP at most 7. No exception is added or used.
Do not report the entire process as a clean pass merely because CRAP passed.

Fresh verified unit plus integration coverage captured source e36e34c9: 196
files/scripts, 767 processes, Node 24.20.0, TypeScript 7.0.2. The conservative canonical
input fingerprint is
`d700c917be11e34359c897250d29b4aee60ba277fd5fd098a625b4efec172dd7`,
which differs from v3 as required after SO-02 adds script/workflow inputs.
The final process explicitly reports verified compatible reuse. The final
commit adds only docs/metrics/2026-10-27-a421afc0.json, excluded from these inputs;
all other tracked objects and modes equal the measured/reviewed source candidate.
Coverage remains pinned to its actual capture, not relabelled as a fresh final run.

The added immutable record is 105,870 bytes, SHA-256
`6079002245b8f5f08f31c7e0449a877711d91b3aa2a62d79b86af60d3f94d54e`.
It records base a421afc0 and head-derived CRAP estimates using e36e34c9 coverage,
with 81 unknown estimated shares. This review did not modify or regenerate it.
Final-head-input-bridge-v4.json proves the record-only final change.

The actual-base global context is 212 production files, 1630 to 1635 functions,
modularity 0.34 to 0.34, cross share 0.21 to 0.21, four native communities and one
unchanged native community cycle. No new/gone community edge is reported. The
unchanged unresolved main.ts to style.css import still makes dependency evidence
incomplete; manual source/registry review supplements it. Component-edge/cycle
changes are withheld. The inherited app component retains three unknown functions
outside picker scope. These are analysis limits, not new numeric escalation rules.

Metrics-review-final-v4.json records current report hashes, pins, focused file
scores, every changed/tool-new function row, fresh coverage provenance and these
limits. Prior metric reviews remain historical. The final checker is pending per
manager report; it has its own eligibility and approval evidence. No ordinary,
browser, image, container or live pass is inferred by this metric disposition.
The reviewer ran no metrics, MCP, build or test process.
