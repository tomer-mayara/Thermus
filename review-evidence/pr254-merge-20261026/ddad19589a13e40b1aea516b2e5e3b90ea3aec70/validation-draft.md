# PR 254 complete-candidate validation draft

Candidate: `ddad19589a13e40b1aea516b2e5e3b90ea3aec70`. Actual parent: `b630a76275d5809a498ae63e1cbc322086f4194f`. Complete candidate base: `8c6d204e8588a664438ba8934ab36670b802525f`. Every gate used the detached primary checkout. Source/test/build inputs stayed fixed; tracked status is clean.

All selected primary product gates passed on their first attempt, including the new narrow Members Chromium gate. Habit Hooks retains the current reviewed findings with exact raw/source matches, and the final diff check passed. The separate coverage failure/retry history remains visible below. These results do not replace manager policy, architecture, metrics or human approval checks.

## Inputs, environment and port coordination

[Gate ledger](gate-ledger.json), [full input binding](gated-inputs.json) and versioned `gated-inputs-*.json` retain all tracked hashes, 1,173 runtime/build inputs, explicit head/parent/base, exact commands/times, actual child outcomes, summaries, log hashes, launcher/Lightpanda/wrapper hashes and full Docker streams. Input fingerprint: `1fb4c3e8b4ac411ec9bb5d29fc4e79c5e874422c91640c0c197e5e06fba5cfa6`.

Frozen install and Node 24.20.0 passed. All container commands used `DOCKER_CONTEXT=colima-thermus-s25-merge`. Axiom settings entered only the ordinary child process. WorkOS staging used the configured Keychain launcher; no credential value was written by the runner. No production resource, deployment or release changed.

The [port preflight](validation/port-preflight.json) confirmed host ports 46443/46480 were free before launch. The actual hosted-live gate passed before [explicit port release](validation/live-port-release.json) confirmed both listeners closed. Only then were root and the quality worker notified for separate-checkout runtime work. Native and hosted image gates publish dynamic host ports; nested offline checks run in the image-build namespace. This primary runner remained serial. Other authorized secondary work can continue after its final handback.

## Full primary gate ledger

| Gate | Actual command | Start UTC | End UTC | Child exit | Result / log |
| --- | --- | --- | --- | --- | --- |
| install | `pnpm install --frozen-lockfile` | 2026-10-26T08:09:19.300Z | 2026-10-26T08:09:19.439Z | 0 | Passed; [install-1.log](install-1.log) |
| runtime | `pnpm exec node --version` | 2026-10-26T08:09:19.517Z | 2026-10-26T08:09:19.615Z | 0 | Passed; [runtime-1.log](runtime-1.log) |
| api-surface | `pnpm exec node script/pr-review/api-surface.ts --check` | 2026-10-26T08:09:19.684Z | 2026-10-26T08:09:21.351Z | 0 | Passed; [api-surface-1.log](api-surface-1.log) |
| focused-build | `npm run build` | 2026-10-26T08:09:21.444Z | 2026-10-26T08:09:22.914Z | 0 | Passed; [focused-build-1.log](focused-build-1.log) |
| focused | `node --test --test-concurrency=1 dist/test/acceptance/auth/hosted-invitations.test.js dist/test/acceptance/auth/hosted-member-removal-scope.test.js dist/test/acceptance/auth/hosted-member-removal.test.js dist/test/acceptance/auth/hosted-member-self-removal.test.js dist/test/acceptance/auth/hosted-members.test.js dist/test/acceptance/auth/hosted-membership-deletion.test.js dist/test/acceptance/auth/hosted-workos-administration.test.js dist/test/integration/auth/hosted-storage-lifecycle.test.js dist/test/integration/auth/workos-connection.test.js dist/test/integration/auth/workos-google-onboarding.test.js dist/test/integration/auth/workos-provider-administration.test.js dist/test/integration/auth/workos-provider-directory.test.js dist/test/integration/auth/workos-provider-organizations.test.js dist/test/integration/auth/workos-removal-lifetime.test.js dist/test/integration/hosted-admin/account-routes-administration-pages.test.js dist/test/integration/hosted-admin/account-routes-grant-retirement.test.js dist/test/integration/hosted-admin/account-routes-removal-audit.test.js dist/test/integration/hosted-admin/account-routes-removal.test.js dist/test/unit/auth-workos/workos-membership-reads.test.js dist/test/unit/auth-workos/workos-organizations-deletion.test.js dist/test/unit/auth-workos/workos-organizations-members.test.js dist/test/unit/auth-workos/workos-organizations-memberships.test.js dist/test/unit/auth-workos/workos-organizations-read-lifetime.test.js dist/test/unit/auth-workos/workos-organizations.test.js dist/test/unit/logging/audit/audit-removal.test.js dist/test/unit/logging/audit/pg-removal-operation-store.test.js dist/test/unit/organizations/membership-removal-lifetime.test.js dist/test/unit/organizations/membership-removal-outcomes.test.js dist/test/unit/organizations/membership-removal-rules.test.js dist/test/unit/organizations/organization-administration-members.test.js` | 2026-10-26T08:09:23.004Z | 2026-10-26T08:09:34.487Z | 0 | 411/411 pass; 0 fail/cancel/skip/todo; [focused-1.log](focused-1.log) |
| members-browser | `sh -c 'npm run build:user-portal && npm run build && node --test dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js'` | 2026-10-26T08:09:34.557Z | 2026-10-26T08:09:38.166Z | 0 | 1/1 pass; 0 fail/cancel/skip/todo; [members-browser-1.log](members-browser-1.log) |
| logging-postgres | `npm run test:logging:postgres` | 2026-10-26T08:09:38.243Z | 2026-10-26T08:10:30.715Z | 0 | 22/22 pass; 0 fail/cancel/skip/todo; [logging-postgres-1.log](logging-postgres-1.log) |
| ordinary | `npm test` | 2026-10-26T08:10:30.921Z | 2026-10-26T08:15:41.852Z | 0 | 5081/5081 pass; 49/49 pass; 0 fail/cancel/skip/todo; [ordinary-1.log](ordinary-1.log) |
| typecheck | `npm run typecheck` | 2026-10-26T08:15:42.050Z | 2026-10-26T08:15:43.437Z | 0 | Passed; [typecheck-1.log](typecheck-1.log) |
| portal | `npm run build:user-portal` | 2026-10-26T08:15:43.505Z | 2026-10-26T08:15:44.215Z | 0 | Passed; [portal-1.log](portal-1.log) |
| hosted-live | `node /Users/tomermayara/.config/thermus/with-workos-staging.cjs npm run test:hosted-live` | 2026-10-26T08:15:44.303Z | 2026-10-26T08:24:24.299Z | 0 | 28/28 pass; 0 fail/cancel/skip/todo; [hosted-live-1.log](hosted-live-1.log) |
| native-container | `npm run test:container` | 2026-10-26T08:24:24.522Z | 2026-10-26T08:26:06.302Z | 0 | 11/11 pass; 0 fail/cancel/skip/todo; [native-container-1.log](native-container-1.log) |
| hosted-container | `npm run test:container:hosted` | 2026-10-26T08:26:06.499Z | 2026-10-26T08:36:22.127Z | 0 | 7/7 pass; 0 fail/cancel/skip/todo; [hosted-container-1.log](hosted-container-1.log) |
| logging-collector | `npm run test:logging:collector` | 2026-10-26T08:36:22.331Z | 2026-10-26T08:36:40.162Z | 0 | 10/10 pass; 0 fail/cancel/skip/todo; [logging-collector-1.log](logging-collector-1.log) |
| habit-hooks | `habit-hooks --branch origin/main` | 2026-10-26T08:36:40.345Z | 2026-10-26T08:36:42.415Z | 1 | 437 reviewed retained findings; exact current inventory/source match; snooze []; [habit-hooks-1.log](habit-hooks-1.log) |
| diff-check | `git diff --check` | 2026-10-26T08:38:52.191Z | 2026-10-26T08:38:52.212Z | 0 | Passed; [diff-check-1.log](diff-check-1.log) |

The focused command runs the exact 30-file changed ordinary union against main. The full ordinary suite passed 5,081 backend and 49 portal tests. No selected primary test is deferred.

## Members Chromium and visual review

The documented gate built the real portal and backend, then passed its one browser case at a 390 by 844 viewport. It checks keyboard open/cancel/confirm, names, loaded logo/fonts, no cancellation write, removal of only the chosen membership, no horizontal overflow, confirmation bounds and the result page. It uses a local in-process application transport with provider doubles and no live credential.

The [screenshot](browser/members-remove-narrow.png) is 390 by 2060 pixels, full-page, captured before confirmation. SHA-256: `b00c70386032d54365839eead1caed3a165e5cc5d9e2926d2314fa2c07562849`. Visual inspection found readable panels, labels, the selected confirmation, focus outline and Cancel link inside the narrow layout, with no horizontal clipping. The gate then confirmed the actual removal outcome. [Visual review receipt](validation/browser-visual-review.json) retains this scope and its source binding.

## Fresh PostgreSQL result and inherited fixture history

The fresh six-file PostgreSQL group passed 22/22 on this candidate, including removal overlap/restart, SQL lifetime and both hosted outage cases. The inherited fixture fix retains real table locks, actual MCP/Admin/health results, blocked-send/privacy checks and all deadlines. Its original PR 251 red assertion and unmeasured initial timeout remain historical in [the fixture review](../pr251/postgres-fixture-review.md) and original hash/log records. Those earlier runs are not relabeled as PR 254 evidence; [the current full group](logging-postgres-1.log) is fresh and green.

## Build streams and fresh hosted offline checks

Native commands retain their existing `docker build --quiet` behavior, so the full emitted streams show exact commands, image IDs and exits while successful intermediate output is suppressed. [Native build history](validation/native-build-history.jsonl) and [final build history](validation/final-build-history.jsonl) retain task-profile cache/execution observations. Dependency cache reuse is separate from the fresh offline application proof.

| Build stream | SHA-256 |
| --- | --- |
| [docker-build-1793002159140-native-container-1793003067309-6043.log](docker-build-1793002159140-native-container-1793003067309-6043.log) | `be09c09a8299d21c3d046bcd5eacfb4a4ee39d62baffde6b96939da43aafb233` |
| [docker-build-1793002159140-native-container-1793003077090-6256.log](docker-build-1793002159140-native-container-1793003077090-6256.log) | `441fbe88c00bd2334b095ce9f5066f88d8ca9d732eb7bc5cc77c2a43cd0916df` |
| [docker-build-1793002159140-hosted-container-1793003168465-11238.log](docker-build-1793002159140-hosted-container-1793003168465-11238.log) | `02299e4879b86a2795bb4dd4acab4da6e569b02a0dd1bec5996d21d046741405` |

The hosted command selected Linux AMD64 and plain progress. Fresh `#24 RUN --network=none npm run build:hosted` completed successfully: `#24 DONE 577.0s`. Its full stream retains pinned image/renderer digests, actual nested outputs, final image digests and exit 0. No CACHED marker occurs for that layer. Types and portal build also passed inside it.

| Nested offline group | Pass / tests | Fail / cancelled / skipped / todo |
| --- | --- | --- |
| backend unit | 3265 / 3265 | 0 / 0 / 0 / 0 |
| portal unit | 29 / 29 | 0 / 0 / 0 / 0 |
| portal acceptance | 20 / 20 | 0 / 0 / 0 / 0 |
| integration | 1149 / 1149 | 0 / 0 / 0 / 0 |
| hosted acceptance | 119 / 119 | 0 / 0 / 0 / 0 |
| renderer runtime | 13 / 13 | 0 / 0 / 0 / 0 |

[Offline evidence](validation/hosted-offline-evidence.json) binds these six groups to the full stream and actual child/validator exit 0. Its predicate is byte-identical to the corrected PR 253 predicate, which accepts numeric output timestamps and requires exact RUN, DONE, no CACHED and six positive all-pass groups; prior manual cached/nonmatching/failed-summary checks remain linked. No provenance failure occurred in this run. The final hosted image passed seven runtime cases, and the Collector group passed ten.

## Habit Hooks and quality capture history

The fresh hook exited 1 with 6 complexity findings, 5 parameter-count findings, 410 comments and 16 file-size findings. Its raw text is byte-identical to the current candidate quality inventory already reviewed by the manager. All 437 finding keys/text, individual retained reasons, all 49 owner-file hashes and source lines match. This includes the current semantic contexts recorded by quality; it does not claim every file matches an older PR version. Snooze stays `[]`. [Run bridge](validation/habit-run-bridge.json) links both raw runs, hashes, reviewed inventory and manager acceptance. The raw exit remains 1. No hook repeat or source change was needed, and final diff check passed.

The separate quality collector initially failed its combined capture because the ordinary hosted-live-site integration fixture still binds 127.0.0.1:46443. It reported 1,149 integration tests: 1,145 pass and 4 EADDRINUSE failures while the prior primary live gate held that port; acceptance had not started and no complete report was published from that attempt. The earlier binding analysis was incomplete. After explicit live cleanup and release, the same source and port settings completed a full combined retry with exit 0 and a verified current-head report. No case was skipped or port changed. [Failure/retry review](quality/final-isolated/measurements/coverage-failure-review.json), [retry command receipt](quality/final-isolated/measurements/retry-after-live/capture-commands.json), and [retry binding](quality/final-isolated/measurements/retry-after-live/capture-binding.json) preserve that history.

Original raw capture artifacts remain at the retained secondary paths in [raw retention](quality/final-isolated/raw-capture-retention.json). Copied manifest-only folders are not claimed as raw-byte captures. The [manager quality review](quality/manager-quality-review.json) records the scope, current dispositions and evidence limits. This history is separate from the first-attempt primary product gate passes.

## Selection and final boundary

The [selection](validation/selection.md) follows all complete-candidate source changes, real support consumers and the new Members runtime. No duplicate standalone npm check, whole interface suite or separate hosted offline build was added. The selected image includes its required nested check and real renderer phases. Standalone search-live, renderer and Axiom interface-live groups are N/A; no changed source selects them. Public Connect paired proofs are not selected at this head because the relevant LocalHttpsSite increment is introduced later; they are planned for the later candidate under manager port coordination.

The manager owns complete-stack/R1 integration, architecture, metrics, policy, current independent human approval, publication and the deployment hold. All links here are local review drafts until publication; they are not GitHub artifact URLs. The worker made no tracked edit, commit, push or PR. Primary remains detached at this pinned head for handback; no later candidate is launched without coordination.
