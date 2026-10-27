# Workspace picker release evidence

Candidate: `feaddbdec5f9e2cc7bf8e07050a4d5e7aa5e5769`.
Actual merge base: `f6b523967223da5ebddafdef1a508d3936cee01c`.
Tested source candidate: `7b46dca42c17ead64263339fd638f39ccb693a0d`.

The final commit adds only the generated immutable base metrics record. The
recursive input bridge in `../workspace-selection/review/final-head-input-bridge-v3.json`
proves every other tracked mode, type, and object is identical. It preserves the
original execution head of each check; it does not claim a rerun of every test.

The current gate state is in `evidence-status.json`. Production verification and
human architect approval are separate from these local checks. The fix has not
been deployed at this evidence phase.

## Selected checks

- `npm test`: exit 0; 5,372 compiled tests and 51 portal tests passed. No failures,
  cancellations, skips, or todo cases. See `npm-test.log`.
- Route/page/acceptance selection: 57 passed. Related organization/provider
  selection: 28 passed. See `focused.log` and `related.log`.
- Complete browser runtime: 83 passed. See `browser-retry.tap` and
  `browser-retry/`. The tests click actual organization buttons by keyboard,
  check one POST, Connect arrival, the selected workspace, and the menu after
  reopening the picker. They cover current and different workspaces, both roles,
  JavaScript on/off, and 320px/1280px viewports.
- Backend build, both TypeScript configurations, portal build, and whitespace
  check passed. See `refresh-summary.md` for exact commands and execution order.
- `npm run build:hosted`: exit 0; groups 3,468 + 31 + 20 + 1,194 + 139 + 13
  passed without failures, cancellations, skips, or todo cases. The command
  includes its own check stage; no extra `npm run check` was run.
- `npm run test:container`: exit 0; 11/11 passed on the final head. See
  `container-self-hosted.log`.
- Linux AMD64 image: 7/7 passed on final head. Live WorkOS: 29/29 passed on the source candidate. See `evidence-status.json`,
  `container-hosted.log`, and `hosted-live.log`. Their isolated Git worktrees
  preserve the tested source candidate and avoid shared build outputs.
- Fresh coverage ran the complete unit and integration suites, both already
  selected by the source change. It captured 196 files/scripts in 767 processes.
  No acceptance or live coverage is claimed. See `coverage.log` and
  `metrics/coverage.json`.
- Final snapshots and process use the actual base and final head. The process
  reuses verified compatible coverage. Delta and Review exit with retained
  existing-file MI goal misses; CRAP and Architecture pass. The final standalone
  CRAP command exits 0. See `metrics/` and the versioned v3 review.
- Final habit-hooks exits 1 with 21 comment and two test-file length findings.
  Each is retained with a concrete reason; snooze is empty. The final and source
  logs are identical. See `habit-hooks-final.log` and the v3 review.
- Final tier checker exits 0 with T2 Need architect, no automatic architecture
  facts, no checker blockers, and preliminary local eligibility eligible.
  Required current-candidate human architect approval remains a merge blocker.

Separate PostgreSQL, Collector, and live search gates are not selected for this
picker increment. The hosted-live command retains its own nested removal and
PostgreSQL proof. Public-surface generation reports 33 ignored compiler
diagnostics in two unlisted files; all 51 listed snapshots are verified and the
full typecheck passes.

## Failure and refresh history

The earlier candidate completed its selected gates, but main gained the SO-03
tenant-role/token-verifier change during the run. Those results remain pinned
to the old candidate under `../workspace-selection/`; they are not release
proof of this refreshed candidate. Main's immutable metrics record won the
merge conflict, as the repository policy requires. The new base keeps the
existing control-plane role when THERMUS_ROLE is absent; production has no such
variable or linked environment group. No new configuration or migration is
needed for this browser flow.

The refreshed browser run first failed two mobile JavaScript cases because the
test checked the workspace label before the portal's asynchronous access read
finished. A focused reproduction retained both failures. The helper now waits
for the same exact visible label within its unchanged timeout; the one-POST,
redirect, and persisted-selection assertions remain. The full 83-case retry
passed. `refresh-summary.md` and the initial logs preserve that history.

The original BDD/TDD failures, fixed import, characterization corrections,
source-archive and Node-version refusals, and staging-port conflict remain in
the prior evidence directory. The refreshed live run waited for the fixed
ports to be free; no unrelated process was stopped.

## Evidence limits

Browser evidence uses normal text and short workspace names; it does not prove
picker-specific 200% text or long-name layout. No-script cases prove the native
selection and destination URL, not rendering of JavaScript-dependent Connect
content. The metric graph has an inherited unresolved CSS import; manual source
and registry review supplements it. Three unrelated app functions have unknown
assessment, and base coverage is an estimate made with head coverage. None is
a changed picker function. No agent review is human approval.

Staging credentials and raw fixture records are excluded. Logs name disposable
staging test identities where the gate prints them. The two maintained PR
comments and main description link immutable evidence commits.

The first AMD64 image run built successfully but could not bind-mount emitted
test support from the macOS temporary checkout into Docker. It exited 1 with
4 passing and 3 failing cases. The complete command was rerun from the canonical
Docker-shared checkout without a code change; the same-source build reused
28 cached steps, and all 7 tests passed. Both run logs are retained.
