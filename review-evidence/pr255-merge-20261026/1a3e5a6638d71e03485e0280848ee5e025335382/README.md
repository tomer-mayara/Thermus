# PR #255 current BLOCKED evidence package

Candidate `1a3e5a6638d71e03485e0280848ee5e025335382`; actual parent `ddad19589a13e40b1aea516b2e5e3b90ea3aec70`; complete-stack main `8c6d204e8588a664438ba8934ab36670b802525f`. **Keep Draft; merge blocked.** Fresh static checker is T1 Team review, Architecture T0: no architecture fact. It cannot pass red runtime validation.

## Current evidence

- [Blocked runtime handback](runtime/final-handback-1a3e5a66/blocked-runtime-handback.md), [captured final binding](runtime/final-handback-1a3e5a66/blocked-runtime-final-binding.json), [manager acceptance of blocked evidence](validation/manager-blocked-validation-review.json)
- [Fresh static quality](quality/final-1a3e5a66/measurements/quality-review.json), [current checker](quality/final-1a3e5a66/measurements/pr-review.json), [all Habit reasons](quality/final-1a3e5a66/measurements/habit-dispositions.json), [manager quality review](quality/manager-quality-review-1a3e5a66.json), [exact precommit bridge](quality/final-1a3e5a66/committed-input-bridge.json)
- [Current architecture bridge](architecture/fixture-integration-bridge-1a3e5a66.json), [manager bridge review](architecture/manager-bridge-review-1a3e5a66.json), [current summary](architecture/summary-comparison-1a3e5a66.md), [conditional selection](validation/selection-prospective.md)
- [First live redacted outcomes](runtime/attempt-2/hosted-live.public-redacted.log), [first phase review](runtime/attempt-2/failure-diagnosis.md), [first manager review](runtime/manager-first-live-failure-review.json)
- [Single retry redacted outcomes](runtime/attempt-3/hosted-live.public-redacted.log), [retry phase review](runtime/attempt-3/failure-diagnosis.md), [retry manager review](runtime/manager-second-live-failure-review.json), [dated provider-status observation](runtime/provider-status-observation.json)
- [Final authoritative cleanup summary](runtime/cleanup-final/final-cleanup-summary-safe.json), [independent manager cleanup review](runtime/manager-final-cleanup-review.json), [redacted event journal](runtime/cleanup-final/cleanup-journal.public-redacted.jsonl), [fixed-port release](runtime/cleanup-final/fixed-port-release.json)
- [Frozen legal/hash/source-pin review](review/legal-manifest-review.json), [document limits](review/document-link-review.md)

Integration passed 1,149 cases. Focused 4/4 and PostgreSQL 26/26 retain their exact precommit execution identity through the accepted commit bridge. Original adf PostgreSQL 25/26 red remains [historical evidence](history/runtime-attempt-1/failure-review.json). Both current live runs failed: first 25/29; retry 26/30 raw with a synthetic after-hook case. Public Connect never started. Cleanup of the final reviewed scope confirms all 52 exact-owned resources absent (12 scoped, 40 legacy), with no DELETE retry. Cleanup success does not pass runtime. No common root cause or announced outage is established.

## Privacy and historical records

Raw live/provider errors and private cleanup inventories/journals remain local. Public outcome logs omit 110/134 non-outcome lines; three journal copies pseudonymize IDs and omit non-allowlisted fields. They are **not byte-identical** to raw evidence. [Full raw/public hashes, omission ranges and counts](runtime/public-redaction-provenance.json) retain the distinction. Private alias mapping, generated passwords, invitation tokens, cookies and query/HTTP-header material are excluded. Safe phase reviews retain material observed failures, unreached assertions and bounded recovery.

The [earlier stopped cleanup summary](history/earlier-stopped-cleanup/cleanup-summary-safe.json) and [earlier handback](history/earlier-stopped-cleanup/runtime-handback.md) report three organizations pending. They are historical and superseded only by the final safe summary; original bytes remain unchanged. Source quality review's in-progress runtime wording is likewise dated; use the current blocked handback for final status.

The complete old adf publication package is preserved locally under `pr255/publication-history/adf3369a953792208b5c48b8776d3bfeb89c3fb7/`. Its original metadata/paths are historical provenance; the directory moved without rewriting its bytes. This stage retains [old package metadata](history/adf-publication/metadata.json), [old guard](history/adf-publication/HISTORICAL-NOT-CURRENT.md), [old static quality](history/adf-static-quality/README.md) and [initial PR/comments](history/initial-pr-stack-state.json). They are not current 1a reports. All other copied bytes retain original pins/cwd/hashes; copying is not another run.

## Review text and remaining gates

[Main description](publication-drafts/main-body.md), [Validation](publication-drafts/validation-comment.md), [Quality review](publication-drafts/quality-review-comment.md). Maintain exactly the existing two comments. Templates use `%%EVIDENCE_ROOT%%` pending separately authorized publication/readback. The source-free selection remains prospective until parent integration and complete-candidate recheck; full-main stack still inherits source gates. Production metrics/coverage are N/A for this increment and no irrelevant native report is fabricated.

Frozen legal proposal is unapproved/unpublished; date and historical-source-pin conditions remain open. Later R1, parent integration, independent human merge approval and Render deployment containment remain separate. Truthful Draft/evidence publication can support review with approval pending; this package authorizes no push, Ready, merge or release. Manager must inspect redactions, scan exact final artifacts/texts and approve their bytes before any publication.

[Provenance](provenance.json), [inventory](inventory.json), [authored links](link-review.json) define the public boundary. No working production source tree, raw V8/profile, private fixture inventory, raw live error, environment/credential or unrelated user draft file is included.
