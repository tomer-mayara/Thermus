# Change request: adopt five pieces of PR #201 into the PR review process

| Field | Value |
| --- | --- |
| Repository | `tomer-mayara/Thermus` |
| Baseline | [PR #203](https://github.com/tomer-mayara/Thermus/pull/203) at `32eff267`, branch `claude/pr-review-playbook-a7c2e5`, on `main` `06340405`. `main` is now `6ac961ae` (PR #202). |
| Source | [PR #201](https://github.com/tomer-mayara/Thermus/pull/201), Draft, branch `codex/code-quality-characterization`, head `98b2981f`, 24 commits. It conflicts with `main`. |
| Owner | Tomer Mayara: approves this plan, reviews and merges each pull request of the stack |
| Status | Proposal of 2026-10-21. No code is written. |
| Audience | An engineer who has not read PR #201 or PR #203 |

## 1. Goal and rule

PR #203 gives the repository a deterministic review route: the command
`script/pr-review/check.ts` reads the rules file, compares a candidate with
its merge base, and prints `FIX`, `ASK`, `READ`, `SHOW` or `SHIP` with every
reason. PR #201 implements the numeric side of the earlier long plan. Most of
it is a hash-bound ledger that PR #203 does not need. Five pieces are worth
taking. This change request adopts them, one pull request each, stacked on
PR #203.

The rule for each piece: it must double the value of the process for less
than a doubling of its complexity. Each pull request takes the smallest
useful form of its piece. Later iterations can extend it. Each pull request
follows the "Pull requests" and "Review route" sections of
[AGENTS.md](../../AGENTS.md) and carries its own route, label and metrics
report.

The pieces, with the item numbers of the review of 2026-10-21:

| Item | Piece | Value | Complexity |
| --- | --- | --- | --- |
| 1 | The fetch-url cancellation fixture fix | Removes a known flaky test that would give false `FIX` routes | About 25 lines in test support and one test |
| 5 | Serial file execution for `test` and `test:acceptance` | Fewer races on a shared Mac; the unit script already runs this way | Three lines; the suites take longer |
| 2 | Unrounded file MI in snapshots, and check 4 on two snapshots | The MI part of check 4 without a scores file, a workflow commit, or a merge conflict | About 15 lines in the snapshot plus the check |
| 3 | CRAP goal proof from bounds when coverage is missing | A small function proves its goal without a coverage run; fewer false `FIX` | 93 lines of pure calculation that exist and are tested |
| 4 | Typed outcomes of the metrics process | The check can read the metrics step instead of a human | Ten lines, plus the reading in the check |

## 2. The stack

Each pull request is based on the one before it. The owner merges from the
bottom. After a merge, the next pull request is retargeted to `main` before
the merged branch is deleted.

| PR | Ticket | Branch | Base | Content | Route the check should print |
| --- | --- | --- | --- | --- | --- |
| 0 | T0 | `claude/pr-review-adopt-plan` | PR #203 | This document. After approval: update the base from `main` and declare the facts that PR #202 added. | `ASK`: the rules file changes |
| 1 | T1 | `claude/pr-review-adopt-fixture` | PR 0 | Item 1: the cancellation fixture fix | `SHOW`: test support only |
| 2 | T2 | `claude/pr-review-adopt-serial` | PR 1 | Item 5: serial file execution, with a timing record | `ASK`: `package.json` is a protected path |
| 3 | T3 | `claude/pr-review-adopt-raw-mi` | PR 2 | Item 2: raw file MI, the MI rules of check 4, the exceptions file | `ASK`: scripts and rules change |
| 4 | T4 | `claude/pr-review-adopt-crap-bounds` | PR 3 | Item 3: CRAP goals with bounds, the CRAP rules of check 4 | `ASK`: scripts and rules change |
| 5 | T5 | `claude/pr-review-adopt-outcomes` | PR 4 | Item 4: typed outcomes, the metrics step in the check | `ASK`: scripts and rules change |

Commands for a stacked pull request, with `<parent>` the branch below it:

```sh
habit-hooks --branch <parent>
pnpm exec node script/pr-review/check.ts --base <parent> --repo tomer-mayara/Thermus
pnpm exec node script/code-quality/ast-metrics-process.ts --base origin/main
```

The metrics process keeps `origin/main` as its base, so that its history
record names a commit of `main` and its delta lists every changed file of
the stack below. The check and habit-hooks use the parent branch, so that
each pull request shows its own change.

Code that comes from PR #201 is taken as hunks of the named commits with
`git cherry-pick`, so that the author of each commit stays in the history.
Conflicts are resolved by hand; the plan names the files to keep.

## 3. Design decisions

| ID | Decision | Reason |
| --- | --- | --- |
| D1 | Check 4 reads two snapshot files that the author makes with the existing snapshot command: `ast-metrics-snapshot --base origin/main` and `ast-metrics-snapshot`. The check takes them as `--base-snapshot FILE --head-snapshot FILE`. It starts no tool itself. | A base snapshot takes three seconds in a temporary worktree. The scores file of the playbook, the `main` workflow that writes it, and its conflicts are not needed. The check stays a pure reader that tests can feed with fixture files. |
| D2 | Adopt raw file MI only. Do not adopt the native class observations. | PR #203 dropped every class-level rule. |
| D3 | A changed function whose CRAP range crosses its goal stays `FIX`. | Fail closed. The metrics process collects coverage for every `src/` change, so a crossing range is rare: it means an unmatched identity or a measurement gap that the author must repair. |
| D4 | Check 4 applies the absolute CRAP goals only: a new function at most 15, a changed legacy function below 30. The rule "worse than at the base" waits for a measured base. | The base CRAP of the metrics process is an estimate from head coverage. The playbook keeps the clause as a later iteration. |
| D5 | The metrics step of the route reads `ast-report/review.json`: a high finding whose file is a changed path is a `READ` reason. A failed or unavailable stage of the process is a `FIX` reason. A goal miss alone is no reason. | Today every candidate has the same nine high findings on unchanged files. Only a finding on a changed file is a reason, as AGENTS.md says. |
| D6 | The exceptions file `.code-quality-exceptions.yaml` is one list of entries with `path` or `function`, `metric`, `bound`, `reason` and `expires`. A change to the file is `READ`. An expired entry is `FIX` for a candidate that changes its unit. | A new file below MI 85 needs an escape hatch, or it can never merge. The entry is the smallest form of one. |
| D7 | Serial execution is adopted with a timing record in its pull request. The owner decides from the record whether the acceptance group may run in parallel in CI later. | The slowdown is not known. The unit script already runs serially without complaint. |
| D8 | The CRAP command gets `--json FILE`, which writes the rows of its table: file, function, change, paths, share and identity. The check reads that file. | The check must not parse display text. The CRAP command already joins the snapshot with the coverage report and knows which functions are new or changed. |

## 4. What each pull request changes outside its code

| PR | Playbook | Rules file | AGENTS.md | Other documents |
| --- | --- | --- | --- | --- |
| 0 | Nothing | Declare the edges and files that PR #202 added; update the count and date comments | Nothing | `docs/README.md` lists this document |
| 1 | Nothing | Nothing | Nothing | `docs/testing/test-list.md`: the fetch-url cases |
| 2 | Nothing | Nothing | Nothing | `docs/implementation/test-gate-policy.md`: the concurrency text; the timing record in the pull request |
| 3 | Check 4 row: the snapshots replace the scores file; the "Today" column; adoption step 4 | `ratchet`: `scores_file` becomes `base_snapshot` and `head_snapshot`; `maintainability_index` keys stay; `exceptions.file` loses "to create" | Step "Run the check": the two snapshot commands and the two options; step "Metrics": the MI rules move to the check | `script/pr-review/README.md`; the metrics guide: raw MI field; `docs/testing/test-list.md` |
| 4 | Check 4 row: the CRAP goals with bounds; D4 clause marked as later | `ratchet.crap`: `changed_function_above_goal_and_worse_than_base` marked as later; `identity.unknown_coverage_on_changed_function` stays `FIX` | Step "Run the check": the CRAP JSON option | `script/code-quality/README.md`: the `--json` option; `script/pr-review/README.md`; the metrics guide: the bound proof |
| 5 | Check 7 row and the human steps: the metrics step is read by the check | `ratchet` gains `review_findings: ast-report/review.json` | Step "Metrics" becomes "run the check with `--review`"; the human reads the result | `script/pr-review/README.md`; the metrics guide: `outcomes` |

## 5. Risks and limits

- PR #201 conflicts with `main`. Its commits may not apply cleanly on the
  stack. The tickets name the files to keep; the rest is left out.
- Serial execution can make the acceptance group slow enough to hurt the
  trial. The timing record decides; nothing else changes with the flag.
- The snapshot of the working tree includes uncommitted files. The check
  refuses a dirty tree, so the head snapshot describes HEAD when the check
  runs. The rule stays: commit first.
- The CRAP rows depend on function identity from the existing commands. An
  unknown identity gives an unknown function, which is a new function with
  the goal of 15. This is the current behavior of the metrics process.
- The review findings come from the native tool through the review wrapper.
  Its rules and baseline do not change in this plan.

## Appendix A. Tickets

Each ticket is one pull request of the stack. Copy a ticket to the board
when its turn comes. The acceptance criteria are the executable
specification: write them as failing tests first.

### T0. Plan, base update and the facts of PR #202

Source: this change request. Base: PR #203 at `32eff267`.

**Problem.** The stack needs a current base. `main` moved to `6ac961ae`
with PR #202, which adds package edges and cross-package files that the
rules file does not list: `mcp` to `search-pipeline` at runtime,
`search-pipeline` to `search-engine` as a type, the files
`src/search-pipeline/search-failure.ts`, `src/search-pipeline/search-pipeline.ts`
and `src/search-pipeline/search-query.ts` imported by `mcp`, and the npm
packages or builtins that the new files use. The first check after the
merge of PR #203 would report them as facts to declare.

**Scope.** Add this document and its index entry. Merge `origin/main` into
the branch. Run the check and declare every fact it lists in the rules file,
with the kind of each edge. Update the count and date comments.

**Out of scope.** Any code change. Any rule change beyond the declarations.

**Acceptance criteria.**
- Given the merged branch, when the check runs against PR #203's branch, then it prints `ASK` with the rules file as the reason and lists no fact to declare.
- Given the merged branch, when the check runs against `origin/main`, then the facts of PR #202 appear under "Declared facts".

**Test list.** No executable test: documents and the rules file only. The
check output goes into the pull request.

### T1. Adopt the cancellation fixture fix

Source: PR #201 commits `66aec910` and `bc4cb9af`. Item 1.

**Problem.** `test/acceptance/script/fetch-url.test.ts` counts an abort that
the debug site records in a promise executor. The count can be read before
the abort event runs. The case then reports zero aborts and fails. The
earlier record of PR #201 saw this failure on this Mac.

**Scope.** Take the hunks of `test/support/in-process/fetch-url-debug-site.ts`
(the `abortObserved` promise, the pending signal set, the listener cleanup)
and of `fetch-url.test.ts` (wait for `site.abortObserved` before the count,
and assert that the request reached the site). Take the one-line change of
`test/acceptance/script/fetch-url-oauth.test.ts`.

**Out of scope.** The forced garbage-collection meta-test, the
`force-garbage-collection.ts` preload and its module path. The deadlines
and assertions of the cases stay as they are.

**Acceptance criteria.**
- Given a hung `server/discover`, `initialize` or `tools/call` request, when the deadline passes, then the site observes exactly one abort and the test reads the count after that event.
- Given the three hung-request cases, when they run twenty times in a row with `--test-concurrency=1`, then every run passes.

**Test list.** The existing three hung-request cases. The loop of twenty
runs is a one-time proof in the pull request, not a new test.

### T2. Adopt serial file execution for the ordinary and acceptance suites

Source: PR #201 commit `bc4cb9af`, the `package.json` and
`hosted-live-setup.test.ts` hunks. Item 5.

**Problem.** `test` and `test:acceptance` run test files in parallel. The
unit script runs them one at a time because child processes that check
deadlines compete for the CPU. Other sessions share this Mac.

**Scope.** Add `--test-concurrency=1` to `test` and `test:acceptance`.
Update the quoted-glob parser of `hosted-live-setup.test.ts` and the
concurrency sentence of the test gate policy. Record the wall time of
`test:acceptance` before and after in the pull request.

**Out of scope.** Any change to the selection of tests, to deadlines, or
to CI.

**Acceptance criteria.**
- Given the package scripts, when `hosted-live-setup.test.ts` reads the suite globs, then it finds the glob of each script with the flag.
- Given `test:acceptance`, when it runs, then it runs one file at a time and the same files as before.

**Test list.** `test/acceptance/auth/hosted-live-setup.test.ts`. The
timing record uses two full runs of `test:acceptance`.

### T3. Adopt raw file MI and the MI rules of check 4

Source: PR #201 commit `1ab6d970`, the raw MI hunks only. Item 2.

**Problem.** The rules file promises raw comparisons, but the snapshot
rounds MI to one decimal. The playbook plans a scores file written by a
`main` workflow that does not exist, and each PR would conflict on it.

**Scope.**
- Snapshot: add `maintainabilityRaw` to each file row of the snapshot
  (`snapshot/input.ts`, `build.ts`, `types.ts`) and its tests. A malformed
  native MI stops the capture. Rounded `maintainability` stays.
- Check: add `--base-snapshot FILE --head-snapshot FILE`. With both, apply
  per production file: a new file with raw MI below 85 is `FIX`
  `ratchet.maintainability_index.new_file_below`; an existing file whose raw
  MI drops by five or more against the base snapshot is `READ`
  `ratchet.maintainability_index.existing_file_drop_read_at`. A file without
  MI in a snapshot is not applicable. A snapshot whose `commit` does not
  match the merge base or the candidate is an operation error.
- Exceptions: read `.code-quality-exceptions.yaml` when it exists. An entry
  with `path`, `metric: mi`, `bound`, `reason` and `expires` covers a `FIX`
  of that file while its raw MI is at least the bound and the date has not
  passed; the covered fact stays visible as a `READ` reason. A change to
  the file is `READ`. An expired entry for a changed file is `FIX`.
- Documents: the playbook, the rules file, AGENTS.md and the READMEs as
  section 4 says.

**Out of scope.** Class MI. Cumulative decline. The CRAP rules. Any tool
started by the check.

**Acceptance criteria.**
- Given a base snapshot and a head snapshot with raw MI, when the check runs with both files, then a new production file at raw MI 84.96 is `FIX` and one at 85 is not.
- Given an existing file at 90.0 in the base and 85.0 in the head, when the check runs, then the route has a `READ` reason with both values; at 85.1 it has none.
- Given a head snapshot whose commit is not the candidate, when the check runs, then it exits 1 and names the snapshot.
- Given an exception entry that covers the new file with a bound of 80 and a future date, when the check runs, then the `FIX` becomes a `READ` reason that names the entry; with a past date it stays `FIX`.
- Given the snapshot command on a file with a native MI of 84.96, when the snapshot is written, then the row has `maintainabilityRaw: 84.96` and `maintainability: 85`.

**Test list.** `test/unit/script/pr-review-ratchet.test.ts` and
`test/acceptance/script/pr-review-check-ratchet.test.ts` with fixture
snapshots; the snapshot tests of PR #201's commit, trimmed to raw MI.

### T4. Adopt CRAP goals with bounds and the CRAP rules of check 4

Source: PR #201 commit `7ebbc236` (`assessment/crap-absolute.ts` and the
`compareCrapDifference` addition in `architecture/crap-score.ts`). Item 3.

**Problem.** The check makes a changed function with unknown coverage `FIX`.
A function with three paths cannot exceed CRAP 12, so it meets 15 without
coverage. The metrics process cannot say so today.

**Scope.**
- Cherry-pick `crap-absolute.ts` with its unit and acceptance tests, and
  the `compareCrapDifference` hunk. Keep both under `script/code-quality/`.
- CRAP command: add `--json FILE`, which writes the rows of its table.
- Check: add `--crap FILE`. For each row: a new or unknown function whose
  `atMost15` is `MISS` or `UNKNOWN` is `FIX`
  `ratchet.crap.new_function_above`; a changed legacy function whose
  `below30` is `MISS` or `UNKNOWN` is `FIX`
  `ratchet.crap.changed_legacy_function_at_or_above`; a `PASS` from a bound
  is reported with its bound. An exception entry with `function` and
  `metric: crap` covers a `FIX` as in T3.
- Documents as section 4 says. The clause "worse than at the base" is
  marked as a later iteration in the playbook and the rules file.

**Out of scope.** The deterioration, ceiling, floor, assessment, numeric
evidence and manual history modules of PR #201. The base comparison.

**Acceptance criteria.**
- Given a new function with three paths and no coverage share, when the check runs with the CRAP file, then it reports a pass from the bound 12 and no `FIX`.
- Given a new function with four paths and no coverage, when the check runs, then the range crosses 15 and the route is `FIX`.
- Given a changed legacy function with 29.999 from known coverage, when the check runs, then it passes; at 30 it is `FIX`.
- Given the CRAP command with `--json`, when it runs on a fixture repository, then the file holds the same rows as its table, with paths, share and change.

**Test list.** `test/unit/script/pr-review-crap.test.ts`; the acceptance
file of T3 gains the CRAP scenarios; the cherry-picked tests of
`crap-absolute.ts`; the CRAP command acceptance test gains the `--json` case.

### T5. Adopt typed process outcomes and read the metrics step in the check

Source: PR #201 commit for `process/run.ts` and `process/types.ts`
(`ProcessResult.outcomes`). Item 4.

**Problem.** The metrics step of the route is a human reading
`ast-report/process.md`. The process result has no typed form, and the
check cannot tell a failed stage from a goal miss.

**Scope.**
- Cherry-pick the `outcomes` field and its unit test.
- Process command: add `--json FILE`, which writes the outcomes: stage,
  status, text.
- Check: add `--process FILE` and `--review FILE`. A stage with status
  `failed` or `unavailable` is `FIX` `required_checks: <stage>`. A high
  finding in `ast-report/review.json` whose `file` is a changed path is
  `READ` `ratchet.review_findings: <file>: <message>`. A finding on an
  unchanged file is not a reason. A goal miss without such a finding is
  not a reason.
- Documents as section 4 says: the step "Metrics" of AGENTS.md becomes a
  run of the check with the two files; the human reads the reasons.

**Out of scope.** Any change to the review rules, the baseline, or the
native tool. The medium and low findings.

**Acceptance criteria.**
- Given a process JSON with the Review stage at `goal miss` and a review JSON with high findings on unchanged files only, when the check runs, then the metrics step adds no reason.
- Given a high finding on a changed file, when the check runs, then the route has a `READ` reason with the file and the message.
- Given a process JSON with the Delta stage `failed`, when the check runs, then the route is `FIX` with the stage name.
- Given `runProcess`, when a stage fails, then `outcomes` holds the four stages in order with the final status of each.

**Test list.** `test/unit/script/pr-review-metrics.test.ts`; the
acceptance file of T3 gains the metrics scenarios; the process unit test
of PR #201 for `outcomes`; the process acceptance test gains the `--json`
case.
