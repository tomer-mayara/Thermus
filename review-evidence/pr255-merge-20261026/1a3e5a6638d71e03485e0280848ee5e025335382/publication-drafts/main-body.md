## Description

Adds controlled hosted/PostgreSQL removal verification, exact-owned WorkOS staging proof, recovery guidance and a frozen notice/help proposal. The current fixture accepts the retained settings-save event before checking the separate removal export. Parent: [PR #254](https://github.com/tomer-mayara/Thermus/pull/254).

## Review

**T1 Team review**

Architecture: T0: no architecture fact

The test-gate-policy read path and declared policy flag require team review.

**Architecture facts**

- None. All 49 public declarations and 15 registry views match the actual parent.

`.pr-impact.json` declares verification/runbook policy only; all architect flags remain false. Production architecture is unchanged. No production callable, schema, topology or runtime notice selection changes. Test seams and the FIFO fixture correction add no production contract or L4 question. [Current checker](%%EVIDENCE_ROOT%%/quality/final-1a3e5a66/measurements/pr-review.json), [pinned architecture bridge](%%EVIDENCE_ROOT%%/architecture/fixture-integration-bridge-1a3e5a66.json).

**Keep Draft; merge blocked.** Integration passed 1,149 cases; the exact precommit bridge covers focused 4/4 and PostgreSQL 26/26. Hosted live failed 25/29, then 26/30 raw results including a synthetic after-hook test. Public Connect is unrun. Later exact-owned cleanup reconciled all 52 resources in its reviewed scope; it does not pass the failed gate. Raw provider errors stay private; public extracts carry redaction provenance.

Source-free selection remains prospective until parent integration and a complete-candidate recheck. Later R1 integration, independent human merge approval and Render deployment containment remain separate. The frozen legal proposal stays unapproved/unpublished, with date and historical source-pin limits; the [release ledger](https://github.com/tomer-mayara/Thermus/blob/e46c506811b8639f691304c423f4af5fe894955e/docs/implementation/admin-s2-5-02.md) retains all release gates. No Ready, merge or release is claimed.

Current candidate: [`1a3e5a66`](https://github.com/tomer-mayara/Thermus/commit/1a3e5a6638d71e03485e0280848ee5e025335382) · [Validation](https://github.com/tomer-mayara/Thermus/pull/255#issuecomment-6397576862) · [Quality review](https://github.com/tomer-mayara/Thermus/pull/255#issuecomment-6397577713)
