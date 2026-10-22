# S1-01 implementation record

Status: implemented, verification in progress, 22 October 2026. The ordinary
suite, focused checks, typecheck, and portal build pass. Container gates, metrics,
and final review evidence are pending. A local pass is not a live provider pass.

## Scope and implementation

This candidate implements [S1-01](../design/organization-admin-plan.md#s1-01--shared-boundary-and-retired-grant-writes).
It removes customer grant forms, the `/members/grants` route and parser,
`OrganizationAdministration.changeGrant()`, and the corresponding directory
contract and WorkOS writer. After successful session and current access checks,
a formerly authorized grant POST now gets `404` without a membership write or
change record. Signed-out, denied, and failed access lookups keep their existing
responses. Members still shows current roles
and User seats. Checked native invitation send, resend, and revoke remain.
The address-in-use notice no longer directs a user to retired member controls.
The former post-grant billing seat-update call is removed; the billing interface
and optional work-slice enrollment caller remain.

Identity now owns `BrowserSessionControls` and the display-profile/session
records in `src/accounts/identity/browser-session-controls.ts`. Organizations
owns `SignupActivation`, its results, and `SignupDocuments` in
`src/accounts/organizations/signup-activation.ts`. WorkOS implements those
contracts; shared routes no longer name the concrete session/signup adapter.
Cookie and SDK work remain in WorkOS. Composition supplies the portal's existing
form destinations; the portal normalizes HTTP(S) origins and contains no provider
URL or general CSP framework.

Current User, Admin, Super Admin, MFA inference, signup metadata and legal
content, cookies, CSRF, return paths, and provider-failure behavior stay unchanged.
The role/password change belongs to S1-02. No provider configuration, cutover,
local Better Auth feature, storage, or later-slice implementation is included.
Current design, operator guidance, and test inventories describe the reduced
writer surface; dated provider evidence stays historical.

## Acceptance and focused evidence

The retirement acceptance uses the existing `node:test` runner and public
browser interface:

```gherkin
Scenario: Retire a formerly authorized User-grant write
  Given a legacy-authorized Admin with completed MFA and current membership
  And a valid same-origin User-grant form with CSRF token and current revision
  When the Admin submits it to the retired /members/grants path
  Then the path is unavailable and no membership or role write occurs
```

The manager observed the genuine initial red before retirement: the valid POST
returned `303`, the User grant was applied, and Members exposed seven grant
forms. Thus an earlier MFA or authority refusal did not hide the old writer.
Focused route/page cases then checked `404`, no service write, retained session
cookies, and read-only member details. Retirement source batches passed; their
selections overlap and are not added into one total. Renamed membership-access
and invitation-refusal acceptance files retain current access and invitation
behavior instead of the removed grant scenarios.

Neutral contract moves used passing characterization. The baseline selected
session route, sign-in, logout, and cancellation files in
`test/integration/auth-workos/`; signup route/page files in
`test/integration/auth/`; and signup, signup-inspection, and signup-document
files in `test/unit/auth-workos/`: nine compiled files, 132 tests in 6 suites.
`node --test` passed all 132 before the moves. The same nine source files passed
all 132 afterward with `node --experimental-transform-types --test --test-reporter=spec`.
A separate command with that prefix and
`test/unit/auth-workos/workos-browser-session*.test.ts test/integration/auth/workos-browser-session*.test.ts`
passed 58 tests in 8 suites. All three runs exited 0 with no failed, cancelled,
skipped, or todo tests. The worker supplied these results; no live provider was
used. Existing public-interface doubles, drivers, and sites remain in their
[test-layout](../testing/test-code-layout.md) homes.

CSP checks were run as follows:

- Retained compiled baseline: `pnpm exec node --test dist/test/unit/hosted-portal/hosted-portal.test.js dist/test/acceptance/auth/hosted-portal.test.js` — exit 0; 7 passed, none failed/skipped/todo.
- New origin contracts before implementation: `pnpm exec node --test --test-name-pattern='composition-supplied|non-HTTP' test/unit/hosted-portal/hosted-portal.test.ts` — exit 1; 2 failed. The old CSP kept the provider URL, omitted a supplied origin, and did not reject a non-HTTP target.
- Portal unit checks after implementation: `pnpm exec node --test test/unit/hosted-portal/hosted-portal.test.ts` — exit 0; 8 passed, none failed/skipped/todo.
- Retained production CSP acceptance: `pnpm exec node --import tsx --test test/acceptance/auth/hosted-portal.test.ts` — exit 0; 1 passed, none failed/skipped/todo. It checks the exact existing production header.

The new CSP cases cover arbitrary supplied origins, path/query/fragment removal,
and malformed or non-HTTP(S) values with the existing safe startup error.
The notice regression also had a genuine focused red: one failed case still
found the retired role-control advice. It passed after the notice was corrected.
No provider call was needed for these checks.

## Architecture and review

The [component registry](../../architecture/components.md) records the shared
contract ownership and reduced customer writer surface. Context, containers,
deployment, resource lifetimes, and package edges stay unchanged. WorkOS SDK
facts stay in its adapter; display profiles do not grant authority. Browser and
MCP credentials keep their separate organization context. No provider, runtime
dependency, infrastructure, or broad authentication framework is added.

The complete source declaration classifies this as **T2 Need architect** because
retirement changes the external browser/server contract. Internal contract,
sensitive-path, and policy-declaration changes also require review. The manager
must bind the declaration and checker evidence to the complete committed
candidate, resolve blockers, and obtain independent authorized human approval
under [AGENTS.md](../../AGENTS.md) and the [review playbook](pr-review-playbook.md).
This record is not approval or merge eligibility evidence.

## Candidate checks

The source change selects the full ordinary suite and applicable production
gates under the [test gate policy](test-gate-policy.md). Dependencies were
installed with the frozen lockfile. Commands use the pinned Node 24.20.0 through
`pnpm exec`; renderer checks use the verified Lightpanda 1.0.0 executable.

| Check | Result |
| --- | --- |
| `npm test` | Exit 0: 4,089 backend tests in 261 suites and 41 portal tests passed; no failed, cancelled, skipped, or todo tests reported. The container suite is enabled only by its separate command. |
| Fresh build, then every added/changed ordinary test file | Exit 0: 215 tests in 20 suites passed; no failed, cancelled, skipped, or todo tests. Includes the final notice and retirement cases. |
| `npm run typecheck` | Exit 0, including portal types; repeated after final type-only cleanup. |
| `npm run build:user-portal` | Exit 0. |
| Container and hosted gates | In progress. |
| Metrics and review-tier checker | Pending complete committed candidate. |

The final cleanup after the ordinary run made an unused interface private and
corrected one comment. It changes no emitted runtime behavior. The fresh focused
run and repeated typecheck include that cleanup. No redundant standalone
`npm run check` was added; the required hosted build includes its own checks.

The WorkOS live gate is unavailable with the saved configuration: its staging
key and client ID do not match the currently connected Thermus Staging scope,
and issuer and MFA-profile settings are missing. It has not passed for this
candidate. No provider configuration or data was changed to run it. Existing
historical live passes do not verify this candidate.

Manual documentation checks passed: local Markdown targets exist, code fences
are balanced, current inventory entries use existing test files, and
`git diff --check` is clean. No prose tests were added.
