# Object-oriented working principles

These principles combine two AI reviews informed by Robert C. Martin and Sandi Metz. Neither author participated in this review or endorses these documents. Apply these principles to new code and future refactors. The current Magumagu classes and proposed changes provide concrete examples, based on commit `68a8eda`, reviewed on 2026-10-11. They do not authorize implementation or claim that the refactor is complete. Follow [AGENTS.md](../../AGENTS.md) for repository rules and the [engineering plan](oo-refactoring-plan.md) for implementation scope and gates.

The independent [Martin proposal](review/martin-proposal.md) and [Metz proposal](review/metz-proposal.md), their [Martin review](review/martin-review-of-metz.md) and [Metz review](review/metz-review-of-martin.md), and the [discussion record](review/discussion.md) explain the reasoning. The unified documents supersede those drafts as the agreed direction. The manager signed off this documentation handoff on 2026-10-11 after reviewing both perspectives and checking local links and referenced test paths.

## Prefer objects with useful roles

Prefer class-based OO for domain roles that own information, enforce an invariant, or coordinate a lifecycle. A role can also be stateless when its behavior and collaboration give it a useful identity. Do not require a second implementation before introducing a class. Do require a clear explanation of its role and what clients no longer need to know.

For example, `CleanHtmlAdsAdblockRs` owns an ad engine and fulfills the `CleanHtmlAds` role. The pipeline asks it to `invoke` a context. The caller does not construct filters or choose cosmetic selectors. Its private `selectorsFor` should read its own engine rather than receive that engine as an argument. This is an ownership correction within an existing class, not a reason to introduce an engine-service framework.

The object/data distinction matters more than syntax. Martin's [Objects and Data Structures](https://blog.cleancoder.com/uncle-bob/2019/06/16/ObjectsAndDataStructures.html) distinguishes objects that hide representation from records that expose data. Metz's [discussion of roles and messages](https://sandimetz.com/blog/2018/21/what-does-oo-afford) supports collaborators that ask for work through useful messages. Apply these ideas by examining the knowledge a client must carry, not by counting classes.

## Put knowledge and decisions with their owners

A client should request an answer from the collaborator that owns the facts. It should not fetch several mutable maps and reconstruct that answer. The proposed `SourceHtmlDocument` owns source-element associations, adopted token locations, text ranges, and decoded style values. It supplies `sourceElement`, `textRanges`, `styleSources`, and `elementTagRanges` through a `parse` factory.

These queries describe source facts. They do not call those facts visible or removable. `HiddenHtmlScanner` owns visibility and deletion policy, including whether a visible parser-created copy keeps a shared authored tag. Keeping this distinction prevents the source object from acquiring scan policy and prevents the scanner from depending on map layout. Source intervals and decoded values can remain result records. They must not expose a path to mutate private source maps.

Preserve existing parser distinctions. Ad-source recovery and visibility-source recovery have different behavior contracts. A universal parser facade would hide differences that callers need to preserve. Keep authored source identity separate from parsed-node identity, and UTF-16 source offsets separate from UTF-8 input-size measurements.

## Make lifetime part of the design

State belongs to the operation that needs it. An ad engine lives with its cleaner. Parsed source knowledge lives with one parse. CSS provenance, accumulated removal counts, warning maxima, and threat reasons live with one sanitizer invocation. A prepared DOM, extraction options, URL, and code marker live with one conversion.

The proposed `HiddenHtmlRemovalSession` is constructed inside each invocation after control sanitation. Reusable pipeline steps must not store that session's reports or provenance. Concurrent invocations must remain independent. `CssVisibilityProvenance`, `HtmlTextSourceRanges`, and `HiddenHtmlRemovalCounts` already show useful state ownership; retain those roles.

The proposed `PreparedHtmlDocument` owns preparation and the concrete Defuddle call. Its `extract(sanitizeText)` message returns finished content and title. The caller no longer coordinates a mutable options record with a marker-finishing closure. Keep both preparation-time and extracted-DOM sanitation observable in tests. Do not add an extractor strategy framework without a current role need.

## Keep functions, closures, and records on purpose

A class preference is not a ban on functions. Martin's [Functional Classes](https://blog.cleancoder.com/uncle-bob/2023/01/18/functional-classes.html) supports cohesive behavior with encapsulated data and rejects mandatory wrappers for operations such as mathematics. Keep pure calculations such as `comparePrecedence` and source-line expansion as functions when they have no lifecycle to protect. Free functions can also have clear, bounded effects on supplied data. For example, `normalizeDeclarations` changes the supplied AST, selector predicates can charge a shared work budget, and `plainTextMarkdown` calls a sanitizer that can collect reports. Document those effects; do not describe every retained helper as mathematically pure.

Keep useful closures. The fetcher's request closure already isolates child-process, timer, and completion state. The style serializer closure gives its caches one resolution lifetime. A class replacement needs a concrete benefit beyond different syntax. Boundary records such as `Ctx`, source ranges, findings, and extraction results remain data contracts. An object does not need to hide every value it returns.

Conditions are also legitimate. Parser branches and uncertainty checks do not automatically require subclasses or polymorphism. Prefer a narrow interface when existing collaborators need a role boundary. Do not introduce interfaces, factories, or inheritance merely to make all modules look alike.

## Change one responsibility with evidence

Separate source recovery, visibility policy, pass coordination, and extraction coordination because each has distinct knowledge and reasons to change. Keep the existing `Step.invoke` collaboration instead of adding a second pipeline framework. A change should reduce the number of clients that must understand a representation or sequence.

Keep `RuleContext` and `applyRule` local for now. A proposed `CssVisibilityCascade` becomes useful when multiple clients, separately invoked operations, or an externally coordinated lifecycle expose its state. The present private context has one small local collaboration. Module length alone does not establish a class need. Defer fetch lifecycle objects and dependency-patch mathematical objects to separate work with their own specifications.

Follow DRY3: introduce shared behavior after the third copy, not before. Similar range operations can have different overlap, replacement, line-expansion, and counting rules. Metz's [wrong abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction) explains why forced sharing can increase change cost. Preserve those differences until a common contract is demonstrated.

## Specify and verify behavior before restructuring

Use BDD acceptance specifications first, then TDD for the new contracts and behavior those specifications need. For a behavior-preserving refactor, establish passing characterization coverage; do not make an unchanged acceptance case fail artificially. For a new contract, write a failing test, implement the smallest useful step, and refactor with tests green.

Use the exact test roles in AGENTS. Unit tests focus on behavior in one Delamain package, replace other packages at public interfaces, allow real collaboration inside that package and type-only public-contract imports, and remain independent. Integration tests exercise real collaboration between two or more Delamain packages through public interfaces, even in one process. Interface tests are few and limited to one public interface or data contract, including inputs, outputs, formats, events, and errors. Acceptance tests give executable user specifications through public interfaces in an environment similar to production. Package boundaries and purpose determine type; pipeline stages and speed do not.

Test observable outcomes and useful messages. Preserve source spelling, parser distinctions, limits, failure ordering, warning strings, counters, findings, and request isolation. Do not freeze private method sequences unless they affect an observable result. Run each changed test and the relevant local suites. Unrelated live-renderer tests and new fetch concurrency scenarios are not mandatory work for source-only refactors. The [engineering plan](oo-refactoring-plan.md) identifies affected verification and current draft, Ready, Actions, and merge gates. Required checks must be green before merge; resolve the absent referenced test-gate policy during implementation handoff.
