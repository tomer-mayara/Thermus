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

Read the ticket spec and `docs/implementation/delamain-plan.md` for each ticket.

### Work from a Delamain board

For a ticket from a Delamain board, follow its code prompt. An agent session
gets the prompt from Delamain's MCP server with the ticket UUID. A worker
follows the prompt that its run supplies. Plan F.8 defines both loops. This
file gives the rules that each prompt references. The coding, test, review,
documentation, and merge conditions below apply to every ticket, including
board tickets. Follow the prompt for the step order and for PR actions. Do not
add PR steps from the manual loop below. The session prompt owns opening and
merging the PR, one time each. A restart reuses the same PR and merge result;
it does not repeat either action. A worker follows the PR actions in the prompt
that its run supplies.

### Language

When you write or update documents, tickets, or code comments, follow ASD-STE100.

### Manual ticket loop

Use this sequence for ticket work that does not start from a Delamain board
`code` prompt. For board tickets, follow the prompt's sequence and apply the
rules and conditions below at the matching steps. The prompt determines when
to open and merge a pull request. Check the repository's effective
`.delamain/config.json` for product behavior. The current repository gate
policy is in [the test gate policy](docs/implementation/test-gate-policy.md).
It applies now and does not depend on the generic `githubActionsGate` setting.

For each ticket, do the steps that follow:

1. Open a draft pull request.
2. Do the work for the ticket. Follow DRY3. Use an existing helper. Make a
   new shared function only after the third copy.
3. Run every test introduced by this pull request locally before you commit
   it. This applies to unit, integration, interface, and acceptance tests,
   including new cases in an existing test file. Use a focused command for a
   new test that `npm run check` does not select. Repeat the run if you edit a
   new test after it passes. Record each command and result in your work
   summary.
4. Run `habit-hooks` (See "Habit hooks" sub-section below). Repair each
   finding. Fix at least one pre-existing smell in the code you change.
5. Run `npm run check`. It runs lint, architecture checks, typecheck, and unit
   tests. It does not run existing integration, interface, provider, browser,
   or other acceptance suites.
6. Run the 4 reviewers. Replace `382` with the number of this pull request:
   `npx tsx tools/code-review-agents/src/application/review.ts --pr 382 --comment`
   Run the architecture diff for the same pull request:
   `npx tsx script/architecture-diff.ts --pr 382 --comment`
   Repair each reviewer defect.
7. Make sure the relevant docs under `docs/*` are up to date with recent
   changes. Create a subagent for doc changes and require ASD-STE100.
8. Mark the pull request Ready. Wait for every configured unit and integration
   job to pass on the pull request head. The unit workflow runs on branch
   pushes, so reuse successful results for that exact head. Ready does not
   start a duplicate unit run. Automated integration runs require an eligible
   Ready pull request. Manual workflow dispatch remains available. A missing,
   pending, skipped, cancelled, failed, or mismatched result is not passing
   evidence.
9. If a fix changes the head after Ready, return the pull request to Draft
   before the push. Run `npm run check`, run each new test affected by the fix,
   and repeat the review and architecture diff for the new head. Mark it Ready
   and wait for the required Actions jobs on that head.
10. Do not merge if a required test failed or a reviewer defect remains. The
    owner merges a pull request that adds an architectural decision record
    under `architecture/decisions/`. Merge a clean pull request once.

The unit workflow runs on branch pushes and manual dispatch. It runs Core,
Daemon, and script unit tests once each, and splits App unit tests across four
shards. The unit jobs use two workers each. The integration workflow runs
automatically for opened, reopened, synchronized, or Ready pull requests to
`main`, when the pull request is not a draft. Manual workflow dispatch remains
available. It splits Daemon integration tests across two shards, with one
worker per shard. The App integration tests run in one shard with two workers.
The supplemental interface workflow runs on branch pushes and manual dispatch.
It has no `pull_request` trigger. Its Core job uses `Production`; its App job
uses no provider credentials. This workflow does not add required unit or
integration package and shard jobs. The supplemental acceptance workflow runs
the root, browser, packaged Electron, and live provider acceptance suites on
branch pushes and manual dispatch. It has no `pull_request` trigger and adds no
required jobs. Existing fake-harness cases remain offline. Separate live cases
use provider CLIs and test-only model settings. `ACCEPTANCE_TEST_WITH_API_KEY`
controls optional acceptance API keys and is separate from
`INTERFACE_TEST_WITH_API_KEY`. See the test gate policy for details. The
workflows can run at the same time for the same head.
The workflow and package details are in [the test gate
policy](docs/implementation/test-gate-policy.md).

Keep the worker boundary: the session opens and merges the PR. A worker does
not open or merge a PR. For board tickets, the session opens the draft PR
before the first worker step. The configurable `githubActionsGate` is a
separate Delamain product feature. It remains off unless a repository's saved
config opts in after the required proof. See the [test gate policy](docs/implementation/test-gate-policy.md)
for the distinction between this repository's Actions checks and that product
feature.

### src/ and script/

No file under `src/` imports a path that resolves under `script/`.
`npm run check:architecture` runs this check (`script/verify-boundary.ts`).

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
