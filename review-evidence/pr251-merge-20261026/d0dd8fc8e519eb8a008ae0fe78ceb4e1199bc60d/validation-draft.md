# PR 251 complete-candidate validation draft

Candidate: `d0dd8fc8e519eb8a008ae0fe78ceb4e1199bc60d`. Base: `8c6d204e8588a664438ba8934ab36670b802525f`. Both are the actual Git refs at launch. The worktree is clean after validation.

All selected product gates passed. The serial runner stopped at Habit Hooks exit 1. The manager reviewed the unchanged retained findings, then authorized the final diff check. That check passed. This is validation evidence; the manager owns the complete quality, architecture, human approval and merge decision.

## Inputs and environment

The fresh runner records all tracked file hashes, 1,143 runtime/build inputs, exact commands and times, child exits, test summaries, log hashes, auxiliary launcher/Lightpanda/wrapper hashes and all emitted Docker build streams. Input fingerprint: `9928dd7ba9de53d6257e9eb41b98dafd7fe5aaef8b244de97ff1ed5ddbce34c7`. [Gate ledger](gate-ledger.json), [latest full binding](gated-inputs.json), and versioned `gated-inputs-*.json` retain each launch binding.

Node 24.20.0 and locked pnpm installation passed. Every container command used `DOCKER_CONTEXT=colima-thermus-s25-merge`. Axiom settings were read from the configured local file into the ordinary child process only. WorkOS staging used the configured Keychain launcher; no credential value was written by the runner. The staging gate exercised its real provider and browser flows. No production configuration or deployment changed. The task-owned Docker profile remains available for the remaining stack.

## Full gate ledger

| Gate | Actual command | Start UTC | End UTC | Exit | Result / log |
| --- | --- | --- | --- | --- | --- |
| install | `pnpm install --frozen-lockfile` | 2026-10-26T06:37:32.554Z | 2026-10-26T06:37:32.694Z | 0 | Passed; [install-1.log](install-1.log) |
| runtime | `pnpm exec node --version` | 2026-10-26T06:37:32.751Z | 2026-10-26T06:37:32.851Z | 0 | Passed; [runtime-1.log](runtime-1.log) |
| api-surface | `pnpm exec node script/pr-review/api-surface.ts --check` | 2026-10-26T06:37:32.896Z | 2026-10-26T06:37:34.702Z | 0 | Passed; [api-surface-1.log](api-surface-1.log) |
| focused-build | `npm run build` | 2026-10-26T06:37:34.751Z | 2026-10-26T06:37:36.015Z | 0 | Passed; [focused-build-1.log](focused-build-1.log) |
| focused | `node --test --test-concurrency=1 dist/test/acceptance/auth/hosted-membership-deletion.test.js dist/test/integration/auth/workos-connection.test.js dist/test/integration/auth/workos-google-onboarding.test.js dist/test/integration/auth/workos-provider-administration.test.js dist/test/integration/auth/workos-provider-directory.test.js dist/test/integration/auth/workos-provider-organizations.test.js dist/test/unit/auth-workos/workos-membership-reads.test.js dist/test/unit/auth-workos/workos-organizations-deletion.test.js dist/test/unit/auth-workos/workos-organizations-members.test.js dist/test/unit/auth-workos/workos-organizations-memberships.test.js dist/test/unit/auth-workos/workos-organizations.test.js` | 2026-10-26T06:37:36.150Z | 2026-10-26T06:37:41.737Z | 0 | 181/181 pass; 0 fail/cancel/skip/todo; [focused-1.log](focused-1.log) |
| ordinary | `npm test` | 2026-10-26T06:37:41.789Z | 2026-10-26T06:42:49.750Z | 0 | 4911/4911 pass; 49/49 pass; 0 fail/cancel/skip/todo; [ordinary-1.log](ordinary-1.log) |
| typecheck | `npm run typecheck` | 2026-10-26T06:42:49.922Z | 2026-10-26T06:42:51.403Z | 0 | Passed; [typecheck-1.log](typecheck-1.log) |
| portal | `npm run build:user-portal` | 2026-10-26T06:42:51.454Z | 2026-10-26T06:42:52.193Z | 0 | Passed; [portal-1.log](portal-1.log) |
| hosted-live | `node /Users/tomermayara/.config/thermus/with-workos-staging.cjs npm run test:hosted-live` | 2026-10-26T06:42:52.242Z | 2026-10-26T06:51:41.833Z | 0 | 28/28 pass; 0 fail/cancel/skip/todo; [hosted-live-1.log](hosted-live-1.log) |
| native-container | `npm run test:container` | 2026-10-26T06:51:42.001Z | 2026-10-26T06:59:49.172Z | 0 | 11/11 pass; 0 fail/cancel/skip/todo; [native-container-1.log](native-container-1.log) |
| hosted-container | `npm run test:container:hosted` | 2026-10-26T06:59:49.353Z | 2026-10-26T07:16:03.323Z | 0 | 7/7 pass; 0 fail/cancel/skip/todo; [hosted-container-1.log](hosted-container-1.log) |
| logging-collector | `npm run test:logging:collector` | 2026-10-26T07:16:03.505Z | 2026-10-26T07:17:02.203Z | 0 | 10/10 pass; 0 fail/cancel/skip/todo; [logging-collector-1.log](logging-collector-1.log) |
| habit-hooks | `habit-hooks` | 2026-10-26T07:17:02.386Z | 2026-10-26T07:17:04.170Z | 1 | 235 retained findings; exact reviewed inventory match; snooze []; [habit-hooks-1.log](habit-hooks-1.log) |
| diff-check | `git diff --check` | 2026-10-26T07:18:37.101Z | 2026-10-26T07:18:37.117Z | 0 | Passed; [diff-check-1.log](diff-check-1.log) |

The runtime group reuse below is also selected. It is recorded separately because its actual run preceded the candidate commit. The ledger is not rewritten to give that run a later head or time.

## PostgreSQL reuse and original failure history

The PostgreSQL tests ran on prior head `f03a7b73b2c27dc26477d5378a3356f28744a367` plus the reviewed fixture patch. The only runtime/build input changed by the final commit relative to that prior head is that same fixture. The worker made that patch before the green runs. The later commit also changed the impact declaration and implementation document. The [input binding](validation/postgres-input-binding.json) verifies the current input fingerprint and records this after-run binding limit. File creation/write times are retained as file metadata, not claimed exact command times.

| Run | Actual command | Exit | Outcome / original log |
| --- | --- | --- | --- |
| Red build | `npm run build` | 0 | [Build log](postgres-fixture-red-build.log) |
| Red focused runtime file | `DOCKER_CONTEXT=colima-thermus-s25-merge node --test --test-concurrency=1 dist/test/acceptance/logging/audit/hosted-storage-failure.runtime.js` | 1 | 2 tests; 0 pass, 1 fail, 1 cancelled. Second case reproduced `settingsFinished` true instead of false in 1,587 ms. First case timed out at 30 seconds; cause was not measured. [Original log](postgres-fixture-red-focused.log) |
| Green build | `npm run build` | 0 | [Build log](postgres-fixture-green-build.log) |
| Green focused runtime file | Same focused command above | 0 | 2/2 pass; 0 fail/cancel/skip/todo. Second case 1,646 ms; first 2,764 ms. [Original log](postgres-fixture-green-focused.log) |
| Green complete PostgreSQL group | `DOCKER_CONTEXT=colima-thermus-s25-merge npm run test:logging:postgres` | 0 | 13/13 pass; 0 fail/cancel/skip/todo; 22,347 ms. [Original log](postgres-fixture-green-group.log) |

The fixture now waits for one accepted, completed controlled warm-up export before it installs stable read observer promises and locks the real SQL table. Warm-up is the only expected sender call. The real in-process audit capture/queue, real SQL authorization, product/Admin/health results, blocked-send result, safe-log checks and all deadlines remain. [Fixture review](postgres-fixture-review.md) and [original log hashes](postgres-fixture-log-sha256.txt) retain the patch review and history.

## Build provenance and fresh hosted offline checks

The native gate made two image builds. Its original `docker build --quiet` command suppresses intermediate stages on success; both exact commands, emitted image IDs and exits are retained. The task profile build history records the first build with 0 cached steps and 33 complete steps, and the rebuilt image with 24 cached steps. [Native build history](validation/native-build-history.jsonl) retains that observation.

| Build stream | SHA-256 |
| --- | --- |
| [docker-build-1792996652405-native-container-1792997504842-91226.log](docker-build-1792996652405-native-container-1792997504842-91226.log) | `8f883828bec2f4b06e867a182dca558f57e1ba9e2a1af0e8119c5375fbd03373` |
| [docker-build-1792996652405-native-container-1792997899860-95822.log](docker-build-1792996652405-native-container-1792997899860-95822.log) | `38198e4109cd2f4a3180ce651bcab70ff8d48d491d1ef24a2033e1d988e21f87` |
| [docker-build-1792996652405-hosted-container-1792997991333-5682.log](docker-build-1792996652405-hosted-container-1792997991333-5682.log) | `1d809aa9bcebb4c18c34ab650cbc9c8814e3cb53ec7e24ac67365b5234258669` |

The hosted build command explicitly selected `--platform linux/amd64 --progress=plain --file Dockerfile.hosted`. Its pinned Node/Rust images, downloaded renderer digest, build phases, final image digests and successful completion remain in its full stream. The final image test then passed all seven cases. The fresh offline layer was `#27 RUN --network=none npm run build:hosted`; it completed in 549.4 seconds and was not cached. [Extracted offline evidence](validation/hosted-offline-evidence.json) and [final build history](validation/final-build-history.jsonl) bind this result to the full stream.

| Nested offline group | Pass / tests | Fail / cancelled / skipped / todo |
| --- | --- | --- |
| backend unit | 3164 / 3164 | 0 / 0 / 0 / 0 |
| portal unit | 29 / 29 | 0 / 0 / 0 / 0 |
| portal acceptance | 20 / 20 | 0 / 0 / 0 / 0 |
| integration | 1103 / 1103 | 0 / 0 / 0 / 0 |
| hosted acceptance | 119 / 119 | 0 / 0 / 0 / 0 |
| renderer runtime | 13 / 13 | 0 / 0 / 0 / 0 |

The same layer also passed types and the portal build. The renderer group used the shipped pinned renderer and exercised the real pipeline. No standalone `npm run check`, extra whole interface suite or separate hosted offline build was added. `npm run check` ran only as the selected hosted image gate requires. An initial ad-hoc report extractor expected seven summary groups and stopped; the package command has six. The corrected extractor matches those six commands. No test or gate was repeated for that report correction.

## Habit Hooks review and boundary

The fresh serial Habit Hooks run exited 1 with 1 complexity finding, 224 comments and 10 file-size findings. Its raw log is byte-identical to the earlier fresh run already reviewed by the manager. All 235 findings, their location-specific retained reasons, all 18 owner-file hashes and source lines match exactly. Snooze remains `[]`. The manager instructed reuse of that review and authorized the final diff check, which passed.

[Earlier reviewed inventory](quality/habit-dispositions.json), [current captured inventory](validation/habit-dispositions.json), and [run bridge](validation/habit-run-bridge.json) retain both commands, both raw logs, hashes, exact-match evidence and the manager disposition. This report preserves exit 1 rather than relabeling it as an exit-0 command. No selected product gate failed.

## Selection and limits

The [selection](validation/selection.md) follows the full source candidate and changed test consumers. The changed PostgreSQL fixture selected its dedicated group, which was already green on identical inputs. Standalone search-live, standalone renderer, a separate Axiom live group, release and deployment gates are N/A for this change. The shipped image gate covers its required nested offline renderer checks. All selected gates are complete; there is no deferred selected test.

The complete candidate still needs the manager-owned architecture, metrics, policy, approval and publication checks. Local cache paths are review drafts, not GitHub artifact links. The manager must scan logs before external publication. The worker changed no tracked file in this validation task, created no commit or PR, and left no validation process running.
