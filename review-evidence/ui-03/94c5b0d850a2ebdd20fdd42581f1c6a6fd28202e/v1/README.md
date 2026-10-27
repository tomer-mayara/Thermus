# UI-03 rebase evidence

Candidate `94c5b0d850a2ebdd20fdd42581f1c6a6fd28202e` is rebased onto main `2282edd46c2b4546150d6a06d53c3377e2e624f8`, the UI-02 squash merge. PR #266 remains Draft. GitHub reports the source branch as conflict-free. This evidence publication changes no application files.

The old parent and new main have identical trees. Both UI-03 patches replay unchanged. The old head and initial replay also have identical trees. The final candidate adds only the required generated base metric history record and an updated implementation note. See the [input proof](review/rebase-proof.json), [range comparison](review/rebase-range-diff.txt), and [manager review](review/manager-review.json).

Fresh typecheck, portal build, server build and all 51 Members browser cases passed at `2a5da5dc95df705ac9cffce885aec1a19fc90bd1`. The final commit contains document-only changes; these results retain their actual execution revision. See the [check summary](validation/fresh-checks.json) and raw logs in [validation](validation).

The final-head [checker](quality/checker.json) reports T1 Team review, no architecture facts and no mechanical blockers. [CRAP](quality/crap.json) passes. The [quality process](quality/process.md) completes with retained Delta/Review goal misses, and [habit-hooks](quality/habit-hooks.log) retains 35 findings with unchanged reasons. These are not wholly green command exits. The [summary](quality/review-summary.json) records exact results. Historical aa8 coverage was reused without edits after native compatibility validation; no coverage was collected in this rebase pass.

[Pre-rebase bodies](history) preserve prior evidence and approval history. The [publication drafts](publication-drafts) retain the applicable findings, reasons, limitations, and links to the historical native and local image evidence. `EVIDENCE_ROOT` is a draft placeholder for this immutable folder, not an unresolved production value.

The complete selected hosted-live group and independent human approval of the new head remain outstanding. The last recorded WorkOS support response was an automated receipt, without quota or reset confirmation. Historical approval applies to `aa8c56bb7e195e97d2362b2c661cc63a760a5cc9` only. Nothing here waives a gate, asserts new live success, or records a merge or deployment.

The generated base history record is committed in the candidate. The main and supporting comment drafts preserve full prior run IDs and limits. [SHA256SUMS](SHA256SUMS) covers every artifact in this folder except the manifest itself.
