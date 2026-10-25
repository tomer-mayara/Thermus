# Audit Save and Test implementation

The worker owns source/tests. The manager owns documents, impact, review tier, complete-candidate gates, commit, and PR. No worker commit, push, PR change, full-suite run, coverage collection, or metrics run was made.

## Result

The gray button is named Test. It submits the current native form, including the Enable export switch. The trusted form boundary performs Save, then calls the existing saved-only Test service only when Save returns saved or unchanged. Test receives the returned public destination settings and revision with a blank token. The route omits submitted token text from its Test input and from the page response; the existing service retrieves the saved token for destination authentication. The underlying service, its before/after revision checks, encryption, sender, storage contracts, and public APIs remain unchanged.

The result appears in the normal Audit page with a short fixed notice. Confirmed Test results retain the saved form, its exact revision, and a blank token. Conflict or invalid Save rereads current safe settings; a failed read never manufactures an empty form/revision. A non-tested Test result also reads current settings before showing a form. An unconfirmed Save never starts Test or supplies an immediate retry form: it shows styled recovery and a GET Read saved settings link, because a late commit remains possible. Read failure keeps the normal dark layout and a recovery link. Cause strings, raw destination response details, submitted userinfo endpoints, and tokens are not reflected.

The Test button now uses ordinary native validation because it saves settings. The old formnovalidate attribute is removed. No new JavaScript, fetch layer, client state, session flash, or result query string was added. The existing dataset script runs only when a form is present, under its hash CSP. Recovery pages have no form and no dataset script.

## POST response decision

A direct server-rendered POST response keeps the result bound to this operation and works without JavaScript. PRG would need result state in a session/flash store or a forgeable/stale query-string result code; neither is needed for this small flow. Normal Save success still uses its existing 303 redirect.

A browser refresh of the Test result can prompt POST resubmission. If the first Save changed the revision, the original POST conflicts. An unchanged Save can permit another explicit synthetic Test on resubmission. There is no automatic retry, hidden polling, or promise of exactly-once remote delivery. This tradeoff was reported to the manager before implementation.

## Red and green

1. BDD first: `pnpm exec node --import tsx --test test/acceptance/logging/hosted-save-and-test.test.ts` failed before source edits. The On/Off scenarios got 409 instead of 200 because old Test rejected edited settings. They also specify the new label, Save-before-Test, exact returned revision/settings, write-only token, inline styled form, and stale old-form refusal. See `acceptance-red.log`.
2. Focused route TDD failed before source changes. It required Save-before-Test with the Save return value rather than submitted values, safe inline results, and no Test after invalid/conflict/unconfirmed/unavailable Save. See `route-red.log`.
3. Initial source run passed the core acceptance and most route cases; one old message assertion still expected Save-your-edits text. Its fixed wording was updated for the new behavior. See `first-green.log` and `route-green.log` (34 tests passed).
4. An initial build typecheck found that checking both success strings did not narrow the service's combined status union enough for a failure-only parameter. The route now uses the contract's successful settings member to narrow the result. No assertion or production cast was used. See `typecheck-initial.log` (failed) and `typecheck-second.log` (passed).
5. Expanded tests cover first configuration, On/Off, no-op revision retention, changed endpoint without replacement token, invalid credential-bearing endpoint, stale revisions, failed/uncertain Save, Test failure, read failure, secret-bearing exceptions, and cancellation between Save and Test. Existing Admin/Origin/CSRF/shape guards assert that no read/save/send operation starts.
6. First regression batch: 117/121 passed. Four old audit/call-count assertions assumed Test never saved. They were updated to expect its one preceding Save and separate Save/Test metadata; no scenario or security assertion was deleted. The second batch passed 121/121. Two final focused exception/cancellation cases brought the compiled selection to 123/123. See `focused-first.log`, `focused-second.log`, `expanded-green.log` and `focused-compiled.log`.

Compiled validation before handing build ownership to the gate worker:

```sh
pnpm exec npm run build
pnpm exec node --test dist/test/unit/html/logging-form.test.js dist/test/unit/html/logging-page.test.js dist/test/unit/html/logging-routes.test.js dist/test/unit/html/logging-test-routes.test.js dist/test/acceptance/logging/hosted-destination-settings.test.js dist/test/acceptance/logging/hosted-destination-test.test.js dist/test/acceptance/logging/hosted-save-and-test.test.js dist/test/integration/hosted-admin/account-routes-logging.test.js dist/test/integration/hosted-admin/account-routes-audit.test.js dist/test/acceptance/logging/audit/administration-capture.test.js
```

Build and all 123 selected compiled tests passed, with no skipped or todo cases. See `build.log` and `focused-compiled.log`. The relevant noEmit build typecheck also passed (`typecheck-fourth.log`). `git diff --check` passed. Build ownership was then handed back; the worker did not touch dist again.

## Real browser proof

`browser-check.mjs` runs real Chromium through production LoggingRoutes, page, stylesheet, settings service, and codec. It uses a trusted local Admin, in-memory store, and controlled Test sender. No live customer writes occur.

`pnpm exec node --import tsx ast-report/audit-save-and-test/browser-check.mjs` passed. See `browser-check.json` and `.log`. With JavaScript enabled and disabled it checks:

- First-ever Axiom Test saves the complete form and On/Off switch once, then sends once. The response has normal Audit chrome, a short inline result, fresh revision, and blank token.
- A second unchanged Test preserves the revision.
- Sender failure says Settings saved, retains the form, and exposes no token or raw HTTP diagnostic.
- Invalid userinfo endpoint is refused without a Test and without reflecting credentials; the form returns safe current settings.
- Unconfirmed Save never Tests and shows no immediate retry form. Its recovery link reads the committed current revision.
- Unavailable reads use styled recovery with no empty revision form. No script errors occur.

Success screenshots cover export On/Off at 1440, 390, and 320 pixels. Failure, invalid Save, uncertain Save, and read-unavailable screenshots cover 1440 pixels. All checked sizes have no horizontal overflow. Manual worker inspection confirms dark layout, short notices, blank token, responsive form, and adjacent Save/Test controls. The manager separately inspected accepted-on1440, failed1440, unconfirmed1440, and accepted-off390 and approved the layout, short outcome, clear switch, adjacent controls, and no token reflection.

## Runtime fixture handoff and correction

The real-Collector form probe now tests an invalid changed endpoint with no replacement token before its valid saved Test. That invalid Save must send nothing. Its store double models unchanged settings faithfully and preserves their revision. Runtime assertions retain both receiver events, revision/state checks, and token secrecy. The hosted public journey adds one unchanged Save operation before Test, so its store-call count advances from three to four; its synthetic and ordinary export record expectations remain.

The gate worker's first Collector run found an obsolete response assertion that excluded the session CSRF value. The new result is an editable settings form and must contain its valid CSRF field. The worker changed only `test/integration/logging/audit/audit-sender.runtime.ts`: it still excludes the audit Bearer token and encryptedCredential, explicitly requires the correct hidden runtime-test-csrf, and explicitly requires a blank token input. The manager and gate worker were notified for rebuild and Collector rerun. This note does not claim their rerun passed; complete-candidate gate evidence belongs to the manager.

## Owned paths and review limits

Source: `logging-routes.ts`, `logging-page.ts`, `logging-test-page.ts`, and `members-style.ts` under `src/interfaces/web/account/`.

Tests: new `test/acceptance/logging/hosted-save-and-test.test.ts`; current hosted destination Test acceptance; administration capture acceptance; account logging/audit integration; logging route units; Collector/public-journey runtime expectations; and their two current form probe/journey fixtures. Test labels and assertions were updated only where Test now saves, returns a form, uses native validation, or reports short inline text.

The manager identified T2 architecture review for the changed protected web-to-audit collaboration/order. No public service contract, storage migration, package dependency, or framework was added. This worker report cannot authorize merge or replace complete-candidate checks or human approval. Source is stable; no source change followed the compiled handoff. The one later runtime assertion correction is explicitly recorded above.
