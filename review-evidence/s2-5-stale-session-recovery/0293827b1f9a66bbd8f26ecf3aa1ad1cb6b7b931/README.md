# Stale browser-session recovery review evidence

Final candidate: 0293827b1f9a66bbd8f26ecf3aa1ad1cb6b7b931. Tested source: c8b12419a812534d93343eb24248d70de7cf828e. Trusted base: c9da79e63406e71dd15032d4ab9dfb85f2766918. PR: https://github.com/tomer-mayara/Thermus/pull/261. The final commit changes only validation text and the untouched generated base record; source, tests, packages and Docker build inputs are identical to the fully tested source.

The exact WorkOS OAuth 400 membership-not-found error during automatic expired-session refresh now clears the local cookie and uses existing sign-in-required responses. Other refresh results/errors and explicit switching keep their handling. No alternate workspace is chosen automatically and no removal is replayed.

## Validation

Both public BDD cases failed 500 versus 401 before the source patch; unit and pinned-SDK positives also failed. [Red BDD](bdd-red.log), [red unit/SDK](tdd-red.log), [43 focused green cases](precommit-green.log). [Validation and provenance](validation.json) records fresh ordinary 5,127 + 49, typecheck, portal, native 11, AMD64 image 7 / offline 3,301 + 29 + 20 + 1,156 + 119 + 13, guarded staging 29, and 48 exact owned-root 404 readbacks. The failed native 9/11 permission attempt and successful full retry are preserved. Builds use readable fixture permissions; evidence files stay private.

Final metrics [process](metrics/process.md) explicitly reuses unchanged verified source coverage. The process exits 1 only for the existing browser-session file MI 62.6; Review, CRAP and Architecture pass. Changed/new CRAP values are 4, about 3, and 3. The [final checker](checker.json) is T1 Team review, locally eligible, no blockers, Architecture: T0 no architecture fact. All 49 declarations and 15 registry views are unchanged. [Full source quality dispositions](quality-summary-source.md) retain both low test-volume findings, MI rationale, evidence caveats and inherited global limits without repeating tables here. [Habit comment dispositions](habit-hooks-dispositions.json) cover all 29 advisories; final hook exits 0 and snooze stays empty.

The [manager review](manager-review.json) and [direct owner authorization](authorization.json) bind the exact human instruction at tested source c8 to the final source-equivalent head. No submitted GitHub review or prior 2c approval is claimed. Manager sign-off is a separate agent review of the complete candidate. Publication readback/Ready do not themselves deploy. Merge, deployment and actual expired-session production recovery proof remain with the manager.

Operational resource IDs, keys and journals remain private. Full machine-readable metric reports are unedited; [coverage](metrics/coverage.json) retains its original measured c8 commit and capture identity. Raw V8 captures and complete operational evidence remain in the private local handoff; no unverified coverage metadata was rewritten.
