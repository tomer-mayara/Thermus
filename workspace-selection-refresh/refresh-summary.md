# Combined candidate: workspace selection refresh

The worktree combined HEAD
`2907d105f85c9596401312d7082af86a5711df06` with merge parent
`f6b523967223da5ebddafdef1a508d3936cee01c`. All merge conflicts were resolved
before this run. The worker made no production or documentation change and
did not commit, push, or change impact evidence.

## Passing checks

```sh
npm run typecheck
npm run build
npm run build:user-portal
node --test --test-timeout=10000 dist/test/integration/hosted-admin/account-routes-organization-page.test.js dist/test/integration/hosted-admin/account-routes-workspace-navigation.test.js dist/test/integration/hosted-admin/organization-selection-page.test.js dist/test/acceptance/auth/hosted-workspace-selection.test.js
node --test --test-timeout=30000 dist/test/integration/auth/workos-provider-organizations.test.js dist/test/integration/auth/hosted-organizations.test.js dist/test/acceptance/auth/hosted-organizations.test.js dist/test/acceptance/auth/hosted-organization-requests.test.js dist/test/acceptance/auth/hosted-workos-organizations.test.js
```

Both TypeScript configurations, backend build, and production portal build
passed. Focused cases passed 57/57; related cases passed 28/28; no failures,
cancellations, or skips. Logs: `typecheck.log`, `build.log`, `portal-build.log`,
`focused.log`, and `related.log`.

After the test readiness correction below:

```sh
npm run build
THERMUS_BROWSER_EVIDENCE_DIR=ast-report/workspace-selection-refresh/browser-retry node --test --test-timeout=30000 --test-reporter=tap dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js
npm run typecheck
git diff --check
```

The complete browser gate passed 83/83 in 68.3 seconds, with no failure,
cancellation, or skip. Backend rebuild, both TypeScript configurations, and
whitespace check passed. Logs: `build-browser-retry.log`, `browser-retry.tap`,
and `typecheck-retry.log`. Fresh screenshots are in `browser-retry/`.
There are no unresolved merge paths. Staging ports were not used.

## Failure and correction

The first full browser run reached all 83 cases, with 81 case passes and two
case failures: the JavaScript-enabled 320px selected-Acme and Globex journeys.
The spec reporter did not close after those events, so the exact test runner
and worker processes were stopped after capturing the failure reproduction.
This first run is not a gate pass. It remains in `browser.log`, with screenshots
in `browser/`.

A focused TAP reproduction failed both cases and exited 1 normally:

```sh
THERMUS_BROWSER_EVIDENCE_DIR=ast-report/workspace-selection-refresh/browser-repro node --test --test-timeout=30000 --test-reporter=tap --test-name-pattern='Given Switch Workspace at 320px with JavaScript on' dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js
```

Both failures came from `WorkspaceSelectionBrowser.chooseOrganization` checking
the exact workspace label with instantaneous `isVisible()` immediately after
document navigation. The `/` destination assertion had already passed. The
portal initializes its access data asynchronously, and the check ran before
that response rendered. Full reproduction: `browser-repro.tap`.

The worker reported this result before changing the test. The manager approved
waiting for the exact label under the existing timeout. One line in
`test/support/drivers/browser/workspace-selection-browser.ts` now uses
`getByText(..., { exact: true }).waitFor({ state: 'visible' })` for the
JavaScript-enabled branch. The existing 3-second timeout stays unchanged.
The exact label, destination URL, one-POST check, and persisted selection check
all remain required. No product source changed. The full 83-case retry passed.

The manager owns subsequent full-candidate tests, gates, metrics, commit, and
review evidence.
