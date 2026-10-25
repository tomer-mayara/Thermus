# S2-04 metric dispositions

Initial status: 2026-10-25T00:19:59.572101+00:00. No final metric,
CRAP, process, or eligibility pass is claimed. No source, tests, exceptions,
baseline, or rules were edited, and no build or metric command was run by this
reviewer. The existing authorized scope for justified goal misses is retained;
this note does not authorize a new exception or waive missing required evidence.

Base: `845cec3060b0880cd27c36047f1da57a1c3772ba`; the native report identifies local
HEAD `a7bdf1f32bb2d67e87d85ea03a701078ec04808b` while analyzing the working tree.
Source/test files still match `architecture/v3/candidate-manifest.json`. The
manager's later ledger-only MCP baseline does not change these measured files.
Final committed-head provenance will be stamped separately.

Inputs retained:

- `metrics-review-initial.log`: one high and eight medium regressions, with the
  native gate reported failed. Its status is preserved, not relabeled a pass.
- `metrics-review-initial.json`: a copy of `ast-report/review.json`, SHA-256
  `9b09e02f6810bceb05064ae2ca23910c2d9b360a17f0fd06c6796cad60c6f9d0`.
- `metrics-delta-initial.log`, SHA-256
  `bfa00b1ff30e2906fe8133921ae2af02e9faf0787fa979caa3edb9b0a9b3efcc`:
  ten of eleven measured production files below 85; five files not measured.

The repository's [metric guide](../../docs/implementation/ast-metrics-review.md)
states that test/support files have no MI goal and that a retained high finding
or an MI drop on an existing file is a review note with a reason. This does not
change the native tool's failed result or replace final required evidence.

## Initial high finding

**Retain:** `test/integration/logging/audit/logging-storage-export.test.ts`,
MI 43.7986 → 37.9115, displayed 44 → 38. This is a test file, so the production
MI 85 goal does not apply and no MI exception entry is needed for it.

The added short integration scenario closes the independent review's actual
forwarding gap. It uses real composition, settings service, credential codec,
and collector. It holds the first old-dataset send, queues an old-revision event,
saves only a dataset change, then checks that stale queued work is dropped and
the current event reaches the sender with the new dataset. The in-flight event
may finish at its already-authorized destination. Cleanup settles owned attempts
and closes the composed runtime. This sequence must stay visible as one oracle.

The other case in the file proves the shared Test/export sender cap through
uncancellable DNS and physical settlement. Both cases check the same composition
and lifetime boundary. Splitting assertions, hiding the event sequence in a DSL,
or moving the new case just to raise file MI would obscure the verified behavior.
No tangled production responsibility or actionable simplification was found.
Keep this high finding and its reason in Quality review; do not remove it from
the report or refresh the baseline to hide it.

## Eight initial medium findings

| Finding | Specific retained reason |
| --- | --- |
| `src/accounts/providers/workos/workos-organization-audit-documents.ts`, 346 lines > 150 | One exact-byte static legal bundle keeps purpose, versions, Terms, Privacy, and unchanged agreement consistent. It has one validation call and literal data, not 346 lines of branching program logic. Exact-byte contracts and production-composition assertions protect its contents. String assembly or arbitrary file splitting increases review risk without reducing code complexity. Approval remains separate. |
| `loggingForm`, `src/interfaces/web/account/logging-form.ts:6`, CC 11 → 13 | The short form boundary now reads one optional field and refuses duplicates while preserving the existing exact-field/CSRF, checkbox, tenant, revision, and auth checks. Optional input parsing belongs here; semantic dataset validation remains in the service. The added guards have distinct refusals and no nested workflow. |
| `DestinationSettingsService::authorizeExport`, `:46`, CC 10 → 11 | One current saved version still supplies enabled state, expected revision, endpoint, credential, and now optional dataset. The extra decision projects that same saved field; it adds no new lookup or provider branch. Keeping cancellation and version checks adjacent to the returned destination makes its authority visible. |
| `DestinationSettingsService::save`, `:101`, CC 13 → 14 | The optional dataset joins the same validated atomic Save. Current revision, token retention/encryption, and confirmed/conflict/unconfirmed outcomes stay together. Extracting just the optional property would not reduce the invariant or simplify failure handling. |
| `DestinationSettingsService::testSaved`, `:67`, CC 14 → 15 | The extra decision passes the saved dataset to the existing sender. Pre-send saved-field/revision checks and post-settlement revision confirmation must remain clear: Test does not save or enable, and a concurrent change suppresses its result. There is no new state machine to split out. |
| `invalidInput`, `destination-settings-service.ts:139`, CC 11 → 15 | Explicit type, blank-option, length, and ASCII checks protect persisted settings and header construction. One early-return validator keeps the named settings/endpoint/dataset/token causes together. A validation framework or combining guards to lower a counter would hide rather than remove required decisions. |
| `parseAuditDestination`, `src/logs/audit/public-audit-destination.ts:24`, CC 13 → 17 | The transport boundary independently checks optional dataset type/ASCII/length before DNS and TLS. Direct sender callers must not rely on the Admin service having run first. These guards complement the existing URL/auth checks; they add no provider selection or arbitrary header support. Keep this bounded fail-closed boundary visible. |
| `DestinationSettingsFake::save`, `test/support/doubles/logging/destination-settings-fake.ts:15`, CC 9 → 10 | The fake must compare every persisted field, including dataset, to model semantic no-op and revision changes. Explicit equality avoids JSON-property-order dependence. It remains one small atomic in-memory Save with a named uncertain-commit switch, not a second persistence framework. |

`DestinationSettingsService` paths in this table refer to
`src/logs/audit/destination-settings-service.ts`.

## Ten existing production MI goal misses

These are initial measured scores, not passes. Each path already exists at the
base; the justification below is its current responsibility and actual delta,
not its presence on main. Existing exceptions and authorized retained-goal scope
are unchanged. Final exact values, applicable exception use, CRAP and checker
status remain manager-owned; a displayed rounded value is not an exception bound.

| Production file | MI | Specific retained reason |
| --- | ---: | --- |
| `src/logs/audit/destination-settings-service.ts` | 39.7 | Read, atomic Save, saved Test, and fresh export authorization share trusted tenant/revision and credential rules. The only new behavior is one optional saved routing field, with unchanged encryption/lifetime authority. The validation and outcome guards are deliberate; medium-function reasons above apply. A second service or per-field helper layer would spread this invariant. |
| `src/interfaces/web/account/logging-routes.ts` | 47.8 | One protected browser boundary retains current Admin, Origin/CSRF, trusted tenant, cancellation, safe notices, and best-effort action capture. This delta only adds dataset to the invalid-settings help. Save and Test remain distinct operations; their two guard sequences do not justify a new dispatch/parser framework under DRY3. |
| `src/logs/audit/pg-destination-settings-store.ts` | 53.6 | Compact parameterized SQL preserves tenant selection, expected-revision CAS, semantic no-op, conflict, and unconfirmed writes. The nullable dataset is added consistently to columns, equality, parameter lists, and row mapping. Keeping those pieces adjacent makes SQL/contract alignment easier to audit; splitting constants or each field mapping would obscure it. |
| `src/app/hosted-workos-application.ts` | 56.2 | The composition root owns provider/portal construction, shared capture, optional lazy storage, and ordered cleanup. The change selects a different frozen document bundle without adding branches or a provider dependency. Moving a document import into a factory would add indirection, not simplify construction or ownership. |
| `src/logs/audit/public-audit-destination.ts` | 58.1 | URL/auth/dataset checks, all-answer public-address policy, and pinned peer comparison form one outbound destination boundary. Header validation must also protect direct sender calls. Its explicit guards reject distinct unsafe inputs before network work; splitting each guard does not remove those rules. |
| `src/logs/audit/otlp-audit-request.ts` | 60.0 | One request owner uses an already-verified socket, builds fixed headers, bounds the response, and maps settlement/cancellation safely. The change adds only the explicit dataset header. A new request/client abstraction would hide the no-global-agent rule and cleanup; callbacks remain short. |
| `src/logs/audit/otlp-audit-sender.ts` | 64.4 | The sender owns synchronous preparation, clearable body/auth/dataset state, bounded admission, safe outcomes, caller timeout, and physical native settlement. Dataset metadata follows that existing holder and is cleared with it. Moving these fields or counters across owners would make retained-work accounting harder to verify. |
| `src/interfaces/web/account/logging-form.ts` | 69.5 | One native-form parser maps an optional dataset and checkbox alongside shared exact-field/CSRF validation. It rejects duplicate fields rather than choosing an ambiguous value. These input guards are cohesive and are separately followed by service validation; no third duplicated parser behavior calls for an abstraction. |
| `src/interfaces/web/account/logging-test-page.ts` | 71.8 | Two exhaustive typed lookup tables map operation and sender outcomes to safe notices. This delta changes Collector wording to Destination while retaining status codes and Test's limited meaning. Moving each message into another owner would spread one small presentation contract without reducing decisions. |
| `src/interfaces/web/account/logging-page.ts` | 72.6 | One escaped native form keeps visible saved settings, hidden revision/CSRF fields, a write-only token, dataset control, and concise help together. The new routing field and notice text belong to that page. Fixed legal/help prose contributes volume but not independent program responsibilities; per-control markup helpers would obscure labels and token absence. |

## Initial simplification and limits (historical)

No new structural refactor is recommended from these initial findings. The full
authorized destination construction occurs twice, in Test and export, below the
DRY3 threshold for a shared operation. Save input, persisted SQL fields, and
public token-free projection have different contracts. Similar optional-field
spreads do not establish a new owner. Dataset syntax is checked at two independent
trust boundaries, and the HTML pattern has browser-specific escaping; a common
validation framework is not justified by three textual forms.

The new static bundle, CSS constant, and type-only store contract are listed as
not measured in the initial delta. This is not a score of 85 or a final metric
pass. The bundle's literal-data reason above covers the volume finding; review
its callable validator through the existing owner and exact-byte tests. No new
MI or CRAP exception was added. Final CRAP has not been assessed in this note:
any changed/added function miss or unknown identity/coverage must be evaluated
from the final compatible capture, with only the applicable permitted exception
and approval process. Do not edit coverage or mechanically extract functions
to change reported identity or scores.


## Complete source analysis at 185e372a

The clean-candidate process completed all four sections against base
`845cec3060b0880cd27c36047f1da57a1c3772ba`, head
`185e372a85dc749a36a0b058151d960d0c4f71da`. Exit 1 means retained goal misses:
Delta, Review and CRAP report goal miss; Architecture passed. This is a completed
analysis, not an unqualified metric pass. The earlier dirty-tree Delta tool
failure and unavailable following sections remain in `metrics-precommit-failed.*`
and `metrics-precommit.log`; no coverage had started in that failed attempt.

The archived complete process is `metrics-source-185e372a-process.json` and
`metrics-source-185e372a-process.md`; its native review is
`metrics-source-185e372a-review.json`. The initial one-high/eight-medium findings
and all ten production MI values above are unchanged in this completed analysis.
`audit-send.ts` is 111.8. There are 23 other measured files without a production
MI goal and five not-measured paths: two declaration snapshots, the static legal
bundle, the CSS constant and the type-only store contract. None receives an
invented passing MI score.

Verified version-3 unit coverage was captured at 185e372a, with both complete unit
parts selected. Its comparison identity is source
`92f0919104c68e7ab4e5d045b5cbc4cac62518c96d0db2f385aafe29952240b1`, inputs
`29911da484bbda9fcfe5e69dc590dae36a7ac322fb3c7a6d1108edac88b69482`, Node
24.20.0, TypeScript 7.0.2, `own-characters-1`, suite `unit`. Capture ID:
`14c8338ba7ac155d79fa80b84065593d7a0b63015edf85eb914150d71ae8ede1`.
The coverage report is not edited or relabelled as captured at a later commit.

The complete CRAP table reports zero known limit violations, two measured target
misses, three unmeasured functions, and two required unknown assessments. The two
measured target suggestions are changed functions: `parseAuditDestination`,
17 paths, 92.4% coverage, CRAP 17.1; and `DestinationSettingsService.testSaved`,
15 paths, 97.7%, CRAP 15.002737575. Both satisfy their applicable strict goal below
30. The optional target-15 advice does not make either a new-function miss.
Other measured new functions meet 15; other measured changed functions meet 30.
The table's one unchanged unknown hosted-application closure is unchanged by this
PR and creates no new required goal.

### Required unknown rows and valid bounds

- `src/logs/audit/otlp-audit-request.ts#requestAuditExport`: changed, one path,
  source coverage unknown. The emitted function reports ten calls and share 1,
  but has no source identity. That does not establish the source function's
  measured share. Its callbacks have separate identities and assessments.
- `src/logs/audit/pg-destination-settings-store.ts#(anonymous)`: conservatively
  new, one path, coverage unknown. This is the line-48
  `close: () => runtime.close()` closure. The entire factory is byte-identical
  at base and 185e372a, SHA-256
  `0a73f7b2b4745912f9ef319420ad1504ed1f7deb9a5c0ce0ee03beca7d669113`.
  The closure moves from source coordinates [3148,3169] to [3342,3363], and its
  object owner moves from @3091 to @3285. Anonymous functions have no named
  declaration key; the same body/signature also occurs in BetterAuth's close
  closure, so the global unique-body matcher cannot pair it. The stricter new
  classification is retained. Unit coverage did not call this factory and has
  no separate emitted close entry; no measured share is claimed.

For either one-path row, CRAP is bounded by [1,2] even at zero coverage.
`script/pr-review/README.md` and the playbook explicitly permit bounds that prove
a goal. The checker's `crapOutcome` calls `crapAbsoluteOf`: its upper bound 2
proves both at-most-15 and below-30, so it emits `pass from the bound [1, 2]`.
No new exception key, bound entry, test, source refactor or coverage edit is
needed. This does not change the process table's conservative unknown status or
exit 1. Final standalone JSON must retain one path and no fabricated share;
the final checker must confirm the bound result.

### Final candidate still requires its own evidence

The final head is `85206b1c22dab78e8379d7a10e2f2b9ac31af9c6`, after generated
metric history. Final snapshot/process with compatible coverage reuse, standalone
CRAP, declarations and checker are manager-owned. Runner 83166 was active when
this note was prepared; no final checker pass is claimed. The exact 185e372a
capture and its limits remain visible. No exception was added by this reviewer;
existing applicable exception use and every checker note must be recorded from
the final result. An operational failure or missing evidence cannot use an
exception. Required current-head human architect approval remains pending.


## Final committed checker result

Final snapshot/process reuse, standalone CRAP and checker now name
`85206b1c22dab78e8379d7a10e2f2b9ac31af9c6` against base
`845cec3060b0880cd27c36047f1da57a1c3772ba`. The final process still records
Delta, Review and CRAP goal miss, with Architecture passed; the raw process and
standalone CRAP exit-1 results remain. The final checker `ast-report/pr-review.json`
reports local `eligible`, T2 Need architect, no blockers, and explicitly passes
both unknown-coverage one-path rows from bound [1,2]. No exception is used.
The high test finding is outside production scope; there are zero findings on
unchanged files. This resolves the pending checker assessment, not the pending
independent human architect approval or operational release holds. Local
eligibility is preliminary and does not prove that all required human decisions
and live release checks are complete.
