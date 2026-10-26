## Validation

Candidate: [`f03a7b73b2c27dc26477d5378a3356f28744a367`](https://github.com/tomer-mayara/Thermus/commit/f03a7b73b2c27dc26477d5378a3356f28744a367). Main merge base: [`8c6d204e8588a664438ba8934ab36670b802525f`](https://github.com/tomer-mayara/Thermus/commit/8c6d204e8588a664438ba8934ab36670b802525f). **Blocked Draft: the required PostgreSQL gate fails; human architect approval is pending.**

Gates ran at `fd7fa0b1e53d653f92168b75ba4d65618a9138a8`. The final candidate adds only the reviewed implementation note and immutable base-metric record. The [input binding](review/final-input-binding.json) verifies all 1,425 other original tracked files and all original runtime/build inputs. Coverage keeps its original capture commit. The [rebase review](review/rebase-review.json) proves the source/test delta from the prior PR head is exactly upstream. [Prior evidence](https://github.com/tomer-mayara/Thermus/tree/9a206af7fd3385c697b65903ab7f39e3fab39fea/review-evidence/s2-5-01a-rebase/07d0d0387aed511674b9b5c73aeec8169a33422b) and [prior PR text](review/pr-history-initial.json) remain historical.

[Complete selection and commands](tooling/validation/selection.md). Passing groups have zero failures, cancellations, skips and todos. Focused and nested counts overlap other groups.

| Check | Result | Evidence |
| --- | --- | --- |
| Locked install; runtime | Pass; Node 24.20.0 | [Install](checks/install-1.log), [runtime](checks/runtime-1.log) |
| Public API snapshots | Pass; 48 current. Emitter ignores 33 declaration diagnostics in two unlisted files; full typecheck passes. | [Log](checks/api-surface-1.log) |
| All 11 changed ordinary files | 181/181 pass | [Log](checks/focused-1.log) |
| `npm test` | 4,911 backend and 49 portal pass | [Log](checks/ordinary-1.log) |
| Typecheck; portal build | Both pass | [Type](checks/typecheck-1.log), [portal](checks/portal-1.log) |
| WorkOS hosted-live | 28/28 pass | [Log](checks/hosted-live-1.log) |
| Self-hosted container | 11/11 pass | [Log](checks/native-container-1.log) |
| Hosted Linux AMD64 container | 7/7 pass | [Log](checks/hosted-container-1.log) |
| Nested `build:hosted` | Fresh network-disabled checks: 3,164 backend unit, 29 portal unit, 20 portal acceptance, 1,103 integration, 119 acceptance/interface and 13 renderer cases pass; typecheck, portal build and runtime verification pass. | [Full build](checks/docker-build-1792988265831-47121.log), [manager review](review/hosted-build-review.json) |
| PostgreSQL | **12/13 pass; 1 failure.** No cancel/skip/todo. | [Log](checks/logging-postgres-1.log) |
| Audit Collector | 10/10 pass | [Log](checks/logging-collector-1.log) |
| Coverage | Complete unit capture passes: 3,164 backend and 29 portal. | [Log](checks/coverage.log), [command](review/coverage-command.json) |
| Metrics | Process exits 1 with all four sections complete: retained Delta/Review findings; CRAP/Architecture pass. Snapshots and CRAP exit 0; all 17 changed/new function goals pass. | [Process](metrics/process.md), [CRAP](metrics/crap.json), [commands](review/metrics-command-results.json) |
| Habit Hooks | Exit 1; all 235 findings have reasons; snooze empty. | [Log](checks/habit-hooks.log), [reasons](quality/habit-dispositions.md) |
| Review checker | Exit 0; T2; preliminary local eligibility. This does not clear the failed gate or human approval hold. | [Report](metrics/pr-review.json) |
| Conflict/document checks | `git diff --check` and 252 local document links pass. | [Manager review](review/manager-review-final.json) |

**Failure history.** PostgreSQL attempt 1 fails `settingsFinished` (`true !== false`) in the enabled-export storage-outage case. Later health/sender/shutdown assertions are not reached. An unchanged [focused retry](checks/quality-postgres-focused.log) also fails: one pass/one fail of two. An isolated archive of exact main builds and reproduces the same assertion: one pass/one fail of two, no cancel/skip/todo. [Baseline proof](review/validation/baseline-diagnostic.json), [build](review/validation/baseline-build.log), [test](review/validation/baseline-hosted-storage-failure.log), [diagnosis](review/validation/failure-review.md).

The main diagnostic uses pinned Node, locked dependencies, the tracked offline portal fixture, owned Docker context and no real WorkOS/Axiom settings. All 817 archived inputs remained unchanged. The test's old warm-up assumption and mutable read observers conflict with first-event retention; exact per-read order was not instrumented. This rebase leaves that baseline fixture unchanged. The [blocked-Draft disposition](review/blocked-draft.json) preserves the failure; it is not a waiver. All gate attempts remain in the [ledger](review/gate-ledger.json). [First metrics](history/first-metrics/process.md) and their original commands/logs remain intact before final pin refresh. Original BDD/TDD red tests remain in prior evidence; this rebase adds no behavior requiring a new test.

**Coverage provenance.** Fresh verified unit capture at `138e7ad6ce7310a19daa784f72c049a5a438bca1` covers 152 source files and 433 processes with Node 24.20.0, TypeScript 7.0.2 and `own-characters-1`. The [coverage report](metrics/coverage.json) retains the original capture identity; original capture manifests accompany it. Final snapshots verify the same source/input/runtime/compiler/measurement identities after the document-only commit. Base CRAP with head coverage is an estimate. Raw V8 is excluded.

**Scope and environment.** PostgreSQL and Collector are selected through actual shared-support consumers, correcting prior #251 N/A evidence. Standalone renderer, search-live and separate Axiom live are N/A; nested hosted checks include the renderer and ordinary tests include ordinary Axiom proofs. No duplicate standalone `check` or hosted offline build ran. Quiet native Docker logs do not expose full build phases; no build was repeated to recover them. [Build-history limits](review/build-history-fallback.md).

The owned Docker VM/data and baseline archive were removed. The default context and all six original shared containers remain ([before](review/docker-before.json), [after](review/docker-after.json), [cleanup](checks/colima-cleanup.log)). [GitHub observation](review/final-ci-observation.json) confirms a conflict-free Draft at this head and no check runs/status contexts; it does not replace local checks. The evidence package requires an exact-value WorkOS/Axiom secret scan before publication. Existing live reader journeys do not prove new live deletion; S2.5-02 remains the release hold. No release, deployment or customer removal route is added.
