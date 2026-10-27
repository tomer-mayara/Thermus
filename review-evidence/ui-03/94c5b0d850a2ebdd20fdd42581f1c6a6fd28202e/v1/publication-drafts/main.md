## Description

UI-03 puts the existing invitation form in a closed native Invite member disclosure beside Members. It has one Send invitation action and a Cancel GET that discards input. Native validation, allowed roles, recipient rules and fixed server notices remain. Last-Admin guidance explains how to invite a replacement.

This conflict fix replays UI-03 onto the UI-02 squash merge in main. The new base tree equals the former parent tree. Both replayed patches are unchanged. The final commit updates the UI-03 evidence document and adds the required generated base metric record; source, tests, dependencies and build inputs remain unchanged.

## Review

**T1 Team review**  
Architecture: T0: no architecture fact
The tier reason is trusted `read_paths` for `docs/implementation/test-gate-policy.md`. Its browser inventory changes no command, gate selection or approval authority. The final checker confirms T1 and no mechanical blockers.

**Architecture facts** (`94c5b0d8` against `2282edd4`):

- None.

All `.pr-impact.json` classification and architect flags are false. Production architecture is unchanged. No registry view or production callable signature changed; no comparison drawing or L4 detail is needed.

**Overall merge status: blocked; Draft.** The complete current hosted-live group remains required. The last recorded WorkOS support response was an automated receipt; no quota reset or capacity confirmation is recorded. Prior owner approval covers exact `aa8c56bb`, not this head; new independent human approval is required before merge. This update resolves the conflicts. The PR stays Draft; no merge or deployment was performed.

[Rebase and evidence audit](EVIDENCE_ROOT/README.md) preserves original execution pins and prior approval history.

---
Candidate: [94c5b0d8](https://github.com/tomer-mayara/Thermus/commit/94c5b0d850a2ebdd20fdd42581f1c6a6fd28202e) · [Validation](https://github.com/tomer-mayara/Thermus/pull/266#issuecomment-6430015599) · [Quality review](https://github.com/tomer-mayara/Thermus/pull/266#issuecomment-6430026485)
