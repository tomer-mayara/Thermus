# Audit saved feedback, scroll, and token preview

The worker changed source, focused tests, and the generated public declaration snapshot. The manager owns documents, impact, complete-candidate gates, commit, and PR. No worker commit, push, PR update, broad-suite run, coverage collection, or metric run was made.

## Agreed design and result

Both Save and Test now return a native server-rendered POST response. A confirmed saved/unchanged result shows the literal `saved` above the action buttons. The line keeps its height when the text clears. It clears after 30 seconds and on input/change. Test feedback is beside the actions when a form is available, so retaining scroll still leaves the result visible. Recovery-only pages keep the notice at the top.

The server supplies the saved flag. Neither client storage nor submitted fields can assert success. Invalid, conflicting, unavailable, or unconfirmed Save does not set it. If a non-tested result rereads a newer saved revision, that current form does not receive the saved marker for an older version. An uncertain Save still has no retry form and no Test send. A later explicit GET does not repeat saved feedback.

The small existing hash-pinned script records only `{y, at}` at a valid native submit, under the canonical Audit URL in tab-scoped sessionStorage. It consumes the value on the next Audit response, accepts only finite numeric position/time, rejects expired/future/negative values, expires after 120 seconds, and clamps to current page height. It handles malformed/blocked storage without stopping native Save. Dataset handling is now null-safe on recovery pages, which also run the same controlled script. No fetch, connect-src permission, backend flash state, cookie, or query marker was added.

The native POST refresh tradeoff is the same as the prior Test flow: a changed revision makes an old submission conflict; an unchanged submission may repeat an explicit Test. There is no automatic retry. Scroll restoration and timed clearing are progressive features; without JavaScript the native Save/Test and server-confirmed text still work. A shorter recovery page can only restore a clamped position. Blocked storage preserves native saving without scroll restoration.

## Token preview boundary

`PublicDestinationSettings` adds optional `tokenPreview`. Read derives it from the already decrypted validated token; successful Save derives it from the token that it saves. Tokens longer than four characters expose only their first four followed by `****`. Tokens of one through four characters show only `****`. None-auth settings have no preview. No prefix or plaintext token field is persisted.

The password input remains `value=""`. The preview is an escaped placeholder, never a submitted replacement value. Blank-token retention and changed-endpoint replacement rules are unchanged. Typing a replacement updates the real saved token, and the next response displays the new prefix. The route builds Test input from a named whitelist, so neither tokenPreview nor tokenPresent enters its saved-only Test request. Full destination authentication remains the existing service's responsibility.

The generated declaration change is only the optional tokenPreview field. `api-surface.ts` wrote one snapshot and left 47 unchanged. Its check says all 48 are current. Both runs reported 33 ignored compiler diagnostics in two files outside public_surface; the ordinary build/noEmit checks passed. See `api-surface.log` and `api-surface-check.log`.

## BDD and TDD evidence

Before source edits, `hosted-save-feedback.test.ts` specified direct confirmed Save/Test responses, saved text above actions, masked placeholder with empty token value, current revision, blank-token retention, no plaintext persistence/logging, and no feedback on ordinary read. Its first run failed: Save was still 303 and Test had no marker. See `acceptance-red.log`.

Focused service and script specifications also ran red before implementation (`unit-red.log`). They cover prefix lengths, no preview in storage/None auth, 30-second timeout, edit clearing, native submit continuing, position/time-only storage, one-time recovery restoration, height clamping, TTL/future/malformed values, and blocked storage.

The first implemented batch passed 50/52 tests; two old exact public projection expectations still asserted presence-only feedback. They were updated to include the requested masked prefix, without weakening their ciphertext/secrecy checks. See `first-green.log`. The expanded source selection passed 175/175, then the final compiled selection passed 176/176 after the denied-Admin preview case was added. See `focused-first.log`, `focused-second.log`, and `focused-compiled.log`.

Other current tests now assert the deliberate Audit Save 200/current-form contract instead of 303/follow. Shared browser.follow and unrelated invitation/organization redirects were not changed. The hosted runtime journey preserves invitation redirects while expecting direct Audit responses: `[200, 200, 303, 303, 303, 200]`.

The additional cases prove denied Admin access prevents preview/read/write/send; failed/uncertain Save has no saved marker; a newer revision on a conflict reread is not labeled as this saved version; and the route excludes preview from Test input. Existing stale-revision, token retention, no-op revision, cancellation, Origin/CSRF, codec, and transport assertions remain.

## Compiled checks and build handoff

```sh
pnpm exec npm run build
pnpm exec node --test dist/test/unit/logging/destination-settings-service.test.js dist/test/unit/html/logging-feedback-script.test.js dist/test/unit/html/logging-form.test.js dist/test/unit/html/logging-page.test.js dist/test/unit/html/logging-routes.test.js dist/test/unit/html/logging-test-routes.test.js dist/test/acceptance/logging/hosted-destination-settings.test.js dist/test/acceptance/logging/hosted-destination-test.test.js dist/test/acceptance/logging/hosted-save-and-test.test.js dist/test/acceptance/logging/hosted-save-feedback.test.js dist/test/integration/hosted-admin/account-routes-logging.test.js dist/test/integration/hosted-admin/account-routes-audit.test.js dist/test/acceptance/logging/audit/administration-capture.test.js
pnpm exec node script/pr-review/api-surface.ts --check
```

Build, all 176 compiled selected tests, and API snapshot check passed. The relevant noEmit check passed (`typecheck-second.log`). `git diff --check` passed. The manager and gate worker received exclusive build/dist ownership after these checks. No source/test edits followed that handoff. Runtime and complete-candidate reruns belong to their new gate evidence, not this worker report.

## Real browser and visual evidence

`browser-check.mjs` uses real Chromium, production Audit routes/page/service/codec, native POST, a local trusted Admin, an in-memory store, and a controlled sender. No live customer writes occur. It passed; see `browser-check.json` and `browser-first.log`.

| Viewport | Save scroll before/after | Test scroll before/after |
| --- | --- | --- |
| 1440 | 511 / 511 | 511 / 511 |
| 390 | 816 / 816 | 816 / 816 |
| 320 | 912 / 912 | 912 / 912 |

At all sizes the saved line and Test result are visible near the action buttons. A clock advance of 30 seconds clears saved without moving the buttons or scroll position. Input and switch edits clear it. The real FormData token remains blank while the placeholder shows the preview. Replacement changes the prefix; short tokens are fully masked. Unconfirmed Save has no marker/form, recovery GET has no repeated marker, and native Save works with scripts disabled and storage blocked. No browser script errors occur.

The images are actual viewport screenshots at the submitted button position, not full-page images taken from the top. Worker visual inspection checked Save at 1440, Test at 390/320, and sender failure at 1440. The visible outcome, saved text, masked empty field, native switch, and adjacent buttons remain useful without scrolling up. Prior evidence under audit-save-and-test remains untouched.

## Owned paths and remaining review

Source: `src/logs/audit/destination-settings-service.ts`, Audit logging page/routes, and shared members-style with Audit-only additions. Generated snapshot: `docs/api-surface/src/logs/audit/destination-settings-service.d.ts`. New focused tests: hosted-save-feedback acceptance and logging-feedback-script units; existing changed service, route, acceptance, audit, and journey tests retain their purpose.

The manager owns the new public declaration/credential visibility review, updated architecture comparison, full validation and human approval. No migration, additional plaintext store, dependency, sender contract, or Test service redesign was introduced.

## Complete-candidate typecheck and snapshot retry

At committed candidate `869de8c5`, the gate worker's full typecheck found TS7006 in the new acceptance test's mocked read callback. The build-config noEmit check used earlier did not catch this root-project diagnostic. The worker added the exact `tenant: string` annotation. No scenario or assertion changed.

After the correction, the actual `pnpm exec npm run typecheck` passed both root TypeScript and user-portal TypeScript. The changed acceptance file passed all three tests both through tsx and after `pnpm exec npm run build` as compiled JavaScript. See `typecheck-repair.log`, `focused-type-repair.log`, `build-type-repair.log`, and `focused-compiled-type-repair.log`. Build ownership was then handed back for complete-candidate checks.

The gate worker also reported one stale API snapshot, using Node 24.20.0 and the canonical `pnpm exec node script/pr-review/api-surface.ts --check` in parallel with its other checks. The failed attempt is retained in `api-surface.log`. Before attempting repair, the worker preserved the current declaration as `api-surface-before-repair.d.ts`. The canonical generator reported zero writes and 48 unchanged snapshots. Two serial canonical checks, including one after the new build, reported all 48 current. `cmp` confirmed that the preserved pre-repair declaration and the current declaration are byte-identical. The optional tokenPreview field is present. No manual snapshot edit was made.

The snapshot failure could not be reproduced. There is no captured emitted declaration diff from that failed attempt, so this record does not infer a cause. It records the failed attempt and successful canonical retries rather than claiming that an unchanged file was repaired. See `api-surface-repair-generate.log`, `api-surface-repair-check.log`, and `api-surface-repair-check-final.log`. The configured tool continues to report the same 33 ignored diagnostics outside public_surface. `git diff --check` passed.

## Token placeholder contrast follow-up

Independent review found that Chromium's default token placeholder used `rgb(117, 117, 117)` against `#17181D`, with measured contrast 3.85:1. After the gate worker finished its metrics command and handed back ownership, the worker added one Audit-scoped rule in members-style: `.logging-layout #logging-token::placeholder{color:#B4BAC0;opacity:1}`. No input value, form, service, or token behavior changed.

The local production-page Chromium check measured the actual computed pseudo-element style before and after. The new color is `rgb(180, 186, 192)`, opacity 1, on `rgb(23, 24, 29)`, at 17px. Calculated contrast is 9.05:1. The token value is still empty and the visible placeholder is still only `pref****`. See `placeholder-before.json`, `placeholder-after.json`, and `placeholder-check.mjs`. The before/after viewport PNGs are retained, and the worker visually inspected `placeholder-after-1440.png` at normal size. The field is clearer and the layout stays unchanged.

`git diff --check` passed. No brittle CSS test or extra build was added for this single style rule. Source is stable and ownership returns to the gate worker for complete-candidate checks.
