# S1-03a implementation record

Status: implementation complete; complete-candidate checks in progress,
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
establish the missing behavior. Final focused and complete-candidate results
will be recorded after implementation.

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
the form calls the public name validator. The owner pair, public surfaces, and
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

## Review and stack

The complete ordinary suite passes: 4,124 server tests in 262 suites and 43
portal tests. The dedicated container, hosted build/image, and metrics results
will be recorded when those commands finish. The selected gates are the same
source-change gates as the parent; the complete candidate is compared with
`origin/main`, not only the stack parent. Live WorkOS remains unrun for the
matching-staging configuration limit recorded in S1-02.

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
