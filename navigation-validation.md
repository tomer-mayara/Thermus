# Workspace navigation validation

Implementation worker evidence, 27 October 2026. This is local working-tree
evidence; it is not proof for a later committed candidate.

## Red before implementation

1. `node --test --test-name-pattern='current (admin|user)' test/acceptance/user-portal/portal.test.ts`
   failed as expected: 2 tests, 0 passed, 2 failed. Both failed because
   `header nav[aria-label="Workspace"]` was absent. This was the first changed
   acceptance specification and ran before source edits.
2. `node --test --test-name-pattern='only the exact admin role' test/unit/user-portal/portal.test.ts`
   failed as expected: 6 tests, 0 passed, 6 failed. The header menu was absent
   for each role input, including mixed roles and near-match names.
3. `node --test --test-name-pattern='one ordered menu' test/unit/html/logging-page.test.ts`
   failed as expected: 2 tests, 0 passed, 2 failed. Both admin layouts omitted
   Switch Workspace from the menu and used Audit logs as its link label.

## Passing focused checks

- `node --test test/unit/user-portal/portal.test.ts test/acceptance/user-portal/portal.test.ts test/unit/html/logging-page.test.ts`
  passed: 49 tests, 49 passed, 0 failed, 0 skipped.
- `npm run typecheck && npm run build:user-portal && npm run build`
  passed. This ran both TypeScript configurations, the Vite production bundle,
  and the backend build.
- `node --test --test-timeout=15000 dist/test/unit/html/logging-page.test.js dist/test/integration/hosted-admin/account-routes-administration-pages.test.js`
  passed: 36 tests, 36 passed, 0 failed, 0 skipped.
- `node --test --test-timeout=30000 dist/test/acceptance/auth/hosted-members.test.js dist/test/acceptance/logging/hosted-destination-settings.test.js`
  passed: 19 tests, 19 passed, 0 failed, 0 skipped.
- `THERMUS_BROWSER_EVIDENCE_DIR=ast-report/navigation-browser node --test --test-timeout=30000 dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js`
  passed: 75 tests, 75 passed, 0 failed, 0 skipped, in 71.2 seconds.
  The 4 new Connect cases use the production portal build and a real Chromium
  browser with provider doubles. They cover admin and user at 320px and
  1280px, ordered header links, current-page marking, 15px text, transparent
  background, 2px underline, 48px targets, focus, no horizontal overflow,
  and keyboard activation of Switch Workspace. Existing admin cases cover
  navigation and controls with JavaScript on/off, long trusted workspace
  names, and 200% text. Screenshots and measurements are in
  `ast-report/navigation-browser/`. The 320px admin Connect screenshot was
  visually inspected: the menu wraps and retains the selected underline and
  visible focus.
- `git diff --check` passed.

## Retry history and limits

- `npm run build && node --test --test-name-pattern='one ordered header menu' dist/test/acceptance/auth/hosted-members.test.js`
  completed the build, then emitted no test output for several minutes. The
  exact test processes were stopped. This is not a test pass or an expected
  acceptance failure.
- `node --test --test-timeout=20000 --test-name-pattern='one ordered header menu' dist/test/acceptance/auth/hosted-members.test.js`
  also emitted no output and was stopped. The later full-file run passed all
  8 Members acceptance tests, including this case. No production code or
  assertions were weakened for that retry.
- A diagnostic source run,
  `node --test --test-timeout=20000 --test-name-pattern='one ordered header menu' test/acceptance/auth/hosted-members.test.ts`,
  failed with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` because Node strip-only
  mode cannot load an existing TypeScript parameter property. Backend tests
  use the supported compiled commands above.
- The manager owns complete-candidate ordinary tests, metrics, habit-hooks,
  gate selection, impact evidence, review tier, commit, and PR actions.

## Design and access review

Connect, Switch Workspace, Members, and Audit Log are native page links in
that order. Connect uses its existing current-access response and the exact
`roles.includes('admin')` check. The trusted admin page routes retain their
existing authorization. No session or server authorization behavior changed.
Relative portal destinations and base-path admin destinations are preserved.
Members keeps the escaped trusted name outside the menu. Audit retains its
existing context without a new organization lookup. Its title and help keep
their existing wording. Embedded style hashes are derived from the changed
style owner as before. No new dependency, component, public export, callable
contract, or registry diagram was added. The estimate is T0 Auto merge,
subject to the manager's complete-candidate checker and checks.
