# PR #251 merge-preparation evidence

Candidate: `d0dd8fc8e519eb8a008ae0fe78ceb4e1199bc60d`. Actual main merge base: `8c6d204e8588a664438ba8934ab36670b802525f`. This package is a review draft, not a publication or merge result. All selected product gates passed; static review is **T2 Need architect** / preliminarily eligible. Overall merge remains blocked by architect identity/qualification and current-candidate scope reconciliation, plus Render workspace/target confirmation and verified deployment preflight. Manager secret scan, inventory approval, publication and readback remain pending.

## Validation and exact input provenance

- [Complete validation draft: commands, UTC times, exits, counts and limits](validation-draft.md)
- [Serial gate ledger](gate-ledger.json), [full input hashes](gated-inputs.json), [final clean-state binding](validation/final-binding.json), [test selection](validation/selection.md)
- [PostgreSQL failure/fix review](postgres-fixture-review.md), [after-run binding for unchanged pre-commit green inputs](validation/postgres-input-binding.json), [original failed run](postgres-fixture-red-focused.log), [green focused run](postgres-fixture-green-focused.log), [green complete group](postgres-fixture-green-group.log)
- [Full ordinary log](ordinary-1.log), [WorkOS staging](hosted-live-1.log), [native container](native-container-1.log), [hosted AMD64 container](hosted-container-1.log), [Collector](logging-collector-1.log)
- [Fresh full AMD64 build stream](docker-build-1792996652405-hosted-container-1792997991333-5682.log), [offline six-group extraction](validation/hosted-offline-evidence.json), [final build history](validation/final-build-history.jsonl)
- [Actual validation recipe](validation/run-gates.mjs) and [explicit Docker-context wrapper](validation/bin/docker)

## Current quality and coverage

Quality actually executed in `/Users/tomermayara/.codex/worktrees/slice-25-stack-merge/Thermus`. It was copied unchanged into the primary task cache, then copied exactly into this package. Original cwd, capture identities, report paths and commit labels stay intact. Copying is not a new run. Raw source reports are never rewritten to make their local path links match this publication; this index supplies artifact-relative navigation.

- [Successful execution/copy provenance](quality/measure/final-isolated/README.md), [original larger-copy hash manifest](quality/measure/final-isolated/manifest.json), [current metrics binding](quality/measure/final-isolated/measurements/retry-named/metrics-binding.json), [current checker binding](quality/measure/final-isolated/measurements/retry-named/checker-binding.json)
- [Current classification](quality/measure/final-isolated/measurements/retry-named/pr-review.json), [all checker notes/reasons](quality/measure/final-isolated/measurements/retry-named/checker-notes.md), [full per-location/function dispositions](quality/measure/final-isolated/measurements/retry-named/metric-dispositions.json), [readable dispositions](quality/measure/final-isolated/measurements/retry-named/metric-dispositions.md)
- [Complete process Markdown](quality/measure/final-isolated/measurements/retry-named/process.md), [process JSON](quality/measure/final-isolated/measurements/retry-named/process.json), [native findings](quality/measure/final-isolated/measurements/retry-named/review.json), [CRAP report](quality/measure/final-isolated/measurements/retry-named/crap.json), [base snapshot](quality/measure/final-isolated/measurements/retry-named/snapshot-base.json), [head snapshot](quality/measure/final-isolated/measurements/retry-named/snapshot.json)
- [Full native HTML report](quality/measure/final-isolated/ast-report/index.html), [native compare HTML](quality/measure/final-isolated/ast-report/compare.html), [native metrics data](quality/measure/final-isolated/ast-report/metrics.txt). All native data/script/image assets are present at their original relative locations.
- [Aggregate coverage](quality/measure/final-isolated/measurements/coverage.json), [capture binding](quality/measure/final-isolated/measurements/capture-binding.json), [verified capture manifest](quality/measure/final-isolated/ast-report/coverage-captures/capture-unit-jNmzdx/capture-manifest.json), [build identity](quality/measure/final-isolated/coverage-build.json), [unit capture log](quality/measure/final-isolated/measurements/coverage-capture.log)
- [Manager quality review](quality/manager-quality-review.json), [all reviewed Habit reasons](quality/habit-dispositions.md), [later identical inventory](validation/habit-dispositions.json), [exact run bridge](validation/habit-run-bridge.json)

Raw V8 profiles, process/signal capture files and source copies are excluded. Coverage.json and the capture manifest retain 433 raw-file and 219 lifecycle/process identities without publishing the 237 MB capture. The original larger-copy manifest retains hashes for excluded raw files; it is not this package's file inventory.

## Failure/retry history

The [authoritative review](quality/measure/final-isolated/measurements/failure-retry-review.json) explains missing runtime/Go setup, the invalid detached native compare, restored candidate and successful named-branch retry with compatible coverage. The unchanged [invalid detached process](quality/measure/final-isolated/measurements/final/process.json), [its report](quality/measure/final-isolated/measurements/final/process.md) and [invalid generated record](quality/measure/final-isolated/invalid-process-generated-record.json) remain history. They must never be cited as current PR251 certification. No external actor is alleged. The successful current reports are exclusively `measurements/retry-named/`.

The [initial PR/comment snapshots](history/initial-pr-stack-state.json) preserve the prior description, exactly two maintained supporting comments and original holds. The [earlier immutable complete evidence](https://github.com/tomer-mayara/Thermus/tree/bc62fd685d39990a16429199a7bd20e6f554d161/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367) remains accessible; old passes/failures retain their original candidate meaning. The current manager-quality record predates completion of runtime validation; use final validation binding for those gate results.

## Architecture and proposed PR text

- [Current assessment](architecture/assessment-current.md), [current manager sign-off](architecture/manager-review-final.json), [production/declaration identities](architecture/file-equivalence-final.json), [13-view inventory](architecture/registry-inventory-final.json), [source/render byte proof](architecture/render-reuse-final.json)
- [Exact reviewed Mermaid source](architecture/comparison-reviewed.mmd); unchanged full renders/reports are linked from the current assessment.
- [Proposed main description](publication-drafts/main-body.md), [maintained Validation comment](publication-drafts/validation-comment.md), [maintained Quality review comment](publication-drafts/quality-review-comment.md). These review drafts use `%%EVIDENCE_ROOT%%`, which manager substitutes only after publishing the immutable evidence commit. Existing comment IDs are preserved.

## Publication boundary

[Provenance](provenance.json) records exact-copy source hashes and actual execution cwd; [inventory](inventory.json) is the current staged-file list and hashes. No environment/credential file, unrelated user draft, raw V8 profile or source tree is included. Manager must scan these exact staged bytes before publication, approve this inventory, publish without changing a checkout, substitute the evidence-root URL, update the existing description and same two comments, and read them back. Canonical label remains T2 Need architect; neither a label nor this artifact proves human approval or deployment authorization. The old publisher helper is reference only: its clean-current-HEAD/base guards cannot be reused against the manager's now-different active checkout.
