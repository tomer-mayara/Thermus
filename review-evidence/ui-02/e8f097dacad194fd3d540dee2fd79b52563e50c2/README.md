# UI-02 review evidence

Candidate: [e8f097dacad194fd3d540dee2fd79b52563e50c2](https://github.com/tomer-mayara/Thermus/commit/e8f097dacad194fd3d540dee2fd79b52563e50c2).
Source candidate: [d742e14410a4e8ed0ccc9986a29d174936ffcf4b](https://github.com/tomer-mayara/Thermus/commit/d742e14410a4e8ed0ccc9986a29d174936ffcf4b).
Stack parent: [UI-01 / PR #263](https://github.com/tomer-mayara/Thermus/pull/263), at `a017020ebe2448f5de6cc7d9cbb0700367fc80b1`.
Main merge base: `57c99e2b892acea52bfc3a53aee61b5ae442bf46`.
PR: [#264](https://github.com/tomer-mayara/Thermus/pull/264).

UI-02 adds labelled member facts, a separate active-row heading, quiet Remove/Leave disclosures and trusted self naming. Existing removal authority, protected forms, recovery and approved help remain. UI-03/04 remain separate work. This record claims no merge, deployment or human approval.

## Validation

| Check | Result |
| --- | --- |
| Focused ordinary checks | 123 passed. |
| Members browser | 19 passed, including fresh JavaScript-off self/other Cancel/Confirm at 320/1280px and expanded confirmation at 481/600/860px. |
| Full ordinary suite | 5,131 ordinary and 49 portal tests passed. |
| Typecheck and portal build | Passed. |
| Hosted live | 29 passed in staging. Owned removal fixture cleanup completed with no failures. |
| Self-hosted container | 11 passed with outbound access denied. |
| Linux AMD64 hosted image and its fresh offline build | 7 runtime checks passed. Fresh offline build passed 3,301 unit + 49 portal + 1,158 integration + 119 acceptance + 13 renderer checks. Both compiled UI-02 modules match the local build. |
| Unit coverage | 3,301 emitted and 29 portal unit tests passed. This capture alone left the member-map callback unmeasured. |
| Integration coverage | 1,158 passed; the verified integration report resolves all changed/new function goals. |
| Habit-hooks | Exit 1 with reviewed retained findings; no snooze or suppression. See manager review for every reason. |
| Final checker | T1 Team review; locally eligible with no technical blocker and 49 public snapshots unchanged. Human approval remains required before merge. |

[Desktop preview](implementation/screenshots/members-normal-1280.png) ·
[Mobile preview](implementation/screenshots/members-normal-320.png) ·
[Expanded mobile action](implementation/screenshots/member-row-expanded-320.png) ·
[Manager review](validation/manager-review.md) ·
[Independent review](validation/independent-review.md) ·
[Final checker](validation/review-check.json).

## Provenance and history

The final commit after the source review only updates the implementation record.
[Candidate comparison](validation/final-candidate.json) verifies 860 tracked source,
test and selected build inputs against the precommit checks. The changed live test
ran before commit, as policy requires; its ledger truthfully records the earlier
HEAD and a dirty tree. Those tested input bytes became the source candidate. This
is staging evidence, not a production release proof. Live management refusal for
external/unknown sources remains a controlled proof; no directory or SSO setup
was created. Cleanup used only this run's exact owned IDs.

[Commands and red/green history](implementation/commands.txt) retain the initial
acceptance failures, the test-only TypeScript correction, assertion migrations,
the quiet-style failure and the 481px confirmation regression. No failing run is
claimed as a pass. [Initial PR evidence](validation/pr-history-initial.json) and
[preliminary checker](validation/review-check-preliminary.json) retain the draft
history. The preliminary checker lacked metric inputs; the current checker
supersedes it. The unit-only process and coverage are kept under validation with
the unit-coverage prefix. Its missing callback assessment is resolved by the
verified integration capture without a source change or metric exception.

The first hosted image build overlapped a metrics comparison that temporarily
checked out the parent revision. Its seven runtime passes are **invalid as
UI-02 evidence**: the image log has 1,157 integration tests and lacks the new
labelled-member case. Logs are retained with the invalid-comparison suffix. The
image gate was rerun from the verified final tree after comparisons stopped. An
extra [compiled-source proof](validation/hosted-image-source-proof.json) compares
both changed production modules in the final AMD64 image with the local build.

Main advanced to `c42aa8237b06e46df5f8d3914af6f4151f729e1a` with decision records and
a plan note during validation. The common ancestor stays `57c99e2b`; UI-01's head
stays `a017020e`. This PR stays on its requested stack parent. Results cover this
candidate, not an untested future integration with main.

## Quality and evidence limits

[Full process](ast-report/process.md), [process JSON](ast-report/process.json),
[review findings](ast-report/review.md), [CRAP](ast-report/crap.json),
[base snapshot](ast-report/snapshot-base.json), [head snapshot](ast-report/snapshot.json),
[normalized integration coverage](ast-report/coverage.json) and original capture
manifests are included. Report bytes are unchanged. Raw V8 captures remain local;
normalized reports and manifests retain the verified capture provenance. The
final process reuses compatible source/test inputs at the final documentation
commit. Coverage reports identify their actual captured revision and suite.

Delta and Review retain goal misses: the existing administration renderer has
MI 59.469 (parent 61.251), and tests retain one high MI finding and two low
Halstead estimates. All reasons are in manager review. Test files have no
production MI goal. Changed-function CRAP passes: removalForm 4, membersPage
3.00006, the member-map callback 3 and the other callback classified new 1.
No unknown function or required exception remains.

Architecture is unchanged inside Web. The 15 registry views and prose remain
byte-identical; no L3 comparison or L4 detail is needed. The global graph retains
one unresolved CSS import; it is not a complete graph proof. The public snapshot
emitter ignored 33 diagnostics in two unlisted files under its policy; complete
application typecheck passed. The process writes no metric history for this
unmerged stack parent because it is not on origin/main. Base values that use
head coverage are estimates, not measured base coverage.

The inventory row in test-gate-policy.md selects T1 through the trusted read-path
rule. It changes no command, selection, guarantee or approval authority. Pending
current-candidate owner/team approval keeps overall merge status blocked. The
local eligibility result does not supply that approval.

The inherited UI-01 findings and complete-stack context remain in its
[pinned evidence](https://github.com/tomer-mayara/Thermus/blob/4c4b5e15e4203548da6977fc0636334ef8fb8af4/review-evidence/ui-01/a017020ebe2448f5de6cc7d9cbb0700367fc80b1/README.md).
The parent layout module and its retained MI finding are unchanged by UI-02.

Dedicated SQL, Collector and Search-live gates are not selected: this increment
does not change their source or test helpers. PostgreSQL used by the staging
removal proof is disposable. Production release checks are not selected by this
implementation request. Renderer checks run inside the required hosted image's
offline build. No extra standalone npm run check is run.

Credential launchers, environment files and raw V8 capture files are excluded.
Known configured credential values are scanned before publication. SHA256SUMS
records the retained bytes.
