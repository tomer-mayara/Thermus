# PR review playbook

Status: approved process implementation, 2026-10-21. This playbook adopts the
[process proposal](../design/pr-process-proposal.md). [AGENTS.md](../../AGENTS.md)
and the [test gate policy](test-gate-policy.md) give the required work. The
[rules file](pr-review-rules.yaml) and
[checker](../../script/pr-review/README.md) classify mechanical facts. Semantic
claims need explicit evidence and human assessment when required.

Review tier and merge eligibility are separate. The manager or Delamain
session runs the local process and verifies the complete current candidate.
The checker result alone does not prove completed checks, human approval,
or merge authority.

## Select the highest matching tier

Use these names in policy, tools, labels, templates, and reports:

| Tier | Required review |
| --- | --- |
| T0 Auto merge | No human approval. An authorized agent or session can merge after all merge conditions pass. |
| T1 Team review | An independent authorized team member or owner approves the complete candidate. |
| T2 Need architect | An independent authorized architect approves the complete candidate and its architecture impact. The owner can act as architect. |

The author proposes a tier and records every matching reason. Apply the highest
one. Anyone can escalate. An ambiguous classification needs at least T1 Team
review; unresolved architecture questions need T2 Need architect and block
eligibility until the impact is clear. De-escalation requires a reason and an
independent reviewer authorized for the higher tier. Keep the previous tier and
reasons in the review evidence when recording an approved de-escalation. It
cannot remove a blocker or waive a required check.

### T2 Need architect

Use T2 Need architect for a change that:

- Adds or removes a C4 container, or changes its responsibility or communication.
- Adds, removes, replaces, or materially changes an external integration.
- Changes an observable contract across containers or with an external client,
  including inputs, outputs, errors, compatibility, or important guarantees.
- Changes deployment relationships, isolation, availability, shared resources,
  or recovery guarantees.
- Changes trust boundaries, data ownership, or an architecture-wide pattern for
  authentication, resilience, or data handling.

Examples include a new background worker, a replacement identity provider, a
changed portal/server account contract, or a changed renderer public-destination
guarantee. A lasting decision needs a decision record when the authorized
architecture decision maker requires it. A T2 Need architect classification by
itself does not require an ADR for every change. Record the decision and the
guarantee in the pull request; link an ADR or explain why none is needed.

### T1 Team review

Use T1 Team review when no T2 Need architect reason applies and the change:

- Adds or removes a component, or materially changes its responsibility.
- Changes an interface, collaboration, or dependency between components within
  a container.
- Materially changes sensitive local behavior, data integrity, or recovery while
  preserving approved architecture guarantees.
- Adds a runtime library, or changes a library with material effects on behavior,
  security, data handling, or recovery.
- Changes development process, approval rules, quality policy, or their tools.
- Needs human assessment of metric findings or a permitted metric exception.

A static protected-path or public-surface touch is a conservative T1 Team review
floor, including contract and deployment files. It does not establish that an
observable contract or topology changes. Team review checks those questions
against evidence and escalates actual architecture changes to T2 Need architect.
Uncertain impact blocks eligibility. Answer each applicable policy question and
state the new rule or the guarantee that remains accurate. Size, fewer tests,
added skips or todos, an MI drop, and retained high findings need team
assessment; these signals do not by themselves prove an architecture change.
Keep the existing thresholds in the trusted rules.

### T0 Auto merge

Use T0 Auto merge for contained changes with no higher-tier reason, such as a
private helper refactor that preserves behavior, a focused test, an ordinary
prose correction, or a configuration correction with no material boundary or
sensitive-behavior effect. A routine compatible library patch can be semantically
low risk. Dependency-file changes still have a T1 Team review floor under the
rules. Obtain that human approval, or an authorized de-escalation, then let the
authorized local session merge when the normal merge conditions pass.

File type alone does not decide the tier. Documents can define contracts,
configuration can change trust, and tests can weaken enforcement. Every tier
needs an architecture impact check.

## Establish merge eligibility

Eligibility is `eligible` or `blocked`, not another tier. For the complete
current candidate, all tiers require:

- Applicable tests, dependency checks, contract checks, quality checks, and build
  gates pass under the trusted selection policy.
- Architecture impact is recorded using the
  [component registry workflow](component-registry-workflow.md).
- No hold, forbidden dependency, undeclared fact, required unresolved finding,
  or missing evidence remains.
- Required independent human approvals cover the current head SHA and scope.
- The candidate is mergeable and every required local check has a recorded pass.

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

Historical rules remain authoritative for their candidate. The compatibility
adapter preserves legacy higher-review requirements as T2 Need architect and
legacy failure results as blockers. This conversion is only for historical
input; it does not turn ordinary policy changes under the new policy into
architecture changes. In particular, this migration cannot lower its own review
requirement through the new HEAD rules.

Dependency checks use the complete source graph, including static, re-export,
side-effect, dynamic, and type imports. Declare permitted new facts or remove
them. Remove forbidden edges, new cycles, and growth of known cycles; a
candidate declaration cannot permit them. The static checker lists affected
public-surface modules; it does not emit or compare declaration snapshots and
cannot prove an observable contract change from a file touch. Compare relevant
exported declarations and behavior before and after the change, then explain
whether observable guarantees change. The semantic impact evidence selects
T2 Need architect when an actual cross-container or external contract changes.

Keep the approved absolute metric goals: production-file MI 85, each added or
changed function below CRAP 30, and each added function at CRAP 15 or less. Use
the existing checker and exception mechanism, with supported bounds where they
prove a goal. An existing-file MI signal keeps its approved review threshold.
MI is a file measure and CRAP is a function measure. Optional LOC-weighted
component MI and counts of functions at CRAP 30 or more do not create a component
CRAP score. No new component delta or percentage rule applies. Head-derived base
CRAP is an estimate; it is not measured base coverage.

## Record and retain the result

Use the [pull request template](../../.github/pull_request_template.md). Record
the current tier, all reasons, blockers, architecture impact, selected checks,
relevant changed file/function metrics, and exceptions. Explain N/A results.
Retain complete reports as accessible artifacts or links, including graphs,
legends, import evidence, and limitations. A short pull request summary does not
shrink the analysis graph or remove required evidence. It replaces the previous
requirement to paste every complete metrics report into the pull request body.
The new process paths are `src/**`, `script/code-quality/**`,
`.ast-metrics.yaml`, `.ast-metrics-baseline.yaml`, and
`.code-quality-exceptions.yaml`. Source changes need full production evidence;
source-free metric-tool changes need process/review with relevant checks. Other
source-free changes, including prose, PR checker, and policy scripts, can mark
production metrics N/A and use relevant build, type, lint, or manual checks and
habit-hooks. Historical base rules retain broader process requirements for their
candidate. Follow the [metrics guide](ast-metrics-review.md) and test selection
policy.

Canonical tier labels use the exact names T0 Auto merge, T1 Team review, and
T2 Need architect. Labels describe the result; they do not grant approval or
eligibility. Keep the highest recorded tier unless an authorized independent reviewer for
that tier approves a reasoned de-escalation. Recompute after every change.
The manager reviews each subagent's work. An agent cannot supply required human review.

## Complete the local process

The manager or Delamain session confirms the selected checks, impact declaration,
metrics where applicable, current-candidate human approvals for T1 Team review
and T2 Need architect, and all holds before merge. T0 Auto merge needs no human
review. An authorized agent or session can merge an eligible clean candidate
once, within the user's request. The owner merges a candidate that adds an ADR.
A request for a draft stops before Ready and merge.
