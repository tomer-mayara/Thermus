# UI stack finish: gate plan

Read-only gate assessment, 2026-10-26. No checkout, source edit, test, build,
metrics, provider call or GitHub write ran for this assessment. This file is
the only write. The manager must refresh selections from the final candidates.

## Pins and comparison scope

Latest main inspected: `9a3ac1f9763b9d8927ec2d1d5cd4527982d33619`.
Old complete-stack main ancestor: `57c99e2b892acea52bfc3a53aee61b5ae442bf46`.

| PR | Old head | Old actual parent | Required new parent |
| --- | --- | --- | --- |
| UI-01 #263 | `a017020ebe2448f5de6cc7d9cbb0700367fc80b1` | old main | latest main |
| UI-02 #264 | `e8f097dacad194fd3d540dee2fd79b52563e50c2` | old UI-01 | final UI-01 |
| UI-03 #266 | `12d1a3c5b7cab197fa828ef89b7f650f918a7ea2` | old UI-01 | final UI-02 |
| UI-04 #268 | `3380afe663c6a2ef02a0adda525faccd6f5b726f` | old UI-03 | final UI-03 |

Old UI-03 and UI-04 omit UI-02. Restacking them changes the complete candidate,
even if an individual patch applies without conflict. Do not present prior
UI-04 evidence as the four-ticket finish.

Select functional gates from **every changed path against the candidate's main
merge base**, including deleted paths, both rename paths, and dirty/untracked
inputs. Classify the tier and architecture from the **increment against the
actual parent**. Pin the full head, parent tip, parent merge base, observed main,
and main merge base in every evidence bundle. Use those fixed comparisons
through the run; recheck remote refs before publication and merge.

Instructions read at pinned latest main: AGENTS.md, coding principles, test gate
policy, test-code layout, component-registry workflow, PR playbook/rules/check
guide, metrics review guide, and relevant checker evidence code. The policy,
checker and metrics tooling did not change between the two main pins above.

## Selected functional checks

All four candidates change `src/`. Each needs fresh `npm test`, then
`npm run typecheck` and `npm run build:user-portal`. Do not add `npm run check`.
Ordinary tests include integration, acceptance, interface and portal groups.

| Check | UI-01 | UI-02 | UI-03 | UI-04 |
| --- | --- | --- | --- | --- |
| Focused new/changed ordinary tests before commit | Yes | Yes | Yes | Yes |
| Full ordinary, typecheck, portal build | Yes | Yes | Yes | Yes |
| Full Members browser runtime group with built assets | Yes | Yes | Yes | Yes |
| Self-hosted container | Yes | Yes | Yes | Yes |
| Hosted offline build and Linux AMD64 hosted image | Yes | Yes | Yes | Yes |
| Both hosted-live entries, sequentially | N/A unless final scope changes | Yes | Yes | Yes |
| Full seven-entry private PostgreSQL group | N/A unless final scope changes | N/A unless final scope changes | Yes | Yes |
| Full two-entry Collector group | N/A unless final scope changes | N/A unless final scope changes | Yes | Yes |

UI-01 changes the Web shell/layout and browser site consumers, without changing
provider/storage/transport behavior or dedicated live/SQL/Collector inputs.
UI-02 changes `hosted-removal.live.ts`, selecting the complete existing live
group. UI-03 changes `hosted-storage-failure.runtime.ts`, selecting its SQL
group, and changes the Audit journey and its read-only container mounts,
selecting the Collector group. Those groups remain selected in UI-04's complete
candidate. Trace the final support consumers again after conflict fixes.

Commands and limits:

- Ordinary focused file: `npm run build`, then
  `node --test dist/test/<suite>/<path>.test.js`. Portal files run directly with
  `node --test test/<suite>/user-portal/<path>.test.ts`.
- Browser: `npm run build:user-portal && npm run build && node --test dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js`.
  Set a per-candidate `THERMUS_BROWSER_EVIDENCE_DIR` and inspect saved screenshots.
  Retain JS on/off, keyboard, 320/1280px, long text, 200% text, shell/Audit,
  invite/Cancel/native-validation, quiet Remove/Leave and pending actions.
  Add regressions for every restack fix through real public behavior.
- `npm run test:container` needs Docker, Buildx and Compose, pinned inputs,
  trusted rules, and the existing outbound denial.
- `npm run build:hosted` needs an absolute pinned Lightpanda, Git, OpenSSL and
  loopback. `npm run test:container:hosted` must pass on Linux AMD64. A fresh,
  proven, uncached nested `build:hosted` execution in that image can supply the
  offline-build result; retain the full build record and do not claim two runs.
- `npm run test:hosted-live` runs both full files. Use the reviewed staging
  wrapper, pinned renderer, Chromium, OpenSSL, Docker, exact fresh fixture
  ownership and cleanup. It needs public network and ports 46443/46480.
- `npm run test:logging:postgres` and `npm run test:logging:collector` need Docker
  and OpenSSL; preserve disposable SQL/TLS roles and isolated Collector network.
- No extra standalone renderer run is needed if the selected fresh hosted build
  establishes both full renderer files. Search-live and separate Axiom-live are
  not selected by these UI increments. Ordinary Axiom tests remain selected.
- An explicit release is not requested. Do not add production release gates or
  treat a release workflow dispatch as necessary merely because main added it.

Use Node `24.20.0`, pnpm `12.10.1`, and `pnpm install --frozen-lockfile`.
Check the direct npm/node runtime too. Ordinary tests need the existing Axiom
test ingest settings, pinned Lightpanda 1.0.0 and public smoke-test network.
Never print credentials. Preserve test counts, pass/fail/skip/todo counts,
exits, attempts, cleanup and exact fixture ownership. Zero selected tests,
skipped cases and failed prerequisites are not passes.

New source behavior requires a real failing public acceptance specification
before implementation, then focused red/green TDD. A behavior-preserving
restack/refactor uses passing characterization first; do not create false red
steps. Tests under `test/` target `src/`, not prose, scripts or tooling.

## What changed on main and what can be reused

Latest main changes hosted fetch/search capacity ownership/configuration,
startup and fetch/search tests, new capacity acceptance/integration/unit tests,
and the `build:hosted` selection. It adds a manually dispatched native AMD64
hosted-image workflow and changes the image test/helper to accept a prebuilt
image. The workflow builds once, gates that image, then pushes it. A main run
does not prove any UI candidate. No automatic PR run is established by this
manual workflow. Check current required GitHub statuses separately.

Old full ordinary/type/build/container/offline/live/coverage results cannot be
transferred to these rebased heads: runtime/test/build inputs changed. Restack
conflict fixes also require new focused and browser proof. The old UI-03 and
UI-04 live records are failures, never reusable passes: UI-03 28/29 plus later
429 setup failure; UI-04 22/29, six shared quota failures and a separate 503 on
reinvitation with no proven cause. Retry the full selected group when staging
can run; a later quota observation does not explain the older missing Revoke
form or the separate 503.

Safe reuse: installed tools, pinned downloaded assets/images and reviewed
launcher structure; approved help bytes/version/hash when unchanged; prior
BDD/TDD history; old screenshots as history; and retained finding reasons after
review of the new delta. Existing evidence links remain valuable history.
Do not copy old counts or current-candidate approval claims.

A result may be rebound across a later documentation-only commit only after
verifying byte-identical **all relevant** source/test/build/runtime inputs and
retaining before/after provenance. A source-file match alone is insufficient.
Coverage has its own strict validation; do not edit report commit labels or
fingerprints. Its input identity includes `src`, `test`, helpers and fixtures,
`script`, patches, migrations, docker, `.github`, `.habit-hooks`, manifests,
lockfiles, root non-prose files, executable modes and the Lightpanda guide, plus
runtime/compiler/suite/measurement identities. `.pr-impact.json` is a root JSON
input: settle it before coverage. Most unrelated prose is excluded. Raw capture
import needs its original absolute checkout path and verified manifest; a commit
SHA alone proves no compatibility. Reuse only after the native reader accepts it.

## Serial schedule and metrics

Use one checkout execution lane. Root finishes source/test/conflict edits,
focused checks, affected docs and declarations, then freezes inputs. Stop every
test, dev server, browser site, build, Docker context capture and provider run
before metrics. Do not let another agent mutate any shared input or run a
comparison while coverage runs. Native ast-metrics compare can temporarily
check out the base in this checkout. Snapshot-base also manages temporary Git
worktrees. Do not run metrics processes in parallel, even for different PRs.

For each candidate, bottom-up:

1. Review the increment and complete-vs-main paths. Run changed/focused tests
   before commit; run selected functional gates serially. Preserve a precise
   input manifest if a dirty run is later rebound to a committed candidate.
2. Finish documents, fresh `.pr-impact.json` and any needed public declaration
   snapshots. Commit the complete candidate. Keep `git status --porcelain` empty.
3. Collect fresh verified coverage. The full ordinary selection permits unit,
   integration and acceptance coverage. To avoid the prior redundant unit then
   integration replacement, collect already-selected integration directly when
   it fully assesses the changed Web functions:
   `pnpm exec node script/code-quality/ast-metrics-coverage.ts --suite integration`.
   Add `--suite unit` in the same collector run if needed. Each requested suite
   must already be selected; preserve all raw captures, child flush evidence
   and normalized coverage. Do not use `--allow-unverified` as gate evidence.
4. With `P` equal to the actual parent ref (main for UI-01), run in sequence:
   `ast-metrics-snapshot.ts --base P`, `ast-metrics-snapshot.ts`,
   `ast-metrics-process.ts --base P --json ast-report/process.json`, then
   `ast-metrics-crap.ts --base P --json ast-report/crap.json`, each via
   `pnpm exec node script/code-quality/<command>`.
   The process reuses compatible coverage; do not add `--collect-coverage` after
   a successful compatible explicit capture. Archive per-candidate outputs
   before the next candidate overwrites `ast-report` defaults.
5. Read all four process outcomes, review findings and required changed-function
   CRAP rows. Resolve tool failure/missing identity/coverage. Existing low MI
   needs a current reason; new-file MI <85 and required CRAP goal misses need
   permitted exceptions and required human review. Added functions must be
   <=15; changed functions <30. Correct high findings or retain each with its
   reason. Do not alter baseline unless `.ast-metrics.yaml` rules change.
6. Commit a newly generated immutable history record if the verified process
   writes one. Never edit an old record. Main's existing record wins conflicts.
   A parent off main may not create a record. After any commit, rerun the final
   process/checker evidence: process/review must name the final head even if
   coverage still matches the unchanged inputs.
7. Run `habit-hooks --branch P` on the complete candidate. Resolve every enforced
   smell or record each retained reason. Snooze stays `[]`. Manually review
   docs/links and `git diff --check`. Recheck registry impact and public snapshots.
8. Stamp `ast-report/impact.json` from committed `HEAD:.pr-impact.json`, with
   `base = git merge-base P HEAD` and `head = git rev-parse HEAD`. Give that exact
   parent to `script/pr-review/check.ts --base P --repo tomer-mayara/Thermus`,
   with `--impact`, both snapshots, `--crap`, `--process`, `--review`, and inspect
   `eligibility`/`blockers`, not only exit 0. Do not use `--allow-dirty` for sign-off.

There is a documentation mismatch to retain explicitly: AGENTS requires the same
base through comparisons and places stacked metrics with the parent, while
`script/pr-review/README.md` says parent stamp/check/MI/CRAP but process keeps
`origin/main`. `metrics-files.ts` checks process/review head, not process base,
and prior UI-04 ran its process against the parent. The authoritative sequence
above follows the higher-priority supplied AGENTS instruction. Do not change
policy or silently mix bases. If the manager also retains the guide's complete
main process, run and archive it separately for the same frozen head; then rerun
the authoritative parent process/CRAP before the final checker, because process
overwrites default reports. Keep main validation visible in either case.

## Architecture, PR report and final approval

Read latest main's registry first: it has new capacity/deployment/decision prose
that old UI reviews predate. Inventory every Mermaid block and compare each UI
increment to its actual new parent. Do not attribute inherited main ADRs or
registry changes to UI-01; they are in its base. Expected UI work stays inside
Web, with no changed callable/public declaration or new runtime dependency.
Confirm rather than copy that conclusion. Regenerate snapshots only if exports
or listed modules change; the checker still verifies all current snapshots.
No L3 comparison/L4 is required if production architecture is unchanged; record
the no-callable-change L4 rationale. If actual new facts/flags arise, declare
them, refresh comparison evidence and obtain the required higher review.

All four old increments were T1 solely for removal/replacement in the browser
inventory of `docs/implementation/test-gate-policy.md`. The new checker decides
each new increment. Keep canonical labels and every reason. Do not remove or
weaken policy changes merely to lower the tier. Prior local `eligible` is not
new local eligibility, and local eligibility never proves live pass or approval.

Before final approval, publish one short main description and exactly the same
two maintained supporting comments per PR: **Validation** and **Quality review**.
Pin heads/bases, state Architecture line/facts and impact summary, link accessible
full evidence and history, mark old evidence stale, record each retained finding,
and read published bodies back. Current evidence in `.cache` alone is not an
accessible GitHub artifact. Return Ready PRs to Draft before fixes; Ready only
after required checks pass.

The final approval request must show four **concrete full pinned heads**, each
PR link, actual parent and merge-base SHA, resulting tier, check/evidence links,
remaining blockers (none if asking to merge), and intended bottom-up order
`#263 -> #264 -> #266 -> #268`. Ask the independent authorized owner/team member
to approve those exact four candidates and scopes; an architect is needed for
any resulting T2. One qualified human can approve all named candidates in one
explicit response. Prior generic merge authorization, old-head approval, an
owner-account label or AI-posted approval is not current-candidate human review.
This approval cannot be obtained yet because final heads do not exist.

T0 needs no required human review; T1 needs independent authorized human team
or owner approval; T2 needs independent authorized human architect approval.
No approval waives live or other gate failure. A newly added ADR requires owner
merge. If heads change after approval, refresh evidence and current-head approval.
Merge once each, bottom-up, only when clean, eligible and in scope. If a merge
strategy/restack rewrites a child's approved head, it is a new candidate; do not
reuse the old approval. Preserve actual parent comparisons and recheck current
PR state and required checks at each merge.
