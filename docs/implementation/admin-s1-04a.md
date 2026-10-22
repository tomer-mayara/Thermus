# S1-04a implementation record

Status: implementation and verification in progress, 22 October 2026.

## Scope

Implement [S1-04a](../design/organization-admin-plan.md#s1-04a--members-and-native-invitation-management)
on top of [S1-03b PR #223](https://github.com/tomer-mayara/Thermus/pull/223).
The branch starts at `d1d5f9d1ef882a7110d276d628a6aa98d988f874` and targets
`codex/admin-s1-03b`.

Add the Admin Members view, trusted You labels, pending invitation expiry, one
email and User/Admin radio form, and current pending resend/revoke controls.
Keep current authorization, bounded complete reads, safe failures, and native
invitation rules. An unconfirmed write offers a status check without a blind
retry. The product portal links to Members only for Admin.

Acceptance tests come first. Existing correct behavior stays characterized;
missing source behavior uses failing focused tests, implementation, and refactoring.
Invitation acceptance and provider preservation proof remain S1-04b. Member
removal, role changes, logging, and MFA belong to later tickets. This request
includes neither merge nor rollout. Preserve the parent worktree and reports.

## Validation and review

Validation, architecture impact, quality findings, and candidate-bound review
results will be recorded here. The complete stack selects source checks against
trusted `origin/main`. The parent's analyzer failure and unavailable matching
WorkOS staging settings are known limits, not passes for this new candidate.
