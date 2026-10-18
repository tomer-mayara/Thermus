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
- Before Ready, run `npm run check` and `habit-hooks` on the complete
  candidate. Correct each enforced smell, or give the reason that you keep
  it. The snooze file of habit-hooks stays empty.
- Run each new or changed test locally before the commit, also a test that
  `npm run check` does not run. The test gate policy gives the commands.
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
documents are updated and before Ready. Use the commands under `script/`;
they carry the correct syntax of ast-metrics. The details and the limits are
in [the ast-metrics review guide](docs/implementation/ast-metrics-review.md).

1. Update the branch from `origin/main` first. The commands compare with it.
2. Measure the delta: `pnpm exec node script/ast-metrics-delta.mjs`. It
   lists each TypeScript file that the pull request adds or changes with
   its maintainability score, lowest first. The goal is 85 or more for each
   file. The command exits 1 when a file is below 85.
3. For each file below 85, find what to change before you edit:
   `pnpm exec node script/ast-metrics-mcp.mjs file <path>` gives the score,
   the decision paths, and the lines of each function in the file. Start
   with the functions that have the lowest score or the most decision
   paths: split them, remove duplicated logic, and simplify the control
   flow. The server knows the production files only; for a test file, read
   the file and split its longest cases or move shared setup into the test
   support. Keep the tests green after each change.
4. Measure again (step 2). Do no more than 3 passes of steps 2 and 3. If a
   file is still below 85 after 3 passes, write its score and the reason in
   the pull request description and continue.
5. Review the delta: `pnpm exec node script/ast-metrics-review.mjs`. It
   reports only what the pull request made worse or added: a file whose
   score dropped, a new function with more than 10 decision paths (with
   file and line), and a new rule violation. Correct each finding of
   severity high, or give the reason in the pull request description. Put
   the Markdown output in the pull request description.
6. Do not change `.ast-metrics-baseline.yaml` in a pull request, except
   when the pull request changes the rules in `.ast-metrics.yaml`. Then run
   `ast-metrics baseline` and commit the new file.

The MCP server of ast-metrics runs only for the time of one call: the
command starts it, makes the call, prints the answer, and stops it. Do not
start `ast-metrics mcp` yourself, and do not register it as a server of
the session.

## Work from a Delamain board

For a ticket from a Delamain board, follow the code prompt of your run.
The prompt gives the order of the steps. The session opens and merges the
pull request one time each. A worker run does neither: it runs the checks
of "Pull requests" and none of its pull request steps. A restart reuses
the same pull request and merge result.
