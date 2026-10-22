# S1-01 implementation record

Status: in progress, 22 October 2026. This initial candidate contains this record
and its impact declaration only. Source implementation has not started. Acceptance,
focused, full-suite, build, live, and quality checks have not run. The checks below
are planned, not completed evidence.

## Scope

Implement [S1-01](../design/organization-admin-plan.md#s1-01--shared-boundary-and-retired-grant-writes):
move required signup/session/profile contracts to the shared account boundary,
preserve safe existing behavior, compose form destinations, and retire the old
grant forms, `/members/grants` route, `changeGrant` service, and direct provider
writer. Keep checked native invitations. Add no whole authentication framework.

The role/password change belongs to S1-02. This ticket preserves the current role
and MFA behavior outside the retired writer; the legacy MFA fixture below only
proves that an existing authorization refusal does not hide that writer. No
provider configuration, cutover, local Better Auth feature, or later-slice work is
included.

## Acceptance first

Use the existing `node:test` runner and public browser interface:

```gherkin
Scenario: Retire a formerly authorized User-grant write
  Given a legacy-authorized Admin with completed MFA and current membership
  And a valid same-origin User-grant form with CSRF token and current revision
  When the Admin submits it to the retired /members/grants path
  Then the path is unavailable and no membership or role write occurs
```

Run this acceptance before the contract refactor. Its expected initial failure
must show that the formerly authorized write still succeeds; this has not yet
been tested. Then add focused failing boundary tests, make the minimum retirement
change, and refactor green in the same candidate. Keep contract moves under
passing characterization of profile display, return paths, cookies, CSRF, closed
signup, and provider failures. Do not manufacture failures for unchanged behavior.

## Planned verification

Place retirement acceptance under `test/acceptance/auth/`. Reuse signup and session
route cases in `test/integration/auth/` and `test/integration/auth-workos/`, plus
account-route cases in `test/integration/hosted-admin/`. Use existing public-interface
doubles, browser drivers, and hosted site under the [test layout](../testing/test-code-layout.md).
Add only needed focused cases; no tests for this record or configuration.

Run each new/changed focused test during implementation. Before Ready, select from
the complete source candidate: `npm test`, `npm run typecheck`,
`npm run build:user-portal`, and applicable container/hosted gates under the
[test gate policy](test-gate-policy.md). Run hosted-live verification when staging
settings are available; otherwise record it as unrun, never passed. Add no redundant
`npm run check`. Update affected assertions, fixtures, and documents with the change.

Follow [AGENTS.md](../../AGENTS.md) for habit-hooks, source metrics, architecture
review, and merge eligibility. Check imports/exports and document links manually
or through existing lint/type checks; add no file-parsing tests for them.

## Architecture assessment

For this document-only candidate, the current
[component registry](../../architecture/components.md) remains accurate across
context, containers, components, runtime, and deployment. No source, active
contract, dependency, or configuration changes. No registry edit is needed yet.

Reassess the complete source candidate before Ready. Removing the external grant
HTTP path is expected to require T2 Need architect review under the
[review playbook](pr-review-playbook.md). Shared contract moves and writer removal
must be checked against actual exports, callers, and runtime behavior; the initial
document-only declaration does not classify or approve those future changes.

## Evidence to record

Record the actual initial acceptance failure, focused green results, complete
candidate checks, updated architecture/review classification, and any unavailable
gate with its reason. This record currently claims no implementation or test pass.
