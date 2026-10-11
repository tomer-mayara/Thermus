# Metz-informed review of the Martin-informed proposal

This review assesses the [independent Martin-informed proposal](martin-proposal.md). It records discussion between AI reviewers, not statements by either author. The [Metz-informed proposal](metz-proposal.md) remains an independent historical draft. Neither proposal is adopted policy.

## Agreements on principles and priorities

The Martin proposal correctly distinguishes an object from a data record. Its strongest principle is explicit lifetime: engine state belongs to one cleaner, source knowledge to one parse, provenance to one sanitizer invocation, and marker state to one conversion. These boundaries describe current obligations rather than imagined future requirements. That is compatible with lowering the cost of change without speculative architecture.

I also agree that a static method is not automatically a design defect. Converting `selectorsFor` to an instance method gives the existing engine owner its own work. A second engine wrapper would add an unnecessary collaborator. Keeping pure geometry, declaration, range, and selector functions is sound. Retaining the pipeline's `Step.invoke` interface avoids competing abstractions for the same role.

The source-document and removal-session extractions solve concrete knowledge and lifetime problems. The scanner currently combines source representations, and the removal loop coordinates mutable results with provenance across passes. Moving that coordination to its owner can reduce the knowledge required by callers. Neither extraction should absorb visibility policy, category assembly, or final context updates.

## Objection resolved: cascade conversion

I objected to immediate `CssVisibilityCascade`. The proposal identifies a private mutable `RuleContext`, but that context has one local caller and one short application path. Its state is already scoped to a single resolution. Changing parameter access to field access gives some visual encapsulation, but there is no current outside collaborator to simplify. A class should have a benefit beyond making all modules look alike.

The Martin-informed reviewer accepted trigger-based deferral. Keep `RuleContext`, `applyRule`, and the serializer closure now. Reconsider a cascade object if rule application gains independently used operations, several callers, or a lifecycle that callers must coordinate. Growth in line count alone is insufficient. The eventual object would own cascade work state; it would not wrap all CSS calculations.

## Concessions on extraction and source queries

My draft proposed a prepared object that accepted an extraction callback. The Martin plan exposes a weakness in that choice: this repository has one concrete Defuddle integration, and no requirement for interchangeable extractors. A callback could make clients participate in an unnecessary strategy boundary. I concede direct Defuddle ownership.

Our agreed name is `PreparedHtmlDocument`. Its factory owns the normalized DOM, options, URLs, and code marker. Its `extract(sanitizeText): Promise<{ content: string; title: string }>` operation performs the concrete extraction and marker cleanup. Preparation and extracted-DOM sanitation must both remain covered by observable tests. Plain-text handling, final reports, and context accumulation remain in `CleanHtmlToMarkdownDefuddle`. No general extractor interface or fragment hierarchy is required.

We agreed on `SourceHtmlDocument.parse(html)`, with `sourceElement`, `textRanges`, `styleSources`, and `elementTagRanges`. I retract my `visibleStyleSources` name because visibility is a scanner decision. The Martin draft's `elementRemovalRanges` also suggests policy that the source object does not own. `elementTagRanges` states the source answer: explicit tag and adopted-tag intervals, not an enclosing interval. Style queries return source intervals and decoded values together. Queries must not expose mutable internal maps. The scanner retains decisions about shared visible copies and deletion eligibility.

## Test and scope corrections

The Martin draft requires the full interface suite for all implementation slices; my draft calls for relevant interface suites. Our shared decision narrows the gate to affected contracts. That suite includes live public renderer tests. Select relevant local dependency-interface tests for source, removal, and extraction changes. Broader checks apply only when the candidate affects those contracts or an established gate requires them. Still run `npm run check`, changed tests, relevant acceptance cases, and `habit-hooks` with an empty snooze file. Resolve the absent test-gate policy during implementation handoff.

I also retract mandatory new fetch-concurrency acceptance work from my draft. The fetch closure remains unchanged; its concurrency coverage belongs to a future fetcher change. Concurrent sanitizer invocations remain relevant because the new removal session must protect invocation-local provenance.

Root identified another correction: repository integration tests verify collaboration across Delamain package boundaries. Real collaboration within one package is allowed in unit tests. My claim that real pipeline stages always imply integration was incorrect. Use the repository definition, not internal stage boundaries or execution speed, and avoid test relocation as part of this work.

These compromises preserve parser distinctions, source offsets, warning and counter rules, scan limits, failure withholding, and exception order. No technical disagreement remains in the negotiated immediate scope. Engineering should implement the source owner, invocation session, and prepared extraction separately, with passing characterization evidence for each change.
