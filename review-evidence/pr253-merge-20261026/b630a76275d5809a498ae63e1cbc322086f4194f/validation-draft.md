# PR 253 complete-candidate validation draft

Candidate: `b630a76275d5809a498ae63e1cbc322086f4194f`. Actual stack parent: `d0dd8fc8e519eb8a008ae0fe78ceb4e1199bc60d`. Complete candidate base: `8c6d204e8588a664438ba8934ab36670b802525f`. Validation used the detached primary checkout; all source/test/build inputs stayed fixed and the worktree is clean.

All selected product gates passed. The hosted command exited 0 with seven passing tests, but the first provenance postprocessor reported exit 1 because of a timestamp-matching defect. The manager reviewed a cache-only correction against the retained stream and manual counterexamples. The original failed postprocessor outcome remains in the ledger. No product test or build was repeated. Habit Hooks retained its reviewed findings, and the final diff check passed.

## Inputs and environment

The fresh runner records every tracked file hash, 1,162 runtime/build inputs, explicit head/parent/base, exact commands and times, command exits, summaries, log hashes, auxiliary launcher/Lightpanda/wrapper hashes and full emitted Docker build streams. Input fingerprint: `f422da7def1b56bbbcfa7de2e7521b22097c859ae8978ccd71c6bf8f04a93a62`. [Gate ledger](gate-ledger.json), [latest full binding](gated-inputs.json), and versioned `gated-inputs-*.json` retain the launches before and after the cache-only correction.

Node 24.20.0 and frozen installation passed. Every container gate used `DOCKER_CONTEXT=colima-thermus-s25-merge`. Axiom settings entered only the ordinary child process from the existing local configuration. WorkOS staging used the configured Keychain launcher; no credential value was written by the runner. No production configuration, deployment, release or cloud resource was changed. The task-owned Docker profile is retained.

## Full gate ledger

| Gate | Actual command | Start UTC | End UTC | Recorded exit | Result / log |
| --- | --- | --- | --- | --- | --- |
| install | `pnpm install --frozen-lockfile` | 2026-10-26T07:28:49.836Z | 2026-10-26T07:28:49.959Z | 0 | Passed; [install-1.log](install-1.log) |
| runtime | `pnpm exec node --version` | 2026-10-26T07:28:50.036Z | 2026-10-26T07:28:50.128Z | 0 | Passed; [runtime-1.log](runtime-1.log) |
| api-surface | `pnpm exec node script/pr-review/api-surface.ts --check` | 2026-10-26T07:28:50.196Z | 2026-10-26T07:28:51.928Z | 0 | Passed; [api-surface-1.log](api-surface-1.log) |
| focused-build | `npm run build` | 2026-10-26T07:28:52.011Z | 2026-10-26T07:28:53.473Z | 0 | Passed; [focused-build-1.log](focused-build-1.log) |
| focused | `node --test --test-concurrency=1 dist/test/acceptance/auth/hosted-membership-deletion.test.js dist/test/integration/auth/hosted-storage-lifecycle.test.js dist/test/integration/auth/workos-connection.test.js dist/test/integration/auth/workos-google-onboarding.test.js dist/test/integration/auth/workos-provider-administration.test.js dist/test/integration/auth/workos-provider-directory.test.js dist/test/integration/auth/workos-provider-organizations.test.js dist/test/integration/auth/workos-removal-lifetime.test.js dist/test/unit/auth-workos/workos-membership-reads.test.js dist/test/unit/auth-workos/workos-organizations-deletion.test.js dist/test/unit/auth-workos/workos-organizations-members.test.js dist/test/unit/auth-workos/workos-organizations-memberships.test.js dist/test/unit/auth-workos/workos-organizations-read-lifetime.test.js dist/test/unit/auth-workos/workos-organizations.test.js dist/test/unit/logging/audit/pg-removal-operation-store.test.js dist/test/unit/organizations/membership-removal-lifetime.test.js dist/test/unit/organizations/membership-removal-outcomes.test.js dist/test/unit/organizations/membership-removal-rules.test.js` | 2026-10-26T07:28:53.563Z | 2026-10-26T07:28:59.509Z | 0 | 276/276 pass; 0 fail/cancel/skip/todo; [focused-1.log](focused-1.log) |
| logging-postgres | `npm run test:logging:postgres` | 2026-10-26T07:28:59.581Z | 2026-10-26T07:29:51.730Z | 0 | 22/22 pass; 0 fail/cancel/skip/todo; [logging-postgres-1.log](logging-postgres-1.log) |
| ordinary | `npm test` | 2026-10-26T07:29:51.923Z | 2026-10-26T07:34:57.407Z | 0 | 5004/5004 pass; 49/49 pass; 0 fail/cancel/skip/todo; [ordinary-1.log](ordinary-1.log) |
| typecheck | `npm run typecheck` | 2026-10-26T07:34:57.601Z | 2026-10-26T07:34:58.943Z | 0 | Passed; [typecheck-1.log](typecheck-1.log) |
| portal | `npm run build:user-portal` | 2026-10-26T07:34:59.010Z | 2026-10-26T07:34:59.670Z | 0 | Passed; [portal-1.log](portal-1.log) |
| hosted-live | `node /Users/tomermayara/.config/thermus/with-workos-staging.cjs npm run test:hosted-live` | 2026-10-26T07:34:59.746Z | 2026-10-26T07:43:49.017Z | 0 | 28/28 pass; 0 fail/cancel/skip/todo; [hosted-live-1.log](hosted-live-1.log) |
| native-container | `npm run test:container` | 2026-10-26T07:43:49.216Z | 2026-10-26T07:47:01.121Z | 0 | 11/11 pass; 0 fail/cancel/skip/todo; [native-container-1.log](native-container-1.log) |
| hosted-container | `npm run test:container:hosted` | 2026-10-26T07:47:01.315Z | 2026-10-26T08:01:32.699Z | 0 child; 1 original validator | 7/7 pass; 0 fail/cancel/skip/todo; corrected captured-stream proof accepted without a product rerun; [hosted-container-1.log](hosted-container-1.log) |
| logging-collector | `npm run test:logging:collector` | 2026-10-26T08:04:38.006Z | 2026-10-26T08:04:56.330Z | 0 | 10/10 pass; 0 fail/cancel/skip/todo; [logging-collector-1.log](logging-collector-1.log) |
| habit-hooks | `habit-hooks --branch origin/main` | 2026-10-26T08:04:56.522Z | 2026-10-26T08:04:58.831Z | 1 | 320 reviewed retained findings; exact inventory/source match; snooze []; [habit-hooks-1.log](habit-hooks-1.log) |
| diff-check | `git diff --check` | 2026-10-26T08:05:47.645Z | 2026-10-26T08:05:47.661Z | 0 | Passed; [diff-check-1.log](diff-check-1.log) |

The 18-file focused command is the exact changed ordinary-file union for the complete candidate. Source selection also ran the full ordinary suite: 5,004 backend tests and 49 portal tests. No selected test is deferred.

## PostgreSQL fixture result and retained history

The fresh six-file PostgreSQL group passed 22/22 on this coordinator candidate. It includes removal-store overlap/restart, SQL lifetime and both hosted storage-outage cases. The first hosted case passed in 4,269 ms; the enabled-export case passed in 2,186 ms. The real lock, MCP/Admin/health results, blocked send, safe logs and original deadlines all ran successfully. [Full fresh group](logging-postgres-1.log) retains the current result.

The inherited fixture correction was specified and reviewed in PR 251. Its original red file had one assertion failure and one 30-second cancellation whose cause was not measured. Its green file and complete group passed before the PR 251 candidate commit and were bound to identical inputs afterward; none of those runs is relabeled as a PR 253 run. [PR 251 original fixture review](../pr251/postgres-fixture-review.md) and [original log hashes](../pr251/postgres-fixture-log-sha256.txt) retain that history. The older rebased PR 253 21/22 result is historical in [its failure review](../../pr253-rebase-f03a7b73/validation/postgres-failure-review.md); the current fresh group is green. No false BDD red was manufactured for the fixture correction.

## Build provenance and fresh hosted offline result

Native image commands use the existing `docker build --quiet` gate. Their full emitted streams contain the exact commands, image IDs and exits; intermediate success output is suppressed by that command. The [native build history](validation/native-build-history.jsonl) records both completed builds, and [final build history](validation/final-build-history.jsonl) retains the hosted build too. Dependency layers can reuse the task profile cache.

| Build stream | SHA-256 |
| --- | --- |
| [docker-build-1792999729728-native-container-1793000631833-52590.log](docker-build-1792999729728-native-container-1793000631833-52590.log) | `149e1a2b029fa63bcc5899b0cc2fe84a7aee2125739062a1c19cb177e9ebc261` |
| [docker-build-1792999729728-native-container-1793000730493-53464.log](docker-build-1792999729728-native-container-1793000730493-53464.log) | `25a268f33b15e9b216b7c2a502b23a888fa0ec02713d82248efc95a10977ba15` |
| [docker-build-1792999729728-hosted-container-1793000823378-58534.log](docker-build-1792999729728-hosted-container-1793000823378-58534.log) | `387ebffc78f725f845827f95780a2706ac36dc36869142832181263ef5da54c6` |

The hosted command selected Linux AMD64 and plain progress. Its full stream retains pinned base/renderer digests, all build phases, final image digests and exit 0. Fresh layer `#27 RUN --network=none npm run build:hosted` completed in 565.0 seconds with no CACHED marker. It passed types, the portal build and these six test groups:

| Nested offline group | Pass / tests | Fail / cancelled / skipped / todo |
| --- | --- | --- |
| backend unit | 3251 / 3251 | 0 / 0 / 0 / 0 |
| portal unit | 29 / 29 | 0 / 0 / 0 / 0 |
| portal acceptance | 20 / 20 | 0 / 0 / 0 / 0 |
| integration | 1109 / 1109 | 0 / 0 / 0 / 0 |
| hosted acceptance | 119 / 119 | 0 / 0 / 0 / 0 |
| renderer runtime | 13 / 13 | 0 / 0 / 0 / 0 |

[Extracted offline evidence](validation/hosted-offline-evidence.json) binds these results to the raw stream. The final image then passed all seven runtime cases, including public HTTPS, real rendering, safety and shutdown.

## Provenance postprocessor failure and correction

The first helper incorrectly required an output timestamp starting with `0.`. This fresh layer first printed its command at 1.022 seconds. It had the exact offline RUN, all six successful groups, DONE and no CACHED marker, so the helper reported a false provenance failure after the actual child exited 0.

The original child exit 0 is inferred from the exact captured helper: its hosted validation override runs only when `outcome.code === 0`; the recorded validationError can only be produced inside that guarded branch. Seven passing tests and the Docker exit-0 footer provide the retained raw outcomes. The ledger keeps the original postprocessor code 1. [Correction receipt](validation/hosted-provenance-correction.json) preserves actualChildCode 0 and validatorExit 1, the original row, raw hashes and captured runner hash. [Original runner](validation/run-gates-captured-1792999729728.mjs) matches its original binding.

The corrected predicate accepts numeric command timestamps and still requires the exact RUN, DONE, no CACHED and six positive all-pass summary groups. [Manual checks](validation/hosted-provenance-manual-check.json) evaluate the exact predicate on the real stream and reject cached, nonmatching-command and failed-summary counterexamples. No repository test was added for the cache helper. The manager accepted this correction and authorized resume at Collector. No product gate was repeated. Later rows record commandOutcome separately before any validation override.

## Habit Hooks and final boundary

The fresh hook exited 1 with 1 complexity finding, 4 parameter-count findings, 302 comments and 13 file-size findings. Raw text is byte-identical to the current candidate inventory already accepted by the manager. All 320 finding keys/text, their individual retained reasons, all 32 owner-file hashes and source lines match; snooze stays `[]`. The [run bridge](validation/habit-run-bridge.json) links both raw runs, their hashes, the current reviewed inventory and manager acceptance. Exit 1 remains recorded; no hook repeat or source change was needed. The final diff check passed.

## Selection and limits

The [selection](validation/selection.md) follows the complete source candidate, dedicated runtime tests and their real support consumers. Standalone search-live, renderer and Axiom interface-live groups are N/A; no relevant fetch/search/cleaner/runtime source change selects them. The chosen hosted image gate includes its required renderer checks. No duplicate standalone `npm run check`, whole interface suite or separate hosted offline build was added. The image invokes its own required nested check command.

The manager owns architecture, metrics, policy, current human approval, complete-stack integration and publication. R1 remains an intermediate-head limit, as the [manager quality review](quality/manager-quality-review.json) records; the whole stack must include the later verified fix and deployment remains held. These product test passes do not replace that review. Local paths are drafts, not GitHub artifact links; the manager scans logs before publication. The worker made no tracked edit, commit, push or PR. The primary checkout remains detached at the pinned head until handoff.
