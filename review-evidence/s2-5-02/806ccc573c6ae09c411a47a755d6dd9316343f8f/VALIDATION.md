## Validation

Candidate: `806ccc573c6ae09c411a47a755d6dd9316343f8f`. Actual parent: `2271545702a8f1ec28c6f7dd913fec7024ecadeb`
(PR #254). Complete-candidate main merge base:
`9d0546b93d37e74ee9ddc7d9f7f4a66b18de0546`.

The [selection](review/test-selection.md) covers the complete candidate against
main, which includes parent production changes. This increment has no `src/`
change. New integrated and live cases ran locally before the implementation
commit. The [test-byte record](review/tested-files.json) binds those runs to the
reviewed files. Later changes affect documents and the impact declaration only.

| Selected check | Result and evidence |
| --- | --- |
| Full ordinary `npm test` | 4,997 backend +49 portal passed; [log](checks/npm-test.log). |
| Typecheck, source build and portal build | Passed; [typecheck](checks/typecheck-final.log), [build](checks/build-final.log), [portal](checks/portal-build.log). |
| Private PostgreSQL | 26 passed, including four new integrated cases; [log](checks/postgres-final.log). |
| Customer Collector | 10 passed; [log](checks/collector-final.log). |
| Members Chromium | One passed at 390×844; [log](checks/browser-final.log), [image](browser/members-remove-narrow.png), [manager inspection](review/browser-inspection.md). |
| Scoped WorkOS removal | One passed, exact-owned-ID cleanup verified; [final log](checks/removal-live-isolated.log), [journal](live/s25-02-mvnrfbo3-d99a20.jsonl). |
| Full WorkOS selection | 29 selected, 28 passed; one existing operator case failed with WorkOS HTTP408. The affected complete five-case group passed unchanged on retry; [original](checks/hosted-live-final.log), [retry](checks/hosted-operator-retry.log). This is not an initial full-command pass. |
| Native self-hosted container | 11 passed; [log](checks/self-hosted-container-isolated-retry.log). |
| Hosted Linux AMD64 image | Seven passed; [runtime log](checks/hosted-image-isolated-retry.log), [build log](checks/hosted-image-build-progress-2.log). The nested build ran its selected offline checks and renderer cases. No additional standalone `npm run check` was run. |
| Public API snapshots | 49 current; [log](checks/api-surface-final.log). The declaration-only emitter ignores33 errors in two non-public files by design; complete ordinary typecheck passed. |
| Disposable restore hold | Seven stages passed; [result](restore/evidence.json), [drill log](checks/restore-drill-2.log), [manual procedure](restore/restore-drill.mts). No cloud restore or migration. |
| Documents and legal proposal | Manifest/source hashes, exact patch replay and links pass; [proposal checks](docs/verification.json), [command inventory](docs/command-inventory-verification.json), [final record](docs/final-record-verification.json). |
| Habit Hooks | Completed with retained findings, not a zero-finding pass; [log](checks/habit-hooks-final.log) and dispositions in Quality review. Snooze is empty. |
| Fresh coverage and metrics | Fresh selected unit/integration/acceptance collection passed; [log](checks/coverage-combined.log). Four metric sections completed: Delta, Review and CRAP retain main-stack goal misses; Architecture passed. Parent comparison has no production MI/CRAP rows; [checker](metrics/pr-review.json) is T1 locally eligible with no blocker. These are reviewed dispositions, not an all-metric-goals-pass claim. |

### Failure and retry history

[The run ledger](checks/run-ledger.json) retains each attempt. Initial TypeScript
and controlled-fixture failures concerned the optional mock seam, deliberate
session ending, and current logging-form fields. These were corrected before
final passing tests; no production defect or manufactured TDD red is claimed.
The first scoped live journey passed but immediate organization-cleanup reads
were eventually visible. Exact readback later returned 404; bounded read-only
polling now verifies cleanup without retrying DELETE. Review also corrected
journal-failure cleanup, emitted navigation, OAuth state checks and five non-null
assertions; the final scoped live run covers the reviewed bytes.

Default Docker attempts failed from exhausted VM storage. Only exact-owned
rebuildable build caches were reclaimed. The temporary local profile then hit
one GitHub DNS timeout; the unchanged build passed on retry. Both container gates
and final scoped live proof passed there. The profile and all its data were
removed; the original context and six running services remain. [Cleanup evidence](review/docker-isolation-cleanup.json)
records that no shared service, image or volume was removed. No new cloud cost.

The first manual restore drill expected `unavailable`; the current SQL adapter
conservatively returned `unknown` after rejected admission. The corrected manual
expectation retains independent zero-DELETE and effective privilege proof; no
source behavior was changed. Other failed/cancelled logs remain in this archive.

### Provenance and limits

Fresh coverage was captured at `1a6abbb2acfd9030e28ae7dc8d9e4b56583f2584` with Node 24.20.0 and TypeScript 7.0.2: 3,219 backend + 29 portal unit, 1,120 integration, and 594 backend + 20 portal acceptance tests passed. The report covers 172 source files and 1,321 processes across three verified captures. Only the status document changed afterward; the final process explicitly reused compatible provenance. The [binding](review/final-candidate-binding.json), [coverage](metrics/coverage.json), and original capture manifests retain source/input/build identities. The earlier parent report was incompatible with changed test inputs and was not reused. Raw V8 files remain local. The full-main process preserves unknown mappings; it does not invent coverage percentages.

Controlled proof uses real hosted HTTP composition, verified-TLS PostgreSQL,
current authorization and actual MCP requests, with WorkOS, factor sentinels,
renderer and export-transport seams stated in each case. The live proof uses
password-only staging and fresh exact resources. No existing factor was available;
no MFA, SSO, Directory Sync, WorkOS Audit Logs or paid feature was invoked. Privileged
invitation acceptance proves a new membership/role, not recipient/link rules.
The restore drill does not settle every possible late WorkOS effect.

[Read-only cloud facts](review/cloud-read-only.json) confirm the existing Supabase
Free project and password-only WorkOS staging. The production removal table is
absent. Current egress and production least-privilege/TLS/pool checks remain
release gates. Render workspace selection was not received, so no fresh deployment
observation or production mutation is claimed. No release, publication, notice
approval, customer removal or production backup/restore occurred.

The predecessor notice remains selected at runtime. The complete successor
proposal requires exact-byte owner approval, runtime integration, publication,
existing-organization handling and deployed readback. Actual S2-04 release and
a scoped production journey remain pending. These are explicit release holds;
passing local tests do not make S2.5-02 Done. No human approval is inferred.
