## Approach

### Top-level agent

If you are the top-level agent, you are the manager.
You control the work. You inspect the work. You give the final approval.
You usually do not write the code.

- Give small work to a subagent.
- Inspect the work of each subagent and approve it.
- Do the work yourself when the task is large.
- Do the work yourself when you must understand the full system.
- Use a maximum of 4 subagents at one time.

### Subagent

If you are a subagent, do the work that the manager gave you.
Do not start a further subagent unless the manager asked you to.

### Models

Follow `CLAUDE.md` for Claude model rules.
If you are not Claude, use a smaller model for small work.

This file is the source of the house rules. `CLAUDE.md` includes this file and holds Claude-only rules.

## Coding principles

Use these rules.
Give these rules to each subagent.
During inspection, make sure that the work obeys these rules.


### Language

When you write or update documents, tickets, or code comments, follow ASD-STE100.

### Manual ticket loop

Use this sequence for ticket work that does not start from a Delamain board
`code` prompt. For board tickets, follow the prompt's sequence and apply the
rules and conditions below at the matching steps. The prompt determines when
to open and merge a pull request. Check the repository's effective
`.delamain/config.json` for product behavior. 

For each ticket, do the steps that follow:

1. Open a draft pull request.
2. Do the work for the ticket. Follow DRY3. Use an existing helper. Make a
   new shared function only after the third copy.
3. Run every test introduced by this pull request locally before you commit
   it. This applies to unit, integration, interface, and acceptance tests,
   including new cases in an existing test file. Use a focused command for a
   new test. Repeat the run if you edit a
   new test after it passes. Record each command and result in your work
   summary.
4. Run `habit-hooks` (See "Habit hooks" sub-section below). Repair each
   finding. Fix at least one pre-existing smell in the code you change.
5. Run the 4 reviewers. Replace `382` with the number of this pull request:
   `npx tsx tools/code-review-agents/src/application/review.ts --pr 382 --comment`
   Run the architecture diff for the same pull request:
   `npx tsx script/architecture-diff.ts --pr 382 --comment`
   Repair each reviewer defect.
6. Make sure the relevant docs under `docs/*` are up to date with recent
   changes. Create a subagent for doc changes and require ASD-STE100.
7. Mark the pull request Ready. Wait for every configured unit and integration
   job to pass on the pull request head. The unit workflow runs on branch
   pushes, so reuse successful results for that exact head. Ready does not
   start a duplicate unit run. Automated integration runs require an eligible
   Ready pull request. Manual workflow dispatch remains available. A missing,
   pending, skipped, cancelled, failed, or mismatched result is not passing
   evidence.
8. If a fix changes the head after Ready
9.  Do not merge if a required test failed or a reviewer defect remains. Merge a clean pull request once.


### Tests

Follow TDD (RED → GREEN).

1. Write the test.
2. Run it before implementing. Confirm that it fails for the expected reason.
   If it does not fail, investigate.
3. Implement the production code so the test passes.
4. Refactor if needed. Run the test again to check the refactor.

Use these test types:

- **Unit tests:** Fast, automated tests of focused behavior in one Delamain
  package. Replace other Delamain packages with test doubles at their public
  interfaces for direct and indirect calls. Real collaboration within the
  package is allowed. Type-only imports of public contracts are allowed because
  they run no production behavior. Keep each test independent of other tests.
- **Integration tests:** Verify real collaboration between two or more
  Delamain packages through public interfaces. These remain integration tests
  even when they run fast or in one process. They cover collaboration across
  package boundaries that some methods call sociable unit testing.
- **Interface tests:** Focus on one public interface or data contract. Check
  accepted inputs, outputs, data formats, events, and error behavior. Keep
  these tests few and limited to the contract. A test that connects real
  Delamain packages to check collaboration is an integration test.
- **Acceptance tests:** Give executable specifications of user-required
  behavior. Exercise public interfaces in an environment similar to production.
  Check observable outcomes against the acceptance criteria. These tests can
  span packages; their purpose is to show that the system meets a user
  requirement.

For example, a daemon unit test can use a test double for a Core public
interface. A test that calls real Daemon and Core code to check their combined
behavior is an integration test.

Make sure the required current gate passes before merge. Also make sure every
test introduced by the pull request passes locally before you commit it.

### Habit hooks

Run the full pass before you open a pull request:

```bash
habit-hooks
```

This examines each file that your branch changed. Exit code `0` is clean, `1` is
an enforced smell, and `2` is a tool failure. Correct each enforced smell, or
give the reason that you keep it.

`.habit-hooks/snooze.json` is EMPTY, and it stays empty. habit-hooks reports
every smell in a file that your branch changed, including the ones that were
there before you.

Correct the smells that are in the code you touch. You are in that code, so you
know what the invariants are — this is the moment to name one. Do not go and
split a function in a file that your work does not touch. Give the reason when
you keep a smell.

Do not put an entry in the snooze file to make a run clean. One entry silences
that file for EVERY smell that the file is the key for.

`docs/habit-hooks.md` gives the installation steps and the design.
