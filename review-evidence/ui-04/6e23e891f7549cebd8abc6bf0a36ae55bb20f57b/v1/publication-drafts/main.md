## Description

Members shows the complete pending invitation count in a native disclosure. Empty groups start closed; nonempty groups start open. Compact rows keep roles, absolute UTC expiry and permitted protected Resend/Revoke actions. Full removal help retains its approved text, version and hash.

All six UI-04 commits replay unchanged onto merged PR #266 at `0377cd12`. PR #268 now targets main. The final update adds the rebase note and required generated metric history; application and test behavior is unchanged. Main later advanced to `6d6adcc3`; the actual merge base remains `0377cd12`, and GitHub reports no conflicts.

## Review

**T1 Team review**  
Architecture: T0: no architecture fact
The sole tier reason is trusted `read_paths` for `docs/implementation/test-gate-policy.md`. Its browser inventory changes no command, gate selection or approval authority. The final checker reports no mechanical blockers.

**Architecture facts** (`6e23e891` against actual merge base `0377cd12`):

- None.

All `.pr-impact.json` classification and architect flags remain false. Production architecture and all 15 registry views remain unchanged. Complete reads, authorization, protected fields, provider operations and fixed outcomes stay at their owners; no production callable signature changes.

**Overall merge status: blocked; Draft.** Typecheck, both builds and all 71 Members browser cases passed. The complete current hosted-live group and independent human approval of this head remain required. The old exact-057 approval is historical. Six historical quota HTTP 429 failures remain separate from the application HTTP 503 with unproven provider cause. No new live success, merge or deployment is claimed.

[Rebase and evidence audit](EVIDENCE_ROOT/README.md) preserves original execution pins, retained findings and approval history.

---
Candidate: [6e23e891](https://github.com/tomer-mayara/Thermus/commit/6e23e891f7549cebd8abc6bf0a36ae55bb20f57b) · [Validation](https://github.com/tomer-mayara/Thermus/pull/268#issuecomment-6430703769) · [Quality review](https://github.com/tomer-mayara/Thermus/pull/268#issuecomment-6430704090)
