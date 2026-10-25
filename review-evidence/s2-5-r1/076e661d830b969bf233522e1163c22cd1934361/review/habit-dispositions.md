# S2.5-R1 Habit Hooks dispositions — final candidate

Actual parent: `0530dd634fe8302b55d4a0669463ef733199cc40`. Full-stack main merge base: `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.
Candidate: `076e661d830b969bf233522e1163c22cd1934361`. Final committed source hashes and all 465
reported line bounds match this inventory. Working drafts remain archived.
Final report: `.cache/s25-r1/habit-hooks-final.log`; SHA-256
`aba75fc73019d8f5c3d6cb31d0e6a000158431c3bc57ca30a936137ac0adc5b4`. Manager reports exit 1 from retained findings.
Counts: seven complexity, five parameter, 436 comment and 17 size findings
(465 total). No non-null assertion remains; snooze is `[]`.
The initial 466-finding inventory is retained as `habit-dispositions.initial.json`
and `.md`, with the original log/hash and the assertion-fix history.

The [full per-location inventory](habit-dispositions.json) preserves every current
location, reviewed line text/file hash, actual-parent relationship, disposition,
reason and prior evidence. It retains the inherited reasons and provenance from
[the immutable S2.5-02 inventory](https://github.com/tomer-mayara/Thermus/blob/339b5716dab08f2195c2d88330a7707b776fca52/review-evidence/s2-5-02/806ccc573c6ae09c411a47a755d6dd9316343f8f/review/habit-dispositions.json), including that review's earlier
inheritance and correction history. 366 findings reuse reasons only after exact
whole-file equality. Findings in the changed source/test files were reviewed
against the current delta; their inherited reasons remain available separately.
Age alone is not a retention reason. This full-branch report contains earlier
stack work; it is not a claim that R1 introduces all 465 retained findings.

The one new non-null assertion is **corrected, not retained**. The original
`first!` finding at `workos-organizations-member-facts.test.ts:71` is preserved in
`habit-dispositions.initial.json`. The current source explicitly checks both
`first` and `second` before reading required fields. The exact direct facts test
in `facts-test-cleanup.log` reports 19 passes and zero failures, cancellations,
skips or todo cases. The JSON retains source/log hashes. The final Habit Hooks report no longer lists the assertion. Complete-candidate
behavioral gates have passed; their maintained Validation record retains the
command/log binding. Fresh metrics/checker and human approval remain manager work.

The new comment at `organization-directory.ts:106` states a network-work
constraint that the return type cannot express: facts pages make no display-user
reads and keep the scope/stop rules. Retain it at that public operation.
The provider comment at `workos-organizations.ts:271` now says **display** member
read. This is a useful clarification: provider membership JSON has no email,
while the new facts path avoids the individual user lookup. Moved comments in
the directory, WorkOS adapter and stateful double retain explicit authority,
raw-management, revision, provider-default, cursor/failure and stop semantics.
The JSON gives old/new locations and each reason. No new comment suppression.

The existing four-argument `checkRemoval` still receives separate directory,
authenticated actor, exact request and guarded-lifetime roles. R1 changes its
page call, not those roles; a parameter bag would hide the same coupling.
All seven complexity findings are in files unchanged from the actual R1 parent;
retain their specific inherited responsibility reasons. They remain visible as
full-stack findings and are not a new R1 complexity exception.

Three reported size files change in R1:

- WorkOS adapter: 440 → 455 lines. Keep one provider mapping/guard owner. The new
  explicit facts page and shared synchronous projection preserve the display
  distinction and avoid duplicating management/grant/revision logic.
- Removal lifetime suite: 230 → 230 lines. The pause/failure seams now use facts;
  the independent timing cases retain one deadline/close/late-work invariant.
- Removal rule suite: 213 → 226 lines. New safety-field dimensions and a
  display-path refusal case belong with current target reconciliation and the
  complete Admin count. A line-count split would scatter that same contract.

The other 14 size findings are unchanged from the actual parent and retain their
per-location substantive reasons in the JSON, including the ordered integrated
and exact-resource live journeys. Do not repeat their giant tables in the PR.

Snooze is `[]`. No suppression or threshold-only split was made. This worker ran
no hook, build or gate; it reviewed the manager's final log and verified that all
465 active locations still match their reviewed source hashes at the exact final
candidate. Selected behavioral gates pass. Fresh metrics/checker and independent
current-head human architect approval remain manager-owned. Replace local cache paths with retained
accessible artifact links before publishing review evidence.
