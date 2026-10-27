# Final UI-01 evidence on main 9507e751

Candidate `37046bbd1426566d90bf1a32f8578584d7173060`; actual main/base and merge base `9507e751215fec32748bf4e944f2393928e61cf5`.

**T1 Team review; Draft; overall blocked.** Local final checker is mechanically eligible with no architecture facts or local blockers. Required new local Linux AMD64 image proof and independent current-head human approval remain pending. Root accepted unchanged source/architecture, retained quality reasons and the current370/base950 checker. Final gate verification remains pending. No new image pass, merge or deployment is claimed.

## Current reports and publication text

- [Main](publication/main.md), [Validation](publication/validation.md), [Quality review](publication/quality.md): exactly two maintained comments. Replace `EVIDENCE_ROOT` with the accessible final bundle URL before publication; manager final text review and post-write readback are separate.
- [Summary](validation/evidence-summary.json), [final execution](validation/37046bbd-quality.json), [checker](ast-report/check.json), [process](ast-report/process.md), [process JSON](ast-report/process.json), [review](ast-report/review.json), [CRAP](ast-report/crap.json), [coverage](ast-report/coverage.json), [base](ast-report/snapshot-base.json), [head](ast-report/snapshot.json), [impact](ast-report/impact.json).
- [Metric dispositions](validation/metric-dispositions.json), [habit dispositions](validation/habit-dispositions.json), [checker notes](validation/checker-notes.json), [fresh typecheck](validation/4f5402fe-typecheck.log), [fresh integration capture](validation/4f5402fe-integration-coverage.log).
- [Final source audit](review/source-review.md), [current inventory](review/current-increment-inventory.json), [document review](review/docs-review.md), [main comparison](review/after-main-270-comparison.json). The source audit's local inventory hyperlinks are remapped for publication; [original audit bytes](review/source-review.original-local-links.md) remain intact. Source sign-off does not replace current quality/gate evidence.

## Rebind, history and limits

Only top-level `ast-report/` contains fresh final reports at 37046bbd/9507e751. Fresh typecheck and 1,159-case verified integration coverage executed at `4f5402fe04b52c9964d016e5375a0e44383c8bc5`; [record-only rebind](validation/37046bbd-record-rebind.json) proves the sole final change adds the immutable 9507e751 JSON record, and native tools accepted coverage without edited captures. [Functional rebind](validation/functional-rebind.json) preserves older source/test/build equivalence. Main's added scripts/Knip required fresh broad typecheck and global quality; the Docker build context change leaves image proof pending.

The [complete old 4a bundle](historical-4a761fec/README.md) is historical, including its reports and native execution pins. Ordinary 5,153 + 49, browser 7, self-hosted 11 and the full hosted-offline retry remain original executions at 7acd90d4, not new runs at 37046bbd. The first offline run had four port-bind failures. Three earlier AMD64 image attempts failed/interrupted before current-main proof; no runtime image cases ran. Keep their logs and cleanup history. No hosted-live gate is selected for UI-01. No prior human approval is transferred.

Both immutable records are copied with [original hashes/provenance](validation/history-records.json): [2b3ad13b](review/history-records/2026-10-26-2b3ad13b.json), [9507e751](review/history-records/2026-10-26-9507e751.json). Structural values belong to each base; CRAP estimates use original head captures. No record was edited. Historical detached head=base output remains invalid under the old bundle and is never current proof. Earlier refresh/quality archive files retain their actual pins.

[Published original a962 ancestry](review/source-review-publication.json) and [072 ancestry](review/source-review-publication-07285735.json) support original source links. Packaging performs no external verification. Environment/launcher history is bounded: no manual install, package-version or source/configuration change is claimed; tools did affect the shared ignored launcher. Raw V8 files are excluded except capture manifests. No actual dependency tree, credentials or .env is included.

[SHA256SUMS](SHA256SUMS) covers all bundled files except itself. [Credential scan](review/credential-scan.json) checks configured credential values and WorkOS prefixes privately; it is bounded evidence, not proof for every secret format. Preparation copied files only; no tests, builds, metrics, checkout, commit, push or publication ran.
