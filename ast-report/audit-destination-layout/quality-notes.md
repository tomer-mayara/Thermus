# PR #249 quality review: wider Audit layout

Candidate `17085397bb0ce9af62d69bffe6a314513f277f7f` against main `a7411fd02aa6dd3300b334d4585f71469071b499`.
This version replaces the review of `e77c075c3f8e37874dd89474e8a5f4f784f23e67`.
The [previous pinned evidence](https://github.com/tomer-mayara/Thermus/blob/0effcd80899b454c29356256645eaa08163e587d/ast-report/audit-destination-selector/README.md) preserves the original BDD/TDD steps, failed attempts, and review history. Those test results are historical; current results are in this folder.

## Scope and review

The complete candidate replaces the long Audit explanation with the requested warning, introduces Axiom/Custom choices, requires an Axiom dataset, and accepts Bearer credentials through the form. The follow-up only widens the Audit panel and groups Save with a gray Test button. No new input rule or script permission was added by the follow-up.

T1 Team review still applies because `impact.sensitiveBehavior` is true for the complete candidate's credential form and script permission. The generated architecture summary is `T0: no architecture fact`. The paired page and parser are inside web; they are not a separately supported client protocol. The service, store, sender, public declarations, and System/Audit ownership stay unchanged. No policy question or metric exception applies.

The manager reviewed the source diff, current plans, real Chromium measurements, and desktop/mobile images. The independent reviewer found no defect. The Audit selector overrides the shared tablet cap without changing Members. Save remains the first submit button. Test stays inside the same form and retains its action and formnovalidate attribute. Test text contrast is 8.52:1 normally and 6.34:1 on hover; its border is 3.91:1 against the card. The existing focus outline remains visible. No new JavaScript or abstraction is needed.

The panel fills the shared content width, up to 1,200 pixels. Save and Test keep their natural widths with a 12-pixel gap. They share a row at 390 pixels and above; at 320 and 240 pixels they wrap without clipping. The browser proof preserves both the before and after measurements. This small layout change adds no unit test that merely repeats CSS values; the observable browser acceptance is red before and green after.

## Metrics and retained findings

The final process completed all four stages. Delta and Review report goal misses; CRAP and Architecture pass. Raw process exit 1 is a recorded goal result, not a tool failure. The standalone CRAP command exits 0. These scores and findings are unchanged by the layout adjustment.

| Existing production file | Base MI | Candidate MI | Disposition |
| --- | ---: | ---: | --- |
| logging-form.ts | 69.5 | 65.7 | One short, ordered boundary keeps CSRF-first checks and explicit refusal guards visible. |
| logging-page.ts | 72.6 | 69.0 | Keep form markup, labels, and field dependencies together; fragments add indirection. |
| members-page-layout.ts | 83.0 | 81.0 | Markup and matching CSP hashes have one owner. Members keeps script denial. |

`members-style.ts` is constant CSS with no measured function or MI. No production-file drop reaches five, and there is no new production file. No MI exception is required.

- `loggingForm`: changed, 16 paths, 100% coverage, CRAP 16. The medium complexity finding is retained for the ordered refusal rules. This is below the changed-function limit of 30; the strict 15 target applies to new functions. A private selector predicate was considered and rejected as extra indirection for two fixed cases.
- `loggingPage`: changed, 8 paths, 98.5% coverage, CRAP 8.
- `membersPageLayout`: changed, 7 paths, 99.8% coverage, CRAP 7.
- `loggingNotice`: unchanged, 100% coverage, CRAP 1; unchanged by this PR.
- High test-only finding: `logging-form.test.ts`, MI 54.4 to 46.5. Keep the focused invalid-form scenario tables. Tests have no production MI goal. Generic test helpers would make the required inputs and outcomes harder to read.

There is no required unknown function identity, unknown coverage, CRAP limit failure, or metric exception. Unit-only architecture bands retain unmeasured and unchanged-function limits. Base CRAP derived from candidate coverage is an estimate. The embedded script string is not a separate TypeScript AST function; VM and Chromium verification cover it.

## Habit-hooks

The current branch scan exits 1 with the same 30 advisory findings and no tool failure. The snooze file is `[]`. The per-file reasons in the [original implementation review](https://github.com/tomer-mayara/Thermus/blob/0effcd80899b454c29356256645eaa08163e587d/ast-report/audit-destination-selector/implementation.md#habit-hooks-assessment) still apply:

- One form-complexity finding: the explicit boundary and its measured coverage are explained above.
- Twenty-four test-only non-null assertions: eight required DOM/header lookups, thirteen known route/header lookups, and three Set-Cookie checks. Missing values fail the tests; no production unchecked path is added.
- Four comments explain the tenant field's legacy name, CSP ownership, or controlled test boundaries and evidence scope. They state reasons that the code alone does not establish.
- One long acceptance file remains a cohesive specification for the protected settings page. Splitting it at a line-count threshold would duplicate scenario-specific setup.

## Architecture and compatibility

All 13 Mermaid blocks are byte-identical to main. All 48 public declaration snapshots remain current. The checker note about unchanged public declarations needs no further change. Context, hosted containers, Audit settings/delivery, System/Audit ownership, runtime collaboration, and deployment remain accurate. The registry's existing prose covers the form; the plan and implementation note describe the new width and action row. No comparison drawing or L4 detail is needed because no production component relationship or public callable contract changes.

Existing None-auth rows remain readable and continue their saved behavior. Every Save through this form, including disabling export, needs an explicit Bearer upgrade; Test needs that Save first. This is the previously reviewed compatibility limit. Current saved Bearer credentials can remain blank only for the same endpoint. Old open forms must be reloaded. No legal-document bytes, agreement record, production destination, or infrastructure setting changed.

Browser checks use a trusted local Admin fixture, memory storage, and a controlled sender. They prove the actual page and form interaction, not live production sign-in or remote delivery. The separate Collector checks provide isolated TLS/OTLP coverage.

Independent agent review and manager review are technical evidence. Merge still needs independent authorized owner/team approval of this exact candidate. Neither earlier PR #248 approval nor approval of an earlier #249 candidate applies.
