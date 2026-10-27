## Validation

Candidate: `2907d105f85c9596401312d7082af86a5711df06`. Merge base: `77477864d8238b9141e9619b6bcbb6b0aa7fb11b`. Source/test candidate `16c8e174` is identical to this candidate except for the added immutable base metric record; [input bridge](https://github.com/tomer-mayara/Thermus/blob/db8825d0bc6f7331a8ef07b42e85e03931a9536e/workspace-selection/review/final-head-input-bridge.json). All new/changed tests ran locally before their commit.

**Release gates are still in progress. This is not release completion or merge approval.**

| Check | Result |
| --- | --- |
| Full ordinary suite | Exit 0; 5,229/5,229 compiled tests and 51/51 portal tests; 0 failures, cancelled, skipped or todo |
| Focused route/page/acceptance | 57/57 passed |
| Related provider/organization regressions | 28/28 passed |
| Complete browser runtime | 83/83 passed; actual selected/other organization button, one POST, Connect arrival, persisted selection and current-workspace role menu; keyboard, JavaScript on/off, 320px/1280px |
| Typecheck, backend build, portal build, whitespace | Passed |
| Hosted offline build | Exit 0; groups 3,353 + 31 + 20 + 1,187 + 123 + 13 passed, with 0 failed/skipped |
| Linux AMD64 hosted image | Running |
| Self-hosted container | Running in isolated candidate checkout |
| Hosted live | Pending retry: another local staging run owns required port 24443 |
| Complete candidate tier checker | Exit 0; T2 Need architect; preliminary local eligibility eligible; no checker blockers |
| CRAP / architecture process stages | Passed; every changed/new function has 100% measured coverage and CRAP ≤7 |
| MI delta / review stages | Exit 1 for retained existing-file goal misses; dispositions in Quality review |
| habit-hooks | Exit 1; all 21 comment and 2 test-file length findings reviewed and retained; snooze remains empty |

Coverage was freshly captured from the complete unit and integration suites, both selected by this source change: 178 files, 751 processes. The final process reuses verified compatible coverage after the documentation-only commit. [Full process](https://github.com/tomer-mayara/Thermus/blob/db8825d0bc6f7331a8ef07b42e85e03931a9536e/workspace-selection/metrics/process.md), [coverage](https://github.com/tomer-mayara/Thermus/blob/db8825d0bc6f7331a8ef07b42e85e03931a9536e/workspace-selection/metrics/coverage.json), [checker](https://github.com/tomer-mayara/Thermus/blob/db8825d0bc6f7331a8ef07b42e85e03931a9536e/workspace-selection/pr-review.json), and [command logs/status](https://github.com/tomer-mayara/Thermus/blob/db8825d0bc6f7331a8ef07b42e85e03931a9536e/workspace-selection/README.md).

Failure/retry history is retained: acceptance red 2/12 passed; focused red 21/42 passed, 20 failed and 1 timed out before the new lookup existed; permission tightening red 56/57 passed; the missing HTML-escape import was fixed; two stale characterization assertions were updated and the related group passed. These are implementation history, not release passes.

Staging preparation first refused a source archive, then the unpinned Node 22 runtime. The clean trusted Git checkout now uses Node 24.20.0. Its first actual live run exited 1: 29 tests, 0 passed, 1 failed and 28 cancelled because port 24443 was occupied. That run is not a gate pass. No unrelated process was stopped.

No CI checks/statuses are configured on the queried current head. Public-surface generation reported 33 ignored diagnostics in 2 unlisted files; all 50 listed snapshots were verified, and the complete typecheck passed. Separate PostgreSQL, Collector and live search gates are N/A for this increment. The hosted-live command retains its own nested removal/PostgreSQL proof.

The picker browser cases use normal text and short names; they do not prove picker-specific 200% text or long-name layout. No-script checks prove native selection and the Connect URL, not rendering of JavaScript-dependent Connect content. Production remains on `6e2c6739`; this repair is not deployed.
