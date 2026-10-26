# PostgreSQL attempt 1: read-only failure review

Gate source head: `fd7fa0b1e53d653f92168b75ba4d65618a9138a8`.
Base: `8c6d204e8588a664438ba8934ab36670b802525f`.
Original evidence: `logging-postgres-1.log`; preserve it unchanged.

The group reports 13 tests: 12 pass, 1 fails, zero cancellations, skips or todos. The failed case takes 2,267.32 ms total. The failure is `settingsFinished === true` where the test expects false at `test/acceptance/logging/audit/hosted-storage-failure.runtime.ts:142`. This is the assertion that product and Admin actions finish while queue authorization still waits for SQL. It is not the later 10-second shutdown assertion. The MCP content and success assertions, Members read, invitation POST 303, and invitation-count assertion pass before this failure. Health, blocked-sender and explicit shutdown assertions after line 142 are not reached.

## Established code facts

The runtime test, PostgreSQL fixture, SQL runtime/store, hosted logging composition, AuditSnapshots, AuditCollector and destination service are byte-identical to current origin/main. They also have no delta between the prior `581f30cf` base and current main. The PR's fake-membership list now checks an initially empty deleted-ID set; no deletion runs in this case. There is no observed change of SQL bounds, sender admission or shutdown authority from the rebase.

The test's warm-up still asserts that cold capture only loads settings and starts no sender (line 124). Current production behavior deliberately retains the cold event, loads enabled metadata, then `AuditSnapshots.flushPending` admits the event to the collector (snapshot source lines 117 and 126–132). The collector schedules a fresh `authorizeExport` read before sending (collector lines 113–121; destination service lines 50–59). Commit `abaebf0c282e4bdc48627ee75f555da238ac2b50` added first-event retention but did not update this runtime test. `docs/implementation/admin-s2-03c.md` explicitly says that this supersedes the original warm-up drop rule.

The spy at test lines 116–119 resolves the mutable `readStarted` and `readSettled` variables. It does not capture the deferred objects for the invocation that began. Lines 125–126 replace both objects while warm-up authorization can still be running. A warm-up SELECT that starts before the holder's table lock can finish and resolve the new deferred object. The test then treats that earlier successful read as completion of the later blocked read. One `setImmediate` tick does not wait for the real SQL authorization read or collector settlement. This is an actual cross-operation observation defect, independent of how often it occurs.

## Diagnosis and limits

The strongest explanation for this failure is the stale warm-up assumption plus the reused read observer. The log alone does not identify which read completed. Therefore it does not prove the exact dynamic order, nor can it prove that the two-second operation bound was exceeded. The body uses SQL operationMs 2,000, statementMs 5,000 and the existing one-second acquisition bound; collector authorization readMs is 2,500. The enclosing case has 30 seconds and explicit shutdown has 10 seconds. No timeout or resource-exhaustion diagnostic appears. The short total duration is consistent with a late warm-up read, but total fixture duration is not a measurement of the blocked phase. Do not attribute this result to CPU contention or raise a deadline without evidence.

This is a baseline test-orchestration defect exposed by the newly selected dedicated group, rather than an established membership-deletion or rebase regression. A baseline execution would add dynamic confirmation; none was run during this review.

## Smallest correction for manager decision

Align only the test fixture with current first-event retention. Use a controlled completed sender attempt for warm-up so the case makes no real Collector request; explicitly wait for its warm event to reach the sender and settle, then clear the warm-up spy calls before taking the real PostgreSQL table lock. Bind each observed read to its own deferred objects (or observe the post-lock read explicitly). Keep the actual SQL lock, the product/Admin assertions, the no-send-while-blocked assertion, and all operation/shutdown limits unchanged. The test should prove the same source behavior with deterministic operation identity.

An unchanged focused rerun after the current gate finishes can reveal schedule sensitivity, but a lucky pass would not repair the stale observer. If the manager chooses that diagnostic, use the already built output only after it is stable:

```sh
node --test --test-concurrency=1 --test-name-pattern='Given enabled customer export and queue authorization blocked by PostgreSQL' dist/test/acceptance/logging/audit/hosted-storage-failure.runtime.js
```

That is a focused diagnostic, not a pass of the complete PostgreSQL gate. If the fixture changes, run the changed file and the complete selected PostgreSQL group on the new candidate, then refresh affected evidence and fingerprints. No test/build/metric command or source edit was performed by this reviewer.

## Independent main diagnostic

At the manager's request, the reviewer archived exact main `8c6d204e8588a664438ba8934ab36670b802525f` into a new task-owned `/private/tmp/thermus-pr251-baseline-2owwci1z`. The archive used the current worktree's locked `node_modules` through a symlink. Pinned Node was `v24.20.0`. Only a backend TypeScript build and both cases in emitted `hosted-storage-failure.runtime.js` ran, serially, with `DOCKER_CONTEXT=colima-thermus-pr251-r2`. Real WorkOS/Axiom and ambient database settings were removed from the child environment; the unchanged tracked offline portal fixture/preload supplied the portal. No installation, portal build, broad suite, source edit or credential lookup was needed.

Baseline build exited 0. Baseline runtime command exited 1: two tests, one pass, one failure, zero cancellations/skips/todos, total 5,402.623208 ms. The same second case failed at the same `settingsFinished` assertion (`true !== false`); that case took 1,790.752167 ms. This confirms the failure independently on current main. That total case duration excludes expiry of its configured two-second operation timer as the cause, but per-read identity/result was not instrumented, so the exact warm-read schedule and other early-read failures remain unmeasured.

`baseline-build.log`, `baseline-hosted-storage-failure.log` and `baseline-diagnostic.json` in this validation folder retain commands, timestamps, exits, log/archive hashes and all 817 archived source/test/build input hashes. The latter verifies those inputs remained unchanged after the run. The task-owned temporary archive was removed after recording; its `node_modules` symlink was removed with the archive, without changing the shared dependency tree. The original source worktree was untouched. These are focused baseline diagnostics, not a complete PostgreSQL gate pass.
