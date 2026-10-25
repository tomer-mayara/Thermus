# PR #249: export switch quality review

Candidate `d7e86ab12e292bcc780d2dfb8526262cbed884ca` against main `a7411fd02aa6dd3300b334d4585f71469071b499`.
This version replaces the review of `17085397bb0ce9af62d69bffe6a314513f277f7f`. The [previous pinned evidence](https://github.com/tomer-mayara/Thermus/blob/010c3391853d25de98313b264b35a6bfc362e8cd/ast-report/audit-destination-layout/README.md) and `previous-pr-review.json` preserve that candidate and its review. The original selector BDD/TDD history remains linked from those records.

## Scope and technical review

The complete PR adds the short warning, Axiom/Custom choice, Axiom dataset validation, Bearer-only form writes, wider panel, and secondary Test action. This follow-up changes Enable export from a visible checkbox to an On/Off switch. It keeps the same native checkbox, name, checked state, and submitted value. It adds no script, hidden state field, API, or automatic Save.

The manager and independent reviewer found no defect in the final increment. Pointer clicks, label clicks, Space, focus, stable accessible name, switch role, and checked state are verified in Chromium. The decorative track and On/Off text are hidden from the accessibility tree. CSS alone reflects native state. The label is a 48-pixel-high click target. The visual track has a distinct keyboard-focus outline. Native field serialization remains `enabled=on` when checked and absent when unchecked.

The form sends no request and writes no setting while the switch changes. One Save persists the new state; reload then shows it. The proof covers both stored states and both JavaScript-enabled and no-JavaScript browsers. The switch fits at 1440, 390, and 320 pixels, with the wider panel and action row intact. Styles only target `logging-switch` classes, so Members controls keep their existing appearance.

The browser acceptance first failed against the previous checkbox. The first implementation then exposed a real pointer interception by the decorative track. Adding `pointer-events:none` to that decoration fixed it; the same direct input click passed without force or a weakened assertion. Both failed attempts are retained. No permanent test was added merely to repeat CSS or markup; the observable browser proof and existing focused tests cover this low-impact presentation change. The manager also updated the plan mock to show Off.

## Review tier and architecture

T1 Team review remains required for the full candidate's `impact.sensitiveBehavior`: the credential form and its scoped script permission. The switch adds no new sensitive behavior. The generated architecture summary is `T0: no architecture fact`. `contract=false` remains appropriate for the paired private page/parser, with no separately supported client protocol change.

All 13 registry Mermaid blocks are unchanged; all 48 public declaration snapshots are current. This is the checker's only informational note. Context, containers, Audit settings/delivery, System/Audit ownership, runtime collaboration, and deployment remain accurate. The active plan, its mock, and current implementation note describe the switch. No registry edit is needed for this CSS-only change.

There is no new component, dependency, public module, container, or deployment relationship. No L3 comparison drawing is needed. The strongest callable detail in the whole PR remains the private layout's optional fixed-script argument; the owner and exact-hash notes explain its Audit-only use. L4 would add no required information. The switch changes no callable contract.

## Metrics and retained findings

The current process completes all four stages. Delta and Review report retained goal misses; CRAP and Architecture pass. Raw process exit 1 is a goal result, not a tool failure. Standalone CRAP exits 0. The switch changes none of the scores or findings; page coverage is now 98.6%.

- `logging-form.ts`: existing MI 69.5 to 65.7. Keep the short CSRF-first boundary with explicit refusal guards. Its medium complexity finding, 13 to 16, reflects those rules. Coverage is 100%, and CRAP is 16, below the changed-function limit of 30. The strict 15 target applies to added functions. A separate selector predicate was considered but adds indirection for two fixed choices.
- `logging-page.ts`: existing MI 72.6 to 69.0. Keep the form, labels and field dependencies together. CRAP is 8 at 98.6% coverage.
- `members-page-layout.ts`: existing MI 83.0 to 81.0. Markup and matching CSP hashes have one owner. CRAP is 7 at 99.8% coverage; Members keeps script denial.
- `members-style.ts` is constant CSS, with no measured function or MI. Browser state, layout, and focus checks cover the new control.
- `loggingNotice` is unchanged, with 100% coverage and CRAP 1; unchanged by this PR.
- High test-only finding: `logging-form.test.ts`, MI 54.4 to 46.5. Retain the focused invalid-input tables. Tests have no production MI goal; generic helpers would hide the inputs and outcomes.

No production-file MI drop reaches five, no new production file is added, and no required function has unknown identity or coverage. No CRAP limit fails and no metric exception applies. Fresh unit coverage is bound to this candidate. Base CRAP with candidate coverage is an estimate; global unit-only architecture bands retain their measurement limits. The embedded script is not a separate TypeScript AST function; VM and browser proofs cover it.

Habit-hooks returns raw exit 1 with the same 30 findings and no tool failure; snooze stays `[]`. One form-complexity finding is covered above. Twenty-four test-only non-null assertions name required DOM/header/route values and fail if those are missing. Four comments explain the tenant field's legacy name, CSP ownership, or controlled test boundaries. One long acceptance file remains a cohesive settings-page specification; splitting it only by line count would duplicate its setup. The [per-file reasons](https://github.com/tomer-mayara/Thermus/blob/0effcd80899b454c29356256645eaa08163e587d/ast-report/audit-destination-selector/implementation.md#habit-hooks-assessment) remain applicable.

## Limits and approval

The browser proof uses real page/routes/service/codec with a trusted local Admin, memory storage and controlled sender. It does not prove live production sign-in or delivery. The separate Collector gate supplies isolated real TLS/OTLP evidence. Existing None-auth rows still require an explicit Bearer upgrade before any form Save, including disable, and before Test. That earlier compatibility limit is unchanged. No production destination, legal-document byte, agreement, or infrastructure setting changed.

The current checker has zero technical blockers. Agent and manager technical reviews do not replace independent authorized owner/team approval of this exact candidate. No previous approval or exception is reused; merge remains pending human approval after all selected gates pass.
