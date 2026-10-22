# S1-02 implementation record

Status: implementation starting, 22 October 2026. No S1-02 source check has run.

## Scope

Implement [S1-02](../design/organization-admin-plan.md#s1-02--useradmin-password-access)
on top of [S1-01 PR #220](https://github.com/tomer-mayara/Thermus/pull/220).
The branch starts at `3023003681e65bc9254eda5ea6f6cb9128145f7f`; the new pull
request targets `codex/admin-s1-01`.

User has product and MCP access. Admin includes that access and can use the
existing member and invitation operations for either invitation role. Current
membership and organization permissions still decide access. Remove the
application's MFA preconditions and inferred MFA evidence. Keep password/session
protections, provider failures, and browser/MCP organization separation.

Write the acceptance specifications first and observe genuine failures before
the source changes. Use focused red/green/refactor steps for the required pieces.
Prepare the role/password cutover instructions; production cutover remains in
S1-05. This ticket adds no new MFA feature or database.

## Stack and verification

PR #220 must merge before this pull request. Its unresolved metrics evidence
and human review remain separate. The new branch preserves the parent worktree
and its reports. Full candidate checks use the trusted `origin/main` policy;
the pull request diff against S1-01 identifies this ticket's incremental changes.

The final record will contain observed acceptance failures, focused and full
checks, architecture impact, current review tier, and any unresolved evidence.
No provider setting, role assignment, live fixture, or production rollout has
been changed by this initial record.
