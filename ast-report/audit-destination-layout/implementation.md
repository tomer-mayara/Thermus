# Audit destination layout follow-up

Base candidate: `e77c075c`. This worker made no commit, push, impact declaration, PR change, broad-suite run, or metrics run.

## Change

- `src/interfaces/web/account/members-style.ts`: Audit uses the shared page content width, up to 1,200 pixels. Its scoped selector overrides the Members tablet width cap. The Audit action row uses flex with a 12-pixel gap and wrapping. Test uses a gray background and a gray hover state; Save retains its primary orange style.
- `src/interfaces/web/account/logging-page.ts`: Save and Test share one action-row wrapper. Both remain submit buttons. Test retains its own action and formnovalidate attribute.
- `docs/design/organization-admin-plan.md` and `docs/implementation/admin-s2-04-direct-axiom.md`: active plan and current form notes describe the full panel width, natural button widths, secondary Test style, and narrow-screen wrapping.

Members keeps its existing grid and tablet width cap. No form input, parser, script, CSP permission, service, or storage behavior changed. No new test was added merely to check CSS declarations or markup shape.

## Observable browser red and green

The Given-When-Then scenario is saved in `browser-check.mjs`. It renders the real LoggingRoutes, page, shared layout and stylesheet in Chromium, using a trusted local Admin fixture, in-memory settings store, and controlled Test sender. It serves real font and image assets. No live customer write occurs.

Before source edits:

```sh
pnpm exec node --import tsx ast-report/audit-destination-layout/browser-check.mjs red
```

Exit 1. The Audit panel was 720 pixels wide at desktop sizes and inherited the 650-pixel Members cap at tablet size. Both buttons filled the form, appeared on separate rows, and used orange. See `red.json`, `red.log`, and `red-*.png`.

After source edits, the same scenario with argument `green` exited 0. See `green.json`, `green.log`, and `green-*.png`.

| Viewport | Panel before | Panel after | Save width | Test width | Action row after |
| --- | ---: | ---: | ---: | ---: | --- |
| 1440 | 720 | 1200 | 67.5 | 189.6 | One row |
| 1024 | 720 | 976 | 67.5 | 189.6 | One row |
| 768 | 650 | 720 | 67.5 | 189.6 | One row |
| 390 | 358 | 358 | 67.5 | 189.6 | One row |
| 320 | 288 | 288 | 67.5 | 189.6 | Wraps |
| 240 | 208 | 208 | 67.5 | 166 | Wraps; Test text wraps |

Widths are CSS pixels. Save plus Test and the gap need about 269 pixels. At 320 pixels the panel has 246 pixels inside its padding, so the action row wraps instead of stretching or clipping. All six widths have no horizontal overflow. The Test background is `rgb(67, 69, 78)`; Save is `rgb(232, 85, 42)`. Members remains 650 pixels wide at the 768-pixel tablet viewport. No browser script errors occurred. Every measured viewport preserves submit types, the Test action, and formnovalidate.

Manual visual review inspected the 1440, 768, 390, 320, and 240 pixel screenshots. The panel aligns with page content; controls keep readable labels and spacing. The 390-pixel view shows both buttons together. At narrower widths the row wraps in order and the gray Test button stays inside the panel.

## Existing behavior verification

The existing full browser form check was copied to `form-browser-check.mjs` so that earlier evidence stays intact. It passed against this candidate. It verifies native keyboard destination selection and edit retention, dataset validation/disabled state, the script hash CSP, saved and unsaved Test behavior, Custom Save with credential retention, and no-JS Axiom/Custom Save plus explicit legacy None upgrade. See `browser-check.json` and `form-browser-check.log` in this folder.

The focused existing test selection passed **132 tests**, zero failures, skips, or todos:

```sh
pnpm exec node --import tsx --test test/unit/html/logging-form.test.ts test/unit/html/logging-page.test.ts test/unit/html/logging-routes.test.ts test/unit/html/logging-test-routes.test.ts test/acceptance/logging/hosted-destination-settings.test.ts test/acceptance/logging/hosted-destination-test.test.ts test/integration/hosted-admin/account-routes-logging.test.ts test/integration/hosted-admin/account-routes-administration-pages.test.ts test/integration/hosted-admin/account-routes-organization-page.test.ts test/integration/hosted-admin/organization-selection-page.test.ts
```

See `focused-tests.log`. `pnpm exec tsc --project tsconfig.build.json --noEmit` passed; see `build-typecheck.log`. `git diff --check` passed.

No source or document edit is pending. The manager selects and runs the complete candidate's required checks and metrics.
