# Workspace navigation review

Reviewed candidate: 73cd02f296623d50aa81f78e596c399231e843d7.
Trusted base: 57d9ce054592c5e8956494b68f10dbedfe739ef0.

The manager reviewed the complete diff, the implementation worker's test
evidence, and an independent agent review. No actionable defect was found.
The manager inspected the Connect desktop, non-admin 320px, and Members
desktop screenshots. The compact links, current-page underline, keyboard
focus, role-dependent visibility, and long-name wrapping match the request.

## Architecture assessment

The source changes stay in the private web and user-portal renderers and
styles. No public callable contract, component, dependency edge, session
authority, server access check, external system, container, or deployment
changes. The exact admin role check remains the condition for protected
portal links. The server retains its independent authorization.

Checked views: Context; hosted containers; hosted authentication components;
hosted Audit settings/delivery components; default sign-in landing; hosted
member read; Deployment; Ownership; Behavior and resource ownership.
The registry contains 15 Mermaid blocks. A byte comparison of their content
at the pinned revisions found all unchanged. The prose now names the menu.
No drawing needs rendering. L4 is omitted because no production callable
contract changed. No lasting architecture decision or ADR is needed.

## Habit-hooks dispositions

`habit-hooks --branch origin/main` exited 1 with 22 findings. All are retained
for the reasons below. No suppression was added; the snooze file is `[]`.

| Finding | Location at the candidate | Reason |
| --- | --- | --- |
| Complexity | src/interfaces/user-portal/portal.ts:82 | The input boundary checks distinct required fields and endpoint safety together before rendering. Splitting the guards would hide the complete invariant. |
| Complexity | test/acceptance/user-portal/portal.test.ts:174 | One CLI to Desktop to CLI journey verifies retained state and no extra request. Splitting the session would remove the round-trip proof. |
| Complexity | test/acceptance/user-portal/portal.test.ts:208 | The two-role specification checks ordered links, current page, protected-link visibility, legal links, and request scope with bounded explicit expectations. |
| Non-null | test/integration/hosted-admin/account-routes-administration-pages.test.ts:41 | The required member-list element is immediately used to check section order. Its absence fails immediately; no silent pass or production state change is possible. |
| Non-null | test/integration/hosted-admin/account-routes-administration-pages.test.ts:55 | An asserted two-row result is compared with the two-entry fixture. Missing fixture data fails on immediate property use. |
| Six non-null assertions | test/unit/html/logging-page.test.ts:45,46,47,48,50,51 | Required controls are immediately used in one rendered-form interaction. Missing controls fail the test. Explicit presence checks would improve diagnostics only. |
| Two non-null assertions | test/unit/html/logging-page.test.ts:69,72 | Required CSP headers are immediately used by string/assertion checks. An absent policy cannot pass silently. |
| Three comment lines | src/interfaces/user-portal/portal.ts:4,5,6 | Explain the server-owned session and tenant trust boundary, which local rendering code alone does not show. |
| Comment | src/interfaces/user-portal/portal.ts:29 | Explains why URLs remain relative for deployment under a public base path. |
| Comment | src/interfaces/web/account/members-page-layout.ts:13 | Records the coupling of embedded CSS and its CSP hash so that future changes keep them in sync. |
| File length, 532 lines | test/acceptance/auth/hosted-member-removal-browser.runtime.ts | Keeps one dedicated browser gate and its viewport/JavaScript matrix together; drivers already own repeated interactions. |
| File length, 241 lines | test/acceptance/logging/hosted-destination-settings.test.ts | One public HTTP subject covers opening, saving, recovery, and refusal of settings changes. The candidate changes one navigation expectation. |
| File length, 230 lines | test/acceptance/user-portal/portal.test.ts | Keeps the portal's entry, access, setup, and navigation journey together. |
| File length, 294 lines | test/integration/hosted-admin/account-routes-administration-pages.test.ts | One route-composition boundary covers overview, forms, escaping, base paths, and refusal with one fixture vocabulary. |

The ten non-null assertions are unchanged and confined to tests. Their retained
tradeoff is diagnostic detail, not an unchecked production lifecycle.
Independent agent review is quality evidence, not human approval. Final tier,
metric findings, gate results, and eligibility are recorded in the checker
and maintained PR comments.

## Metrics and final candidate

The first complete process ran on 73cd02f296623d50aa81f78e596c399231e843d7
with fresh verified unit coverage. Review, CRAP, and Architecture passed;
Delta reported the two existing files below MI 85. Portal MI is 46.7
(base 47.0); members-page-layout MI is 80.4 (base 80.4). Keep the portal's
session/access/setup renderer cohesive for this menu change: its changed
navigation function has two paths and 100% coverage. Keep the admin layout's
declarative HTML, embedded style, and CSP hash together: its eight-path
function has 99.8% coverage. A broad split of either owner is not needed to
deliver or verify this behavior. No new production file or function was added,
and neither score requires a metric exception under the trusted policy.

Changed-function CRAP: showWorkspaceNavigation 2.0; membersPageLayout 8.0.
Both pass the below-30 goal. There are no unknown changed-function identities,
no unmeasured changed functions, no critical regression, and no new high finding.
members-style.ts contains no functions; function metrics do not apply. CSS has
no numeric MI/CRAP target. The architecture report retains its known unresolved
main.ts to style.css import on both revisions. The source diff adds no import;
manual owner/registry checks supplement that tool limitation.

The process wrote the required immutable base record to
docs/metrics/2026-10-27-57d9ce05.json. The next commit adds only that generated
record. Tests, source, dependencies, and build settings are byte-identical to
the tested source candidate. Final reports are regenerated for the new head;
compatible coverage is reused as the policy allows for a document-only commit.

## Final sign-off after the main documentation update

Final candidate: 21228a7667b4e2d0eed264744687e3636649b17f. Final base: a16a40c02ab5c697a757a9448d454147152de458. Main advanced only in three
architecture/plan documents. The .pr-impact.json rebase conflict retains this
change's declaration. The source, tests, legal fixtures, dependency manifests,
build settings, and policy match the tested candidate exactly; see the
candidate-equivalence report. Both container gates passed (hosted AMD64 7/7;
self-hosted 11/11). The manager signs off this complete candidate. Previous
pinned reports are retained under navigation-history/d3e9ba9e. The final
metrics/checker use the updated base and current head with verified reused
coverage. No human approval is required if the final checker retains T0.
