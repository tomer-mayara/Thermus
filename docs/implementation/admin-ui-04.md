# UI-04 — Compact pending invitations

Candidate: [PR #268](https://github.com/tomer-mayara/Thermus/pull/268).
Scope: [UI-04](../design/organization-admin-plan.md#ui-04--compact-pending-invitations)
of the Refined tabs plan. PR #266 has merged into main and includes UI-02
PR #264 and its density correction. UI-04 now uses that merged main revision
as its base. The evidence below retains its original execution scope; the
maintained PR comments record the rebased head, base and validation. This
record claims no UI-04 merge or deployment.

## Behavior

Members shows Pending invitations with the complete pending count in a native
disclosure. An empty group starts closed; a nonempty group starts open. Rows
keep their role, absolute UTC expiry and currently allowed protected Resend and
Revoke forms. A later page failure remains the existing error with no partial
list or misleading zero. Add no counter storage, provider rule or new action.

The heading and UI-03 invitation task come first, followed by active members,
pending invitations and the full removal help. Only the help placement changes;
its approved text, version and hash stay intact. Rows wrap long addresses and
use short Resend/Revoke labels with the recipient in each accessible name.
The parent member-row presentation and both counts remain intact.

## BDD and TDD

The first browser acceptance cases failed because the native counted disclosure
did not exist. Focused route cases then failed for zero-closed and nonzero-open
states. Native markup made both sets pass. A real-browser height check and a
focused row-fact test failed before the compact rows and styles were added.
The final focused run passed 78 ordinary cases and all 58 Members browser cases.

Each new browser scenario starts with fresh data, sets JavaScript on or off,
and uses 320px or 1280px. It checks keyboard discovery, complete pagination,
terminal-entry exclusion, permitted protected actions, fixed redirects, UTC
expiry, section order, long values and 200% text. Resend and Revoke each use an
independent fixture. The existing invitation, removal, recovery and Audit cases
remain in the same gate. A public-route acceptance case makes a later directory
page fail and checks that the response has no partial list or count.

One browser run counted sign-in POSTs as page writes. Clearing those setup
requests before the Members GET corrected the test baseline without weakening
the no-write assertion. Manager review also replaced a generated-HTML string
substitution with direct escaped form markup. No shared form API changed.

## Validation and architecture

The source change selects the full ordinary suite, typecheck, portal build,
both container gates and the hosted offline build. Updated form and row readers
also select the PostgreSQL, Collector and hosted staging groups through their
existing consumers. Full command results, failure history, screenshots and
review evidence are maintained in the PR's Validation and Quality review comments.

The full ordinary suite passed 5,139 tests and 49 portal tests. Typecheck, the
portal build, 26 PostgreSQL cases and 10 Collector cases passed. The required
staging group passed 22 of 29 cases. Six failures share a WorkOS HTTP 429 sandbox
invitation-email quota error during fixture setup. Separately, the scoped
removal journey received HTTP 503 instead of 303 when it tried to reinvite the
removed user; its diagnostic does not establish the cause. Earlier removal and
retained-workspace checks passed, and its exact-resource cleanup completed.
Both failed invitation paths remain unverified. The PR stays Draft until the
required group passes. No provider setting, paid service or test gate changed.

Both production files remain in Web. Complete overview reads, allowed actions,
protected fields, recipient rules, provider operations, fixed outcomes and
removal safeguards stay at their current owners. No production callable
contract, public declaration, component dependency, script, store or deployment
boundary changes. All 15 registry views and their prose remain accurate; no new
architecture diagram is needed.

## Combined stack review

The restack keeps one order: UI-01, UI-02, UI-03, then UI-04. Conflict
resolution preserves all 51 parent Members browser cases and adds the 20 UI-04
cases. The combined candidate passed 130 focused HTTP/integration cases and
all 71 Members browser cases. The portal and server builds passed. The short
closed desktop member rows measure 70.25, 70.25 and 60.25 pixels; the action
targets remain at least 48 pixels. The 861-pixel confirmation check, long values,
200% text, counted heading and separate product-seat count remain intact.

These checks characterize the resolved code before the rebase commit. They do
not replace the complete candidate gates. The maintained PR evidence will record
their final input comparison and complete gate results, including unresolved
staging failures. No merge or deployment is claimed here.

## Rebase after UI-03 merge

On 27 October 2026, all six UI-04 commits replayed unchanged onto merged
UI-03 main revision `0377cd12022d0c6fa9250107bc89aeaf9c457423`.
That base has the same complete tree as final UI-03
`94c5b0d850a2ebdd20fdd42581f1c6a6fd28202e`. PR #268 now targets main.
The initial difference from old UI-04 `057434b9` is inherited UI-03
documentation and metric history. The rebase adds no source behavior change.

Fresh checks at `a64bf2f80f96ea54afcb61ad3e8a3aeddf07d787` passed typecheck,
the portal and server builds, and all 71 Members browser cases, with zero
failures, cancellations, skips or todo cases. Final evidence must compare the
check inputs with the committed candidate.

Old native, image and live results retain their execution pins. The historical
live result still has six explicit quota HTTP 429 fixture failures and one
separate application HTTP 503 with no proven provider cause. No new live run
is claimed. The old exact-head human approval does not transfer to the rebased
candidate. The PR remains Draft until the remaining gates pass; the maintained
comments record current quality review and approval limits.
