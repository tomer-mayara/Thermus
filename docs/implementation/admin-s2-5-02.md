# S2.5-02 — Integrated removal verification and release controls

Status: in progress. This change stacks on
[S2.5-01c, PR #254](https://github.com/tomer-mayara/Thermus/pull/254).

## Scope

Verify the complete password-only removal journey through the hosted application,
real disposable PostgreSQL, and scoped WorkOS staging fixtures. Keep controlled
provider, storage, export, restart and deadline proof distinct from live results.
Use only exact resources created for the staging proof. Add no MFA enrollment,
paid feature, global-user deletion feature, new store or service.

Drill a restore from before a removal intent in disposable SQL. Contain old
senders and keep a removal-write hold outside restored rows until independent
evidence supports reconciliation. Update user help and operator procedures for
last-Admin refusal, fresh-invitation rejoin, uncertain outcomes and no blind retry.

Prepare a complete versioned notice proposal while preserving earlier bundle
bytes and hashes. Owner approval, publication and actual presentation must be
recorded before rollout. Actual S2-04 release remains a prerequisite; this draft
does not supply it or authorize production changes.

## Verification

Add the acceptance specifications first. The leaf behavior already exists, so
integrated characterization may start green. Any missing source behavior needs
its own focused failing test, implementation and refactor. Run selected checks
on the complete candidate and retain actual results, limitations, review tier,
and remaining owner actions in this record and the pull request evidence.
