## Validation

Candidate: `feaddbdec5f9e2cc7bf8e07050a4d5e7aa5e5769`. Actual merge base: `f6b523967223da5ebddafdef1a508d3936cee01c`. Most source checks ran on `7b46dca42c17ead64263339fd638f39ccb693a0d`; the final commit adds only the generated immutable base metric record. The [recursive input bridge](https://github.com/tomer-mayara/Thermus/blob/e51083b16b27eef9b8ff99696d15747cdaa585be/workspace-selection/review/final-head-input-bridge-v3.json) proves all other tracked inputs identical while preserving each execution head. Final image, self-hosted container, metric process, CRAP, habit and tier checks ran on the final head. All new or changed tests ran locally before their commit.

**All selected release gates are complete. Required human approval and production verification are still pending.**

| Check | Result |
| --- | --- |
| Full ordinary suite | Exit 0; 5,372/5,372 compiled and 51/51 portal tests; 0 failed/cancelled/skipped/todo |
| Focused route/page/acceptance | 57/57 passed |
| Related provider/organization regressions | 28/28 passed |
| Complete browser runtime | 83/83 passed; actual current/other organization button, one POST, Connect arrival, persisted selection, correct role menu; keyboard, JavaScript on/off, 320px/1280px |
| Typecheck, backend build, portal build, whitespace | Passed |
| Hosted offline build | Exit 0; groups 3,468 + 31 + 20 + 1,194 + 139 + 13 passed, no failures/skips |
| Linux AMD64 hosted image | Exit 0; 7/7 passed on final head after the mount-path retry below |
| Self-hosted container | Exit 0; 11/11 passed on final head |
| WorkOS hosted live | Exit 0; 29/29 passed on source candidate; real workspace selection, current roles, session expiry, revocation, invitations, removal and MCP isolation |
| Final tier checker | Exit 0; T2 Need architect; preliminary local eligibility eligible; no checker blockers |
| Final CRAP / architecture stages | Passed; every changed/tool-new function has 100% measured coverage and CRAP ≤7 |
| Final MI delta / review stages | Exit 1 for reviewed existing-file goal misses; dispositions in Quality review |
| Final habit-hooks | Exit 1; 21 comment and 2 test-file length findings reviewed and retained; snooze empty |

Fresh coverage captured the complete unit and integration suites, both selected by this source change: 196 files/scripts, 767 processes. Final-head process verified compatible inputs after the metrics-only commit; no acceptance or live coverage is claimed. [Full process](https://github.com/tomer-mayara/Thermus/blob/e51083b16b27eef9b8ff99696d15747cdaa585be/workspace-selection-refresh/metrics/process.md), [coverage](https://github.com/tomer-mayara/Thermus/blob/e51083b16b27eef9b8ff99696d15747cdaa585be/workspace-selection-refresh/metrics/coverage.json), [checker](https://github.com/tomer-mayara/Thermus/blob/e51083b16b27eef9b8ff99696d15747cdaa585be/workspace-selection-refresh/pr-review.json), [command logs and limits](https://github.com/tomer-mayara/Thermus/blob/e51083b16b27eef9b8ff99696d15747cdaa585be/workspace-selection-refresh/README.md), [exact status](https://github.com/tomer-mayara/Thermus/blob/e51083b16b27eef9b8ff99696d15747cdaa585be/workspace-selection-refresh/evidence-status.json), and [live proof](https://github.com/tomer-mayara/Thermus/blob/e51083b16b27eef9b8ff99696d15747cdaa585be/workspace-selection-refresh/live-evidence/s25-02-mvr7q3tz-8fbf75.jsonl).

Failure/retry history remains visible. Original BDD red: 2/12 passed; focused red: 21/42 passed, 20 failed, 1 timed out; permission tightening: 56/57 passed. The missing import and two stale characterizations were corrected. After main advanced to SO-03, the combined candidate was retested; old `2907d105` results are historical. The refreshed browser run failed two mobile JS cases before asynchronous workspace text appeared. Both reproduced; waiting for the same exact label under the unchanged timeout preserved all assertions, and the complete 83-case retry passed. [Refresh record](https://github.com/tomer-mayara/Thermus/blob/e51083b16b27eef9b8ff99696d15747cdaa585be/workspace-selection-refresh/refresh-summary.md).

Staging preparation historically refused a source archive and Node 22, then encountered an occupied port (0 passed, 1 failed, 28 cancelled). A trusted Node 24.20.0 checkout passed the old 29-case run. The refreshed run waited for the shared ports and passed all 29; no unrelated process was stopped. The first fresh image built, but Docker could not bind-mount test files from the macOS temporary checkout (4 passed, 3 failed). The full canonical-checkout retry reused 28 cached build steps and passed all 7 without a source edit. Both image logs are retained.

[Current-head CI](https://github.com/tomer-mayara/Thermus/blob/e51083b16b27eef9b8ff99696d15747cdaa585be/workspace-selection-refresh/ci-checks-final.json) has no configured checks or statuses. Public-surface generation reported 33 ignored diagnostics in two unlisted files; all 51 listed snapshots were verified and full typecheck passed. Separate PostgreSQL, Collector and live search gates are N/A for this picker increment; hosted-live retains its nested removal/PostgreSQL proof. No separate `npm run check` was added.

Browser cases use normal text and short names, so picker-specific 200% text and long names remain unproven. No-script cases prove native selection and the Connect URL, not JavaScript-dependent Connect rendering. Production remains on `6e2c6739`; this repair is not deployed. [Prior report version](https://github.com/tomer-mayara/Thermus/blob/e51083b16b27eef9b8ff99696d15747cdaa585be/workspace-selection/comment-pre-refresh-6453601476.md) and [original immutable evidence](https://github.com/tomer-mayara/Thermus/tree/db8825d0bc6f7331a8ef07b42e85e03931a9536e/workspace-selection) preserve earlier scope and evidence.
