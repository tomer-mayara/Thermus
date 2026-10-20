## Approach

If you are the top-level agent, you are the manager: you plan the work,
delegate it, review it, and sign it off. You usually do not write the code
yourself.

- If you are a subagent, do the work that the manager gave you. Start no
  further subagent unless the manager asks you to.
- Follow `CLAUDE.md` for Claude model rules. If you are not Claude, use a
  smaller model for small work (Typically Opus 5.5, GPT-6.1 Sol or Grok 4.7).
- Review the work of each subagent and sign it off.
- Take the lead yourself on a very complex task, or on a task that needs an
  understanding of the whole system.
- Use 0 to 4 subagents at one time.
- When you or a subagent write or update a document, a ticket, or a code
  comment, follow ASD-STE100 where possible: simple language. No legend
  and no strict conformance are needed.

## Coding principles

Use these principles yourself, give them to each subagent, and enforce
them in your review.

Read the [coding principles](docs/coding-principles.md) for general design guidance.

- Write the BDD acceptance test first: a Given-When-Then scenario or an
  equivalent executable specification. The test fails, because the feature
  does not exist yet.
- Drop down into TDD to implement the pieces that the acceptance test
  needs. For each small step: write a failing unit, interface, or
  integration test; make the test pass; refactor.
- Continue until the acceptance test is green. Green is the signal that
  the specification is met.
- Follow DRY3: make a shared function after the third copy, not before.
- Make sure that the required checks are green before a merge.

### Test types

- **Unit tests:** Fast, automated tests of focused behavior in one Delamain
  package. Replace other Delamain packages with test doubles at their public
  interfaces for direct and indirect calls. Real collaboration within the
  package is allowed. Type-only imports of public contracts are allowed
  because they run no production behavior. Keep each test independent of
  other tests.
- **Integration tests:** Verify real collaboration between two or more
  Delamain packages through public interfaces. These remain integration
  tests even when they run fast or in one process. They cover collaboration
  across package boundaries that some methods call sociable unit testing.
- **Interface tests:** Focus on one public interface or data contract. Check
  accepted inputs, outputs, data formats, events, and error behavior. Keep
  these tests few and limited to the contract. A test that connects real
  Delamain packages to check collaboration is an integration test.
- **Acceptance tests:** Give executable specifications of user-required
  behavior. Exercise public interfaces in an environment similar to
  production. Check observable outcomes against the acceptance criteria.
  These tests can span packages; their purpose is to show that the system
  meets a user requirement.
- **Test code layout:** [docs/testing/test-code-layout.md](docs/testing/test-code-layout.md)
  gives the terms for the auxiliary test files (DSL, protocol driver, site,
  test double, fixture data, preload, probe, isolation helper), the layout of
  `test/support`, and the placement and dependency rules.

## Pull requests

- Open a draft pull request first.
- Before Ready, select tests from the complete candidate. If any file under
  `src/` changes, run the full ordinary suite with `npm test`, then
  `npm run typecheck`, `npm run test:build`, and `npm run build:user-portal`,
  plus the applicable gates in the test gate policy. These commands cover
  the remaining check stages; do not add `npm run check`, which would repeat
  unit and portal tests.
  Otherwise, run only the affected test groups for changes under `test/`
  and the existing focused tests for other changed files. Use the
  [test code layout](docs/testing/test-code-layout.md) to identify groups;
  follow shared helpers and fixtures to the groups that use them. Combine
  the selections for mixed changes; a `src/` change takes precedence.
  Do not expand the selection through a command or test that starts a
  broader suite, including `npm run check`. A document change alone needs
  no executable test added to check its prose. The test gate policy gives
  the selection details; an explicit release uses its separate release gates.
- Run `habit-hooks` on the complete candidate. Correct each enforced smell,
  or give the reason that you keep it. The snooze file of habit-hooks stays
  empty.
- Run each selected new or changed test locally before the commit, including
  tests outside the ordinary suite. If a test starts a broader suite
  outside the selection, record that run as deferred. The test gate policy
  gives the commands.
- Update the documents that the change affects in the same pull request.
- Run the ast-metrics review process (the section "Code quality review
  with ast-metrics" below) on the complete candidate before Ready.
- Compute and record the review route as the section "Review route" below
  says: steps 1 to 4 when you open the draft, steps 5 to 8 before Ready.
- Mark the pull request Ready and wait for every Actions job that starts
  for its head to pass; a started job that is pending, skipped, cancelled,
  or failed is not a pass. A fix after Ready returns the pull request to
  Draft first. The details are in
  [the test gate policy](docs/implementation/test-gate-policy.md).
- The review is manual for now: you review the work of your subagents, and
  the owner reviews the pull request with the depth that its route suggests.
  No agent reviewer runs on it.
- Merge a clean pull request one time. The owner merges a pull request that
  adds a decision record under `architecture/decisions/`.

## Review route

The [PR review playbook](docs/implementation/pr-review-playbook.md) and its
[rules file](docs/implementation/pr-review-rules.yaml) define five routes:
`FIX`, `ASK`, `READ`, `SHOW`, `SHIP`. A route says how deeply a human reads
the pull request. The checks that compute a route do not exist yet. Until
they exist, you compute the route by hand with the steps below. The route
does not change who merges.

In this trial, this section governs where it differs from the rules file.
Do not apply the keys `required_checks`, `ratchet`,
`public_surface.snapshot_dir`, `size.test_counts.source`, `calibration`, or
the merge keys of `routes`. Match the facts against the rules file of the
merge base. The head lists the facts that you declare.

Do steps 1 to 4 when you open the draft, and again after each change to the
candidate. Do steps 5 to 8 after the final metrics report and before Ready.
A subagent or a worker does steps 1 to 4 on its part and reports the facts.
The manager, or the Delamain session, does steps 5 to 8 on the complete
candidate.

1. **Changed paths.** Commit every file first, so that `git status --porcelain`
   prints nothing. Set `B=$(git merge-base origin/main HEAD)`. List the
   changed paths with `git diff --name-status -M $B HEAD`. For a rename,
   match the old path and the new path. Match each path against
   `protected_paths` and `read_paths`. The glob syntax is minimatch, and a
   pattern also matches dot files. A match in `protected_paths` is a reason
   for `ASK`. A match in `read_paths` is a reason for `READ`.
2. **Facts to declare.** List the imports that the candidate adds under
   `src/`:
   `git diff -U0 --no-renames $B HEAD -- src | grep -E "^(\+\+\+ |\+[[:space:]]*import ['\"]|\+.*(from ['\"]|import\(['\"]))"`.
   Read each full statement. Apply each trigger under
   `dependency_graph.triggers` to the imports. Choose the kind of an edge
   with `dependency_graph.counting.type_only`. The rules file does not list
   these facts yet: a new package edge; a type edge that becomes a runtime
   edge; a new top-level folder under `src/`; an npm package or a Node
   builtin that the package does not list; an import, from a package other
   than composition, of a file in another package that `public_surface` does
   not list. Remove an unintended fact, for example by an import through a
   module that `public_surface` lists. Declare each other fact in the rules
   file in the same pull request: the edge with its kind under
   `allowed_edges`; the file under `public_surface.between_packages`; the
   import under `allowed_external_imports` or `allowed_node_builtins`.
   Update the count and date comments. That edit changes a protected path,
   so the route is `ASK`. An edge in `forbidden_edges` is `FIX`: remove the
   import. A new package cycle, or a known cycle that gains a package edge
   or a member, is `FIX`.
3. **Public surface.** Check each module in `public_surface` that changed,
   or that re-exports or imports types from a changed file of its package.
   Check each changed document under `docs/reference/`. Compare the exported
   declarations and the documented behavior before and after. A difference
   is a reason for `ASK`. Answer the question of `protected_paths.contracts`
   for that difference.
4. **Size and tests.** Count the changed production lines with
   `git diff --numstat -M $B HEAD -- src | awk '{s+=$1+$2} END {print s+0}'`.
   Count the total with the same command on `-- .` and these exclusions:
   `':(exclude,glob)docs/metrics/**' ':(exclude,glob)docs/api-surface/**' ':(exclude)pnpm-lock.yaml' ':(exclude).ast-metrics-baseline.yaml'`.
   A count above a limit in `size` is a reason for `READ`. A test that the
   diff removes with no replacement, or a new `skip` or `todo`, is a reason
   for `READ`. Name the tests.
5. **Metrics.** Use the final report of the process "Code quality review with
   ast-metrics" below. A recorded miss of an added or changed function or
   file, or a kept high finding on a changed file, is a reason for `READ`.
   A miss or finding with the reason `unchanged by this PR` is not. An MI
   drop of five or more on an existing file is a reason for `READ`. These
   rules replace `ratchet` in the trial.
6. **Route.** A required check is a required run of the test gate policy, or
   habit-hooks. While one fails, the route is `FIX`. Do not mark a `FIX`
   pull request Ready: make the check pass, then compute the route again.
   Otherwise take the first route in the order `ASK`, `READ`, `SHOW`, `SHIP`
   that has a reason. `SHOW` applies when no other route has a reason and a
   file under `scopes.executable` changed. `SHIP` applies when no other
   route has a reason and no file under `scopes.executable` changed. Keep
   every reason, not only the first.
7. **Record.** Add a section "Review route" to the pull request description:
   the route; each reason as `<key>: <path or fact>`; the changed paths; the
   line counts; the declared facts; the surface differences. Set the label
   with `gh pr edit <n> --repo tomer-mayara/Thermus --add-label route:<new> --remove-label route:<old>`.
   The labels `route:fix`, `route:ask`, `route:read`, `route:show` and
   `route:ship` exist in the repository. Update the section and the label
   after each change to the candidate.
8. **Decision.** For `ASK`, write the draft decision in the "Review route"
   section. Answer the question of each matching group of `protected_paths`.
   State the guarantee that holds after the change. The owner decides
   whether the decision becomes a record under `architecture/decisions/`.
   A record has the name `YYYY-MM-DD-<topic>.md` and the headings Context,
   Decision, and Consequences. The owner merges a pull request that adds one.

## Code quality review with ast-metrics

Run this process on the complete candidate of each pull request, after the
documents are updated and before Ready. Use the commands under
`script/code-quality/`. The
[ast-metrics review guide](docs/implementation/ast-metrics-review.md) gives
the commands, their reports, the configuration, and the limits of the tool.

1. Prepare. Update the branch from `origin/main`. Select the tests from the
   complete candidate, as the test gate policy says. A command of this process
   must not start a suite outside that selection. Use the same base for
   every comparison.
2. Run `pnpm exec node script/code-quality/ast-metrics-process.ts` and read
   `ast-report/process.md`. The report has four sections: delta, review,
   CRAP, and architecture. Choose the coverage option from the test
   selection:
   - A file under `src/` changed: add `--collect-coverage`, unless a
     compatible report exists. Record the test selection in the pull
     request evidence.
   - No file under `src/` changed: give no coverage option. The process
     reuses a compatible report if one exists. Without one, the
     architecture has no bands, and there is no CRAP goal to assess.
     Collect coverage only if both complete parts of the unit suite are
     selected anyway.
   - `--skip-coverage` ignores every report. It cannot make a required
     CRAP goal pass.

   The standalone coverage command collects another suite with `--suite`
   only when that complete suite is selected too. Do not edit a coverage
   report.
3. Maintainability. Each added or changed production file under `src/` must
   score 85 or more. Test and support files have no goal. Inspect a low file
   with `pnpm exec node script/code-quality/ast-metrics-mcp.ts file <path>`.
   Simplify the functions with a low score or many decision paths. Keep the
   selected tests green. Measure again with the delta command, at most three
   times. Record each remaining low score and its reason in the pull request
   description.
4. Review. Correct each finding of severity high, or record its reason in
   the pull request description. Refresh `.ast-metrics-baseline.yaml` with
   `pnpm exec node script/code-quality/ast-metrics-baseline.ts` only when
   the pull request changes the rules in `.ast-metrics.yaml`. Commit the
   baseline in the same pull request. A violation that is already on `main`
   is not a reason.
5. CRAP. Each added or changed function must score below 30. Each added
   function must also score 15 or less. Improve a miss with tests from the
   selected suites, or with fewer decision paths. If you add or change a
   test, select the tests again from the new candidate. After a code change,
   collect coverage again as in step 2. Measure again with the same base, at
   most three cycles. Then record each unresolved goal in the pull request
   description: score or bound, paths, coverage, classification, and reason.
   This includes an added function between 15 and 30, and a function with
   unknown identity or unknown coverage. An unchanged function can keep the
   reason `unchanged by this PR`. The pull request can go Ready with these
   recorded exceptions; the command still exits 1. A tool failure is not an
   exception: correct it.
6. Final report. After the last fix, run the process again on the complete
   candidate. Paste `ast-report/process.md` into the pull request
   description without change: all four sections, both `mermaid` graphs,
   their legends, the import evidence, and notices such as
   `The map did not change.` and `No production file changed.` This also
   applies to a document-only pull request and to a report without coverage.
7. History. The first process run that completes all four sections writes
   the record of the base commit to `docs/metrics/`, if that record is
   missing. A goal miss does not prevent the record; a failed section or an
   unassessed required goal does. Commit the new record. Never edit a
   record. In a merge conflict under `docs/metrics/`, keep the file from
   `main` and drop the file of the candidate. The standalone architecture
   command writes a record only with `--record`; omit it in an exploratory
   run. Nothing runs at merge time.

Each command starts and stops the MCP server of ast-metrics itself. Do not
start `ast-metrics mcp` yourself, and do not register it as a session
server.

## Work from a Delamain board

For a ticket from a Delamain board, follow the code prompt of your run.
The prompt gives the order of the steps. The session opens and merges the
pull request one time each. A worker run does neither: it runs the checks
of "Pull requests", does steps 1 to 4 of the review route, and reports the
results; it does none of the pull request steps. A restart reuses
the same pull request and merge result.
