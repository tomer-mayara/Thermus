# UI-01 — Shared admin shell and Members layout

Candidate: [PR #263](https://github.com/tomer-mayara/Thermus/pull/263).
Scope: [UI-01](../design/organization-admin-plan.md#ui-01--shared-admin-shell-and-layout)
of the Refined tabs plan. Implementation and validation are in progress. This
record does not claim a merge or deployment.

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

Existing behavior uses passing characterization. No failure was manufactured
for an unchanged form, access rule or provider behavior. Full red/green logs,
screenshots, check results and quality reports will be linked from the PR's
maintained Validation and Quality review comments.

## Validation and review

Validation is in progress. The complete source candidate requires the ordinary
suite, typecheck, portal build, Members browser, self-hosted container, hosted
offline build and Linux AMD64 image gates. Changes to shared test support also
require tracing its consuming groups. The final PR comments record selection,
results, failures/retries and any limits.

The change remains inside the existing Web component. The component registry's
hosted authentication, member-read, removal and Audit settings views remain
accurate. No new component, dependency, provider call, storage or deployment
boundary is planned. Final metrics, declaration checks, habit-hooks and review
tier are pending on the complete candidate.
