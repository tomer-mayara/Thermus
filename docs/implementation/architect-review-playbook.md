# Architect review playbook for Thermus

Status: proposed consolidated manual/shadow policy, reviewed 2026-10-20;
not operationally adopted. Repository facts refer to commit
`faefe09e84c62636ca949600cefa4a75fdd3a60b` (PR #197).

Use this plan to decide when ordinary owner review is enough and when an
architect must help. Keep every merge manual. This document changes no active
rule and authorizes no implementation work.

## 1. Authority and roles

This document defines one proposed manual/shadow policy. Operational adoption
still requires the coordinated changes in section 8. Until then, follow
[AGENTS.md](../../AGENTS.md), the
[test gate policy](test-gate-policy.md), and the current metrics process.
Record proposed results separately. A proposed route is not an active gate and
cannot excuse a failure under current rules. The owner can act on any defect
the trial finds. Explicit releases retain their separate release gates.

The owner has selected the report layout in Appendix C: a full tracked
`last_code_quality_report.md`, with a short route and link on the PR.
Implement that layout by updating the report writer, AGENTS.md and the metrics
guide together. This planning document does not implement that change or publish
a report.

The author prepares evidence and fixes problems. The manager checks delegated
work. The architect decides design questions and exception requests. The owner
checks the final candidate and merges once. The owner may also be the architect,
but an author cannot approve their own exception or governance change. This plan
adds no agent PR reviewer.

The limits below are project policy choices to test in the trial. They are not
universal grades. Scores help find review needs; they do not prove correct
behavior, good boundaries, or sufficient test assertions.

## 2. Decide the review route

Check all triggers, then select one route. Keep every reason, even when another
reason has higher priority.

| Route | Use it when | Next step |
| --- | --- | --- |
| `FIX_REQUIRED` | A required check failed, work is still pending, or evidence is corrupt, stale, invalid, or has a repairable omission. | Repair or complete it. A human approval cannot turn a failed check into a pass. |
| `ARCHITECT_REQUIRED` | A design or score trigger needs a decision, or required evidence remains unavailable after reasonable repair within the allowed test scope. | Ask for a specific design decision or a scoped exception. Keep unknown values unknown. |
| `AUTO_MERGE` | No fix or architect route applies, no AUTO scope exclusion applies, and every condition in Appendix D is proved. | Record a shadow recommendation. The owner still reviews and merges manually; live execution needs separate adoption and enablement. |
| `ROUTINE_REVIEW` | Required evidence is sufficient and no fix or architect route applies, but AUTO eligibility is absent, failed or unknown. | The owner reviews and decides whether to merge. |

`FIX_REQUIRED` takes priority over the other routes. A failed test and a new
cross-package cycle produce `FIX_REQUIRED` with the cycle listed too. Passing
the test later does not remove the cycle trigger.

Apply the order `FIX_REQUIRED` → `ARCHITECT_REQUIRED` → `AUTO_MERGE` →
`ROUTINE_REVIEW`. Appendix D proposes the fourth route; it grants no live merge
permission. Its defined shadow scope needs no separate approved recipe for each
PR. An AUTO-only unknown falls back to routine review when normal required
evidence is sufficient. A required failure or relevant evidence gap still follows
the existing fix/architect rules. MI below 85 alone is an owner warning and an
AUTO blocker, not an architect trigger.

Record the architect decision separately: `pending`, `approved`, or
`changes requested`. A candidate that needed a decision stays
`ARCHITECT_REQUIRED / approved` after approval; it never becomes `AUTO_MERGE`.
An accepted evidence gap stays visible; it is not a measured pass.
It affects later PRs only when the gap can
change their required decision.

A completed score miss is different from a failed tool operation. Preserve the
original command status and current required improvement process. Retained CRAP
absolute misses and material decline need architect decisions unless a valid
standing exception covers them. Absolute MI below 85 needs a short owner-reviewed
reason; stable or improved low MI needs no repeated waiver solely for that floor.
Tool failures and failed required tests cannot receive a numeric exception.

## 3. Scope and valid measurements

### Which changes need a score comparison

Start with changed production functions, files and classes under `src/`.
Include unchanged units when changed unit tests, shared test support, production
dependencies, build inputs or measurement code can change their scores.
When the impact cannot be narrowed safely, assess the wider affected set.
Keep unrelated existing debt visible without requiring it to be fixed by this PR.

A prose-only change normally needs no numeric comparison. An isolated integration
or acceptance test change also need not change canonical unit coverage. First
check for shared helpers, imports, preloads, configuration and build effects.
Record why a comparison is out of scope. If that cannot be proved, retain the
uncertainty. A broad fingerprint mismatch alone does not prove a causal score
change, but it still prevents reuse under the current capture contract. Never
relabel a stale capture as current.

Design and policy review can still apply when numeric comparison is out of
scope. Check the full change set, including scripts, dependencies, tests,
configuration, migrations, Docker files and documents that define active rules.

### Scores and comparison basis

Use these units separately:

| Metric | Unit | Direction |
| --- | --- | --- |
| CRAP | Function or method | Lower is better. |
| Maintainability index (MI) | Production file; production class | Higher is better. |

Do not substitute a file score for a class score or use an average to pass an
individual limit. Function MI may help diagnosis, but is not another gate in
this proposal. Test and support files have no production MI floor.

Thermus uses `CRAP = p² × (1 − c)³ + p`, where `p` is the tool's decision-path
count and `c` is the covered share of the function's own characters. Nested
functions do not contribute to their parent's own range. This V8 character
measure approximates coverage; it does not prove path or requirement coverage.

The canonical coverage set is **both complete unit parts**: compiled Node tests
and portal tests run from source. Integration and acceptance coverage may add
behavior evidence, but cannot replace or enlarge this set for CRAP comparisons.

A measurement basis identifies the tool, metric definition and relevant runtime,
compiler, suite and source-representation rules. Compare scores only within a
compatible basis. Each capture must match its own revision's source, tests and
build inputs. Base and head fingerprints can differ when those inputs changed.
Keep manifests, content hashes and completion evidence. Preserve original tool
reports unchanged; regenerate the full report view as Appendix C defines.

Select tests before collection. A `src/` change selects the full ordinary suite.
An ordinary `test/unit/` change selects the complete unit group; the separate
build test selects `test:build` instead. Apply the test gate policy's dedicated
gate rules before its ordinary group rules. Other groups and focused script
tests do not automatically authorize unit collection. Reuse valid captures.
If base capture needs a separate measurement task, scope that task explicitly.
Neither this plan nor a missing report selects another suite.

### Current limits of the tools

The current scripts pin ast-metrics 0.43.1. Its MI calculation has no fixed upper
clamp; the repository's 0–128 description is a wrapper/documentation convention,
not an enforced tool range. The
[pinned calculation](https://github.com/ast-metrics/ast-metrics/blob/v0.43.1/internal/analyzer/component/maintainability_index_visitor.go#L83)
uses Halstead volume, cyclomatic complexity and logical LOC, normalizes with
`100/171` and floors the result at zero, then adds
`50 × sin(sqrt(2.4 × CLOC/LOC))`. The
[pinned test](https://github.com/ast-metrics/ast-metrics/blob/v0.43.1/internal/analyzer/component/maintainability_index_visitor_test.go#L74)
expects an integer result of 104. The
[current website](https://ast-metrics.dev/metrics/maintainability-index/) describes
0–100; [Microsoft](https://learn.microsoft.com/en-us/visualstudio/code-quality/code-metrics-maintainability-index-range-and-meaning)
uses a different normalized formula. Neither justifies replacing 85 with 65 or
20. Volume/comments can change file MI without changing architecture. Keep the
pinned basis and inspect the code rather than splitting files to chase a score.

The output has these limits:

- Snapshot `maintainability` remains rounded to one decimal. Files also emit
  optional `maintainabilityRaw` from finite native file MI; F.9 records this
  additive version-1 field. Missing/legacy raw values stay unavailable and are
  never reconstructed from rounded scores. Function MI stays rounded. The
  current architecture reader ignores raw file MI; a future assessment reader
  must retain and validate it. The current file gate uses its reported score.
  This policy uses raw values for comparisons and
  the AUTO floor: raw 84.96 blocks AUTO even if the display says 85.0. It is an
  owner warning, not by itself an architect trigger.
- Native lint reports class findings, but current snapshots have no typed raw
  class observations or class history. Prove that capability before relying on
  class automation. Missing raw class MI solely for the AUTO floor is an AUTO-only
  unknown when ordinary evidence is sufficient. Unknowns that can change a
  required decline/CRAP/design decision retain the fix/architect gap rules.
- Coverage version `own-characters-1` rounds shares to 0.001. Exact CRAP comparison
  means exact arithmetic on those stored inputs. Keep that basis initially;
  changing to exact character ratios requires a measurement-basis change.
- Architecture uses head coverage to estimate base CRAP. Those estimates and
  old `docs/metrics/` records cannot establish measured base scores or anchors.
- Component graphs group top-level folders and omit internal edges. Community
  averages, colors and cycle counts are useful displays, not review decisions.
  The bands use CRAP 30, so a new function at 20 can miss its goal without a
  critical band.

### Missing values and useful bounds

Missing input is not zero. A source-proven type-only or constant-only unit may
have no applicable metric; record the reason. Missing metrics in executable
code require investigation. Unknown names, duplicate matches and unsupported
moves must not be presented as proven identities.

Do not demand a value that cannot change the numeric decision. With known
nonnegative paths `p` and unknown coverage, CRAP is in `[p, p²+p]`. A bound may
prove a pass or a miss if the entire possible range gives the same result.
For example, `p=0` gives exact CRAP 0; a new function with `p=3` has CRAP at most
12 and meets 15. A change from `p=3` to `p=3` can still lose coverage and worsen
by more than 5, so equal paths do not prove an unchanged score.

Use conservative bounds for differences too. If the range crosses a threshold,
the comparison remains unknown. Keep the proof and the unknown score separate.
Do not store a bound as an exact anchor. A bound proof does not replace identity,
required tests or design review. This is a proposed improvement; current required
CRAP assessment rules remain active until adoption.

## 4. Scores, boundaries and review decisions

### Numeric rules

Choose a measured start commit `P` before the trial. Record each unit's origin.
If the owner adopts the trial policy, retain that origin history. A later tool
change must not make a post-`P` function legacy.

| Affected unit | Absolute condition | Disposition |
| --- | --- | --- |
| Function introduced after `P`, including later edits | CRAP ≤ 15. | A miss needs architect review unless covered. |
| Function already present at `P` | CRAP < 30. | A miss needs architect review unless covered. |
| New or changed production file | Raw file MI ≥ 85. | Below 85: owner warning and AUTO blocker only. |
| New or changed production class | Raw class MI ≥ 85. | Below 85: owner warning and AUTO blocker only. |

For each metric and unit, record:

- `B`: the score at the exact latest-main base used for this candidate.
- `H`: the score of the complete candidate.
- `A`: its best accepted score since `P` within this measurement basis, with the
  revision and evidence that produced it.

| Metric | Decline in this PR | Cumulative decline |
| --- | --- | --- |
| CRAP | `H − B` | `H − A` |
| MI | `B − H` | `A − H` |

Apply one decision rule:

1. A CRAP absolute miss or MI/CRAP cumulative decline **≥5** needs architect review
   unless a valid standing exception covers that exact condition.
2. A decline **≥5 in this PR** always needs a decision for this candidate.
   A standing exception cannot waive it.
3. Absolute MI below 85 needs an owner-reviewed short reason, not an architect
   waiver. Record MI85 as `LOW` and AUTO blocked; do not mislabel it a measured pass.
4. Missing evidence needs review only if it can change a required decision.
   Use section 2 to distinguish repair from an accepted evidence gap.

Check absolute conditions even when decline is less than 5. CRAP 14.9→15.1
needs architect review; MI 85.1→84.9 is a warning and blocks AUTO. Compare raw
values and exact equality. Do not add a tolerance, subtract rounded display values, or
cancel one unit's decline with another unit's improvement.

An accepted MI sequence 96→93→90 reaches cumulative decline 6. Ordinary merges
do not reset `A=96`. A recovery to 94 has decline 2. A new unit with no predecessor
has no invented `B=0`; assess its CRAP goal or MI warning/AUTO floor and start its
anchor after acceptance. A new file accepted at 44, then 43, then 41, and candidate
38 reaches cumulative decline 6; low starting MI does not remove that trigger.

The lasting CRAP 15 rule, AUTO MI 85 floor, class comparisons, five-point threshold
and best-score rule are project choices. Even a five-point MI drop can reflect
volume/comments; calibrate useful and false triggers during the trial. No policy
change resets accepted anchors, origin or overlapping obligations.

### Design and policy rules

Use the meaning of the change and the old documented promises:

| Area | Architect decision required | Ordinary owner review can suffice |
| --- | --- | --- |
| Responsibility/dependencies | New logical package, cross-package responsibility/owner change or unapproved dependency direction. | Local helper extraction or wiring within the same runtime owner. |
| Contracts | New boundary, new consumer obligation or changed established semantic guarantee. | Compatible extension at an established bounded extension point, with verified producer/consumer compatibility, unchanged guarantees and no required consumer work. |
| Security/privacy | Changed admission/refusal, trust, permissions or sensitive-exposure limits. | Repair that honors the existing promise without changing those guarantees. |
| Lifecycle | New owner/lifetime/shared state, consistency rule or cancellation/cleanup guarantee. | Same-owner repair or extraction preserving the established guarantee. |
| Measurement/policy | Changed basis/meaning, weakening/bypass, approval authority or a new material tradeoff. | Clarification, equivalent implementation or straightforward tightening, with required owner policy approval; the author cannot self-approve. |
| Retained findings | Architecture/safety exception or unresolved design tradeoff. | Policy-permitted style, size or comment reason; low-MI-only native high findings are owner warnings. |
| Cycles | New cross-package/prohibited/runtime cycle or material build consequence. | Local cycle inside one approved logical package, no prohibited edge, a coupling reason, and proof that erasing type-only edges leaves no runtime cycle. Keep source edges visible. |

An unambiguous protected violation is `FIX_REQUIRED` unless active policy permits
a specific exception; that exception needs architect review. Do not demote every
high finding or treat an operation failure as an advisory score.

A public contract is an intentional external/interpackage obligation for inputs,
outputs, errors, events, permissions, effects, persistence, schemas, protocols or
lifecycle. An internal test-helper export is not automatically such a contract.
An established extension point is a bounded permission, not similar-looking code.
Compare old docs and expectations, not just types or rewritten passing tests.
Every actual public-contract change still blocks AUTO, including a compatible
extension that receives routine review.

Same owner means runtime responsibility, invariants and lifetime, not the same
person or CODEOWNERS entry. Tightening cannot override a separate contract,
basis or security trigger. A bug-fix label does not prove measurement equivalence;
changed historical values, provenance or decisions need section 6's correction
review. Governance/rule/baseline/approval/evidence-policy changes block AUTO even
when owner review suffices. A document filename alone creates no trigger.

Keep cycle edges and members, not just counts. Local type-only coupling still
needs an explicit reason; community regrouping alone is advisory. Existing
approved interfaces and same-owner repairs do not by themselves require architect
review when no other trigger applies.

The architect can approve bounded extension permissions once, such as optional
diagnostic fields, event/rate limits, stable error text and permitted recipients
or data. Later owner review checks conformance. This needs no per-PR recipe
catalogue and cannot retroactively change the old guarantees of an earlier PR.

Approve the boundaries affected by each change. Do not require a complete new
package catalog before reviewing an unrelated PR. An unclassified relevant
boundary stays unresolved. Existing guards remain active, including cleaner→MCP
and website-fetcher→auth restrictions and the auth/page-fetch boundary tests.
Type-only imports can violate a boundary too.

Use this initial map to identify the relevant owners. It lists areas to review;
it does not approve every import found in current code.

| Area | Source paths and existing role |
| --- | --- |
| Shared auth | `src/auth/access-context.ts` and `identity-verifier.ts`; public roles independent of providers/transport. |
| Local auth | Neutral commands in `src/auth/local-auth/`; provider implementation in its `better-auth/` directory. Keep their boundary. |
| Hosted auth | `src/auth/hosted-auth/browser-session.ts` is a public contract; `workos/` holds the provider implementation. |
| Fetch and cleaning | `src/page-fetch/`, `src/website-fetcher/`, `src/html-cleaner-pipeline/`; callers use public contracts and composition chooses implementations. |
| Other packages | Separate `src/` folders for billing, config, hosted-admin, html, http, logging, mcp, organizations, terminal and user-portal. |
| Composition/startup | Root `src/` modules, including application, fetch-tool, hosted-workos-application, hosted-renderer-startup, hosted-portal and index. Review their wiring responsibilities. |

For an approved direction, record source package, target package, permitted public
interface and any composition exception. Keep unresolved aliases/dynamic imports
visible. Inspect uncertain relevant forms manually; do not silently drop them.
Untouched debt alone does not require redesign. Its growth, revival, suppression
or changed responsibility does.

## 5. Exceptions with one clear limit

Use individual exceptions in the first version. Do not build a separate profile
system. If repeated cases justify a shared rule, propose a later policy change
with evidence from the trial.

A standing numeric exception contains:

- A stable ID, affected unit, metric, measurement basis and scope of responsibility.
- Conditions covered: CRAP absolute limit, cumulative decline, or both. MI
  exceptions cover cumulative decline only; absolute MI 85 needs no waiver.
- One permitted score bound: a maximum CRAP or a minimum MI.
- The reason, alternatives tried, named architect/owner, and an expiry date.

The exception permits **no further decline while it is needed**. After an accepted
improvement, lower its CRAP ceiling or raise its MI floor. Derive any covered
cumulative amount from that bound and `A`; do not store another independently
editable budget. Retire it when all the conditions it waives pass normally.

For example, `A_MI=96` and accepted `H=90` need cumulative review. An exception
can allow MI≥90 for the named scope. At 90, report decline 6 as covered. At 89.9,
ask again. If 91 is accepted, tighten the floor to 91. At accepted 92 the
cumulative condition passes normally, so retire that exception. `A` remains 96.
The same rule applies in the other direction to CRAP.

This no-further-decline condition applies only while an exception is needed.
Without a cumulative trigger, accepted MI 70→72→71.9 needs ordinary owner review,
not repeated permission to remain below 85. Retire old MI-floor waivers for that
condition only. Preserve overlapping cumulative, CRAP and design obligations;
do not reset anchors or erase their history. Record the tighter review cost of
exception-bearing cumulative/CRAP debt during the trial.

Reusing a standing exception is different from reusing candidate approval.
For each use, check its unit, basis, responsibility, bound, expiry and whether
current policy still permits it. A new PR base alone does not cancel it. Changed
scope, expiry, or a widened bound needs a new architect decision. It covers no
new design trigger, failed test or invalid evidence. A numeric exception cannot
approve a forbidden import. Repair an unambiguous protected violation unless
active policy permits a specific architect-reviewed exception.

An evidence exception records the unavailable fact, attempted repair, test-scope
constraint, affected units, alternate evidence, risk, and follow-up owner/date.
It is a decision for that candidate. It does not create a measured score or an
exact anchor. A later relevant candidate must resolve the gap or obtain its own
decision. An unrelated candidate need not renew it.

## 6. Accepted history without routine bookkeeping noise

A main update is one merged PR: a squash commit, an ordinary merge commit, or a
rebased range that a human has reconciled. An accepted observation is a verified
measurement of content in that update. In shadow mode, accepted means merged
under current rules; it does not imply approval under the proposed rules.

### Preserve gains and identity

Only actual accepted main states contribute to `A`. Drafts, rejected candidates
and experiments do not. After a verified manual merge:

- CRAP anchor: `Anew = min(Aold, H)`.
- MI anchor: `Anew = max(Aold, H)`.
- New unit: its first exact accepted score starts its anchor.

Store the source revision of each best score. Keep bounds and unknown accepted
observations too. Do not claim a complete anchor if an unmeasured accepted gain
could change the decision. Resolve that gap or use a sound bound; ignoring it
would lose the very deterioration this plan is meant to detect.

Proven continuing functions, files and classes keep their identity and history.
Unique moves/renames can prove continuity. Names alone cannot. Copies and new
helpers get new-function rules and no inherited exception. A continuing parent
keeps its anchor when code is extracted from it.

Do not divide CRAP or MI anchors among split/merged units. These metrics are not
additive. If continuity is unclear, the architect reviews the predecessor and
successor map and states how open debt is resolved or carried. New successors
still need CRAP goals and MI warning/AUTO-floor assessment. Deleted units keep
history; deletion is not a score of zero. A reintroduced responsibility needs a
lineage check.

### Check relevant gaps

Keep a history of relevant merged observations and human decisions. Do not create
full score records for every prose merge. Before a cumulative decision, check
intervening main updates for changes that could affect the unit, its best
score, its basis or an applicable decision.

Skip a main update only with a recorded no-impact reason. Several such reasons
may share one range record. Inspect each merged change: an unchanged final
diff can hide an improvement followed by a regression. A missing relevant merge
blocks the affected comparison until reconciled. It does not block unrelated
units merely because their records share a folder.

Bind the reviewed content to the actual manual merge. For squash and ordinary
merge commits, record the main parent and resulting commit/tree. A changed commit
hash is acceptable only when content and required evidence are equivalent.
The first automated recorder should support these two merge forms only.
For a rebase merge or an unknown history shape, use explicit human reconciliation
of the integrated range; do not invent measurements for intermediate commits.

A retry with the same record and evidence is a no-op. A conflicting retry fails.
To close a gap or correct a wrong record, append a reviewed supplement with a
new ID. Name the old record, corrected facts, reason and supporting evidence.
If the correction cannot establish a value, keep it unknown. Do not overwrite
the old record or require a product merge just to repair history. Replay affected
accepted observations in order, using the supplement. Recompute anchors and
standing exception bounds or retirement. Keep the evidence that past decisions
used; do not rewrite their history.

### Change the basis deliberately

A threshold or exception change is a policy change; it does not by itself change
measurement units or justify new anchors. A tool, coverage, compiler or runtime
change may change the measurement basis. Review the metrics it affects.

Measuring only new `B/H`, or only the revision that supplied old `A`, is not
enough. A new metric can change which accepted revision had the best score.
Either replay the relevant accepted history to prove the new best values, or
obtain an explicit architect decision on a new basis start and how old debt is
carried forward. Keep the old evidence and any gap. Do not silently reuse
incompatible numbers, erase obligations or reset function age. The first
implementation need not automate this migration.

### Start with one review archive

Keep the full human-readable report at repository-root
`last_code_quality_report.md`, with its diagrams and images as Appendix C defines.
Each PR replaces that file; Git retains previous versions. This report is a
snapshot of review evidence, not the store of accepted best scores.

The owner chooses one durable archive for the separate records below and original
evidence. A local folder outside the product checkout with controlled access and
backup is sufficient for the manual trial. Reference the report and its images by
their Git commit and content hashes; do not require another full copy. No new
service is required. Keep three records separate:

| Record | Contents | Created when |
| --- | --- | --- |
| Assessment | Fixed `B/H`, policy/basis, scope, tests, measurements, triggers, evidence hashes and proposed route. | Before approval. |
| Decision | Human reviewer, decision, scope, expiry and reference to the exact assessment; standing exceptions have their own IDs. | During review. |
| Accepted observation or supplement | Main update/content proof or later verified evidence, assessment/decision references, identities and score/history changes. | After merge, or when resolving a gap or correcting a record. |

Store policy versions, original captures and structural snapshots beside these
records. Give each record a stable ID and a content hash. A record must not
contain its own hash. The frozen assessment binds the final candidate and its
committed report; approval points to that assessment. Merge details go in the
later accepted record. Do not amend the committed report to add approval or merge
facts. A status view may show all three records, but is only a view.

A new capture or revised assessment gets a new ID/hash, even at the same commit.
Use append-only records. Start with one writer; reject concurrent writes and
prove atomic publication, interrupted retry and backup recovery before relying
on automated storage. Historical `docs/metrics/` records remain unchanged.

## 7. The manual PR playbook

Appendix B gives the detailed script calls, returned evidence and decision branches.
Appendix C defines the short PR message and the full report file.

1. **Open a draft and set scope.** State the behavior change and affected units,
   boundaries and contracts. Update from latest main. Use the same exact base
   for all comparisons. Final approval requires a committed candidate.
2. **Run the current selected checks.** For any `src/` change, run `pnpm test`,
   `pnpm run typecheck`, `pnpm run test:build`, and `pnpm run build:user-portal`,
   plus applicable gates. Otherwise use the affected groups/focused tests.
   Follow shared helpers to their users. Do not add `pnpm run check` or expand
   scope through a nested collector. The test gate policy defines conditional
   renderer, container, hosted, signup and live-provider checks.
3. **Finish current review evidence.** Run selected new/changed tests before
   commit. Run habit-hooks on the complete candidate; keep snoozes empty.
   Correct enforced findings or give each retained finding a reason. Update
   affected documents. Run the complete ast-metrics process with permitted
   coverage. Preserve all four sections, both graphs, legends and notices in
   the full report file.
4. **Prepare the proposed assessment.** Confirm numeric scope, comparable `B/H`,
   accepted history and any gaps. Evaluate the numeric and design triggers.
   Fix failures first. Make at most three score-improvement cycles with the same
   base; reselect tests after test edits and replace stale measurements. After
   the last fix, rerun the complete process. Assemble and commit the report and
   images using Appendix C's measured-source and final-candidate sequence.
5. **Finish Ready checks.** The final candidate includes the report and its
   images. Follow the current Ready process. Every Actions job
   that starts for the final head must pass; pending, skipped, cancelled and
   failed are not passes. Return to Draft before a fix after Ready. Permitted
   external-test deferrals must retain their policy basis and missing evidence.
6. **Freeze evidence and get final decisions.** Include the final check outcomes
   before freezing the assessment. Obtain architect review where required and
   owner review in all cases. Earlier design review can guide fixes, but final
   approval names this assessment. Record decisions separately. In shadow mode,
   current rules still determine whether work may proceed.
7. **Recheck and merge manually.** Confirm latest main, candidate, evidence and
   approvals, including relevant history supplements and exception bounds/expiry.
   A relevant change needs a new assessment even if Git commits did not change.
   The owner records any justified reuse of unaffected evidence; the author
   cannot declare approval still valid. The owner merges once.
8. **Record relevant accepted facts.** Check merge equivalence. Append new scores,
   identity changes and decisions. Reconcile missing relevant history before
   it is used for another cumulative decision. Skip no-impact merges as section 6
   permits. Nothing in report generation itself counts as acceptance.

Useful existing commands are below. Replace angle-bracket placeholders. These
commands do not yet implement the proposed cumulative rules.

| Purpose | Command |
| --- | --- |
| Complete report with selected unit collection | `pnpm exec node script/code-quality/ast-metrics-process.ts --base <sha> --collect-coverage` |
| Complete report with an existing verified head capture | `pnpm exec node script/code-quality/ast-metrics-process.ts --base <sha> --coverage <file>` |
| Complete report with normal reuse/no-coverage handling | `pnpm exec node script/code-quality/ast-metrics-process.ts --base <sha>` |
| Canonical unit capture in an authorized revision checkout | `pnpm exec node script/code-quality/ast-metrics-coverage.ts --out <file>` |
| Inspect a file | `pnpm exec node script/code-quality/ast-metrics-mcp.ts file <path>` |
| Enforced smell checks | `habit-hooks --branch origin/main` |

`--skip-coverage` ignores reports; it cannot pass a required CRAP assessment.
Use the pinned environment from the repository (Node 24.20.0 and ast-metrics
0.43.1 at the reference commit). Run coverage and native comparisons sequentially
because a native comparison can temporarily change the checkout. Each command
owns its MCP session; do not start a separate server.

Use this assessment cover sheet as input to the full report in Appendix C.
The final assessment adds the final candidate binding and check outcomes.
Keep later approvals and merge results in their own linked records.

```text
PR and candidate H / tree:
Exact base B / policy version / measurement basis / start P:
Affected units and boundaries; numeric exclusions and reasons:
Selected checks / results / allowed deferrals:

Unit | Metric | Origin | A and source | B | H or bounds | PR decline | Total decline
Trigger | Evidence | Active exception, if any | Proposed action

Design changes: packages, cycles, contracts, trust, resource ownership, policy
Unknowns: affected decisions, repair attempted, follow-up
Proposed route and every retained reason
Full current process report and original evidence references
```

Candidate approval binds that frozen assessment. Standing exceptions instead
follow their explicit reusable scope in section 5. Keep this distinction when a
new PR changes the base.

The native lint baseline remains separate: refresh it only with an allowed
`.ast-metrics.yaml` rule change, commit both together, and review that change
under the prior policy. A candidate cannot pass by approving its own weaker rule.
For a `docs/metrics/` conflict, keep main's immutable record as current rules require.

## 8. Trial, implementation and adoption

Appendix F turns Appendix A into an ordered implementation and documentation
plan. Its proposed interfaces are not available commands.

Use one rollout sequence:

1. **Prove capability and cost.** Before a full inventory, use representative
   cases to establish raw file/class measurements, base/head unit coverage,
   source matching and no-impact scope decisions. Replay available evidence from
   PRs #193–#200 in actual merge order, not PR-number order. Inspect the real
   parent/candidate content. Missing historical evidence stays missing; replay
   grants no retrospective approval. Resolve unsupported required capabilities
   before choosing an enforceable policy.
2. **Run a manual shadow trial.** Choose `P`, record known starting observations
   and explicit gaps, and name the human reviewers. Authorize any needed bootstrap
   or historical captures as measurement work; a prose task does not authorize
   them. Use one archive and the cover sheet for 30 consecutive real PRs, including
   documentation and test changes. Record proposed routes, missed/extra triggers,
   unknowns, review time and evidence cost. A human other than the author checks
   each result; the owner and architect may be the same reviewer.
3. **Implement only the useful support.** After owner approval, apply Appendix A.
   Compare tool results with the human assessments, including all unknowns and
   secondary reasons. Preserve current rules while this runs in shadow mode.
4. **Adopt explicitly.** Require 30 completed trial assessments, a disposition
   for each relevant gap, zero unresolved missed triggers, zero false evidence
   passes, and zero unexplained tool/manual differences where tooling is used.
   The owner must accept the measured review burden; 30 alone proves no threshold.
   Extend or change the trial if needed. Reconcile outstanding history and debt,
   then update `AGENTS.md`, the gate policy, metrics guide and script docs together.

Shadow records describe what actually merged under the current rules, even when
the proposed route was pending or would have required a fix. Record those facts
without claiming proposed-policy approval. They must not block the next trial
assessment. At adoption, decide how unresolved debt is carried forward; do not
invent old approvals or discard accepted gains. Keep `P` and origin history unless
an explicit reviewed transition explains a change.

After adoption, a merge without required review is a process violation. Record
the fact, preserve its evidence gap, and reconcile the affected history and current
debt before issuing a routine result that depends on it. A bookkeeping check must
not erase a real main change just because the required approval was missing.

No phase authorizes automatic approval or merging. Appendix D defines separate
qualification and enablement requirements for the proposed `AUTO_MERGE` route.

Review should protect gains without repeated permission for stable debt.
[DORA](https://dora.dev/capabilities/streamlining-change-approval/) supports peer
review with automation rather than a separate central gate.
[Google's review standard](https://google.github.io/eng-practices/review/reviewer/standard.html)
favors improving code health without requiring perfection.
[ArchUnit's frozen rules](https://www.archunit.org/userguide/html/000_Index.html#_freezing_arch_rules)
separate existing debt from new violations and prevent fixed violations from
returning. These support the direction, not proof of Thermus' numeric 5/85 choices
or permission to waive actual guarantees. Calibrate the useful and false triggers
with independent architect judgments and observed maintenance cost.

## 9. Acceptance criteria

These scenarios specify observable behavior for manual review and future tests.
Assume other required checks pass unless the row states otherwise. Bounds do not
remove separate identity or design obligations.

| ID | Given / When | Required result |
| --- | --- | --- |
| N1 | A new function has CRAP 15, then 15.000001. | The first meets its absolute goal; the uncovered second result needs architect review. |
| N2 | A post-`P` function changes 14.9→15.1; a legacy function reaches 30. | Each uncovered absolute miss needs architect review. Legacy 29.999 remains below 30. |
| N3 | Raw file/class MI is 85; one falls to 84.96 but displays 85.0. | The first meets the AUTO floor; the second is an owner warning and blocks AUTO, not an architect trigger by itself. |
| N4 | Comparable CRAP changes 10→15, or MI 96→91. | Exactly five points in this PR needs architect review despite other absolute conditions passing. |
| N5 | Accepted MI is 96→93, then candidate 90; or CRAP 8→11, then 13. | Uncovered cumulative decline 6 or 5 needs architect review. Ordinary merges did not reset `A`. |
| N6 | MI recovers from 93 to 94 with `A=96`; a rejected candidate once reached 100. | No five-point trigger. The rejected gain is not an anchor. |
| N7 | Accepted CRAP improves 12→8, then candidate 13. | Use best 8; uncovered cumulative decline five needs architect review. |
| N8 | Paths are known as 0, or a new function has 3 paths with no coverage share. | Exact CRAP 0 or bound ≤12 can prove the numeric absolute result. Store no invented share/score. |
| N9 | Paths remain 3 but comparable coverage is missing. | Do not infer no deterioration; the possible score range can cross the five-point rule. |
| N10 | A low-MI unit improves but remains below 85, with no other trigger. | Routine owner review and short reason; no floor waiver; AUTO still requires raw MI≥85 and all other conditions. |
| N11 | A new file starts at MI 44; accepted scores then reach 43, 41 and candidate 38. | Owner review starts its anchor after acceptance. Cumulative decline 6 needs architect review; every score below 85 blocks AUTO. |
| N12 | MI 83 produces a native high finding solely for low MI. | Keep the original status/output, record MI85 `LOW` and owner reason; no retained-high backdoor to architect review. AUTO is blocked. |
| N13 | `A_MI=90`, `B_MI=84`, `H_MI=85`. | MI85 is `MEETS`, but cumulative decline 5 needs architect review. Improvement in this PR cannot cancel that trigger. |
| E1 | A cumulative exception permits MI≥90 with `A=96`. | At 90, show decline 6 as covered; a new base alone does not expire it. It covers no absolute MI-floor condition. |
| E2 | That unit improves to accepted 92, then returns to 90; or its responsibility changes. | Retire the cumulative exception at 92. Return to decline 6 or changed scope needs a new decision; do not revive retired permission. |
| E3 | A standing exception is valid, but this PR declines by 5 or more. | Obtain a decision for this candidate. The standing exception cannot waive it. |
| E4 | Required evidence is unavailable after permitted repair; the architect accepts the scoped gap. | Record `ARCHITECT_REQUIRED / approved` and the unknown. No measured pass or invented anchor. |
| E5 | A failed required test or corrupt capture has human approval. | Keep `FIX_REQUIRED`; that approval cannot permit a pass. |
| E6 | Legacy CRAP has `B=A=42`, head bound `[6,42]`, and a valid absolute exception permits ≤42. | The default `<30` result stays unknown, but the exception covers all possible values and neither decline can reach 5. No numeric decision needs exact head coverage; other obligations still apply. |
| I1 | A unique unchanged function/file/class moves. | Keep proven identity, origin and anchors. A copy instead gets new-unit rules. |
| I2 | Code is split, merged or extracted and correspondence is unclear. | Review the mapping and open debt. Do not divide numeric anchors or silently reset them. |
| I3 | A removed responsibility reappears. | Check preserved lineage/debt; deletion was not CRAP zero. |
| M1 | B/H captures each match their own revision, but tests differ. | Fingerprint differences alone do not prevent a valid same-basis comparison. |
| M2 | Head coverage is unit plus acceptance, or base CRAP was estimated from head. | Neither supplies canonical measured B/H comparison. |
| M3 | Raw class MI is unsupported, or rounded MI straddles 85. | If only the AUTO floor is uncertain, retain an AUTO-only unknown and routine fallback when ordinary evidence suffices. Required decline/CRAP/history uncertainty still follows fix/architect gap rules. |
| M4 | Accepted MI values 100 and 90 become 80 and 110 under a new basis. Only the former best was remeasured. | Do not use 80 as the new best. Replay relevant accepted history or approve an explicit new basis start and debt transition. |
| S1 | Prose or isolated non-unit tests cannot affect metrics. | Record numeric exclusion. Missing unrelated coverage does not itself require review. |
| S2 | Unit tests/shared execution inputs change and production coverage falls. | Assess affected CRAP even though source is unchanged. Do not run extra suites outside scope. |
| S3 | A cycle gains an edge/member with unchanged count, or communities only regroup. | Review actual edges. Cross-package/prohibited/runtime cycles need escalation; local type-only coupling can receive owner review under section 4. Regrouping alone is advisory. |
| S4 | A trust/resource/contract guarantee changes outside `src/`, or policy tightens without such a change. | The first needs architect review. Straightforward tightening can use owner policy approval; both governance and actual contract changes block AUTO. |
| S5 | A required test fails while a new resource owner or architecture/safety finding remains. | Keep every reason. Fixing the test does not clear the other trigger; MI-only high findings remain warnings. |
| S6 | Local extraction preserves responsibility/invariant/lifetime; another change creates a cross-package owner. | Owner review for the first, architect for the second. A common author or CODEOWNERS entry proves neither. |
| S7 | An extension follows a bounded established permission with no consumer work and preserves documented guarantees. | Routine owner review can suffice; it is still a public-contract change and blocks AUTO. An exact old promise cannot be changed by rewriting tests. |
| S8 | A forbidden import is an unambiguous protected violation. | Fix required unless active policy permits a specific architect-reviewed exception. Low MI or another owner reason cannot clear it. |
| H1 | An unrelated prose merge lacks a score record; another missing merge could contain an accepted gain. | Skip the first with proof. Reconcile the second for affected units; a net unchanged diff is insufficient. |
| H2 | A reviewed candidate differs from merged content, or merge form is unsupported. | Do not publish a verified accepted score. Reconcile the actual content/range first. |
| H3 | Publication is retried after interruption with identical or conflicting evidence. | Identical retry is a no-op; conflicting retry fails. Never overwrite accepted history. |
| H4 | New evidence closes a gap or corrects a wrong record without a product merge. | Append a reviewed supplement. Replay affected anchors and exception bounds/retirement in order; retain the old record. Unproved corrected values stay unknown. |
| H5 | A frozen assessment is approved and then merged. | Decisions and merge records reference it without changing its hash. New evidence gets a new assessment. |
| R1 | Main advances or relevant candidate, evidence, history or decisions change after approval. | Reassess candidate approval; independently recheck any standing exception, including its bound and expiry. |
| R2 | A PR merges under current rules while the shadow result is unresolved. | Record actual facts and proposed outcome. Do not enforce shadow rules or invent approval. |
| R3 | A required command selects no tests, skips them, or lacks a required prerequisite. | No proven pass. Repair or retain a deferral only where current policy permits it. |
| R4 | All evidence and decisions pass, including an architecture decision record. | The owner still reviews and merges manually once. |
| R5 | A later PR replaces the report and its images. | An earlier PR's commit link still shows its original report and matching images. The PR contains only the report link, route and short reason for code quality. |
| R6 | Measured source `S` is followed by report commit `H`; an undeclared source, policy, mode or input change appears. | Reject the report-only reuse claim. Reassess the changed candidate. Check the worktree as well as the commit diff. |
| R7 | Final CI and approval occur after report commit `H`. | Bind their outcomes to `H` in separate records. Do not commit those later facts into the report, invent an own-commit hash, or create a repeated report/CI cycle. |
| U1 | Every required check and simplified AUTO condition passes. | Recommend `AUTO_MERGE` in shadow mode; owner review and manual merge still apply. No separately approved recipe is needed. |
| U2 | A bug fix honors an existing contract, adds no behavioral class and meets every other condition; another candidate has unknown AUTO-only evidence. | The proved fix can receive shadow AUTO. The AUTO-only unknown falls back to `ROUTINE_REVIEW` if normal required evidence is sufficient. |
| U3 | Otherwise eligible CRAP rises by 1 within its absolute/cumulative limits, then by 5. | The first is `ROUTINE_REVIEW`; the second is `ARCHITECT_REQUIRED`. AUTO permits no PR decline. |
| U4 | An otherwise eligible candidate has a failed required check, or straightforward policy tightening. | The failure gives `FIX_REQUIRED`; tightening can receive required owner policy review, but governance excludes AUTO. Weakening/bypass or a new tradeoff needs architect review. |
| U5 | A required metric gap remains, or a relevant standing exception covers a miss. | Preserve the existing required-gap route; an exception cannot make the candidate AUTO eligible. |
| U6 | A report-only change includes a hidden executable or undeclared input change. | Reject the output-only proof and reassess under the existing fix/design rules. A report-like name cannot hide a changed input. |
| U7 | Base, relevant history or prior exception evidence changes after classification. | Invalidate the old eligibility result and reassess before any merge. |
| U8 | An audit finds false AUTO eligibility, or the verifier/model/policy changes. | Stop affected automation and requalify the scope; do not retain approval from the old evaluation. |
| U9 | An explicit human hold remains while the route falls back from AUTO to routine. | The hold still blocks merge. Ordinary owner review after a shadow prediction remains required. |
| U10 | A new behavioral class is the only AUTO filter miss, with all ordinary rules satisfied. | Use `ROUTINE_REVIEW`. New class syntax alone is not an architect trigger. |
| U11 | A new internal data holder uses plain field assignments/getters, with no new validation, domain behavior, effects, shared-resource ownership, persistence or public obligation. | The data-only exemption can pass the class filter; every other AUTO condition still applies. |
| U12 | A class has a proved rename/move, or its behavior is rewritten as functions. | Proven continuity is not a new class. A syntax rewrite cannot hide an existing contract, ownership, dependency or lifecycle trigger. |
| U13 | An intentional public contract extends compatibly under a bounded approved extension point. | Routine review can suffice with compatibility proof; AUTO remains blocked. New consumer obligations or changed semantic guarantees need architect review. Internal test-helper export alone is not a public obligation. |
| U14 | A new function passes its absolute goal and all other conditions. | It can receive shadow AUTO. No predecessor score of zero or invented decline is required. |
| U15 | Governance, rule, baseline, approval or evidence policy changes qualify for ordinary owner policy review. | Required owner approval still applies and the author cannot self-approve. Governance blocks AUTO even without an architect trigger. |

## Appendix A. Script reuse and refactor plan

Paths in this appendix are relative to
[`script/code-quality/`](../../script/code-quality/README.md). The map reflects
the reference commit, with exact-snapshot CLI and raw file MI updates in F.8/F.9.
Other proposed operations remain unavailable.

### A.1. Map the ten current commands

| Script | Reuse | Change or removal plan |
| --- | --- | --- |
| [`ast-metrics-process.ts`](../../script/code-quality/ast-metrics-process.ts) | Main entry; four report sections; stage failure handling. | Add structured assessment with MI owner warnings, required triggers and AUTO exclusions, plus full-report assembly and short PR view. Read history but never record acceptance while rendering. Preserve raw output and original command statuses. |
| [`ast-metrics-snapshot.ts`](../../script/code-quality/ast-metrics-snapshot.ts) | Static metrics, source evidence, dependencies, exact-commit CLI and optional raw file MI. | F.8/F.9 record available additions. Assessment raw-reader support and typed class observations remain pending. Preserve the merge-base meaning of `--base` and old snapshot readers. |
| [`ast-metrics-coverage.ts`](../../script/code-quality/ast-metrics-coverage.ts) | Selected-suite collector/importer; own ranges, manifests, process/loader completion and provenance. | Keep. Assessment adds canonical-unit selection and independent own-revision checks. Collection still needs test-scope authorization. |
| [`ast-metrics-crap.ts`](../../script/code-quality/ast-metrics-crap.ts) | Focused scores, exact threshold arithmetic and coverage/split advice. | Keep for diagnosis. Reuse observations in the complete process; add persistent origin, bounds and B/H/A decisions in the assessment owner. |
| [`ast-metrics-delta.ts`](../../script/code-quality/ast-metrics-delta.ts) | Changed TypeScript inventory, MI diagnosis and HTML/OpenMetrics output. | Keep standalone output, including non-production rows. Assessment uses raw observations; it must not parse display text for decisions. |
| [`ast-metrics-review.ts`](../../script/code-quality/ast-metrics-review.ts) | Validates native JSON/Markdown/status; applies approved warnings and import guards. | Keep. Bind evidence to expected base/content and approved policy. Retain native high findings independently of score rules. |
| [`ast-metrics-architecture.ts`](../../script/code-quality/ast-metrics-architecture.ts) | Offline/live maps, import evidence, tables and trends. | Keep views and historical labels. Add measured comparisons separately. Retire its `--record` writer only if the adopted history flow fully replaces that responsibility. |
| [`ast-metrics-mcp.ts`](../../script/code-quality/ast-metrics-mcp.ts) | Bounded tool inspection and file diagnosis. | Keep, including session/version/cleanup controls. No permanent server. |
| [`ast-metrics-baseline.ts`](../../script/code-quality/ast-metrics-baseline.ts) | Native lint-baseline maintenance and ignored counts. | Keep under existing rule-change policy. It does not manage accepted scores or exceptions. |
| [`ast-metrics-backfill.ts`](../../script/code-quality/ast-metrics-backfill.ts) | Optional missing structural history from exact commits, without tests or coverage. | Keep off the required path. Accepted-score history does not replace this capability. Remove only if later usage review establishes it is no longer needed. |

### A.2. Reuse internal owners before adding code

| Existing modules | What to reuse | Important limit |
| --- | --- | --- |
| `process/run.ts`, `process/types.ts` | Stage ordering and failure/goal-miss distinctions. | `{text, passed}` cannot express a review route, a bound proof or human approval. Add a separate typed assessment. |
| `snapshot/commit.ts`, `tree.ts`, `worktree.ts`, `sweep.ts` | Exact static revision analysis and cleanup. | Temporary static checkouts have no dependency installation or coverage run. They do not solve base coverage. |
| `snapshot/input.ts`, `build.ts` | Native file metric parsing and raw file MI preservation beside rounded output. | F.9 adds optional file `maintainabilityRaw`; the architecture reader ignores it. Build a retaining/validating assessment reader and typed class observations separately. |
| `coverage/`, `provenance/`, `architecture/coverage*.ts` | Verified collection, imports and own-tree fingerprints. | Generic compatibility can accept non-unit/union reports. Require exactly canonical unit evidence. Never use permissive native defaults to validate new history. |
| `identity/`, `architecture/*correspondence.ts`, `review/moves.ts` | Conservative declaration/file matching. | Pairwise matching is not persistent origin. Keep ambiguous cases unknown; do not unify distinct file/function move rules into one heuristic. |
| `architecture/crap.ts`, `crap-score.ts`, `crap/goals.ts`, `advice.ts` | Score joins, exact comparison, bounds and advice foundations. | Add sound upper/difference bounds and lasting origin rules. `crap-snapshots.ts` base estimates must stay outside measured decisions. |
| `delta/`, `dependencies/`, `review/layer-tree.ts`, `layers.ts` | Changed paths, parsed import kinds, resolution issues and current guards. | Resolver coverage is limited; `#` aliases and bare external dependencies are not a complete package model. New affected-boundary checks must retain uncertainty. |
| `architecture/component-*`, `community-*`, `trend-*`, renderers | Maps, historical labels and displays. | Internal edges are omitted from the component display. Use a separate file/logical-package graph for cycle decisions; the last ten trends cannot provide anchors. |
| `architecture/main-history.ts`, `trend-store.ts`, `trend-lock.ts` | History enumeration and no-overwrite publication patterns. | Old same-commit publication keeps the first record even if new data differs. New accepted storage must reject conflicts. Local locking does not imply multi-host support. |
| `shared/` and native review readers | Git/tool checks, ordering and file diagnostics. | New schemas must reject missing identities and non-finite numbers. Bind expected revisions; a well-formed SHA alone is not enough. |

### A.3. Smallest useful target

Keep measurement, assessment and storage separate:

- Existing collectors produce one verified observation bundle for reuse in the
  process. Native review remains its own validated operation. Reuse must include
  all evidence needed by current consumers, including changed non-`src/` rows.
- One assessment owner takes observations, trusted policy, relevant history and
  human design declarations. It returns values/bounds, every trigger, covered
  exceptions and the route. Keep calculations free of Git, tools and archive writes.
- One history owner stores accepted observations, decisions and supplements.
  Use the manual archive first. Add an `ast-metrics-history.ts` command only when
  the trial shows the need. Proposed operations are `init`, read-only `verify`,
  and `record` for an accepted main update or a reviewed supplement.

A separate boundary module is justified when the graph rules need it. Reuse the
existing parser; do not create a general rules engine, storage framework or file
for every condition. Apply DRY3 and the [coding principles](../coding-principles.md).

Assessment JSON stores the computed result; Markdown is its view. Version the data
formats, keep raw evidence references and structural snapshots, and bind native
results to expected B/H/content. A zero command exit is never human approval.
Current command status contracts remain unchanged during shadow use.

### A.4. Implementation slices

These slices follow the trial and owner authorization in section 8. Reuse existing
tests. Add characterization only where preserved behavior is affected. For new
behavior, write the failing BDD case first, use TDD for its pieces, and refactor
with tests green.

| Slice | Deliverable | Exit criteria |
| --- | --- | --- |
| 1. Comparable observations | Raw supported MI/class data; exact revision input; independent canonical B/H coverage; reusable bundle. | M1–M4 and scope cases pass. Preserve old readers, own-characters-1 precision, source-completeness checks, constant-module handling, standalone HTML and input-change detection. Unsupported capability is explicit. |
| 2. Review assessment | Pure required numeric rules, MI85 states/owner warnings, cumulative/CRAP exceptions, boundary/cycle decisions and human declarations. | N1–N13, E1–E6, I1–I3, M1–M4 and S1–S8 pass. Preserve all reasons and never substitute estimates or unknown identities. MI-only high findings cannot reintroduce an architect floor. |
| 3. History support, if needed | Persistent origin/best observations, sparse history verification, merge proof, supplements and one-writer publication. | H1–H5 pass, including interruption, conflicting retry, backup restore and unsupported merge forms. No unrelated prose record is required. |
| 4. Process integration | Assessment JSON; full tracked Markdown report and images; short PR view; final candidate and archive references. One AUTO predicate checks raw MI85 and governance exclusions even where owner review suffices. | R1–R7 and U1–U15 pass. Tool/manual results agree, including unknowns and owner warnings. Shadow mode does not enforce proposed routes or enable merging. |
| 5. Adoption and cleanup | Approved policy/docs, one owner for each adopted responsibility, removal of proven duplicate paths. | Trial exit criteria pass. Manual merge remains required. All remaining callers, help, tests and documents agree. |

### A.5. Remove only what is replaced

| Removal candidate | Required replacement or proof |
| --- | --- |
| Repeated head measurements inside the full process, such as separate CRAP MCP reads. | Equivalent verified bundle data and preserved failure behavior. Standalone commands still collect what they need. |
| Head-derived base CRAP in a decision path. | Independent B/H measurements or sound bounds. Keep legacy estimate calculation while current report callers still require it, and keep stored estimates labelled. |
| Automatic base publication through `prepareArchitecture().publish()` and the process; optional Architecture `--record`. | Remove only after owner adoption explicitly chooses accepted-history snapshots as the future trend source. Preserve required graph/trend fields and old record readers. Until then these writers still implement current policy. |
| Dead helpers or duplicate policy logic left after migration. | Actual callers have moved to the correct owner; retained behavior and relevant tests still pass. |

Backfill, MCP diagnosis and lint-baseline maintenance are not duplicates of the
new assessment. Command count is not a cleanup goal. Keep coverage seals, loader
checks, provenance, native findings, existing guards, both graphs and historical
readers. Never delete or rewrite old metric records to make the new plan fit.

Any command removal must update callers, [knip.json](../../knip.json), the
[module-path registry](../../test/support/processes/module-paths.ts), help,
command docs, test inventories and governing instructions in the same change.
Port tests for surviving behavior; remove only explicitly retired contracts.
Do not leave a success-returning stub.

For script-only refactors, run affected focused tests and applicable live
contracts under the existing gate policy. A collector test still needs separate
scope eligibility; otherwise record it as deferred. Use disposable archives and
checkout fixtures. Doubles cannot prove a real pinned-tool capability. Keep the
[documentation contract](../../test/acceptance/script/script-readme.test.ts)
and its [driver](../../test/support/drivers/script-documentation.ts) current.

## Appendix B. Step-by-step review of a new PR

**Start: we have a new PR to review.** Follow the steps below on that PR.
Use the existing commands today. Perform the proposed assessment by hand during
the trial. Build the support named below only after owner authorization.
There is no new script for each step.

In command examples, replace `<B>` with the exact base commit and replace file
placeholders with real paths. `B` and `H` below name revisions; their metric
values are the scores at those revisions. `A` is the best accepted score for
one unit and metric. Keep the current report and the proposed assessment separate.

### B.1. Identify the candidate and the active rules

**Do:** Confirm the PR is Draft while the author prepares or fixes it. Record its
number, author, target branch, shadow/adopted mode, policy version, measurement
basis and start commit `P`. Use the approved policy; a PR that edits the policy
cannot grant itself a weaker rule.

**How:** Use Git and the PR interface; no new metrics script is needed.

```sh
git fetch origin
git rev-parse origin/main
git rev-parse HEAD
git status --porcelain
git merge-base <B> <H>
```

Update the candidate from latest main first. Record that main commit as `B`.
The merge base must equal `B`; otherwise the current commands can compare
different trees. Include staged, unstaged, new, deleted and moved files during
preparation. Final evidence must describe a committed `H`.

**Get:** One candidate record: PR, `B/H`, content identity, mode, policy/basis and
any unfinished edits.

**Next:** An outdated branch or mismatched checkout needs repair. If policy
startup is incomplete, record that gap; do not invent `P` or reset history for
this PR. Shadow gaps do not replace current merge rules.

### B.2. Select tests and the units to assess

**Do:** Make two lists: required checks, and affected score/design units.
Include both paths of a move and the consumers of changed helpers or fixtures.

**How:** Use the existing [test gate policy](test-gate-policy.md) and
[test layout](../testing/test-code-layout.md). Test selection is manual today.
The future assessment can store the selection and its reasons.

| Change | Existing command selection |
| --- | --- |
| Any `src/` path | `pnpm test`, `pnpm run typecheck`, `pnpm run test:build`, `pnpm run build:user-portal`, plus applicable production gates. |
| No `src/`; ordinary unit, integration, acceptance or interface tests | The affected `pnpm run test:unit`, `test:integration`, `test:acceptance` or `test:interface` groups. Combine affected groups. |
| Separate build test, or dedicated runtime/live/container test | Its dedicated command from the gate policy. For example, the build test selects `pnpm run test:build`, not the unit group. |
| Shared test support | The groups of its real consumers, subject to the dedicated gate rules. |
| Scripts, configuration or other files outside `src/` and `test/` | Their existing focused tests. Combine this with any test groups selected by other changes. |
| Prose with no executable behavior affected | No executable test is needed; record why. |

Select conditional renderer, container, hosted and provider gates from the
policy's path rules. Do not add `pnpm run check`. Apply the nested-run limit to
commands and tests that start another suite.

For numeric scope, start with changed production units. Add unchanged units whose
coverage or measurements can change through the PR's tests, helpers, dependencies
or build inputs. Inspect semantic changes across the full PR. A numeric exclusion
does not exclude design review.

**Get:** A check list with commands and prerequisites; an affected-unit list;
and reasons for exclusions or uncertain impact.

**Next:** Uncertain impact needs investigation or a wider affected set. It does
not authorize a wider test suite. Missing unrelated coverage is not a trigger.

### B.3. Run the selected checks

**Do:** Run the selected tests and build checks. Run each selected new or changed
test before commit, using the focused commands in the gate policy. Complete
the document updates and check the complete candidate for enforced smells.

**How:** Use the commands selected in B.2 and:

```sh
habit-hooks --branch origin/main
```

Use the repository's pinned environment. Keep the habit-hooks snooze file empty.
Confirm that each selected test actually ran. Keep permitted external or nested
test deferrals with their policy reason; a deferral is not a pass.

**Get:** Command, revision/content, result, test selection, log and any retained
finding or permitted deferral.

**Next:** Failed required tests, failed operations and repairable omissions mean
`FIX_REQUIRED`. Correct enforced smells or state why each is retained. A retained
new or worsened enforced finding also enters design review in B.8.

### B.4. Run the existing complete metrics process

**Do:** Collect the current required report once. Choose coverage from B.2,
not from the desired score.

**How:** `ast-metrics-process.ts` **exists**. Choose one invocation:

| Situation | Existing command |
| --- | --- |
| `src/` changed; a compatible head capture is available | `pnpm exec node script/code-quality/ast-metrics-process.ts --base <B> --coverage <head-coverage-file>` |
| `src/` changed; no compatible capture | `pnpm exec node script/code-quality/ast-metrics-process.ts --base <B> --collect-coverage` |
| No `src/` change | `pnpm exec node script/code-quality/ast-metrics-process.ts --base <B>` |

For no `src/` change, the normal command reuses compatible coverage if present.
Collection is permitted only if both complete unit parts are selected anyway.
If collecting, use one collection path, not both the process collector and a
second standalone collection. `--coverage`, `--collect-coverage` and
`--skip-coverage` are mutually exclusive. `--out` on this command changes the
Markdown destination, not the coverage destination.

**Get:** `ast-report/process.md`: delta, review, CRAP and architecture. Keep the
native review JSON/Markdown, captures and other referenced evidence too.
Read all findings in JSON; the displayed review list is capped.

**Next:** Interpret the detail, not just the exit code:

| Current result | Action |
| --- | --- |
| Tool failure, malformed evidence or failed publication | Repair it. An old output file left by a failed run is not a new result. |
| Completed score miss | Keep the measured value and reason for B.7/B.9. Exit 1 does not itself prove tool failure. |
| CRAP marked `goal miss` with unknown identity or coverage | Keep the unknown; the stage label does not prove a measured miss. |
| Empty production selection or report without coverage | Check B.2. This does not assess indirect score effects on unchanged production units. |
| Architecture stage passed | The report rendered. Check design separately in B.8. |

The process can create the current base record in `docs/metrics/`. Follow current
rules for committing that file and updating `H`. It does not update accepted
best scores. After the last fix, run the complete process again and paste its
report without changes into `last_code_quality_report.md`, including both graphs
and notices. Appendix C defines the full file and the short PR message. The new
writer and corresponding instruction changes still need implementation.

### B.5. Obtain comparable base and head observations

**Do:** For each numeric unit in scope, obtain actual `B/H` observations or
sound bounds. Skip this work when B.2 proved numeric comparison unnecessary.

**How:** Reuse valid captured evidence first. These snapshot commands **exist**:

```sh
pnpm exec node script/code-quality/ast-metrics-snapshot.ts --commit <B> --out <exact-base-snapshot-file>
pnpm exec node script/code-quality/ast-metrics-snapshot.ts --base <B> --out <base-snapshot-file>
pnpm exec node script/code-quality/ast-metrics-snapshot.ts --out <head-snapshot-file>
```

The first captures exact B, given as a full lowercase 40-hex commit SHA. It cannot
be combined with `--base`. The second captures the merge base, so B.1's ancestry
check is required. The third captures the working tree. All provide structural
evidence and rounded MI, plus optional raw file MI when the native report provides
it, without building, testing or collecting coverage. F.9 defines unavailable
raw values. The assessment reader and typed class observations remain **to build**;
keep their relevant gaps visible.

For CRAP, use only canonical unit evidence. A base capture must describe `B`;
head coverage must not stand in for it. In an independently authorized checkout
of the required revision, these commands **exist**:

```sh
pnpm exec node script/code-quality/ast-metrics-coverage.ts --out <coverage-file>
pnpm exec node script/code-quality/ast-metrics-coverage.ts --from <capture-directory> --out <coverage-file>
```

Choose collection or import. Import validates against the current checkout, so
import base evidence at `B`. Collection needs the correct dependencies/build
environment and selected complete unit suite. A static snapshot's temporary
checkout does not provide that environment. Do not use `--allow-unverified` to
make evidence eligible.

Validate each capture against its own revision. Then require the same measurement
basis and exactly the two unit parts, without integration/acceptance coverage.
Different base/head test fingerprints can be valid. Reuse must prove the inputs
still match; file existence alone proves nothing. Serialize coverage and native
comparisons in a checkout. Each command manages its own MCP server.

**Get:** Per-unit paths, identity evidence, raw MI or an explicit gap, canonical
coverage shares, calculated CRAP or bounds, source revisions and evidence hashes.
The reusable typed observation bundle is **to build**.

**Next:** Repair invalid or stale inputs. If required evidence remains unavailable
within permitted scope, carry the specific gap to B.7/B.9. Do not run unselected
tests or use old head-derived base estimates to fill it.

### B.6. Read origin, accepted gains and exceptions

**Do:** Find the unit's origin, actual predecessor at `B`, best accepted score
`A`, and applicable human decisions. Check all relevant main updates since the
last verified history point.

**How:** Read the manual archive from section 6 and inspect Git/PR history.
There is **no existing accepted-score history command**. If the trial justifies
automation, build `ast-metrics-history.ts` with the proposed read-only `verify`
operation. Initialization is a policy setup action, not a step that resets each
PR's anchors. These are proposed operations, not runnable CLI examples.

Apply supplements in order. Check each intervening merged change, even if the
net diff is empty. Preserve moves, copies, removals and reintroductions correctly.
For a changed measurement basis, use section 6's replay or reviewed transition.

**Get:** A stable unit ID; pre/post-`P` origin; `A` and its source evidence;
verified history coverage; current exception bounds/expiry; and unresolved gaps.

**Next:** Skip unrelated history only with a no-impact reason. Reconcile repairable
relevant gaps. Ambiguous lineage or unavailable relevant history needs a decision
if it can change the result. Never call an uncertain unit new merely to reset `A`.
A genuinely new unit has no prior `B/A`; check its CRAP goal or MI85 state.

### B.7. Evaluate every numeric threshold

**Do:** Compare raw values for each affected unit, without rounding first.
Check required CRAP, PR and cumulative rules independently. Record MI85
separately as an owner warning/AUTO condition, not an architect absolute gate.

**How:** Calculate by hand during the trial. A pure assessment owner, called by
the extended process, is **to build**. The current scripts do not calculate these
complete `B/H/A` decisions.

| Rule | No trigger from this rule | Architect trigger |
| --- | --- | --- |
| Function introduced after `P`, including later edits | `CRAP_H ≤ 15` | `CRAP_H > 15` |
| Function present at `P` | `CRAP_H < 30` | `CRAP_H ≥ 30` |
| CRAP decline in this PR | `CRAP_H − CRAP_B < 5` | Difference `≥ 5` |
| MI decline in this PR | `MI_B − MI_H < 5` | Difference `≥ 5` |
| Cumulative CRAP decline | `CRAP_H − CRAP_A < 5` | Difference `≥ 5` |
| Cumulative MI decline | `MI_A − MI_H < 5` | Difference `≥ 5` |

The absolute CRAP rule follows persistent origin, not just whether this PR adds
the function. MI has no function gate and CRAP has no class aggregate gate.
No average, green graph band or improvement elsewhere can cancel a trigger.
Current native findings remain a separate input to B.8.

Use `PASS`, `MISS` or `UNKNOWN` for required numeric comparisons. Record
`NOT_APPLICABLE` with a reason when the rule does not apply. For example, a proven
new unit has no PR or cumulative comparison yet. With a valid score interval
`[L,U]`, the entire interval must prove the result:

| Required result | Proven pass | Proven miss |
| --- | --- | --- |
| CRAP ≤15 | `U ≤ 15` | `L > 15` |
| CRAP <30 | `U < 30` | `L ≥ 30` |
| Decline <5 | `U < 5` | `L ≥ 5` |

Any remaining case is unknown. Exact values have `L=U`. For `X−Y`, use
`[X_low−Y_high, X_high−Y_low]`. Use `[p,p²+p]` for CRAP only when paths are known
and coverage is unknown. Invalid numbers are errors, not bounds. A numeric
proof does not resolve separate identity or history obligations.

For each production file/class separately, record MI85 as `MEETS`, `LOW`,
`UNKNOWN` or `NOT_APPLICABLE` with a reason. Exact/raw MI≥85, or interval lower
bound ≥85, is `MEETS`; interval upper bound <85 is `LOW`. Other intervals are
`UNKNOWN`. `LOW` needs a short owner reason and blocks AUTO; `UNKNOWN` solely
for this floor also blocks AUTO but does not itself need architect review.
Unknowns that can change a required decline/CRAP/history decision still follow
the gap rules. No new class-history rule is silently removed.

For each CRAP absolute or MI/CRAP cumulative `MISS` or `UNKNOWN`, check a standing
exception's named conditions, unit, basis, responsibility, expiry and current bound.
The entire score interval must comply with it: CRAP upper bound ≤ its ceiling,
or MI lower bound ≥ its floor. A valid exception marks that reason **covered**.
Keep the original miss or unknown visible; coverage by an exception is not a
measured pass. If the exception settles every possible outcome, that unknown
does not itself need a new decision. A PR decline ≥5 always needs a candidate
decision; an exception cannot cover uncertainty about that decline either.

**Get:** Per-unit `B/H/A` or bounds, origin, required comparison results, separate
MI85 state, owner warnings, source evidence and covered/uncovered reasons.

**Next:** Send uncovered required misses and decision-relevant unknowns to B.9;
send MI85 `LOW` and permitted finding reasons to owner review. A valid bound that
settles a decision does not require an exact score for its own sake.

### B.8. Check design and policy changes

**Do:** Apply section 4's design rules to the full PR, even if every score passes.

**How:** Reuse native review, existing import guards, selected boundary tests,
source/import snapshots and manual diff review. Run no additional suite merely
because it is named here. Assessment support for affected logical packages,
actual cycle changes and recorded human declarations is **to build**.

| Finding | Action |
| --- | --- |
| New logical package, cross-package responsibility/owner or unapproved direction | Architect decision. Local same-owner extraction/wiring alone is ordinary owner work. |
| Unambiguous protected violation | Fix required unless active policy permits a specific architect-reviewed exception. A numeric exception cannot cover it. |
| New cross-package/prohibited/runtime cycle or material build consequence | Architect decision; any separate failed required check still takes fix priority. |
| Local cycle in one approved logical package, no prohibited edge, no runtime cycle after type erasure | Owner coupling reason and proof; keep source edges visible. No automatic AUTO permission. |
| New boundary, new consumer obligation or changed established semantic guarantee | Architect decision. A bounded compatible extension with proof/no consumer work can be routine, but every actual contract change blocks AUTO. |
| Changed admission/refusal, trust, permissions or sensitive-exposure limits | Architect decision. Repair honoring the existing promise can be routine. |
| Changed runtime owner/lifetime/shared state, consistency or cancellation/cleanup guarantee | Architect decision. Same-owner repair/extraction preserving guarantees can be routine. |
| Changed measurement basis/meaning, weakening/bypass, approval authority or material tradeoff | Architect decision. Equivalent implementation/clarification/straightforward tightening needs owner policy approval. Governance changes always block AUTO. Historical corrections use section 6. |
| Retained architecture/safety finding or unresolved design tradeoff | Correct it or obtain a policy-permitted specific architect decision. |
| Low-MI-only native high or policy-permitted style/size/comment finding | Owner warning/reason; preserve original output/status. Do not demote unrelated high findings. |
| Relevant boundary or dependency cannot be established | Investigate; retain an explicit gap if unresolved. |

Compare cycle edges and members, not just counts. Do not infer that an existing
import is approved merely because it is on main. The current review command can
report high findings with exit 1; distinguish that from a tool failure.
Score-only MI disposition does not turn exit 1 into an operation pass or change
current AGENTS requirements. Missing MI solely for AUTO85 is not a required
architect gap; missing evidence that can change a retained decision is.
Refresh the lint baseline only for the rule changes permitted by current policy.

**Get:** Design declarations and findings, with evidence, affected boundaries,
retained reasons and required decisions.

**Next:** Add all reasons to the numeric results. A score pass never clears a
design trigger.

### B.9. Choose the route and complete repairs

**Do:** Keep every reason, then choose the route in this order:

1. Required check failure, pending work, invalid evidence or repairable omission:
   `FIX_REQUIRED`.
2. Otherwise, any uncovered numeric/design trigger or decision-relevant gap
   unavailable after permitted repair: `ARCHITECT_REQUIRED`.
3. Otherwise, no AUTO exclusion applies and every Appendix D condition is proved:
   `AUTO_MERGE`, as a shadow recommendation with manual execution.
4. Otherwise: `ROUTINE_REVIEW`. Missing AUTO-only evidence is not itself a
   required measurement gap or permission to widen the test selection.

**How:** Manual classification today; structured JSON/Markdown assessment is
**to build** in the process. For a score problem, reuse these existing diagnostics
as needed. Do not rerun every command automatically.

| Need | Existing command |
| --- | --- |
| Inspect a low or uncertain file metric | `pnpm exec node script/code-quality/ast-metrics-mcp.ts file <path> --json` |
| Recheck file MI after a fix | `pnpm exec node script/code-quality/ast-metrics-delta.ts --base <B>` |
| Inspect selected function scores and coverage advice | `pnpm exec node script/code-quality/ast-metrics-crap.ts --base <B> --coverage <head-coverage-file> <path>` |
| Inspect native findings independently | `pnpm exec node script/code-quality/ast-metrics-review.ts --base <B>` |

**Get:** The proposed route, all its reasons, covered exceptions and a repair
list or specific questions for the architect.

**Next:** Repair failures. For score improvement, try at most three cycles with
the same base. Each edit refreshes `H` and its content identity, returns to B.2,
replaces affected stale evidence and requires the final complete process.
If main advances, restart B.1 with the new base. Keep the attempt log.
Three attempts do not waive a failed test or tool failure. Do not change
diagnostic thresholds to claim policy compliance.

After the attempts, retain each unresolved score, bound or gap and its reason.
Current rules permit Ready with recorded goal exceptions; shadow results remain
advisory. In shadow mode, a repairable gap found only by the proposal does not
block progress under current rules. Record it even if it cannot be repaired
during the trial. After adoption, the retained proposed triggers require the
repairs or decisions specified here. Early architect advice can guide repairs;
final approval follows B.10 and B.11.

### B.10. Finish checks on the final candidate

**Do:** Complete current before-Ready requirements, commit the complete candidate
including the full report, images and any verified B companion, and confirm the
evidence matches it.
Use Appendix C's proof to reuse measurements from the preceding source commit.
Mark the PR Ready, then wait for every Actions job that starts for `H`.

**How:** Use the existing PR/Actions interface and current gate policy. No new
metrics script is needed. Reuse a completed check only when its input identity
and policy make it valid for this candidate.

**Get:** Final `H`, current report, local results, all started job outcomes and
any policy-permitted deferrals.

**Next:** A pending, skipped, cancelled or failed started job is not a pass.
Return to Draft before a fix, then repeat the affected earlier steps. Confirm
the final committed `H` and replace evidence invalidated by a changed input.
Update the reasons and route with the final check results before freezing;
do not carry an earlier pending-check result into a completed assessment.

### B.11. Freeze, approve, recheck and merge manually

**Do:** Freeze the assessment with the final check outcomes. Record its ID/hash.
The architect decides any required matters; the owner reviews every PR.

**How:** Use separate assessment and decision records in the manual archive.
Future process output can generate the assessment, but cannot approve it.
Bind the final `H`, report/image hashes and final checks in that assessment.
Each decision references its exact hash. Store new standing exceptions
separately with their bound, scope and expiry. Do not change the report commit
to add those later facts. The PR shows only its report link, route and short reason.

**Get:** `ROUTINE_REVIEW` or shadow `AUTO_MERGE` with owner approval, or
`ARCHITECT_REQUIRED / approved` with the necessary architect and owner decisions.
A rejected or pending decision does not permit merge under the adopted policy.
In shadow mode, keep the actual proposed route, including unresolved
`FIX_REQUIRED` results, while current rules determine whether merge is permitted.

Immediately before merge, recheck latest main, `H`, policy/basis, check results,
relevant history/supplements and the prior exceptions used in the assessment.
Recheck their bounds and expiry. A changed input requires an updated assessment
and review of its approval, even when Git commits did not change. Record
justified reuse of unaffected evidence. F.5 distinguishes source/report
regeneration from a new FINAL assessment that reuses the valid source snapshot.

Separately verify that the required candidate decisions are present, current and
approved. Adding those decisions does not change the frozen assessment. A new
exception granted for this candidate is part of its decision evidence; a change
to a prior exception relied on by the assessment is a changed input.

**Next:** When current rules and, after adoption, this plan permit it, the owner
merges manually **once**. There is no automatic approval, auto-merge setting or
scripted merge in this flow.

### B.12. Record what actually reached main

**Do:** Identify the resulting main update `M`. Verify that its content and
required evidence correspond to the reviewed candidate before treating its
measurements as accepted.

**How:** Compare Git content and PR merge evidence. Append to the manual archive.
The proposed history `record` operation is **to build only if needed**. It must
support squash and ordinary merge commits first; reconcile rebased ranges
manually as section 6 requires.

For each relevant accepted unit with exact evidence:

```text
CRAP anchor = min(previous anchor, accepted CRAP)
MI anchor   = max(previous anchor, accepted MI)
```

A new unit starts with its first exact accepted score. Preserve unknowns and
bounds without turning them into exact anchors. Tighten a standing exception's
bound on accepted improvements; retire it when its waived conditions all pass.
Record no-impact skips instead of full score records for unrelated prose merges.

**Get:** An accepted observation with merge/content proof, source evidence and
assessment/decision links. Later corrections use new reviewed supplements.
History publication is separate from the current `docs/metrics/` base writer.

**Next:** An identical retry is a no-op; conflicting evidence is an error.
If merge proof or publication fails, preserve the real merge fact and reconcile
the affected history before a later comparison uses it. Never merge again to
repair bookkeeping. In shadow mode, record actual current-rule merges without
inventing proposed approvals.

### B.13. Pseudo algorithm

The names below describe planned operations, not existing commands or flags.
Run the manual steps above until their automation is approved and built.

```text
review(PR):
    keep the attempt log across repeats
    repeat preparation after each relevant change:
        candidate = identify_PR_base_head_policy_and_mode(PR)         # B.1
        scope, selected_checks = select_checks_and_affected_units()   # B.2
        check_evidence = run_or_validly_reuse_selected_checks()        # B.3
        source = verify_clean_committed_S()                           # C.5
        current_report = run_complete_process_once_at_S()             # B.4
        observations = obtain_valid_B_H_values_bounds_and_gaps(scope)  # B.5
        history = verify_relevant_origins_anchors_and_decisions()      # B.6

        numeric_reasons, owner_warnings = assess_required_rules_MI85() # B.7
        design_reasons, policy_flags = assess_design_owner_policy()   # B.8
        reasons = keep_all(check_evidence, current_report,
                           observations, history,
                           numeric_reasons, owner_warnings,
                           design_reasons, policy_flags)
        auto_facts = assess_AUTO_eligibility(candidate, evidence,
                                            history, reasons,
                                            policy.scope)           # D
        route = classify_FIX_ARCHITECT_AUTO_else_ROUTINE(reasons,
                                                        auto_facts) # B.9

        if current rules, or adopted rules when active, require repair:
            return work to author; preserve reasons and attempt count
            resume preparation after the change
        else if a score improvement is selected and attempts remain:
            make the improvement; record the attempt
            resume preparation after the change
        otherwise:
            retain every miss, covered exception and relevant unknown
            finish preparation

    if prepared measurements or check evidence do not match source:
        restart preparation at source
    # Assemble from the completed S analysis; no preliminary B-record process run.
    full_report, images = assemble_final_snapshot_at_S(source,
                                                       evidence,
                                                       reasons, route,
                                                       auto_facts)
    candidate.H = commit_report_images_and_verified_B_companion(source,
                                                               full_report, images)
    reuse_proof = verify_declared_S_to_H_outputs_and_unchanged_inputs()
    if reuse_proof is invalid:
        restart preparation with the changed input
    validate_report_images_and_links_at_H()
    publish_short_PR_link_route_and_reason(candidate.H, route, reasons)

    final_checks = finish_local_then_Ready_then_head_Actions()         # B.10
    if a required check is not satisfied:
        stop before approval; resume the affected earlier step
    candidate = verify_final_committed_head_and_content(candidate)
    if a changed input invalidates evidence:
        use F.5: regenerate source/report or reuse source for a new FINAL
    reasons, route = refresh_results_with_final_checks(reasons,
                                                       final_checks)
    auto_facts = assess_AUTO_eligibility(candidate, evidence, history,
                                        reasons, policy.scope)
    route = classify_FIX_ARCHITECT_AUTO_else_ROUTINE(reasons, auto_facts)

    refresh_short_PR_route_and_reason(route, reasons)
    assessment = freeze(candidate, source, reuse_proof,
                        report_and_image_hashes, evidence, history,
                        reasons, route, auto_facts, final_checks)    # B.11
    decisions = obtain_required_human_decisions(assessment.hash,
                                                candidate.mode)
    if required decisions are pending, rejected or no longer valid:
        stop before merge; resume B.11 for decisions, B.1 for changes
    if any relevant assessment input changed before merge:
        use F.5 retry branch; obtain decisions for the new assessment

    assert all current requirements are satisfied
    assert adopted requirements are satisfied when adoption is active
    assert execution is MANUAL, including an AUTO_MERGE shadow route
    owner manually merges once
    record_actual_main_update_and_verify_content()                    # B.12
    append_accepted_evidence_or_explicit_gap()
    update_best_scores_and_exception_bounds_from_valid_accepted_facts()
```

## Appendix C. Short PR message and full report file

The PR gives the decision at a glance. The full evidence lives in the tracked
file `last_code_quality_report.md` at the repository root. Each PR replaces that
file and its generated images; Git history retains the earlier versions.
This is the selected output design. The report assembly and image export still
need implementation; current scripts do not produce this complete layout.

### C.1. What appears on the PR

The code quality section contains exactly three items:

1. One link to `last_code_quality_report.md` at the commit being reviewed.
2. One route: `FIX_REQUIRED`, `ARCHITECT_REQUIRED`, `AUTO_MERGE` or
   `ROUTINE_REVIEW`.
3. One short paragraph with the main reasons and next action.

Use a GitHub commit permalink:
`https://github.com/<owner>/<repo>/blob/<report-commit>/last_code_quality_report.md`.
Use the actual full commit SHA. Do not link to the moving `main` branch or a
branch name; a later PR must not change the report an earlier reviewer sees.

This is the complete code quality message for a fictional PR:

[Full code quality report][c-report]

**Review route: `FIX_REQUIRED`**

Type checking failed and build-test evidence is missing. After those repairs,
architect review is still needed for the CRAP increase and moved parser
responsibility. This is a shadow assessment; current rules govern the manual merge.

Do not put score tables, graphs, images, logs, detailed findings, exceptions or
the full process output in the PR body. They belong in the linked file.
Human reviews remain separate review/decision records. If approval is relevant
to the short reason, mention it there without adding another report section.
Approval keeps the route `ARCHITECT_REQUIRED`; it does not turn it into
`ROUTINE_REVIEW` or `AUTO_MERGE`. Both routine and shadow AUTO results still
require owner review and manual merge. An AUTO reason must say that it is a
shadow recommendation with manual execution; Appendix D gives an example.

### C.2. Structure of `last_code_quality_report.md`

The file is a complete snapshot of the analysis and available evidence at the
measured source commit `S`. The final candidate `H` also contains this report and
its images. C.5 defines how to bind them without making the report refer to its
own commit or creating a repeated report/CI cycle.

| File section, in order | Contents |
| --- | --- |
| 1. Review result | Mode, report ID, measured source `S`, route at report generation, short reason and every retained fix/architect reason. State whether the snapshot is complete or still in preparation. Execution stays `MANUAL`, including shadow AUTO. |
| 2. Candidate and scope | Exact base `B`, measured `S`, source/input identity, policy/basis/start `P`, changed and indirectly affected units, design boundaries and numeric exclusion proofs. |
| 3. Selected checks | Commands, actual run revisions, results, logs, valid reuse proofs and permitted deferrals. Separate a failed operation from a completed score miss. |
| 4. Numeric results | Per-unit origin, `A` and source, `B/H` or bounds, required CRAP/decline outcomes and separate MI85 states/owner warnings. Keep thresholds explicit. |
| 5. Design findings | Boundaries, guarantees, source cycles, owner policy approvals and AUTO governance/contract exclusions, with evidence and required decisions. |
| 6. Exceptions, gaps and AUTO eligibility | Prior exceptions, current bounds/expiry/scope, covered misses, decision-relevant unknowns, attempted repairs, history coverage and follow-up owners. Include policy/scope IDs, every AUTO condition and its evidence, failed/unknown conditions, candidate proof and recovery owner. No recipe ID is required. |
| 7. Diagrams and images | Embedded community/component images and every available trend chart, with captions, legends and evidence limits. Preserve their Mermaid sources in the complete process output. |
| 8. Complete process output | The entire final `ast-report/process.md` without changes: all four sections, Mermaid graphs, legends, import evidence and notices. A surrounding expandable section is allowed. |
| 9. Evidence index and later records | Durable references and hashes for original evidence, plus stable catalogue links for the final assessment, final-head checks and human decisions. State which records did not yet exist at generation; do not edit the snapshot later to add them. |

For a PR with no numeric impact, use `NOT_APPLICABLE` and its exclusion proof
instead of an empty score table. Do not request unused captures or invent values.
Keep every relevant design reason. Later CI, approval and merge facts are separate
records; the file does not claim facts that occurred after its generation.

### C.3. Example content inside the full file

All names, numbers, IDs and links below are **fictional sample data**.
`example.invalid` links are placeholders. This is a preparation snapshot with
incomplete checks, not a frozen final assessment or a request for final approval.

> **Route: `FIX_REQUIRED` · Mode: `SHADOW` · Assessment: preparation**
>
> Fix required checks first. Architect reasons also remain: a function misses
> its CRAP limit, its PR decline is 5, responsibility moves between packages,
> and relevant measurements remain unknown. Shadow results are advisory;
> current rules determine whether this candidate may proceed.
>
> **Snapshot:** Analysis at source commit `S`. Final candidate checks,
> approval and merge records are linked separately; this file does not certify them.

| Candidate | Identity |
| --- | --- |
| PR / target | `<PR URL>` / `main` |
| Exact latest-main base `B` | `<base commit>` / tree `<base tree>` |
| Measured source `S` | `<source commit>` / tree `<source tree>`; report/image commit is bound later |
| Policy / mode / start `P` | `<policy version + hash>` / `SHADOW` / `<start commit>` |
| Measurement basis | `<basis ID + hash>`; ast-metrics/tool/runtime/coverage definitions in [manifest][c-evidence] |
| Report record | `<report ID>` / `<generation time>`; preparation snapshot |
| AUTO eligibility / execution | Not evaluated: fix/architect routes take priority. Record the policy/scope version; execution is `MANUAL`, with no live authorization asserted. |

**All retained reasons**

| ID | Kind | Reason and next action |
| --- | --- | --- |
| F1 | Fix | `pnpm run typecheck` failed. Correct the error and replace its evidence. |
| F2 | Fix | Build-test evidence is missing for the measured source. Obtain valid completion evidence. |
| A1 | Architect | `sample.parse` has CRAP 16: absolute `MISS`, PR decline 5 `MISS`, cumulative decline 8 `MISS`. Request a candidate decision if retained. |
| A2 | Architect | Parser responsibility moves from package Alpha to Beta. Review the owner and dependency direction. |
| A3 | Architect | Retry bounds and unavailable raw class MI can change required decline decisions after permitted repair. Resolve those gaps or request scoped evidence decisions; the MI85 unknown alone is not the trigger. |
| W1 | Owner warning | Formatter MI85 is `LOW` at 83; keep the cohesive formatter together and record the reason. No MI-floor waiver is needed; AUTO is blocked. |
| E1 | Covered | Formatter cumulative MI decline is 7. Fictional `EX-SAMPLE` covers that condition only at floor 83; keep the cumulative miss and separate MI85 warning visible. |

These reasons stay together. F1/F2 take route priority; correcting them does not
clear A1–A3. A standing exception does not cover this PR's decline of 5.

<details>
<summary>Scope, exclusions and required checks</summary>

**Scope:** Changed production function `sample.parse`, file `src/sample/parser.ts`
and class `SampleParser`; changed file `src/sample/format.ts`; affected unchanged
function `sample.retry` through changed unit support; new function `sample.format`.
Review Alpha→Beta ownership and its public contract across the full diff.
See [scope evidence][c-scope].

| Excluded item | Reason and evidence |
| --- | --- |
| `docs/sample.md` numeric scores | Prose only; no measurement or execution inputs change. [Diff][c-scope]. Design/policy review still applies. |
| Package Gamma units | Import and test-support inspection shows no relevant change. [Impact analysis][c-scope]. |
| Function MI / aggregate class CRAP | These are not proposed gates. File and class MI stay separate; function CRAP stays separate. |

Check states are `PASS`, `FAIL`, `PENDING`, `UNKNOWN` and `N/A`.
`UNKNOWN` means evidence is missing or cannot establish the result. `N/A` needs
a scope/policy reason. Neither is a pass. Required numeric states are `PASS`,
`MISS`, `UNKNOWN`, `NOT_APPLICABLE`; MI85 separately uses `MEETS`, `LOW`,
`UNKNOWN`, `NOT_APPLICABLE`. Low MI is an owner warning/AUTO blocker.

| Selected check | State | Evidence or action |
| --- | --- | --- |
| `pnpm test` | PASS | [Run log + complete suite selection][c-checks], matches `S`. |
| `pnpm run typecheck` | FAIL | [Error log][c-checks]; F1. |
| `pnpm run test:build` | UNKNOWN | No completion log for `S`; obtain valid evidence, F2. |
| `pnpm run build:user-portal` | PASS | [Build log][c-checks], matches `S`. |
| Selected new/changed tests before commit | PASS | [Focused run list and logs][c-checks]. |
| habit-hooks, measured source `S` | PASS | [Log and retained finding reasons][c-checks]; snooze file empty. |
| Conditional hosted/provider gates | N/A | [Path-rule selection][c-scope] shows no affected paths; no deferral claimed. |

**Metrics command:** Completed; **exit 1** for score misses and required unknowns.
See the [full process report][c-process]. No tool operation failed in this sample.
Keep this command result separate from both test outcomes and the proposed route.
The proposed bound proofs below do not change the current command's result.

Keep any policy-permitted deferral with its exact rule, prerequisite, missing
evidence and follow-up. A skipped/cancelled started Actions job is not `PASS`.
After the report is committed, record every final-head Actions outcome in the
separate final assessment and link its [job list][c-actions]. Do not rewrite this
snapshot merely to copy those later outcomes into it.

</details>

<details>
<summary>Per-unit scores, bounds, exceptions and relevant gaps</summary>

`A` is the best accepted score, with its source; `B` is the exact base score.
Candidate scores below were measured at `S`. They can supply `H` scores only after
the content/input proof in C.5. Values are fictional raw values or sound bounds.
Each row has its own stable unit ID and [identity/source proof][c-evidence].

| Unit / metric / origin | A (source) | B | Candidate at S | CRAP absolute / MI85 | PR decline (review ≥5) | Cumulative decline (review ≥5) |
| --- | --- | --- | --- | --- | --- | --- |
| `sample.parse` / CRAP / post-`P` | 8 (`<accepted revision 1>`) | 11 | 16 | MISS: 16 > 15 | MISS: 5 | MISS: 8 |
| `sample.retry` / CRAP / pre-`P` | 6 (`<accepted revision 2>`) | 7 | [3,12] | PASS: upper 12 < 30 | UNKNOWN: [-4,5] | UNKNOWN: [-3,6] |
| `src/sample/format.ts` / file MI / continuing | 90 (`<accepted revision 3>`) | 83 | 83 | LOW: owner warning; AUTO blocked | PASS: 0 | MISS: 7; covered |
| `src/sample/parser.ts` / file MI / continuing | 94 (`<accepted revision 4>`) | 92 | 91 | MEETS: 91 ≥ 85 | PASS: 1 | PASS: 3 |
| `SampleParser` / class MI / continuing | 90 (`<accepted revision 5>`) | 89 | UNKNOWN | UNKNOWN: AUTO floor | UNKNOWN | UNKNOWN |
| `sample.format` / CRAP / proven new | NOT_APPLICABLE: new | NOT_APPLICABLE: new | [3,12] | PASS: upper 12 ≤ 15 | NOT_APPLICABLE: new | NOT_APPLICABLE: new |

The two CRAP bounds use known `p=3`, unknown coverage and `[p,p²+p]`.
The retry bound proves its absolute result, but crosses decline thresholds.
The format bound proves only its applicable numeric result; no exact coverage
or anchor is invented. Missing class MI is not file MI, zero or a measured pass.

| Exception / gap | Scope and current disposition |
| --- | --- |
| `EX-SAMPLE` (fictional prior record) | File unit only; same basis and unchanged formatter responsibility; cumulative MI only; current floor 83; expiry `<date>`; reviewer `<named human>`. [Record][c-history]. Confirm current validity. |
| Covered cumulative miss | Head 83 meets the exception's floor 83, covering cumulative decline 7 only. MI85 remains `LOW` without a waiver. PR decline 0 passes; an exception cannot cover PR decline ≥5 or uncertainty about it. |
| `G-SAMPLE-1` | Retry coverage unavailable after [permitted repair][c-evidence]; no extra suite selected. Affects PR/cumulative decisions. Alternate paths evidence supports bounds only. Follow-up `<owner/date>`. |
| `G-SAMPLE-2` | Raw class head MI unsupported after [capability check][c-evidence]. Required PR/cumulative decisions remain unknown; MI85 is separately AUTO-only unknown. No substituted rounded/file value. Follow-up `<owner/date>`. |
| Relevant history | [Verified accepted range, origin, A sources and supplements][c-history]. Unrelated prose merge `<range>` has a linked no-impact reason. Any missing relevant update stays an explicit gap. |

A covered miss stays a miss. An accepted gap stays unknown. Approval does not
create measured scores or anchors, and an unrelated history gap is not a zero.

</details>

<details>
<summary>Evidence identity and references to later records</summary>

| Evidence | Reference and identity |
| --- | --- |
| Candidate observations | [Original B/S captures, manifests, snapshots and hashes][c-evidence]; available captures match their own revisions and canonical unit selection; missing observations stay explicit above. |
| Policy and basis | `<policy ID/hash>` and `<basis ID/hash>`; [archived definitions][c-history], including `P`, origin and applicable rules. |
| Current process output | [Original `ast-report/process.md`][c-process] and its hash; full unchanged text is included in this file. |
| Final candidate binding | The separate final assessment binds `H`, this file and its image hashes after final checks. This file contains neither its own containing commit SHA nor its own hash. |
| Human decisions | [Review/decision records][c-history]; no final approval existed when this example was generated. Do not add a later approval by changing this report commit. |
| Accepted observation | The later record in the [catalogue][c-history] holds actual main update `M`, content proof and assessment/decision references. No merge fact is invented here. |

The full file is a snapshot, not a live status page. The PR route and short
paragraph use the latest valid assessment and final checks. They can change
without editing this file. For example, pending final-head CI can require
`FIX_REQUIRED` even when the source analysis found only an architect trigger.
The paragraph states that reason; the linked assessment holds its evidence.

</details>

**Complete process output insertion point**

Paste the complete final `ast-report/process.md` into section 8 of the full file
**without change**. Keep all four sections (delta, review, CRAP, architecture), both
Mermaid graphs, their legends, import evidence and all notices, including
`The map did not change.` and `No production file changed.` when present.
The full file contains the actual output, not just a link to it. This example
does not fabricate a tool run. Keep the process output out of the PR body.

The copied output can name local files such as `ast-report/compare.html`.
Copying that text does not publish those files. The evidence index must give a
usable durable link and hash, or clearly state that an item is local-only or
unavailable. Never present a broken local path as retained evidence.

### C.4. Images and report history

Use one small folder for generated images:

```text
last_code_quality_report.md
docs/code-quality-report-assets/
  community.svg
  components.svg
  maintainability-trend.svg
  crap-trend.svg
```

The names above illustrate the output set. Keep an exact list of the images
actually generated; include additional trend images when the tool emits them.
No-data notices remain notices, not invented zero-valued charts.
An image-export failure leaves the report incomplete; do not show a stale image
from a previous PR as its result.

Export every available community/component diagram and trend chart to SVG or PNG
and embed it in section 7 of the full file. For example, from the root Markdown
file:

```markdown
![Community dependencies](docs/code-quality-report-assets/community.svg)
![Component dependencies](docs/code-quality-report-assets/components.svg)
```

Keep captions, legends and evidence limits next to the images. Preserve the
Mermaid sources in the unchanged process output so the images can be checked.
Record the exporter version and source hashes in the evidence index.
The existing process supplies Mermaid text; image export and full-file assembly
are work to build, not existing command behavior.

Commit the report and its images together. Replace the current generated images
and remove obsolete outputs owned by the report when a new PR replaces it.
Relative image links in a commit-pinned report resolve to that same revision.
Git retains earlier files and images, so do not create a second dated report
copy for every PR. Do not use temporary local paths, expiring artifact URLs or
images from a moving branch. Existing immutable `docs/metrics/` records retain
their separate rules.

### C.5. Write the report without changing its own identity

Use this sequence during implementation and the manual trial:

1. **Prepare source commit `S`.** Finish the source, test, policy and document
   changes. Use committed, clean measurement/policy inputs and the same base `B`.
   Select and run checks as usual; reuse only valid evidence. Do not add a
   preliminary complete process run solely to create a missing base record.
2. **Build the full report.** Run the final process against `B` on `S`. Assemble
   the complete file and export its images. Record `B`, `S`, policy/basis, input
   identities, actual check revisions and the source-analysis result. Do not
   insert the not-yet-created report commit, its own hash, final CI results,
   future approvals or future merge facts. The current writer may publish a
   missing verified immutable B record before Markdown/images. Keep that valid
   record after a later output failure; a retry can reuse it under F.5.
3. **Commit outputs as candidate `H`.** Prove that the whole `S→H` change set
   contains only the declared root report, owned generated image outputs and
   conditional exact verified `docs/metrics/` B companion. Verify its B/date/path/
   schema/provenance/source fingerprint and structural estimate labels; it is
   not accepted-score history. Check file types/modes, precise output/deletion
   ownership and modified or untracked inputs too. Outputs must be regular
   nonexecutable files. Any other input change returns to preparation.
   Publish the short PR message with its report link at `H` so reviewers can
   read it. State pending work in the reason paragraph.
4. **Validate the final candidate.** Check the report, images and links at `H`.
   Reuse measurements from `S` only with explicit input/content equivalence.
   Current provenance already excludes the proposed root file and image folder;
   that exclusion alone does not prove no impact. Label reuse accurately; do not
   claim that a command ran at `H` when it ran at `S`. Finish or validly reuse
   required local checks and validate the report before Ready, then wait for
   every Actions job that starts for `H`. Refresh the short route/reason.
5. **Freeze and review.** Store `B/H`, `S→H` proof, report/image hashes, final check
   outcomes, every reason and the final route in the separate assessment. Obtain
   the required human decisions against its hash. Keep the short message from
   C.1 linked to the report at `H`. Do not make another report commit merely to
   copy CI or approval outcomes; use the linked records.
6. **Merge manually and retain history.** Recheck the conditions in B.11 and let
   the owner merge once. Record actual merge equivalence outside the report.
   A later PR replaces the root file and current images without changing the
   earlier PR's permalink. Keep accepted-score and decision history separately;
   the newest report is not a new best-score baseline.

If main advances or another PR changes the same report path, update the base
and reassess. Rebuild this PR's report and images; do not resolve the conflict by
blindly keeping either PR's report. Changes only to final CI outcomes, relevant
history supplements, prior exception expiry or holds need a new FINAL assessment,
with valid source reuse and new decisions, rather than another report commit.
Source/measurement/scope/policy/basis/verifier changes regenerate source evidence
and report even when Git IDs stay the same. F.5 gives the retry branches.

[c-report]: https://example.invalid/Thermus/blob/report-commit/last_code_quality_report.md
[c-scope]: https://example.invalid/review/scope
[c-checks]: https://example.invalid/review/check-logs
[c-actions]: https://example.invalid/review/final-head-actions
[c-process]: https://example.invalid/review/process-report
[c-evidence]: https://example.invalid/review/original-evidence
[c-history]: https://example.invalid/review/archive-catalogue

## Appendix D. Research and proposed AUTO_MERGE policy

`AUTO_MERGE` means **eligible for a future automatic merge policy**, not an
instruction to merge now. It is a shadow recommendation. All current owner
reviews and manual merges remain required. D.2 defines the simplified proposed
shadow scope; it does not require separately approved recipes or mechanical-only
changes. It enables no setting and adds no agent PR reviewer. Adoption of the other
review routes does not enable automatic execution; that needs a separate owner
decision after the requirements below are proved.

### D.1. What the evidence supports

These sources were checked on 2026-10-20. Operational reports show feasibility
in selected settings. They do not establish a safe universal threshold or prove
that passing tests, low complexity or an AI confidence score can replace review.
The eligibility rules in D.2–D.5 are **Thermus policy choices**, not a research
consensus or capabilities already present in this repository.

| Primary source | Finding and limit |
| --- | --- |
| [Meta RADAR v2](https://arxiv.org/html/2605.30208v2), 2026-06-12; first submitted 2026-05-28 | The paper reports 535,290 reviewed changes and 331,720 landed changes. Eligibility depends on source/runbook, static checks, learned risk, automated semantic review and deterministic validation; some paths need no human review. This supports feasibility at scale. The cohorts are selected and observational, safety measures are incomplete proxies, and the underlying data and full model are not public. Its thresholds and reported comparisons cannot establish Thermus safety. |
| [Osmani, Lunt and Wang: Claude Code review](https://claude.dev/blog/solving-code-review-at-anthropic/), 2026-10-15 | The team describes trusted authors, protected paths, automated bug/security review, CI, a merge queue and staged recovery. Some low-risk changes need no additional approval. The human requester still checks the evidence and owns the change. This is a bundled operational before/after report, not randomized evidence or absence of human oversight. Thermus does not acquire these controls by citing the report, and an agent cannot supply a required human approval. |
| [DORA: Streamlining change approval](https://dora.dev/capabilities/streamlining-change-approval/), summarizing 2019 research | DORA favors peer review during development, supported by testing, CI and monitoring, over separate external approval boards. This supports moving review close to the work and using automation for timely feedback. It does not test a policy that removes every human review, or establish that low-risk classifications are correct. Reducing approval delay is a different claim from proving a change safe to merge without a reviewer. |
| [Rouan Wilsenach: Ship / Show / Ask](https://martinfowler.com/articles/ship-show-ask.html), 2021 | Wilsenach describes choosing review timing by context: ship some work, show some work after merge, and ask before uncertain changes. The model makes discussion and team judgment explicit. It is practitioner guidance, not a controlled safety evaluation or a list of universally safe file types. The article is hosted on Martin Fowler's site but Wilsenach is its author. Thermus still needs explicit scope and evidence. |
| [Martin Fowler: Test Coverage](https://martinfowler.com/bliki/TestCoverage.html), 2012 | Fowler explains coverage as a way to find untested code, rather than a grade for test quality. High execution coverage can coexist with weak assertions or missing requirements. This supports examining what tests establish instead of treating one percentage as merge permission. The article is practical guidance, not an experiment that supplies a replacement cutoff. Thermus CRAP and coverage evidence remain useful diagnostics with these limits. |
| [Inozemtseva and Holmes, ICSE 2014](https://cs.uwaterloo.ca/~rtholmes/papers/icse_2014_inozemtseva.pdf) | The study compares coverage and mutation-based effectiveness across generated test suites for large Java systems, while controlling for suite size. Coverage alone has limited value as a proxy for finding faults. This strengthens the case against a coverage-only merge gate. Its programs, suites and mutation measure also limit generalization; it does not show that tests are useless or that a particular coverage threshold proves correctness for Thermus. |
| [Branco et al., MSR 2026](https://pcanelas.com/assets/papers/2026-msr-lgtm.pdf) | The study observes smaller, focused agentic PRs among auto-merged work. It identifies auto-merge through absence of external GitHub reviews/comments, rather than proof of a particular execution mechanism. Off-platform review can be invisible. The study does not evaluate post-merge safety, so these characteristics cannot justify automatic permission for small PRs or a specific agent. They can guide trial sampling, not serve as safety guarantees. |
| [GitHub native auto-merge](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/automatically-merging-a-pull-request) and [merge queues](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue) | Native auto-merge completes a merge after configured reviews and checks; it does not itself waive review policy. A queue validates a temporary integration commit with current main and earlier queued work. Actions must handle `merge_group`. These are execution mechanisms, not proof that a class needs no human review. Queue availability depends on repository ownership and plan; old PR-head results cannot establish that a different integration SHA passed. |
| [GitHub required-check behavior](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks) | GitHub can accept `skipped` and `neutral` as successful required-check conclusions and distinguishes latest-head from test-merge results. Its documentation also covers unexpected check sources. Thermus requires actual passes for every started Actions job, so a platform mergeable flag is insufficient. A trusted gate must check selected work, completion, candidate identity and publisher. An empty check list must never become evidence that all required work passed. |
| [Renovate automerge](https://docs.renovatebot.com/key-concepts/automerge/), [platform caveat](https://docs.renovatebot.com/configuration-options/#platformautomerge) and [upgrade guidance](https://docs.renovatebot.com/upgrade-best-practices/) | Renovate-managed merging checks tests and base freshness. Its platform-native mode needs enforced platform protection; otherwise pending or failed tests and an outdated base can still merge. Renovate recommends 14 days before third-party automerge. A patch label, development-only declaration or release age is no safety proof. These labels do not prove that a dependency update meets the applicable eligibility conditions. |
| [Google SRE: Canarying Releases](https://sre.google/workbook/canarying-releases/) | Canary releases use limited exposure and observable signals to detect harm and support recovery. This supports planning detection and recovery before automation. It does not make merge permission equivalent to deployment permission, or show that every failure is reversible. Reverting a Git change cannot recover leaked information or undo every data change. Thermus must retain a separate release policy and assess the recovery limits of the proposed scope. |

### D.2. Shadow AUTO eligibility: four conditions

First apply `FIX_REQUIRED`, then `ARCHITECT_REQUIRED`. Only if neither applies,
evaluate these four conditions. Governance, rule, baseline, approval and
evidence-policy changes are outside AUTO, even when owner policy review suffices.
Record that exclusion explicitly. This scope needs no mechanical-only or
separately approved recipe gate.
One versioned policy/scope can govern the trial. Reuse the existing assessment
and one eligibility predicate; no new service or per-recipe record system is needed.

| Condition | Required evidence |
| --- | --- |
| 1. All required selected checks pass | Exact candidate and current-base evidence for successful required executions and satisfied adopted numeric decisions, selected tests/builds/smell checks, complete report/images and final-head checks; valid reuse under C.5 where permitted. Preserve original process statuses/exits. No weaker tests, assertions or gates; no unselected suite added. |
| 2. MI85 and no deterioration | Every affected production file/class to which MI applies has raw MI≥85 (`MEETS`). Every affected existing unit has comparable valid CRAP/MI per-PR decline `≤0`. CRAP absolute limits, cumulative rules, origin and accepted-history proof still apply. |
| 3. No new production behavioral class | Prove continuity for renames/moves. Exempt a proved private data-only record as D.3 defines. A new behavioral class alone fails AUTO and falls back to routine review; it is not by itself an architect trigger. |
| 4. No new or changed public contract | Inspect intentional external/interpackage obligations, including inputs, outputs, errors, permissions, side effects, persistence, schemas and protocols. Compatible additions count as changes. Exports used only inside test support are not automatically public contracts. |

Existing architect triggers remain separate and take priority. Section 4 still
covers changed boundaries, guarantees, runtime ownership and material policy
decisions. Ordinary owner policy approvals are still required and block AUTO.
A small implementation fix can qualify when it restores
an unchanged contract and meets every other rule. That does not create a silent
exception for security, lifecycle or any other architect trigger.

A retained architect decision stays `ARCHITECT_REQUIRED`, even after approval.
An exception or waiver needed to accept this candidate, required deferral or
relevant evidence gap disqualifies AUTO; unrelated or retired exceptions do not.
A pending candidate decision, explicit hold, changes-requested state or additional
candidate-specific human review request also disqualifies it. Human holds block
merge on every route; fallback never clears them. Ordinary owner review after a
shadow prediction remains mandatory and does not itself invalidate that prediction.

Use valid bounds only when their entire range proves the relevant result,
including a decline upper bound `≤0`. A new function uses its absolute goal,
with no invented predecessor score or decline. Numeric `NOT_APPLICABLE` needs a
scope proof. No fabricated observation, coverage share or anchor is allowed.
The zero-decline rule is stricter than the existing five-point architect trigger:
a one-point decline may be routine; five points still needs architect review.

After coordinated adoption, valid measurements, sound bounds or proved exclusions
can resolve numeric decisions when legacy CRAP is unavailable solely for absent
capture. Preserve its status/exit. Actual tool/collector failure, incomplete report
or an independently required failed check stays unresolved. Before adoption,
current AGENTS collection/checks/Actions remain binding; bounds waive none.

If only an AUTO condition is failed or unknown, use `ROUTINE_REVIEW` when ordinary
required evidence is sufficient. Do not add a suite merely to prove AUTO.
Raw MI unknown solely for 85 is such an AUTO-only unknown, not by itself an
architect gap. MI85 `LOW` is a warning and definite AUTO blocker.
An ordinarily required failure or gap still follows the existing fix/architect
rules; it cannot be relabelled as an AUTO-only unknown. No average, graph color,
AI confidence score or improvement elsewhere can clear a unit result.

### D.3. Class and contract scope; complete candidate proof

The new-production-class filter is a cheap pilot choice, not a universal research
measure of risk. A behavioral class adds validation, domain behavior, effects or
a lifecycle. An internal data holder can assign/read its own fields with a
simple constructor/getters. It has no new validation decisions, domain behavior,
effects, shared-resource ownership, persistence or external/interpackage
obligation, including public schema change. This exemption removes only the
class filter; metrics, identity, checks and architect rules still apply.
A proven rename/move preserves identity; it is not a new class.
Replacing classes with functions cannot hide changed responsibilities or contracts.

A public contract is an intentional obligation to an external caller or another
package, not every exported symbol. An exported test-local helper can remain an
internal scenario operation. A new boundary, new consumer obligation or changed
established semantic guarantee needs architect review. A fix that makes an implementation honor the same promised
input/output/error behavior can qualify; changing the promise, including a
compatible extension, cannot pass AUTO's contract filter. Apply section 4 to the
meaning of the change, not its syntax or filename.

Inspect the complete `B→H` diff, file types/modes and untracked inputs. Each
required companion output still needs proof: verify a new `docs/metrics/` base
record against `B` under its immutable-record rules, alongside report/images
in the strict `S→H` companion set under C.5. No folder or report-like name may
hide an input, generator, configuration or policy change. Generated assets and
formatting can qualify, but have no exclusive status. Ordinary bug fixes can also qualify when
they meet all four conditions and every earlier rule.

There is no blanket exemption for documents, tests or patch dependencies.
A governance document can need owner policy approval or an architect decision
under section 4; either blocks AUTO. A descriptive example does not acquire a
trigger merely from its path. Tests can weaken assertions,
and a lockfile can change runtime inputs. Source/author identity is evidence,
not permission. Before any agent PR reviewer is used, an explicit rule change
is required; the current ban stays active. Keep live-control qualification in
D.4/D.5 separate from shadow candidate eligibility.

### D.4. Readiness and execution are separate

A read-only API snapshot on 2026-10-20 resolved `3-headed-monkey/Thermus` to
`tomer-mayara/Thermus`: private, owned by a User, `allow_auto_merge:false`.
The main-branch response reported `protected:false`, `protection.enabled:false`,
empty checks/contexts and enforcement off. The Actions workflow API reported
`total_count:0`; local inspection found no `.github` directory. Rulesets and
external CI were not verified. These observations do not prove that no other
controls exist; they do show that live readiness has not been established.
GitHub's documented queue eligibility excludes this personal private repository.

Before enabling execution, separately prove actual protection and trusted-gate
infrastructure, no bypass, and failure-closed behavior. Policy, scope authorization
and verifier must come from the trusted base, so a candidate cannot rewrite its
own acceptance. Validate the selected jobs' actual outcomes, expected publisher,
exact candidate and prerequisites. Reject zero selected work masquerading as a
pass. A justified `NOT_APPLICABLE` test selection remains valid; do not add tests
or widen a suite for a prose change. Applicable candidate, metrics-process and
report checks still need evidence. Preserve Thermus' stricter started-job
requirement despite GitHub's broader successful conclusions. Run candidate code
without merge credentials. Only the trusted gate can grant automatic authority;
the PR's report, label or author statement cannot grant it.

Prefer one writer and serial merges against current main first. Recheck report
conflicts, accepted history, anchors and relevant exceptions immediately before
the single merge. Prevent races with every writer, including human merges:
expected head alone does not prove the base and history remain current. Any
advance invalidates the old eligibility proof. Prove safe
interruption, identical retry, conflicting retry, one merge, a kill switch,
accountable human ownership and recovery before execution. A queue is only a
later alternative if available: validate its integration context and report/history
effects, including `merge_group`; never claim old `H` checks cover its new SHA.
Do not enable a repository setting as a substitute for this work.

### D.5. Trial, stop rules and report

Run shadow classification before ordinary owner review. Preserve the **original
candidate prediction**, failed/unknown AUTO conditions and defects that review
finds, as well as later repaired outcomes. Validate the classifier/verifier on
known bad changes and adversarial cases, including protected-path escapes and
spoofed, missing, skipped or stale checks. Compare similar changes over
a stated follow-up period. Measure false AUTO eligibility, escaped defects,
architecture drift, reverts and incident severity alongside human time saved.

Before enabling live merging for a defined scope, the owner sets local
tolerances, audit samples, exposure caps and recovery response. The 30-PR trial
in section 8 does not itself prove readiness. No universal count or percentage
proves safety. A sampled eligibility defect stops affected automation for
investigation and requalification. Any protected-path escape or material incident
invalidates the affected scope and stops it. Policy, verifier or model changes
require requalification. Keep manual execution until a separate adoption and
enablement decision records the proved controls, scope limits and accountable
human. Future assessments may reference that policy authorization; they must not
invent a per-PR human approval.

Keep the PR format at exactly link, route and short reason. The full root report
adds policy/scope IDs, all condition evidence and failed/unknown results,
verification proof and recovery owner; execution stays `MANUAL` during trial.
Final CI, authorization, approval and merge records remain outside the snapshot
under C.5. A fictional short reason could be: “All four shadow conditions and
required checks pass. AUTO_MERGE is a shadow recommendation; the owner must review
and merge manually.” No live authorization or per-PR approval is implied. The U
scenarios in section 9 specify the route boundaries. Appendix E records the
historical replay and identifies the criteria used.

## Appendix E. Dry run against recent Thermus PRs

### E.1. Scope and evidence limits

This read-only dry run applies the consolidated policy to the frozen candidates
recorded on **2026-10-20**. It is not a completed shadow trial or a new test run.
The identities and measured observations below stay fixed; E.7 keeps #200's later
head separate. This is one content/evidence assessment under the policy above.
The consecutive sample is PRs **#193–#200**; #200 was open and Draft. The seven
merged in this order: **#193, #195, #194, #196, #198, #197, #199**. PR-number order
would put the baseline-policy change in the wrong place. PR #190 is a separate,
selected older control; it is excluded from every sample rate below.

The review used GitHub metadata, PR bodies, diffs and Git content. Commit links
give full IDs. Bodies are mutable summaries, not retained command logs. No tests,
coverage or metrics were rerun; no implementation, publication, PR posting or
merge occurred. These are proposed findings, not retroactive approvals. Content
uses the proposed triggers; historical checks use the rules then in force.
A literal resubmission today is a different assessment.

| PR | Exact base B | Recorded head H | Main result M |
| --- | --- | --- | --- |
| [#193](https://github.com/tomer-mayara/Thermus/pull/193) | [bc722eef](https://github.com/tomer-mayara/Thermus/commit/bc722eef260e7d9e59f624f710a5d5c409e181af) | [8a35e261](https://github.com/tomer-mayara/Thermus/commit/8a35e26135bd6bc248ef21c98b79afa968222e0d) | [267d4905](https://github.com/tomer-mayara/Thermus/commit/267d4905e5f89f58cd760b42be6be085e910fa89) |
| [#194](https://github.com/tomer-mayara/Thermus/pull/194) | [16871bd0](https://github.com/tomer-mayara/Thermus/commit/16871bd0c4ae99243bc39afb460b8a5004e55d8a) | [32d7288e](https://github.com/tomer-mayara/Thermus/commit/32d7288e238ca4eabd014fb48d1f678269b9ccbd) | [d62a661f](https://github.com/tomer-mayara/Thermus/commit/d62a661f4eefa2874b7c0e8ae67afa882c9b4908) |
| [#195](https://github.com/tomer-mayara/Thermus/pull/195) | [267d4905](https://github.com/tomer-mayara/Thermus/commit/267d4905e5f89f58cd760b42be6be085e910fa89) | [e24881b2](https://github.com/tomer-mayara/Thermus/commit/e24881b2a726ba2667676be745b4577346bc3473) | [16871bd0](https://github.com/tomer-mayara/Thermus/commit/16871bd0c4ae99243bc39afb460b8a5004e55d8a) |
| [#196](https://github.com/tomer-mayara/Thermus/pull/196) | [d62a661f](https://github.com/tomer-mayara/Thermus/commit/d62a661f4eefa2874b7c0e8ae67afa882c9b4908) | [67963eb8](https://github.com/tomer-mayara/Thermus/commit/67963eb8569151b70a245b4d306b2d29553b56bc) | [5f3679ef](https://github.com/tomer-mayara/Thermus/commit/5f3679efaf1da9ca0bfc043005454308f6756c17) |
| [#197](https://github.com/tomer-mayara/Thermus/pull/197) | [b45c0701](https://github.com/tomer-mayara/Thermus/commit/b45c07015a758b461a7c4da099b52c85182cf548) | [814c4d48](https://github.com/tomer-mayara/Thermus/commit/814c4d48de7809cd22c32f06ea8fd2cee48af0a4) | [faefe09e](https://github.com/tomer-mayara/Thermus/commit/faefe09e84c62636ca949600cefa4a75fdd3a60b) |
| [#198](https://github.com/tomer-mayara/Thermus/pull/198) | [5f3679ef](https://github.com/tomer-mayara/Thermus/commit/5f3679efaf1da9ca0bfc043005454308f6756c17) | [fe8a4cb0](https://github.com/tomer-mayara/Thermus/commit/fe8a4cb0061c526dea816198a46f462bc5b7c564) | [b45c0701](https://github.com/tomer-mayara/Thermus/commit/b45c07015a758b461a7c4da099b52c85182cf548) |
| [#199](https://github.com/tomer-mayara/Thermus/pull/199) | [faefe09e](https://github.com/tomer-mayara/Thermus/commit/faefe09e84c62636ca949600cefa4a75fdd3a60b) | [7e9d6ce9](https://github.com/tomer-mayara/Thermus/commit/7e9d6ce914f184797384275c6ea57a57b2bfe714) | [0524a436](https://github.com/tomer-mayara/Thermus/commit/0524a43646886f143ddf707bfb73d2157085649a) |
| [#200](https://github.com/tomer-mayara/Thermus/pull/200) | [0524a436](https://github.com/tomer-mayara/Thermus/commit/0524a43646886f143ddf707bfb73d2157085649a) | [8b029bed](https://github.com/tomer-mayara/Thermus/commit/8b029bed7d295c753863690bb183744ddac82e2c) | Not merged at snapshot |

### E.2. Content and available check findings

Four changes have clear architect content, two have ordinary owner-review
content, and two have recorded required failures. These are not verified final
routes: unresolved required numeric/history/check evidence can still require
fix or architect review. No recipe catalogue is required, and MI85 `LOW` alone
does not create an architect result.

| PR | Content / available evidence finding | Reasons and AUTO limits |
| --- | --- | --- |
| #193 | `ARCHITECT_REQUIRED` content | New loader/owner shutdown protocol and manifest version 4 change lifecycle and evidence acceptance. Integration proof is useful but not canonical unit-score evidence. Governance/evidence-policy change also blocks AUTO. |
| #194 | `ROUTINE_REVIEW` content; final evidence unverified | Existing fixed-hash/same-origin CSP pattern and constant-module rejection rules are preserved, as detailed below. File MI 75.2/66.9 is owner warning/AUTO blocked; the public-page extension also blocks AUTO. No production class changed; invent no class-MI gap. |
| #195 | `FIX_REQUIRED` on recorded failures | Ordinary, hosted and AMD64 image gates are reported failed. After valid repair, local UI work could receive owner review subject to remaining evidence. MI 43.4/44.3/73.0 warns/blocks AUTO; it is not an architect reason alone. |
| #196 | `ARCHITECT_REQUIRED` content | Sanitizer opacity/animation handling can reveal untrusted content, changing a safety/meaning guarantee. Eight file scores 33.2–48.2 are owner warnings/AUTO blockers. Local type-only source coupling alone can receive owner review with section 4's proof; it is not the architect reason. |
| #197 | `ARCHITECT_REQUIRED` content | Changes the documented scope/payload/cardinality of `renderer.fetch.failed`, as detailed below. Same-owner cleanup and an internal helper argument alone are not architect triggers. Six file scores 45.4–80.4 are warnings/AUTO blockers. |
| #198 | `ROUTINE_REVIEW` content; owner policy approval reported | Removes the baseline-refresh bypass without a new approver or metric meaning. Focused 40/40 and process exit 0 are reported. Governance still blocks AUTO despite no production change. |
| #199 | `ARCHITECT_REQUIRED` content | Changes the exact generic public error promise to diagnoses. New passing tests/types do not establish compatibility with that promise. MI 48.2/50.8/53.1 warns/blocks AUTO; contract change and new behavioral class also exclude it. |
| #200 | `FIX_REQUIRED`; architect content retained | At original `8b029bed`, two missing search behaviors and three missing Axiom prerequisites fail the ordinary gate. New search packages/contracts/input admission need architect review. MI 66.2 is warning/AUTO blocked; CRAP 5 and 100% unit coverage cannot clear failures. It was Draft. |

For #194, the [base signup page](https://github.com/tomer-mayara/Thermus/blob/16871bd0c4ae99243bc39afb460b8a5004e55d8a/src/auth/hosted-auth/workos/workos-signup-pages.ts#L86)
already uses an exact style hash and same-origin images/fonts. The new page keeps
default/base/form/frame restrictions. The [frozen parser](https://github.com/tomer-mayara/Thermus/blob/d62a661f4eefa2874b7c0e8ae67afa882c9b4908/script/code-quality/crap/metrics.ts)
requires zero source declarations, correct explicit-root paths, zero complexity/
risk and valid line counts. Rejections for malformed, wrong-repository and missing
executable observations remain covered. No basis/formula change is visible.
Ordinary identity, canonical coverage, raw/history and exact-check proof remain
unverified by this replay; none is waived by the content finding.

For #197, the [prior operational contract](https://github.com/tomer-mayara/Thermus/blob/b45c07015a758b461a7c4da099b52c85182cf548/docs/reference/mcp-fetch-tool.md)
limits `renderer.fetch.failed` to readiness timeout with `budgetMs`; other failure
kinds had separate behavior. Emission for every noncancelled failure changes that
promise. For #199, the [old public promise](https://github.com/tomer-mayara/Thermus/blob/faefe09e84c62636ca949600cefa4a75fdd3a60b/docs/reference/mcp-fetch-tool.md#L57)
is the exact generic `Page fetch failed`. Added diagnoses and rewritten expectations
change it. No prospective extension permission makes these earlier changes
compatible retroactively. Do not force lower review counts by waiving guarantees.

For #195, metadata proves later Ready/non-Draft state and merge. The refreshed
body is byte-identical, recording failed final gates with no superseding full
pass evidence found. This supports `FIX_REQUIRED` on the available evidence,
**not** proof that tests were failing at merge. That later gate outcome is
unknown; merge is not a test result or an architect waiver of failed tests.

Baseline refreshes in #195/#196 followed the prior policy. PR #198 narrowed
permission to rule changes. Resubmission today would need repair; do not apply
that later restriction retroactively.

### E.3. Walk through Appendix B with #198

This is a compact replay of the steps, using recorded facts and explicit gaps.
It does not create a frozen packet or repeat the original commands.

| Step | Observed fact, gap and consequence |
| --- | --- |
| B.1 Candidate | Base `5f3679ef`, head `fe8a4cb0`, result `b45c0701`. Use predecessor policy, not the candidate's revised permission. |
| B.2 Scope | `AGENTS.md`, metrics guide, script README/help and base record change; no `src/`. Select focused contracts, not extra coverage. |
| B.3 Checks | Body reports build, 40/40 focused tests and habit-hooks exit 0, with empty snoozes. No new execution. |
| B.4 Process | Four sections reportedly finish at `fe092332`, exit 0: no regression/production change, unchanged map. This is not policy approval. |
| B.5 Measurements | Numeric scope is excluded with reason. Request no unrelated class/coverage values; invent no scores. |
| B.6 History | Actual merge order preserves #195/#196's prior baseline permission. Structural records are not the proposed accepted-score ledger. |
| B.7 Thresholds | Numeric `NOT_APPLICABLE` does not clear required owner policy review or the AUTO governance exclusion. |
| B.8 Design/policy | Tightened baseline permission and clarified capture/process instructions introduce no new approval authority or visible basis change. Owner policy approval is required; the body reports it. |
| B.9 Route | `ROUTINE_REVIEW` on content, with owner approval rather than invented architect approval. Governance blocks AUTO. Final ordinary proof limits remain visible. |
| B.10 Final checks | Git proves `fe092332→H` adds only the base record: input-equivalent reuse, not commands run at `H`. No Actions starts are reported; empty API checks prove neither pass nor failure. |
| B.11 Decisions | Owner approval is reported; no proposed frozen/hash-bound packet was supplied. Invent neither that approval format nor an original defect. |
| B.12 Main result | Git proves `M` has sole parent `B` and `H`'s tree. Keep merge proof separate from checks/approval; create no accepted observation here. |

### E.4. Shared evidence gaps

Historical reports lack the proposed ledger, frozen packets and root layout.
Their absence limits replay; future artifacts were not original requirements.
Empty review/comment/check arrays prove neither pass nor failure. Prose sign-off
is not an invented hash-bound decision.

Legacy base CRAP values were often estimated from head coverage. In #197/#199,
reported coverage also combines unit and integration suites, rather than the
proposal's canonical unit-only set. Retain those labels. Do not derive exact
five-point or cumulative CRAP decisions from them, reset anchors, or assume a
new unit from an unresolved tool identity. Raw class MI and complete accepted
history are not established by file scores or a graph. Missing raw MI solely
for 85 is AUTO-only; missing accepted gains or required decline/CRAP evidence can
still change an ordinary decision and follows fix/architect gap rules.

Across the six `src/` PRs, **23 of 25 measured affected production-file
observations** are below 85. These are observations per PR, not 25 distinct
files; repeated files count again when changed. The reported scores are rounded,
but the values are well below 85 and block AUTO in all six source PRs. Ten of ten
new measured observations and thirteen of fifteen existing ones are below 85.
Four low existing-file observations improved:

| PR / file | Reported MI |
| --- | --- |
| #194 `src/hosted-admin/account-pages.ts` | 72.2 → 75.2 |
| #195 `src/user-portal/connection-guide.ts` | 41.4 → 43.4 |
| #197 `src/fetch-tool.ts` | 80.3 → 80.4 |
| #197 `src/website-fetcher/website-fetcher-lightpanda.ts` | 46.2 → 52.6 |

The other nine low existing observations decline by 0.1–1.4. The largest displayed
drop across all fifteen existing observations is 3.4; none displays decline ≥5.
This is not raw class/CRAP/history proof or a defect-rate estimate. The
[metrics guide](ast-metrics-review.md) records a historical 2026-10-17 inventory
with production median 62 and only ten files ≥85, not a current census. These
observations support owner warnings for stable low MI; they prove neither bad
architecture nor a universal cutoff.

### E.5. Separate older control: #190

[PR #190](https://github.com/tomer-mayara/Thermus/pull/190) splits MCP acceptance
cases and extracts their site/DSL. Its base is
[`1bc81715`](https://github.com/tomer-mayara/Thermus/commit/1bc817152a7d8fcd0e81f4d970b99a7a17f44295),
head [`b05173fe`](https://github.com/tomer-mayara/Thermus/commit/b05173fed34899e5678299c83e865ad6a84f9ec0),
and merge [`73c70570`](https://github.com/tomer-mayara/Thermus/commit/73c70570ade537b33326bd011088c439c9b36ab2).
Remote head and merged content share tree
`620eb4a5eec830d79b78da6aed6b44077d45d461`. The
[layout-document addition](https://github.com/tomer-mayara/Thermus/blob/73c70570ade537b33326bd011088c439c9b36ab2/docs/testing/test-code-layout.md)
describes those helpers; it changes no test category, gate, boundary or policy.
The change-request document records delivery, and the inventory describes the
same cases. A document path alone is not a governance trigger.

Git comparison finds four byte-identical test declarations/bodies generating
the same ten named cases, with unchanged 5,000 ms deadlines. Site logger, server,
listener, shutdown, cleanup and client-connection code match. Fetcher/pipeline
bodies match after erasing added type-only annotations; the assertion helper's
authority constant becomes its identical literal. State is still created per
site. Production code, discovery scripts and existing dependency helpers do not
change. The new helpers remain internal test scenario operations; their exports
create no intentional external/interpackage obligation. No new production class
is added. Numeric production comparison is `NOT_APPLICABLE`: no production or
canonical unit-coverage input effect is identified. Do not request an unrelated
unit capture merely because acceptance support moved.

| Control | Content eligibility | Evidence limits |
| --- | --- | --- |
| #190, outside the main sample | AUTO candidate on content: no new production behavioral class/public obligation/governance rule; numeric scope excluded with proof; preserved scenarios and reported selected-check passes support fit. | Required acceptance, focused, inventory and other checks are reported passing. Exact-candidate verification is not independently established; no verified `AUTO_MERGE` result is asserted. |

This is a conditional content finding, not a fifth route. Ordinary required
evidence is still necessary. If that proof is recoverable, follow the existing
fix process; if a relevant gap remains unavailable, apply the architect rule.
Do not hide it as an AUTO-only fallback. Missing only extra AUTO evidence uses
the normal routine fallback when all ordinary requirements are established.

The concrete source preservation and recorded acceptance results support this
candidate's fit. There is no separate approved-relocation-recipe prerequisite,
and no universal execution-equivalence theorem is demanded without a concrete
risk. This remains a specific historical observation. Keep the selected control
outside the consecutive sample rather than reporting a nine-PR eligibility rate.

### E.6. What this dry run establishes

The frozen sample has **four clear architect contents** (#193/#196/#197/#199),
**two ordinary owner contents** (#194/#198), and **two fix findings** on available
evidence (#195/#200, with #200's architect content retained). This is not a
verified final routing distribution: required numeric/history/check evidence can
still require fix or architect review. The separate #190 control remains a
plausible AUTO content fit, not an added ninth denominator entry.

There are **0/8 original AUTO content fits**: all six source PRs have MI85 LOW,
and #193/#198 have governance/evidence-policy exclusions. The older broad-trigger
replay would change no route by removing MI alone; owner-review distinctions also
need the bounded semantic rules now stated in section 4. No sampled rejection
rests solely on zero decline, so this workload does not justify relaxing it.
These observations are not statistical safety or classifier-precision estimates.

Keep cumulative anchors and unknown accepted gains. Use manual identity proof
and sound exclusions to avoid false gaps rather than collect unrelated coverage.
Continue the consecutive trial with the policy version and independent judgments.
No new implementation or live merge authority follows from this dry run.

### E.7. Separate later head of #200

A later refresh on 2026-10-20 found #190 and #193–#199 unchanged in head and body.
Only #200 advanced: its base remains `0524a436`, but head is now
[`99515265`](https://github.com/tomer-mayara/Thermus/commit/995152650d7755f3e6211c132a66f97fdd75ebd7).
It is still open and Draft, with no merge result. The
[old-to-new comparison](https://github.com/tomer-mayara/Thermus/compare/8b029bed7d295c753863690bb183744ddac82e2c...995152650d7755f3e6211c132a66f97fdd75ebd7)
is separate from the fixed candidate pairs above.

The refreshed body reports 5,445/5,450 backend tests passing, with the same five
failures: two absent search behaviors and three missing Axiom prerequisites.
The validator is now a `SearchQuery` class. Reported file MI is 65.4, replacing
66.2 at the old head. `SearchQuery.isValid` has five paths and CRAP 5; the
constructor has two paths and CRAP 2; the getter has one path, unknown coverage
and a reported lower bound of 1. Do not invent an exact getter score.

The route remains `FIX_REQUIRED`, with package/contract/input-admission architect
reasons retained. MI 65.4 is an owner warning/AUTO blocker, not an architect floor.
Constructor validation makes this a behavioral class, not the plain data-holder
exemption. The class filter alone
would cause routine fallback, but the earlier fix/architect reasons already
decide this candidate. This later observation is not part of the paired rate or
the original **23/25** count. No new run was performed for this replay.

## Appendix F. Implementation plan

### F.1. Delivery and script ownership

This is the proposed target after implementation and coordinated adoption, not
permission to run it now. Current AGENTS.md governs the trial. These slices sit
inside section 8's authorized implementation stage; they do not move adoption
ahead of the manual trial. Routes, thresholds and manual merging stay unchanged.

| Slice | Deliverable and completion evidence |
| --- | --- |
| 1. Characterize | Preserve the default process CLI/stdout, four sections, graphs, notices, native statuses, exit behavior and structural writer. Establish passing characterization before changing these contracts. |
| 2. Observe | Prove raw/exact-revision capability and collect comparable observations with A.2's owners. Keep estimates, bounds and unknowns distinct. Prove the image exporter's capability, version pin, graph fidelity and failure behavior before selecting it. |
| 3. Assess | Add one pure calculation and checked input reader, including the owner-verified manual history extract. Match the existing numeric/design/AUTO acceptance cases without a hidden lineage engine. |
| 4. Integrate | Add the report/assess interface below, preparation/final binding, image assembly and per-attempt completion. Prove the one-pass companion-output flow and retry cases. |
| 5. Hand off | Prepare the inactive root runbook and coordinated document/AGENTS changes; remove only proven redundancy under A.5. Meet section 8's adoption criteria before activation. |

Keep these owners under `script/code-quality/`; names below describe cohesive
modules, not a required microfile for each check. Reuse the inventory in A.2.

| Owner/path | Planned change |
| --- | --- |
| `assessment/` (planned) | One pure assessment entry point, typed observations/result and the AUTO predicate. No Git, tools, network, rendering or archive writes. |
| `process/` and `ast-metrics-process.ts` | Parse operation shapes; validate input/evidence/manual extract; coordinate collection, calculation, report/views/images and completion. Export typed stage outcomes instead of only `runProcess`'s current text/passed pair; keep effectful validation outside the pure calculation. |
| `snapshot/` and `ast-metrics-snapshot.ts` | Exact-commit CLI input is available under F.8 and reuses unchanged `snapshot/commit.ts`. F.9 adds optional raw file MI. Raw-retaining assessment input and typed class observations remain pending. |
| Existing collectors/readers; optional `history/` and `ast-metrics-history.ts` | Reuse A.2. Add an automated history writer/replayer only if later justified; it is not needed for the first version. |

### F.2. Command and result contract

Process/assessment options below remain **PROPOSED**. F.8/F.9 record the available
exact snapshot CLI and optional raw file MI, with their validation limits.
Keep the existing process entry point; do not add an assess wrapper or a script
for each step. Default `--operation report` preserves today's invocation.

| Proposed operation/option | Contract |
| --- | --- |
| Report with no new flags | Preserve existing output, `--out FILE` meaning the original four-section Markdown, coverage behavior, structural publication and exit 0/1. |
| Report: `--assessment-input FILE --assessment-out PREFIX` | Require the pair to opt in to PREPARATION input, full root report/images and `PREFIX.json` plus derived `PREFIX.md`. JSON contains typed verified observations, original native outcomes, source calculation, evidence references and exact output manifest; no separate bundle flag/file. |
| `--operation assess --assessment-input FILE --assessment-out PREFIX` | Require FINAL input referencing completed PREPARATION JSON by hash. Local Git/file checks are allowed. Run no ast-metrics, MCP, native comparison, build, test or coverage; rewrite no root/process report or images, and write no structural/accepted history. Assessment JSON and its Markdown view are allowed outputs. |
| CURRENT snapshot: `--commit <FULL_SHA> --out <file>` | Require a full lowercase 40-hex commit SHA; reject combination with `--base` before tools. Default output is root `ast-report/snapshot-commit.json`; explicit `--out` is relative to the current folder. Preserve working-tree default and `--base` merge-base semantics. No implicit build/test/coverage. F.9 adds optional raw file MI while top-level version stays 1. |

Reject incomplete assessment input/output pairs before tools. Assess rejects
report-only options:
`--base`, coverage options, `--out` and `--allow-tool-version`. Its exact revision
and measurement facts come from checked input. Help and assess need no installed
ast-metrics or image exporter. Keep the parser's operation shapes explicit.

Before report starts tools, check that CLI `--base` resolves to manifest B and
that B is an ancestor of S with clean measurement/policy inputs; otherwise
native merge-base comparisons could silently use a different base. Bind the
actual measurement/policy inputs to S, validate supplied evidence hashes and
require permitted coverage selection to agree with the input. The supplied B
snapshot must itself report exact B.
No implicit base coverage fills a missing reference. Reviewed numeric scope must
include indirect test/support/dependency/basis effects under section 3; the
current changed-production-file CRAP selection cannot define that wider scope.
Use a wider set or unknowns when evidence cannot narrow it.
Verified companion outputs left by a failed attempt are allowed under F.5;
they do not permit any uncommitted measurement or policy input change.

Report keeps exit 0/1 and original native statuses. A goal miss or reported
native failure can be complete evidence for FIX/ARCH while report still exits 1.
Completion is not a claim that checks passed. Assess exits 0 for a valid result,
including FIX/ARCH, and 1 for an operation error. Structured reasons distinguish
invalid supplied evidence from evaluation/render/output failure. Declared gaps
or failed checks can yield valid assessments; corrupt provenance, mismatched
identities or unsupported schemas are not ordinary gaps to excuse. Failure to
validate, evaluate, render or write leaves no completed result; retain diagnostics.

After coordinated adoption, valid measurements, sound bounds or proved exclusions
can satisfy numeric decisions despite a preserved legacy unavailable status
solely from absent capture. Never relabel that status/exit. Actual tool/collector
failure, incomplete report or an independently required failed check remains
unresolved. Before adoption, current AGENTS collection/checks/Actions still bind;
bounds waive none. Consume typed passed/goal miss/failed/unavailable outcomes,
never parsed text or the assumption that every exit 1 means FIX.

Use a fresh attempt ID and output prefix outside the checkout. Refuse overwrite
of a completed result; preserve prior attempts and the improvement-attempt log.
Stage generated report/views/images, validate their references, then write the
completion JSON last with an atomic single-file publication. Do not add a global
latest pointer or claim a transaction across filesystems. An incomplete attempt
cannot stand in for a previous eligible result. The immutable B writer has the
separate failure behavior in F.5.

### F.3. Evidence and the first-version history boundary

Create PREPARATION input outside S after S is committed. Use one versioned input
format with explicit PREPARATION/FINAL phases and one assessment JSON format.

| Data | Required contents |
| --- | --- |
| PREPARATION input | Exact B/S and trees, policy/basis/P, scope and exclusions, selected checks with actual executing revisions/results, human design declarations and owner-verified history extract. Reference/hash independent B snapshot and canonical capture where needed, plus reused S evidence. Fix root report and owned asset directory; exact dynamic chart names are not required before tools run. |
| Completed PREPARATION JSON | Bind newly obtained S evidence as well as reused B/S facts: raw file/class MI, function identity/completeness, paths, own-character coverage/CRAP or bounds, imports/native findings and original stage outcomes. Include source calculation, all reasons/warnings, phase, attempt ID, evidence references and exact created/replaced/deleted output manifest with hashes. Preserve required non-src evidence. |
| FINAL input/result | Reference completed PREPARATION JSON by hash. Add actual H/tree, whole B→H scope, strict S→H companion/input-equivalence proof, report/image hashes, saved final check outcomes and refreshed relevant history/exception/hold evidence. The calculation returns one priority route, every reason and the existing per-unit states; it does not approve itself. |

PREPARATION has no final H checks, candidate approval or candidate merge facts;
AUTO is provisional. Accepted historical observations remain valid inputs.
Its report is a source snapshot, with pending final proof. It names
the attempt ID and original evidence, not the hash of combined PREPARATION JSON
that hashes the report. FINAL binds both. No object includes its own hash and no
pair hashes each other. Later human decisions and actual M facts remain separate.

For the first version, the owner supplies a reviewed history extract from the
manual archive. It contains P/origin; accepted best values, basis and source-record
evidence; exception bounds/expiry; relevant main/archive cut; skipped ranges and
reasons; relevant gaps; and named reviewer/completeness check. It is an input,
not new authority. Validate schema, identities, references/hashes and declared
cut/scope. The human verifies semantic completeness. Do not hide full lineage
replay or archive enumeration behind a function called a reader.

Saved existing PR/Actions/CLI outputs, original local check logs and human review
supply check evidence. The validator checks binding to the candidate, expected
publisher, selected job and outcome; hashes alone do not prove a check was true
or complete. No new CI connector is required. The owner refreshes live base,
checks and relevant history immediately before manual merge. Expected HEAD alone
does not prove main or history stayed current. Missing proof stays a genuine gap.

Record the actual executing verifier version/hash separately from approved policy.
Resolve trust from approved base/archive evidence, not candidate self-declaration.
Policy or verifier changes need trusted/manual comparative review under prior
rules; this plan adds no protected executor, signing system or policy service.
Bind active referenced rules/configuration/runbook bytes separately from coverage:
`provenance/inputs.ts` excludes root Markdown, including AGENTS and the planned
root guide. Compatible coverage does not prove unchanged policy or allow AUTO
for a governance edit.

Require canonical two-part unit coverage only when a decision uses measured
CRAP coverage. Proven exclusions and sound bounds can need no capture. A merged
unit+integration share cannot be unmerged by choosing a unit capture ID; use
retained independent canonical evidence or separately authorized collection.
Keep head-derived base estimates labelled and outside measured decision inputs.
Retain durable evidence closure before approval. Existing immutable references
are enough; committed report/assets need no extra copied archive solely for storage.

### F.4. Root runbook: seven operational steps

Create root `CODE_QUALITY_PLAYBOOK.md` as an inactive draft during implementation.
This table gives the target flow. During the trial, current AGENTS remains active;
new flags do not excuse current requirements. Link B/C for detail until adoption
transfers their live operations/rules into the root guide and marks the proposal
historical. Root then owns the adopted thresholds, routes and procedure.

CURRENT calls exist; PROPOSED calls below need implementation. Replace `<B>` with
the full agreed SHA and `<attempt>` with a fresh prefix outside the checkout.

| Step | Action, calls and result |
| --- | --- |
| 1. Scope and checks | Open Draft, agree B/P/basis, inspect full scope/semantic changes and relevant history, then select checks under the test gate policy. CURRENT for src: `pnpm test`, `pnpm run typecheck`, `pnpm run test:build`, `pnpm run build:user-portal`, plus applicable gates; otherwise selected groups/focused tests. CURRENT: `habit-hooks --branch origin/main`. Repair required failures; reselect after edits. |
| 2. Source evidence | Obtain only needed independent B/S evidence within authorized scope. CURRENT exact snapshot: `pnpm exec node script/code-quality/ast-metrics-snapshot.ts --commit <B> --out <snapshot>`. CURRENT capture in an authorized revision checkout: `pnpm exec node script/code-quality/ast-metrics-coverage.ts --out <capture>`. Commit clean source S, then prepare external input and the reviewed history extract. No blanket new measurement job or preliminary full-process run. |
| 3. One report pass at S | PROPOSED: `pnpm exec node script/code-quality/ast-metrics-process.ts --operation report --base <B> --assessment-input <preparation-input> --assessment-out <attempt> --out ast-report/process.md`. Add only an allowed coverage choice. Produce original process Markdown, PREPARATION JSON/view, root full report/images and any verified B companion record written by the current writer. |
| 4. Candidate H and provisional PR view | Validate exact S→H outputs under F.5; commit only the root report, owned images and conditional verified B record. Immediately show the commit-pinned report link, provisional route and short reason on the PR, including pending final proof. This precedes Ready and final decisions. |
| 5. Final checks and assessment | Finish or validly reuse required local checks and validate report/images/links at H before Ready. Then mark Ready and wait for all started H Actions. PROPOSED: `pnpm exec node script/code-quality/ast-metrics-process.ts --operation assess --assessment-input <final-input> --assessment-out <new-attempt>`. Freeze the valid FINAL result and update the short route/reason. Failed or pending required work still blocks merge. |
| 6. Decisions and manual merge | Obtain required human decisions against the frozen assessment hash; do not rewrite the report for CI/approval. Refresh base/check/history/exception/hold inputs before merge, applying F.5's retry branches. ARCH stays ARCH after approval; AUTO is shadow/manual. Owner merges once only when current/adopted rules permit. |
| 7. Actual M and history | Verify actual merge/content equivalence and append the accepted observation with actual M/content proof and references to existing assessment/decision records. Preserve P/origin/best anchors. A reviewed gap/correction supplement needs no new product merge; failed bookkeeping never causes a second merge. |

Coverage choice remains CURRENT: `--coverage <file>` for verified reuse,
`--collect-coverage` only when selected suites permit it, or normal no-option
handling. `--skip-coverage` cannot pass a required goal. No nested broader suite.
Run collectors/native comparisons sequentially; each command owns its MCP session.
Keep at most three improvement cycles, one attempt log and the same agreed base.
Required failure/staleness needs repair; genuine unresolved gaps use existing
FIX/ARCH rules; low MI is an owner warning/AUTO blocker. Holds block every route.

### F.5. Companion outputs, failure and retry

The snapshot additions in F.8/F.9 do not implement this proposed companion flow.

Use fixed first-version output locations: root `last_code_quality_report.md`
and owned `docs/code-quality-report-assets/`. After rendering, record the exact
created/replaced/deleted paths and hashes. Prove prior ownership and expected
absence for obsolete-image deletion. Preserve complete original process text,
Mermaid sources, captions/legends and no-data notices. Reject stale/missing
images, arbitrary paths, symlinks, executable modes and undeclared extra files.
There is no configurable output framework. Provenance exclusions are not proof
of input equivalence.

The existing structural writer may create the missing exact verified B record
under `docs/metrics/` during this one report pass. Allow it as an additional S→H
companion only with exact B/date/path/schema/source-fingerprint/provenance/type/
mode/content checks. It is structural history, never accepted scores; keep
head-derived estimate labels.
The writer publishes before Markdown/images: if later rendering/writing fails,
keep the valid immutable B record. Rerun using valid evidence and allow verified
reuse of that record from the failed attempt; it need not share the attempt ID.
Never edit an existing record; keep main's version in a conflict. Any other
input/output change returns to source preparation. Inspect whole B→H as well.

| Change or failure | Required response |
| --- | --- |
| B/S, source, measurement inputs, scope interpretation, governing policy/basis or verifier changes | Re-establish source evidence and regenerate the report, even with unchanged Git IDs if meaning changed. Reselect checks/recollect only where required and permitted. |
| Only final CI outcomes, relevant history supplement, prior exception expiry or holds change | Reuse the valid source snapshot; create a fresh FINAL with cause and new evidence references, then obtain decisions for its new hash. Do not create a report commit for these later facts. |
| New main or report/assets conflict | Update B and regenerate this PR's report/assets. Do not blindly keep either report. |
| Failed/incomplete attempt | Preserve diagnostics and any valid immutable B record; use a fresh output prefix. No completion JSON means no completed result. Never mutate an earlier result or add approval retrospectively. |

Automated history writing/replay stays conditional under A.3/A.5. A later single
`ast-metrics-history.ts` could provide init, read-only verify and record, with
idempotent retries/conflict refusal and tested interruption/restore. It cannot
reset P/origin/anchors. Do not make it a first-version dependency. An external
accepted-history archive does not replace structural trend history; retire
`prepareArchitecture().publish()` or Architecture `--record` only through a
separate adopted transition preserving old readers/data/callers.

### F.6. Validation, documents and adoption

For new behavior, write the failing BDD case first, then focused TDD. Characterize
preserved behavior first. Reuse existing process/snapshot/coverage/provenance
contracts, support doubles/drivers and path registry. Validate real pinned-tool
and image-export capability where needed; doubles do not establish that capability.
Meaningful completion cases include:

- Default command/output/exits/structural publication remain compatible, including
  partial failures and completed goal misses.
- Exact raw values/bounds, identities, history extract and all numeric/design/AUTO
  cases agree with manual results; preserve MI-only warnings and original exits.
- Assess starts no prohibited operation. Tampered inputs, wrong ancestor/cut,
  false policy trust and missing proof cannot become an eligible completed result.
- Preparation/final phases, no hash cycles, output/deletion checks, B-record reuse
  after render failure, fresh-prefix refusal and all retry branches work.
- Sound bounds/proved exclusions can resolve adopted numeric decisions despite
  legacy absent-capture unavailable, while original statuses/exits remain and
  actual required operation failures still block AUTO and merge.
- Final decisions bind the assessment; no report rewrite/merge/approval is hidden
  in collection, calculation, export or history handling.

Use selected tests only. CURRENT command forms include `pnpm run build` and
`pnpm exec node --test dist/test/unit/script/ast-metrics-process.test.js`.
That focused example is not the complete selection: changed tests also select
their applicable whole groups under the gate policy. No script-only `pnpm test`
or `pnpm run check`; defer live collectors unless collection scope permits them.
No tests solely for prose. Use A.5's caller/removal evidence before removing
repeated reads; preserve standalone consumers, provenance/loader/seal guards,
constant-module/input-change checks, baseline/backfill and historical readers.

At adoption, activate the root guide and AGENTS/other-doc handoff together.
Root owns live policy/procedure; transfer B's operations and mark this plan/B
historical with a root link. Keep test selection in the test gate policy,
measurement formulas/formats/limits in the metrics guide, and exact CLI/help/exits
in the script README. Reconcile inventories/help through the existing
`test/acceptance/script/script-readme.test.ts`; update knip, the module-path
registry, `docs/testing/test-list.md` and documentation/script indexes as applicable.
Do not keep competing active rule tables. Record removed copies and replacements.

Future AGENTS excerpt, not active text or a claim the root file exists:

```markdown
Follow [CODE_QUALITY_PLAYBOOK.md](CODE_QUALITY_PLAYBOOK.md) for code-quality
preparation, reports, assessment and accepted history. Select checks from the
complete candidate under the test gate policy. Complete local requirements
before Ready; freeze final evidence and get required human decisions. Owner
review and merging remain manual; no agent PR reviewer runs. Recheck before
one owner merge, then record accepted facts.
```

Update AGENTS' quality PR bullet and replace its old seven-step quality section;
resolve report-paste wording with the short PR view. Retain collaboration/general
PR rules and reconcile board wording with manual owner merge/one merge. Workers
still neither open nor merge PRs. Use pnpm without changing package scripts.

Adoption needs section 8's trial/gap criteria, accountable owner, evidence/archive
retention and backup/recovery proof. A mismatch/false evidence pass stops adoption;
trial size is not safety proof. AUTO live execution still needs D's separate
qualification. Equivalent tool rollback can have owner review while adopted
manual rules remain. Weakening/bypass/material tradeoff needs architect and owner
decisions under section 4. Preserve immutable evidence, P/origin/best anchors and
append corrections; never reset history or run competing writers. Stop decisions
that depend on invalid evidence. Keep every merge manual.

### F.7. Slice 1 implementation record

The owner authorized the characterization slice on 2026-10-20. This slice
preserves current behavior; it activates no proposed policy or command. The
remaining slices stay pending. [PR #201](https://github.com/tomer-mayara/Thermus/pull/201)
holds the changes and validation evidence. Merging remains manual.

F.8 records the later exact-snapshot CLI sub-slice; the remaining proposals
still await their own implementation and adoption.

Existing tests already cover the default CLI/help, exact four-section report,
graphs/notices, goal misses, partial failures, coverage choices and structural
publication. Reuse them instead of adding duplicate cases:

| Contract | Existing test file under `test/` |
| --- | --- |
| Parser/help, stage outcomes and report formatting | `unit/script/ast-metrics-process.test.ts` |
| Default stdout, saved report, graphs and base record | `acceptance/script/ast-metrics-process.test.ts` |
| Coverage reuse, missing/stale evidence and explicit fixture collection | `acceptance/script/ast-metrics-process-coverage.test.ts` and `ast-metrics-process-collection.test.ts` |
| Goal misses and failed stages | `acceptance/script/ast-metrics-process-failures.test.ts` |
| Existing history stays immutable | `unit/script/ast-metrics-architecture-trend-store.test.ts` and `acceptance/script/ast-metrics-architecture-trend.test.ts` |
| Help and document inventories agree | `acceptance/script/script-readme.test.ts` |

The slice adds one failure/retry case to the existing process-failures file.
An output path that is a directory makes the final Markdown write fail. The
command must exit 1, keep complete stdout and retain its valid base record.
A retry to a file must exit 0, save the printed report and preserve the record
bytes. The existing goal-miss case now also checks saved-report/stdout equality.
These are passing characterization cases, with no production edit or artificial
failing step. No new harness, test file or runtime interface is needed.

The acceptance run also exposed timing errors in existing fetch-url tests.
A follow-up waits for the server's abort signal before checking its count and
separates the OAuth timeout case from the browser cancellation case. The tests
keep their output, cancellation, retry and recovery assertions. Production
behavior stays unchanged.

The changed acceptance files select the acceptance group. Run those files locally
before commit, the existing focused process unit characterization, and the
README contract. Because no `src/` file changes, this slice does not select the
full ordinary suite. It selects no complete unit group or live coverage
collector. Current habit-hooks and metrics review requirements still apply
before Ready.

### F.8. Exact snapshot CLI implementation record

This small Observe sub-slice is on
[PR #201](https://github.com/tomer-mayara/Thermus/pull/201). It exposes the existing
exact-commit snapshot owner through `--commit <FULL_SHA>`. The SHA must contain
40 lowercase hexadecimal characters and identify a commit. `--base` and
`--commit` are mutually exclusive; argument rejection occurs before tools run.

Default output is `ast-report/snapshot-commit.json` at the repository root;
`--out` resolves from the current folder. The command analyzes the exact committed
tree through unchanged `snapshot/commit.ts` and its temporary-worktree cleanup.
It starts no implicit build, test or coverage run. Snapshot schema, working-tree
default, `--base` merge-base behavior, routes and manual merge policy stay unchanged.
Raw file/class additions, image export, assessment/report integration and policy
adoption remain pending.

That scope statement records the exact-CLI slice. F.9 records the later additive
raw file MI field; class/assessment/image capabilities remain pending.

Validation on 2026-10-20:

- The existing snapshot baseline passed 50 checks before code changed. The new
  acceptance case failed for the unsupported option; parser cases then failed
  and passed as validation was added. The final focused snapshot set passed 61
  checks. Removing one redundant comment later left all 31 focused parser,
  snapshot-build and exact-commit checks green.
- The full unit group passed 3,928 compiled checks and 23 portal checks. All
  three snapshot checks passed with the real pinned ast-metrics 0.43.1. The
  README/help and inventory contract passed all 18 checks.
- The required acceptance command passed 901 of 904 compiled checks. Two search
  cases from `main` fail because the public search tool is not registered. The
  unchanged MCP timeout case reported zero tool calls instead of one. Its full
  focused file passed all 16 checks, but that does not make the group pass.
  The backend failures stopped the command before portal acceptance; all 18
  portal checks passed in a separate selected run. No assertion or timeout was
  relaxed, and no test was skipped.

No `src/` file changed against base `304cd24fd0f198716c372bd2ec404eeffc12a132`.
Changed test files selected the unit and acceptance groups, plus the snapshot
live contract. No coverage collector was needed. Local code review found no
correctness or scope issue. Current habit-hooks and four-section metrics evidence,
with each retained finding explained, are recorded on PR #201. The failed
acceptance gate keeps the PR in Draft. The owner still merges manually after
the required checks pass.

### F.9. Raw file MI implementation record

This Observe sub-slice adds optional `SnapshotFile.maintainabilityRaw?: number`
to the existing version-1 snapshot. No flag is needed. Native file MI from
`concernedFiles[].maintainability.maintainabilityIndex` is preserved beside
unchanged rounded `maintainability`. Keep finite precision and zero; impose no
assumed upper clamp. Missing MI omits the raw field. Legacy or missing raw data
stays unavailable, never reconstructed from rounded MI. Present malformed or
nonfinite native MI for a `src/` file rejects capture before publication.
Out-of-scope entries remain ignored.

The manager's pre-implementation native probe with pinned ast-metrics 0.43.1
reported application file MI `56.17474697614129`. This proves a native file value
can be obtained before wrapper rounding; it is not final snapshot validation.
The existing architecture reader ignores the new field, so displays, trends and
process results retain rounded data. A future assessment needs a reader that
retains and validates raw MI; this slice does not add it or raw function MI.
Typed raw class identity/completeness, image export, assessment and policy
adoption remain pending. Coverage, routes and manual merge rules do not change.

The new ordinary `ast-metrics-snapshot-raw-mi.test.ts` acceptance file covers raw
versus rounded file values, refusal before publication and legacy/enriched
architecture compatibility. Existing snapshot unit and live contracts cover
finite/zero/missing/invalid inputs and comparison with pinned native file MI.
Validation on 2026-10-20:

- The pre-edit baseline passed 76/76 checks. The new CLI acceptance case first
  failed because raw MI was absent instead of 84.96. Unit cases first failed for
  absent raw zero and accepted malformed null. The final focused set passed 83/83.
- `pnpm run test:unit` passed 3,932 compiled and 23 portal checks, 3,955 in total.
  Full acceptance passed 905/907 compiled checks. The two existing search cases
  from main still fail because the public search tool is absent. The previously
  intermittent 300 ms MCP case passed in this full run.
- The acceptance command stopped before its portal phase; all 18 portal checks
  passed in a separate selected run. README/help/inventory checks passed 18/18
  within full acceptance; these are not an extra acceptance group result.
- Pinned ast-metrics 0.43.1 snapshot live checks passed 3/3, including independent
  exact native-value comparison. Structural architecture live with `--no-coverage`
  passed 1/1. These completed runs had no skipped, cancelled or todo tests.

The independent local auditor and manager found no correctness or scope issue
in this slice. No `src/` file changed; broader groups and coverage collection
were not selected. The two required failures keep PR #201 in Draft. Current
habit-hooks and full-process evidence will be recorded on the PR. Merging stays
manual after required checks pass.

## References

These sources support the plan and explain existing behavior. They are not extra
approval steps or permission to run every command they describe.

- [AGENTS.md](../../AGENTS.md), [test gate policy](test-gate-policy.md),
  [test layout](../testing/test-code-layout.md), and [metrics guide](ast-metrics-review.md).
- [Metrics change request](ast-metrics-change-request.md),
  [AST rules](../../.ast-metrics.yaml), [lint baseline](../../.ast-metrics-baseline.yaml),
  and [existing import guards](../../.habit-hooks/eslint.config.mjs).
- [Auth package map](../archive/auth-refactoring-plan.md#logical-packages-and-dependency-rules),
  [auth boundary tests](../../test/acceptance/architecture/auth-boundaries.test.ts),
  and [page-fetch boundary tests](../../test/acceptance/architecture/page-fetch-boundaries.test.ts).
- Replay cases: [#193](https://github.com/3-headed-monkey/Thermus/pull/193) loader coverage;
  [#194](https://github.com/3-headed-monkey/Thermus/pull/194) UI and constant modules;
  [#195](https://github.com/3-headed-monkey/Thermus/pull/195) MCP guides and exceptions;
  [#196](https://github.com/3-headed-monkey/Thermus/pull/196) parser complexity;
  [#197](https://github.com/3-headed-monkey/Thermus/pull/197) fetch diagnostics;
  [#198](https://github.com/3-headed-monkey/Thermus/pull/198) metrics policy.
  PR #198 merged before #197. Old PR-body status alone proves no final test result.
- [Original CRAP article](https://www.artima.com/weblogs/viewpost.jsp?thread=215899)
  and [GMetrics definition](https://dx42.github.io/gmetrics/metrics/CrapMetric.html):
  Thermus' own-character share and target 15 are project choices.
- [Thoughtworks fitness functions](https://www.thoughtworks.com/insights/articles/fitness-function-driven-development)
  and [ArchUnit frozen rules](https://www.archunit.org/userguide/html/000_Index.html#_freezing_arch_rules):
  use repeatable checks for explicit design properties and distinguish old debt from new decline.
- [Google coverage guidance](https://testing.googleblog.com/2020/08/code-coverage-best-practices.html):
  execution coverage does not establish assertion quality.
