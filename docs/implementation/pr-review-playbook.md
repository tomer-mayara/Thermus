# PR review playbook

Status: proposal of 2026-10-20, in manual trial. The command
[script/pr-review/check.ts](../../script/pr-review/README.md) computes the
route from checks 1, 3 and 5 and names the modules of check 2. The surface
snapshot, the ratchet, the merge step and CI do not exist yet. Agents run the
command as the section "Review route" of [AGENTS.md](../../AGENTS.md) says. In
the trial, the agent runs the check, declares the facts, and drafts the
decision; the owner decides and reviews. The route guides the depth of the
owner's review. It does not yet change who merges: AGENTS.md and the
[test gate policy](test-gate-policy.md) govern the merge.
The lists, thresholds and routes of each trigger are in
[pr-review-rules.yaml](pr-review-rules.yaml). The checks will read that file.
This playbook replaces the long architect review draft of 2026-10-20, which
is not in the repository.

## Goal

Deterministic checks decide which pull requests a human reads, and when.
A human reads an architecture change before the merge. An architecture
change is a change to a package, a public contract, a dependency direction,
or a protected area. A change that stays inside a package and touches no
protected path merges on green checks. The owner reads that change after the
merge. Target: at most three in ten pull requests need a human before the
merge. No check calls a language model.

## Routes

| Route | Condition | Human action | When |
| --- | --- | --- | --- |
| `FIX` | A required check failed, or a check found a fact that the pull request has not declared in the rules file: a new edge, a changed surface, a forbidden edge. | The author repairs the pull request, or declares the fact. A human cannot approve a red check. | Before merge. |
| `ASK` | The pull request changes a protected path. The rules file, a surface snapshot, a contract document and the dependency graph section are protected paths. | The architect answers the question of the matching rule and records the decision: in the trial in the pull request description, later as a decision record (ADR) under `architecture/decisions/`. | Before merge. |
| `READ` | A size or test signal fired, or the pull request changes a metric exception or the lint baseline. | The owner reads the diff and sets the `approved` label. | Before merge. |
| `SHOW` | All checks are green and an executable file changed. | The owner skims the merged diff within one working day and reverts a bad change. Render deploys `main` on each push, so the change is live before the owner reads it. | After merge. |
| `SHIP` | All checks are green and no file under `scopes.executable` changed. | Nobody. | Merge on green. |

Take the first route from the top whose condition holds. Print every reason,
not only the first. A `hold` label blocks the merge on every route. The merge
workflow is the only thing that merges. An `ASK` or `READ` pull request merges
only with the `approved` label. An `ASK` pull request must also add or change
a file under `architecture/decisions/`. All agents use the owner's GitHub
account, so GitHub cannot tell an agent from the owner. Until a separate bot
account and branch protection exist, the label is a convention. The audit job
of check 7 finds a merge that skipped its route. In the earlier draft,
`FIX` was `FIX_REQUIRED`, `ASK` was `ARCHITECT_REQUIRED`, `READ` was
`ROUTINE_REVIEW`, and `SHIP` and `SHOW` split `AUTO_MERGE`.

## The seven checks

Each check is a fitness function: an automated check of one architecture
property. Each check runs in CI on the diff against the merge base with
`origin/main`, with rename detection. It reads the rules file and prints its
route and its reasons. The checks exit 0 and set a `route:<name>` label; CI
itself turns a failed command into `FIX`.

| # | Check | Rule | Route | Today |
| --- | --- | --- | --- | --- |
| 1 | Protected paths | A changed file matches a `protected_paths` pattern. The groups are policy, contracts, dependencies and build, deploy and data, and security. Each group carries the question for the architect. | `ASK` | The command matches the changed paths against the groups and prints the questions. |
| 2 | Public surface | CI emits the declaration file of each module in `public_surface`, with the same-package types it re-exports. CI compares the result with the committed copy under `docs/api-surface/`. A difference that the pull request has not committed is `FIX`. A committed change to a snapshot or to `docs/reference/` is a protected path, so that change is `ASK`. | `FIX`, `ASK` | The command names the changed modules and the modules that import a changed file of their package. Declaration emit works with the pinned TypeScript. The snapshot folder and the compare step are to build. |
| 3 | Dependency graph | CI builds the package graph of `src/` from static, re-export, side-effect, dynamic and type imports. The rules file lists the package edges, the top-level folders, the package cycles, the external imports, the Node builtins, and the cross-package files in `public_surface`. A fact that the rules file does not list is `FIX` until the pull request lists it. That listing is a protected change, so that change is `ASK`. An edge in `forbidden_edges` is `FIX` with no way to list it. | `FIX`, `ASK` | The command compares the graph of HEAD with the rules file and prints the facts to declare. |
| 4 | Ratchet | CI measures CRAP per function and the maintainability index (MI) per production file. CRAP is the risk score of a function: its complexity, raised by the share of its code that the tests do not cover. The `main` workflow writes the scores of each `main` commit to the scores file, so a pull request compares its head with its merge base. `FIX` fires in five cases: a new function above CRAP 15; a changed legacy function at CRAP 30 or more; a changed function above its goal and worse than at the base; a changed function with unknown coverage; a new production file below MI 85. A legacy function is one that exists at the start commit. `READ` fires for an MI drop of five or more on an existing file. An exception entry in the exceptions file needs a unit, a metric, a bound, a reason, and an expiry date. A change to that file is `READ`. An expired entry is `FIX` for a pull request that changes its unit. | `FIX`, `READ` | The scripts compute both scores. The scores file, the exceptions file and the compare step are to build. |
| 5 | Size and tests | `READ` fires above 400 changed production lines, or above 1,500 changed lines in total without generated files, with a request to split. CI compares the test counts of the Node test reporter with the merge base. Fewer tests, or more skipped or todo tests, is `READ`. A non-empty habit-hooks snooze file is `FIX`. | `READ`, `FIX` | The command counts the lines, the test cases, and the skip and todo marks. The test reporter counts are to build. |
| 6 | Show and ship | A green pull request with an executable change merges on green and gets the `show` label. The owner reads the list of pull requests with the `show` label once a day. A green pull request with only document changes merges with no label. | `SHOW`, `SHIP` | To build: the merge step and the label. |
| 7 | CI | Workflows run the full ordinary suite with coverage, the type check, the build checks, habit-hooks, the metrics process, and checks 1 to 5 on every pull request. CI runs the whole suite on every pull request. The selection rules of the test gate policy stay for local runs. The hosted build and container checks run on the AMD64 runner for a change under `src/`, `docker/` or a Dockerfile. The `main` workflow writes the scores file and audits each merge. The audit recomputes the route and opens an issue when the route needed a human and the `approved` label was absent. Required checks need branch protection, which needs GitHub Pro or an organization. | `FIX` | Nothing exists. The repository has no workflow and no branch protection. |

## What the human does on each route

- `ASK`: read the question of the matching rule. Decide. Write a decision
  record under `architecture/decisions/`. Update the rules file or the surface
  snapshot in the same pull request. Set the `approved` label. The owner can
  be the architect. One human is enough.
- `READ`: read the diff before the merge. Set the `approved` label, or request
  changes. For a metric exception, add or widen an entry in the exceptions
  file.
- `SHOW`: skim the merged diffs once a day. Revert a bad change. Count the
  reverts.
- `FIX`: the author repairs the pull request, or declares the new fact in the
  rules file, and pushes again.

## Keep the rules honest

- Review the rules every month. Look at how many pull requests took each
  route, the reverts, the false alarms, and the problems the checks missed.
  A false alarm is an `ASK` or `READ` pull request with no commit after the
  route label. Change a threshold or a list through an `ASK` pull request.
- Stop rule: two reverts of `SHOW` pull requests in one month move the
  executable files of the reverted pull requests to `read_paths`. A revert is
  a merge whose message says "This reverts commit". The owner removes the
  paths from `read_paths` after the fix.
- The author cannot approve an `ASK` or `READ` route. In a one-person project,
  the owner reads with the question of the rule and records the decision.

## Adoption steps

1. Manual trial, one month: agents compute the routes by hand and record
   them on each pull request, as AGENTS.md says. The labels and the pull
   request descriptions are the record; the monthly review collects them
   into the calibration file. The trial does not wait for CI.
2. Seed the lists in the rules file from the current code. The draft rules
   file seeds the packages, the edges, the builtins, and the surface
   candidates.
3. Add CI with the current suite and the metrics process. This is check 7.
   The runner needs Node 24.20.0, pnpm, ast-metrics 0.43.1, habit-hooks, the
   Lightpanda runtime of the renderer gate, Docker, and the secrets of the
   Axiom and WorkOS interface tests.
4. Build the remaining checks under `script/pr-review/`: the surface
   snapshot of check 2, the ratchet of check 4, and the merge step and labels
   of check 6.
5. Run checks 1 to 5 in report-only mode for one month: the checks print
   routes and set labels, but nothing merges or blocks on the routes.
6. Turn on merge on green for `SHIP` and `SHOW`. Update AGENTS.md, the test
   gate policy, and the metrics guide in the same pull request.
