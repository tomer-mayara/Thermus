# Complete quality evidence: stale-session recovery

Candidate `c8b12419a812534d93343eb24248d70de7cf828e`; trusted base `c9da79e63406e71dd15032d4ab9dfb85f2766918`. Managed checkout `/Users/tomermayara/.codex/worktrees/s25-release-quality/Thermus` on `codex/s2-5-stale-session-quality-evidence`. The checkout is clean and left idle for the manager's final docs-only-head refresh. No recovery-checkout build output was used or modified.

## Commands and results

All metric commands used absolute Node 24.20.0 and the original c617 wrappers/pinned runtime `0.43.1-thermus.1`, with this quality checkout as cwd. Dependency links are inside ignored real `node_modules` directories. No dependency install, source/config/baseline/index edit, ordinary suite, live gate, or container gate ran here.

- Complete process with `--base origin/main --collect-coverage --out ast-report/process.md --json ast-report/process.json`: exit 1, a completed **Delta goal miss**, not a tool failure. Review, CRAP, and Architecture passed.
- Fresh selected emitted unit tests: **3301/3301** passed; portal unit tests: **29/29** passed. Both have zero failures, cancellations, skips, and todo markers. Unit collection includes its required local backend build only.
- Standalone base/head snapshots: exit 0 each, exact base/candidate identities. Standalone CRAP: exit 0. Full checker: exit 0, **T1 Team review**, preliminary eligibility `eligible`, blockers `[]`.
- Habit Hooks: final complete run exit 0 with 29 comment advisories; snooze remains `[]`. Attempt 1 failed because the restored checkout lacked private ESLint dependencies. Existing private dependencies were linked without install/config changes; attempts 2 and 3 completed. Attempt 2's runner exit was not captured, so attempt 3 confirms exit 0. All logs are retained.

## Retained metrics and findings

Browser-session file MI is **63.3184 → 62.6167**, an existing below-85 goal, with a 0.7016 drop. Paths **49 → 51**, LOC **177 → 184**. Retained reason: the narrow catch belongs at the existing automatic-refresh lifecycle boundary; splitting the whole security-sensitive session class would broaden this fix. The checker accepts the retained existing-file goal miss; no exception was added or used. Session-client MI stays above 85 at **93.5913 → 91.1798**; paths **14 → 17**, LOC **79 → 84**.

Changed `refreshed`: **4 paths, 100% covered, CRAP 4.0**. Changed `fieldOf`: **3 paths, 90.6% covered, CRAP approximately 3.0**. New `isMissingOrganizationMembership`: **3 paths, 100% covered, CRAP 3.0**. All changed/new goals pass. No required unknown function assessment/identity, known limit violation, measured target miss, or unmatched function remains in the selected files. Unchanged functions in those files pass; their disposition is `unchanged by this PR`.

Static review has zero high, zero medium, two low findings. Retain `workos-browser-session.test.ts` Halstead estimate **1.284758 → 1.422165** because its new case establishes pinned-SDK error translation. Retain `workos-browser-session-refresh.test.ts` estimate **0.713482 → 0.871018** because its exact-error/near-miss cases establish the narrow security boundary and original error identity. The growth comes from necessary test assertions, with no new complex-function or layer-import finding. No high finding is retained, and no metric baseline refresh is permitted or needed.

Habit Hooks retains 28 unchanged boundary/invariant/evidence comments and one new recovery-reason comment. Per-occurrence locations, provenance, and reasons are in `habit-hooks-dispositions.json`. The new comment explains why reauthentication recovers remaining access without an automatic workspace selection.

## Architecture, policy, and evidence limits

Checker line: **Architecture: T0: no architecture fact**. The only review-tier reason is `impact.sensitiveBehavior`, which covers this session-recovery change. No component, edge, new public module, declaration, registry-view, or decision-record fact is present. **49 public modules / 0 declaration snapshots changed**; informational notes identify the touched public browser-session module and its changed internal-module import, with declarations unchanged. These notes require no escalation because the callable surface stays identical. All **15 registry Mermaid blocks remain byte-identical**; no new comparison drawing/L4 is needed.

The declaration-scope checker ignored **33 compiler errors in 2 non-public files**, as its documented policy permits. Its result covers the 49 public modules; it is not full typecheck evidence. The manager's source gates provide complete build/type validation. The local eligibility note is preliminary: the manager must verify current checks, holds, and required authorized independent human approval. Pending required human approval still blocks overall merge, despite local `eligible`.

The full process retains complete global import context. The existing unresolved `./style.css` import in portal `main.ts` affects both snapshots; the architecture report therefore withholds component edge/cycle changes. Manual source review confirms only a same-owner import-name addition to an existing internal module. Native modularity/cross-share/communities remain **0.33 / 0.31 / 4** and the existing community cycle remains `accounts/app/pipelines`; tool grouping is not a new component cycle. Global known CRAP≥30 count stays **60 → 60**, with no added/worse function. These warnings belong to unchanged code. Base functions without an estimated covered share: **132**; those unit-coverage limits outside the required changed functions are not zero coverage and do not justify another suite. Historical count estimates use head coverage and are not measured base coverage. The trend retains its existing gap of four main commits between `8c6d204e` and `9f07c04b`; no history was rewritten.

## Provenance and retained artifacts

Verified capture: unit suite, **451 processes / 157 scripts**. Source fingerprint `cf4a46d84e144cc72f7b785875282fdee37f043a3fffff135f3757532ebc56a1`; input fingerprint `620d4928d26adec443409d38a8db0c2ea87239b8b1a7d61427cb3d86cec2fb73`; build fingerprint `97c440a7f8732d1ee33ccc3bc9f1a560ffe8aff64e3a4b7243b7f6207d66c811`; capture ID `9a606053372ad2d1ee88ad4a468f36a74a13daeaac1b91c66fe558ff17e5e907`. Full provenance, completion protocol, compiler, runtime, and manifest fingerprint remain in unedited `ast-report/coverage.json`; raw capture and manifest remain under `ast-report/coverage-captures/` (about 223 MiB). The generated reports, HTML comparisons, snapshots, review, process, standalone CRAP, impact stamp, and captures are all retained.

The process generated the missing verified base record for c9. Its exact bytes were moved to `/Users/tomermayara/.codex/worktrees/s25-release-quality/Thermus/.cache/stale-session-recovery/quality/base-record-2026-10-26-c9da79e6.json` before the clean checker. SHA-256: `1b6bf27a4840b62137989ce4ef943b68647777fb942ebb66a735307c0366d7fa`. The manager may copy it to `docs/metrics/2026-10-26-c9da79e6.json` and commit it unchanged. No record was edited or committed by this worker.

All command stdout/stderr, failed Habit Hooks history, checker JSON, per-comment dispositions, and `quality-results-c8b12419.json` are retained beside this summary. The complete metric reports stay in this checkout's ignored `ast-report/`. No full inherited metric tables are repeated here.
