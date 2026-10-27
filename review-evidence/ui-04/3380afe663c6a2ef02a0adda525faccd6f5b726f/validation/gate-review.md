# UI-04 gate and architecture review

Read-only review by `ui04_gate_review` on 2026-10-26. This file is the only
authorized write. No build, test, metrics process, Git mutation, credential
read, provider call or subagent ran. Source and tests were changing during
review. This is test selection and an architecture assessment, not a pass
report or a review of the frozen implementation.

## Revisions and scope

- Branch: `codex/ui-04-pending-invitations`; draft PR #268.
- Actual parent: UI-03 PR #266,
  `12d1a3c5b7cab197fa828ef89b7f650f918a7ea2`.
- Observed committed head: `474ae11791abf9985051c35252273e6dbe1e48c4`.
- Observed `origin/main`: `c42aa8237b06e46df5f8d3914af6f4151f729e1a`.
- Complete candidate merge base with main:
  `57c99e2b892acea52bfc3a53aee61b5ae442bf46`.
- Increment merge base with UI-03 is the full parent SHA above.
- UI-02 PR #264 is a sibling and is absent. UI-04 must retain the UI-01 member
  rows and UI-03 invitation task. Do not claim the four-ticket combined finish.

Select functional checks from the whole candidate against main, including
working changes, additions, deletions and former paths. Classify architecture
and review tier from the UI-04 increment against its actual UI-03 parent.
Re-pin all evidence after implementation and after any fix.

Read `AGENTS.md`, `docs/coding-principles.md`, the UI-04/shared-gate sections of
`docs/design/organization-admin-plan.md`, `docs/design/portal-design.md`,
`docs/testing/test-code-layout.md`, `docs/implementation/test-gate-policy.md`,
`docs/implementation/component-registry-workflow.md`, the review rules, and
all 15 registry diagrams with relevant ownership/runtime/deployment prose.
Current source and consumers were inspected before prior UI-03 evidence.

## Behavior and focused selection

The UI-04 plan requires a native counted Pending invitations disclosure. The
count comes from the complete overview filtered to pending entries; zero starts
closed and nonzero starts open. Keep the same escaped identity and role facts,
absolute UTC `time[datetime]`, allowed actions, exact protected fields and fixed
notices. A later page failure must return the existing failure page without a
partial list or count. Do not construct a partially successful overview in a
test: use `OrganizationDirectoryDouble.invitationPageLayout` with an earlier
page followed by an Error through the public HTTP route.

New native behavior needs actual red-to-green acceptance and focused integration
evidence. Existing expiry, authority, failure and lifecycle characterization can
start green. A source change selects the ordinary full suite, so the focused
files below also run in that suite. Before commit, run each changed ordinary
file after `npm run build`; portal source tests use their source command.
Changed runtime/live files use their complete existing dedicated group.

Key ordinary behavior owners/consumers:

| File | Fact to retain or migrate |
| --- | --- |
| `test/acceptance/auth/hosted-members.test.ts` | Public HTTP current members, trusted You, complete help bytes/version/hash, pending identity/role/expiry/actions, navigation, invitation lifecycle and unconfirmed outcomes. Add complete-read/count/order cases here or an equally public acceptance entry. |
| `test/integration/hosted-admin/account-routes-administration-pages.test.ts` | Filtered count; native zero/nonzero state; exactly one existing overview read; escaped values; per-row permitted actions and exact protected forms; help after pending. |
| `test/integration/hosted-admin/account-routes-administration-changes.test.ts` | Existing resend/revoke outcomes, refusal and unconfirmed/no-delivery guidance. |
| `test/unit/organizations/organization-administration-invitation-overview.test.ts` | Complete paged projection, deduplication, explicit states, allowed actions, token exclusion, UTC expiry and failure. This is unchanged characterization, not a new UI unit suite. |
| `test/acceptance/auth/hosted-invitations.test.ts` | `invitationLines` parses the old sentence; migrate all pending-only identity/role/state assertions while keeping current action, tenant, lifecycle, duplicate, record and token checks. |
| `test/integration/auth/hosted-administration.test.ts` | Pending sentence after unknown send and refreshed session. |
| `test/acceptance/auth/hosted-workos-administration.test.ts` | Pending User/Admin sentences after duplicate/refusal, inactive-member restoration, current Admin invitation and acceptance flows. |
| `test/acceptance/auth/hosted-live/administration-server.ts` | Pending User/Admin sentence and action checks inside the real provider journey. A migration selects the dedicated hosted-live group. |
| `test/support/drivers/browser/invitation-browser.ts` | `expectPending` matches the old full sentence. Its consumer is the Members browser runtime entry. |

At initial inventory, sentence matches were at hosted-members lines 66/91,
hosted-invitations lines 49/84-85 and its `invitationLines`, hosted-administration
line 40, hosted-workos-administration lines 244/281/309/334, live administration
lines 215-216, and invitation-browser line 152. These line numbers are discovery
locations, not frozen review anchors. Search again after the row changes.

`test/support/dsl/hosted-administration.ts:seatsIn` still parses
`Active product members: S`. Keep that product-seat meaning and the existing
six-seat expectations in hosted-seats and hosted-billing. The pending count
must not replace a product count or add a billing read.

Help consumers include hosted-members, hosted-member-removal,
`AdminShellBrowser.expandMembersHelpWithDoubleText`, and the existing Members
browser runtime help check. Keep exact approved help text, version and SHA-256;
only move its existing disclosure after pending. Validate heading/invitation,
member list, pending disclosure, help order both with Invite closed and open.
Prefer semantic region/fact/order checks; do not freeze exact class strings or
form indexes when markup order is incidental. Keep action/target scoping and
accessible names when buttons become short visible Resend/Revoke labels.

The Members browser group must establish fresh zero/nonzero fixtures, native
keyboard opening/closing, all current allowed actions, real protected
Resend/Revoke outcomes, long rows, UTC semantics, stable section order and no
extra write from toggling. Use explicit JavaScript on/off and 320px/1280px
widths. Keep UI-01 shell/Audit controls and UI-03 invitation/native-validation
regressions. Inspect 48px targets, focus/text/boundary contrast, doubled text,
expanded approved help and fixed notices with built assets. HTTP parsing cannot
prove visibility, native behavior or geometry. Update the documented browser
scope with the actual implemented cases.

## Complete-candidate commands

Use Node 24.20.0 and pnpm 12.10.1; dependencies must match the frozen lockfile.
The manager owns environment setup and all execution. Builds, Docker context
capture, and metrics comparisons must not overlap source changes or each other.

| Selected command | Why and prerequisites |
| --- | --- |
| `npm test` | Any repository `src/` change. Full ordinary emitted unit/integration/acceptance/interface plus portal tests. Needs pinned Lightpanda 1.0.0, Axiom test ingest settings and public network for ordinary smoke/export cases. Use a reviewed task wrapper without printing settings. |
| `npm run typecheck` | Required source check, including portal typecheck. |
| `npm run build:user-portal` | Required source check and real assets for browser tests. |
| `npm run test:container` | Source under `src/interfaces/web/`. Docker Engine, Buildx, Compose, pinned inputs or cache; test containers retain outbound network denial and trusted rules fixture. |
| `LIGHTPANDA_BIN=<absolute-pinned-path> npm run build:hosted` | Hosted Web/portal source. Git and OpenSSL in PATH, loopback and free port 46443; no live credential. It includes renderer runtime at its last phase. |
| `npm run test:container:hosted` | Hosted Web/portal source. Build/run Linux AMD64, native or emulated, with Buildx; pinned inputs or cache and HTTPS egress to example.com. Dockerfile.hosted runs build:hosted under network none. A proven uncached nested execution can supply offline-build evidence; do not claim a second local execution. |
| `npm run build:user-portal && npm run build && THERMUS_BROWSER_EVIDENCE_DIR=.cache/ui04/validation/screenshots node --test dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js` | Changed dedicated runtime/browser driver and required UI-04 native/geometry proof. Needs Playwright Chromium and OpenSSL; fresh loopback TLS bridge and provider doubles, no live credentials. |
| `npm run test:logging:postgres` | Inherited changed storage-failure runtime file selects its whole existing seven-file group. Docker/OpenSSL, disposable PostgreSQL 17 with verified test TLS and scoped role. No live database/provider credentials. |
| `npm run test:logging:collector` | Inherited changed audit journey/site/container helper selects its whole two-entry group. Docker/OpenSSL, pinned Collector and Node images or cache, isolated internal network and real TLS. No live credentials. |
| `LIGHTPANDA_BIN=<absolute-pinned-path> node <reviewed-staging-wrapper> npm run test:hosted-live` | Inherited changed live case and new UI-04 pending-row migration. Runs both hosted.live and hosted-removal.live sequentially. See staging prerequisites below. |

Do not add `npm run check`: source validation already covers its stages.
No separate renderer command is needed after a successful selected hosted
offline build proves both complete runtime files. Standalone search-live and
the separate Axiom-live interface proof are not selected by this presentation
change. Ordinary interface/Axiom tests still run through `npm test`.

Staging needs the existing password-only profile, MFA disabled/not required,
configured localhost callbacks/sign-out/login/MCP resource, role/permission
catalog and DCR/CIMD, staging settings, public network, Chromium, OpenSSL,
absolute pinned renderer, Docker for disposable removal PostgreSQL, and free
ports 46443/46480. Do not overlap another staging run, the auth work slice or
the integration server using 46443. Keep exact fresh-fixture ownership and
cleanup. This UI ticket authorizes no provider configuration or fixture-policy
change. Missing settings, quota refusal or skipped cases are deferred/failed
evidence, never a gate pass.

## Support and child/container paths

The following trace comes from current imports plus runtime paths and mounts:

- `hosted-audit-snapshot-site.ts` has ordinary integration consumer
  `hosted-audit-snapshot-lifecycle.test.ts` and ordinary acceptance consumers
  `hosted-snapshot-composition.test.ts` and `hosted-customer-export.test.ts`.
  The last also reaches it through `hosted-audit-export-site.ts`. These are
  already selected by npm test. The snapshot helper alone does not select SQL.
- `hosted-storage-failure.runtime.ts` is itself changed in the complete stack;
  its enabled-export/blocked-SQL case submits the current invitation form.
  Its dedicated PostgreSQL group is therefore selected independently of layout.
- `hosted-audit-journey.runtime.ts` calls `openAuditSenderSite(...).publicJourney`.
  `audit-sender-site.ts` binds the candidate source/support/node_modules/manifest
  into its client container read-only and starts
  `hosted-audit-journey-probe.ts`; the probe imports
  `hosted-audit-journey-site.ts`, whose public Members send/resend/revoke flow
  runs the real Web rendering and forms. The same container site also serves
  `test/integration/logging/audit/audit-sender.runtime.ts`. Both are the Collector
  command, including its saved-destination Test child. Static imports alone
  would miss this runtime path.
- `member-removal-browser.ts` reaches `browser-transport-site.ts`.
  `admin-shell-browser.ts` reaches `admin-shell-measurements.ts`, and
  `invitation-browser.ts` reaches the keyboard driver. Their entry consumer is
  `hosted-member-removal-browser.runtime.ts`. `hosted-member-removal-site.ts`
  also serves the ordinary removal, self-removal, scope and session-recovery
  acceptance files. Those ordinary cases are in npm test.
- `hosted.live.ts` imports the hosted-live administration case module. Its
  existing send/role/lifecycle/refusal/log assertions must remain while pending
  row matching changes. A focused name-pattern run does not replace the full
  two-file dedicated command.

## Evidence reuse and unresolved parent run

UI-03's passing focused checks, screenshots, 26-test SQL result, 10-test
Collector result, ordinary suite, type/build/container results and metric
dispositions remain inherited evidence with their own input pins. They prove
UI-03 only. They are useful characterization and failure history, not automatic
passes for changed UI-04 source/test/build inputs. The new page is rendered by
the SQL, Collector and live journeys described above. Current-candidate group
runs should cover that collaboration; do not replace them with parent counts.
Reuse reviewed launcher/setup structure, installed tools/images, unchanged
approved help bytes, unchanged-registry assessment and historical dispositions.
Keep their full report links and reasons rather than duplicating old tables.

UI-03's full required live attempt passed 28 of 29 tests. The third invitation
had no Revoke form; its cause was not established by that run. A later focused
diagnostic then got HTTP 429 during shared fixture setup with WorkOS's sandbox
invitation-email quota message. No cases ran in that diagnostic. Do not infer
the earlier cause or a reset time, and do not call either attempt a pass.
The early third-send status assertion is retained diagnostic quality, not a
relaxation. Root must retain or resolve this required-live blocker, including
the current pending-row migration; no provider or legal gate is waived here.

Metrics need new candidate-valid source/selected-suite/build evidence. Parent
coverage is stale after the new src/test changes. The source selection permits
both unit parts via `--collect-coverage`; if Web changed functions need
integration coverage, that complete group is already selected by npm test and
may be collected explicitly. Keep the selected-suite provenance and verified
child flush evidence. Use the same UI-03 parent for incremental base snapshots,
CRAP and checker inputs per AGENTS.md; preserve complete-vs-main validation.
Do not run metrics concurrently with any build/context capture, because a base
comparison can temporarily change checkout inputs. The manager must run final
habit-hooks, keep snooze empty, stamp committed impact evidence and run the
trusted checker on the clean committed candidate. This review runs none of them.

## Architecture assessment

Current registry has 15 Mermaid views. At this review its bytes match the
UI-03 parent: SHA-256
`c85f36b173f48c8d099ba2e910152e084cc6465327898373a9dab0c1735d3bcc`.

1. Context.
2. C4 containers: hosted edition.
3. C4 containers: local edition.
4. Selected C4 components: tool processing in the Node server.
5. Selected C4 components: hosted authentication in the Node server.
6. Selected C4 components: hosted membership removal in the Node server.
7. Selected C4 components: hosted Audit logs settings and delivery in the Node server.
8. Selected C4 components: system and audit logs in the Node server.
9. Selected C4 components: local authentication in the Node server.
10. Collaboration overview.
11. Scenario: MCP page fetch and renderer cancellation.
12. Scenario: hosted default sign-in landing.
13. Scenario: hosted member read.
14. Self-hosted Compose.
15. Recorded hosted Render target.

UI-04 belongs to the existing Web owner in the hosted Node server.
`AdministrationRoutes.membersPage` still obtains a complete member overview and
then complete invitation overview from the trusted actor/organization before
rendering. Organizations owns pagination, deduplication, state/allowed-action
projection and seat semantics in `administration-overviews.ts`/directory reads.
Web filters those complete invitations to pending, renders a native disclosure
and count, compacts rows and moves the existing full help after them. There is
no extra read, stored count, relative clock, script, lifecycle state or provider
policy. The same resend/revoke routes retain current scope, authority, Origin,
CSRF and exact action-field protection; fixed outcomes and uncertain-write
guidance stay at their current owners.

Hosted authentication/member-read, membership-removal and adjacent Audit views
remain accurate. The member-read scenario already returns combined HTML only
after both complete authorized reads and gives no partial page on refusal or
failure. Changing disclosure/row display does not alter its operation order.
Removal help remains inside Web; no removal authority, recovery behavior,
resource lifetime, SQL/Collector collaboration, deployment or Level 2 boundary
changes. The remaining tool/local/sign-in/deployment views are unaffected.
Test-only helper migrations establish no new production component or edge.

No registry edit or architecture comparison diagram is needed for the expected
increment. No production callable contract changes; omit L4 for that reason.
`administration-pages.ts`, `members-style.ts` and `members-page-layout.ts` are
private Web modules, outside the declared public_surface. The unchanged public
`InvitationOverview` contract remains complete. No declaration regeneration is
expected unless the final scope changes; the checker must confirm snapshots.
Expect no architecture facts a-g and all architect flags false with a fresh
UI-04 summary/evidence. The currently inherited UI-03 impact declaration must
be replaced before commit/stamping.

Likely increment tier is T0 for private UI/source/test/prose alone. The trusted
rules treat `docs/implementation/test-gate-policy.md` as a removal-path: a
replacement/removal in its browser inventory can select T1; pure additions do
not necessarily do so. A used metric exception, another protected path or
changed final scope can raise the tier. The final trusted checker decides.
Unresolved required runs block merge eligibility independently of tier. T1/T2
need independent authorized human approval of the current head; this agent
assessment supplies no such approval. Parent T1 approval cannot approve a
different UI-04 head. Refresh after the freeze and request independent review.
