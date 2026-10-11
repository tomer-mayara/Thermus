# OO refactoring engineering plan

**Status: slice 1 merged; slice 2 in progress.** This handoff uses design baseline Git commit `68a8eda`, dated 2026-10-11. It follows the [coding principles](../coding-principles.md). The review applies published design ideas; it does not claim author endorsement.

After user approval, [PR #30](https://github.com/3-headed-monkey/Magumagu/pull/30) merged at `2026-10-11T21:48:11Z`, with merge commit `f91d59b9518daebe5198fcc13e08dc5137e7517f`. Slice 1 focused tests, `npm run check`, all acceptance tests, and `habit-hooks --branch origin/main` passed before merge; the snooze file was empty. Slice 2 is in progress on `codex/source-html-document`. Before source edits, 122 baseline tests passed across 10 source/sanitizer unit suites, the sanitizer deletion interface suite, and all acceptance tests. These results do not claim slice 2 completion or candidate checks. Slices 3 and 4 have not started.

## Scope and priorities

Reduce caller knowledge where code already coordinates state. Implement these slices in order: establish preservation evidence and gates; let the ad cleaner use its own engine; encapsulate parsed source knowledge; give hidden-removal passes an invocation owner; coordinate prepared-document extraction behind one message. The source owner precedes the removal session so that session work does not carry two source contracts. Extraction follows those changes to keep failures easy to attribute.

Do not change supported CSS, visibility mathematics, network policy, output formats, parser libraries, counters, or public pipeline contracts. Do not introduce a universal parser, general range editor, dependency injection framework, extractor strategy, fragment hierarchy, or fetch-request class. Keep the ad parser and source-visibility parser distinct. Their recovery behavior has different purposes. This plan does not change the large sanitizer dependency patch.

Deliver one ownership boundary per reviewable implementation change. Each slice must leave passing observable behavior before the next starts. Follow [AGENTS.md](../../AGENTS.md), including BDD, TDD for new behavior or contracts, DRY3, draft PR and merge gates. A passing characterization test is valid evidence for a behavior-preserving refactor; do not break existing behavior to manufacture a red acceptance result.

## Slice 0: preservation specification and gate setup

Read [hidden-text behavior](../hidden-text-sanitizer.md), [processing limits](../html-processing-limits.md), [metrics](../pipeline-metrics.md), and the affected tests. Record baseline results before edits. Extend acceptance coverage only where an important behavior lacks a specification. A new source query or session contract starts with a failing focused test, followed by implementation and refactoring.

Preserve the following acceptance criteria:

- Given malformed HTML with reconstructed formatting, adopted document attributes, templates, and supplementary characters, when the pipeline removes hidden content, then surviving authored source keeps its spelling and UTF-16 positions map to the same content. UTF-8 byte limits remain separate.
- Given hidden content that forms new markup after deletion, when sanitization runs, then later scans inspect that markup. Seven removal scans plus a clean eighth scan succeed; an eighth removal withholds unchecked HTML with the existing warning.
- Given a parse failure after earlier successful work, when the sanitizer returns, then remaining HTML is empty and earlier reports remain. A selector-limit error still propagates instead of becoming a scan-failure warning.
- Given excessive parsed depth, when ad cleaning runs, then the depth error occurs before ad-engine selection and later pipeline stages do not run. No partial result is returned.
- Given independent hidden targets, covered descendants, unsupported ad work, and preexisting reports, when the pipeline runs, then removal and skip counts remain distinct, categories retain first-seen order, warnings remain deduplicated, and metadata and input context remain intact.
- Given fragments or HTML documents with relative links and code, when conversion runs, then source and extracted DOM sanitation apply, code whitespace and fragment headings survive, and conversion performs local extraction without fetching assets.

Use existing [counter acceptance](../../test/acceptance/pipeline-counters.test.ts), [hidden passes](../../test/unit/hidden-html-passes.test.ts), [CSS passes](../../test/unit/css-hidden-passes.test.ts), and [ad depth](../../test/unit/clean-html-ads-depth.test.ts) as anchors. Avoid one enormous scenario that makes every regression difficult to locate.

Completion: affected baseline checks pass, missing coverage is identified, and required commands are recorded. If the baseline fails, separate preexisting failures from new work before continuing. The referenced `docs/implementation/test-gate-policy.md` is absent. Required commands and ownership are resolved through AGENTS.md, package scripts, and installed tooling: the manager reviews delegated work, the owner reviews the PR, and the candidate follows the gates below. The source slice requires `npm run check`, all acceptance tests, the sanitizer deletion interface suite, and `habit-hooks --branch origin/main`, with an empty snooze file. Run every new or changed test before commit.

## Slice 1: engine ownership in the ad cleaner

This slice is complete in merged [PR #30](https://github.com/3-headed-monkey/Magumagu/pull/30). The specification below records its scope; do not repeat the implementation.

Change only [`CleanHtmlAdsAdblockRs.selectorsFor`](../../src/html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.ts) and its caller first. Replace the private static `(adblock, url, document)` signature with private instance `(url, document)`, using `this.engine`. Keep one engine per cleaner and constructor validation. Add no new service or interface.

Keep the full parsed depth walk before `urlCosmeticResources`, including when generic hiding is disabled or no host rule matches. Keep selector deduplication, exceptions, procedural skip counts, failed selector accounting, and node identity accounting. Do not reorder class/id collection as part of this edit.

Given the same rules, source, URL, and starting counters, invoking the cleaner must return identical HTML and counters. Existing [source-range tests](../../test/unit/clean-html-ads-source-ranges.test.ts), [construction budget tests](../../test/unit/clean-html-ads-construction.test.ts), and depth tests supply evidence. Add a focused contract case only if engine ownership is not already observable.

Completion: there is no engine parameter passed back into its own owner and focused tests remain green. Roll back this slice if it changes error order, source work budgets, or accounting; do not repair those failures by changing expected behavior.

## Slice 2: parsed source ownership

Introduce `SourceHtmlDocument` in the existing [`css-visibility-tree.ts`](../../src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-tree.ts). Keeping the implementation here avoids an extra facade module. Use `SourceHtmlDocument.parse(html: string): SourceHtmlDocument`. It owns the parsed document, element list, authored parsing mode, source identities, adopted locations, decoded style values, and `HtmlTextSourceRanges` for one parse.

Expose read-only properties `document` and `elements` for parser/tree collaboration. Read-only access does not promise a deeply immutable DOM. Keep map mutation private. Define these proposed queries with existing node types:

```ts
sourceElement(element: HtmlElement): HtmlElement;
textRanges(node: TextNode): readonly SourceRange[];
styleSources(element: HtmlElement): readonly StyleSource[];
elementTagRanges(element: HtmlElement): readonly SourceRange[];
```

`SourceRange` is `{ readonly start: number; readonly end: number }`. `StyleSource` is `{ readonly range: SourceRange; readonly decodedValues: readonly string[] }`. Return fresh records and collections so callers cannot mutate private mappings, including through a nested array. These are facts, not visibility verdicts.

`styleSources` combines the source element location, adopted attribute locations, and decoded style values by source offset. Preserve encounter order and duplicate decoded values; later report deduplication belongs outside this query. `elementTagRanges` returns the explicit start/end tag intervals and adopted-tag intervals currently used by the scanner. Do not replace them with a whole-element interval, which could cover visible foster-parented content. `textRanges` retains disjoint parser token intervals and the existing missing-source failure behavior.

First add contract tests in `test/unit/source-html-document.test.ts`. Then move the factory's private maps and adapter hooks into construction without changing parser callbacks. Preserve standards source recovery and restore authored mode for CSS selectors. Keep the local `SourceParser` subclass and `HtmlTextSourceRanges` adapter behavior.

Keep `parseSourceDocument` temporarily as a forwarding factory returning `SourceHtmlDocument`, and retain the `CssHtmlDocument` type alias during migration. Update [`HiddenHtmlScanner`](../../src/html-cleaner-pipeline/prompt-injection-remover/hidden-html-scanner.ts) to call `textRanges`, `styleSources`, and `elementTagRanges`. The scanner still decides visibility, hidden deletion roots, and the shared-visible-copy guard. Update type consumers in [`CssVisibilityProvenance`](../../src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-provenance.ts), [`HiddenHtmlRemovalCounts`](../../src/html-cleaner-pipeline/prompt-injection-remover/hidden-html-removal-counts.ts), and CSS resolution only as needed. Remove the forwarding factory and compatibility alias when searches show no callers; update affected tests in the same slice.

Given duplicated document tags, reconstructed copies, or foster-parented text, querying sources and running the scanner must yield the same deletions and retained styles. Use [tree tests](../../test/unit/css-html-tree.test.ts), [source-token tests](../../test/unit/css-document-source-tokens.test.ts), [source-range tests](../../test/unit/visibility-source-ranges.test.ts), and [hidden tree tests](../../test/unit/hidden-html-tree.test.ts).

Completion: no public `adoptedSources`, `decodedStyleValues`, or mutable source map remains; clients ask source questions; output and counters match baseline. Roll back this slice if source ownership cannot reproduce parser distinctions. Do not solve a mapping failure by broadening removal intervals.

## Slice 3: hidden-removal invocation lifetime

Add `hidden-html-removal-session.ts` beside [`prompt-injection-remover-sanitizer.ts`](../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts). Its `HiddenHtmlRemovalSession` constructor takes cleaned HTML; `run()` returns the existing removal-result shape with an explicit type. One object owns current HTML, provenance, removal counts, warning maxima, exfiltration reasons, visible style values, and scan count. It is created once inside each `invoke`, after control sanitation, and is never stored on the reusable sanitizer.

Move `removeHiddenHtml`, `recordScanWarnings`, and `tryScanHtml` into private session behavior. Keep the eight-scan constant with session policy. Keep range slicing as a local function in the new module; preserve sort, overlap, cursor, and replacement behavior rather than merging it with ad removal.

Leave the UTF-8 size guard, `sanitizeHtmlControls`, decoded style reports, category/warning formatting, and context accumulation in `PromptInjectionRemoverSanitizer.invoke`. The session owns scan policy, not the entire sanitizer. Keep raw exfiltration detection before scanning and parsed-attribute detection when recording scan reports. Retain findings even when later scans delete their source. Warning tag and data-source counts use maxima, not sums.

Add `test/unit/hidden-html-removal-session.test.ts` for the new contract before implementation. Preserve earlier reports on failure, selector-limit rethrow, and clean-scan inline style clearing. Exercise concurrent and repeated invocations of one sanitizer with different CSS/source content, checking each output against isolated processing. This directly tests the new lifetime. It does not require new fetcher concurrency tests.

Given retained visible declarations and newly formed hidden markup, the next pass must preserve the former and inspect the latter. Given exhaustion, unchecked HTML must be withheld. Use hidden-pass, CSS-pass, [sanitizer counter](../../test/unit/sanitizer-counters.test.ts), and [visible-control](../../test/unit/css-visible-controls.test.ts) cases.

Completion: scan state and provenance have one invocation owner; `invoke` only combines stage reports; result order and warning text remain unchanged. Roll back if isolation or withholding differs. Do not retain session state on the cleaner to reduce allocation.

## Slice 4: prepared extraction ownership

Introduce `PreparedHtmlDocument` in [`prepare-html-document.ts`](../../src/html-cleaner-pipeline/html-to-markdown/prepare-html-document.ts). Use `PreparedHtmlDocument.fromHtml(html, url)` as the factory and `extract(sanitizeText): Promise<{ content: string; title: string }>` as the message. The factory parses HTML and captures the original fragment flag only. The converter supplies its per-conversion sanitizer callback once, to `extract`. That operation owns all remaining preparation, concrete extraction, and finishing work. The object owns the parsed DOM, original fragment flag, extraction options and URL, original URL, and unique code marker for one conversion. Keep fields private.

Preserve this exact sequence: `fromHtml` parses and captures fragment status; `extract` normalizes, sanitizes source DOM, determines preserved-content status, prepares fragment headings/code, configures local extraction and metadata, calls concrete Defuddle with extracted-DOM sanitation, and removes the object's marker. Final Markdown/title sanitation and accumulated reports stay in [`CleanHtmlToMarkdownDefuddle.invoke`](../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts).

Move the concrete Defuddle import and option assembly into `PreparedHtmlDocument.extract`. `convertHtml` asks the object to extract. Do not introduce an extraction strategy callback or interface. Keep DOM helper functions local. The existing `prepareHtmlDocument` record has a different shape and one production caller. Migrate `convertHtml` atomically in this slice and remove that old record API, including exposed options and finish closure. A trivial forwarding wrapper cannot preserve its contract. If implementation requires an internal transitional adapter, make its translation explicit and remove it before slice completion.

Add contract cases in `test/unit/prepared-html-document.test.ts`, then reuse [fragment tests](../../test/unit/html-to-markdown-fragment-content.test.ts), [input-shape tests](../../test/unit/html-to-markdown-input-shapes.test.ts), and [conversion regressions](../../test/unit/html-to-markdown-regressions.test.ts). Given fragment headings, preformatted whitespace, marker-like authored text, and relative links, content/title must match baseline. Given controls in source and extracted DOM, both sanitation stages must apply. Test output rather than random marker values. Preserve `about:blank` decisions, supplied document URL, base resolution, metadata filtering, and local no-network extraction.

Completion: callers no longer coordinate DOM/options/URL/finish records; concrete extraction owns marker cleanup. Roll back if preparation order, metadata, sanitation, or no-network behavior changes.

## Retained and deferred design

Retain `HtmlToMarkdownPipeline`, `Step`, stage interfaces, `Ctx`, `SourceRangeParser`, `HtmlTextSourceRanges`, `CssVisibilityProvenance`, and `HiddenHtmlRemovalCounts`. Retain plain-text functions, CSS parsing/precedence/normalization, selector predicates, geometry evidence helpers, source-line expansion, and separate range algorithms.

Keep `RuleContext`, `applyRule`, and serializer closure in `css-visibility.ts`. Reconsider `CssVisibilityCascade` only when independently used operations, multiple callers, or externally coordinated lifecycle justify it. Keep the fetcher's child/timer closure; a new transport or separately required cancellation lifecycle can trigger request-object review. Review dependency-patch `PlaneEvidence` separately with mathematical evidence and acceptance criteria. A general range editor requires three copies with compatible semantics; a universal parser or extraction framework requires actual new requirements.

## Verification, documents, and PR gates

Classify tests by actual Delamain package boundaries. Real collaboration inside one package is allowed in unit tests. Cross-stage execution alone does not establish an integration test. Avoid moving tests solely to change directory labels.

From the repository root, run changed tests before commit and these candidate checks:

```sh
npm run check
node --test 'dist/test/acceptance/**/*.test.js'
node --test dist/test/interface/sanitizer-deletions.test.js
node --test dist/test/interface/linkedom-serialization.test.js dist/test/interface/defuddle-extracted-dom.test.js dist/test/interface/defuddle-emoji-joiners.test.js
habit-hooks --branch origin/main
```

`npm run check` builds and runs type, unit, and build checks; it excludes acceptance and interface suites. Run sanitizer interface checks for source/removal slices and LinkeDOM/Defuddle checks for extraction. New unit files run through `check`; explicitly run their built paths during TDD and before commit. Do not require blanket `npm run test:interface` for unrelated source changes: it includes live public renderer tests. Broaden checks when affected contracts or the resolved test-gate policy require them. Confirm the installed `habit-hooks` entry point and keep its snooze file empty; explain any retained enforced smell.

Update affected sanitizer, limit, metric, and design documents in the implementation PR. Open Draft first. Before Ready, required checks and changed tests pass on the complete candidate. After Ready, every Actions job that starts for that head must pass; pending, skipped, cancelled, or failed jobs do not qualify. Return to Draft before fixing a Ready candidate. The manager reviews delegated work and the owner reviews the PR; no agent PR reviewer is introduced. Merge one clean PR once. A PR adding a decision record remains owner-merged. The progress record above reports slice 1 completion and the slice 2 baseline. Slice 2 candidate gates remain pending; slices 3 and 4 remain proposals.
