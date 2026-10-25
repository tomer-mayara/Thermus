# Audit Enable export switch

Base candidate: `17085397`. The worker changed four source/document files. No commit, push, PR update, impact declaration, broad-suite run, or metrics run was made by the worker.

## Change

- `src/interfaces/web/account/logging-page.ts`: Enable export keeps `input type="checkbox" name="enabled"` and its saved checked state. It now has `role="switch"`, a decorative track/thumb, a stable Enable export label, and visible On/Off text. The decorative parts and state text are hidden from the accessibility name.
- `src/interfaces/web/account/members-style.ts`: Audit-only switch selectors draw the track, thumb, checked state, and visible keyboard focus. The label has a 48-pixel click height. The native input stays focusable and clickable. The decorative track ignores pointer events. CSS alone selects the visible On/Off state. Members checkbox styles, Audit panel width, and action-row styles are unchanged.
- `docs/design/organization-admin-plan.md` and `docs/implementation/admin-s2-04-direct-axiom.md`: the active plan and current form notes describe the switch, pointer/Space/no-script use, and Save requirement. Historical and legal documents are unchanged.

The switch adds no JavaScript, state owner, form field, parser rule, or save operation. The native checkbox still submits `enabled=on` when checked and omits the field when unchecked. Changing it does not submit, save, or enable remote export until Save succeeds.

## Browser acceptance red and green

`browser-check.mjs` reuses the earlier local harness but writes only to this evidence folder. It renders production LoggingRoutes, page, stylesheet, service and credential codec in real Chromium. The Admin identity, in-memory settings store, and Test sender are controlled. No live customer writes occur.

The scenario is: Given saved On/Off export settings, when an Admin changes the switch with pointer, label, or Space, then visible and accessible state follows native checkbox values, sends no request until Save, and persists after one Save with or without JavaScript.

Before source edits:

```sh
pnpm exec node --import tsx ast-report/audit-destination-switch/browser-check.mjs red
```

Exit 1, recorded in `red.json`, `red.log`, and responsive screenshots. The prior native checkbox still passed native state, serialization, pointer/label/Space, and Save persistence checks. It failed the requested switch role, visible On/Off state, and visual switch-track focus checks.

The first green attempt stopped because the decorative track intercepted a direct pointer click on the native input. The failed log remains as `green-first-attempt.log`. Setting `pointer-events:none` on the decorative track allowed pointer input to reach the native checkbox. No test was weakened.

The final browser command with argument `green` passed. `green.json` contains 20 state/accessibility/serialization checkpoints across JavaScript enabled/disabled and initially saved On/Off values. For each combination it checks pointer toggle, label toggle, Space toggle, native FormData, no POST or write before Save, one Save POST, and persisted state after reload. It also verifies no Test event was sent and no browser script error occurred.

The accessibility snapshot remains `switch "Enable export"` in both states and reports `[checked]` for On. The visible text changes between On and Off without changing the accessible name. A 3-pixel outline on the track shows keyboard focus. These are Chromium accessibility-tree and keyboard observations; no separate screen reader session is claimed.

## Responsive and manual review

On and Off screenshots are saved at 1440, 390, and 320 pixels. Full-page focus screenshots show both focused states. Manual image inspection confirms readable On/Off text, thumb position/color, visible focus, and no clipping. The switch label is 48 pixels high and about 185 pixels wide at all measured viewports. No horizontal overflow occurs. The Audit panel remains 1,200/358/288 pixels wide at those viewport widths. Save and gray Test retain the previous responsive action row.

## Existing tests and type check

Relevant existing tests passed **132/132**, with no failures, skips, or todos:

```sh
pnpm exec node --import tsx --test test/unit/html/logging-form.test.ts test/unit/html/logging-page.test.ts test/unit/html/logging-routes.test.ts test/unit/html/logging-test-routes.test.ts test/acceptance/logging/hosted-destination-settings.test.ts test/acceptance/logging/hosted-destination-test.test.ts test/integration/hosted-admin/account-routes-logging.test.ts test/integration/hosted-admin/account-routes-administration-pages.test.ts test/integration/hosted-admin/account-routes-organization-page.test.ts test/integration/hosted-admin/organization-selection-page.test.ts
```

See `focused-tests.log`. `pnpm exec tsc --project tsconfig.build.json --noEmit` passed; see `build-typecheck.log`. `git diff --check` passed. No brittle CSS or markup test was added for this reversible presentation change.

The manager owns complete-candidate checks, metrics, review tier, commit, and PR evidence. Source and document edits are stable; no further worker test or source run is planned.
