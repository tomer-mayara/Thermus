# S1-04a implementation record

Status: implemented; final quality and image checks in progress, 22 October 2026.

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
| Hosted Linux AMD64 image | In progress. |
| Coverage, native metrics, and review tier | Pending on the committed candidate. |
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

Final metric findings and candidate-bound reports follow after measurement.
