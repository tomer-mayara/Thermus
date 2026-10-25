# Quality review: Audit Save and Test

Candidate `4ae3cc7f950c53cc619c307159643b6771caff5a` against merge base `74f756562231fb6aafd6a87f4bbd0f02bc0a208e`.

## Tier and semantic impact

The checker selects **T2 Need architect** for `impact.internalInterface`, with T1 `impact.sensitiveBehavior` retained. Its generated architecture line is **T0: no architecture fact**: there are no mechanical component, dependency, public-module, declaration, registry-diagram, or decision-record facts. The declared runtime collaboration changes: the protected web Test action commits the form before the existing saved Test. A failed send leaves the settings saved; a failed or uncertain Save permits no send. This partial-success rule needs independent architect review. No human approval for this candidate is recorded.

The checker reports local eligibility with zero technical blockers. That result is preliminary and does not replace complete tests or human approval. Overall merge remains blocked pending independent architect approval and any unfinished validation. No de-escalation, metric exception, or policy waiver is used. No policy question is selected. Forty-eight public modules have current, identical declaration snapshots; thirteen registry Mermaid blocks are byte-identical. The active registry prose, plan, implementation record, and test inventory describe the changed flow. The approved legal package remains an immutable historical record.

The main PR comparison uses the manager-reviewed v4 L3 drawing. Its neutral arrows are retained runtime calls; only the web owner has changed meaning. It shows one hosted Node container and supporting PostgreSQL and destination peers. Source edges stay type-only web-to-audit. The service operation, credential protection, sender policy, database, and deployment keep their owners and contracts. `POST /logging/test` is the strongest changed callable; L3 and phase notes answer commit/send/recovery behavior, so L4 is omitted. See architecture/v4/review-notes.md and final provenance JSON for source links, diagram history, renders, and manager review.

## Metric outcomes and retained reasons

The final process completed every stage. Raw exit 1 reports Delta and Review goal misses; CRAP and Architecture passed. Standalone CRAP exited 0. No tool stage failed or lacked required evidence. Fresh complete unit coverage passed 3,077 backend and 29 portal tests. The final document-only metrics-record commit reuses this verified capture because every executable input is identical; final reports bind the final head.

| Existing production file | Base MI | Head MI | Retained reason |
| --- | ---: | ---: | --- |
| logging-routes.ts | 47.8 | 48.4 | The web owner keeps ordered method, origin, exact-form, tenant, capability and revision guards, and explicit Save/Test failure boundaries. Common POST validation removes the two repeated paths. Small helpers name save, test, recovery and rendering. Further splitting would spread the required phase order. |
| logging-page.ts | 69.0 | 65.4 | One server-rendered form owns labels, native validation, write-only token, fixed safe notice and no-form recovery. The form was separated from page layout, reducing loggingPage complexity from 8 to 5. New markup remains cohesive and browser-tested. |
| logging-test-page.ts | 71.8 | 70.4 | Fixed typed notice tables keep result mapping complete and prevent remote text or exception causes entering the UI. The short result functions have CRAP 2 and 1. |
| members-style.ts | N/A | N/A | A constant CSS template has no measured function/MI. The single notice style was reviewed in desktop/mobile browser renders. |

No new production file or production MI drop of five or more exists. No exception is required by the trusted policy. The high review finding is test-only MI 36.1 to 28.4 in logging-test-routes.test.ts. Keep its focused phase-order, refusal and typed-outcome cases together: the assertions make failures and side effects explicit, and production-file MI has no goal for tests. The medium finding is the new change method's 12 paths; each early return names a required boundary or phase decision, the body stays linear, and unit coverage is 100%, CRAP 12. Extracting guards merely to reduce the counter would obscure their order.

## Changed function assessment

All required added/changed functions meet their CRAP limits. No unknown identity, missing coverage, or unmeasured required function remains. Values below use the verified unit report; acceptance and browser evidence are separate. Base CRAP estimated with head coverage is not measured base coverage.

| Function | Change | Paths | Unit coverage | CRAP |
| --- | --- | ---: | ---: | ---: |
| LoggingRoutes.handlerFor callback | new | 12 | 92.8% | 12.05 |
| LoggingRoutes.change | new | 12 | 100.0% | 12.00 |
| destinationForm | new | 8 | 98.4% | 8.00 |
| loggingPage | changed | 5 | 100.0% | 5.00 |
| LoggingRoutes.readPage | new | 4 | 71.2% | 4.38 |
| LoggingRoutes.handlerFor | changed | 4 | 89.9% | 4.02 |
| LoggingRoutes.saveFailure | new | 4 | 100.0% | 4.00 |
| LoggingRoutes.page | new | 3 | 100.0% | 3.00 |
| LoggingRoutes.saveSettings | new | 2 | 93.1% | 2.00 |
| LoggingRoutes.testSaved | new | 2 | 95.3% | 2.00 |
| LoggingRoutes.refuse | new | 2 | 100.0% | 2.00 |
| loggingTestNotice | new | 2 | 100.0% | 2.00 |
| LoggingRoutes.readPage callback | new | 1 | 100.0% | 1.00 |
| loggingRequestNotice | new | 1 | 100.0% | 1.00 |

The unchanged keep method and constructor/path helper remain unchanged by this PR. Their existing responsibilities are bounded action capture and path construction.

## Habit-hooks disposition

The complete-candidate run finishes normally with raw exit 1, 27 findings, and an empty snooze file. No finding is suppressed.

- Three complexity findings: handlerFor's callback keeps current Admin authorization and safe error handling; change owns ordered form/security/Save/Test guards; the new acceptance failure table checks the distinct saved/unsaved/recovery outcomes. These are related responsibilities with explicit early returns or named cases, not mixed feature flows.
- Sixteen test-only non-null assertions: three in account-routes-logging.test.ts and thirteen in logging-routes.test.ts. These pre-existing test fixture accesses fail loudly when a known registered route is missing; this PR changes only the required expected result. Production paths use explicit refusal branches. Retain the focused fixtures instead of rewriting unrelated setup assertions.
- Two parameter-count findings: change accepts request, session CSRF, trusted context and action; page accepts notice, public settings, CSRF and tenant. Their provenance and lifetimes differ. Keep explicit private parameters rather than inventing a shared authority/state object. Page performs no authorization decision.
- Five comments retained: hosted-audit-journey-site identifies shared capture across public channels and the controlled page operation; audit-destination-test-probe identifies its store/access doubles and real routes, settings, codec and sender; logging-routes explains trusted access at this boundary, secret-bearing collaborator failures, and capture failure isolation. Each records a constraint or reason that names alone do not supply.
- One oversized test file: logging-test-routes.test.ts remains one cohesive route contract, with typed outcome tables and security/phase cases. Splitting by line count would scatter the shared contract and setup.

## Review and limits

The implementation worker, independent reviewer and manager inspected the final source and tests. The manager approved success, failure, uncertain-Save and mobile screenshots, plus the v4 diagram at 800 pixels. The final head differs from the independently reviewed source commit only by the immutable base metrics record; exact source, test and registry identity is pinned. No production defect remains from those reviews.

The API snapshot check passes all 48 modules. Its narrow emitter reports 33 ignored diagnostics in two files outside the public surface; the complete typecheck passes and no diagnostic is hidden from that check. Test case syntax counts are 10 added and 4 removed; replaced saved-only assertions now require Save-then-Test, and no behavior scenario or security assertion was discarded. No new skip/todo, forbidden edge, cycle growth, undeclared import, or stale snapshot exists.

The short Test result is a direct POST response. An explicit browser resubmission can repeat a synthetic Test when the Save is unchanged; a changed revision rejects the stale original POST. There is no automatic retry or exactly-once delivery promise. Complete validation results belong in Validation. Local/browser/Collector proofs do not claim live production sign-in, destination receipt, rollout, or human approval.
