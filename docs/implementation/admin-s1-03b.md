# S1-03b implementation record

Status: implementation in progress, 22 October 2026.

## Scope

Implement [S1-03b](../design/organization-admin-plan.md#s1-03b--creation-recovery-and-eligibility)
on top of [S1-03a PR #222](https://github.com/tomer-mayara/Thermus/pull/222).
The branch starts at `0de5fb83f1a5b4aa85f577cf6013422a15051208` and targets
`codex/admin-s1-03a`.

Check named creation after lost responses, late completion, concurrent requests,
and application restart. Retained creation records must not authorize new grants,
rename an organization, overwrite acceptance, or promote a legacy User to Admin.
Current product access remains usable; revoked or incomplete creation needs
support. Former invited members with no retained creation record can create.

Start with acceptance coverage through the hosted application. Preserve passing
characterization when the parent already meets a requirement. For a missing
behavior, first observe a failing acceptance case, then use focused TDD to make
the smallest source change. Do not invent a failure to justify implementation.

This ticket adds no database, MFA, invitation-management feature, deployment,
provider configuration, or production legal wording. Approval of the organization
documents and live rollout remain S1-05.

## Validation and review

Results will be recorded after the complete candidate is checked. Parent metrics
have a native analyzer omission; this candidate must report its own evidence.
No live provider pass or human approval is claimed. This request includes neither
merge nor rollout. Keep the parent worktree and its reports.
