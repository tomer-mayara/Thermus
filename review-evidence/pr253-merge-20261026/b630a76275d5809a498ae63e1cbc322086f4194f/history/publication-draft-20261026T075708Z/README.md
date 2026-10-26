# PR #253 evidence draft — validation still running

Candidate `b630a76275d5809a498ae63e1cbc322086f4194f`; actual stacked parent `d0dd8fc8e519eb8a008ae0fe78ceb4e1199bc60d` (#251); complete-candidate test base `8c6d204e8588a664438ba8934ab36670b802525f`. **T2 Need architect**; current static checker is preliminarily eligible. Overall merge remains blocked by pending runtime handback, parent/later-R1 integration, qualified architect identity/scope reconciliation and deployment preflight. Manager secret scan/publication/readback has not occurred.

## Completed validation snapshot

[Completed ledger](gate-ledger.json), [snapshot boundary](validation-snapshot.json), [test selection](validation/selection.md), [explicit focused paths](validation/focused-files.json), [input hashes](gated-inputs.json), [runner recipe](validation/run-gates.mjs). The retained completed runs include 276 focused cases, fresh PostgreSQL 22, ordinary 5,004 backend/49 portal, WorkOS staging 28 and native container 11. They have zero failed/cancelled/skipped/todo cases. Types, portal, locked install and 49 API snapshots also completed. Hosted AMD64/fresh offline, Collector, runtime-runner Habit and final diff/input binding remain pending worker handback. No final all-gates pass is claimed. Do not publish the draft comments as final until those results and any failure/retry history are incorporated.

Only completed, ledger-hashed log/build streams were copied. An active unledgered Docker stream was excluded. The root ledger/input files can acquire later entries; this package pins its exact snapshot rather than claiming the copied bytes are a later run.

## Accepted fresh quality

Quality ran in `/Users/tomermayara/.codex/worktrees/slice-25-stack-merge/Thermus`, comparing actual d0dd parent. The full copied reports retain cwd, commit labels, build/capture identities and paths. Copying is not another run. The original large-copy [manifest](quality/final-isolated/manifest.json) lists excluded raw captures too; use this package's [inventory](inventory.json) for published files.

- [Execution/copy overview](quality/final-isolated/README.md), [measurement binding](quality/final-isolated/measurements/metrics-binding.json), [checker binding](quality/final-isolated/measurements/checker-binding.json), [current checker](quality/final-isolated/measurements/pr-review.json)
- [All current source/function/finding/exception dispositions](quality/final-isolated/measurements/metric-dispositions.json), [readable review](quality/final-isolated/measurements/metric-dispositions.md), [all 17 checker notes/policy answers](quality/final-isolated/measurements/checker-notes.md)
- [Complete process](quality/final-isolated/measurements/process.md), [machine process](quality/final-isolated/measurements/process.json), [native findings](quality/final-isolated/measurements/review.json), [CRAP](quality/final-isolated/measurements/crap.json), [actual-parent snapshot](quality/final-isolated/measurements/snapshot-base.json), [current snapshot](quality/final-isolated/measurements/snapshot.json)
- [Complete native HTML](quality/final-isolated/ast-report/index.html), [native compare](quality/final-isolated/ast-report/compare.html), [native metrics data](quality/final-isolated/ast-report/metrics.txt), with all local data/scripts/images at original relative paths
- [Combined aggregate coverage](quality/final-isolated/measurements/coverage.json), [capture binding](quality/final-isolated/measurements/capture-binding.json), [build identity](quality/final-isolated/coverage-build.json), [capture log](quality/final-isolated/measurements/coverage-capture.log)
- Capture manifests: [unit](quality/final-isolated/ast-report/coverage-captures/capture-unit-XStpcu/capture-manifest.json), [integration](quality/final-isolated/ast-report/coverage-captures/capture-integration-F1Pu5Z/capture-manifest.json), [acceptance](quality/final-isolated/ast-report/coverage-captures/capture-acceptance-LJKg2E/capture-manifest.json)
- [Fresh quality Habit inventory/reasons](quality/final-isolated/measurements/habit-dispositions.json), [review](quality/final-isolated/measurements/habit-dispositions.md), [binding](quality/final-isolated/measurements/habit-binding.json), [manager quality review](quality/manager-quality-review.json). Runtime Habit reconciliation remains pending.

Current quality has 86 measured new/changed functions with strict goals met, three MI exceptions within exact bounds through 2026-12-24, and eight retained findings (3 high, 2 medium, 3 low). It records one attempt for each current command and preserves the exact missing-parent-on-main trend notice. Raw V8/process/signal profiles and source trees are excluded; only aggregate coverage and three manifests are included. Native HTML/data remain unmodified. A quality-only configured-secret scan record is preserved; it does not scan or approve this publication package.

## Source restack and architecture

[Source/contract/caller assessment](architecture/assessment-current.md), [main-summary comparison](architecture/summary-comparison-current.md), [exact Mermaid](architecture/comparison-current.mmd), [manager review](architecture/manager-review-current.json), [render/hash proof](architecture/equivalence-render-review.json), [restack per-file integration proof](restack/increment-equivalence.json), [range-diff](restack/range-diff.txt). Original source/render evidence links are retained in the assessment; no redundant render is copied or rerun.

Canonical checker view counts are 2 added/5 edited; heading-based inventory is 3 added/1 removed/4 edited because it separates old Deployment replacement. Both identify seven affected current views. The source keeps modern Audit behavior and the two independently reviewed SQL fixture phases. The intermediate head retains the display-email cost P2; later implemented #257 supplies facts-only safety reads. Keep deployment held through stack integration.

[Initial PR/comments history](history/initial-pr-stack-state.json) and [parent fixture failure/fix review](history/parent-fixture/postgres-fixture-review.md) retain predecessor scope. Earlier #253 full-group/focused PostgreSQL failures and exact immutable evidence links are preserved in the proposed Validation comment. Fresh current 22-case SQL results are distinct; no prior failed run is relabeled as passed.

## Proposed text and publication boundary

[Main description](publication-drafts/main-body.md), [maintained Validation comment](publication-drafts/validation-comment.md), [maintained Quality review comment](publication-drafts/quality-review-comment.md). Exactly those two existing supporting-comment IDs remain maintained. Texts use `%%EVIDENCE_ROOT%%`; manager substitutes the immutable artifact root after publication and reads back all three bodies. Current drafts still identify pending gates.

[Deployment context](review/deployment-preflight-context.json) records the manager's retrieval of the latest authorized rollout: auto-deploy enabled on main and 8c6d204e observed live on 26 October. No fresh Render observation exists; workspace/target/hold remain unconfirmed. Do not use the older Off setting as current evidence. No source/evidence push is performed by this preparation.

[Provenance](provenance.json), [inventory](inventory.json) and [link review](link-review.json) record exact-copy hashes and the curated file boundary. No environment/credential file, unrelated user draft, source tree or raw V8 capture is included. Manager must wait for worker handback, refresh staged dynamic validation artifacts/texts, review current holds and approval mapping, then scan/approve the final exact inventory before any publication. No Ready, merge, migration, notice approval or release is claimed.
