# S1-05 implementation record

Status: implementation and verification in progress, 23 October 2026.

## Scope

Add the combined create, invite, and join journey from
[S1-05](../design/organization-admin-plan.md#s1-05--complete-journey-verification-and-cutover).
This PR stacks on [S1-04b PR #226](https://github.com/tomer-mayara/Thermus/pull/226),
rebased parent `9da567ad757ec16af7efe5615ae8b8bce1dcc46d`.
The trusted main is `8eeade72d366c0e3dd2486fcf2fa9d771bf03788`.

The six open implementation branches were rebased in order. Each final tree
matches its previous tree except for the current AGENTS.md. Backup branches and
previous reports remain available. Earlier results retain their original SHA;
they are not new passes of the rebased candidates.

## Acceptance specification

Given an eligible verified creator and a recipient, when the creator creates a
named workspace with the marked test agreement, invites the recipient as Admin
or User, and the recipient accepts and selects it, both can use the product and
MCP. Only Admin can use Members. No grant form, MFA gate, or second agreement
appears. The provider double stands in for authentication and native invitation
acceptance. This case cannot establish actual password or WorkOS behavior.

Existing source behavior may make the combined case pass immediately. Record
that as characterization. If it exposes a source gap, keep the acceptance red
and use a focused failing test, fix, and refactor before recording green.

## Required checks and completion limits

The complete candidate against main includes the unmerged source stack. Select
the ordinary suite, type checking, portal build, self-hosted container, hosted
offline/image/live gates, habit-hooks, and source metrics under the test policy.
Run build commands sequentially. The manager reviews the complete candidate.

Native invitation proof, matching live configuration, the approved organization
legal bundle, and scoped cutover remain release holds. Current production legal
documents still block creation. No provider setting, live membership, legal
approval, deployment, or cutover changes are part of this PR. The existing
metrics-tool failure remains unresolved until a valid rerun proves otherwise.
This record does not mark S1-03, S1-04, S1-05, or Slice 1 complete.
