# Set up pull request automation

The process uses **T0 Auto merge**, **T1 Team review**, and **T2 Need architect**.
The tier selects review. Merge eligibility is `eligible` or `blocked`.
The [playbook](pr-review-playbook.md) defines the policy. The local checker
does not grant merge authority.

## What the workflows do

[`pr-validation.yml`](../../.github/workflows/pr-validation.yml) runs with a
read-only token and no repository secrets. It installs Node 24.20.0, pnpm
12.10.1, and habit-hooks core, TypeScript, and generic plugins at 1.3.1. The
workflow constrains the plugin packages during installation: pinning only the
core permits newer plugin versions with an incompatible sensor format.
It runs whitespace checks, habit-hooks, and the
available selected tests:

- Ordinary prose needs no executable suite.
- Unit test changes select the complete unit group.
- PR checker changes select its focused unit and acceptance tests.
- Source changes select the unit group, type check, build test, and portal
  build as offline evidence. These runs do not replace `npm test` or any
  applicable production gate.

The initial hosted selection cannot complete the ordinary acceptance and
interface suites that need Axiom credentials, renderer setup, or other live
prerequisites. Source, acceptance, interface, integration, shared test-support,
metrics-tool, dependency, and unsupported executable changes require additional
evidence from the trusted external runner described below. Missing evidence
blocks merge. An offline pass never claims a full selected suite passed.
The rules YAML selects focused checker tests and external evidence. Documents
with executable contracts, such as the test inventory and script guides, also
require external evidence for their existing contract tests.

[`pr-merge.yml`](../../.github/workflows/pr-merge.yml) runs after validation,
every ten minutes, and on manual dispatch. It is disabled unless the repository
variable `THERMUS_AUTO_MERGE_ENABLED` is exactly `true`. The controller checks
out the current default branch and installs only its dependencies, with install
scripts disabled. It fetches candidate Git objects and runs the trusted base
checker against them. It never runs candidate scripts or installs candidate
dependencies with the write token. It consumes no executable artifact from a
candidate run.

The controller requires:

- An open, Ready pull request into the protected default branch, with no hold.
  Classic branch protection must require up-to-date checks, bind
  `candidate-validation` to the GitHub Actions App, apply to administrators,
  disable force pushes and deletion, and contain no review bypass actors.
  A ruleset-only configuration is not verified by this initial controller and
  stays blocked.
- A candidate that includes the current default-branch tip. A stale base needs
  an update and new checks.
- A complete committed [`.pr-impact.json`](../../.pr-impact.json) that changed
  in this candidate. The file contains `version`, `classification`, and
  `architecture`; the controller supplies the actual `base` and `head` values
  to the checker. Editing a pull request body cannot change this evidence.
- A successful run of the expected validation workflow for this pull request
  and head. Every job in that run must succeed. Workflow definitions, validation
  scripts, dependency inputs, TypeScript configuration, and habit-hooks settings
  must match the trusted base. Changes to these inputs need manual review and
  merge; their own validation run cannot establish its authority.
- Success for every current candidate check and commit status. Missing,
  pending, skipped, neutral, cancelled, failed, or unavailable required results
  are not success. Only this exact merge-controller job is excluded from its
  own check inventory, using its run ID and GitHub App identity.
- An independent current-head approval by an allowed human for T1 Team review
  or T2 Need architect. The author cannot approve their own change. A bot or
  label is not a human approval. An architect can supply the T1 approval too.
  A request for changes from any independent human blocks all tiers, including
  when that reviewer is not in an approval allowlist.

Canonical tier labels can only raise the effective tier. The controller keeps
the highest escalation in the entire pull request event history, even if the
label is later removed. The human approval must follow the escalation. Automatic
de-escalation is not supported. A higher-authority reviewer may authorize a
manual de-escalation and merge under the playbook; all checks still apply.

The controller reads the evidence again before the write. A changed head, base,
or assessment stops that run. It calls GitHub's squash merge API with the
expected head SHA and no bypass option. Strict up-to-date branch protection
closes the remaining race if the base advances after the last read; the expected
head SHA alone does not protect that race. GitHub applies that protection at
merge time.
This mechanism does not depend on GitHub's native auto-merge setting, which was
disabled when this implementation was prepared. It does not enable that setting.

## Activation

Keep automatic merging disabled while this implementation is in Draft and
during the initial trial. Before activation:

1. Review and merge the workflow and policy implementation. Trial representative
   T0 Auto merge, T1 Team review, and T2 Need architect candidates, including
   missing checks, holds, stale commits, and removed escalation labels.
2. Set the classic default-branch protection described above. Require
   `candidate-validation` from GitHub Actions. The controller separately requires
   applicable external gates. Do not give it a branch-protection bypass. If the
   repository plan cannot enforce this protection, keep automatic merging
   disabled. The controller reads and verifies the protection on each inspection.
   That API requires Administration read permission. If the default workflow
   token cannot read it, provide a read-only token as the repository secret
   `THERMUS_PROTECTION_READ_TOKEN`, scoped to Administration read on this
   repository. It is used only for that read, not the merge or human approval.
   Missing permission or unverified protection blocks automatic merging.
3. Separate agent authorship from human approval. Human allowlisted accounts
   must not supply credentials to agents. The current shared owner identity is
   insufficient for that distinction. Use a separate agent or bot identity for
   authored pull requests and human-only reviewer accounts.
4. Set `THERMUS_TEAM_REVIEWERS` and `THERMUS_ARCHITECT_REVIEWERS` to comma-separated
   GitHub logins. At least one independent architect is needed for automatic
   handling of T2 Need architect. Missing reviewers block their tiers.
5. Configure the external runner before enabling automatic merging for changes
   outside the supported offline selection. Set `THERMUS_REQUIRED_GATES_APP_ID`
   to its numeric GitHub App ID. Do not use the shared `github-actions` App.
6. Set `THERMUS_AUTO_MERGE_ENABLED=true` only after the trusted checks, identities,
   and protection work. Set it to `false` to stop the controller.

No repository setting, human allowlist, secret, or activation variable is changed
by adding these files. Fork pull requests require manual review and merge in
this initial implementation.
Any change under `architecture/decisions/` requires manual owner merge, including
edits, deletions, and renames. Architect approval does not remove this block.

## Trusted external evidence

The external runner is a separate trust boundary, not candidate-supplied JSON.
It must use trusted policy and checker code, apply the full test selection, run
all required gates with protected prerequisites, and keep credentials out of
untrusted candidate code. Do not configure it until that isolation is in place.
It must publish a completed successful check named `thermus/required-gates`,
owned by the configured GitHub App, on the exact candidate SHA. Its check
`output.text` must be a JSON object:

```json
{
  "version": 1,
  "baseTip": "<current default-branch commit>",
  "assessment": {
    "candidate": "<candidate commit>",
    "mergeBase": "<current default-branch commit>",
    "tier": "T1",
    "eligibility": "eligible",
    "blockers": []
  }
}
```

`assessment` is the trusted checker's result after the selected tests, metrics,
and quality checks complete. It may include the other checker fields. Preserve
the full reports as accessible evidence on the check. A success attests that
every selected requirement passed or has a permitted, reviewed exception;
missing credentials, tool failures, and unassessed required goals cannot pass.

The controller binds this evidence to the current head and base, and rejects a
lower tier. It can replace only the local missing-input blockers
`evidence.snapshots`, `evidence.crap`, and `evidence.process`. Static dependency
violations, invalid impact evidence, and other local blockers remain blockers.
Without this configured evidence, affected candidates remain blocked even when
the offline workflow succeeds.

GitHub describes the relevant trust boundaries in its
[secure-use guidance](https://docs.github.com/en/actions/reference/security/secure-use)
and [protected-branch documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).
