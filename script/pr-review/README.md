# Compute the review route

`check.ts` computes the review route of a pull request candidate. It is the
step "Run the check" of the section "Review route" of
[AGENTS.md](../../AGENTS.md). It reads the
[rules file](../../docs/implementation/pr-review-rules.yaml). The
[PR review playbook](../../docs/implementation/pr-review-playbook.md) explains
the routes and the checks. Commit every file first, then take the two
snapshots of check 4. Run the metrics process with `--json`: it writes the
coverage report, the stage outcomes, and the review findings. Then write the
CRAP rows of check 4. Run the check from the repository root. No build is
needed.

```sh
pnpm exec node script/code-quality/ast-metrics-snapshot.ts --base origin/main
pnpm exec node script/code-quality/ast-metrics-snapshot.ts
pnpm exec node script/code-quality/ast-metrics-process.ts --base origin/main --json ast-report/process.json
pnpm exec node script/code-quality/ast-metrics-crap.ts --base origin/main --json ast-report/crap.json
pnpm exec node script/pr-review/check.ts --base origin/main --repo tomer-mayara/Thermus \
  --base-snapshot ast-report/snapshot-base.json --head-snapshot ast-report/snapshot.json \
  --crap ast-report/crap.json --process ast-report/process.json --review ast-report/review.json
```

Give the metrics process the coverage option that the section "Code quality
review with ast-metrics" of AGENTS.md selects. The process exits 1 for a goal
miss, but it still writes the stage outcomes: the check reads them.

The CRAP command exits 1 when a goal is missed or unknown, but it still writes
the file: the check applies the goals. When it stops with a diagnostic, repair
the cause. Give the CRAP command the same `--base` as the check: the check
refuses a file whose `base` is not the merge base, because its rows would
classify the functions against another tree. Before the metrics process, run
the check without `--crap`, `--process`, and `--review`.

```text
Usage: pnpm exec node script/pr-review/check.ts [--base REF] [--rules PATH] [--repo OWNER/NAME] [--allow-dirty] [--base-snapshot FILE --head-snapshot FILE] [--crap FILE] [--process FILE --review FILE] [--json] [--help]

Options:
  --base REF            Git ref to compare with (default: origin/main)
  --rules PATH          Rules file, relative to the repository root
                        (default: docs/implementation/pr-review-rules.yaml)
  --repo OWNER/NAME     Repository for the printed label command
                        (default: the repository of the current folder)
  --allow-dirty         Check HEAD also when the working tree has uncommitted changes
  --base-snapshot FILE  Snapshot of the merge base, relative to the current folder
  --head-snapshot FILE  Snapshot of HEAD, relative to the current folder
  --crap FILE           CRAP rows of HEAD, relative to the current folder
  --process FILE        Stage outcomes of HEAD, relative to the current folder
  --review FILE         Review findings of HEAD, relative to the current folder
  --json                Print one JSON object instead of Markdown
  --help, -h            Show this help
```

Exit status 0 means that the check computed a route, also when the route is
`FIX`. Exit status 1 means that the check stopped. An argument is not valid,
the working tree has uncommitted changes and `--allow-dirty` is absent, or the
folder is not a git repository. Or the base ref is missing, or the rules file
at HEAD is missing, is not valid YAML, or has a key that is missing or wrong.
Or a snapshot, the CRAP file, or a metrics file cannot be read, is not valid,
or is not of its commit, or the exceptions file is not valid. Or only one of
`--process` and `--review` is given. The diagnostic names the key, or the file
and both commits.

## The routes

The first route of this list that has a reason applies. The report gives
every reason, not only the first.

| Route | Meaning |
| --- | --- |
| `FIX` | The candidate has a dependency fact that the rules file does not list, a forbidden edge, a new cycle, a known cycle that grows, an unresolved import in a changed file, or a snooze file that is not `[]`. Or a new production file has a raw MI below the limit, or a new or changed function misses its CRAP goal, and no exception covers it. Or an exception entry of a changed path has expired. Or a stage of the metrics process failed or is unavailable. The author repairs the pull request or declares the fact. |
| `ASK` | A protected path, the rules file, a module of the public surface, or a contract document changed, or the pull request declares a fact. The architect answers the question of each matching group. |
| `READ` | A read path changed, a line count is above its limit, the diff has more test cases removed than added, or it adds a skip or a todo. Or the raw MI of an existing production file dropped by the limit or more, or an exception entry covers a new file below the MI limit or a function that misses its CRAP goal. Or the review has a high finding on a changed production file. The owner reads the diff before the merge. |
| `SHOW` | No other reason, and a file under `scopes.executable` changed. The owner skims the merged diff. |
| `SHIP` | No reason. The pull request merges on green. |

## What the check does

The candidate is the commit HEAD. The check resolves HEAD once and prints it as
"Candidate", with the merge base `git merge-base <base> HEAD`. It reads every
file from git with rename detection, so it stops when the working tree has
uncommitted changes. With `--allow-dirty` it checks HEAD alone, and a note says
so. The rules come from the merge base. When the rules file does not exist
there, or is not valid, the file at HEAD applies, a note says so, and the
change of the rules file is `ASK`.

- Changed paths: each path, both paths of a rename, against `protected_paths`
  (`ASK`) and `read_paths` (`READ`). A change to the rules file is always
  `ASK` in the group `policy`, also when no group lists the file. The glob
  syntax is minimatch with dot files: `**`, `*`, and `?`. A pattern without a
  slash matches a file at the root only. The rules file can use no other
  syntax, and no pattern can start or end with a slash.
- Facts to declare: the package graph of the TypeScript files under `src/` at
  HEAD (`.ts`, `.mts`, `.cts`, `.tsx`, and declaration files), from their
  import statements. A type statement is `import type`, `export type ...
  from`, `import('x')` as a type, `declare module './x'`, a reference
  directive, or any statement of a declaration file. Every other statement is
  runtime, also an import with inline `type` specifiers only. An import of a
  file that exists but is no module, such as a stylesheet, is an asset and no
  fact. An import whose target is missing is `FIX` in a changed file and a
  note in an unchanged file. A changed JavaScript file under `src/` is `FIX`,
  because the check reads TypeScript only.
- The check compares the packages, edges, cycles, and external imports of the
  whole tree, and the imports across packages of the changed files, with the
  rules. A fact that the rules of the merge base lack and the rules of HEAD
  list is declared, and each declared fact is `ASK`. Each fact that the rules
  of HEAD lack is `FIX`. A forbidden edge, a new cycle, and a known cycle that
  grows are `FIX`, and no listing can declare them. A known cycle grows when
  it gains a member, or an edge between two members that `allowed_edges` of
  the merge base does not cover. A known cycle may shrink.
- Public surface: every change to a module of `public_surface` is `ASK`. So
  is a module that imports a changed file of its own package, because a
  re-export or an imported type can change its declarations. The check follows
  these imports one level only. A changed file under
  `public_surface.contract_documents` is `ASK` too. The check cannot compare
  the declarations. It lists the modules and the documents under "Surface
  differences".
- Size and tests: the changed lines under `scopes.production`, also of a file
  that moves into it, and the changed lines of all files except
  `scopes.generated`, against the limits of `size`. Under `test/`, the added
  and removed lines that call `it(` or `test(`, also as `t.test(` or
  `test.only(`. When more test cases are removed than added, each removed case
  is a reason. The check cannot see a removed row of a table that a loop turns
  into test cases. An added line under `test/` with a `skip` or `todo` option,
  variable, or call is `READ`, also in a text value. A
  `.habit-hooks/snooze.json` that is not `[]` is `FIX`.
- MI: the rules of `ratchet.maintainability_index` for each change under
  `scopes.production`; both paths of a rename count, and a deleted file has no
  rule. The check reads `maintainabilityRaw` from the two snapshot files and
  compares the values as numbers, with no rounding. A new file (status `A`)
  below `new_file_below` is `FIX`. A file in both snapshots whose value drops
  by `existing_file_drop_read_at` or more is `READ`. A renamed file compares
  the value of its old path in the base snapshot with the value of its new
  path in the head snapshot. A file without raw MI in the snapshot that it
  needs is not applicable. The section "MI" gives each file with its values,
  or `not checked` without the two options.
- CRAP: the goals of `ratchet.crap` for each row of the CRAP file whose
  `file` is the path at HEAD of a change under `scopes.production` that is
  not a deletion. A row of an unchanged function has no goal. The check
  computes both goals with `crapAbsoluteOf` of
  `script/code-quality/assessment/crap-absolute.ts`, from `paths` and
  `share`. A new function, and a function of unknown identity, must be at
  most `new_function_above`: a result `MISS` or `UNKNOWN` is `FIX`
  `ratchet.crap.new_function_above`. A changed function must be below
  `changed_legacy_function_at_or_above`: a result `MISS` or `UNKNOWN` is
  `FIX` `ratchet.crap.changed_legacy_function_at_or_above`. The check treats
  each changed function as legacy, because `ratchet.identity.start_commit`
  is not set. Without a share, `p` paths give the bounds `[p, p² + p]`: three
  paths give `[3, 12]` and pass 15 without coverage, four paths give
  `[4, 20]`, which crosses 15. A range that crosses its goal stays `FIX`
  until coverage or fewer paths decide it. The rules file must name the goals
  15 and 30, because `crapAbsoluteOf` computes these two goals only. The
  reason gives the value from known coverage, with the precision that keeps
  the side of each goal, or the range `[lower, upper]`. The section "CRAP"
  gives each function that passes: `<file>: <function>: pass from the bound
  [<lower>, <upper>]`, or `<file>: <function>: <value>` from known coverage.
  Without `--crap` it says `not checked: give --crap`. The comparison with
  the CRAP of the merge base is a later iteration.
- CRAP rows: the option names the JSON file of
  `script/code-quality/ast-metrics-crap.ts --json FILE`, relative to the
  current folder. The file must have `version` 1, a `base` text, a `head`
  text, and a `rows` list. Each row needs a `file` and a `function` text, a
  `change` of `new`, `changed`, `unchanged`, or `unknown`, and `paths` as a
  whole number, 0 or more. `share` is a number from 0 to 1, `crap` a finite
  number, and `identity` a text; each can be absent. The check uses `file`,
  `function`, `change`, `paths`, and `share`. The `head` must be HEAD, and
  the `base` must be the merge base; otherwise the check stops and names the
  file and both commits. The CRAP command records HEAD also for uncommitted
  files, so commit first, and write the file with the same `--base` as the
  check.
- Metrics: the step "Metrics" of the review route, with `--process` and
  `--review`. Give both options or neither. A stage of the process file with
  the status `failed` or `unavailable` is `FIX` `required_checks: <stage>
  <status>`. A goal miss alone is no reason: the check applies the MI rules
  and the CRAP goals itself. The check reads the review file only after a
  completed Review stage, with the status `passed` or `goal miss`. Otherwise
  the section says `findings not read: the Review stage did not complete`. A
  finding of severity `high` whose `file` is a changed path under
  `scopes.production` is `READ` `ratchet.review_findings: <file>: <message>`.
  Both paths of a rename count. A high finding on a changed file outside
  `scopes.production` has no rule: the section gives it as `outside
  scopes.production: <file>: <message>`. A high finding on an unchanged file
  is no reason: the section counts these as `<n> findings on unchanged files,
  reason unchanged by this PR`. Medium and low findings are no reason, and
  the section does not count them. The section "Metrics" gives each stage as
  `<stage>: <status>`, then these lines. Without the two options, it says
  `not checked: give --process and --review`.
- Metrics files: each option names a file relative to the current folder.
  The process file is the JSON of
  `script/code-quality/ast-metrics-process.ts --json FILE`. It must have
  `version` 1, a `base` text, a `head` text, and an `outcomes` list of the
  four stages `Delta`, `Review`, `CRAP`, and `Architecture` in this order.
  Each outcome needs its `name`, a `status` of `passed`, `goal miss`,
  `failed`, or `unavailable`, and a `text`. The review file is
  `ast-report/review.json`, which the review stage of the process writes. It
  must have a `headSha` text and a `regressions` list. Each regression needs a
  `severity` of `high`, `medium`, or `low`, and a non-empty `file` and
  `message`; the check ignores the other fields. The `head` of the process
  file and the `headSha` of the review file must be HEAD; otherwise the check
  stops and names the file and both commits. The check compares no base. The
  process keeps `origin/main` as its base also for a stacked pull request, and
  the review compares with the tip of its base ref. The keys
  `ratchet.process_outcomes` and `ratchet.review_findings` of the rules file
  give the default locations of the two files. Each is optional; when present,
  it must be a non-empty text.
- Snapshots: each option names a file relative to the current folder. Each
  file must be JSON with `version` 1 and a `files` list. Each file entry has
  a `path` text and an optional finite `maintainabilityRaw`; the check ignores
  the other fields. The `commit` of the base snapshot must be the merge base,
  and the `commit` of the head snapshot must be HEAD. Otherwise the check
  stops and names the snapshot and both commits. The snapshot command records
  HEAD also for uncommitted files, so commit first.
- Exceptions: the check reads `.code-quality-exceptions.yaml` from HEAD, when
  it exists. Each entry under `exceptions` needs a unit, a `metric`, a finite
  `bound`, a `reason`, and `expires` as `YYYY-MM-DD`. The unit of an entry of
  `metric: mi` is a file: `path`. The unit of an entry of `metric: crap` is a
  function: `function: <file>#<function>`, with the file and the function as
  the CRAP rows give them. An entry has `path` or `function`, not both. An
  entry that is not valid stops the check, and the diagnostic names the entry
  and the field. Today is the committer date of HEAD, so that a rerun gives
  the same route. An `mi` entry covers the `FIX` of its new file while the raw
  MI is at least the bound and today is not after `expires`. A `crap` entry
  covers the `FIX` of its function while the value from known coverage, or
  the upper bound, is at most the bound and today is not after `expires`. The
  covered unit stays a `READ` reason that names the entry. An entry that
  expired before today is `FIX` when its path, or the file of its function,
  changed. A change to the file is `READ` through `read_paths`.
- Route: the first route with a reason. The check runs no required check. It
  reads the stages of the metrics process with `--process`; another failed
  required check is `FIX`, as the step "Route" says.
- Record: the Markdown section "Review route" for the pull request
  description, or one JSON object with `--json`, and the label command.

The report gives each reason as `<ROUTE> <key>: <fact>`. A dependency fact
names a file that causes it. "Facts to declare" gives the key and the entry
that would list each fact, in the form of the rules file. One `SHOW` reason
counts the changed files under `scopes.executable`; the changed paths list
them.

## The steps that stay with you

- "Declare or remove facts": remove each fact under "Facts to declare", or
  declare it under the key that the entry names. Compare the declarations of
  each module under "Surface differences".
- "Metrics": after the final report of the process "Code quality review with
  ast-metrics" in AGENTS.md, run the check with `--process` and `--review`, and
  read its reasons. The check applies the MI rules, the CRAP goals, the stages
  of the process, and the high findings of the review. A note says when this
  step stays with you.
- "Decision": for `ASK`, write the draft decision in the section "Review route"
  of the pull request description. Answer the question of each matching group,
  and state the guarantee that holds after the change.

## Source layout

`check.ts` is the entry. `command-line.ts` holds the help and the options.
`run.ts` resolves the commits and reads the candidate from git through
`git-reads.ts` and `blobs.ts`, and the rules through `rules-source.ts`.
`rules.ts`, `rules-graph.ts`, `rules-routes.ts`, and `rules-values.ts` read and
check the rules file. `changes.ts` reads the diff output. `code-files.ts`,
`imports.ts`, `resolution.ts`, `external.ts`, and `graph.ts` build the package
graph. `dependency-facts.ts`, `cycles.ts`, and `facts.ts` compare it with the
rules, and `sources.ts` joins the graph with the public surface of
`surface.ts`. `paths.ts`, `size.ts`, and `test-counts.ts` give the other
reasons; `globs.ts` matches the patterns. `snapshots.ts` reads the two
snapshot files, `exceptions.ts` reads the exceptions file and finds the entry
that covers a unit, `exception-entries.ts` checks each entry, and `ratchet.ts`
applies the MI rules. `crap-rows.ts` reads the CRAP file, and `crap.ts`
applies the CRAP goals. `metrics-files.ts` reads the process file and the
review file, and `metrics.ts` applies the metrics step. `analysis.ts` and
`result.ts` collect
the reasons, and `route.ts` and `report.ts` give the route, the label command,
and the record.

## Tests

The acceptance tests `test/acceptance/script/pr-review-check*.test.ts` run the
command in small git repositories, each with its own rules file from
`test/acceptance/script/fixtures/pr-review-rules.ts`. The unit tests are
`test/unit/script/pr-review-*.test.ts`.
[The test list](../../docs/testing/test-list.md#pr-review-check) says what each
file checks.

```sh
pnpm run build
node --test "dist/test/acceptance/script/pr-review-check*.test.js"
node --test "dist/test/unit/script/pr-review-*.test.js"
```
