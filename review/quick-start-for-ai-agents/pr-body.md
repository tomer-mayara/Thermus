## Description

Quick start's first heading used “to AI Agents”, which did not clearly describe
the intended restriction. Change it to **Turn off direct internet access for AI
agents** and replace the lead with the approved instructions to open each
provider's admin console, select the organization, and restrict internet access
for its agents. The shared content supplies both the Admin page and copied
Markdown; the canonical guide now matches.

## Review

**T0 Auto merge** — **T0: no architecture fact**. The final checker selects T0 Auto merge,
with preliminary eligibility `eligible` and no local blockers.

Architecture facts (checker, `8eb8d345` vs main `21458b0d`):

- None.

Why (from `.pr-impact.json`): all classification flags are false and
`modelUpdated` is false. This is explanatory copy; routes, Admin access, links,
URL validation, provider operations, callable contracts, and deployment
relationships retain their rules. Architecture and all 20 registry views are
unchanged. The final metadata commit adds only the immutable base metric record.

**Overall merge status: eligible.** All selected checks passed, and the manager
reviewed the complete candidate. The AMD64 gate passed all seven runtime cases
on one unchanged retry after an existing timing-test failure; both attempts
remain in the evidence. Frozen-input comparisons match the final candidate.
The unchanged MI goal miss has a recorded retained reason; other metric stages
pass. Blockers and required decisions: none. T0 requires no human approval.

Authorized deployment follows merge through the existing Render Git service.
Verification will bind the deployed revision, health, and public access; the
current production browser is denied guide access. Positive UI evidence is from
fresh local Admin checks. No role or selection change is planned.

---
Candidate: [8eb8d345](https://github.com/tomer-mayara/Thermus/commit/8eb8d34519bd9aa0e2541bf3ad79f0ca8ad84ac0)
· [Validation](https://github.com/tomer-mayara/Thermus/pull/292#issuecomment-6483742111)
· [Quality review](https://github.com/tomer-mayara/Thermus/pull/292#issuecomment-6483742406)
