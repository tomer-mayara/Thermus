# Independent proposal: a Martin-informed object design

This is an AI analysis informed by Robert C. Martin's published work. It is not written by Martin and does not claim his endorsement. It is a proposal for discussion, not adopted repository policy. The aim is to make state ownership clear while preserving the HTML cleaner's observable behavior. The review baseline is Git commit `68a8eda`, dated 2026-10-11. No implementation is authorized by this document.

## Durable principles

An object combines a narrow behavior with the data that behavior must protect. A data record exposes values for other code to use. Both are useful. Martin's [Objects and Data Structures](https://blog.cleancoder.com/uncle-bob/2019/06/16/ObjectsAndDataStructures.html) describes this distinction. Do not make a class for each record, or expose an object's private representation through a result record.

Martin's [Functional Classes](https://blog.cleancoder.com/uncle-bob/2023/01/18/functional-classes.html) supports cohesive, narrowly defined functions that operate on encapsulated data. It also criticizes mandatory class wrappers for operations such as mathematics; a namespace can be appropriate. Thus, this proposal does not prohibit free functions. The useful question is whether a caller must coordinate private state or know how an object works.

Prefer a class when a domain role must protect state or coordinate a lifecycle across several operations. Require a specific benefit before replacing a useful closure or pure function. Assign one reason to change to each role. Parser source recovery, CSS cascade policy, removal-pass policy, and Markdown extraction have different reasons to change. Their boundaries should express those roles. Keep each boundary small. Use dependency inversion at an actual external or policy boundary, not at every local method. Prefer the existing `Step` interface to a second hierarchy of pipeline classes.

Keep identity and lifetime explicit. An ad engine lives with its cleaner. CSS provenance lives through one sanitizer invocation. Source mappings live with one parsed document. Extraction markers live through one Markdown conversion. None should become shared mutable service state.

Preserve [repository coding principles](../../../AGENTS.md): acceptance specifications first, TDD for new behavior and contracts, DRY3, and green checks before merge. A behavior-preserving refactor begins with passing characterization coverage. Do not deliberately break established behavior merely to demonstrate a red test. New proposed contracts can have a failing test before their implementation exists.

## Current design and priority

The existing design already has useful objects. `HtmlToMarkdownPipeline` coordinates steps. `CleanHtmlAdsAdblockRs` owns its engine. `SourceRangeParser`, `HtmlTextSourceRanges`, `CssVisibilityProvenance`, and `HiddenHtmlRemovalCounts` protect meaningful state. Keep these roles. The fetcher's request closure already isolates child and timer state; a closure can satisfy the same ownership goal.

The strongest problems are exposed parser maps, a static loop that mutates a passed removal record, and a prepared-document record whose caller must coordinate extraction settings and marker cleanup. `RuleContext` is a smaller ownership problem. Static mathematical or source-slicing helpers are not themselves evidence of poor design.

## Ordered refactor plan

### 1. Specify the unchanged public behavior

Use the pipeline and `Step.invoke` as the acceptance boundary. Add or extend scenarios in [acceptance tests](../../../test/acceptance/) before changing production code. Given malformed HTML with reconstructed formatting, adopted document attributes, supplementary characters, hidden content, and a flagged URL, when the pipeline runs, then visible authored content and source spelling remain, hidden source is removed, and counters and findings remain correct. Given a removal chain, then seven removal passes plus a clean eighth scan succeed, while an eighth removal withholds the unchecked result. Given excessive parsed depth, then the depth error precedes ad-engine selection and later pipeline steps do not run.

Use the existing [hidden-pass tests](../../../test/unit/hidden-html-passes.test.ts), [tree tests](../../../test/unit/css-html-tree.test.ts), and [processing limits](../../html-processing-limits.md) as evidence for these cases. Record output ordering, exception types, and exact warning strings. Do not introduce new behavior under the name of cleanup.

### 2. Let the ad cleaner use its own engine

In [clean-html-ads-adblock-rs.ts](../../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts), change `selectorsFor(engine, url, document)` into a private instance method `selectorsFor(url, document)`. It reads `this.engine`. This requires no new class or interface. Retain constructor validation, one engine per cleaner, generic-hiding exceptions, selector deduplication, and procedural-action skip counts.

Keep `collectClassAndId` and the depth walk together for now. The full depth check must still happen before `urlCosmeticResources`. Retain `mergeRanges`, `removeRanges`, and `expandLoneLineRanges` as functions or private static helpers: they calculate values and do not need a persistent owner. Do not unify this slicing algorithm with sanitizer slicing without first reconciling their different overlap and replacement contracts.

### 3. Encapsulate parsed source knowledge

In [css-visibility-tree.ts](../../../src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-tree.ts), introduce proposed `SourceHtmlDocument`. It owns the parsed document, authored mode, source identities, adopted token locations, decoded style values, and `HtmlTextSourceRanges`. Keep parse5 adapter callbacks and the local parser subclass inside this construction boundary.

A proposed `SourceHtmlDocument.parse(html)` creates the object. Read-only `document` and `elements` access may remain for tree and selector collaboration; they are not a promise that the DOM is immutable. Expose narrow queries: `sourceElement(element)`, `textRanges(node)`, `styleSources(element)`, and `elementRemovalRanges(element)`. `styleSources` returns source intervals and decoded values together. `elementRemovalRanges` returns the owned start/end tag and adopted-tag intervals, not an enclosing element interval that could include visible foster-parented content.

Move the map-combination logic from `HiddenHtmlScanner.recordVisibleStyles` and `recordElementSource` into these queries. Keep the decision to suppress deletion when another visible reconstructed copy shares the source in the scanner. That decision needs scan visibility, which the parsed source object does not own. Returned range and style records remain data records; return fresh collections or read-only views that cannot mutate private maps.

Acceptance requires no public `adoptedSources` or `decodedStyleValues` maps, unchanged template traversal, standards source recovery plus authored selector mode, and correct UTF-16 offsets. UTF-8 byte limits must remain separate from source offsets. Do not consolidate the ad parser and source-visibility parser: their recovery contracts differ.

### 4. Give the removal loop an invocation owner

In [prompt-injection-remover-sanitizer.ts](../../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts), introduce proposed private `HiddenHtmlRemovalSession`, initially in the same file. It owns current HTML, cumulative removal counts, warning maxima, exfiltration reasons, visible style reports, provenance, and pass count. Its `run()` returns a result record. Private methods collect URL evidence, attempt a scan, record warnings, and apply one deletion pass.

Create a session inside each `invoke`; never put it on the reusable sanitizer instance. The existing `invoke` remains responsible for the byte-limit guard, control sanitization, decoded-style report sanitization, category assembly, and context update. The session owns pass policy, not all sanitizer policy.

Keep eight scans, clean-scan style replacement, CSS selector-limit rethrow, parser-failure withholding, and findings from prior scans. Preserve warning maxima across passes rather than summing repeated visible tags. Test two concurrent invocations to establish provenance isolation. Keep range removal as a calculation helper unless a third copy with the same contract justifies sharing it.

### 5. Put extraction coordination behind one operation

In [prepare-html-document.ts](../../../src/html-cleaner-pipeline/html-to-markdown/prepare-html-document.ts), introduce proposed `HtmlExtractionSession`. It owns the normalized DOM, fragment decision, original URL, neutral extraction URL, extraction options, and unique code marker. Its proposed `extract(sanitizeText)` operation performs preparation, calls Defuddle with the extracted-DOM sanitizer, and returns `{ content, title }` after marker cleanup.

`CleanHtmlToMarkdownDefuddle.convertHtml` should ask this object to extract instead of assembling options and remembering `finishMarkdown`. Move the Defuddle integration here with its types. Keep plain-text detection and final report merging in the existing step. Keep DOM normalization helpers private to this module; they need no separate classes.

Preserve preprocessing order, metadata URL and base resolution, fragment headings, code whitespace, JSON metadata filtering, and both sanitization callbacks. Test the observable Markdown and title, including authored marker-like text, rather than random marker values. A temporary compatibility wrapper may retain `prepareHtmlDocument` while call sites migrate; remove it when unused.

### 6. Hide cascade work state

In [css-visibility.ts](../../../src/html-cleaner-pipeline/prompt-injection-remover/css-visibility.ts), replace the mutable `RuleContext` record with proposed private `CssVisibilityCascade`. It owns document elements, compiled selector matcher, quirks mode, and declaration map. Private `applyRule` and `applyInlineStyles` methods write that map; `resolve()` returns the final visibility-style map. Retain `resolveCssVisibility(tree)` as a small public adapter if its callers benefit from the stable function API.

Keep `normalizeDeclarations`, `comparePrecedence`, CSS parsing, selector predicates, and `isActiveStylesheet` as calculations. Keep the serializer closure's cache scoped to one resolution. A separate serializer class has no current benefit. Preserve selector cost limits, inline precedence, template distinctions, and unknown-paint behavior.

## Verification and deferred work

Implement one boundary per change. Run each changed test locally. Use contract tests for source queries and session result records, focused tests for each new owner, and integration tests for real parser/scanner and extraction collaboration. Classify tests by package collaboration, not by speed or directory name. Avoid tests of private method order unless order affects an observable exception or result.

For implementation, run `npm run check`, explicit `npm run test:interface`, and the relevant acceptance suites; `npm run check` includes neither interface nor acceptance suites. Run `habit-hooks` with an empty snooze file. The referenced `docs/implementation/test-gate-policy.md` is absent: restore or confirm its commands at implementation handoff. Update [sanitizer documentation](../../hidden-text-sanitizer.md) and affected design documents with the same change.

Defer dependency-patch `PlaneEvidence` extraction, a general range editor, a universal parser facade, dependency injection frameworks, and fetcher closure conversion. Review those only with separate behavioral specifications and evidence of repeated change. This proposal does not alter visibility mathematics, parser libraries, network policy, supported CSS, or public pipeline data records.
