# Independent UI-04 candidate review

Result: no actionable finding in the reviewed source, tests or document
increment. This is agent review evidence. It is not an independent authorized
human approval, a complete gate pass, or a merge decision.

## Provenance and limits

Review date: 2026-10-26. Parent: UI-03 PR #266,
`12d1a3c5b7cab197fa828ef89b7f650f918a7ea2`. Observed HEAD:
`474ae11791abf9985051c35252273e6dbe1e48c4`. The working candidate was dirty;
this review includes its tracked increment and the two new pending-invitation
test drivers. UI-02 PR #264 is absent.

Tracked binary diff SHA-256:
`5392c62851adf3fe593a3e6416efba225749385ae997cb0a9d85d4888ebec255`.
File-content scope SHA-256 (sorted path, tab, content hash, joined with newline):
`b71e2e3501dba6d2fbdbc3f19516345ab225bdbe0930bd7081f6aced6691029d`.
File pins are below. The manager must bind them to the final committed head and
review any later changes.

No build, test, metrics process, checkout, source edit, credential read or
provider contact ran in this review. I read the diff, relevant production
collaborators, new and migrated tests/helpers, retained logs/results and
screenshots. A read-only checksum check confirmed all 13 source/test files
match `implementation/frozen-files.sha256`. `git diff --check` passed.

The implementation worker confirmed source/test freeze after run 11. I reviewed
the final direct escaped invitation-form markup, not the earlier serialized
postForm replacement. Run 11 records exit 0 at 2026-10-26T23:56:42.321Z and
reports 78 focused ordinary cases and 58 full Members browser cases, all passed,
with zero failures, skips and todos. These are retained worker results, not
independent reruns or complete-candidate gate results.

## Production behavior and protection

The two production changes stay inside the existing Web owner.
`administration-pages.ts:26` still filters the supplied complete invitation
overview to pending. The native disclosure uses that collection's length and
sets `open` only when nonzero. There is no read, stored count, extra clock,
relative expiry, script, history or lifecycle rule. Empty content stays inside
the closed native disclosure and explains the successfully read empty state.

`invitationRow` at line 72 renders separate escaped email and role facts. Both
known roles retain their label mapping; unknown role text remains escaped.
The original absolute UTC datetime and display transformation are unchanged.
Only the supplied `changes` produce actions. Each direct local form has an
escaped current action and exactly the existing hidden csrf_token,
organization_id and invitation_id fields through hiddenField. The short visible
button text is fixed; its escaped aria-label retains the action and recipient.
The hostile-name integration assertion checks that attribute's decoded meaning.
There is no form serialization replacement or shared production form API change.

Administration routes, selected-organization/current-role checks, Origin and
CSRF checks, provider calls, uncertain-write guidance, fixed result pages and
no-delivery claims stay unchanged. The new browser actions use those real
protected routes and original 303 targets. No invitation confirmation or
removal recovery state was added.

The same membersHelp constant now follows the pending disclosure. Its text,
version and SHA-256 remain unchanged. The existing full-content help assertions
and browser expansion checks remain. Member rows, removal forms, You marker,
seat caption, and UI-03 Invite member/Send invitation/Cancel behavior are
unchanged. This candidate does not take UI-02's quiet-removal/member-row work.
The shared style changes are limited to existing/new pending classes, expiry
within those rows and the moved Members help. Audit body selectors and controls
are unchanged. The layout still computes CSP from the actual embedded CSS.

## Acceptance, integration and browser evidence

The public Members HTTP acceptance at `hosted-members.test.ts:12` gives the
existing directory fixture one successful invitation page followed by an Error.
It expects the existing 500 result, exactly two page reads and one failure
report, with no partial email, pending count, product count, form or private
cause in the body. It checks that no invitation changed. This is a real route
failure path, not an invented partial InvitationOverview contract.

The integration additions verify zero/nonzero disclosure states, terminal
filtering, one existing overview read, semantic section order, per-row role and
UTC facts, allowed-action subsets and exact protected forms. Existing complete
projection, expiry, deduplication, authority, base-path, escaping, state/refusal
and action tests remain. The earlier exact className-array order check was
replaced with the actual section/disclosure/help elements; it no longer freezes
the entire class string.

The new browser cases use a fresh production-like site/provider fixture for
each outcome. Each explicitly sets JavaScript on/off and 320px/1280px. Count
cases use one record per provider page and terminal data. Native keyboard tests
check the initial state, visible focus, close/reopen and empty explanation.
The zero-provider-POST assertion remains. Independent Resend and Revoke cases
check recipient-specific accessible selection, exact three-field POST data,
one provider POST, the original 303 and resulting pending state/count. They
also retain the no-removal-admission and no-email-delivery assertions.

The row matrix checks compact short rows, a 212-character address, roles,
machine-readable and displayed UTC expiry, stable section order, visible
48px controls, viewport bounds, 200% text and horizontal reflow. The retained
UI-03 open-form driver verifies that its full-width panel stays before Active
members. The new closed-task order plus unchanged document order therefore
cover both invitation states. Existing UI-01 shell/focus/help/Audit Save/Test,
UI-03 native validation/send/cancel/refusal/unconfirmed/last-Admin guidance,
and removal/recovery scenarios remain in the full 58-case browser entry.

Inspected screenshots:

- `pending-rows-off-1280.png`: compact aligned role/UTC/action rows, wrapped long
  email, readable short actions and removal help after pending.
- `pending-rows-off-320.png`: stacked facts and wrapped long address with both
  actions inside the card; the UI-01 member/removal surface remains visible.
- `pending-text-200-on-320.png`: doubled text wraps within the viewport;
  actions and moved help remain reachable without clipping or overlap.

Computed browser assertions supplement those visual checks. Retained colors
and contrast calculations give text/focus 14.16:1, muted text 8.10:1 and action
boundary 3.91:1 on the card; native focus uses the existing 3px outline.

The retained red results correspond to missing disclosure and compact-row
behavior, followed by green results. Run 08's eight failures came from counting
the setup sign-in POST in a no-page-write baseline. Clearing setup requests
before page.goto fixes that fixture error while keeping the same zero-POST
assertion. It is not an intended feature red, a product defect, a pagination
repair or a relaxed assertion. Its failed result remains history. The DOM role
readers are intentionally limited to the current rendered fact structure;
their markup sensitivity does not establish a product defect. They retain the
identity/role facts that the old sentence assertions checked.

## Consumers and final gate selection

The old pending-sentence parsers/assertions are migrated in hosted-invitations,
hosted-members, offline WorkOS administration, integration hosted-administration,
real hosted-live administration and InvitationBrowser. A final search found no
remaining `invitation, pending` sentence or `invitationLines` consumer under
test. The new HTTP driver reads email/role facts in the pending disclosure;
it has five ordinary/live case consumers, not its own test. Existing pending-only,
state, tenant, record, token exclusion and lifecycle assertions are retained.
The product-seat DSL and six-seat expectations are unchanged.

formsIn now uses an escaped aria-label when present and the original button
text otherwise. It still reads the same action, hidden fields and checked
radios. This narrow shared protocol-driver change preserves existing exact
action/target and label assertions while supporting short visible labels.
It has ordinary and dedicated consumers, including SQL's integrated removal
and storage-failure entries, live administration/removal and the Collector
journey through its probe/read-only container mounts. These confirm the gate
selection in `gate-review.md`; do not select only the newly edited files.

The complete candidate still requires npm test, typecheck, portal build,
self-hosted container, hosted offline build, Linux AMD64 hosted image, full
Members browser, PostgreSQL, Collector and the complete hosted-live command.
No separate check aggregate, standalone search live, Axiom live interface or
second renderer run is selected. A valid hosted image's proven nested offline
build can supply that offline execution evidence. Parent passes do not
automatically prove the new Web rendering or shared-driver inputs.

The parent's live 28/29 result and the later quota-429 setup diagnostic remain
separate failures with different established facts. No current live success is
claimed by this review. Required complete-candidate runs and the live limit
remain the manager's work, including retained failure/retry provenance.

## Documents, architecture and tier

The design/implementation documents identify UI-04 as a draft candidate stacked
on UI-03 with UI-02 absent. The implementation record accurately describes
the final source, worker red/green checks, fixture correction and local markup
cleanup. It claims no merge or deployment. The browser inventory adds actual
cases while preserving command, selected test, prerequisite, assertion and
decision authority. It does not waive the required live proof.

Production architecture is unchanged. All 15 registry Mermaid views still
have parent-identical bytes, SHA-256
`c85f36b173f48c8d099ba2e910152e084cc6465327898373a9dab0c1735d3bcc`.
The source-owner mapping, hosted authentication, complete member-read sequence,
removal authority/recovery, Audit composition, shared resource ownership and
deployment prose remain accurate. No registry edit or historical comparison
drawing is needed. No production callable contract changes; omit L4 for that
reason. Test-driver exports are not production public_surface changes.

The fresh UI-04 impact declaration describes the final behavior and checked
views. No new component, dependency, public declaration, script, state, store,
Level 2 container or deployment change is expected. The final trusted checker
must confirm these facts and stamp the complete committed candidate. The
test-gate-policy inventory replaces one line, so the trusted removal-path rule
can select T1 Team review even though the private UI increment has no
architecture fact. Required metrics, habit-hooks and any used exception can
affect the final result. Agent review is not current-head human approval.

## Reviewed file hashes

- `.pr-impact.json`: `df304f6afc0b85de4d56bea8b4633435618e516277e38b9d576acf1e6734a937`
- `docs/design/organization-admin-plan.md`: `6e8728ffb19e3e268be1a658863f2bb5d684e06f455bd8a530bba53dbed8ff1f`
- `docs/design/portal-design.md`: `be7ef131f05db3bcdfb378af01b6be8b04e867607ccc962179bba0933bad004b`
- `docs/implementation/admin-ui-04.md`: `2e9aa050fe0583ba967eb35be1c48de7012f7ba0d04c2d8dfaf051e93e6ccca6`
- `docs/implementation/test-gate-policy.md`: `af203f678e5e1bf5643b12efcf934452438b0a5bdddec325f24e3fcaf8787b0d`
- `src/interfaces/web/account/administration-pages.ts`: `ae49b7d4efa23f3835fbd75a7e757d6d70aa7546fa10f000bc6a3a5b1975fd2e`
- `src/interfaces/web/account/members-style.ts`: `6e438a2bd3d8dc6bcb8a40c57e31b90a22f111939e9ad436606a70da8a551629`
- `test/acceptance/auth/hosted-invitations.test.ts`: `fea689da457b548205256f321a7d6acbe6817eba731377f44188a0a5c6f80257`
- `test/acceptance/auth/hosted-live/administration-server.ts`: `886f96d035384ed2eca2ee67a6fa85343d211e461d3dea413c0e31cac6b5dd4c`
- `test/acceptance/auth/hosted-member-removal-browser.runtime.ts`: `803d9b5406126b2605c2f842bed9c7f4aeb1a4f5f05bcf7f3338fb28a7bf188f`
- `test/acceptance/auth/hosted-members.test.ts`: `1051731b247bf9310f973b088f785c4bd2e5a3d4162cd2a650db3738b5988466`
- `test/acceptance/auth/hosted-workos-administration.test.ts`: `908a36319837867f9931f350dce3f189560f9a802dfd29759f3a74b7425d306e`
- `test/integration/auth/hosted-administration.test.ts`: `edc91b1d20a0f1ee4f640e53913869d014f7f7f70228e76cc6bcdeb79fe33bd1`
- `test/integration/hosted-admin/account-routes-administration-pages.test.ts`: `18eb006f26c5a375fbd325afb0eeea464fe3486a7e36c5498ae02b2913bf356d`
- `test/support/drivers/browser/hosted-browser.ts`: `059026a065f1944e3470c75ec6531510bd87ab8420e0ec23d0864fba34e4ca48`
- `test/support/drivers/browser/invitation-browser.ts`: `f7a1524184f82459577e534ac37bb4ee16350672034de6f1ea1dfca7f71a66b4`
- `test/support/drivers/browser/pending-invitations-browser.ts`: `ddd242b2f2acc38c6afe9d240a8e081259878aa76dadb954df1c3a0e4103ee0b`
- `test/support/drivers/browser/pending-invitations-page.ts`: `92617b7b77ce5d4ff6693ed202d040e679d44c5487143b6ec4b16b4feb2d5276`

## Follow-up: seven non-null findings and driver comment

Reviewed read-only at committed candidate
`3380afe663c6a2ef02a0adda525faccd6f5b726f`. No source/test edit, build, test,
metrics process or provider call ran. The hosted image build remains outside
this review. I read all findings in `validation/habit-hooks.log` and the seven
current locations. Result: no actual missing-data or false-pass defect found;
no correctness fix is required for these assertions.

AGENTS.md permits correcting a smell or recording the reason for retaining it.
The reasons below assess the current tiny observation scopes. They claim no
performance gain or performance exception. `!` adds no runtime fallback here:
a violated assumption reaches a strict assertion failure or thrown error.

| Finding | Existing invariant and failure behavior | Retention assessment |
| --- | --- | --- |
| `account-routes-administration-pages.test.ts:25` | This successful Members fixture renders the previously asserted disclosure under the Members lists container. If `.member-lists` is absent, immediate `.children` access throws; the test cannot continue or pass. The following three comparisons check the actual section, disclosure and help nodes in order. | Retain as a local test DOM observation. No missing container becomes an empty list or a passing comparison. An explicit named guard would improve the error message only. |
| Same file, line 39 | `entries` is made from the fixture's first two invitations; the returned rows must have length two before the loop. The loop indexes exactly those two rows and immediately reads `entry.email` and `entry.expiresAt`. A shorter fixture would produce an earlier row-count failure or an immediate dereference error. | Retain the bounded fixture index. There is no optional value, empty default or conditional assertion that could hide a missing entry. |
| `pending-invitations-browser.ts:17` | The locator evaluates the actual native summary in the live Playwright document after keyboard focus. That document owns the page Window. If a Window were absent, `getComputedStyle` access throws before the exact outline assertion. | Retain inside this page evaluation. It is not nullable application state and does not silently omit the focus check. |
| Same file, line 48 | The evaluated button comes from the row inside the live disclosure. The row has already supplied a real bounding box and two rendered row/expiry/role facts have been checked. A missing document Window throws before the exact color assertion. | Retain the live-document Window assumption; no fallback colors can pass. |
| Same file, line 50 | The button locator is rooted in `details.pending-invitations`, then its `.invitation-row`. Thus the button has a Details ancestor by construction. If that structure were lost, the locator fails or `getComputedStyle(null)` throws. | Retain the ancestor assertion within the same observation. A missing card cannot receive default surface styling and pass. |
| Same file, line 56 | This evaluation runs on the live page body without a concurrent navigation. Its Window owns the computed styles that are read and doubled. A missing Window throws immediately. | Retain the same live-document assumption. There is no skipped resize operation. |
| Same file, line 59 | A successful Members page has its h1. The evaluation directly calls `getComputedStyle` with that Element, and the returned size must equal `64px`. A missing heading is an invalid argument that throws, rather than an optional result. | Retain this strict resize observation. Missing heading data cannot be mistaken for successful 200% text. |

The new `pending-invitations-page.ts:3` comment accurately states the driver's
narrow email/role projection. Retain it as a short contract cue for its five
ordinary/live case consumers: the output is rendered facts, not authoritative
invitation state or a complete domain record. It has no executable effect and
matches the function's behavior. Removing the sentence would be optional style
cleanup, not a behavior or evidence repair.

The updated formsIn comment accurately names accessible button names and retains
the existing field-reading boundary. The remaining reported comments are
unchanged context or fixture/protocol notes; no new misleading claim stood out.
The four oversized files remain coherent route/provider/browser case entries.
UI-04 adds cases for their existing subject and keeps reusable interactions in
the new focused drivers. No unrelated concern or new production responsibility
was introduced. A mechanical split is not needed to address this increment.
The snooze file remains `[]`. Final retained-smell dispositions and the hook
exit result still belong in the manager's Quality review evidence.
