# PR #292 review evidence

Candidate: `8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0`.
Trusted base: `21458b0d18cc4f9efd3a59f6361a86f1acdc317c`.
Source/capture candidate: `b0ec502e8a7362bd03d82012b80362f7960c4430`.
The final commit adds only `docs/metrics/2026-10-28-21458b0d.json`.

**Draft; overall merge blocked by the required AMD64 retry pass and final
eligibility sign-off.** The final checker selects T0 Auto merge,
preliminary eligible, no blockers, with `T0: no architecture fact`. That local
result does not replace the failed/running image gate or manager verification.

## Maintained report sources

- [Main body](pr-body.md), 200–300 words.
- [Validation](pr-validation.md), the one maintained comment
  [6483742111](https://github.com/tomer-mayara/Thermus/pull/292#issuecomment-6483742111).
- [Quality review](pr-quality.md), the one maintained comment
  [6483742406](https://github.com/tomer-mayara/Thermus/pull/292#issuecomment-6483742406).

Only `{{EVIDENCE_BASE}}` remains unresolved in these current report sources;
it must be an accessible retained artifact root mirroring this directory.
The prior sources are retained under [history](history/before-final-8eb8d345/README.md),
not silently replaced as if earlier pending evidence had passed.

## Results and holds

Fresh focused 14/14, Chromium 2/2, ordinary 5,685 Node + 60 portal,
typecheck/portal build, self-hosted container 11/11, and native hosted offline
5,174 emitted tests pass. The AMD64 first attempt failed at its unchanged inner
integration JWKS error assertion (1,218 pass/1 fail); final runtime image proofs
were not reached. The manager reviewed the source and authorized one full
unchanged retry after heavy primary work completed. Attempt 2's fresh unit/portal
groups pass (3,693 + 39 + 21), and integration is running.
Original `03*` and versioned `environment-gates/attempt-1` records are retained.
No all-checks-green, no-retry, final-image-pass, or merge claim is made.

Coverage passed and is verified for unit + integration: 241 files and 813
processes, captured at `b0ec502e`. Final process accepts its source/input
compatibility without restamping coverage. Delta retains unchanged content MI
53.95041254701023 below 85; Review, CRAP, and Architecture pass. Seven unchanged
functions have 100% captured coverage and CRAP 1–6. Habit-hooks exits 0 with no
findings and snooze `[]`. The checker records 53 public modules/zero changed
snapshots and a declaration-scope stderr limit: 33 errors in two unlisted files
were ignored. Separate full typecheck passed; the warning is not called resolved.

The base-snapshot wrapper initially overwrote data with exit metadata. The
metadata was preserved and a distinct-path rerun passed. This tooling recovery
is separate from the real AMD64 failure/retry. Native gates compared 754 frozen
inputs with `b0ec502e`, all matched, and their isolated checkout was archived.
[Final manager input binding](final-input-binding.json) now confirms all 754
inputs unchanged at `8eb8d345`. [Initial manager review](manager-review-initial.md)
records implementation review and the remaining image hold.

Use [independent source review](independent-review.md),
[focused/browser notes](validation-notes.md), [source freeze](source-freeze.json),
[process](process.json), [CRAP](crap.json), [checker](checker.json),
[coverage](coverage.json), and the failure/retry artifacts as the full record.
Generated `review.md`/`review.json` remain machine reports, not the independent
review file. No tracked files or test/metric reports were changed by this
report refresh.

## Authorized operational follow-through

After eligible merge, deploy through the existing Render Git service and retain
merged/deployed commit, deployment ID, health, and public access. This is not an
image-runtime cutover or self-hosted evaluation-image release. Hosted-live is
N/A because no auth/WorkOS behavior or live helper changes in this increment.

The current production browser is denied Quick start access and offered one
already-selected organization; no role/selection/credential changed and its
temporary tab was closed. Positive UI evidence is from fresh local Admin tests
and screenshots. Retain [the production access limit](browser-access-limit.md);
verification does not require a permission change or bypass for a positive
production Admin view. No deployment completion is claimed yet.

Before Ready/publication, the manager must record the actual image retry result,
complete the final eligibility sign-off, verify artifact URLs, retain
history, and read back the same main body and two maintained comments.
