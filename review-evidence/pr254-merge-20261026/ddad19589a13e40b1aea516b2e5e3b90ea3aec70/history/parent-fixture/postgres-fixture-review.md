# PostgreSQL failure fixture review

Base: `f03a7b73b2c27dc26477d5378a3356f28744a367` on `codex/s2-5-01a-membership-deletion`.
Candidate: that base plus the unstaged change to the second case in `test/acceptance/logging/audit/hosted-storage-failure.runtime.ts`. No production source changes.
Runtime: Node 24.20.0; Docker Engine 29.5.2; explicit context `colima-thermus-s25-merge`.

## Defect and fix

The first capture loads enabled settings and then exports its retained event. The old fixture assumed that capture did not export. It also replaced read observer promises while an earlier authorization read could still finish. An earlier read could resolve the new observer and falsely mark the locked read as complete.

The sender spy now returns an accepted, completed attempt at its public `start` seam. The test waits for the warm-up send and one event-loop turn so its dispatch completes. It installs the stable read observer only after that warm-up completes. The observer promises are constants; no warm-up read can resolve them. The sender count remains one while SQL is locked, which proves that blocked authorization does not start another send.

The real PostgreSQL table lock, MCP result and non-error checks, actual Admin invite result, health result, blocked-read assertion, unavailable post-close read, safe-log checks, and all deadlines remain. Sender transport is controlled, and warm-up is its only expected call; native DNS, TLS and HTTP are outside this SQL failure test's scope. The fixture keeps real in-process audit capture and queue behavior, and real SQL authorization. There are no skips or new shared helpers.

## Selected validation

The test-only runtime change selects its dedicated `test:logging:postgres` group under the test gate policy. No ordinary suite is added. A build compiles the changed file. Production metrics and declaration snapshots are N/A for this fixture-only change; the manager checks the complete candidate and its architecture/review tier separately.

1. `npm run build` — exit 0; `postgres-fixture-red-build.log`.
2. `DOCKER_CONTEXT=colima-thermus-s25-merge node --test --test-concurrency=1 dist/test/acceptance/logging/audit/hosted-storage-failure.runtime.js` before patch — exit 1; 2 tests, 0 pass, 1 fail, 1 cancelled, 0 skipped/todo. Second case reproduces `settingsFinished` true instead of false in 1,587 ms. First case times out at 30 seconds on this initial run; cause was not measured. Preserve `postgres-fixture-red-focused.log`. This timeout is not attributed to the fixture defect.
3. `npm run build` after patch — exit 0; `postgres-fixture-green-build.log`.
4. The same focused runtime command after patch — exit 0; 2/2 pass, 0 fail/cancel/skip/todo. Second case 1,646 ms; first case 2,764 ms. See `postgres-fixture-green-focused.log`.
5. `DOCKER_CONTEXT=colima-thermus-s25-merge npm run test:logging:postgres` — exit 0; 13/13 pass, 0 fail/cancel/skip/todo; 22,347 ms. This runs the full group defined on PR 251. See `postgres-fixture-green-group.log`.
6. `git diff --check` — exit 0.

No tracked file other than the runtime case changed. No branch, commit, push, PR or cloud mutation was made by this worker. The manager owns habit-hooks, complete-candidate policy, evidence publication and commit.
