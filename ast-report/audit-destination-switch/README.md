# PR #249: Enable export On/Off switch

Candidate `d7e86ab12e292bcc780d2dfb8526262cbed884ca` against main `a7411fd02aa6dd3300b334d4585f71469071b499`.

Enable export now uses an accessible On/Off switch. On is orange; Off is gray. The control keeps its native field name, checked state, and submitted value. Pointer, label, and Space interactions work without JavaScript. Changes stay in the form until Save. The wider panel and gray secondary Test action remain intact.

## Review and results

All selected test gates passed: 4,759 backend and 49 portal tests, 10 Collector tests, 11 self-hosted container tests, and 7 Linux AMD64 hosted image tests. Typecheck and the portal build passed. The image also passed its required hosted build: 3,071 unit, 29 portal unit, 20 portal acceptance, 1,070 integration, 119 offline acceptance/interface, and 13 renderer cases.

- [Validation summary](validation-summary.json), [container gate execution](container-gates.json), [remote check evidence](remote-checks.json), and [final PR checker](check-final.json).
- [Quality review](quality-notes.md), [architecture assessment](architecture-review.json), and [implementation record](implementation.md).
- [Complete metrics process](../process.md), [machine process](../process.json), [review findings](../review.json), [CRAP](../crap.json), [base snapshot](../snapshot-base.json), [candidate snapshot](../snapshot.json), [verified coverage](../coverage.json), [capture manifest](unit-capture-manifest.json), and [bound impact](../impact.json).

T1 Team review remains required for the complete PR's credential form and scoped script permission. The switch adds no script, API, dependency, or architecture fact. All 48 public declaration snapshots and all 13 registry diagrams are unchanged. The checker has zero technical blockers. Its local result does not replace completed test gates or independent approval of this candidate.

The final quality process completes all four stages. Delta/Review report retained goal misses; CRAP/Architecture pass. Raw exit 1 is recorded, not hidden. Habit-hooks retains the same 30 findings with reasons and an empty snooze file. No new finding is caused by the switch. The narrow API emitter ignores unrelated diagnostics outside public modules; the full typecheck passes.

## Browser evidence

[On, desktop](green-on-1440.png) · [On, mobile](green-on-390.png) · [Off, desktop](green-off-1440.png) · [Off, mobile](green-off-390.png) · [On, narrow](green-on-320.png) · [Off, narrow](green-off-320.png) · [Keyboard focus](green-focus-off.png).

[Before results](red.json), [after results](green.json), and [executable scenario](browser-check.mjs) preserve the red/green acceptance. The proof covers 20 state/accessibility/form checkpoints, pointer/label/Space input, focus, no request or write before Save, exactly one Save, persisted reload, both stored states, and browsers with and without JavaScript. It verifies no horizontal overflow at 1440/390/320 pixels. The first implementation's decorative track intercepted a direct click; `pointer-events:none` fixed it. The failed attempt remains in [its log](green-first-attempt.log); no forced click or weaker assertion was used.

Chromium renders the real production page, routes, layout, service and codec, with a trusted local Admin, in-memory storage and a controlled sender. This is not a live production authentication or delivery claim. The independent reviewer and manager inspected the source, browser evidence and screenshots; neither found a blocking defect. The manager also updated the active plan's mock from a checkbox to Off.

## Logs and history

[Ordinary suite](npm-test.log) · [132 focused tests](focused-tests.log) · [typecheck](typecheck.log) · [portal build](build-user-portal.log) · [Collector](collector-gate.log) · [self-hosted container](self-hosted-container.log) · [hosted image](hosted-image.log) · [hosted build](hosted-build.log) · [metrics](metrics-process.log) · [CRAP](crap.log) · [habit-hooks](habit-hooks.log) · [API snapshots](api-surface.log).

All current executable inputs were committed before the broad checks began. Fresh unit coverage belongs to this exact head. The ordinary command completed its clean build before the hosted image gate started; both then read the final candidate. Dedicated Collector/container files ran after that clean build. No later command removed or rebuilt the shared output during their runs. The hosted image supplies its required hosted build; no duplicate standalone `check` or hosted build was added.

[Previous PR prose](previous-pr-review.json) and [previous pinned evidence](https://github.com/tomer-mayara/Thermus/blob/010c3391853d25de98313b264b35a6bfc362e8cd/ast-report/audit-destination-layout/README.md) preserve earlier review, BDD/TDD, failure/retry, and layout evidence. Earlier results are historical; current reports are linked above.

No production destination, legal document, agreement, or infrastructure setting changed. Existing None-auth destinations still need an explicit Bearer upgrade before any form Save, including disable, and before Test. The PR is not merged or deployed. No earlier approval is reused. GitHub reports no registered checks or statuses at this head; local results are not a remote CI pass.
