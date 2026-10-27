# UI-03 — On-demand invitation form

Candidate: [PR #266](https://github.com/tomer-mayara/Thermus/pull/266).
Scope: [UI-03](../design/organization-admin-plan.md#ui-03--on-demand-invitation-form)
of the Refined tabs plan. This candidate follows the merged UI-02 PR #264 on
main and includes its member rows, both counts, quiet self/other actions and density fix.
The original evidence below describes the earlier UI-01-based candidate; the
maintained PR comments record the new head, parent and validation. This record
claims no merge or deployment.

## Behavior

Members starts with a closed native Invite member disclosure beside the heading.
It contains the existing protected invitation form, one Send invitation action,
and a Cancel link to a fresh Members page. The existing role choices, identity
policy note, native validation and fixed server notices stay intact. The form
works without JavaScript. No trigger or form appears when no role is invitable.

The last-Admin refusal page explains how to open Invite member, select Admin,
and wait for acceptance. Its existing recovery link and route stay intact.
The trigger stacks below the heading through 860px. On desktop it is beside
the heading, and the open form takes the full content width before the list.

## BDD and TDD

The first real-browser acceptance case failed because the closed disclosure
did not exist. Focused integration cases then failed for the disclosure,
Send invitation and Cancel link. Native markup made them pass. Existing
no-role and allowed-role cases stayed green. A separate last-Admin instruction
case ran red and then green. Existing invitation-label consumers now use
Send invitation and retain their role, authority and outcome assertions.

Browser geometry found undersized initial targets and missing desktop heading
placement before the style change. A later 200% text check found an overlap at
481px. Stacking through tablet widths fixed it without a fixed title spacer.

The old route-interception test driver could not follow Chromium's real 303
navigation. The browser gate now uses a temporary loopback HTTPS bridge to the
existing local HTTP site. It preserves status, Location, request fields and
separate Set-Cookie headers. It needs OpenSSL for its temporary certificate;
the test browser alone accepts that certificate. Bridge failures fail the test.
No application route or redirect behavior changed.

Each Cancel, invalid input, User send, Admin send, refusal and unconfirmed
scenario starts with fresh fixtures. The complete browser group covers both
JavaScript modes at 320px and 1280px. It also covers the recovery link, long
workspace text at 200%, and the existing Members/Audit shell and removal cases.
Native validation retains values. Server errors keep fixed notices and discard
input. No new form state or retry action was added.

## Validation and review

The final focused ordinary selection passed 137 tests. The browser group passed
38 tests after the final test-driver refactor. Focused ESLint and whitespace
checks passed. The full ordinary suite passed 5,135 tests and 49 portal tests.
Typecheck and the portal build passed. PostgreSQL passed 26 tests, Collector
passed 10, the self-hosted container passed 11, and the Linux AMD64 hosted image
passed seven runtime checks after its offline build. Full command logs, failure
history, screenshots, metrics and candidate pins are maintained in the PR's
Validation and Quality review comments.

The required hosted staging gate remains blocked. Its full run passed 28 of 29
tests; the invitation lifecycle could not find the third invitation's Revoke
form. Its send assertion now runs before that form lookup, with the same
expected redirect. A diagnostic rerun then failed in fixture setup: WorkOS
returned HTTP 429, sandbox invitation-email quota reached. This proves the
later quota blocker, not the cause of the earlier missing form. The PR stays
Draft until staging can send test invitations and the required group passes.
No provider settings or paid services were changed.

The label migration selects the PostgreSQL, Collector and hosted staging gates
through their existing tests and helpers. Source changes also select the full
ordinary suite, typecheck, portal build and both container gates, including the
hosted offline build. Search-live and the separate Axiom-live interface gate
are not selected. The offline build includes the renderer checks.

The three production files remain inside Web. No production callable signature,
public declaration, component dependency, provider operation, storage, session,
permission, removal safeguard or deployment boundary changes. All 15 registry
views and their responsibility descriptions remain accurate. The HTML changes
and recovery instruction need no new architecture diagram. Approved help bytes
remain unchanged.

## Restack onto UI-02

The restack preserves the parent's member facts, separate row and product counts,
quiet Remove/Leave actions, and compact desktop rows. The invitation disclosure
now shares the counted heading. Geometry selects the semantic level-one heading;
the route test separately asserts the expected fixture count. Both branches'
acceptance cases remain. The protected forms and native 303 browser navigation
are unchanged.

The restack's focused HTTP/integration selection passed 126 cases. The complete
Members browser group passed 51 cases, including the inherited density and
861px expanded-confirmation checks and the invitation JavaScript/width matrix.
Portal and server builds passed. These are passing characterization results;
no artificial feature failure was introduced for conflict resolution. The full
rebased candidate still requires its selected functional, staging and quality
gates before Ready. The earlier staging failures in this record remain historical evidence
until a new full run establishes the result for the restacked candidate.

## Rebase after UI-02 merged

UI-02 was squash-merged as `2282edd4`. Its complete tree matches the former
parent `614090a1`. Replaying only UI-03's two commits onto that main revision
kept both patches and the complete UI-03 tree unchanged. The rebase adds no
application or test behavior. The required metrics process records the new
main revision in `docs/metrics/2026-10-27-2282edd4.json`.

Fresh typecheck, portal and server builds, and all 51 Members browser cases
passed. Earlier test and image reports keep their original execution revisions;
the maintained PR comments link the input comparison and refreshed review
reports. Hosted live verification remains pending. The owner's approval of the
previous head stays in the history and does not approve the rebased head.
