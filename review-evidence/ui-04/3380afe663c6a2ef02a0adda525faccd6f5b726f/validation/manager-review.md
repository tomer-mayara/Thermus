# UI-04 manager review

The manager reviewed the complete UI-04 source and test increment against UI-03
`12d1a3c5b7cab197fa828ef89b7f650f918a7ea2`, the worker handoff and the independent
review. The final candidate SHA and gate outcome are recorded below after commit.
UI-02 is a sibling and is absent. This is not the four-ticket combined review.

## Implementation sign-off

The two production edits stay in Web. The count uses the existing complete
pending projection; no additional read, counter, clock or client state exists.
Native details preserves keyboard operation with scripts disabled. The compact
rows keep escaped email and role, UTC time/datetime, the exact permitted action
subset, escaped action URLs, recipient-specific accessible names and the three
protected hidden fields. No action or provider rule changes.

The manager requested one simplification: remove a replacement inside serialized
postForm HTML and write the specialized form directly. The final code uses
hiddenField and escapeHtml and leaves the shared form API unchanged. The worker
ran the selected focused and browser checks again on those bytes: 78 and 58 pass.
The later-page failure acceptance goes through the actual public route and a
paged directory double. No incomplete InvitationOverview is invented.

Moved help is the same constant, approved source text, version and SHA-256.
Existing active-member and product-seat behavior stays intact. The manager
inspected desktop and 320px/200%-text screenshots: rows wrap long values and the
actions remain inside the viewport. Existing invitation, recovery, removal and
Audit browser regressions remain in the complete 58-case gate. The no-write
fixture correction in run08 removes sign-in setup requests from its baseline;
the page assertion is unchanged. All intended feature red steps are separately
recorded before their source changes.

## Architecture and quality

All 15 registry views and prose still describe the system. The manager traced
administration-routes, complete overview ownership and invitation rendering and
reviewed the hosted-member-read scenario. Rendering still follows two complete
authorized reads; failures remain fixed notices without a partial page. Current
Origin/CSRF/scope, pending-target checks, current grants, deletion safeguards and
write-outcome rules stay at their existing owners. No production callable
signature, public declaration, new import edge, supporting container, resource
lifetime or deployment changes. No L3 comparison drawing is needed. L4 is omitted
because no production callable contract changes. No registry edit is needed.

The updated browser-gate inventory describes coverage only. Commands, selection
and approval authority stay unchanged. It is a protected read path mechanically;
the final checker classifies the committed increment. All semantic impact flags
are false. The independent review found no actionable defect and verified the
worker's 13 frozen source/test hashes. Agent sign-off is not human approval.

The manager owns the selected full-candidate checks and metrics. Builds and
container context capture run serially; metrics comparisons run afterward, with
no active test or source edits. Source/test/build hash manifests bind dirty-run
evidence to the final commit. Full logs and failure history stay in this bundle.

## Final candidate, results and limits

Final head: `3380afe663c6a2ef02a0adda525faccd6f5b726f`.
Actual stack parent/merge base: `12d1a3c5b7cab197fa828ef89b7f650f918a7ea2`.
The 923 recorded source/test/build inputs from the functional runs at dirty
scope commit 474ae117 match the committed candidate. The 13 worker source/test
hashes also match. Later changes were limited to documentation and review
records; the manager reviewed them. The Docker context excludes Git metadata,
so committing during the frozen image build changed no captured input.

Passed: 78 focused ordinary; 58 Members browser; 5,139 ordinary plus 49 portal;
typecheck and portal build; 26 PostgreSQL; 10 Collector; 11 self-hosted container;
7 Linux AMD64 hosted runtime checks. The uncached hosted build check stage,
with network disabled, passed 3,301 unit, 49 portal, 1,166 integration, 119 selected
acceptance/interface and 13 renderer cases. The exact build record is
colima/colima/bz3gdwdrkai321k7iq5j1o8sn, created 00:15:04 UTC and completed
00:23:38 UTC on 27 October 2026. No second local hosted-build execution is claimed.

The required staging group failed: 22/29 pass. Six cases share the administration
fixture's WorkOS 429 sandbox invitation-email quota. The separate removal journey
received 503 when it sent a new invitation after removal; that response does not
prove its provider cause. Both invitation paths remain unverified. The scoped
cleanup journal ends cleanup-complete with no failures; the main after hook
reports no cleanup failure. The local list has no test container, volume or
image. Two old Thermus networks from 14 October remain untouched.

Fresh complete integration coverage passed 1,166 tests, 163 files, 286 processes.
That suite is already selected by npm test. Base/head snapshots, process and
CRAP compare with the actual UI-03 parent, not main. All required changed/new
function goals pass: membersPage 4.0 at 97.5%; invitationRow 1.0 at 100%; two new
callbacks 2.0 and 1.0 at 100%. No required identity or coverage is unknown. Unchanged
rows remain unchanged by this PR. Base scores using head coverage are estimates.

The process exits 1 for the existing production-file MI goal miss. Review, CRAP
and Architecture pass. administration-pages.ts changes from 60.969 to 59.566,
with 25 paths and 15 functions. It remains a coherent owner for complete-page and
protected-form composition. A split to raise a file score would obscure the
fields, role rules and adjacent HTML. The manager inspected its function report;
no new production file or added complexity problem needs a metric exception.
members-style.ts is a CSS string with no function/raw MI; its browser evidence
covers the layout. Low test Halstead findings are retained: hosted-invitations
0.80→1.20 keeps lifecycle checks while reading email/role facts; hosted-members
1.80→2.06 adds a real later-page failure; page integration 3.56→4.54 adds complete
count/order and protected row facts. These volume estimates show no defect.
There are no new high/critical findings or metric exceptions/baseline changes.

The global metrics graph keeps the same unresolved portal main.ts→style.css
import at both revisions. Its graph is not complete. Four historical main
commits lack metric records; this task adds none because the stack parent is
not on main. No history record was edited. The current required function goals
are fully assessed despite unknown coverage elsewhere in the global graph.

habit-hooks exits 1 with 7 non-null, 31 comment and 4 size findings. The manager
reviewed and retained each with its reason in habit-dispositions.md. All new
non-null uses are constrained test observations; missing values fail loudly.
The independent reviewer checked each and found no false-pass path. No invented
performance exception, hidden suppression or snooze was used. Comments retain
security, fixture or reader limits; long tests retain coherent matrices.

The trusted checker exits 0 with T1 Team review solely for the updated browser
inventory read path. It reports no architecture fact, no declaration delta,
49 verified public snapshots and no unresolved policy question. Its limited
compiler reports 33 diagnostics in 2 unlisted files; the full typecheck passed.
The checker says local eligibility is preliminary. It does not establish the
required live run or human approval. Overall merge status remains blocked and
PR #268 remains Draft. No current-head human approval exists. Manager sign-off
covers implementation and evidence for Draft only; no merge or deployment.

Final input verification still matches all 923 recorded inputs, with a clean
worktree. GitHub check diagnostics at this head reported no checks or statuses;
this is not claimed as a CI pass. The task's known-credential and WorkOS key
pattern scan found no matches in the prepared evidence. Raw coverage captures,
private launchers and environment settings are excluded from publication.
