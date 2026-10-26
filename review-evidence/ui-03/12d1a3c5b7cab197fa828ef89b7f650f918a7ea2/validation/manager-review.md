# UI-03 manager review

Parent: a017020ebe2448f5de6cc7d9cbb0700367fc80b1 (UI-01 PR #263).
Scope: UI-03 on its own branch, with UI-02 PR #264 as a sibling. Final candidate
pin and gate results will be added after validation.

## Source and behavior

The manager read the three production-file changes, the invitation/removal
routes and parsing boundary, new browser drivers and HTTPS test site, focused
integration cases, all label migrations and the changed documents. The change
uses one native closed Details and the existing protected form. It adds no
client script or state. The current service still owns role eligibility,
duplicate handling, recipient policy and safe fixed outcomes. Cancel is a GET.
Only the existing send POST mutates an invitation. Last-Admin guidance points
to the unchanged recovery route; the server's Admin safeguard is unchanged.

The manager requested independent browser outcomes and a 200% text check at
intermediate widths. The tests now use fresh fixtures; the observed 481px
overlap was fixed by stacking through 860px, without a fixed title spacer.
The manager also requested explicit guards instead of non-null assertions and
separate Set-Cookie forwarding plus surfaced failures in the HTTPS test bridge.
Those changes are included and the complete browser gate passed afterwards.

Desktop and narrow open/closed screenshots and long-value doubled-text output
show the expected UI-01 member rows beside the UI-03 invitation task. They do
not claim UI-02 or UI-04 presentation. No paid service, production fixture,
MFA, provider rule or authentication behavior changes.

## Architecture

All 15 registry Mermaid views and registry prose match the UI-01 parent bytes.
The existing Web owner renders trusted complete overviews and uses the same
protected invitation POST and last-Admin recovery navigation. There is no
component set, production import edge, public module, declaration, container,
store, deployment or lifecycle change. The strongest affected renderer is
membersPage: parameters and Response security/status rules stay intact while
native HTML composition changes. Existing component views and these behavior
notes fully explain it; no L3 comparison or L4 detail is needed. Test helper
signatures do not establish a production architecture fact.

Independent agent review found no actionable issue. Its original dirty-tree
scope hashes and follow-up hashes bind the reviewed files. Root reviewed later
document-only evidence updates. Agent review is not human approval.

## Validation corrections

The Collector run first passed 8/10. Its two saved-destination probes could not
load the existing micromark renderer dependency from their isolated copied
fixture. The fixture now uses the same complete read-only source/support/npm
workspace mounts as its public journey. Assertions, TLS verification, isolated
network, pinned image and cleanup stay intact. The full group then passed 10/10.
The prior failed log is retained.

The first staging run omitted LIGHTPANDA_BIN from the launch environment. The
server correctly refused startup: 7 provider-only checks passed and 22 server
checks failed. Fixture cleanup completed. The repeat supplies the existing
absolute pinned Lightpanda 1.0.0 binary; no application guard was changed.
The test-gate prerequisite row now names this existing requirement. The private
staging launcher correction is documented separately in launcher-review.md.

The repeated complete staging run passed 28/29. Its invitation lifecycle case
could not find the third invitation's Revoke form. The test now asserts the
third send's existing 303 and Members target before reading that form; it keeps
the same assertion and removes only its later duplicate. The independent
reviewer checked this delta. A focused diagnostic run then failed in shared
fixture setup with WorkOS HTTP 429, sandbox invitation-email quota reached.
That later observation does not establish the cause of the earlier missing
form. No provider configuration or paid tier changed. workos-quota.md retains
the request ID, source links, diagnostic limit and required next step.

## Functional checks and provenance

The candidate is 12d1a3c5b7cab197fa828ef89b7f650f918a7ea2. All 921 inputs in
precommit-inputs-diagnostic.json match the committed candidate. This pins the
dirty-tree functional runs to the source actually committed; their original
logs still name the scope commit 2330b715 where applicable. The earlier input
manifests and failed logs remain available. No source comparison ran during a
build, Docker context capture or functional test.

Passed: 137 focused ordinary, 38 Members browser, 5,135 full ordinary plus 49
portal, typecheck, portal build, 26 PostgreSQL, 10 Collector, 11 self-hosted
container and seven hosted Linux AMD64 runtime checks. The hosted build's
network-disabled stage passed 3,301 unit, 49 portal, 1,163 integration, 119
acceptance/interface and 13 renderer checks. Its build record is
colima/colima/1zfit33a344ylvh6zvq989k6z, created 23:26:26 UTC and completed
23:35:07 UTC on 2026-10-26. hosted-build.log comes from that exact record's
short ID; the earlier full-ref log command failed to resolve and is not build
evidence. The image gate cleaned its test resources.

The integration coverage collector passed all 1,163 tests at the committed
candidate. It wrote a verified capture from 286 processes covering 163 files.
This suite is already selected through npm test. Base CRAP values made from
this head capture are estimates, not measured base coverage. Metrics comparison
starts only after all builds and functional tests have stopped.

Required hosted staging remains blocked, so this candidate stays Draft. The
two retained removal ledgers end with cleanup-complete and an empty failure
list. The provider fixture registry also runs cleanup on setup failure.
## Metrics and retained findings

The base/head snapshots, full process, CRAP report and checker all compare
12d1a3c5 to the actual UI-01 parent a017020e. This follows the supplied AGENTS.md
stack instruction; the older README sentence that keeps the process on main
does not override it. The process exits 1 for its Delta and Review goal misses;
CRAP and Architecture pass. This is not described as a wholly green process.

- administration-pages.ts MI is 61.251 to 60.969. Its coherent page/form renderer
  has 24 total decision paths; membersPage has three and sendForm has two.
  The change wraps the existing form and moves its exact policy note. Splitting
  the trusted form fields into more modules to raise a file score would hide
  their relationship and add needless boundaries.
- account-pages.ts MI stays 72.761. Fixed notices and their recovery links share
  one response owner. Only the last-Admin instruction changes; extracting that
  sentence into a separate module would not simplify behavior.
- members-style.ts contains a CSS string and no functions; raw MI and function
  CRAP are not applicable. Browser layout, focus and reflow checks cover it.
- The browser acceptance file has a high MI regression, 28.151 to 21.327. It
  keeps independent fresh user journeys in the selected shared browser group;
  the new imperative browser mechanics are already in InvitationBrowser.
  More generic scenario machinery would conceal the Given/When/Then outcomes.
  Test files have no production MI target.
- The page integration test's low Halstead estimate rises from 2.834 to 3.557.
  The additional assertions specify native disclosure, protected fields, role
  subsets and policy placement at the same public boundary. This size estimate
  is not a demonstrated defect.
- The native engine also flags inspectOpenForm at exactly ten paths. The
  repository's existing review wrapper requires more than ten for that warning
  and correctly omits it from policy findings. It checks one visible form and
  its control geometry; no threshold or tool configuration was changed.

Changed/new CRAP rows: membersPage 3.0 at 97.4% coverage; removalResultPage and
sendForm each 2.0 at 100%; two callbacks classified new each 1.0 at 100%.
All required function goals pass, with no unknown function identity/coverage or
metric exception. Remaining unchanged rows keep the reason unchanged by this
PR. The architecture graph retains the unresolved main.ts to style.css import
at both revisions. That parser limit prevents claiming complete global graph
evidence; source imports and registry responsibilities are unchanged. The tool
wrote no immutable history because the stack parent is not on origin/main.

## Retained habit-hooks findings

habit-hooks exits 1. The manager read every finding; the reasons below retain
them under AGENTS.md. The snooze file stays empty. No suppression is added.

- High complexity, hosted-admin-journey.test.ts:13: the role-parameterized
  acceptance shows the entire creator, invitee, browser and MCP journey and
  verifies that only the creator acceptance record exists. The conditional
  expectations distinguish the two required roles; UI-03 only migrates its
  rendered submit selector.
- Comment, same file:53: states the provider-double evidence limit so this
  application test cannot be read as proof of native invitation rules.
- Comments, hosted-workos-administration.test.ts:8-11: state real composition,
  fake single-role assumptions and the need for separate staging proof.
- Comment, same file:16: binds the external-ID fixture to the operator runbook.
- Comments, same file:34-35: explain which fixture memberships count as product
  seats, including mixed/default/inactive roles.
- Comments, same file:81-82: explain why refusal cases get CSRF from the session
  endpoint when the refused page has no form.
- Comments, same file:108-109: distinguish administration writes from sign-in
  and refresh activity for the no-write assertions.
- Comments, same file:136-137: distinguish organization-wide member reads from
  the session user's access-resolution reads.
- Comment, audit-sender-site.ts:59: explains why public-shaped test IP addresses
  cannot escape the internal Docker network and why candidate subnets exist.
- Comment, same file:75: explains why readable fixture key files are disposable,
  not service credentials.
- Comment, same file:182: states the isolation and real TLS policy boundary of
  the public test site used by both Collector cases.
- Comment, browser-transport-site.ts:11: explains the HTTPS front required for
  Chromium to follow actual redirects using the public test hostname.
- Comment, hosted-audit-journey-site.ts:40: states which public paths share real
  capture and which page operation remains controlled.
- Comments, account-pages.ts:13,96,118: preserve the fixed-text/no-input rule,
  separation of a write outcome from the next read, and onboarding recovery for
  identities that have no organization.
- Comment, administration-pages.ts:25: preserves the complete-read constraint
  before rendering either member or invitation data.
- Comments, hosted-live/administration-server.ts:43-44,79,129: delimit safe
  failure reports, boolean-only secret checks, and invitation credential reads.
- Comments, same file:101,104: make the shared signed-in fixture lifetime and
  actual rendered-form submission boundary explicit.
- Oversized hosted-live/administration-server.ts: one real staging invitation
  and member journey shares its scoped fixture, browser and safe diagnostics.
- Oversized hosted-member-removal-browser.runtime.ts: independent Members,
  invitation, removal and shared-shell/Audit regressions remain together in the
  selected browser gate; mechanics have focused driver/site owners.
- Oversized hosted-workos-administration.test.ts: keeps the coherent provider
  contract and role/refusal matrix with its declared fixture assumptions.
- Oversized account-routes-administration-pages.test.ts: keeps a page rendering
  contract with its complete input, role, escaping and protected-form matrix.
- Oversized audit-sender-site.ts: keeps ownership of the isolated network,
  containers, certificates and teardown in one test site. The fixture fix
  reuses its existing complete read-only mounts instead of a growing copy list.

## Final manager sign-off

The manager signs off the implementation at 12d1a3c5b7cab197fa828ef89b7f650f918a7ea2
for the published Draft PR. Independent agent review found no actionable issue;
the manager reviewed the later validation record. All source/test content
matches the reviewed and tested input hashes. This is not human approval or
sign-off for Ready, merge or deployment.

The final checker exits 0: T1 Team review, preliminary locally eligible, no
checker blocker or architecture fact. Its only tier reason is the changed
test-gate-policy read path. Those edits document browser cases and existing
prerequisites; they change no test selection, gate command or decision authority.
The all-false semantic impact flags are correct. It verifies 49 public module
snapshots unchanged. account-form.ts is transitively touched through its import
of account-pages.ts; its declaration, CSRF and bounded-body contract are intact.
The declaration compiler notes 33 diagnostics in two unlisted modules. The
separate complete typecheck passes; the 49 listed snapshots were verified.

No GitHub checks or statuses were reported at this exact head. Overall merge
status is blocked by the required hosted-live rerun after quota recovery and
by missing independent authorized T1 owner/team approval of the candidate.
The request includes no merge or deployment. The branch/worktree remains
available for the unmerged stack. All full reports and failure history are
retained as review evidence; generated metrics are not edited.
