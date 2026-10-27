# PR review playbook

Status: approved process implementation, 2026-10-21. This playbook adopts the
[process proposal](../design/pr-process-proposal.md). Since 2026-10-24,
architecture facts select the tier, as the
[design record](../design/pr-review-architecture-facts.md) explains.
[AGENTS.md](../../AGENTS.md) and the [test gate policy](test-gate-policy.md)
give the required work. The [rules file](pr-review-rules.yaml) and
[checker](../../script/pr-review/README.md) classify mechanical facts. Semantic
claims need explicit evidence and human assessment when required.

Review tier and merge eligibility are separate. The manager or Delamain
session runs the local process and verifies the complete current candidate.
The checker result alone does not prove completed checks, human approval,
or merge authority.

## Select the highest matching tier

Use these full canonical names in policy, tools, checker output, and labels.
The main PR summary displays only T0, T1, or T2:

| Tier | Required review |
| --- | --- |
| T0 Auto merge | No human approval. An authorized agent or session can merge after all merge conditions pass. |
| T1 Team review | An independent authorized team member or owner approves the complete candidate. |
| T2 Need architect | An independent authorized architect approves the complete candidate and its architecture impact. The owner can act as architect. |

The checker establishes architecture facts from the code and the rules of the
merge base and HEAD. A fact selects the tier. A file path alone does not call
an architect. Quality signals inform the author and call no human. The author
records every matching reason and applies the highest one. Anyone can escalate.
An ambiguous classification needs at least T1 Team review; unresolved
architecture questions need T2 Need architect and block eligibility until the
impact is clear. De-escalation requires a reason and an independent reviewer
authorized for the higher tier. Keep the previous tier and reasons in the review
evidence when recording an approved de-escalation. It cannot remove a blocker
or waive a required check.

### T2 Need architect

Any one of these facts selects T2 Need architect. The checker establishes facts
a to e and g from the two revisions. Fact f comes from the committed
`.pr-impact.json`.

| Fact | Reason key | How the checker sees it |
| --- | --- | --- |
| a. The component set changes | `architecture.component_set` | `dependency_graph.components` differs between the rules of the merge base and of HEAD: an ID is added or removed, or a root moves. |
| b. A dependency between components is added | `architecture.dependency_added` | `dependency_graph.allowed_edges` gains an entry, or a type-only edge becomes runtime. An edge that the rules do not list stays blocked. |
| c. A module joins the public surface | `architecture.public_module_added` | `public_surface` gains a module: a file becomes a contract between components or with the outside. |
| d. The declarations of a public module change | `architecture.declarations_changed` | The committed snapshot of the module under `docs/api-surface/` differs between the merge base and HEAD. The report gives the unified diff. |
| e. A registry view changes | `architecture.registry_view_changed` | A Mermaid block of `architecture/components.md` is added, removed, or edited. A prose edit is not a fact. |
| f. An architect flag | `impact.<flag>` | `.pr-impact.json` sets an architect flag of the next table. |
| g. A decision record | `architecture.decision_record` | A file is added under `architecture/decisions/`. The owner merges the pull request. |

Set each flag that matches the change, also when the checker finds no fact.
Flags cover what code cannot show: topology, external systems, runtime order,
and authority. A flag can raise the tier. It cannot lower it.

| Architect flag | The change |
| --- | --- |
| `container` | Adds or removes a C4 container, or changes its responsibility or communication. |
| `external` | Adds, removes, replaces, or materially changes an external integration. |
| `contract` | Changes an observable contract across containers or with an external client, including inputs, outputs, errors, compatibility, or important guarantees. |
| `deployment` | Changes deployment relationships, isolation, availability, shared resources, or recovery guarantees. |
| `crossCutting` | Changes trust boundaries, data ownership, or an architecture-wide pattern for authentication, resilience, or data handling. |
| `component` | Adds or removes a component, or materially changes its responsibility. |
| `internalInterface` | Changes an interface, collaboration, or dependency between components within a container. |

A fact a to e or g with every architect flag false is blocked
(`architecture.undeclared_fact`) until the declaration names the change. The
declaration summary is the first sentence that the architect reads.

An added export of a public module is fact d. Keep public modules small, or list
the smaller contract file in `public_surface` instead of a busy file.

Examples include a new background worker, a replacement identity provider, a
changed portal/server account contract, or a changed renderer public-destination
guarantee. A lasting decision needs a decision record when the authorized
architecture decision maker requires it. A T2 Need architect classification by
itself does not require an ADR for every change. Record the decision and the
guarantee in the pull request; link an ADR or explain why none is needed.

### T1 Team review

Use T1 Team review when no T2 Need architect fact applies and any one of these
reasons applies:

| Reason | Scope |
| --- | --- |
| Policy path | `AGENTS.md`, `CLAUDE.md`, `.github/**`, the rules file, this playbook, the registry workflow, `script/pr-review/**`, `script/code-quality/review/**`, `script/component-ownership.ts`, `.habit-hooks/**`, `.ast-metrics.yaml` |
| Read path | `.code-quality-exceptions.yaml`, `.ast-metrics-baseline.yaml`, `.agent/**`. The test gate policy and the metrics review guide count only when the diff removes lines from them. |
| New third-party code | A component gains an npm package or a Node builtin in `allowed_external_imports` or `allowed_node_builtins`. `package.json` gains or loses a dependency key. `pnpm-workspace.yaml`, `patches/**`, `tsconfig*.json`, `.npmrc`, `.nvmrc`, or `.gitmodules` changes. |
| Deploy and data | `Dockerfile*`, `.dockerignore`, `compose.yaml`, `docker/**`, `migrations/**`, `.env.example` |
| Security guarantee | The 18 entries of `protected_paths.security`: files whose behavior is a guarantee even when their declarations stay the same |
| Client contract file | `src/index.ts` and `src/interfaces/mcp/fetch-tool-schema.ts` (`protected_paths.contracts`) |
| Contract document | `docs/reference/**`. A prose edit cannot be told from a contract edit. |
| Fewer test cases | The diff removes more test cases than it adds. |
| Metric exception | The candidate uses a permitted entry of `.code-quality-exceptions.yaml`. |
| Team flag | `.pr-impact.json` sets a team flag of the next table. |

| Team flag | The change |
| --- | --- |
| `sensitiveBehavior` | Materially changes authorization, session behavior, other sensitive local behavior, data integrity, or recovery, while the approved architecture guarantees stay. |
| `dependencyRisk` | Adds a runtime library, or changes a library with material effects on behavior, security, data handling, or recovery. |
| `policy` | Changes the development process, approval rules, quality policy, or their tools. |

Answer each applicable policy question and state the new rule or the guarantee
that remains accurate. Team review checks the evidence and escalates an actual
architecture change to T2 Need architect. Uncertain impact blocks eligibility.

### T0 Auto merge

Use T0 Auto merge when no T2 Need architect fact and no T1 Team review reason
applies. Examples are a change inside a component, a private helper refactor
that preserves behavior, UI and CSS, a focused test, an ordinary prose
correction, an internal edit of a public module whose declarations stay
identical, a version-only dependency bump, and a registry prose fix. An
authorized agent or session merges after all merge conditions pass.

File type alone does not decide the tier. Documents can define contracts,
configuration can change trust, and tests can weaken enforcement. Every tier
needs an architecture impact check.

### Notes without a tier

The checker reports these signals as notes. They inform the author and call no
human. Record the reason for each note in Quality review:

- more than 400 production lines, or more than 1,500 total lines without
  generated files;
- an MI drop of five or more on an existing production file;
- a retained high review finding on a changed production file;
- a public module that the candidate touches while its declarations stay
  identical;
- a removed allowed edge or a removed public module;
- a version-only dependency change or a lockfile-only change.

### Stacked pull requests

A stacked pull request takes its tier from the increment against its actual
parent. Run the checker with `--base` set to the parent branch, and stamp the
impact declaration with the same merge base. The impact flags describe the
increment. The architecture of the parent is reviewed with the parent.
Validation keeps the complete candidate against main visible: the test
selection and the checks cover every change against `origin/main`. Merge the
stack bottom-up, so that no increment lands before its parent.

## Establish merge eligibility

Eligibility is `eligible` or `blocked`, not another tier. For the complete
current candidate, all tiers require:

- Applicable tests, dependency checks, contract checks, quality checks, and build
  gates pass under the trusted selection policy.
- Architecture impact is recorded using the
  [component registry workflow](component-registry-workflow.md).
- No hold, blocker of the next list, required unresolved finding, or missing
  evidence remains.
- Required independent human approvals cover the current head SHA and scope.
- The candidate is mergeable and every required local check has a recorded pass.

These results block merge at every tier:

- a forbidden edge; an undeclared edge, component, external import, or public
  module; a new cycle or a grown known cycle;
- a stale, missing, orphan, or unverified declaration snapshot;
- an architecture fact a to e or g while every architect flag is false;
- a new skip or todo marker in a test: fix or delete the test;
- a new production file below MI 85, or a CRAP goal miss, without a permitted
  exception; an expired exception for a changed unit;
- a non-empty habit-hooks snooze file;
- the `uncertain` flag, a missing impact declaration, or missing required
  metric evidence.

Missing, pending, skipped, cancelled, failed, or unavailable required checks are
not passes. N/A needs a reason allowed by trusted selection. A permitted metric
exception must identify its unit, metric, bound, reason, and expiry under the
existing exception policy. It needs T1 Team review, or T2 Need architect when
architecture independently requires it. Neither approval nor an exception can
waive a tool failure or missing required evidence.

The reviewer must be a human authorized for the tier and independent of the
author. One qualified architect can cover both team and architecture concerns.
An agent-generated approval, an owner-account action, a review request, or an
`approved` label alone does not establish trusted human approval. Record and
verify human identity and the reviewed SHA. Refresh evidence and approvals after
candidate changes. Return a Ready pull request to Draft before a fix.

## Use trusted policy and complete evidence

The checker reads classification rules from the trusted merge base and facts
from the candidate. A pull request cannot exempt itself by changing its rules,
label, impact claims, or check selection. Commit the root
`.pr-impact.json` with `version`, `classification`, and `architecture`, including
all semantic fields, architecture summary, checked views, and evidence. The
file must differ from the trusted base so stale declarations cannot be reused.
The manager or Delamain session reads that committed file and stamps actual
base and head identities for the checker. Mutable pull request prose cannot change
scope while retaining approvals for the same head. For local checks, stamp a
copy as `ast-report/impact.json` under the
[checker guide](../../script/pr-review/README.md). Missing impact evidence
requires at least T1 Team review and blocks eligibility. Mechanical checks do
not prove the truth of semantic claims.

Historical rules remain authoritative for their candidate. A merge base whose
rules predate 2026-10-24 keeps the earlier outcomes for its candidate: a touched
public module, a size limit, an MI drop, a retained high finding, a new skip or
todo marker, and a declared dependency fact are T1 Team review there, and
`component` and `internalInterface` are team flags. The pull request that
adopted the facts rules was classified under the earlier rules: T1 Team review
for its policy paths. The compatibility adapter preserves legacy higher-review
requirements of version 1 rules as T2 Need architect and legacy failure results
as blockers. This conversion is only for historical input; it does not turn
ordinary policy changes into architecture changes.

Dependency checks use the complete source graph, including static, re-export,
side-effect, dynamic, and type imports. Declare permitted new facts or remove
them. A declared component, edge, or public module is an architecture fact. A
declared npm package or Node builtin is new third-party code. Remove forbidden
edges, new cycles, and growth of known cycles; a candidate declaration cannot
permit them.

Each module of `public_surface` has a committed declaration snapshot under
`docs/api-surface/`. When the exports of a public module change, run
`pnpm exec node script/pr-review/api-surface.ts` and commit the files. The
checker regenerates the snapshots at HEAD and blocks when a committed file is
stale, missing, or an orphan. It reads the committed snapshots of the merge base
from git and reports each module whose snapshot differs, with its unified diff,
as fact d. The checker compares the text of the declarations; the human
compares their meaning. Read each diff, check the behavior behind it, and record
whether an observable guarantee changes. A touched module with identical
declarations is a note. A file name alone never proves a contract change.

Keep the approved absolute metric goals: production-file MI 85, each added or
changed function below CRAP 30, and each added function at CRAP 15 or less. Use
the existing checker and exception mechanism, with supported bounds where they
prove a goal. An MI drop of five or more on an existing file is a note; record
its reason in Quality review. MI is a file measure and CRAP is a function
measure. Optional LOC-weighted component MI and counts of functions at CRAP 30
or more do not create a component CRAP score. No new component delta or
percentage rule applies. Head-derived base CRAP is an estimate; it is not
measured base coverage.

## Record and retain the result

### Report layout

Use the [pull request template](../../.github/pull_request_template.md). Keep one
short main description and exactly two maintained supporting comments titled
**Validation** and **Quality review**. The main description explains the change
and the review decision; the comments retain the evidence needed to assess it.
This layout changes evidence placement only. It does not reduce checks,
thresholds, review authority, merge conditions, or the requested stopping point.

#### Main description

Aim for 200–300 words, excluding Mermaid. This is a soft target: never omit a
material fact to meet it. Use this order:

1. **Description:** two or three sentences on the problem, result, and any
   material behavior or delivery limit. For a stack, add a parent PR link.
2. **Review:** display T0, T1, or T2 and the generated reason line: the
   `Architecture:` line of the checker report (`architecture.summary` in the
   JSON output). When a reason outside the facts drives the tier, such as a
   policy path, name it too. Then copy the **Architecture facts** list of the
   checker report: one bullet for each fact, with the declaration diffs folded
   in a `<details>` block. Then give the summary of the committed
   `.pr-impact.json`. Keep unresolved blockers, required
   decisions, and required current-candidate human approval visible here.
   State eligibility separately as the overall merge status: pending required
   human approval means blocked, even if the local checker reports eligible.
   Full canonical checker and label names remain unchanged.
3. **Architectural impact**, an optional subsection under Review: a short
   impact statement. If production architecture is unchanged, one sentence in
   Review can replace both optional subsections; keep the full assessment in
   Quality review. No diagram is required for unchanged architecture.
4. **Architecture comparison**, an optional subsection under Review, required
   when the checker reports fact a, b, c, or e or an architect flag applies, and
   useful in other tiers when needed: follow the diagram guide in
   [AGENTS.md](../../AGENTS.md#architecture-comparison). For fact d alone, the
   folded declaration diffs and three or four short before/after behavior notes
   are sufficient; no drawing is required. Keep the focused L3 view with a
   named L2 boundary and three or four short before/after behavior notes here.
   Name the comparison base and stack parent beside the drawing.
   Keep material authority, payload, failure phase, ordering, recovery, replay,
   lifetime, and delivery limits beside the drawing. A diagram
   cannot replace those conditions. Put detailed provenance below.
5. A footer with the current short SHA linked to the full commit, and direct
   links to Validation and Quality review.

For a stack, classify and compare the increment against the actual parent, as
"Stacked pull requests" above says. Name the parent and its merge base beside
the facts and the drawing. Give concise inherited metric dispositions and full
report links instead of repeated full-stack metric tables. Retain every
required finding and exception reason.

Keep one authoritative comparison. Do not repeat it in an architecture comment.
If technical access prevents editing the description, use one maintained summary
comment with the same layout and links. Do not claim that a later comment can
be inserted first in chronological order. State where the current summary is.

#### Supporting comments

Update the same two comments for each candidate; do not post a new pair after
each check or fix. Pin full candidate and applicable base SHAs. Mark evidence
from an earlier candidate as stale until verified for the new one. Preserve
prior evidence, failures, and approval/de-escalation history in linked versions
or an audit record; replacing a comment must not erase that history. Approval
for an earlier SHA is history, not approval for the current candidate.

Use accessible evidence URLs: pinned repository files, uploaded reports, or
retained artifacts that reviewers can open. A local path such as `/Users/...`
is not a GitHub artifact link. Check links and read back the published summary
and both comments. If evidence cannot be shared, state that limit and keep any
resulting missing-evidence blocker visible.

The following sketches show placement. Omit irrelevant fields with a reason,
combine related checks, and keep every applicable item from the policy.

```markdown
## Validation

Candidate: <full head SHA and commit link>
Bases: <trusted-main merge base; actual parent merge base for a stack>
Selection: <complete-candidate paths, selected checks, and policy basis>

| Check | Status and result | Evidence |
| --- | --- | --- |
| <selected command or manual check> | <pass/fail/pending; useful result> | <accessible link> |

Failure and retry history: <failed attempts, fixes, and rerun results; audit link>
N/A and deferred checks: <each reason allowed by trusted selection>
Coverage provenance: <candidate, selected suites, report origin and compatibility, or N/A>
Environment and delivery limits: <limits on what the results establish>
Prior candidate evidence: <version/audit links; mark stale evidence>
```

```markdown
## Quality review

Candidate: <full head SHA and commit link>
Bases: <trusted-main merge base; actual parent merge base for a stack>
Tier: <full canonical name; all reasons; for a stack, those of the increment>
Eligibility: <result and blockers; local checker is preliminary>
Impact: <committed .pr-impact.json link; base/head-bound check evidence>
Policy answers: <applicable questions, before/after guarantees, and evidence>
Metrics: <changed file/function results or trusted N/A reasons; full report links>
Notes: <each informational note of the checker and its reason>
Retained findings and exceptions: <each required reason, score/bound, path,
coverage/classification, expiry and exception entry where required>
Habit-hooks: <result; each retained enforced smell and its reason; empty snooze>
Human approval: <required role, verified identity, current SHA/scope, or pending>
De-escalation: <previous tier/reasons, authorized approval, or none; audit link>

<details>
<summary>Architecture assessment and comparison provenance</summary>

<Changed/checked registry views and why they remain accurate; registry edit status>
<Full pinned before/after revisions and links; all Mermaid blocks inventoried>
<Comparison and classification scope: the actual parent for a stack>
<Each declaration diff and whether its meaning or behavior changes>
<Source, contract, caller, and test evidence; relevant L2/deployment effects>
<L4 include/omit rationale and strongest changed contract/review question>
<Versioned Mermaid sources, renders, normal-width inspection, byte-for-byte check>
<Manager review, feedback, fixes, rerender checks, and evidence limits>
<ADR or reason none is needed; production architecture unchanged when applicable>

</details>

Reports and history: <accessible full reports, exceptions, versions, approval audit>
```

Keep graphs, legends, import evidence, and limitations in the full reports. A
short summary does not shrink the analysis graph or remove required evidence.
The process paths are `src/**`, `script/code-quality/**`, `.ast-metrics.yaml`,
`.ast-metrics-baseline.yaml`, and `.code-quality-exceptions.yaml`. Source changes
need full production evidence; source-free metric-tool changes need
process/review with relevant checks. Other source-free changes, including prose,
PR checker, and policy scripts, can mark production metrics N/A and use relevant
build, type, lint, or manual checks and habit-hooks. Historical base rules retain
broader process requirements for their candidate. Follow the
[metrics guide](ast-metrics-review.md) and test selection policy.

Canonical labels remain T0 Auto merge, T1 Team review, and T2 Need architect.
Labels do not grant approval or eligibility. Keep the highest recorded tier
unless an authorized independent reviewer for that tier approves a reasoned
de-escalation. Recompute after every change. The manager reviews each
subagent's work. An agent cannot supply required human review.

## Complete the local process

The manager or Delamain session confirms the selected checks, impact declaration,
metrics where applicable, current-candidate human approvals for T1 Team review
and T2 Need architect, and all holds before merge. T0 Auto merge needs no human
review. An authorized agent or session can merge an eligible clean candidate
once, within the user's request. The owner merges a candidate that adds an ADR.
A request for a draft stops before Ready and merge.
