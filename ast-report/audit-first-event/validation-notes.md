# Validation selection and history

Base 9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546. Source implementation first committed in abaebf0c282e4bdc48627ee75f555da238ac2b50; test-only follow-up 35f25c7b9a13f46e9e4cd60bb329aa1f552a43a9. Final candidate SHA must be recorded before publication.

## Selected

Two source files under src/logs/audit change. Required full ordinary npm test, npm run typecheck, npm run build:user-portal, self-hosted container, hosted offline build and Linux AMD64 image, Audit Collector runtime, habit-hooks, API surface verification, architecture review, ast-metrics snapshots/process/coverage/CRAP, and committed-candidate classification.

The hosted image gate invokes the complete npm run build:hosted inside Dockerfile.hosted. Its inner build covers hosted offline and renderer checks. Do not add a duplicate top-level npm run check or build:hosted. Direct dedicated node commands after a current npm-test build select exactly the same files as package commands without another clean build.

PostgreSQL gate is not selected: no settings store, SQL runtime, hosted storage configuration or SQL lifetime code changed. Snapshot payload retention changes but the SQL owner and contract do not. WorkOS live gate is not selected: no authentication or organization/provider operation changed. Standalone renderer/search-live gates not selected: pipeline and renderer behavior unchanged (the image includes its existing offline renderer proof). Production Axiom verification is deferred until reviewed merge/deployment; local Collector proof is not production receipt or durable storage.

Node 24.20.0; pnpm 12.10.1; frozen lockfile install passed. LIGHTPANDA_BIN uses the existing pinned 1.0.0 binary. No new dependency or infrastructure.

## BDD and TDD

Acceptance-first: clean build, four expected failures against old source (startup, disabled-cache expiry after Enable, recovery, enabled expiry). Initial six focused unit red tests also failed on old source, but their first build logs include assertion-narrowing TypeScript errors. Those test typing errors were fixed; no claim that the early unit build was clean. Final focused build and 57 tests passed. Actual Collector runtime: 10 passed with first startup event and expiry event query/result/redaction/truncation assertions, no warm-up dependency.

Independent review caught three fresh-path assertions that had inadvertently shifted to the startup event plus imprecise observation payloads. Tests were corrected to inspect the intended event, reset fresh throw behavior, and distinguish old-active/old-queued/refresh-trigger. Focused 57passed again.

The first full ordinary run on abaebf0c found seven additional old warm-up assumptions in collector-dispatch and hosted-customer-export. Manager interrupted the known-failing run after 204s to repair before further gates; this is not a full-suite pass. Raw interrupted output retained under history/abaebf0c. Three test/support files were corrected without source changes; 11 focused cases and 400 ordinary Audit/lifecycle cases passed before the 35f25c7b commit. Full ordinary validation reruns on that complete candidate.

No tests are added for documentation, scripts, config or tooling. No new skip/todo. The complete candidate keeps the snooze list empty.

## Complete runtime candidate results

On `35f25c7b9a13f46e9e4cd60bb329aa1f552a43a9`:

| Check | Result |
| --- | --- |
| Full `npm test` | 4,805 backend and 49 portal tests passed; no failures, skips or todo cases |
| `npm run typecheck` | Passed |
| `npm run build:user-portal` | Passed |
| API declaration check | All 48 snapshots current |
| Self-hosted container | 11 tests passed |
| Linux AMD64 hosted image | 7 tests passed; includes the full hosted offline build and real renderer checks |

The separate real Audit Collector gate passed all 10 tests on the same production implementation. The later three-file follow-up only corrects ordinary test fixtures; none of that runtime gate's source or support files changed. The dedicated gate is therefore not repeated. Its exact source candidate and raw log remain in this evidence bundle.

The declaration-only emitter reports 33 ignored compiler diagnostics in two unlisted files, as its documented narrow scope permits. The complete `npm run typecheck` passed. No public declaration snapshot changed.

`origin/main` was rechecked remotely and remains the pinned base. All 13 registry Mermaid blocks are byte-identical; changed document fences are balanced, referenced local paths exist, and `git diff --check` is clean.

## Final evidence binding

Final candidate: `f0d4efe3d48ea19bfe86457d923605325e0beae1`. Its only difference from the full runtime-test candidate `35f25c7b9a13f46e9e4cd60bb329aa1f552a43a9` is `docs/metrics/2026-10-25-9d0546b9.json`, written by the successful four-stage metrics analysis. The generated record was not edited. No test is added or repeated for this historical data file.

The final process and review were rerun on the final commit. They reused verified compatible unit coverage captured on `35f25c7b`, source fingerprint `85e7a8eaf1dbed807c91905a39d7042a5fb3fd11f8e03114fc2cc91f36b7038b`, inputs fingerprint `feeccbe170a2d5c244cf96d08efa71af8b7e8245fa63eb13ae28676cac85a59a`, Node 24.20.0, TypeScript 7.0.2, measurement `own-characters-1`. Both full unit parts were selected by the source change. Coverage is not edited. Initial and final process exits were 1 for retained file/review goals; all four analyses completed. Separate CRAP and final committed-candidate checker exited 0. The checker reports no technical blocker; required human approval is a separate condition.

Current head/base stamps, both snapshots, full process/review/CRAP, coverage provenance and raw logs are retained in the review bundle. Earlier draft text and the first process report are preserved under `history/`; those reports describe their original commits, not the final candidate.
