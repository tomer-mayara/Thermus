# Portal design verification

This record covers the portal, signup, and AuthKit design approved on
16 October 2026. The manager reviewed the three delegated changes against
[the design](portal-design.md), the security boundaries, and the unchanged
legal source. No agent reviewer ran on the pull request.

## Review images

These are browser captures of the implemented pages, not generated mockups.
The home and signup captures use local preview fixtures. The AuthKit captures
show the actual WorkOS Staging page. The preview fixtures create no accounts.

- [Home, desktop](portal-screenshots/home-desktop.jpg)
- [Activation, desktop](portal-screenshots/signup-desktop.jpg)
- [Activation, 320px mobile](portal-screenshots/signup-mobile.jpg)
- [Hosted sign-in, desktop](portal-screenshots/authkit-desktop.jpg)
- [Hosted sign-in, 320px mobile](portal-screenshots/authkit-mobile.jpg)

## Behavior and visual checks

The home page uses the approved copy and the exact marketing logo and font
files. The diagram has three nodes and four directed paths. The two white
paths go to Thermus and then to the web. Raw pages return on the dashed red
path. Clean content returns to the agents on the green path.

Home, signup, and hosted sign-in have no horizontal overflow at 1440px,
390px, or 320px. Home and hosted sign-in also passed a 1024px check. Mobile
views omit the diagram. The portal skip link and sign-in action have visible
keyboard focus. The hosted controls are at least 48px high.

The desktop legal readers scroll with Page Down after keyboard focus. Mobile
disclosures start closed, show the full document in page flow, and return focus
to the summary when closed. Opening a document hides its duplicate excerpt.
The agreement stays outside both disclosures and starts unchecked. The full
approved legal source, document versions, hashes, and exact agreement text
remain unchanged. Tests compare the complete rendered text on desktop and
mobile, and keep the source hash checks.

The browser tool did not expose a working 200% page zoom control. This check
is not complete. The 320px reflow check is separate evidence, not a substitute
for a zoom check.

## Automated checks

Use Node 24.20.0 and pnpm 12.10.1. The renderer runs used
`LIGHTPANDA_BIN=$PWD/.cache/lightpanda/1.0.0/lightpanda`. The container runs
used the existing Colima Docker socket through a command-local `DOCKER_HOST`.
The merged-candidate container runs used a temporary Rosetta runtime. After
the gates, the manager restored the original 4 CPU / 4 GiB configuration and
QEMU handlers. All three configuration hashes and both handler records match
the saved originals. Docker uses its original `colima` context, the three
original exited containers are unchanged, and the gate containers and image
tags are removed.
The first restored boot stalled; a restart completed and passed these checks.

The new behavior first failed the acceptance and focused tests. The final
focused run passed 56 backend tests and 23 portal tests, with no failures,
cancellations, skips, or todos. This includes the new AuthKit artifact checks.

| Check | Result |
| --- | --- |
| Frozen dependency install | Exit 0 |
| `npm run check`, inside `build:hosted` | Exit 0; 2,663 backend unit, 14 portal unit, 13 build, and 9 portal acceptance tests passed |
| Remaining `npm run build:hosted` gates | Exit 0; 459 integration, 120 selected acceptance/interface, and 9 renderer tests passed |
| `npm run test:acceptance` | Exit 0; 369 backend and 9 portal tests passed |
| Focused changed tests | Exit 0; 56 backend and 23 portal tests passed |
| Offline WorkOS interface | Exit 0; 38 tests passed |
| `npm run test:container` | Exit 0; 13 tests passed |
| `npm run test:container:hosted` | Exit 0; all 9 Linux AMD64 image tests passed |
| `npm run test:hosted-live` | Exit 0; all 79 Staging tests passed |

All passing Node reports have zero failures, cancellations, skips, and todos.
The final candidate integrates main through `64c1bdd7`, including deleted-user
recovery and the test-support refactors. The conflict resolution keeps the
branded sign-in page and forwards its recovery status. The recovery assertions
first exposed two POST responses with status 200 instead of 401. After the
correction, all 123 focused signup tests passed. The table records runs on the
combined candidate.

The Staging hosted-live gate covers activation, workspace selection, session
refresh, sign-out, token expiry, and MCP access. It uses the configured Optional
MFA profile. It does not test the interactive Google account chooser.

The first self-hosted container attempt could not find the default Docker
socket. It reported 13 cancelled tests. The command-local Colima socket fixed
the setup, and all 13 tests passed. The first hosted-live run passed 59 tests
and failed 20. Two old test selectors still expected the portal sign-in action
to be a button. Both selectors now use its native link role. The complete
repeat run passed all 79 tests. No assertion or deadline was weakened.

The whitespace check passes for authored files. The copied IBM Plex license
keeps the design kit's exact bytes, including CRLF line endings and one trailing
space. The ordinary Git whitespace check flags that vendor file. A byte
comparison with the design kit passed, so the license is retained as supplied.

## Retained habit-hooks findings

The complete-candidate `habit-hooks --branch origin/main` run exited 1 with
26 comment findings and three file-size findings. It reported no complexity
finding. The manager retains these items for the reasons below.
`.habit-hooks/snooze.json` stays `[]`.

- `src/user-portal/portal.ts`: four comment lines explain the server-owned
  session boundary and why authentication paths are relative. These constraints
  are not clear from the rendering code alone.
- `test/acceptance/auth/hosted-image.test.ts`: the comment explains why this
  gate must run without live provider credentials.
- `test/acceptance/auth/hosted-workos-signup.test.ts`: the comment explains
  why the provider double starts before composition, so the test can prove
  that rejected requests cause no provider calls.
- `test/support/hosted-live/portal-visit.ts`: nine existing comment lines
  describe browser-cookie handling, requests that must not follow redirects,
  the provider invitation sequence, and redaction of invitation tokens from
  errors. They explain the live test boundaries. The obsolete button name was
  changed to the native link name.
- `src/auth/hosted-auth/workos/workos-signup-document-reader.ts`: the comment
  records the Markdown security settings and the legal-source constraint.
- `src/auth/hosted-auth/workos/workos-signup-routes.ts`: three comment lines
  explain the process-local quota and the rule that disconnected work keeps
  its capacity slot until it settles.
- `test/acceptance/auth/hosted-live/hosted-server.ts`: seven existing comment
  lines explain token lifetimes, fresh credentials after earlier revocation,
  the sign-out navigation check, and the expiry wait. This file keeps one
  hosted-server contract. Its size is retained because a one-line selector
  change does not justify splitting the live scenario sequence.
- `test/acceptance/auth/hosted-workos-signup.test.ts` and
  `test/integration/auth/workos-signup-routes.test.ts`: both were already large.
  They keep cohesive enrollment and route contracts. Splitting them by line
  count during a presentation change would scatter those contracts.

## Release state

The AuthKit candidate is active in WorkOS Staging. The manager read back the
branding after the update and checked the hosted page. Production branding
still matches its saved previous state. Authentication methods, redirects,
and legal links were not changed. The [AuthKit bundle](authkit/README.md)
contains the apply and rollback steps.

The portal code has not been deployed. Owner pull request review is required
before merge and production rollout under `AGENTS.md`.

The manager reviewed and signed off the implementation and delegated changes.
All required combined-candidate test suites passed. The pull request is ready
for owner review.
