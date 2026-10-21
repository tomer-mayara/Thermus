# Pull request process proposal

Status: proposal, not active. Date: 2026-10-21.
This document proposes a later process change. It implements no automation.
[AGENTS.md](../../AGENTS.md), the current [review rules](../implementation/pr-review-rules.yaml),
and existing workflows govern until a separate implementation is approved.

## Goal and tier names

Most low-risk pull requests should use T0 Auto merge. Human review should focus
on material behavior risk and architecture changes. The architecture record
must stay aligned with the code, using the current arc42 views and C4 conventions.
Architecture review is required when system shape, boundaries, or important
architecture guarantees change.

Use these three tier names in rules, tools, labels, templates, and reports:

| Tier | Review and merge behavior |
| --- | --- |
| T0 Auto merge | Merges automatically when all merge conditions pass. No human approval is required. |
| T1 Team review | An authorized team member or the owner approves the complete candidate. |
| T2 Need architect | An authorized architect approves the complete candidate and its architecture impact. The owner can act as the architect. |

The tier selects required review. Merge eligibility is a separate result:
eligible or blocked. These are statuses, not additional tiers. A pull request
can be T0 Auto merge and blocked, or T2 Need architect and eligible.

## Select the tier

The author proposes one tier and records every matching reason. Apply the
highest matching tier. Trusted mechanical checks verify facts they can establish,
including changed paths, public contracts, and dependency changes. They use the
pre-change policy from the trusted base; a pull request cannot weaken its own
review or merge requirements. Semantic claims still need supporting evidence.
An ambiguous classification cannot use T0 Auto merge. Resolve it through
T1 Team review, or T2 Need architect when an architecture question remains.

### T2 Need architect

Select T2 Need architect for a change that:

- Adds or removes a C4 container, or changes a container's responsibility or
  communication with another container.
- Adds, removes, replaces, or materially changes an external system integration.
- Changes an observable contract across containers or with an external client:
  inputs, outputs, errors, compatibility, or important guarantees.
- Changes deployment in a way that affects container relationships, isolation,
  availability, shared resources, or recovery guarantees.
- Changes trust boundaries, data ownership, or an architecture-wide pattern for
  authentication, resilience, or data handling.

Examples: replace WorkOS with another hosted identity service; add a background
worker; change the portal/server account contract; move installation data to a
shared service; change the public-destination guarantee of the renderer boundary.

### T1 Team review

Select T1 Team review when no T2 Need architect reason applies and the change:

- Adds or removes a component, or materially changes its responsibility.
- Adds, removes, or changes an interface, collaboration, or dependency between
  components within a container.
- Materially changes sensitive local behavior, data integrity, or recovery
  behavior while preserving the approved architecture guarantees.
- Adds a runtime library, or upgrades a library with material effects on
  behavior, security, data handling, or recovery.
- Changes the development process, CI, approval rules, quality policy, or the
  tools that enforce these rules.
- Needs human assessment of a metric finding or a permitted metric exception.

Examples: change collaboration between `page-fetch` and `html-processing`;
change local installation cleanup while preserving ownership and recovery
guarantees; change CI test selection or the metric exception policy.

### T0 Auto merge

Select T0 Auto merge for contained changes with no higher-tier reason. Examples
include a private helper refactor that preserves behavior, a focused test,
an ordinary prose correction, and a configuration correction with no material
effect on boundaries or sensitive behavior.

File type alone does not select T0 Auto merge. Documents can define contracts;
configuration can change trust or deployment; tests can weaken enforcement.
A routine compatible library patch can use T0 Auto merge when no higher-tier
reason applies. Assess its runtime effect and applicable checks.

## Conditions for merge

All tiers require the following for the complete current candidate:

- All applicable checks pass, including the selected tests and required
  dependency, contract, quality, and build checks.
- Architecture impact is checked and recorded, including for T0 Auto merge.
- No hold remains, and no forbidden dependency, required finding, missing
  declaration, or required evidence remains unresolved.
- Required human approvals are present and apply to the current scope.

Missing, pending, skipped, cancelled, failed, or unavailable required checks are
not passes. An intentional N/A must follow trusted check-selection rules.
Permitted, reviewed metric exceptions use the mechanism below; they cannot waive
tool failures or missing required evidence.

Requesting review does not satisfy approval. T1 Team review needs an authorized
human team member or owner. T2 Need architect needs an authorized human architect;
one qualified reviewer can cover both sets of concerns. Required human approval
must be independent of the pull request author.

Reclassify after fixes or other candidate changes. Refresh stale evidence and
affected approvals when the reviewed scope changes. Anyone can escalate a tier.
De-escalation needs approval from a reviewer authorized for the higher tier and
a recorded reason. Changing a tier never bypasses a failed check.

AI authors follow the same policy. An AI-generated approval or an owner-account
label alone does not prove human approval. Adoption must establish trusted human
identity and approval evidence before automatic merging is enabled.

## Keep the architecture record accurate

Use the [component registry workflow](../implementation/component-registry-workflow.md)
for every tier. Check the affected context, containers, components, runtime,
deployment, ownership mappings, and related text against the final candidate.
Keep these views consistent; update only the affected parts.

Keep canonical names and IDs stable. A new element may receive a new name when
the same pull request explicitly adds its responsibility and mapping. Source
owners, C4 containers, and Docker deployment nodes are different concepts.
For example, `app` contributes to both the server and administration CLI;
the Lightpanda renderer has no separate Thermus source owner.

Resolve a code/model mismatch against the approved intent. Correct faulty code
when it breaks that intent; a diagram edit cannot legitimize the fault. When an
approved change alters the architecture, update the affected model and evidence.
Parse, render, and visually inspect each changed Mermaid diagram; record the
tool, result, and any limitation as the registry workflow requires.

Do not force a diagram edit for an unaffected pull request. Record why the
existing views remain accurate. A runtime ordering or resource-lifetime change
can require an update even when no component or interface was added.

## Use metrics at their supported units

Maintainability index (MI) applies to each production file. CRAP applies to each
function. A component's LOC-weighted MI and its count of functions at CRAP 30 or
more can provide optional summaries. There is no single component CRAP score.
Do not use a component CRAP before/after value, a 50% CRAP increase, or an
arbitrary ten-point component MI drop as an automatic escalation rule.

Initially retain the approved absolute file/function goals and exception policy
in [AGENTS.md](../../AGENTS.md) and the [review rules](../implementation/pr-review-rules.yaml).
Do not introduce new numeric thresholds in this proposal. Metric failures block
merge until corrected or covered by a permitted, reviewed exception. Required
metric review selects T1 Team review unless architecture independently requires
T2 Need architect. Approval alone cannot waive an uncovered failure.

Report findings for relevant changed files and functions. Preserve the global
dependency checks and any analysis context needed for correct findings; limiting
the pull request summary must not shrink the graph used to detect invalid edges
or cycles. Link complete reports instead of copying unchanged findings.

The [metrics guide](../implementation/ast-metrics-review.md) explains coverage
and identity limits. A base CRAP value derived with head coverage is an estimate,
not measured base coverage. Do not claim a measured CRAP delta from that estimate.
Unknown required evidence is not a pass; use supported bounds only when they
prove the applicable goal. Mark production metrics N/A when none apply.

On adoption, ordinary prose-only changes should skip irrelevant full code-metric
runs. Changes to metric rules or tooling still need their relevant checks.
Selection must follow the revised test and metrics policies for the complete
candidate. Until adoption, the current mandatory process still applies.

## Short pull request template

Use this content for all tiers. Keep the explanation proportional to the change.

```markdown
## Review tier
Tier: <T0 Auto merge / T1 Team review / T2 Need architect>
Reasons: <all matching reasons; identify any approved de-escalation>

## Architecture impact
Model updated: <yes/no; changed or checked views and canonical names>
Delta: <one to three bullets, or why the current views remain accurate>
Evidence and validation: <source/test links; Mermaid result if changed>

## Checks and metrics
Applicable checks: <results for this candidate; explain any N/A>
Relevant metric findings: <changed file/function findings or N/A>
Reports and exceptions: <artifact links; approved exception evidence if any>

## Additional evidence for T2 Need architect
Container/external changes: <what changes, or none>
Deployment, security, and data impact: <guarantees and recovery effects>
Decision: <ADR link for an enduring decision, or why no new decision is needed>
```

Human approvals and merge eligibility must be recorded by the trusted process,
not inferred from this template. Full reports remain accessible as artifacts or
links. On adoption, this replaces the current requirement to paste the complete
metrics report unchanged into every pull request description; it does not replace
that requirement today.

## Adopt separately

1. Trial the proposal on representative recent pull requests, including contained
   code changes, sensitive local fixes, architecture changes, policy changes,
   dependency updates, and ordinary documents. Check effort and missed risks.
2. Approve a separate implementation. Update AGENTS.md, rules, checker, test gate
   policy, metrics policy, registry workflow, and pull request template together,
   using the three tier names consistently. State which old requirements change.
3. Establish trusted CI results, human approval identity, and merge enforcement.
   Baseline `b5fcee19` has no `.github` workflows; this proposal adds none.
4. Test classification, ambiguous cases, policy changes, failed checks, missing
   evidence, stale approvals, holds, and de-escalation. Verify that the changed
   candidate cannot exempt itself through its own policy edits.
5. Enable T0 Auto merge only after the approved implementation and these checks
   work. Reassess the trial results before widening automatic merge coverage.

Saving or approving this proposal alone does not change an active rule, authorize
a merge, or enable any automation.
