# S1-03a implementation record

Status: implementation started, 22 October 2026.

## Scope

Implement [S1-03a](../design/organization-admin-plan.md#s1-03a--named-creation-agreement-and-first-admin)+on top of [S1-02 PR #221](https://github.com/tomer-mayara/Thermus/pull/221).
The branch starts at `5e1aedf82bf41345ecf4eff174861686389253f3` and targets
`codex/admin-s1-02`.

An eligible verified creator supplies an organization name and accepts one
unchecked organization agreement. A confirmed new organization receives its
first Admin only after the saved organization and legal facts are verified.
Current membership authorizes browser selection of that organization, then its
named workspace opens with the MCP connection guide.

Reuse the existing provider metadata, deterministic external ID, and recovery
boundary. Unknown writes cannot grant or restore access. S1-03b owns the expanded
recovery and eligibility matrix. No database, provider configuration, MFA,
invitation policy, or deployment change belongs to this ticket.

The existing approved personal-User legal bundle remains unchanged. Marked test
documents can exercise the new flow. Exact approved organization/authority
wording is required before production creation can be enabled at S1-05.

## Acceptance and TDD

First add and observe failing acceptance cases for the editable name and
unchecked agreement, then named creation, saved facts, first Admin, and matching
session/guide context. Follow with small failing form, provider, route, and
presentation tests; make them pass and refactor. Passing existing recovery and
security behavior remains characterization, not invented red evidence.

Observed failures, focused results, and the complete-candidate checks will be
recorded here after implementation.

## Review and stack

The complete candidate includes S1-01 and S1-02 and uses trusted `origin/main`
policy. The incremental PR diff targets S1-02. The parent PR's native metrics
omission remains a known evidence limit; new checks must report their actual
results. Authorization and persistence contracts require architecture review.
No human approval or live provider pass is claimed. Merge and rollout are not
part of this implementation request.
