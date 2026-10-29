## Description

Quick start's first heading used “to AI Agents”, which did not clearly describe
the intended restriction. Change it to **Turn off direct internet access for AI
agents** and replace the lead with the approved instructions to open each
provider's admin console, select the organization, and restrict internet access
for its agents. The shared content supplies both the Admin page and copied
Markdown; the canonical guide now matches the same paragraph and keeps the
existing connection link and required-service guidance.

## Review

**T0 (expected)** — {{CHECKER_ARCHITECTURE_SUMMARY}}. This is internal UI/prose
wording; final classification is pending.

Architecture facts (checker, {{SHORT_HEAD}} vs main `21458b0d`):

{{CHECKER_ARCHITECTURE_FACTS}}

Why (from `.pr-impact.json`): all classification flags are false and
`modelUpdated` is false. Only the shared title/lead and canonical guide change.
Routes, Admin access, configured links, URL validation, provider operations,
callable contracts, composition, and deployment relationships retain their
rules. Production architecture and all 20 registry views are unchanged.

**Draft; merge status blocked pending remaining checks.** Focused, browser,
ordinary, static/build, native-container, and hosted-offline checks pass.
AMD64 image, coverage/process, habit-hooks, and final checker evidence remain
pending. Required decisions: none identified. No human approval is expected
for eligible T0; refresh this statement if the checker raises the tier. The
existing content-file MI is unchanged; its final disposition belongs in Quality
review, not an assumed pass.

Authorized deployment follows merge through the existing Render Git service,
with exact deployed-commit, health, and public-access readback. The current
production browser is denied guide access; no role or selection changes are
planned. Positive UI evidence is from fresh local Admin checks and screenshots.
The production-view limit remains explicit. Merge and deployment are not yet
claimed complete.

---
Candidate: [{{SHORT_HEAD}}](https://github.com/tomer-mayara/Thermus/commit/{{HEAD}})
· [Validation](https://github.com/tomer-mayara/Thermus/pull/292#issuecomment-6483742111)
· [Quality review](https://github.com/tomer-mayara/Thermus/pull/292#issuecomment-6483742406)
