# Independent proposal from a Metz-informed perspective

This is an AI review that applies documented Sandi Metz principles. It is not a statement by Metz, an endorsement, or adopted repository policy. The baseline is commit `68a8eda`, reviewed on 2026-10-11. This proposal covers local TypeScript design. It does not authorize implementation or change sanitizer policy.

## Durable principles

1. **Give an object a role and the information needed for that role.** A class should protect a useful relationship between state and behavior. An object with no meaningful state can still fulfill a role, but a class name alone does not improve a function. Metz describes objects collaborating through messages and roles rather than clients directing each detail of their work. This supports interfaces such as the existing `Step.invoke`, which lets the pipeline request work without knowing its implementation. It does not require a hierarchy for every parser branch. [Objects, roles, and messages](https://sandimetz.com/blog/2018/21/what-does-oo-afford).
2. **Move knowledge to its owner.** A caller should request an answer from the collaborator that knows how to produce it. It should not fetch several internal maps and reconstruct that answer. The useful test is which files must change when the representation changes, not the count of static methods.
3. **Choose change cost over architectural symmetry.** Introduce boundaries where current code already coordinates state, ordering, or lifetime. Do not build extension points for hypothetical parsers, sanitizers, or transports. Metz connects design quality to reducing the cost of change while recognizing that future requirements are uncertain. [Design and change cost](https://sandimetz.com/blog/2012/07/05/how-shall-we-define-design).
4. **Prefer clear duplication to an incorrect shared abstraction.** Similar range operations can have different rules for overlaps, replacement text, line expansion, and counting. Keep those differences visible. Follow the repository's DRY3 rule before sharing an implementation. Metz's account of the wrong abstraction supports undoing an abstraction when callers force it to serve incompatible needs. [The wrong abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction).
5. **Test observable behavior and useful messages.** Preserve output, error behavior, and resource limits first. New object contracts need focused tests, but tests should not freeze private method order. Use BDD acceptance specifications and TDD as required by [AGENTS.md](../../../AGENTS.md). A behavior-preserving refactor starts from a passing characterization baseline; an unchanged acceptance case need not fail artificially.

## Current design worth keeping

[`HtmlToMarkdownPipeline`](../../../src/html-cleaner-pipeline/html-to-markdown-pipeline.ts) already sends one message to each `Step`. Keep its ordered loop, `Ctx` data contract, and immutable input behavior. The interfaces for ad cleaning, prompt removal, and Markdown conversion give each stage a useful role. Do not add a second framework above them.

`SourceRangeParser`, `CssVisibilityProvenance`, `HtmlTextSourceRanges`, and `HiddenHtmlRemovalCounts` already put specialized state beside relevant behavior. Keep those roles. In particular, preserve the distinction between authored source and parsed nodes. A formatting element can have parser-created copies, a duplicate document tag can contribute attributes, and text can have separate source intervals. A DOM location is not always a complete source answer.

Keep pure functions for CSS parsing, declaration normalization and precedence, selector predicates, source-line expansion, plain-text recognition, and geometry calculations. Keep DTOs for pipeline context, findings, source ranges, and public results. Mathematical evidence should remain explicit. Changing an unknown value into a hidden verdict would be a behavior change, not an OO refactor.

## Ordered engineering plan

### 1. Establish the preservation specification

Before edits, identify the existing acceptance coverage and add only missing user-visible cases. Use Given-When-Then specifications for source-preserving removal, multiple hidden-removal passes, fragment conversion, and concurrent fetch isolation. For example: given malformed HTML with a reconstructed visible formatting node and a hidden sibling, when the pipeline processes it, then visible source and Markdown remain, hidden content is absent, and counters and findings match the current contract.

Record baseline results for the affected suites. The implementation must preserve UTF-16 offsets and unedited source spelling, while the size gate remains measured in UTF-8 bytes. Preserve the 10 MiB gate, eight-scan limit, selector-limit propagation, parse-failure withholding, depth-error ordering, warning deduplication, finding order, and metadata. Existing [limits](../../html-processing-limits.md), [sanitizer behavior](../../hidden-text-sanitizer.md), and [counter rules](../../pipeline-metrics.md) are acceptance constraints.

### 2. Let the ad cleaner use its own engine

In [`clean-html-ads-adblock-rs.ts`](../../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts), change `selectorsFor` to an instance method that reads `this.engine`. Its current static signature receives state owned by that same cleaner. This is a small ownership correction, not grounds for an `AdblockEngineService`.

Keep `parseHtml`, `nodesWithinDepth`, `collectClassAndId`, `mergeRanges`, and `removeRanges` as functions or private helpers. Keep selector collection after the full depth walk. Keep `stripHtml` local unless a later change gives selection accounting and editing separate lifetimes. Acceptance: construction validates rules as before; generic-hide exceptions, unsupported selectors, duplicate matches, and source construction budgets remain unchanged.

### 3. Encapsulate authored source knowledge

Replace the exposed-map result from `parseSourceDocument` in [`css-visibility-tree.ts`](../../../src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-tree.ts) with a `SourceHtmlDocument` object. It owns the parsed document, element list, text ranges, source-element associations, adopted locations, and decoded style values for one parse. Keep parsing behind a factory; the existing parser adapter hooks and internal `SourceParser` can remain implementation details.

Provide narrow messages such as `sourceElement(element)`, `textRanges(textNode)`, `visibleStyleSources(element)`, and `elementTagRanges(element)`. `visibleStyleSources` returns source intervals and their decoded values together. `elementTagRanges` includes adopted document-tag sources and explicit start/end tags; it must not silently return a whole-element interval. `HiddenHtmlScanner` still decides whether visibility permits removal and whether a shared source is retained. The source object decides how to locate that source.

Update [`hidden-html-scanner.ts`](../../../src/html-cleaner-pipeline/prompt-injection-remover/hidden-html-scanner.ts) to ask these questions instead of combining `adoptedSources`, `decodedStyleValues`, and adapter locations. Adapt provenance and counts only where they consume this source contract. Do not move visibility, deletion policy, or counters into the new object. Acceptance: reconstructed tags, foster-parented text, duplicate attributes, templates, entity spellings, supplementary characters, and adopted styles produce identical output.

### 4. Give each hidden-removal run its own object

Extract `HiddenHtmlRemovalSession` into a neighboring file. It owns current HTML, `CssVisibilityProvenance`, accumulated independent removal counts, warning maxima, exfiltration reasons, and the scan budget for one `invoke`. Its `run()` returns a result DTO. Move `removeHiddenHtml`, `recordScanWarnings`, and `tryScanHtml` behavior into that session with private methods that use its own state.

Keep `PromptInjectionRemoverSanitizer.invoke` responsible for the input-size check, control sanitation, style reports, public categories and warnings, and context accumulation. Keep range editing as a local function initially. Session construction must occur after control sanitation and never at cleaner construction time. This prevents retained provenance leaking between calls.

Preserve both raw and parsed-attribute exfiltration checks. Preserve warning maxima across passes and the final clean scan that clears visible styles. Preserve the special selector exception before generic scan-failure handling. Acceptance: a later pass can discover new hidden markup; a surviving override remains visible; failed or exhausted scans withhold unchecked HTML while keeping earlier reports. Reusing one sanitizer concurrently must produce independent results.

### 5. Make preparation and extraction one collaboration

Introduce `PreparedHtmlDocument` in [`prepare-html-document.ts`](../../../src/html-cleaner-pipeline/html-to-markdown/prepare-html-document.ts). It owns the normalized DOM, extraction options, extraction URL, and code marker for one conversion. Its `extract` message accepts the concrete extraction callback needed by Defuddle and the extracted-DOM processor, then returns finished content and title. Move the present `convertHtml` coordination from [`clean-html-to-markdown-defuddle.ts`](../../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts) behind that message.

Keep DOM normalization helpers private functions. Retain `plainTextMarkdown` as a function and the caller's per-invocation sanitizer reports. Do not expose a general mutable options bag or create fragment/document subclasses. Acceptance: heading preservation, fenced-code whitespace, base URLs, metadata cleanup, decoded controls, and extracted-DOM sanitation remain unchanged. The new contract must keep both pre-extraction and post-extraction sanitation visible in tests.

## Triggered or deferred work

`RuleContext` and `applyRule` in `css-visibility.ts` form a small local collaboration. Keep them now. Introduce a `CssVisibilityCascade` only if another caller needs the rule application lifecycle or the module acquires independently evolving cascade state. Its role would own styles, elements, selector compilation, quirks mode, and serialization caches for one resolution. Do not add a class merely to replace the context parameter.

Keep the fetcher's request closure: it already isolates child process, timer, and completion state per request. A request class needs evidence such as another transport or separately testable cancellation lifecycle. Defer dependency-patch `PlaneEvidence` design to a separate change with mathematical review and its own behavior specification. Do not mix it into source ownership work.

## Validation and delivery

Use focused contract tests for source queries and session isolation, then existing malformed-markup, CSS-pass, counter, and conversion regressions. Tests across real pipeline stages remain integration tests even if currently stored under `test/unit`. Acceptance tests exercise the public pipeline; interface tests cover dependency contracts and failure behavior. Avoid a wholesale test relocation in these refactors.

Run each new or changed test, `npm run check`, relevant interface suites, and acceptance suites explicitly; `check` excludes the last two. Run `habit-hooks` with an empty snooze file and address enforced findings. The referenced `docs/implementation/test-gate-policy.md` is absent: resolve its commands and ownership during implementation handoff. This does not block this proposal. Ship the ordered changes in reviewable increments, update affected documents, and follow the draft/Ready/Actions gates in AGENTS.md. No tests were run for this documentation proposal.
