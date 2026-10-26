## Description

Adds integrated hosted/PostgreSQL removal verification, exact-fixture WorkOS staging proof, recovery controls and an unapproved notice/help proposal. It uses the existing production system. Parent: [PR #254](https://github.com/tomer-mayara/Thermus/pull/254).

## Review

**T1 Team review**

Architecture: T0: no architecture fact

The test-gate-policy read path and policy flag require team review.

**Architecture facts**

- None. All 49 public declarations and 15 registry views match the actual parent.

`.pr-impact.json` declares verification gates and runbooks only (`policy: true`; architect flags false). Test seams accept scoped site/SQL fixtures with unchanged defaults. Production architecture is unchanged: no source, callable contract, registry, schema, deployment topology or runtime notice selection changes against #254. No diagram or L4 is needed. [Current checker/impact](%%EVIDENCE_ROOT%%/quality/final-isolated/measurements/pr-review.json), [architecture assessment](%%EVIDENCE_ROOT%%/architecture/assessment-current.md).

Merge status: **blocked**. Static checks, current architecture and selection are manager-reviewed; runtime results are pending. Source-free selection is conditional on #254 integration and a complete-candidate recheck against then-main. The current stack against main8c still inherits source gates. Parent/later R1 integration, independent human current-candidate approval reconciliation and Render workspace/target/deployment preflight remain open. Later #257 already implements the facts-only repair and labels old P2/Draft text as history; no merge is claimed.

The frozen proposal remains unapproved/unpublished, with an open 25 October date condition and one historical help-source hash. The [release ledger](https://github.com/tomer-mayara/Thermus/blob/22a8e3666a0e54a7ca49580ec3f111e61bd42566/docs/implementation/admin-s2-5-02.md) owns all deployment, notice, storage, capacity and release holds. No Ready, notice approval, production activation or release is claimed.

Current candidate: [`adf3369a`](https://github.com/tomer-mayara/Thermus/commit/adf3369a953792208b5c48b8776d3bfeb89c3fb7) · [Validation](https://github.com/tomer-mayara/Thermus/pull/255#issuecomment-6397576862) · [Quality review](https://github.com/tomer-mayara/Thermus/pull/255#issuecomment-6397577713)
