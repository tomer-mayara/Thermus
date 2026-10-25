# PR #249: wider Audit settings and secondary Test action

Candidate `17085397bb0ce9af62d69bffe6a314513f277f7f` against main `a7411fd02aa6dd3300b334d4585f71469071b499`.

The Audit destination panel now fills the page content width, up to 1,200 pixels. Save and gray secondary Test share an action row at their natural widths. The row wraps when a narrow screen cannot fit the controls. Members keeps its existing layout. This is a layout follow-up to the Axiom/Custom selector in the same PR.

## Review and results

All selected test gates passed: 4,759 backend and 49 portal tests, 10 Collector tests, 11 self-hosted container tests, and 7 Linux AMD64 hosted image tests. Typecheck and the portal build passed. The image also passed its required hosted build, including 3,071 unit, 29 portal unit, 20 portal acceptance, 1,070 integration, 119 offline acceptance/interface, and 13 renderer cases.

- [Validation summary](validation-summary.json), [container gate execution](container-gates.json), and [final checker](check-final.json).
- [Quality review and retained reasons](quality-notes.md), [architecture assessment](architecture-review.json), and [worker implementation record](implementation.md).
- [Full metrics process](../process.md), [machine process](../process.json), [review findings](../review.json), [CRAP](../crap.json), [base snapshot](../snapshot-base.json), [candidate snapshot](../snapshot.json), [verified unit coverage](../coverage.json), [capture manifest](unit-capture-manifest.json), and [bound impact](../impact.json).

The final metrics process completes Delta, Review, CRAP, and Architecture. Raw exit 1 records retained MI/test findings; CRAP and Architecture pass. The layout changes add no finding. Habit-hooks retains the same 30 findings with explicit reasons and an empty snooze file. The narrow declaration emitter ignores unrelated diagnostics outside public modules; the separate full typecheck passes.

T1 Team review remains required for the complete candidate's credential form and script permission. The architecture summary is `T0: no architecture fact`. The checker has zero technical blockers. Its local result does not replace the selected test gates or independent current-candidate human approval.

## Browser evidence

- [Desktop, 1440 pixels](green-1440.png), [tablet, 768 pixels](green-768.png), [mobile, 390 pixels](green-390.png), [narrow, 320 pixels](green-320.png), and [very narrow, 240 pixels](green-240.png).
- [Before measurements](red.json), [after measurements](green.json), and [executable browser scenario](browser-check.mjs).
- [Existing form behavior proof](browser-check.json) and [its harness](form-browser-check.mjs): destination selection, native validation, credential retention, saved Test, scoped CSP, and no-JS behavior still pass.

Real Chromium renders the production routes, page, layout, service, and credential codec. The proof supplies a trusted local Admin, in-memory settings, and a controlled sender. It does not claim live production sign-in or remote delivery. The separate Collector gate uses isolated real TLS and OTLP. The manager and independent reviewer inspected the layout and native form behavior; no defect was found.

## Logs and history

[Ordinary suite](npm-test.log) · [focused tests](focused-tests.log) · [typecheck](typecheck.log) · [portal build](build-user-portal.log) · [Collector](collector-gate.log) · [self-hosted container](self-hosted-container.log) · [hosted image](hosted-image.log) · [hosted build](hosted-build.log) · [metrics process](metrics-process.log) · [CRAP](crap.log) · [habit-hooks](habit-hooks.log) · [API snapshots](api-surface.log).

The final worktree source was in place before the ordinary command began; creating the commit changed no executable input. Later checks and coverage are bound to the committed candidate. There was no follow-up test failure or retry. The layout browser scenario intentionally failed before the source edit, then passed afterward. The build-log lookup first used a qualified Buildx reference that the logs command rejected; the short build ID resolved it. That lookup did not affect the build or its tests.

[Prior PR prose](previous-pr-review.json) and [prior pinned evidence](https://github.com/tomer-mayara/Thermus/blob/0effcd80899b454c29356256645eaa08163e587d/ast-report/audit-destination-selector/README.md) preserve the earlier candidate, original BDD/TDD history, and earlier failure/retry records. Earlier results are historical. Current source, tests, screenshots, and quality evidence are linked above.

No production setting, legal-document byte, agreement record, or infrastructure resource changed. Existing None-auth destinations still need an explicit Bearer upgrade for any form Save, including disable, and before Test. The PR is not merged or deployed, and no earlier approval is reused.

GitHub reports no registered checks or statuses at this head. These local results are not a remote CI pass; see [remote check evidence](remote-checks.json).
