# UI-04 rebase evidence

Candidate `6e23e891f7549cebd8abc6bf0a36ae55bb20f57b` is rebased onto merged PR #266 at `0377cd12022d0c6fa9250107bc89aeaf9c457423`. PR #268 now targets main and remains Draft. Source is pushed; GitHub reports no conflicts. Main later advanced to `6d6adcc31778e1df623a04bd1e7ab43e15875dbb` with unrelated tool/document changes; the actual merge base remains the pinned PR #266 merge. No merge or deployment was performed.

All six original UI-04 patches replay unchanged. Only four documentation/history files differ from old `057434b9`: the inherited UI-03 note and base history, plus the UI-04 rebase note and generated main-base history. Application, test, dependency and build inputs remain identical. See [input proof](review/rebase-proof.json), [range comparison](review/rebase-range-diff.txt) and [manager review](review/manager-review.json).

Fresh typecheck, portal/server builds and all 71 Members browser cases passed at `a64bf2f80f96ea54afcb61ad3e8a3aeddf07d787`, before document-only finalization. [Command records](validation/fresh-build-browser-record.json) and [logs](validation) retain that execution pin. Prior complete-suite and local image results remain historical with unchanged inputs, not fresh final-head executions.

The [checker](quality/checker.json) reports T1 Team review, no architecture facts and no mechanical blockers. Snapshots and CRAP pass. [Process](quality/process.md) exit 1 retains the existing-file MI goal miss; Review, CRAP and Architecture pass. [Habit-hooks](quality/habit-hooks.log) retains 42 findings. [Independent review](quality/independent-review.md) explains every class of finding and three ignored-cache artifacts outside the candidate. Native reports are unchanged.

[Execution history](quality/execution-summary.json) records the rejected older default coverage and two interim native Delta tool failures before a clean retry. Final coverage reused a compatible unmodified 057 integration capture. No coverage was collected. The generated `docs/metrics/2026-10-27-0377cd12.json` is committed unchanged in the candidate.

[Prior exact PR/comment bodies](history) preserve original live, image, native and approval history. The [publication drafts](publication-drafts) preserve all retained finding reasons and original artifact links. `EVIDENCE_ROOT` is a draft placeholder for this immutable folder.

Current hosted-live validation and independent human approval of the new head remain outstanding. Historical six quota HTTP 429 failures are distinct from the separate application HTTP 503 with an unproven provider cause. No current capacity or live pass is inferred. Old exact-057 approval is history only. No new paid resources, provider writes, cloud image checks, merge or deployment occurred.

[SHA256SUMS](SHA256SUMS) covers all files except itself.
