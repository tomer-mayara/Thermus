# UI-04 implementation handoff

Scope: source and tests only. The manager owns documents, impact evidence,
metrics, full candidate checks, commits, and the draft pull request. No provider,
production, or staging operation ran. No commit, push, checkout comparison, or
pull request operation ran in this worker.

## Result

Members uses a native Pending invitations · N disclosure. The existing complete
collection supplies the filtered pending count. Zero starts closed; a nonzero
count starts open. No read or stored counter was added. Each row shows email,
role, and absolute UTC expiry with the original datetime. Only the current
allowed actions produce forms. Visible buttons say Resend and Revoke; their
accessible names retain the recipient. The forms keep exactly csrf_token,
organization_id, and invitation_id. The final source uses direct local escaped
form markup and hiddenField. It does not change postForm or its contract.

The order is the heading and Invite member task, active members, pending, then
removal help. The membersHelp constant and its approved text, version, and hash
are unchanged. Member rows remain the UI-01 version. UI-02 is not in this branch.
No route, authority, storage, provider, state, clock, notice, or confirmation
behavior changed. CSP continues to derive its hash from the current CSS.

## Red and green evidence

All commands and timestamps are in the adjacent .result.json files.

- 01-acceptance-red.log: two native-browser scenarios failed because the pending
  disclosure was absent. This ran before the first source edit. The real portal
  build and TypeScript build passed first.
- 02-integration-red.log: zero and nonzero route cases failed because the native
  pending disclosure was absent.
- 03-disclosure-green.log: those two route and two browser cases passed after
  the disclosure and help move.
- 04-compact-red.log: the real browser failed the compact row height check with
  short and long pending values at the explicit narrow and desktop widths.
- 05-row-integration-red.log: row fact coverage failed because compact fact rows
  were absent.
- 06-compact-green.log: all 28 route cases and the three focused browser cases
  passed after the row and style changes.
- 07-focused-green.log: 78 affected ordinary cases passed, including the new
  later-page failure through the real public route and directory fake.
- 08-members-browser.log: 50 of 58 passed. Eight new read-only checks included the
  sign-in provider POST (/user_management/authenticate) in their baseline. The fixture now clears those setup
  requests before the Members GET. The zero-POST assertion stays unchanged;
  no pagination change or weaker assertion was used. This was a test setup error, not a product
  failure or an intended feature red.
- 09-members-browser-green.log: all 58 browser cases passed after that baseline
  correction.
- 10-final-focused-and-browser-green.log: 78 ordinary and 58 browser cases passed
  after adding a text space between Role and its value, trimming the field
  readers, and checking hostile accessible names.
- 11-reviewed-focused-and-browser-green.log: the final refresh after manager
  review replaced button serialization substitution with direct local markup.
  It passed all 78 focused and 58 browser cases, exit 0. Its result file records
  completion at 2026-10-26T23:56:42.321Z.

## Browser observations

The browser gate uses the existing Chromium and HTTPS bridge with real built
assets. All new scenarios explicitly set JavaScript on/off and 320px/1280px.
Each zero/nonzero fixture is independent, includes terminal data, and uses one
record per provider page. Keyboard discovery checks initial state, focus, close,
and reopen. Each Resend/Revoke scenario has a fresh fixture, submits by keyboard,
checks the exact three protected fields and one POST, checks the existing 303,
and checks the resulting pending state. It adds no delivery claim.

The row matrix covers a 212-character email, User/Admin, UTC text and datetime,
section order, 48px targets, normal text, and 200% text. Existing invitation,
invalid input, refusal, unconfirmed, recovery, removal, and Audit tests remain.
Screenshots are in screenshots/. I inspected pending-rows-off-1280.png and
pending-text-200-off-320.png: values wrap, actions stay readable, and no content
is clipped or overlaps. Desktop short row height is 73px. Narrow short row height
is about 164px. Long rows grow. Text grows to a 64px Members heading.

Computed colors are in pending-measurements-*.json. Contrast calculations from
those colors are in contrast.json: text and focus on the card 14.16:1; muted text
8.10:1; action boundary 3.91:1. The disclosure focus is a visible 3px outline.

## Consumers and selected checks

hosted-browser.ts keeps its plain-text button parser and reads aria-label first.
This preserves all existing exact form-label checks while using accessible names
for the new compact buttons. hosted-browser-consumers.txt records its direct
consumers; consumer-inventory.txt records related test entries. Its ordinary
consumers belong to the full npm test selected by this source change.

Additional known dedicated consumers are the Members browser runtime through
InvitationBrowser; SQL hosted-member-removal-integrated.runtime and
hosted-storage-failure.runtime; Collector hosted-audit-journey.runtime through
the audit sender site; and hosted.live plus hosted-removal.live. The live
administration module now checks pending row facts instead of the old sentence.
The manager must retain the dedicated gate selection and the known provider
quota blocker. This worker did not run SQL, Collector, container, or live gates.
The source still selects both container gates and build:hosted under policy.

pendingInvitationsIn is a focused HTTP/DOM driver for the email and role facts.
It is used by hosted-invitations, hosted-members, hosted-workos-administration,
integration/auth/hosted-administration, and hosted-live/administration-server.
InvitationBrowser now reads the same row facts after successful sends.
PendingInvitationsBrowser is used only by the Members runtime and handles native
keyboard, geometry, screenshots, protected submit, and text growth. No support
file has tests of its own.

The final focused selection is the eight files listed in run 11, with 78 cases.
The complete Members gate contains 58 cases. build:user-portal and build run in
that command. No dependency or browser installation was needed. The configured
Node 24.20.0 path was used for every logged command. git diff --check passed.
Full npm test, typecheck, habit-hooks, metrics, architecture impact, review tier,
and external gates remain the manager's complete candidate work.

## Changed source and test files

- src/interfaces/web/account/administration-pages.ts
- src/interfaces/web/account/members-style.ts
- test/acceptance/auth/hosted-invitations.test.ts
- test/acceptance/auth/hosted-live/administration-server.ts
- test/acceptance/auth/hosted-member-removal-browser.runtime.ts
- test/acceptance/auth/hosted-members.test.ts
- test/acceptance/auth/hosted-workos-administration.test.ts
- test/integration/auth/hosted-administration.test.ts
- test/integration/hosted-admin/account-routes-administration-pages.test.ts
- test/support/drivers/browser/hosted-browser.ts
- test/support/drivers/browser/invitation-browser.ts
- test/support/drivers/browser/pending-invitations-browser.ts (new)
- test/support/drivers/browser/pending-invitations-page.ts (new)

Preliminary part classification: UI rendering and tests, T0 if no complete
candidate fact raises it. No production callable contract or export changed; no
component, dependency edge, registry view, or boundary changed in this part. The
manager must classify the complete committed candidate against UI-03 and main
as required. No local result authorizes Ready or merge.

Source and tests are frozen after run 11. Build ownership returned to the manager.
The exact source and test hashes are in frozen-files.sha256. No later source or
test edits were made by this worker.
