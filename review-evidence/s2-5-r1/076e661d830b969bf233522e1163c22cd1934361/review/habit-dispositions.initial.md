# S2.5-R1 Habit Hooks dispositions — initial report draft

Actual parent: `0530dd634fe8302b55d4a0669463ef733199cc40`. Full-stack main merge base: `9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.
Working HEAD: `1a192d743a4c71ae6faebfd00f7ae6fd4c72ea0e` plus uncommitted changes; this is not a final SHA binding.
Initial report: `.cache/s25-r1/habit-hooks-initial.log`; SHA-256 `9ebcdabb0dffbb2a0c950fa8e22d6d11634d47842428f97bcf1e383b170b507d`.
Counts: seven complexity, one non-null assertion, five parameter, 436 comment and
17 size findings (466 total). A final hook rerun is pending.

The [full per-location inventory](habit-dispositions.json) preserves every current
location, reviewed line text/file hash, actual-parent relationship, disposition,
reason and prior evidence. It retains the inherited reasons and provenance from
[the immutable S2.5-02 inventory](https://github.com/tomer-mayara/Thermus/blob/339b5716dab08f2195c2d88330a7707b776fca52/review-evidence/s2-5-02/806ccc573c6ae09c411a47a755d6dd9316343f8f/review/habit-dispositions.json), including that review's earlier
inheritance and correction history. 366 findings reuse reasons only after exact
whole-file equality. Findings in the changed source/test files were reviewed
against the current delta; their inherited reasons remain available separately.
Age alone is not a retention reason. This full-branch report contains earlier
stack work; it is not a claim that R1 introduces all 466 findings.

The one new non-null assertion is **slated for correction, not retained**:
`test/unit/auth-workos/workos-organizations-member-facts.test.ts:71` dereferences
`first!`. An explicit presence assertion must precede required field access,
then the affected case and hook must rerun. This draft does not claim the fix.

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
no hook, build or gate; it reviewed the manager's initial log and current bytes.
Metrics, final gates/checker, final SHA binding and independent current-head
human architect approval remain pending. Replace local cache paths with retained
accessible artifact links before publishing review evidence.
