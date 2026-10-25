# Audit destination selector review

Candidate: `e77c075c3f8e37874dd89474e8a5f4f784f23e67`.
Base: `a7411fd02aa6dd3300b334d4585f71469071b499`.
Tested source commit: `0a695c8b4fa2b7c2bb948529a5dcbc4557cbbb68`.
Later commits change only two compatibility notes and the required immutable base metrics record. Source, tests, scripts, build configuration and dependencies are identical.

## Review decision

T1 Team review. The checker reports **T0: no architecture fact**, plus `impact.sensitiveBehavior` for the local credential form and its page-specific script permission. Its technical result is eligible with zero blockers. Overall merge remains blocked until an independent authorized team member or owner approves this candidate. Earlier rollout approval covered PR #248 and does not cover this change.

The browser page and its form parser belong to the same web owner. No separately supported portal or automation client consumes the private form payload. Adding this selector changes their local coupling, not a cross-container API or integration contract. Service input/output declarations, encrypted storage, sender calls and external protocol stay the same. Thus `contract`, `external` and `internalInterface` are false. No de-escalation or exception is used.

There are no policy questions from the checker. Its informational note, **48 public modules, 0 snapshots changed**, is verified by the API check. No new dependencies, skipped/todo tests, permitted metric exceptions, or forbidden edges were added. The checker counts 13 added and four replaced test declarations; the ordinary suite gains nine tests.

## Retained quality findings

The final metrics process completed all four stages: Delta and Review report goal misses; CRAP and Architecture pass. Its raw exit is 1 for the reviewed findings below, not a tool failure. The standalone CRAP command exits 0. The trusted PR policy permits these retained findings and the checker reports zero technical blockers.

| Existing production file | MI before → after | Disposition |
| --- | --- | --- |
| `src/interfaces/web/account/logging-form.ts` | 69.5 → 65.7 | Keep one ordered, short validation boundary. Each guard enforces a distinct input rule, after CSRF validation. A separate destination predicate was considered; for two fixed choices it would relocate a small invariant while adding indirection. No nested workflow or generic validator is needed. |
| `src/interfaces/web/account/logging-page.ts` | 72.6 → 69.0 | Keep the one form, its labels, field dependencies and fixed enhancement script together. The long explanation is removed. Splitting fragments would hide the relationship between selected type, required dataset and token guidance. |
| `src/interfaces/web/account/members-page-layout.ts` | 83.0 → 81.0 | Keep rendering and the matching style/script hashes in the same owner. The optional static script is enabled only for Audit; Members keeps its existing script denial. A new asset route or framework would add more structure than this small enhancement needs. |

All three files existed below MI 85 before this change; each drop is less than five. No new production file needs an MI exception. `members-style.ts` is constant CSS with no measured function/MI; manual browser checks verify its new warning style.

The high Review finding is the test-only `test/unit/html/logging-form.test.ts` MI change, 54.4 → 46.5. Its new cases cover the two-choice contract and invalid forms in one focused specification. Tests have no production MI goal. Retain the readable scenario tables and their explicit assertions rather than move them into generic test helpers. This is recorded, not called an unchanged finding.

The medium Review finding is `loggingForm` complexity, 13 → 16, for the explicit choice and dataset guards. It has 100% measured own-character unit coverage and CRAP 16.0, below the changed-function limit of 30. The report's one measured target miss refers to the optional 15 target on this changed function; the required new-function target does not apply to it. `loggingPage` has 98.4% coverage and CRAP 8.0; `membersPageLayout` has 99.8% and CRAP 7.0. `loggingNotice` is unchanged, 100% and CRAP 1.0. No changed function has unknown identity/coverage or a required goal miss.

Coverage is the verified ordinary unit selection: 3,071 emitted tests plus 29 portal tests. It was collected once on the final source and reused after the document-only metrics commit. Current-source and input identity checks passed. Global architecture bands retain unit-only coverage limits; base values derived from head coverage are estimates. The embedded JavaScript string is not a separately measured TypeScript AST function; the VM test and real Chromium checks verify its field-state behavior.

Habit-hooks exits 0 with 30 findings: one complexity finding, 24 test-only non-null assertions, four comments, and one long acceptance file. The per-file reasons in [implementation.md](implementation.md#habit-hooks-assessment) are accepted by the manager. Missing controls/routes/headers fail those tests; they do not create unchecked production paths. Comments explain tenant semantics, CSP ownership or test scope. The acceptance file remains one coherent protected form specification. `.habit-hooks/snooze.json` remains `[]`.

## Architecture and behavior review

All 13 registry Mermaid blocks are byte-identical to the base. Context, hosted containers, Audit settings/delivery, System/Audit ownership, runtime collaboration and deployment views remain accurate. Only the Audit web behavior prose changes. The source owner, component relationships, cross-component callable contracts, storage layout and process placement do not change. No L3 comparison drawing or L4 detail is needed. See [architecture-review.json](architecture-review.json) for the checked views and provenance.

The exact short notice retains its Privacy Policy link. Terms, Privacy, agreement bytes and prior acceptance records remain unchanged. This change uses the user's requested UI wording; it does not rewrite the immutable approved notice package.

Axiom requires a valid dataset; Custom excludes one. Both save Bearer credentials. Choice changes remain unsaved until Save, and Test refuses unsaved values. Blank tokens retain an existing Bearer credential only for the unchanged endpoint. Existing None-auth rows stay readable and continue their saved behavior. Every Save through the new form, including disabling export, needs a Bearer token upgrade; Test also requires that Save. This explicit compatibility limit is documented. The scoped rollout destination already uses Bearer; no live destination is changed by this PR. Old open forms fail closed and must be reloaded.

The script is fixed source with an exact CSP hash, not user-provided script. Only Audit pages receive that permission. Origin, CSRF, current Admin, trusted tenant, revision, no-store, escaping and token non-disclosure checks remain. No sender security or no-MFA rule changes.

## Independent and manager review

The implementation worker followed failing acceptance, focused failing form/page tests, green tests and refactoring. The independent reviewer inspected the complete source/test/document diff, no-JS behavior, runtime fixture changes, and real-browser evidence; it found no blocking defect. It separately reviewed the legacy None limitation and agreed that it is explicit and within the internal/test scope.

The manager reviewed all changed source, material test changes, both worker reports, desktop and narrow-screen images, full selected checks, metrics and architecture evidence. The browser harness uses production routes, form, layout, service and codec with a trusted local Admin fixture, in-memory store and controlled sender. It is not production authentication or destination delivery proof. No local test result supplies the required independent human approval.
