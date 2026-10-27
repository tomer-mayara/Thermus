# UI-01 review bundle

Candidate: `4a761fecf5ed1719959d286f104ecd3884068478`.
Main, actual base and merge base: `2b3ad13b9e2e61e206479b82e91359192cae1d00`.
Prepared from existing files only. No new test, build, metrics run, checkout, commit, push, provider action or publication occurred.

**T1 Team review; overall blocked; keep Draft.** Final local checker has no mechanical blocker, but required Linux AMD64 hosted-image proof and independent authorized current-head human approval are missing. Manager review of the description, Validation, Quality review, source, checker, metric review and habit evidence is complete for this head/base. Required final gate verification remains pending. No merge or deployment is claimed.

## Read first

- [Publication description](publication/main.md), [Validation](publication/validation.md), [Quality review](publication/quality.md): exactly two maintained comments; replace `EVIDENCE_ROOT` with the final accessible published bundle URL before publishing.
- [Current execution summary](validation/evidence-summary.json), [all result/count index](review/result-count-index.json), [final checker](ast-report/check.json), [process](ast-report/process.md), [process JSON](ast-report/process.json), [review](ast-report/review.json), [CRAP](ast-report/crap.json), [coverage](ast-report/coverage.json), [base](ast-report/snapshot-base.json), [head](ast-report/snapshot.json), [impact](ast-report/impact.json).
- [Manager evidence review](review/manager-review.md), [local-only image decision](review/native-image-option.md), [Independent source review](review/source-review.md), [document review](review/docs-review.md), [final inventory](review/current-increment-inventory.json), [gate plan](review/gate-plan.md), [prior PR bodies](review/pr-before-263.json).
- [Screenshots](validation/browser-evidence/), [original input provenance](validation/validation-context.json), [source/test input manifest](validation/source-test-inputs.json), [rebase comparison](validation/final-revision-comparison.json), [input hash delta](validation/final-input-hash-delta.json), [final input equivalence](validation/4a761fec-input-equivalence.json).

## Evidence limits and attempts

The 5,153 emitted + 49 portal ordinary tests, 7 browser cases, builds and 11 self-hosted cases passed on the original functional candidate `7acd90d4`; final input equivalence supports reuse, not a new execution. Full typecheck and integration coverage were captured at `639827bc`; final stable tools accept the matching inputs at `4a761fec`. The refreshed source review and inventory pin final `4a761fec`; the previous 639827bc snapshots are preserved under historical names and must not replace the refreshed evidence.

Hosted offline build first failed four integration binds while another owned gate held port 46443; the complete retry passed. All command logs and result JSON remain under [validation](validation/). Three AMD64 image attempts failed/interrupted before runtime-image proof: [first](validation/hosted-amd64-image.log), [retry](validation/hosted-amd64-image-retry.log), [final](validation/final-hosted-amd64-image.log), [owned-process settlement](validation/final-build-settlement.json). No image gate pass is inferred from partial nested output.

[Invalid detached reports](validation/invalid-detached-ast-report/) and the earlier [639827bc report archive](validation/639827bc-valid-ast-report/) are historical. Only top-level `ast-report/` final reports at `4a761fec/2b3ad13b` support this candidate. Process exit 1 retains Delta/Review goal misses; required CRAP and Architecture pass. Raw V8 coverage files are excluded; capture manifests, normalized coverage and provenance remain. No `.env`, credential file or node_modules is included.

Root published `a9629766` ancestry to `codex/ui-stack-review-source-a9629766`, verified the remote head and GitHub Contents reads at 7acd/2ec/2189/a962, and recorded [publication proof](review/source-review-publication.json). Original source audit links remain unchanged; their remote-ancestry hold is resolved. See [packaging scope](review/packaging-note.md).

## Integrity and scan

[SHA256SUMS](SHA256SUMS) covers each bundled file except itself. [Credential scan result](review/credential-scan.json) records the configured-value and WorkOS-prefix scan scope. It prints no secret values; it is a bounded scan, not proof that every possible secret format is absent.
