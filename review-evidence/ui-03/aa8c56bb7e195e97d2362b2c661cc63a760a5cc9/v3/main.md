## Description

UI-03 puts the existing protected invitation form in a closed native Invite member disclosure beside Members, with one Send invitation action and a Cancel GET that discards input. Native validation, allowed roles, recipient-policy text and fixed server notices remain. Last-Admin guidance explains how to invite a replacement.

## Review

**T1 Team review**  
Architecture: T0: no architecture fact
The sole tier reason remains trusted `read_paths` for `docs/implementation/test-gate-policy.md`; the browser inventory changes no command, gate selection or approval authority.

**Architecture facts** (`aa8c56bb` against actual parent/merge base `614090a1`):

- None.

All committed `.pr-impact.json` classification flags remain false. Production architecture is unchanged within Web: existing complete overviews and protected operations preserve roles, authority, recipient rules, fixed outcomes, recovery and exact help. No new public declaration, provider operation, dependency, store, script or deployment boundary is introduced.

UI-01 merged as `115bb512`, with a tree identical to approved `37046bbd`. UI-03 retains parent `614090a1`. [Postmerge pins](EVIDENCE_ROOT/postmerge-retarget.json) distinguish current main from historical full-candidate evidence against `9507e751`; incremental metric/checker inputs remain unchanged.

Owner Tomer Mayara approved exact head `aa8c56bb` on 27 October 2026; [approval record](EVIDENCE_ROOT/owner-approval.json).

**Overall merge status: blocked; Draft.** All selected local image gates passed. The complete selected current hosted-live group remains required; owner approval does not waive it. The historical 28/29 missing-Revoke run and later quota diagnostic remain separate from UI-02/UI-04 quota/503 histories. This PR remains unmerged; no deployment is claimed.

---
Candidate: [aa8c56bb](https://github.com/tomer-mayara/Thermus/commit/aa8c56bb7e195e97d2362b2c661cc63a760a5cc9) · [Validation](https://github.com/tomer-mayara/Thermus/pull/266#issuecomment-6430015599) · [Quality review](https://github.com/tomer-mayara/Thermus/pull/266#issuecomment-6430026485)
