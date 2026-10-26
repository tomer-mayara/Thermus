# PR 253 PostgreSQL failure review

Candidate: `fa5d4d7f57ef270df2a056ad523ec22e3b5032b6`.
Parent: `f03a7b73b2c27dc26477d5378a3356f28744a367`.
Main: `8c6d204e8588a664438ba8934ab36670b802525f`.

Fresh `npm run test:logging:postgres` attempt 1 exits 1: **22 tests, 21 pass, one failure, zero cancellations/skips/todos**. The changed first hosted-storage case passes (7,984.475 ms). The second case fails at source `hosted-storage-failure.runtime.ts:170`, emitted line 175: `settingsFinished` is true where false is expected. Its message is “Product and Admin results complete while the queue attempt authorization still waits for SQL.” This is the same assertion as the historical PR 251 exact-main diagnostic, not the later shutdown assertion. Preserve the [full-group log](../../checks/logging-postgres-1.log) unchanged; the JSON report pins its SHA-256, command, times and input identity.

The second case reports 4,726.607 ms total. **This is not a measurement of its blocked read.** Setup, product/Admin actions and cleanup contribute. The current total cannot establish which read resolved, or include/exclude an operation/acquisition/Collector deadline as the dynamic cause.

## Exact source comparison

The entire second `test(...)` block is byte-identical at the candidate, parent and main. [Source comparison](postgres-source-comparison.json) records hashes for all three revisions, including the independently extracted case. The PostgreSQL site, bounded SQL runtime, destination service, AuditSnapshots and AuditCollector whole files are also identical. The destination settings store's `read` and `save` bodies are identical even though that class adds removal operations.

Do not describe the whole runtime file or production composition as unchanged. PR 253 adds four imports and expands the first case to cover removal admission/writes under SQL outage. It adds the removal table migration through shared runtime paths, carries optional `removalStore` through logging composition, adds coordinator lifetime/closure to hosted composition, and changes WorkOS organization behavior. The inherited WorkOS fakes also differ from main. The second case itself does not pass a removal store or request membership deletion, and its service/Collector construction remains the same. These comparisons explain continuity of the failing fixture; they do not prove every dynamic effect is identical.

## Static observation defect remains

Source lines 149–154 warm a capture, wait for one observed read and one `setImmediate`, assert that cold capture only loads settings, then replace `readStarted` and `readSettled`. Current `AuditSnapshots.read` deliberately flushes retained pending events after enabled metadata loads (`audit-snapshots.ts:117,126–132`); the design states that this supersedes the old warm-up drop rule. Collector authorization reads current settings before `sender.start` (`audit-collector.ts:113–123`, `destination-settings-service.ts:49–59`). A sender-start count of zero therefore does not prove the authorization read has settled.

The spy at source lines 144–147 uses the mutable deferred variables when each invocation progresses or finishes. A read started before replacement can resolve the newer deferred object. `lastRead` also has no invocation identity. One immediate turn does not wait for the complete warm-up export lifetime. This is a static cross-operation observation defect that remains regardless of this run's exact schedule. It is a plausible contributor, **not a proved dynamic diagnosis**. The intended post-lock read could also have settled by a configured bound or another unavailable outcome; this log does not identify the read/result.

The case configures a 2,000 ms operation bound and 5,000 ms statement bound; default acquisition is 1,000 ms and Collector authorization is 2,500 ms. Its enclosing timeout is 30 seconds and its later explicit shutdown assertion is 10 seconds. No per-invocation timing/result trace establishes which of these bounds affected this assertion. Do not raise deadlines or attribute CPU/network/resource contention from this evidence.

MCP content/non-error checks, the Members page, invite POST 303 and one matching invitation all pass before the failure. The following health/no-Collector-start checks, explicit shutdown duration, post-close unavailable result and safe-log assertions are not reached in this second case. Registered cleanup still runs; that is not a pass of those unexecuted assertions.

## Historical baseline and current limit

The retained PR 251 diagnostic archived exact main `8c6d204e8588a664438ba8934ab36670b802525f`, built it with Node 24.20.0, then ran both cases of this runtime file. Build exit was 0; tests exited 1 with two tests/one pass/one failure at the same assertion. Its [archive/input/cleanup record](https://github.com/tomer-mayara/Thermus/blob/bc62fd685d39990a16429199a7bd20e6f554d161/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/review/validation/baseline-diagnostic.json) and both command-log hashes were verified during this review. The [baseline build log](https://github.com/tomer-mayara/Thermus/blob/bc62fd685d39990a16429199a7bd20e6f554d161/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/review/validation/baseline-build.log), [baseline runtime log](https://github.com/tomer-mayara/Thermus/blob/bc62fd685d39990a16429199a7bd20e6f554d161/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/review/validation/baseline-hosted-storage-failure.log) and [historical failure review](https://github.com/tomer-mayara/Thermus/blob/bc62fd685d39990a16429199a7bd20e6f554d161/review-evidence/pr251-rebase-8c6d204e/f03a7b73b2c27dc26477d5378a3356f28744a367/review/validation/failure-review.md) remain at their original pinned publication; they are not copied into this candidate evidence. That diagnostic belongs to prior gate head `fd7fa0b1e53d653f92168b75ba4d65618a9138a8` and context `colima-thermus-pr251-r2`.

This is **historical pinned evidence**, not a fresh PR 253 baseline run, a current full-group pass, or proof of an identical dynamic cause. It establishes that the assertion failure predates this increment. The fresh PR 253 group remains failed. No rebase regression or exact dynamic cause is established by this review; neither is ruled out solely by a total case duration.

## Fresh focused retry

After the Collector group passed 10/10, root ran both cases of the failing runtime file once at the original gate head, using the unchanged output freshly built by the Collector command. The [focused retry log](../../checks/quality-postgres-focused.log) and [command record](postgres-focused-command.json) pin the head, command, Docker context, times and exact log SHA-256. The recorded hash is `f00cf7fd9095913a67fafa7dd3901f44cd609022c94e0b3daf73ae99100c472e` and was verified during this review.

The retry exits 1: **two tests, one pass, one failure, zero cancellations/skips/todos**. The changed first case passes again. The second case fails at the same source assertion with the same `true !== false` result. Its reported duration is **1,670.598 ms**, and the complete file takes 6,580.720 ms. Because the failing case itself completes in less than two seconds, expiry of its configured two-second operation timer cannot explain **this retry's** failure. This does not identify which read completed or its result; the stale observer still prevents that inference. The original group's longer case remains dynamically unmeasured, and this focused run does not replace its failed complete-group result.

No further diagnostic is selected. The scope is rebase/conflict resolution only; no test fix is authorized here. The manager performed the retry; this reviewer ran no tests/builds, did not touch dist/source/tracked files, and made no Git/PR mutation or credential access.

[Machine-readable current review](postgres-failure-review.json) retains exact hashes, compared paths, static findings and unresolved dynamic questions.
