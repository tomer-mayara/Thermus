# UI-03 implementation evidence

Production files: `administration-pages.ts`, `members-style.ts`, `account-pages.ts` under `src/interfaces/web/account/`. No production API, route, policy, state, script or member-row change. Public declarations remain unchanged. Root owns full checks, metrics, docs, impact and PR evidence.

## Red and green

- `bdd-red.log`: real Chromium with JavaScript off failed because Invite member disclosure did not exist (0 versus 1). No source edit preceded this red.
- `integration-red.log`: new disclosure and Cancel cases failed; no-role and two allowed-role subset characterizations stayed green (3 pass, 2 fail).
- `form-green.log`, `bdd-initial-green.log`: 5 integration cases and original real-browser initial-disclosure case passed after native markup.
- `recovery-red.log`, `recovery-green.log`: absent last-Admin instruction failed, then passed after its addition beside the existing link.
- `layout-red.log`: real browser found undersized targets at 320 and missing beside-heading placement at 1280 before CSS.
- `transport.log`: the existing browser route-fulfillment driver could not follow a real 303. A local HTTPS front with Chromium hostname mapping fixed this test transport limit, without rewriting the status or response body; four initial matrix journeys passed.
- `double-text-red.log`: 481px doubled text overlapped; 600/860/1280 remained green. `double-text-green.log`: all four passed after stacking through 860px and removing fixed title padding. Both recovery browser cases also passed.
- `browser-group.log`: complete Members group passed 38/38, including independent initial/open+Cancel, native invalid input, refusal, unconfirmed, User send and Admin send with JS on/off at 320/1280; intermediate doubled text; last-Admin recovery; existing removal and UI-01/Audit checks.
- `ordinary-focused.log`: 137/137 passed. Exact command is `run-focused.sh`; exact selected files are `ordinary-selection.txt`.
- `focused-eslint.log`: touched existing memberRemovalBrowser had four parameters, above its enforced three-parameter bound. Cookie header moved into existing options and the sole caller changed. `focused-eslint-green.log`: no findings.
- `final-browser-group.log`: final browser recheck after that test-only signature fix. Read summary at end.

## Commands

All commands used PATH `/Users/tomermayara/.nvm/versions/node/v24.20.0/bin:$PATH`.

- `pnpm install --frozen-lockfile`: passed (`install.log`). `pnpm exec node --version` reported v24.20.0.
- `npm run build`: passed before each executable red/green; build logs use matching names.
- Initial browser: `node --test --test-name-pattern='Given Members without JavaScript' dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js`.
- Focused form TDD: `node --test --test-name-pattern='Given an invitable role|invitation Cancel|no invitable roles|only .* is invitable' dist/test/integration/hosted-admin/account-routes-administration-pages.test.js`.
- Recovery TDD: `node --test --test-name-pattern='Given the last-Admin refusal' dist/test/integration/hosted-admin/account-routes-removal.test.js`.
- Browser layout red: `node --test --test-name-pattern='when an Admin opens Invite member' dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js`.
- Doubled text: `node --test --test-name-pattern='when Invite member opens with 200%|Given the last Admin' dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js` (red selected only doubled text).
- Complete browser: `THERMUS_BROWSER_EVIDENCE_DIR=.cache/ui03/implementation/screenshots node --test dist/test/acceptance/auth/hosted-member-removal-browser.runtime.js`.
- Focused ordinary: `zsh .cache/ui03/implementation/run-focused.sh`.
- Focused lint: `pnpm exec eslint --config .habit-hooks/eslint.config.mjs` on three source owners, three browser drivers, TLS site, browser entry, and changed page/removal integration cases.
- `git diff --check`: passed. Exact old Invite-label search in source/test found no remaining consumers.

## Build-only correction history

Initial added test code hit type errors before executable test runs: role array needed `as const`; the provider fake exposes `takeRequests()` rather than `requests`; this Node tsconfig has no named HTMLInputElement type. These test compilation errors were corrected before the recorded executable red/green runs. The initial combined browser matrix was split into fresh independent Cancel, invalid, refusal, unconfirmed, User and Admin scenarios before final validation.

Screenshots were inspected at desktop closed and narrow open sizes. They show neutral native summary, one orange send, full-width form before unchanged parent member rows, and no overflow. Consumer groups and external gates are in `consumer-trace.md`.

## Collector fixture follow-up

The manager's full Collector gate exposed an inherited saved-destination fixture gap: 8/10 passed, but two `testSavedDestinations` consumers failed to resolve `micromark` from the copied renderer. The public audit journey passed. This observed red is retained as `collector-observed-red.log` (copied from `.cache/ui03/validation/collector.log`).

The minimal fix is test support only: `test/support/container/audit-sender-site.ts` now mounts the same read-only source, support, node_modules and package.json workspace for `testSavedDestinations` as its existing `publicJourney` path. Its probe runs from `/workspace`, while fixture data and the test certificate remain under `/fixture`. This closes the dependency graph for the renderer and help documents without adding a production dependency, test, suppression or package-specific copy list.

Command: `PATH=/Users/tomermayara/.nvm/versions/node/v24.20.0/bin:$PATH npm run test:logging:collector`. Result: build passed and full Collector group **10/10 passed**, zero skip/todo. Evidence: `collector-fixed-green.log`. `git diff --check` passed.

Affected consumers of `audit-sender-site.ts`: `test/integration/logging/audit/audit-sender.runtime.ts` (9 cases) and `test/acceptance/logging/audit/hosted-audit-journey.runtime.ts` (1 case). The full gate runs both, so no further focused test selection is needed for this support change. No production file changed in this follow-up. Implementation is frozen again.

## Staging diagnostic follow-up

The manager's complete staging gate passed 28/29. The invitation lifecycle failed while looking up the third invitation's Revoke form, before its existing redirect assertion ran. The original result is retained as `staging-observed-red.log`.

Only `test/acceptance/auth/hosted-live/administration-server.ts` changed: `assertSeeOther(third, 'members')` now runs immediately after the third send. The later shared redirect assertion loop no longer includes `third`. All original expectations, fixtures, outcomes and deadlines remain. No production file changed.

The requested focused full invitation describe group was run after a passing `npm run build`:

`LIGHTPANDA_BIN=/Users/tomermayara/.codex/worktrees/ui-01-refined-tabs/Thermus/.cache/lightpanda/1.0.0/lightpanda PATH=/Users/tomermayara/.nvm/versions/node/v24.20.0/bin:$PATH node .cache/ui03/with-workos-staging.cjs node --test --test-name-pattern='invitations of organization C' dist/test/acceptance/auth/hosted.live.js`

Result: **0/3 passed**, zero skips/todos. All three fail at shared fixture setup before their actions: WorkOS returns HTTP 429 `RateLimitExceededException: Sandbox environment email quota reached for invitation emails.` The failure is in `invitedMembership` through `createAdministrationFixtures`, request ID `8477b401-c63c-48ec-a234-d3b5d6ce6759`, `retryAfter: null`. Thus the moved third-send assertion is not reached, and this run does not establish the cause of the earlier lifecycle failure. Evidence: `staging-invitations-build.log`, `staging-invitations-diagnostic.log`.

The full staging gate remains required and has no green result. The focused run does not replace it. No product workaround, new outcome, assertion relaxation or retry was added. The staging quota needs recovery before a useful rerun. Production owners and the changed test are pinned in `staging-diagnostic-source-hashes.sha256`; `staging-diagnostic-hash-check.log` confirms they stayed unchanged through the run. Implementation is frozen again.
