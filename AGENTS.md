## Approach

### Top-level agent

If you are the top-level agent, you are the manager. You control the work,
inspect the result, and give final approval. You usually do not write the code.

- Give each subagent a focused brief with its ownership, relevant files, and
  expected result. Give it the applicable rules from this file.
- Delegate independent work or inspection. Keep small, sequential edits with
  the manager when delegation adds no value.
- Inspect each subagent's work before final approval.
- Do the work yourself when it is large or requires understanding the full
  system.
- Use no more than four subagents at a time.

### Subagent

Do the work that the manager assigned. Do not start another subagent unless the
manager asks you to.

### Models

Follow `CLAUDE.md` for Claude model rules. If you are not Claude, use a smaller
model for small work.

This file is the source of the house rules. `CLAUDE.md` includes this file and
holds Claude-only rules.

## Coding principles

Read the task, relevant documentation, and public contracts before you start.
Reuse this context while it remains current.

State the expected behavior, completion criteria, affected files or modules,
and dependencies before implementation. Keep unrelated cleanup and unrequested
features outside the change. Follow DRY3: reuse an existing helper, and create
a shared helper after the third repeated use.

When you write or update documents, tickets, or code comments, use ASD-STE100.

## Ticket work

Use this sequence for manual ticket work. For a board or runner ticket, follow
the supplied code prompt for step order and pull request actions. Apply the
common test, review, documentation, and merge conditions below at the matching
steps. Do not add manual pull request steps to a board prompt. On restart, reuse
the same pull request and merge result. Direct edits are not automatically
tickets.

1. The manager opens a draft pull request before implementation.
2. State expected behavior, completion criteria, and affected modules and
   dependencies. Split independent deliverables when this helps review.
3. Implement the change with TDD. Run focused checks while editing.
4. Update relevant documentation before formal review. Delegate documentation
   work when it benefits from independent work; a small edit can stay with the
   manager. Use ASD-STE100.
5. Run `habit-hooks` and `pnpm check` on the complete candidate before formal
   review. Run every new or edited test locally before commit, including tests
   outside `pnpm check`. Repeat a test after editing it. Record each command
   and result. Run full gates once on the complete candidate, not after each
   small edit in a batch. All required test and review evidence must apply to
   the final head.
6. Run all four configured reviewers with the repository wrapper:
   `tools/code-review-agents/bin/review --pr <number> --comment`.
   Install reviewer dependencies, if needed, with
   `pnpm --dir tools/code-review-agents install --frozen-lockfile`. Pin a PR
   review to its full head SHA with `--expect-head <sha>`. For local review, use
   `--local`. Collect the initial findings before making a batch of fixes.
   Inspect each finding in context. Record it as a confirmed defect, a false
   positive with evidence, or a non-blocking improvement. Fix confirmed
   defects. After two review rounds, assess remaining findings and choose the
   next action. Do not repeat the full review loop automatically. A confirmed
   defect that remains unresolved blocks merge.
7. Mark the pull request Ready when review and local gates are complete. Wait
   for each required CI check to pass on the exact pull request head. Reuse a
   successful result only when it identifies that exact head and the check
   policy allows reuse. A missing, pending, skipped, cancelled, failed, or
   mismatched result is not passing evidence. Follow the checks configured for
   this repository; do not assume a workflow or integration job exists.
8. If a fix changes the head after Ready, return the pull request to Draft
   before pushing. Run `habit-hooks`, `pnpm check`, and each new or edited test
   affected by the fix on the changed candidate. Repeat review for the new
   head, mark it Ready, and wait for required CI checks on that head.
9. Do not merge if a required check failed or a confirmed defect remains. The
   manager merges a clean pull request once.

For reviews and checks, record the full commit SHA, command or run ID, status,
and result. Prefer supported status tools. Investigate an identity mismatch;
do not treat it as a pass. A child process exit alone does not prove that each
reviewer completed successfully.

Classify infrastructure failures, such as unavailable models, network errors,
and timeouts. Check the cause, then retry only the failed reviewer role with
unchanged inputs. Diagnose repeated failures before changing a timeout or
retrying again. Empty output and timeout are not approval. Respect reviewer
concurrency limits; do not launch separate role commands to bypass them.

Reuse review or gate approval across commits only when the tool and check
policy support it. Verify that relevant code, dependencies, requirements, and
policy have not changed. Otherwise, run all four reviewers and the required
checks for the new head.
Reassess after a change to behavior, contracts, architecture, or base commit.
A finding disposition does not prove that a gate passed.

## Tests

Follow TDD (RED → GREEN):

1. Write the test.
2. Run it before implementation. Confirm that it fails for the expected
   reason. If it does not fail, investigate.
3. Implement the behavior so the test passes.
4. Refactor if needed. Run the test again.

Use these test types:

- **Unit tests:** Test focused behavior within one module, such as
  `website-fetcher` or `html-cleaner-pipeline`. Real collaboration within the
  module is allowed. Replace other modules with test doubles at their public
  interfaces for direct and indirect calls. Type-only imports of public
  contracts are allowed. Keep each test independent.
- **Integration tests:** Test real collaboration between two or more modules
  through their public interfaces. This remains an integration test when it
  runs in one process.
- **Interface tests:** Test one public interface or data contract. Check valid
  inputs, outputs, formats, events, and errors. Keep these tests focused.
- **Acceptance tests:** Specify user-required behavior. Exercise public
  interfaces in an environment similar to production and check observable
  results against the criteria.

Magumagu uses `node:test`. Use the Node version in `.nvmrc` and the pnpm version
pinned in `package.json`. The root `package.json` defines the commands.
`pnpm typecheck` checks types. `pnpm test:unit` and `pnpm test:interface` run
their named suites. `pnpm check` runs typecheck and unit tests; it excludes
interface tests. The root has no lint or architecture check scripts.
`pnpm test` runs all current root test files, including interface tests.
Interface tests require Lightpanda, and some use public sites. To run a focused
test, build first and then run its compiled file. For example:

```bash
pnpm build
node --test dist/test/unit/website-fetcher.test.js
```

Run the test suites required by the task and configured checks before merge.

## Habit hooks

Run the full pass on the complete candidate before formal review:

```bash
habit-hooks
```

The configured pass examines JavaScript and TypeScript files. It can report
pre-existing findings in changed files. Fix findings that relate to code you
change. Record a reason when a finding is outside the task scope. See
`.habit-hooks/config.toml` and `.habit-hooks/hook.config.toml` for the current
settings. Exit code `0` means clean, `1` reports an enforced smell, and `2`
means tool failure.

`.habit-hooks/snooze.json` stays empty. Do not add an entry to silence a
finding. An entry silences every smell for that file.
