# Workspace selection: phase 2

Implementation worker evidence for the working tree after phase-1 commit
`b97215a9875ab04792550d0b57340d1b535faf96` on
`codex/fix-workspace-selection`. No commit, push, PR mutation, or impact
declaration change was made by this worker.

## Change

- The default return destination is the normalized public base path. Choosing
  the selected workspace again and choosing another authorized workspace both
  open Connect. Explicit safe `return_to` paths retain their exact value.
- The picker has native Connect, Switch Workspace, Members, and Audit Log
  header links in that order, with Switch Workspace current. Its links use
  15px text, transparent backgrounds, a selected underline, 48px targets,
  visible focus, and wrapping at narrow widths. Skip to content focuses main.
- Identity still admits the picker. Only after a successful authorized list,
  and only if the session's selected organization is in that list, a separate
  optional `AccessResolver.resolve` read decides whether to show Admin links.
  The context must match the session authority, subject, selected organization,
  and organization. It needs a nonempty tenant, `product:access`, and an exact
  `admin` grant with nonempty permissions. Denied or mismatched results give
  the basic menu without blocking the picker. Roles in other workspaces never
  supply Admin links.
- A display lookup exception reports `Workspace navigation access lookup
  failed.` through the existing reporter, with the original error retained as
  `Error.cause`. Neither the page nor `String(error)` exposes that cause.
  `waitForRequest` bounds the wait, and cancellation reaches the caller without
  a page or report.
- `account-form.ts`, `AuthorizedOrganization`, public surface contracts,
  selection POST authorization, origin and CSRF checks, and current membership
  and provider session checks were unchanged. The page form type changes only
  the private web route-to-page contract.

## Red evidence

The phase-1 acceptance red is retained in `phase-1-red.md` and
`acceptance-red.log`: 12 tests, 2 passed, 10 failed as expected.

Focused TDD command:

```sh
npm run build
node --test --test-timeout=10000 dist/test/integration/hosted-admin/account-routes-organization-page.test.js dist/test/integration/hosted-admin/account-routes-workspace-navigation.test.js
```

Result before implementation: 42 tests, 21 passed, 20 failed, 1 cancelled by
the 10-second test timeout, 0 skipped. Failures cover the old default return,
absent header menu, and missing display lookup. The cancellation case timed
out because the requested new lookup did not yet start. Output is in
`focused-red.log`; the backend build passed (`build-focused-red.log`).

An additional focused red tightened the permission rule after the first
implementation: 57 tests, 56 passed, 1 failed because an Admin-shaped context
without product access showed Admin links. Requiring `product:access` fixed
that case. Output is in `initial-green.log` despite its initial filename.
An initial intermediate build missed the `escapeHtml` import in the page;
that compile error was corrected before the focused run.

## Green checks

```sh
npm run build
node --test --test-timeout=10000 dist/test/integration/hosted-admin/account-routes-organization-page.test.js dist/test/integration/hosted-admin/account-routes-workspace-navigation.test.js dist/test/integration/hosted-admin/organization-selection-page.test.js dist/test/acceptance/auth/hosted-workspace-selection.test.js
```

Passed: 57 tests, 57 passed, 0 failed or skipped. Logs: `build-green.log`,
`focused-green.log`.

```sh
npm run build:user-portal
THERMUS_BROWSER_EVIDENCE_DIR=ast-report/workspace-selection/browser node --test --test-timeout=30000 dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js
```

Passed: 83 tests, 83 passed, 0 failed or skipped, in 54.7 seconds. Logs:
`portal-build.log`, `browser-green.log`. The eight new journeys use actual
native organization buttons by keyboard with JavaScript on/off, at 320px and
1280px, for the selected Acme and authorized Globex choices. Each checks one
selection POST, arrival at `/`, then reopening the picker with the correct
selected organization and menu. JavaScript-enabled cases also check the
persisted workspace name on Connect. The user starts with User in Acme and
Admin in Globex. Compact style, targets, focus, skip behavior, and reflow are
checked in the browser. The 320px Admin picker without JavaScript was visually
inspected (`browser/picker-admin-off-320.png`).

```sh
npm run build
node --test --test-timeout=30000 dist/test/integration/auth/workos-provider-organizations.test.js dist/test/integration/auth/hosted-organizations.test.js dist/test/acceptance/auth/hosted-organizations.test.js dist/test/acceptance/auth/hosted-organization-requests.test.js dist/test/acceptance/auth/hosted-workos-organizations.test.js
npm run typecheck
git diff --check
```

Passed: 28 related tests, 28 passed, 0 failed or skipped; both TypeScript
configurations and whitespace check passed. Logs: `build-related.log`,
`related-green.log`, `typecheck.log`.

The first related run had two stale expectations (`related-first.log`). The
cookie-effect acceptance test followed the changed default into a fixture that
does not serve the Connect page. It now requests the explicit protected portal
destination to keep its existing session assertion meaningful. The provider
read contract now expects the additional selected-workspace membership and
role read for the display lookup; the selection POST read expectation stays
unchanged. Both changed test files were rebuilt and rerun successfully.

## Review and limits

Authentication design now separates identity admission from the optional menu
read and describes its failure and cancellation rules. Portal docs describe
the corrected default, explicit return compatibility, and picker menu. Registry
prose records the collaboration; no registry drawing changed.

The optional lookup changes the runtime collaboration and private web callable
contract. Conservative T2 architecture review is appropriate; this worker does
not assert T0 from unchanged imports. The manager owns complete-candidate
metrics, habit-hooks, full ordinary tests and gates, architecture comparison,
classification, approvals, commit, and PR/release actions.
