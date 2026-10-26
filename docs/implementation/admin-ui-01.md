# UI-01 — Shared admin shell and Members layout

Candidate: [PR #263](https://github.com/tomer-mayara/Thermus/pull/263).
Scope: [UI-01](../design/organization-admin-plan.md#ui-01--shared-admin-shell-and-layout)
of the Refined tabs plan. UI-01 is implemented. This record does not claim a
merge or deployment. Current candidate pins and full evidence are in the PR's
[Validation](https://github.com/tomer-mayara/Thermus/pull/263#issuecomment-6426553537)
and [Quality review](https://github.com/tomer-mayara/Thermus/pull/263#issuecomment-6426553900)
comments.

## Behavior

Members shows the trusted workspace name beside Switch workspace. Connect,
Members and Audit logs remain ordinary links. The current link is marked with
`aria-current="page"`. The shared shell uses a 32px serif title and visible
keyboard focus. The Members list takes the full content width.

The existing member overview supplies the name; there is no new provider read.
Audit logs retains its form, optional script and Save/Test behavior. Embedded
style and script hashes still come from their actual bytes. Access checks,
protected form fields, no-store responses and approved help stay unchanged.

UI-02 member rows and counts, UI-03 invitation disclosure, and UI-04 pending
disclosure remain separate work. The existing invitation form and pending list
remain visible in this increment.

## BDD and TDD

The new public-route and browser acceptance cases ran before production edits.
They failed because the workspace name was absent from the header, the desktop
list was narrow, and the title was larger than 32px. A focused integration case
then covered the trusted, escaped name handoff.

Additional browser checks cover JavaScript on/off at 320px and 1280px, long
values, keyboard navigation, enlarged text and expanded help. The skip-link
check found that the fragment target did not receive focus. Main content now
accepts programmatic focus without entering the ordinary tab order.

Independent review found an Audit tablet width regression. A new browser case
failed at 800px because the panel was 650px wide instead of 752px. Removing the
new width limit restored 752px at 800px and 812px at 860px. Browser operation
drivers keep the acceptance journey short and use explicit visibility/window
guards. They retain all of the original behavior checks.

Existing behavior uses passing characterization. No failure was manufactured
for an unchanged form, access rule or provider behavior. Full red/green logs,
screenshots, check results and quality reports are linked from the PR's
maintained Validation and Quality review comments.

## Validation and review

| Check | Result |
| --- | --- |
| Full ordinary suite (`npm test`) | 5,129 ordinary tests and 49 portal tests passed. |
| Typecheck and portal build | Passed. |
| Members browser | 7 passed, with JavaScript on/off, 320/1280px, and Audit at 800/860px. |
| Focused Members and Audit route/rendering checks | 82 passed. |
| Other consumers of the changed test site | 25 passed; no SQL, Collector or hosted-live consumer. |
| Self-hosted container | 11 passed with outbound access denied. |
| Hosted offline build and Linux AMD64 image | 7 image checks passed. The image's offline build passed 3,301 unit, 49 portal, 1,157 integration, 119 acceptance and 13 renderer checks. |
| Verified unit coverage for metrics | 3,301 emitted tests and 29 portal unit tests passed. |
| Habit-hooks | Passed; two comments retained because they explain read failure atomicity and CSP hash ownership. No snooze or suppression. |

The first ordinary run was stopped after review found the tablet regression.
It is not a pass. The complete repeat on the corrected source passed. The PR
evidence retains this history and the expected BDD/TDD failures. Hosted-live,
PostgreSQL, Collector and production release checks are not selected: this
increment changes no provider behavior, storage, transport or deployment.

The review checker then mistook a browser helper variable named `skip` for a
skipped test. The variable is now `skipLink`; no test is skipped and no rule is
suppressed. The affected browser group and typecheck passed again. The ordinary and
image results still cover the unchanged production code and their unchanged
test consumers. Unit coverage is collected again to match the updated global
test-input fingerprint.

The change remains inside the existing Web component. The component registry's
hosted authentication, member-read, removal and Audit settings views remain
accurate. All 15 registry drawings and the registry prose stay unchanged. No
component, dependency, public declaration, provider call, storage or deployment
boundary changes. The private layout options gain an escaped display name;
the existing component views and these notes explain that change without an
extra diagram.

Metrics completed with retained findings. The two existing template files remain
below the MI goal (61.25 and 80.37); each drop is less than one point. Their
cohesive markup and escaping need no further helper layer. The high test-file MI
finding and two low test-size estimates are retained with reasons in Quality
review; test files have no production MI goal. Required changed-function CRAP
goals pass, with no exception. The full graph report retains the unchanged
unresolved CSS-import limit; it does not prove a globally complete graph.

Independent agent and manager review found no remaining actionable issue.
The updated browser inventory row in the test-gate document selects T1 Team
review through the policy's read-path rule. It changes no gate command or
decision authority. Current-candidate owner/team approval is required before
merge; agent review is not human approval.
