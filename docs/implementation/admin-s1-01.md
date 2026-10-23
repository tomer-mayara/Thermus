# S1-01 implementation record
Current validation: this branch now includes the shared [metrics repair](ast-metrics-function-repair.md) from [PR #230](https://github.com/tomer-mayara/Thermus/pull/230). The dated command results below describe the earlier candidate and analyzer. Current SHA-bound checks, retained goals, and blockers are recorded in [PR #220](https://github.com/tomer-mayara/Thermus/pull/220). They must be checked before Ready; earlier passes do not certify the rebased commit.

## Earlier implementation and verification record

Status: implemented; Draft with blocked quality evidence, 22 October 2026.
The ordinary suite, focused checks, typecheck, portal build, hosted offline
build, and both container gates pass. The pinned metrics tool omits source
functions, so CRAP and the dependent architecture assessment cannot complete.
Independent human architect approval is still required. A local pass is not a
live provider pass.

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

The manager reviewed the three workers' source changes and evidence. An
independent agent review checked the neutral contracts, retained safety tests,
live-fixture dependencies, and public-module declarations. It found no source
blocker. Agent review does not replace the required human review.

The public-surface comparison has these results:

| Surface | Before and after |
| --- | --- |
| Identity/session and signup contracts | Records and operations move from the WorkOS adapter to accounts. Fields, result variants, cookie effects, and runtime behavior stay the same. Display profile data grants no authority. No compatibility alias keeps the shared routes tied to WorkOS session types. |
| `account-form`, `customer-roles`, administration service, and directory | Grant request, parser, decision, service, and provider-write contracts are removed. Surviving invitation and read contracts keep their authority and failure rules. |
| Member overview and pages | The write choices and form inputs are removed. `MemberEntry` becomes private. Current roles, status, revision, and seat count remain in the overview; pages keep safe escaping. |
| Hosted portal and composition | The loader now receives form destinations. It accepts HTTP(S) origins and normalizes URL paths, queries, and fragments. Root composition supplies the same WorkOS origins as before, so the production CSP stays the same. |

The policy questions are resolved as follows. The browser contract changes only
where the grant endpoint and controls are retired, and where the conflict notice
must stop referring to them. Current access checks, tenant scope, CSRF, cookies,
MFA behavior, and provider failure handling remain. The rules-file change names
the two new public contract modules; it changes no package edge, gate, metric
threshold, or approval authority. Deleted tests cover the retired writer;
generic access, invitation, cookie, failure, and tenant checks remain on active
paths. The change exceeds the total review-line limit mainly through removal
and updated documentation; it adds no skip or todo marker.

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
| `npm run test:container` | Exit 0: 11 tests in 1 suite passed; no failed, cancelled, skipped, or todo tests. |
| `npm run build:hosted` | Exit 0. All selected groups passed: 2,652 emitted unit, 23 portal unit, 18 portal acceptance, 940 integration, 116 selected acceptance/interface, and 13 renderer tests. No failed, cancelled, skipped, or todo tests. |
| `npm run test:container:hosted` | Exit 0: 7 tests passed on Linux AMD64 under emulation; no failed, cancelled, skipped, or todo tests. Includes the image's offline build, portal/CSP, legal-document bytes, real renderer, admission, cancellation, and shutdown checks. |
| Selected-suite coverage | Exit 0 for unit and integration collection. All selected tests passed. The verified report contains 137 source files from 633 processes; no coverage data was edited. |
| Base and head metric snapshots | Both commands exit 0. Type-only contracts have no function metrics. Incomplete function evidence in implementation files is retained, not treated as complete. |
| Metrics process and standalone CRAP | Exit 1. Delta and Review report retained goal misses. CRAP fails on omitted native function rows; Architecture is unavailable because its prerequisite failed. The standalone CRAP command gives the same diagnostic and writes no valid rows file. |
| Review-tier checker | Classification completes with `T2 Need architect`, local eligibility `blocked`. CRAP rows are missing because measurement failed; the process also reports failed CRAP and unavailable Architecture. No undeclared dependency fact or new cycle is reported. |

The final cleanup after the ordinary run made an unused interface private and
corrected one comment. It changes no emitted runtime behavior. The fresh focused
run and repeated typecheck include that cleanup. No redundant standalone
`npm run check` was added; the required hosted build includes its own checks.

The WorkOS live gate is unavailable with the saved configuration: its client ID
does not match the currently connected Thermus Staging scope, and issuer and
MFA-profile settings are missing. It has not passed for this
candidate. No provider configuration or data was changed to run it. Existing
historical live passes do not verify this candidate.

Manual documentation checks passed: local Markdown targets exist, code fences
are balanced, current inventory entries use existing test files, and
`git diff --check` is clean. No prose tests were added.

## Retained quality findings

The pinned ast-metrics version is 0.43.1. All 17 changed implementation files
below MI 85 were inspected with the file command. These are retained goal misses,
not passes. No new implementation file misses the goal: both added files contain
only contracts. `customer-roles.ts` improves to 89.8. The following table gives
file-level scores; the native review also reports class-level findings, whose
numbers differ.

| File | Base → head MI | Reason to retain |
| --- | ---: | --- |
| `administration-overviews.ts` | 77.0 → 76.4 | Write projections are removed; paths fall from 18 to 14. Keep the small frozen read projections together. |
| `organization-administration.ts` | 64.8 → 67.7 | Writer removal reduces paths from 57 to 44. Explicit current-authority and change-recording checks still protect invitations. |
| `workos-browser-session.ts` | 63.9 → 63.6 | Shared contract extraction leaves all 49 paths and session behavior unchanged. A refresh/cookie rewrite would expand this slice. |
| `workos-organizations.ts` | 53.1 → 53.9 | Writer removal reduces paths from 110 to 102. Keep the remaining provider validation, pagination, and invitation operations cohesive. |
| `workos-signup-documents.ts` | 72.3 → 72.3 | Type import change only; document validation is unchanged. |
| `workos-signup.ts` | 36.3 → 36.7 | Contract extraction preserves the creator/recovery rules and all 102 paths. Recovery redesign is outside this ticket. |
| `hosted-portal.ts` | 50.6 → 49.9 | The new origin validator adds three necessary paths. The existing routing and build-output guards remain. Moving checks into trivial wrappers would not simplify them. |
| `hosted-workos-application.ts` | 63.0 → 63.0 | The same composition lifecycle now supplies neutral contracts and explicit destinations. |
| `account-form.ts` | 61.2 → 61.6 | The grant parser is removed; paths fall from 49 to 45. Keep bounded-body and CSRF validation. |
| `account-pages.ts` | 75.2 → 75.2 | Corrected notice text only; the small notice renderers remain cohesive. |
| `account-routes.ts` | 61.2 → 61.2 | The boundary change preserves current access, selection, cookies, and error behavior. |
| `administration-pages.ts` | 69.1 → 70.6 | Grant forms are removed; paths fall from 21 to 18. No template framework is needed. |
| `administration-routes.ts` | 61.3 → 62.5 | The grant route is removed; paths fall from 44 to 41. Remaining request guards are required. |
| `workos-session-routes.ts` | 61.6 → 61.8 | Contract extraction preserves the callback, safe-return, logout, and cookie behavior. |
| `workos-signup-document-reader.ts` | 81.2 → 81.2 | Shared type import only; bounded legal-document rendering stays the same. |
| `workos-signup-pages.ts` | 52.4 → 52.4 | Shared type import only; page decisions stay the same. |
| `workos-signup-routes.ts` | 43.9 → 43.9 | Contract extraction preserves admission, CSRF, cancellation, and recovery behavior. |

The native review reports nine high maintainability findings in changed files:
organization administration, WorkOS browser session, WorkOS organizations,
WorkOS signup, hosted portal, account routes, administration routes, session
routes, and signup routes. The table gives each retention reason. The full
report also retains 53 high findings on unchanged files; they are not new
candidate defects. Native `new-violation` labels alone do not establish a new
source regression.

`habit-hooks --branch origin/main` exits 1 with two high-complexity findings,
343 comment findings, and nine oversized-file findings. The two complex bodies
are the existing portal request handler and index validator. Their routing and
build-output checks remain necessary; the new origin helper has three paths.
Comments explain authority, trust, cookie effects, uncertain provider results,
pagination bounds, and test/provider seams. Removing these reasons would make
the remaining contracts harder to review.

The nine oversized files are the WorkOS organizations and signup adapters;
the live administration proofs and server fixture; the hosted administration
acceptance file; provider administration, provider organizations, and signup
route integration files; and the WorkOS organizations double. Retain these
cohesive adapter or test groups. The retirement reduces both adapters and the
grant-heavy tests; a separate framework or test reorganization adds no value
to this ticket. The unused `MemberEntry` export was corrected. The snooze file
stays empty. These retention reasons need the required human review.

## Measurement blocker and retained evidence

The standalone CRAP command stops with this diagnostic:

```text
get_file_metrics omitted source declarations in src/accounts/organizations/organization-administration.ts. The required goals are unresolved.
```

That file has 29 declarations and 20 native rows at the base, and 24 declarations
and 17 rows in this candidate. Seven callbacks inside class methods are absent
from the head response. The same omission affects seven other changed files:
WorkOS organizations and signup, hosted portal, account routes, administration
routes, session routes, and signup routes. Across these eight files, the head has
185 declarations and 139 native rows; only 119 rows have usable source identity.
Both snapshots already mark these files' source evidence incomplete.

The pinned native response supplies no hidden callback metrics or source
coordinates. Its other APIs do not supply a complete alternative. Coverage
cannot replace missing complexity or identity evidence. A validated parser/tool
compatibility correction is needed before the required assessment can finish.
The omissions guard, coverage, metric policy, and production structure were not
changed to conceal this failure. No exception or empty CRAP report was created.
No base history record was written because the four-stage process did not
complete.

The full snapshots, process Markdown/JSON, review Markdown/JSON, coverage, manual
quality review, classifier output, and command logs are retained in the fresh
workspace's ignored `ast-report/` directory. The pull request names its exact
candidate SHA and artifact location; the task provides local report links. These
are local review artifacts, not uploaded CI results. No live provider pass or human approval is
claimed. The implementation stays Draft until the failed quality evidence is
resolved; the unavailable staging run remains an explicit evidence limit.
