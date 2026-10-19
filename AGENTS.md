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
- Mark the pull request Ready and wait for every Actions job that starts
  for its head to pass; a started job that is pending, skipped, cancelled,
  or failed is not a pass. A fix after Ready returns the pull request to
  Draft first. The details are in
  [the test gate policy](docs/implementation/test-gate-policy.md).
- The review is manual for now: you review the work of your subagents, and
  the owner reviews the pull request. No agent reviewer runs on it.
- Merge a clean pull request one time. The owner merges a pull request that
  adds a decision record under `architecture/decisions/`.

## Code quality review with ast-metrics

Run this process on the complete candidate of each pull request, after the
documents are updated and before Ready. Use the commands under `script/code-quality/`;
they carry the correct syntax of ast-metrics. The details and the limits are
in [the ast-metrics review guide](docs/implementation/ast-metrics-review.md).

1. Update the branch from `origin/main` first. Use the same base for every
   comparison. Select tests from the complete candidate before running
   these commands. No quality command or live test may add a broader suite
   through nested coverage collection.
2. Run `pnpm exec node script/code-quality/ast-metrics-process.ts` and read
   `ast-report/process.md`. It runs delta, review, coverage resolution, CRAP,
   and architecture in order. It prints and saves four report sections.
   It reuses verified compatible unit coverage by default. Missing or stale
   coverage never starts a suite. Use `--collect-coverage` only when `src/`
   changed or both complete unit parts were already selected: emitted Node
   tests and source portal tests. The collector builds first. Record that
   test selection in the pull request evidence. Otherwise keep the unavailable
   assessment and architecture without bands. `--skip-coverage` ignores all
   reports; it cannot make an unassessed required goal pass. An empty default
   production-file selection succeeds without coverage or MCP for CRAP.
   A document-only commit can reuse an older capture when its inputs match.
3. Maintainability goal: 85 or more for each changed production file under
   `src/`. Test and support files have no goal. Inspect low files with
   `pnpm exec node script/code-quality/ast-metrics-mcp.ts file <path>`.
   Simplify functions with low scores or many decision paths. Keep selected
   tests green. Remeasure with delta for at most three passes. Record each
   remaining low score and its reason in the pull request description.
4. Correct each review finding of severity high or record its reason. For
   a retained high finding, run
   `pnpm exec node script/code-quality/ast-metrics-baseline.ts` and commit
   `.ast-metrics-baseline.yaml` in the same pull request. The wrapper runs
   from the repository root and reports ignored entry counts before and
   after. Include the review Markdown in the description.
5. CRAP goals: added or changed functions below 30; added functions also at
   15 or less. The table includes unchanged and identity-unknown functions
   and states their scope. Improve missed required goals with selected unit
   tests or fewer paths. Remeasure with compatible coverage and the same
   base for at most three cycles. Record score or bound, paths, coverage,
   classification, and reason for every unresolved required goal, including
   new functions above 15 but below 30 and unknown assessments. An unchanged
   high function can retain the reason `unchanged by this PR`. Ready may
   proceed with these documented exceptions after at most three cycles;
   the command still exits 1 for required goal misses or unknowns. Tool
   failures remain errors. Re-select tests from the actual candidate when
   test changes affect collection scope.
6. Run the process on the complete candidate after fixes. Reuse still-valid
   coverage; a final report does not require another collection. Include its
   full Markdown in the pull request description: review, architecture delta,
   complexity, trend, and CRAP or the unavailable-assessment reason. Paste
   the fenced `mermaid` graph and its legend unchanged, including on
   document-only changes and reports without coverage. Include
   `The map did not change.` and `No production file changed.` when present.
   Historical counts from head coverage are estimates. Preserve their
   coverage origin, fingerprints, measurement version, and unknown count.
   Completed goal misses keep all report evidence. Failed prerequisites
   leave dependent sections unavailable, exit 1, and write no historical
   record. Unassessed required CRAP goals also prevent recording.
7. Change `.ast-metrics-baseline.yaml` only for a retained high finding in
   step 4 or changes to `.ast-metrics.yaml` rules. Run the baseline wrapper
   and commit it. A violation already on `main` is not a third exception.
8. The complete process requests architecture recording only after its
   required analyses complete. Completed goal misses can still record;
   operational failures or unavailable required assessments cannot. Only
   architecture with `--record` writes a missing base record. It checks the
   full base commit and its ancestry on `origin/main`. Commit the new record
   under `docs/metrics/`. Existing records are immutable, including records
   without coverage counts. In a metrics conflict, keep the file from `main`
   and drop the candidate's conflicting file. Exploratory architecture runs
   omit `--record`. Missing historical values remain absent. Nothing runs
   at merge time.

Commands that use MCP start and stop the server within a bounded operation,
on success or failure. The MCP entry point makes one tool call; snapshot
and CRAP can make several requests in one session. Do not start `ast-metrics mcp` yourself or register
it as a session server.

## Work from a Delamain board

For a ticket from a Delamain board, follow the code prompt of your run.
The prompt gives the order of the steps. The session opens and merges the
pull request one time each. A worker run does neither: it runs the checks
of "Pull requests" and none of its pull request steps. A restart reuses
the same pull request and merge result.
