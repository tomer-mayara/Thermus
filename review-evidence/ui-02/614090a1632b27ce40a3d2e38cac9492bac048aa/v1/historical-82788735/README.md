# UI-02 review bundle

Candidate `8278873552601ed156a9aaeeb31c41cdb84ad77a`; parent/merge base `4a761fecf5ed1719959d286f104ecd3884068478`; main and main merge base `2b3ad13b9e2e61e206479b82e91359192cae1d00`.

**T1 Team review; overall blocked; Draft.** Manager source/architecture/quality evidence review is complete with no actionable defect and accepted retained reasons. Final publication-text review and final gate verification remain pending. Required hosted-live is failed, Linux AMD64 image proof is deferred to a dedicated local VM, and independent authorized current-head human approval is pending. No image pass, merge or deployment is claimed.

## Publication and final reports

- [Main description](publication/main.md), [Validation](publication/validation.md), [Quality review](publication/quality.md): one main description and exactly two maintained comments. Replace `EVIDENCE_ROOT` with the published accessible bundle URL before publication; preserve old comment bodies/history.
- [Summary](validation/validation-summary-final.json), [all results/count lines](review/result-count-index.json), [final parsed checker](validation/review-check-parsed-final.json), [checker notes](validation/checker-notes-final.json), [retained findings](validation/retained-findings-final.json), [manager scope](review/manager-review.md).
- [Full process](ast-report/process.md), [process JSON](ast-report/process.json), [review](ast-report/review.json), [CRAP](ast-report/crap.json), [coverage](ast-report/coverage.json), [base snapshot](ast-report/snapshot-base.json), [head snapshot](ast-report/snapshot.json), [impact](ast-report/impact.json). The original final-report copy also remains in [validation archive](validation/ast-report-final/).
- [Independent source review](review/source-review.md), [current inventory](review/current-increment-inventory.json), [document review](review/docs-review.md), [architecture assessment](validation/architecture-assessment-final.json), [screenshots](validation/screenshots-final/), [bounded visual review](validation/browser-visual-review-final.json).

## Execution and retained failures

Fresh final-head native checks passed: 5,155 emitted + 49 portal ordinary cases; 20 browser cases; 11 self-hosted cases; typecheck and portal build; full hosted offline selection; verified integration coverage 1,160 cases; snapshots/API/checker. Process exits 1 for completed Delta/Review goal misses, with CRAP/Architecture passed. Habit-hooks exits 1 with 21 findings whose individual reasons the manager accepted. Neither nonzero command is called wholly green.

[Earlier live run](validation/hosted-live.log) remains pinned to `2ec671ebb30741055f380f7f7a3866ecca549c21`: 22/29 passed, six quota HTTP 429 setup failures and a separate reinvitation HTTP 503 of unproven cause. [Summary](validation/live-summary.json), [cleanup ledger](validation/staging-removal-ledger.jsonl), [old-live→final input comparison](validation/old-live-to-final-comparison.json). No retry or final live success is inferred. Owned cleanup completed; fresh rejoin/access paths remain unverified. The full selected live group must pass.

Image proof is deferred, never a pass. [Owner local-only image decision](review/native-image-option.md) supersedes the Actions option; no workflow dispatch is authorized. [Old PR bodies](review/pr-before-264.json) retain old passes, failures, image-provenance retry and approval history. No inherited pass or prior Slice 2.5 approval establishes this candidate's gates or approval.

[Before inputs](validation/inputs-final-before.json), [after inputs](validation/inputs-final-after.json), [final pins](validation/pins-final.json), [raw coverage inventory](validation/raw-coverage-inventory-final.json), original/current comparisons and all original logs/results remain under validation. The process reports no new history record because parent `4a761fec` is not on origin/main; canonical main history is inherited. No record was forced or edited. Raw V8 captures are omitted; capture manifests and normalized coverage/provenance remain. No `.env`, credential file or node_modules is bundled.

[Historical source publication proof](review/source-review-publication.json) records root's verified remote ancestry and GitHub Contents reads for original 7acd/2ec/2189/a962 pins. Original source audit links are preserved. Packaging performs no external verification, tests, builds or metrics.

## Integrity

[SHA256SUMS](SHA256SUMS) hashes every file except itself. [Credential scan](review/credential-scan.json) checks configured private credential values and WorkOS key-prefix patterns without printing values. It is a bounded scan, not proof of absence for every secret format.
