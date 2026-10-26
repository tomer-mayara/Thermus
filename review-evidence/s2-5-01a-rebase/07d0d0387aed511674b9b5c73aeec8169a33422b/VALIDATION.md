## Validation

Candidate: [`07d0d0387aed511674b9b5c73aeec8169a33422b`](https://github.com/tomer-mayara/Thermus/commit/07d0d0387aed511674b9b5c73aeec8169a33422b).
Trusted main merge base: [`581f30cfaa32b01399422b087b0f0bdc3b800f70`](https://github.com/tomer-mayara/Thermus/commit/581f30cfaa32b01399422b087b0f0bdc3b800f70).
This PR is based directly on main. All selected test/build gates pass.

The source gate head is `e1e55dc04f5afa1e46eab5946067683fa496aaa6`.
The final commit only updates the implementation record and adds the immutable
base-metric record. The [final input binding](review/final-input-binding.json)
verifies all 1,424 other original tracked file hashes and unchanged source/gate
inputs. Final snapshots, process, CRAP, impact and checker use the final comparison.
The original `122d65bf` results are historical; [original evidence](https://github.com/tomer-mayara/Thermus/tree/386056b73a9b8a01614a7299371b1c750b700db5/review-evidence/s2-5-01a/122d65bf1f035fc195792cc083732aa05c423c58)
and [prior PR text](review/initial-pr-history.json) remain intact.

The complete source candidate selects ordinary tests, type checking, portal
build, hosted/self-hosted gates, available WorkOS staging, public snapshots,
metrics and habit-hooks. [Selection and commands](review/test-selection.md).
Every passing test group below has zero failures, cancellations, skips and todos.
Focused groups overlap the ordinary suite; their counts are not additional unique tests.

| Check | Result | Evidence |
| --- | --- | --- |
| Conflict focus; all changed ordinary test files | 41/41; 181/181 pass. Both WorkOS changes are covered. | [Conflict log](checks/conflict-focused.log), [changed-file log](checks/changed-tests.log) |
| `npm test` | Exit 0; 4,906 backend and 49 portal tests pass. | [Log](checks/ordinary-1.log) |
| `npm run typecheck`; `npm run build:user-portal` | Both exit 0. | [Type](checks/typecheck-1.log), [portal](checks/portal-1.log) |
| `npm run test:hosted-live` | Retry 2 exits 0; 28/28 pass, fixture cleanup completes. Attempt 1 is retained below. | [Passing log](checks/hosted-live-2.log) |
| `npm run test:container` | Exit 0; 11/11 pass. | [Log](checks/native-container-1.log), [build log](checks/native-container-build-progress.log) |
| `npm run build:hosted` inside clean Linux AMD64 image | Pass: 3,159 backend unit, 29 portal unit, 20 portal acceptance, 1,103 integration, 119 selected acceptance/interface, and 13 renderer runtime tests; typecheck and portal build pass. | [Full nested build](checks/hosted-build-progress.log) |
| `npm run test:container:hosted` | Exit 0; 7/7 pass after the clean image build. | [Log](checks/hosted-container-1.log) |
| Public API snapshots | Emitter and final `--check` exit 0; 48 snapshots current. The emitter reports 33 ignored declaration diagnostics in two unlisted modules; full normal typecheck passes. | [Emitter](checks/api-surface-1.log), [final check](checks/final-api-check.log) |
| Source metrics and CRAP | Process exit 1 with all four sections complete: retained Delta/Review findings, CRAP/Architecture pass. Snapshots and CRAP exit 0; all 17 new/changed functions meet goals. | [Process](metrics/process.md), [CRAP](metrics/crap.json), [exit records](review/metrics-command-results.json) |
| Habit-hooks | Exit 1; all 235 retained findings have reasons. Snooze is `[]`. | [Log](checks/habit-hooks.log), [dispositions](review/quality-habit-dispositions.json) |
| Review-tier checker | Exit 0, T2 Need architect, preliminary local eligibility with no blockers. Required human architect approval is outstanding. | [Report](metrics/pr-review.json) |
| `git diff --check` | Pass. | [Manager sign-off](review/manager-review-final.json) |

**Failure and retry history.** [WorkOS attempt 1](checks/hosted-live-1.log)
exits 1 during fixture setup: `createUser` returns HTTP 408; 28 tests cancel,
0 pass, 0 fail, 0 skip/todo. No behavior case runs. The unchanged retry passes;
no assertions, source or timeouts were changed. Existing cleanup/retry setup
handles stale fixtures. The [gate ledger](review/gate-ledger.json) retains every
attempt, exit, time and log. [First-run metric reports](history/first-metrics)
remain unchanged after final pin refresh. Original acceptance-first failures
and SDK corrections remain in the historical journal. This rebase preserves
behavior and needs no manufactured red test.

**Coverage provenance.** Fresh complete unit capture exits 0: 3,159 backend
and 29 portal tests pass. Coverage has verified completion for 152 source files
and 433 processes, Node 24.20.0, TypeScript 7.0.2 and `own-characters-1`.
The [command record](review/coverage-command.json), [log](checks/coverage.log),
[coverage report](metrics/coverage.json) and original capture manifests are retained.
Final snapshots accept the unchanged source/input identity from the original
capture at `e1e55dc0`. The input binding records both fingerprints and the exact
two documentation/history changes. Base CRAP derived with head coverage is an
estimate. Raw V8 data is excluded from publication.

**Environment and limits.** The task-owned Docker VM and disk were removed
only after the gates and log capture finished. The default context and all six
original shared containers remain; four concurrent additions were left untouched.
[Cleanup](checks/colima-cleanup.log), [before](review/docker-before.json),
[after](review/docker-after.json). GitHub reports this head as conflict-free and
has no check runs/status contexts at the [recorded observation](review/final-ci-observation.json);
that observation does not replace local checks.

New deletion against live WorkOS remains S2.5-02; controlled-wire outcomes and
existing live reader journeys do not prove live deletion. Search-live, logging
PostgreSQL, Audit Collector and a separate renderer run are N/A for this increment;
the hosted offline build includes its renderer phase. No gate is deferred or
unavailable. No release, deployment or customer removal route is added.
The [evidence scan](secret-scan.json) checks exact configured WorkOS/Axiom secret
values and other loaded sensitive values without publishing them; it is not
exhaustive secret detection.

[Complete current evidence](.) · [Quality review](https://github.com/tomer-mayara/Thermus/pull/251#issuecomment-6394917737)
