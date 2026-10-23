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

- For behavior under `src/`, write the BDD acceptance test first: a Given-When-Then scenario or an
  equivalent executable specification. The test fails, because the feature
  does not exist yet.
- For that source behavior, drop down into TDD to implement the pieces that the acceptance test
  needs. For each small step: write a failing unit, interface, or
  integration test; make the test pass; refactor.
- Continue until the acceptance test is green. Green is the signal that
  the specification is met.
- Follow DRY3: make a shared function after the third copy, not before.
- Make sure that the required checks are green before a merge.

Tests under `test/` verify behavior whose subject is under `src/`. Do not add
tests for scripts, documents, configuration, or tooling. Use relevant build,
type, lint, and manual checks for those changes.

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
  `npm run typecheck` and `npm run build:user-portal`,
  plus the applicable gates in the test gate policy. These commands cover
  the remaining check stages; do not add `npm run check`, which would repeat
  unit and portal tests.
  Otherwise, run only the affected test groups for changes under `test/`
  and relevant build, type, lint, or manual checks for other changed files. Use the
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
- Follow the [component registry workflow](docs/implementation/component-registry-workflow.md)
  to check architecture impact and maintain the registry before Ready or
  requesting human review or merge under this policy.
- Select and run the applicable ast-metrics process as the section "Code
  quality review with ast-metrics" below says. Ordinary prose-only changes
  skip irrelevant production metrics.
- Compute and record the review tier and blockers as the section "Review
  tier and merge eligibility" below says. Refresh them after each change.
- When the requested scope permits Ready, mark the pull request Ready after
  the required local checks pass. The manager or Delamain session verifies
  the complete candidate. Return a Ready pull request to Draft before a fix.
- Review the work of your subagents. T1 Team review and T2 Need architect
  need an independent authorized human approval of the current candidate.
  An agent approval or a label alone is not human approval evidence.
- Merge an eligible clean pull request one time, within the user's request.
  An authorized agent or Delamain session can merge T0 Auto merge after
  applicable checks pass and the requested scope permits merge.
  The owner merges a pull request that adds a decision record under
  `architecture/decisions/`. A request for a draft stops before Ready and merge.

### Architecture diff comment

For a T2 pull request, prepare one concise architecture comparison comment
before requesting human review. Update it when the candidate changes.

- Pin the full PR head and actual merge-base SHAs; for a stack, find the merge
  base with its parent branch. Inventory every Mermaid block in
  `architecture/components.md` and identify changed views. Read the relevant
  prose, code, contracts, and tests at both revisions. Reconstruct the delta
  before consulting old comments; treat earlier drawings as drafts.
- Manually draw the affected C4 Level 3 components. Name their Level 2 container
  in the heading or boundary. Show each revision's responsibilities and useful
  relationships faithfully, with enough unchanged neighbors to explain them.
  Use real component owners; methods, fields, contracts, and internal steps
  belong inside their owners or in prose, not as separate components.
- Distinguish runtime calls, source or implements dependencies, and composition.
  Show new runtime use of existing contracts. Mark additions green, removals
  red, and changed meaning amber, with text labels. Keep stable relationships
  and boundaries neutral. A removed operation does not remove its owner; a
  moved contract does not create a runtime capability.
- Aim for one drawing and three or four short before/after behavior notes.
  Preserve material authority, payload, order, outcome, replay, and lifetime
  rules that the map cannot show. Put validation at its rule owner, separate
  local gates from remote work, and keep stopping outcomes clear. Surviving
  calls stay neutral even when their policy or payload changes. Name condensed
  remote work and retained dependencies omitted for clarity.
- State whether registry drawings changed. Label supplementary views derived
  from prose and code; do not present newly documented behavior as new. Name
  Level 2 container or deployment changes and flag any that the focused view
  does not explain. Maintain the registry as the current system map; keep
  comparison colors and historical annotations in the PR comment.
- Keep full pinned evidence and limits with the review artifacts. Link before
  and after registry and code evidence; verify paths and line bounds. Save
  versioned drafts, standalone Mermaid sources, renders, and review notes.
  Parse, render, and visually inspect at normal PR width. Preserve relevant
  configuration; check title clearance, labels, boundaries, arrow targets,
  and crossings through labels or unrelated boxes. Keep label backgrounds
  neutral. Verify embedded Mermaid matches the rendered source byte-for-byte.
- Obtain manager review, apply feedback in a new draft, rerender changed
  drawings, and record the fixes. Recheck PR revisions before publication;
  changed revisions require a refreshed comparison and manager review. Publish
  or update the one comment, then read it back to verify its body.

This concise comment does not replace the wider architecture-impact check,
test evidence, required human approval, review tier, or merge policy.

## Review tier and merge eligibility

The [PR review playbook](docs/implementation/pr-review-playbook.md) and
[rules file](docs/implementation/pr-review-rules.yaml) use these tiers:

| Tier | Required review |
| --- | --- |
| T0 Auto merge | No human approval; an authorized agent or session can merge an eligible candidate. |
| T1 Team review | An independent authorized team member or owner approves. |
| T2 Need architect | An independent authorized architect approves the candidate and architecture impact. The owner can act as architect. |

Use the highest matching tier and keep every reason. Tier selects review;
merge eligibility is separately `eligible` or `blocked`. A failed check is
a blocker, not a fourth tier. A policy or quality-tool change requires
at least T1 Team review. Architecture changes require T2 Need architect as
the playbook defines. Static protected-path or public-surface touches set a
conservative T1 Team review floor; they do not prove an architecture change.
Team review resolves possible contract or topology changes and escalates actual
architecture changes to T2 Need architect. Uncertain impact blocks eligibility
and cannot use T0 Auto merge.

The checker uses the trusted merge-base policy and HEAD facts. A candidate
cannot weaken its own requirements. The historical adapter preserves the
higher review requirement of legacy base rules as T2 Need architect; this
migration does not use the new HEAD policy to lower its own review. Legacy
route names are input compatibility only, not active tiers.

1. **Classify the committed candidate.** Update the root `.pr-impact.json`
   declaration with `version`, `classification`, and `architecture`. It must
   differ from the trusted base so stale declarations cannot be reused. Commit
   it with the complete candidate so `git status --porcelain` is empty. For
   local checks, stamp a copy with the actual base and head as the checker
   guide says, then save it as `ast-report/impact.json`. Run
   `pnpm exec node script/pr-review/check.ts --base origin/main --repo tomer-mayara/Thermus --impact ast-report/impact.json`.
   The [check guide](script/pr-review/README.md) defines the base/head-bound
   impact evidence, options, output, and labels. Supply every classification
   field, architecture summary, checked views, and evidence. The manager or Delamain
   session stamps the committed declaration with the actual base and head; mutable pull request prose cannot replace it. Missing impact
   evidence blocks eligibility and requires at least T1 Team review. The
   local result is preliminary: it does not prove completed local checks or human approval.
2. **Resolve facts.** Remove an undeclared fact or declare it in the rules
   file under the reported key. Update applicable count and date comments.
   Remove forbidden imports, new cycles, and growth of known cycles; a
   declaration cannot authorize them. The checker lists affected public-surface
   modules; it does not emit or compare declaration snapshots. For each listed
   module, compare the relevant exported declarations and behavior before and
   after the change, then record whether an observable contract changes. Record
   the guarantee and answer each applicable policy question. Reclassify
   after each change. A lasting architecture decision needs a decision
   record when the authorized decision maker requires it; T2 Need architect
   alone does not require a new record. Records use
   `architecture/decisions/YYYY-MM-DD-<topic>.md` with Context, Decision,
   and Consequences headings.
3. **Add applicable metrics.** When production files change, take the base
   and head snapshots with
   `pnpm exec node script/code-quality/ast-metrics-snapshot.ts --base origin/main`
   and `pnpm exec node script/code-quality/ast-metrics-snapshot.ts`. Run the
   process with `--base origin/main --json ast-report/process.json`, using
   its permitted coverage selection. Then run
   `pnpm exec node script/code-quality/ast-metrics-crap.ts --base origin/main --json ast-report/crap.json`.
   Give the checker `--base-snapshot ast-report/snapshot-base.json
   --head-snapshot ast-report/snapshot.json --crap ast-report/crap.json
   --process ast-report/process.json --review ast-report/review.json`.
   For a source-free metric-tool or rule change, run the applicable process
   and review without irrelevant production snapshots or CRAP.
   A goal miss can still produce valid reports; tool failure or missing
   required evidence blocks eligibility. Retained high findings and permitted
   metric exceptions require at least T1 Team review. Findings unchanged by
   this pull request do not escalate its tier. Mark irrelevant production
   metrics N/A under the selection below; do not create empty evidence.
4. **Record the result.** In the pull request's Review tier section, record
   the tier, all reasons, blockers, and current candidate SHA. Apply the
   canonical tier label printed by the checker. Summarize relevant changed
   file/function findings, check results, and N/A reasons. Link retained full
   reports and exceptions. Do not paste unchanged full reports. Check and
   record architecture impact for every tier, using the component registry
   workflow. Update the explanation, evidence, and labels after each change.
5. **Obtain review and eligibility.** T1 Team review needs an independent
   authorized human team member or owner. T2 Need architect needs an
   independent authorized human architect; one qualified reviewer can cover
   both concerns. Approval must cover the current head SHA and scope.
   Anyone can escalate. De-escalation needs a recorded reason and approval
   from a reviewer authorized for the higher tier. De-escalation cannot waive blockers. Record its approval and retain the
   previous tier and reasons in the review evidence.
   An owner-account label or AI-generated approval is not proof of human
   identity. All applicable checks and holds must be resolved before merge.

A subagent or worker classifies its part, resolves facts, and reports evidence;
the manager or Delamain session checks the complete candidate. No local tier
result alone authorizes merge or changes the user's requested stopping point.

## Code quality review with ast-metrics

Select this process from the complete candidate, after documents are updated and
before Ready. Under the new rules, the process applies to `src/**`,
`script/code-quality/**`, `.ast-metrics.yaml`, `.ast-metrics-baseline.yaml`, and
`.code-quality-exceptions.yaml`. Source changes need the complete snapshots,
CRAP, and process evidence. Metric-tool or configuration changes need the
process/review and relevant build, type, lint, or manual checks. Other changes,
including ordinary prose, PR checker and policy scripts, can mark production
metrics N/A when no listed path changes. They still need applicable checks,
habit-hooks, architecture impact, and review. The trusted base controls
selection: a historical rule that requires metrics for every candidate remains
in force for that candidate. Use the commands under `script/code-quality/`. The
[ast-metrics review guide](docs/implementation/ast-metrics-review.md) gives the
commands, their reports, the configuration, and the limits of the tool.

1. Prepare. Update the branch from `origin/main`. Select the tests from the
   complete candidate, as the test gate policy says. A command of this process
   must not start a suite outside that selection. Use the same base for
   every comparison.
2. Run `pnpm exec node script/code-quality/ast-metrics-process.ts --json ast-report/process.json`
   and read `ast-report/process.md`. The report has four sections: delta,
   review, CRAP, and architecture. The review tier check reads
   `ast-report/process.json`. Choose the coverage option from the test
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
   description. For a new file below 85, also add an entry with its path,
   `metric: mi`, a bound, the reason, and an expiry date to
   `.code-quality-exceptions.yaml`; the review tier check reads it.
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
   reason `unchanged by this PR`. For an added or changed function that
   misses its goal, also add an entry with `function: <file>#<function>`,
   `metric: crap`, a bound, the reason, and an expiry date to
   `.code-quality-exceptions.yaml`; the review tier check reads it. A
   permitted exception needs T1 Team review, or T2 Need architect when
   architecture independently requires it. Approval cannot waive an uncovered
   failure. The command still exits 1 for a recorded goal miss. A tool failure
   is not an exception: correct it.
6. Final report. After the last fix, run the applicable process again on the
   complete candidate. Summarize relevant changed files and functions, goals,
   findings, exceptions, and evidence limits in the pull request. Retain and
   link the complete `ast-report/process.md` and machine-readable reports as
   review artifacts. Keep graphs, legends, import evidence, and notices in
   those reports; do not copy the whole report into the pull request body.
   Keep global dependency checks and the analysis context needed to detect
   invalid edges and cycles. MI is a production-file measure and CRAP is a
   function measure. Component summaries do not create a component CRAP
   score or a new numeric escalation rule. A base CRAP value derived with
   head coverage is an estimate, not measured base coverage.
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
of "Pull requests", classifies its part and resolves facts under "Review tier
and merge eligibility", and reports the results; it does none of the pull request
steps. A restart reuses the same pull request and merge result.
