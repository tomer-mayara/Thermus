# S1-04a implementation record

Status: implemented; Draft because required metrics remain blocked, 22 October 2026.

## Scope

Implement [S1-04a](../design/organization-admin-plan.md#s1-04a--members-and-native-invitation-management)
on top of [S1-03b PR #223](https://github.com/tomer-mayara/Thermus/pull/223).
The branch starts at `d1d5f9d1ef882a7110d276d628a6aa98d988f874` and targets
`codex/admin-s1-03b`. The stacked pull request is
[PR #224](https://github.com/tomer-mayara/Thermus/pull/224).

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

## Acceptance and TDD

Before implementation, the five new hosted acceptance cases failed on the
combined Members page, one invitation form, and the unconfirmed-write notice.
Focused page tests then failed 12 of 19 cases. Domain/provider tests failed 17
of 130 cases on missing projection fields and typed unknown outcomes. Portal
acceptance failed three cases and focused unit tests failed four. The later
trusted workspace-name requirement also had a failing test before its change.

Each worker made the focused tests green and kept the existing guards covered.
The manager's clean build and final focused run passed all 263 selected tests,
including every changed ordinary test and both changed portal test files. The
live administration driver compiles; its execution remains deferred below.

The implementation keeps the existing administration and directory boundaries:

- Members waits for complete member and invitation reads. It displays active
  members and pending invitations, with an empty state when needed. A failed
  read does not render partial data or an invitation form.
- The same current membership read that authorizes administration supplies the
  workspace name. The provider subject, not email, supplies the You label.
  Invitation expiry crosses the safe projection without tokens or links.
- One native email/User/Admin form defaults to User. Admin includes product and
  MCP access. Only current pending invitations offer Resend and Revoke. Existing
  role, organization, origin, CSRF, paging, conflict, and state-race guards remain.
- Confirmed writes redirect to Members. The old Invitations URL checks current
  authority and redirects there too. No flash-message store or history page is
  added. A typed unknown-write error gives a fixed 503 notice and a Check status
  GET link. Preflight failures remain distinct. No automatic retry occurs; a
  pending read never proves that an email was delivered.
- The portal uses current access roles for its navigation. Users keep Product /
  Connect and workspace selection; Admins also see Members. The route checks
  current authority independently.

The native SDK integration cases cover a send whose persisted response is lost,
and malformed resend/revoke responses. Each makes exactly one provider write;
a later read cannot rewrite the unknown record as success. The organization
double now matches the existing provider address-conflict rule. This corrects
test fidelity; it adds no new production invitation rule.

Manual Chromium review used the real built portal and account HTML through a
local HTTPS front, with the fake WorkOS service. Desktop, 390px and 320px layouts
fit without horizontal scrolling, including a long email address. Keyboard focus
and 200% CSS zoom passed. With JavaScript disabled, the browser sent a default
User invitation and a selected Admin invitation and followed each redirect back
to Members. Admin and User portal navigation matched current access. No browser
script or CSP error remained. Screenshots and the run result are retained in the
local review bundle. An earlier intercepted-browser preview could not follow
native redirects; the final check used real local HTTPS navigation instead.

## Evidence limits

The new acceptance cases use the real hosted HTTP server with provider doubles.
Existing hosted WorkOS cases and the new service integration cases use the real
WorkOS adapter and pinned SDK against a local HTTP fake. They verify application
behavior, not the live provider.

The official [WorkOS invitation reference](https://workos.com/docs/reference/authkit/invitation),
checked on 22 October 2026, documents expiry and role fields, native lifecycle
responses, and pending-only resend. This is contract evidence, not a new live
role-preservation proof. S1-04b keeps invitation acceptance and its live races.
No WorkOS settings, infrastructure, database, or credentials changed.

No hosted live run is claimed. The parent's saved-client/connected-staging
mismatch and absent saved issuer remain a release hold; this increment does not
revalidate or change that environment. The harness must not create fixtures in
an unverified environment. Real password, verification, reset, approved legal
documents, and cutover remain S1-05.

## Architecture and review

The manager reviewed all three workers' code and tests. An independent read-only
agent found no actionable issue. Manager review added visible trusted workspace
context before invitation submission. This is agent review, not independent
authorized human approval.

The directory and overview contracts add required member subject, invitation
expiry, and organization-name fields. `ChangeRecording` adds a neutral typed
error for a started but unconfirmed write; preflight errors keep their prior
behavior. The public administration methods and native provider operations stay
the same. Private web page contracts combine the renderers and add the fixed
notice. Browser behavior changes at Members, the old Invitations URL, and portal
navigation; POST protection and successful redirect semantics remain.

Context, containers, component ownership, collaboration, runtime, and deployment
were checked against the final code. The registry now describes the combined
reads and safe unknown outcome. Its hosted member sequence was updated, rendered
with Mermaid CLI 12.0.0 using the installed Chromium, and visually inspected.
Other diagrams remain accurate. No owner, provider, datastore, deployment edge,
resource lifetime, SDK dependency, or public provider operation is added.

Policy questions for this increment:

- Enforcement: no check, native guard, approval rule, or live gate is relaxed.
- Data and rollback: the UI adds no saved application state. WorkOS remains the
  membership/invitation authority; page navigation cannot grant access.
- Trust and admission: current identity, role, selected organization, Origin,
  CSRF, and pending target still decide writes. Reads remain bounded and complete.
- Contracts: the neutral projection/error contracts and visible browser outcomes
  change. The complete stack needs T2 Need architect. No new decision record was
  requested.

## Complete-candidate validation

The comparison base is trusted `origin/main`, not only PR #223. Earlier source
changes in the stack select the ordinary suite, type checking, portal build,
both container gates, hosted offline build, habit-hooks, metrics, and tier check.
Do not add a redundant standalone `npm run check`. The live limit above remains.

| Check | Result |
| --- | --- |
| New/changed ordinary tests and portal files | 263/263 passed after a clean build. |
| Final Members page regression | 19/19 passed from rebuilt output after test review restored method-refusal guarantees and removed non-null assertions. |
| `npm test` | 4,159 server tests and 49 portal tests passed. The final test-only cleanup is covered by the focused run above. |
| `npm run typecheck` | Passed. |
| `npm run build:user-portal` | Passed. |
| `npm run test:container` | 11/11 passed with the real self-hosted image. |
| `npm run build:hosted` | Passed: 2,593 server unit, 29 portal unit, 20 portal acceptance, 1,039 integration, 118 selected acceptance/interface, and 13 renderer tests. |
| Browser and registry review | Passed within the limits described above. |
| Hosted Linux AMD64 image | 7/7 passed, including the image build and real runtime/renderer checks. |
| Coverage | Verified unit and integration capture: 139 source files from 633 processes. |
| Native metrics | Delta and Review have retained goal misses. CRAP fails on omitted native declarations; Architecture is unavailable. |
| Review tier | T2 Need architect; eligibility blocked by failed CRAP, unavailable Architecture, and missing CRAP rows. No undeclared fact or new cycle was found. |
| Hosted live | Not run: the staging environment hold above remains. |

The final habit-hooks run reports five complexity, one parameter-count, 654
comment, and 24 file-size findings. It reports no non-null assertions after the
test cleanup. The snooze file remains empty. Complexity and parameter findings
retain the [parent reasons](admin-s1-03b.md#quality-review-and-blocker): strict
signup validation and ordered browser outcomes remain together. The new Members
behavior adds no complexity or parameter finding. The portal acceptance file
crosses the size threshold because it keeps its related observable outcomes
together. Other size findings retain cohesive service, adapter, and test-file
boundaries. The added comments document trust sources, safe public projections,
native invitation limits, and unknown-write semantics. Removing those contracts
or splitting files only to reduce a count would obscure the guarantees. These
are retained findings with reasons, not a passing lint result.

## Metrics review

The pinned analyzer is ast-metrics 0.43.1. Against trusted `origin/main`,
these 25 changed production files remain below MI 85. They are goal misses,
not passes. Low files changed in this increment were inspected through the
native MCP wrapper. Required guards remain direct; no wrapper was added only
to move a score.

| File | Base → head MI | Reason to retain |
| --- | ---: | --- |
| `administration-overviews.ts` | 77.0 → 75.8 | Keep small frozen read projections together. Trusted name, subject, and expiry are needed by the page; complete-stack paths fall from 18 to 15. |
| `organization-administration.ts` | 64.8 → 64.8 | Keep current authorization, native invitation preflight, and outcome recording in one service. Name validation uses the same current membership read; complete-stack paths fall from 57 to 46. |
| `hosted-role-mapping.ts` | 73.1 → 73.3 | Validate the whole catalog before giving a grant. The same small mapper now checks two roles. |
| `session-cookies.ts` | 66.3 → 66.3 | Compatibility comment only. Seal verification and cookie effects remain unchanged. |
| `workos-auth-provider.ts` | 67.9 → 67.9 | Contract comment only. Existing verification and current-membership resolution remain unchanged. |
| `workos-browser-session.ts` | 63.9 → 64.2 | Remove inferred MFA while keeping session refresh and cookie effects together; paths fall from 49  to 48. |
| `workos-organizations.ts` | 53.1 → 53.5 | Keep exact membership validation and bounded provider reads. Subject and expiry reuse validated native records; complete-stack paths fall from 110 to 104. |
| `workos-settings.ts` | 66.4 → 69.1 | Remove the MFA mode; paths fall from 37  to 33. Keep startup validation and safe diagnostics. |
| `workos-sign-in.ts` | 66.8 → 66.6 | Remove inference; paths fall from 21  to 20. The remaining state, expiry, and callback checks belong to one sign-in operation. |
| `workos-signup-documents.ts` | 72.3 → 70.2 | Keep purpose, version, canonical bytes, and hash validation at one boundary. The purpose discriminator adds three paths; it prevents personal terms from authorizing organization creation. |
| `workos-signup.ts` | 36.3 → 32.5 | Keep confirmed creation, canonical metadata, reread, and grant checks in order. S1-03b characterized recovery and retained this owner; thin wrappers would hide the authority boundary. |
| `hosted-portal.ts` | 50.6 → 49.9 | Parent origin validation adds three required paths. Keep existing routing and build-output guards. Trivial wrappers would not simplify them. |
| `hosted-workos-application.ts` | 63.0 → 62.2 | Keep provider construction and cleanup in one composition. The neutral name callback uses the existing directory; complete-stack paths stay 13. |
| `portal.ts` | 50.2 → 47.0 | Keep current-access navigation with product rendering. The new private navigation helper has two paths and no authorization authority; a router or state framework is unnecessary. |
| `account-form.ts` | 61.2 → 61.6 | Parent grant-parser removal reduces paths from 49  to 45. Bounded-body and CSRF validation remain. |
| `account-pages.ts` | 75.2 → 73.9 | Keep the fixed unconfirmed-write notice with other small notices. Its only action is a GET status check; no failure cause or write retry is rendered. |
| `account-routes.ts` | 61.2 → 61.2 | Parent boundary change preserves current access, selection, cookies, and failure behavior. |
| `administration-pages.ts` | 69.1 → 63.9 | Keep one native Members template and three small formatting/form helpers. The main template has three paths, sendForm has two, and invitationRow has one. Splitting static HTML would add indirection without separating a rule. |
| `administration-routes.ts` | 61.3 → 59.3 | Keep Origin, method, CSRF, selected-organization, current-authority, and safe-error checks at the request boundary. changeOnPost has ten necessary paths; complete-stack file paths stay 44. |
| `portal-access.ts` | 79.7 → 72.3 | Keep permission, exact membership name, and response construction at one HTTP boundary. Missing names fail safely after permission is checked. |
| `workos-session-routes.ts` | 61.6 → 61.8 | Parent contract extraction preserves callback, return-path, logout, and cookie behavior. |
| `workos-signup-document-reader.ts` | 81.2 → 81.2 | Parent shared-type import only; bounded legal-document rendering stays the same. |
| `workos-signup-form.ts` | 61.0 → 58.3 | Keep bounded single-field, CSRF, version, and agreement parsing together. Domain name validation is shared through its public interface. |
| `workos-signup-pages.ts` | 52.4 → 52.4 | Reuse the existing legal readers and page layout for the name and single agreement. The provider-independent markup stays in one page module. |
| `workos-signup-routes.ts` | 43.9 → 40.5 | Keep admission, CSRF, cancellation, and cookie effects with the signup request. The new private switch step isolates handoff from activation without duplicating grants. |


The new `members-style.ts` contains one CSS string and no functions. The complete
snapshot confirms zero source declarations, so its MI and CRAP are N/A.
`change-records.ts` scores 89.8; the existing added signup contract scores 87.9
and `customer-roles.ts` scores 89.9. No new production file needs an MI exception.

The native review reports 15 high findings on changed production files. Fourteen
are covered by the table. The other is the class measure in `change-records.ts`:
keep the small typed failure and the separation of preflight, one write, and
outcome recording. The file measure passes. The Members template's MI drop from
69.1 to 63.9 is included in those findings and has its reason in the table.
Two high test findings retain the explicit session-MFA matrix and portal-access
contract cases from the parent; their independent scenarios keep each outcome
visible. The remaining 48 high findings concern files unchanged by this complete
candidate. Test files have no MI goal.
These retained reasons do not authorize a merge.

Coverage was captured after the complete source, tests, and impact declaration
were committed. Later prose does not alter its source or build inputs. The
standalone CRAP command still fails because `get_file_metrics` omits source
declarations in `src/accounts/organizations/organization-administration.ts`.
There is no valid CRAP report or completed function-goal assessment. This is a
tool failure, not a permitted metric exception.

The complete process reports Delta and Review goal misses, failed CRAP, and
unavailable Architecture. No metrics history record was created because all four
sections did not complete. No baseline, rules, exception, or coverage edit hides
the native-tool failure. Coverage remains verified and matches the final source
and input fingerprints; it does not replace the missing function assessment.

## Review tier and retained evidence

The candidate-bound classifier reports **T2 Need architect**, with three
blockers: failed CRAP, unavailable Architecture, and missing CRAP rows.
Observable authorization, signup, persistence, and portal contracts in the full
stack require architecture review. Retained T1 reasons are protected policy,
deployment/data and security paths; test-gate documentation; declared dependencies
and public surfaces; production/total review size and test-count changes; MI
drops and retained high findings; and declared component, internal-interface,
sensitive-behavior and policy impact. The full report records each reason.

Required metrics must complete before Ready. Independent authorized human
architect approval must cover the current candidate before merge. Agent review
and the tier label are not that approval. This PR remains Draft.

Full reports and command logs are retained in this worktree at
`/Users/tomermayara/.codex/worktrees/admin-s1-04a/Thermus/ast-report/README.md`.
The bundle links the process and native review, base/head snapshots, verified
coverage, stamped impact, final tier result, browser screenshots, and the rendered
registry diagram. These are local review artifacts, not uploaded CI results.
There is no valid `crap.json` to link or approve.

PR #223 must merge before this stacked PR. Preserve its workspace and reports.
This request includes neither merge nor rollout. Native acceptance proof remains
S1-04b; the live environment and S1-05 legal/cutover holds remain as stated above.
