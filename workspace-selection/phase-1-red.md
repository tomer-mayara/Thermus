# Workspace selection: phase 1

Branch: `codex/fix-workspace-selection`.
Base: `77477864` (`origin/main` at the start of this work).
No production source or impact declaration was changed. This phase adds only
an acceptance specification and its provider-backed test site.

## Command and result

```sh
npm run build > ast-report/workspace-selection/build-red.log 2>&1
node --test --test-timeout=30000 dist/test/acceptance/auth/hosted-workspace-selection.test.js > ast-report/workspace-selection/acceptance-red.log 2>&1
```

The backend build passed. The acceptance run exited 1: 12 tests, 2 passed,
10 failed, 0 skipped. All failures describe the reported missing behavior.

- Four default-selection cases fail because the redirect names
  `/organizations` or `/team/organizations`, instead of Connect at `/` or
  `/team/`. Each case first verifies the actual session access response:
  the selected workspace is correct before the redirect assertion fails.
  Both the selected Acme button and the other authorized Globex button are
  covered at each public base.
- Six picker-menu cases fail because the header has no Workspace navigation.
  The expected order is Connect, Switch Workspace, Members, Audit Log, with
  Switch Workspace marked `aria-current="page"`. User access in Acme cannot
  borrow Admin links from the user's Globex membership. Globex Admin gets
  those links, and no selected workspace gets no Admin links. Both public
  bases are covered. The specification also preserves native links, the
  public-base brand destination, and the selected organization labels.
- Two compatibility cases pass. Explicit safe `return_to` values for Members
  and the picker stay unchanged at both public bases. Selection switches the
  real browser session to Globex, and each explicit destination can be opened.

Full output: `acceptance-red.log`. Build output: `build-red.log`.
The manager's live reproduction is in `production-before.jpg` in this folder.

## Inspection

`HostedAccountRoutes` constructs `ReturnDestinations` with the organization
picker path as its fallback. `organizationPage` uses that fallback when
`return_to` is absent. The form copies the value, and a successful selection
redirects to it. This explains the loop even when the session switched.

`organizationSelectionPage` owns a separate header with a brand and a back
link. It has no Workspace menu and receives no current-workspace role data.
The route can resolve selected-workspace context without expanding the public
`AuthorizedOrganization` contract. The explicit destination validator, CSRF,
origin check, current membership authorization, and provider session switch
must retain their existing rules.

Implementation, focused unit red/green, browser geometry and actual organization
button journey checks, documents, full checks, commits, and PR actions are
deferred until the manager completes the phase-1 draft step.
