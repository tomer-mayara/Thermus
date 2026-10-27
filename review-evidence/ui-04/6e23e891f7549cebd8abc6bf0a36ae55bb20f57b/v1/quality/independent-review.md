# Independent UI-04 rebase quality review

Candidate: `6e23e891f7549cebd8abc6bf0a36ae55bb20f57b`.
Base: `0377cd12022d0c6fa9250107bc89aeaf9c457423` (`origin/main` at analysis start; actual merge base remains `0377cd12` after target main advances to `6d6adcc3`).

The behavior-preserving rebase is accepted within this review scope. All six replayed patches compare equal. Source, tests, manifests and build configuration equal old UI-04 `057434b9c3ad313f656b03e033866cdecab7ae51`. Only four document/history files differ from that old head. No source, test, git, remote service or approval was changed by this reviewer. No suite, build, coverage collector, provider call or paid workflow was run.

## Native evidence

Node 24.20.0; base/head snapshots exit 0. Final process exit 1: completed Delta goal miss; Review, CRAP and Architecture pass. Standalone CRAP exit 0. Habit-hooks exit 1 with 42 retained findings. Checker exit 0: **T1 Team review**, local **eligible**, no local blockers. Architecture line: **T0: no architecture fact**. T1 reason: protected read path `docs/implementation/test-gate-policy.md`. This local result does not remove the current hosted-live gate or current-head independent human approval requirement. Keep Draft and overall blocked.

Native coverage reuse passed without editing report or captures: integration coverage captured at `057434b9c3ad313f656b03e033866cdecab7ae51`, from `/Users/tomermayara/.codex/worktrees/ui-stack-validation-02/Thermus/ast-report/coverage.json`. Its native source/input fingerprints match the fresh current snapshot. The default worktree report is an incompatible older `3380afe6` capture; native compatibility rejected it before the correct report was selected. Do not describe either historical report as a fresh execution at the new candidate. The 3380 bundle's live execution history remains dirty `474ae117`, with its recorded 923-input rebind; this is distinct from the newer 057 native coverage capture.

Two interim process attempts at a64 failed native Delta comparison while the tracked document was uncommitted. Those are tool failures, not goal misses. The clean dcd9 retry completed all four sections and generated immutable `docs/metrics/2026-10-27-0377cd12.json`; the root committed it. Final native process completed on the final clean head. Logs and preliminary reports remain alongside final evidence. Default ast-report files were restored from the untouched backup after final outputs were copied to `final-native-output/`. That copy retains the default older coverage file only as default artifact context; final metrics used the explicit compatible external report above.

## Retained metrics

Existing `administration-pages.ts` MI 59.20233572948304 → 57.90663211767644. Retain cohesive Members and invitation HTML at its existing owner; counted disclosure and compact escaped forms add template volume. Required functions have at most four paths; a mechanical split adds no behavioral value. No new low-MI file or five-point existing-file drop. Static `members-style.ts` has no functions or raw MI in complete snapshots; MI/CRAP are N/A, with browser verification owned by root.

Required CRAP: `membersPage` 4.000221184 at 97.6%; `invitationRow` 1 at 100%; new callbacks 2 and 1 at 100%. Zero required misses, unknown identities or unknown assessments. Unchanged rows retain “unchanged by this PR.” Base coverage is a head-derived estimate. No exception or baseline change.

Three low Halstead notes are retained:
- `test/acceptance/auth/hosted-invitations.test.ts`, 0.82 → 1.22: counted disclosure, compact row facts and complete-read failure specifications add volume; this is no observed defect.
- `test/acceptance/auth/hosted-members.test.ts`, 2.44 → 2.71: assertions distinguish displayed active members and pending entries while retaining seat/access rules.
- `test/integration/hosted-admin/account-routes-administration-pages.test.ts`, 4.09 → 5.08: keep related zero/nonzero state, protected forms, accessible labels, order and expiry contract checks together.

Native whole-tree review also sees three ignored cache artifacts. They are absent from the committed candidate and are not product changes:
- `.cache/ui-stack-finish/local-image/worker-preparation/run-image.py`: medium `new-violation:cyclomatic_complexity`, 49 against 40. This is retained local image preparation evidence outside the candidate; no product exception is used.
- `.cache/ui-stack-review/ui02-original/administration-pages.ts`: low `new-violation:efferent_coupling`, 11 against 10. Historical UI02 comparison copy outside the candidate.
- `.cache/ui-stack-review/ui02-runtime/administration-pages.ts`: same low rule and 11 against 10. Historical UI02 comparison copy outside the candidate.

Do not suppress these by editing native reports. Review gate passes: zero high findings, one medium and five low, including the cache artifacts.

## Habit and architecture

All 42 habit findings and their reasons remain applicable. `retained-habit-reasons.md` and the full previous maintained Quality comment retain every individual reason; integration test lines shifted, so the current raw log is the line authority. The seven non-null assertions are test observations that fail on missing required DOM/fixture values; they do not create a success fallback. The 31 comments state safety, protocol or fixture constraints. Four oversized test files keep related journey/contract coverage together. Snooze stays `[]`; no suppression or performance exception.

All 15 registry Mermaid blocks and the complete registry bytes equal the base. All 49 public modules are checked, zero declaration snapshots changed. No architecture facts, new component/dependency, callable signature, remote operation, store or deployment change. Web retains complete safe reads, the same authority and protected action fields. Pending rows retain role and absolute UTC expiry; help retains its full text/version/hash. Existing registry responsibilities remain accurate. L3 comparison is unnecessary for unchanged architecture; no changed callable contract needs L4.

Native graph evidence remains incomplete on both sides because `src/interfaces/user-portal/main.ts → ./style.css` is unresolved-local. Additional dependencies/cycles may exist, so edge/cycle deltas are withheld. Global unchanged-function coverage remains incomplete; do not infer full coverage or complete graph proof. Trend gaps and estimates remain visible in the full process report. Checker informational note “49 public modules, 0 snapshots changed” is retained as direct contract evidence. Local eligible is preliminary, not human approval or merge authority.

## Target advancement observation

After native analysis, target main advanced to `6d6adcc31778e1df623a04bd1e7ab43e15875dbb` through PR #271. Independent Git comparison confirms that its 24 changed paths are disjoint from the candidate’s 20 paths. They contain Render probe scripts, `knip.json` and self-onboarding documents only; no `src/`, `test/`, package manifest/lockfile, AGENTS, review rules or test-gate path changed. The actual merge base with candidate `6e23e891` remains `0377cd12`. This observes target advancement only. It is not a new tested head or validation of unrelated PR #271. No source or gate rerun is needed for this requested rebase without merge; native reports remain unchanged.
