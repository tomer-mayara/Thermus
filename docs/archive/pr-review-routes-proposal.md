# Review routes for pull requests

Date: 2026-10-20. Status: proposed. Route of the pull request that adds this
record: `ASK`, because it changes protected policy paths.

## Context

Agents write most of the code. The owner reads every pull request before the
merge, and most of that reading is skimming. The owner wants a deterministic
process, with no language model in the loop, that sends a human only the
changes that touch the architecture: a package, a public contract, a
dependency direction, or a protected security or policy area. Code that stays
inside a package can merge on green checks.

The question of the matching rule: does this change what the checks enforce,
or who decides?

## Decision

Adopt a manual trial of the PR review playbook
([docs/implementation/pr-review-playbook.md](../implementation/pr-review-playbook.md))
and its rules file
([docs/implementation/pr-review-rules.yaml](../implementation/pr-review-rules.yaml)).

- Each pull request gets one of five routes: `FIX`, `ASK`, `READ`, `SHOW`,
  `SHIP`. The agent computes the route by hand, as the section "Review route"
  of AGENTS.md says, and records it on the pull request with a label.
- The rules file is the single list of protected paths, public surface
  modules, allowed package edges, external imports, and size limits. A new
  fact goes into that file in the same pull request. That edit is itself a
  protected change.
- For an `ASK` pull request, the agent writes the draft decision in the pull
  request description. The owner decides whether it becomes a record under
  this folder.

What the checks enforce does not change in this trial: the required runs,
habit-hooks, and the ast-metrics process stay as they are. Who decides does
not change either: the owner reviews every pull request and merges a pull
request with a decision record. The route guides the depth of the owner's
review.

## Consequences

- The owner can read an `ASK` or `READ` pull request closely and skim a
  `SHOW` or `SHIP` pull request.
- Each pull request that adds a package edge, an external import, or a public
  surface module makes that fact visible in the rules file.
- After one month, the owner reviews the route share, the false alarms, and
  the missed problems, and decides whether to build the checks and later turn
  on merge on green for `SHOW` and `SHIP`.
- The guarantee that holds after this change: no pull request merges with
  fewer checks than before. The owner still reviews every pull request in
  the trial; the depth of that review can change.
