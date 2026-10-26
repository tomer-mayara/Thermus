# PR 253 complete-candidate merge validation

Head: `b630a76275d5809a498ae63e1cbc322086f4194f` in the detached primary checkout `/Users/tomermayara/.codex/worktrees/c617/Thermus`.
Actual stack parent: `d0dd8fc8e519eb8a008ae0fe78ceb4e1199bc60d`.
Complete candidate base: `8c6d204e8588a664438ba8934ab36670b802525f`.
Docker profile: `colima-thermus-s25-merge`, retained from the PR 251 gates.

Read the prior PR 253 selection and runner, current package commands, current complete-candidate changed test paths, and prior PR 251 fresh runner. The source changes select the full ordinary suite, types, portal, WorkOS staging, native self-hosted image, hosted Linux AMD64 image, PostgreSQL and Collector groups. All 18 changed ordinary test files exactly match the prior PR 253 explicit selection; `focused-files.json` retains the union. Run those files after a clean build.

Run frozen installation, pinned Node, read-only API surface check, focused build/test, then the complete PostgreSQL group early. That group now has six files and 22 cases; it must run fresh against the removal coordinator and the inherited fixture fix. Prior PR 251 passes do not validate these changed production inputs. Continue serially with `npm test`, typecheck, portal, securely launched WorkOS staging, native container, hosted AMD64 image, Collector, Habit Hooks against origin/main and diff check.

The hosted image's selected build executes `RUN --network=none npm run build:hosted`. Retain its full plain Docker stream and require fresh successful execution of that layer; cached execution cannot establish the fresh offline check. Do not add a duplicate standalone `npm run check`, separate whole interface suite, standalone hosted build, or unrelated live/renderer group. The image gate includes its own required renderer checks. This task requests no release or deployment.

The runner binds the explicit head, actual parent and complete base; records every tracked hash and all runtime/build inputs (including SQL, migrations, Docker context rules and fixture/legal documents); checks stable source/test inputs before and after each command; and records exact commands, times, exits, summary counts, hashes and full Docker build streams. Axiom settings stay in the ordinary child process; WorkOS uses the configured Keychain launcher. No secret value is printed by the runner. Stop on failure for manager review, and retain every attempt. The manager owns quality disposition, metrics, architecture, publication and final approval.
