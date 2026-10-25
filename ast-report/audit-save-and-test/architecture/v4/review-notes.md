# Architecture review evidence — v4

This is a supplementary comparison derived from production code and registry prose. It is not a registry view.

## Pinned comparison

- Trusted base and actual merge base: `74f756562231fb6aafd6a87f4bbd0f02bc0a208e`.
- HEAD at source capture: `1353ef0535e86c8c65425c40cb2abcbabfec60e3`.
- Candidate production code was uncommitted at capture. `provenance-worktree.json` pins SHA-256 hashes and the copied before/after sources under `pinned-source/`. The manager must add a committed provenance record before publication and verify these hashes against the final candidate.
- The JSON inventories all 13 Mermaid blocks at both revisions by heading, source lines and exact hash. No Mermaid block changed; moved line numbers follow prose edits.

## Source evidence

Read the copied before and after versions, not old PR comments. Base `logging-routes.ts` has independent Save and saved-Test branches; the candidate `change` method (lines 51–74) saves then selects the Test phase. `saveSettings` (76–85), `testSaved` (87–98), `saveFailure` (100–105), and `readPage` (107–111) own the phase outcomes and recovery. `logging-page.ts` (32–40, 54–58) owns safe result rendering, token blanking, native validation and the Test label. `logging-test-page.ts` (28–30) states the committed Save before its fixed outcome. `destination-settings-service.ts` and `destination-test.ts` stay byte-identical to the base; they own atomic revision handling, credential retention, pre-send/post-settlement checks, cancellation and Test lifetime. Registry prose near the Audit settings and saved-Test sections distinguishes the web orchestration from the nonmutating service Test.

Pinned copies are evidence artifacts; final GitHub links must use the final full candidate SHA and verified line bounds. The approved diagram source is `comparison.mmd`; `main-snippet.md` embeds it byte-for-byte with the four behavior notes and L4 rationale.

## Review tier

T2 Need architect: `internalInterface=true`. Web now coordinates a write and saved Test across the web/audit-logs component boundary in the hosted Node server. This new ordering and partial-success rule changes collaboration despite retained signatures and dependency edges. Retain `sensitiveBehavior=true` for data mutation and recovery. No separate supported external protocol is identified, so `contract=false`; no other architect flag is justified by this scoped implementation.

## Draft history and visual checks

- v1: first top-down draft. Too much text wrapped in nodes; retained as a draft.
- v2: compact left-to-right draft. Text became too small at 800 pixels; retained as a draft.
- v3: compact top-down source with readable labels. Manager requested a shorter container title and shorter edge label to reduce height. Its first upscaled render is retained as `comparison-upscaled-800.png`.
- v4: shorter boundary and edge text, with phase details retained in the web node and notes. Parsed and rendered with cached Mermaid 12.2.0 and repository Playwright Chromium; no dependency changes. The 800×702 PNG preserves native 18px text. Inspected without zoom: title clearance, component boundaries, labels, neutral white edge backgrounds, arrow targets and crossings are clear. No labels or unrelated nodes are crossed.
- Manager review of v4: **approved**. Exact feedback: “Boundaries/title clear, 18px labels readable, stable calls neutral, changed web amber, correct source owners.”

No new production capability or dependency is represented by a new arrow. The web node alone is amber; unchanged owners, supporting containers and relationships stay neutral. There is no added/removed architecture element to color green/red. Material caller, payload, ordering, commit, cancellation, suppression, uncertain-write and saved-but-send-failed rules remain in the four behavior notes.

## Limits

This evidence does not establish complete-candidate gates, approval by an independent human architect, current deployment, or live destination receipt. It must be refreshed if production source, registry views or compared revisions change.

## Committed candidate pin

Verified clean commit `ed529f8f225dd3d91311e669417347e07236582b` against base `74f756562231fb6aafd6a87f4bbd0f02bc0a208e`. Every copied production/registry hash matches that commit. The final machine record is `provenance-ed529f8f225dd3d91311e669417347e07236582b.json`; prior uncommitted evidence remains intact. No diagram/source refresh was needed. Candidate line bounds below were checked against committed files. A later metrics-record-only commit may retain this source pin with an explicit source-equality check.

- Before: [independent Save and saved Test](https://github.com/tomer-mayara/Thermus/blob/74f756562231fb6aafd6a87f4bbd0f02bc0a208e/src/interfaces/web/account/logging-routes.ts#L50-L111).
- After: [src/interfaces/web/account/logging-routes.ts:51–74](https://github.com/tomer-mayara/Thermus/blob/ed529f8f225dd3d91311e669417347e07236582b/src/interfaces/web/account/logging-routes.ts#L51-L74).
- After: [src/interfaces/web/account/logging-routes.ts:76–105](https://github.com/tomer-mayara/Thermus/blob/ed529f8f225dd3d91311e669417347e07236582b/src/interfaces/web/account/logging-routes.ts#L76-L105).
- After: [src/interfaces/web/account/logging-routes.ts:107–120](https://github.com/tomer-mayara/Thermus/blob/ed529f8f225dd3d91311e669417347e07236582b/src/interfaces/web/account/logging-routes.ts#L107-L120).
- After: [src/interfaces/web/account/logging-page.ts:32–40](https://github.com/tomer-mayara/Thermus/blob/ed529f8f225dd3d91311e669417347e07236582b/src/interfaces/web/account/logging-page.ts#L32-L40).
- After: [src/interfaces/web/account/logging-page.ts:54–58](https://github.com/tomer-mayara/Thermus/blob/ed529f8f225dd3d91311e669417347e07236582b/src/interfaces/web/account/logging-page.ts#L54-L58).
- After: [src/interfaces/web/account/logging-test-page.ts:28–30](https://github.com/tomer-mayara/Thermus/blob/ed529f8f225dd3d91311e669417347e07236582b/src/interfaces/web/account/logging-test-page.ts#L28-L30).
- After: [src/logs/audit/destination-settings-service.ts:90–136](https://github.com/tomer-mayara/Thermus/blob/ed529f8f225dd3d91311e669417347e07236582b/src/logs/audit/destination-settings-service.ts#L90-L136).
- After: [architecture/components.md:277–309](https://github.com/tomer-mayara/Thermus/blob/ed529f8f225dd3d91311e669417347e07236582b/architecture/components.md#L277-L309).
- After: [architecture/components.md:471–486](https://github.com/tomer-mayara/Thermus/blob/ed529f8f225dd3d91311e669417347e07236582b/architecture/components.md#L471-L486).

## Final candidate pin

Final clean head `4ae3cc7f950c53cc619c307159643b6771caff5a` adds only `docs/metrics/2026-10-24-74f75656.json` after independently reviewed `ed529f8f225dd3d91311e669417347e07236582b`. Compared all `src/`, `architecture/` and `test/` files: byte-identical. Each copied production/registry hash also matches. v4 manager approval carries forward on this exact identity; no rerender is needed. The final machine record is `provenance-4ae3cc7f950c53cc619c307159643b6771caff5a.json`. The main snippet now uses final-head source links, and its embedded Mermaid still matches the standalone source exactly. Earlier evidence remains preserved.

- Final: [src/interfaces/web/account/logging-routes.ts:51–74](https://github.com/tomer-mayara/Thermus/blob/4ae3cc7f950c53cc619c307159643b6771caff5a/src/interfaces/web/account/logging-routes.ts#L51-L74).
- Final: [src/interfaces/web/account/logging-routes.ts:76–105](https://github.com/tomer-mayara/Thermus/blob/4ae3cc7f950c53cc619c307159643b6771caff5a/src/interfaces/web/account/logging-routes.ts#L76-L105).
- Final: [src/interfaces/web/account/logging-routes.ts:107–120](https://github.com/tomer-mayara/Thermus/blob/4ae3cc7f950c53cc619c307159643b6771caff5a/src/interfaces/web/account/logging-routes.ts#L107-L120).
- Final: [src/interfaces/web/account/logging-page.ts:32–40](https://github.com/tomer-mayara/Thermus/blob/4ae3cc7f950c53cc619c307159643b6771caff5a/src/interfaces/web/account/logging-page.ts#L32-L40).
- Final: [src/interfaces/web/account/logging-page.ts:54–58](https://github.com/tomer-mayara/Thermus/blob/4ae3cc7f950c53cc619c307159643b6771caff5a/src/interfaces/web/account/logging-page.ts#L54-L58).
- Final: [src/interfaces/web/account/logging-test-page.ts:28–30](https://github.com/tomer-mayara/Thermus/blob/4ae3cc7f950c53cc619c307159643b6771caff5a/src/interfaces/web/account/logging-test-page.ts#L28-L30).
- Final: [src/logs/audit/destination-settings-service.ts:90–136](https://github.com/tomer-mayara/Thermus/blob/4ae3cc7f950c53cc619c307159643b6771caff5a/src/logs/audit/destination-settings-service.ts#L90-L136).
- Final: [architecture/components.md:277–309](https://github.com/tomer-mayara/Thermus/blob/4ae3cc7f950c53cc619c307159643b6771caff5a/architecture/components.md#L277-L309).
- Final: [architecture/components.md:471–486](https://github.com/tomer-mayara/Thermus/blob/4ae3cc7f950c53cc619c307159643b6771caff5a/architecture/components.md#L471-L486).
