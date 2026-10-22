# S1-03a implementation record

Status: implementation complete; application checks pass; required metrics blocked,
22 October 2026.

## Scope

Implement [S1-03a](../design/organization-admin-plan.md#s1-03a--named-creation-agreement-and-first-admin)
on top of [S1-02 PR #221](https://github.com/tomer-mayara/Thermus/pull/221).
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

Before source edits, the two S1-03a acceptance tests both failed: the name input
was absent and the named form POST returned 400 instead of 303. Focused provider
tests also failed for the fixed name, missing authority facts, legacy bundle
acceptance, and unconfirmed create or membership responses. These failures
establish the missing behavior. The results below record the later green runs
and the complete-candidate evidence limits.

The [WorkOS metadata contract](https://workos.com/docs/authkit/metadata) limits
an organization to ten pairs. The v2 record therefore replaces `accepted_at`
with `authority_accepted_at` and adds `agreement_sha256` to the nine-field v1
shape. The timestamp records affirmative acceptance of the organization/authority
agreement. No separate boolean or follow-up metadata write is needed. The
provider organization ID and unchanged reserved external ID bind its identity.

## Implemented behavior

- The creation form accepts one editable organization name and one unchecked
  agreement. It rejects missing, repeated, unknown, stale, forged, or invalid
  fields before calling activation. Names are trimmed, well-formed Unicode,
  contain no control characters, and use 1 to 100 UTF-16 units. The HTML limit
  uses the same unit.
- The provider adapter validates the exact canonical document bytes and purpose
  before a fresh create. It saves ten ASCII metadata values, each at most 500
  characters, below the provider limit of 600. A matching create response and
  reread must confirm the name, identity, empty domains, and acceptance facts.
- Only a confirmed new organization can cause the initial Admin write. The
  returned membership must identify this creator and organization, be active,
  be unmanaged by a directory, and contain only Admin. A fresh membership and
  role-catalog read must also confirm Admin product access. An uncertain write
  gets a read, never another grant attempt.
- Existing v1 and v2 records retain their replay barrier. A current membership
  can supply access; the record alone cannot grant, restore, or promote it.
  New creation never converts v1 personal acceptance into organization consent.
- An active result authorizes the session switch to that organization. A
  successful switch opens the portal root. Refusal, sign-out, outage, and
  cancellation preserve the recovery boundary. Cookie effects retain their
  order: the new switch cookie follows any earlier authentication refresh.
- The portal obtains the name from a supplied callback that reads the exact
  current active membership. It does not read unrelated organizations or their
  role catalogs to obtain a label. Missing names give a recoverable 503. The
  guide renders the name as text and retains the organization ID in its access
  details. Product and MCP authorization still use current permissions and IDs.

## Acceptance evidence and limits

The initial two BDD failures and the focused provider failures preceded source
edits. The final worker runs passed 84 provider/document cases, 27 signup/restart
acceptance cases, and 136 form, session, portal, and related cases. A manager run
after the TypeScript build passed all 213 changed server tests. Type checking
and the portal build pass.

The server acceptance cases use the real hosted HTTP composition with a WorkOS
transport double. They verify the named record, first Admin, selected-session
ID, root redirect, and guide data. The separate portal acceptance cases render
that contract and verify the visible name, ID, and MCP endpoint. These checks
do not claim a live WorkOS browser run. The live scenario was updated to check
the visible name, but it remains unrun without matching staging settings.

Manual Chromium inspection of the actual signup page at 1440 and 390 pixels
confirmed readable fields, agreement, legal readers, and actions, with no
horizontal overflow. The screenshots use marked test documents. They do not
approve production terms. Local Markdown targets, code fences, and whitespace
checks pass.

## Architecture and contract review

The manager reviewed the four workers' changes and their test evidence. The
registry's context, containers, components, runtime, and deployment views were
checked. Updated text records creation authority, the session handoff, and the
name callback. No new container, datastore, provider, or resource lifetime is
introduced. The existing diagrams remain accurate; this ticket changes none.

The existing web-to-organizations dependency is now declared as runtime because
the form calls the public name validator. The owner pair, declared public-module list, and
forbidden-edge rules remain the same. Focused import lint passes. Tests that
execute the real WorkOS adapter and organizations validator moved from unit to
integration; their fixture moved with them. No test-only validator injection
was added.

| Public or shared surface | Reviewed guarantee |
| --- | --- |
| `SignupActivation`, `SignupDocuments`, `organizationNameIn` | Activation takes a name; documents carry an optional creation purpose; the name validator has a bounded neutral contract. Active means a current read confirmed usable membership. |
| `WorkOSSignupOptions`, `WorkOSSignup` | Organization responses carry a name. Fresh creation persists v2 facts and grants confirmed Admin; v1 recovery stays read-only. |
| `validateSignupDocuments` | Preserves exact bytes and accepted purpose; unknown purposes and altered hashes fail. |
| `SignedInBrowserSession` | Comments now describe actual callers and the retired MFA inference; no session shape changes. |
| `WorkOSOrganizations.activeOrganizationName` | Returns a display label only for the exact active membership and trusted authority. It does not authorize product access. |
| Signup HTTP and page helpers | POST requires `organization_name`; enabled legacy documents fail startup; confirmed success selects the organization and redirects to the portal. Existing CSRF, origin, admission, and cancellation rules remain. |
| `portalAccessOperation` and portal JSON | Requires a supplied name reader; successful JSON adds `organizationName`; a missing name returns 503 after the permission check. |
| `initializePortal` | Displays the trusted name as text and supplies a retry view for unavailable workspace data. |
| Hosted composition | Supplies the existing WorkOS directory through a neutral callback. The core and UI do not depend on SDK types. |

These observable creation, persistence, and portal/server guarantees require
**T2 Need architect**. Internal interfaces, sensitive behavior, the dependency
declaration, and retained quality findings also require human review. The parent
records describe the S1-01 and S1-02 contract changes included in this complete
candidate. No new decision record was requested. Agent review is not the
required independent human approval.

The applicable policy questions have these answers:

- Enforcement and decision makers: the new runtime dependency is declared under
  the existing owner pair. Forbidden edges, test selection, tier definitions,
  and human approval rules stay unchanged. The image test now checks refusal
  of the legacy legal bundle; it does not skip the startup gate.
- Image, runtime, and data: the image uses the new source and retains default
  closed signup. New records use v2; old records remain barriers. Disable
  creation to stop new signup without deleting records or memberships. An
  older reader must not repair or replay an unfamiliar v2 record.
- Admission and trust: only a verified creator, valid canonical documents,
  confirmed new organization, and current matching Admin membership can finish
  creation. Requests keep CSRF, origin, bounded work, and cancellation checks.
  Metadata and names cannot authorize product or MCP access.
- Observable promises: the contract table covers the new name input, first
  Admin, persisted acceptance, direct landing, missing-name error, and legacy
  bundle startup refusal. The parent records cover role, MFA, and retired-write
  changes. Existing checks of removed behavior were replaced by refusal or
  current-role checks; the test move changes classification, not coverage.

## Review and stack

The selected gates are the same source-change gates as the parent; the complete
candidate is compared with `origin/main`, not only the stack parent. Live
WorkOS remains unrun for the matching-staging configuration limit recorded in
S1-02.

| Check | Result |
| --- | --- |
| Compiled changed server tests | 213 passed. |
| `npm test` | 4,124 server tests in 262 suites and 43 portal tests passed. |
| `npm run typecheck` | Passed. |
| `npm run build:user-portal` | Passed. |
| `npm run test:container` | All 11 self-hosted cases passed. |
| `npm run build:hosted` | All selected groups passed: 2,583 server unit, 25 portal unit, 18 portal acceptance, 1,033 integration, 118 selected acceptance/interface, and 13 renderer cases. |
| `npm run test:container:hosted` | All 7 Linux AMD64 cases passed, including rejection of enabled creation with the legacy legal bundle. |
| Unit and integration coverage | Passed; 138 source files and 633 processes. |
| Base and head snapshots | Completed with ast-metrics 0.43.1. |
| Complete metrics process and standalone CRAP | Failed on omitted native source declarations; details below. |
| Review tier | T2 Need architect; eligibility blocked by failed CRAP, unavailable Architecture, and missing CRAP rows. No undeclared dependency fact or new cycle was found. |

The final edits after these functional runs are documentation and impact
evidence only. They change no source or test. The final metrics and declaration
are bound to the committed candidate. The impact JSON is a coverage input, so
coverage must be collected again after that declaration is committed.
The ten registry diagram blocks match the reviewed parent exactly. Its retained
Mermaid CLI 12.0.0 renders remain valid for those unchanged diagrams.

The final import-corrected habit run exits 1 with five complexity findings,
one parameter-count finding, 637 comment findings, and 21 file-size findings.
The manager retains these findings for the following reasons; the snooze file
stays empty:

- `WorkOSSignup.createOrganization` keeps the ordered input, create-response,
  reread, and grant-authority checks in one operation. Each refusal is a flat
  guard. Moving them into small wrappers would hide that security sequence.
- The two `hosted-portal.ts` functions retain the routing and built-output checks
  reviewed in S1-01. This ticket does not alter them.
- `productAccess` keeps transport-shape and endpoint validation at one boundary.
  Its new name check belongs with the existing ID, roles, plan, and URL checks.
  The flagged portal test is an explicit malformed-response matrix, not a
  production decision function.
- `openOrganization` takes the request, current session, confirmed ID, and
  request-scoped cancellation runner. Each has a distinct role. A new wrapper
  object would only package these four arguments for this one call.
- Comments describe authority, canonical bytes, cookie effects, uncertain
  writes, protocol constraints, and test boundaries. These explain guarantees
  that the code cannot show by a name alone. The full log names each occurrence.
- The two large production files are the WorkOS organization and signup
  adapters. Their methods share provider validation and bounded reads. The
  other 19 files hold cohesive scenario groups, live fixtures/runbooks, or
  provider doubles. The signup tests moved to their correct integration group;
  splitting them only by line count would scatter the same contract.

These reasons permit review; they do not turn the findings into tool passes.

The complete candidate includes S1-01 and S1-02 and uses trusted `origin/main`
policy. The incremental PR diff targets S1-02. The parent PR's native metrics
omission remains a known evidence limit; new checks must report their actual
results. Authorization and persistence contracts require architecture review.
No human approval or live provider pass is claimed. Merge and rollout are not
part of this implementation request.

## Metrics review and blocker

The pinned analyzer is ast-metrics 0.43.1. These are all 25 changed production
files below MI 85 against trusted `origin/main`, including the parent tickets.
They are retained goal misses, not passes. The added executable signup contract
scores 87.9; `customer-roles.ts` scores 89.9 and `change-records.ts` scores 90.4.
No new production file needs an MI exception.

| File | Base → head MI | Reason to retain |
| --- | ---: | --- |
| `administration-overviews.ts` | 77.0 → 76.3 | Keep small frozen read projections together. Paths fall from 18  to 15; product-member counting has two paths. |
| `organization-administration.ts` | 64.8 → 66.9 | Writer and MFA removal reduce paths from 57  to 42. Current authority, invitation state, and outcome recording remain necessary. |
| `hosted-role-mapping.ts` | 73.1 → 73.3 | Validate the whole catalog before giving a grant. The same small mapper now checks two roles. |
| `session-cookies.ts` | 66.3 → 66.3 | Compatibility comment only. Seal verification and cookie effects remain unchanged. |
| `workos-auth-provider.ts` | 67.9 → 67.9 | Contract comment only. Existing verification and current-membership resolution remain unchanged. |
| `workos-browser-session.ts` | 63.9 → 64.2 | Remove inferred MFA while keeping session refresh and cookie effects together; paths fall from 49  to 48. |
| `workos-organizations.ts` | 53.1 → 53.5 | Keep exact membership validation and bounded provider reads. The new six-line display reader reuses them; complete-stack paths fall from 110  to 104. |
| `workos-settings.ts` | 66.4 → 69.1 | Remove the MFA mode; paths fall from 37  to 33. Keep startup validation and safe diagnostics. |
| `workos-sign-in.ts` | 66.8 → 66.6 | Remove inference; paths fall from 21  to 20. The remaining state, expiry, and callback checks belong to one sign-in operation. |
| `workos-signup-documents.ts` | 72.3 → 70.2 | Keep purpose, version, canonical bytes, and hash validation at one boundary. The purpose discriminator adds three paths; it prevents personal terms from authorizing organization creation. |
| `workos-signup.ts` | 36.3 → 32.5 | Keep confirmed creation, canonical metadata, reread, and grant checks in order. Native createOrganization has 12 paths and grantNewWorkspace has 6. A broad recovery split is S1-03b scope; thin wrappers would hide this authority boundary. |
| `hosted-portal.ts` | 50.6 → 49.9 | Parent origin validation adds three required paths. Keep existing routing and build-output guards. Trivial wrappers would not simplify them. |
| `hosted-workos-application.ts` | 63.0 → 62.2 | Keep provider construction and cleanup in one composition. The neutral name callback uses the existing directory; complete-stack paths stay 13. |
| `portal.ts` | 50.2 → 48.2 | Keep display-contract checks and the safe retry view with portal rendering. Names use textContent; no new rendering framework or shared service is needed. |
| `account-form.ts` | 61.2 → 61.6 | Parent grant-parser removal reduces paths from 49  to 45. Bounded-body and CSRF validation remain. |
| `account-pages.ts` | 75.2 → 75.4 | Remove the unreachable MFA notice. Keep the small related notice renderers together. |
| `account-routes.ts` | 61.2 → 61.2 | Parent boundary change preserves current access, selection, cookies, and failure behavior. |
| `administration-pages.ts` | 69.1 → 70.6 | Parent grant forms are removed; the member summary now describes product access. No template framework is needed. |
| `administration-routes.ts` | 61.3 → 62.8 | Writer and MFA-result removal reduce paths from 44  to 40. Remaining request guards are required. |
| `portal-access.ts` | 79.7 → 72.3 | Keep permission, exact membership name, and response construction at one HTTP boundary. Missing names fail safely after permission is checked. |
| `workos-session-routes.ts` | 61.6 → 61.8 | Parent contract extraction preserves callback, return-path, logout, and cookie behavior. |
| `workos-signup-document-reader.ts` | 81.2 → 81.2 | Parent shared-type import only; bounded legal-document rendering stays the same. |
| `workos-signup-form.ts` | 61.0 → 58.3 | Keep bounded single-field, CSRF, version, and agreement parsing together. Domain name validation is shared through its public interface. |
| `workos-signup-pages.ts` | 52.4 → 52.4 | Reuse the existing legal readers and page layout for the name and single agreement. The provider-independent markup stays in one page module. |
| `workos-signup-routes.ts` | 43.9 → 40.5 | Keep admission, CSRF, cancellation, and cookie effects with the signup request. The new private switch step isolates handoff from activation without duplicating grants. |

The native review has 14 high findings on changed production files. The table
above covers 13 of them. The other finding is the `ChangeRecording` class: keep
its unchanged separation of authorization checks, the single provider write,
and outcome recording. Its class score differs from the file score.

Two high test findings concern the explicit retained-cookie MFA matrix and the
portal-access contract cases. Their scenarios remain direct and independent;
test files have no MI goal. The other 48 high findings concern files unchanged
by the complete candidate. The native `new-violation` label does not prove that
a source regression was introduced here.

Verified coverage spans 138 source files from 633 processes, from the complete
unit and integration selections. It was not edited. Both the process and the
standalone CRAP command stop because `get_file_metrics` omits source declarations
in `organization-administration.ts`. A read-only diagnostic finds eight changed
files with 189 source declarations but only 142 native function rows, 121 of which
have identities. This diagnostic is not substitute metrics.

The process records Delta and Review goal misses, a failed CRAP stage, and an
unavailable Architecture stage. There is no valid CRAP report, no completed
function-goal assessment, and no new history record. No exception or coverage
change can turn this native-tool failure into a pass. The required assessment
remains blocked, as in the parent PRs, so this PR remains Draft.

## Retained evidence and merge order

Full reports are retained in this worktree at
`/Users/tomermayara/.codex/worktrees/admin-s1-03a/Thermus/ast-report/README.md`.
That local bundle links process and native review reports, base/head snapshots,
verified coverage, source-omission diagnostics, the stamped declaration and full
tier result, screenshots, and command logs. These are local review artifacts,
not uploaded CI results. There is no valid `crap.json` to link or approve.

The tier also retains all T1 reasons: policy/deployment/security paths, test-gate
documentation, declared dependencies, public surfaces, complete-stack review
size, changed test counts, retained metric findings, and declared component,
internal-interface, sensitive-behavior, and policy impact. The full classifier
report keeps every individual reason. No skipped or todo test was added.

PR #221 must merge before this stacked PR. Preserve its workspace and reports.
Independent authorized human architect approval must cover the current candidate;
none is claimed. This implementation request includes neither merge nor rollout.
