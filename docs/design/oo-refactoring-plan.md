# OO refactoring engineering plan

**Status: slices 1, 2, and 3 merged; slice 4 underway on `codex/prepared-html-document`; implementation and final checks pending.** This handoff uses design baseline Git commit `68a8eda`, dated 2026-10-11. It follows the [coding principles](../coding-principles.md). The review applies published design ideas; it does not claim author endorsement.

[PR #30](https://github.com/3-headed-monkey/Magumagu/pull/30) merged at `2026-10-11T21:48:11Z`, with merge commit `f91d59b9518daebe5198fcc13e08dc5137e7517f`. Slice 1 focused tests, `npm run check`, all acceptance tests, and `habit-hooks --branch origin/main` passed before merge; the snooze file was empty.

[PR #32](https://github.com/3-headed-monkey/Magumagu/pull/32) merged at `2026-10-11T22:03:33Z`, with merge commit `4e7472500f98d4cf95add5d2f6dee4b8cf4eba03`. Slice 2 began with 122 passing baseline tests across 10 source/sanitizer unit files, the sanitizer deletion interface suite, and all acceptance tests. Its seven new source contract tests failed on the missing export, then passed after implementation. All 135 focused tests passed, covering source, visibility, repeated scans, counts, decoded styles, and authored font mode. The complete candidate passed `npm run check`: type checking, 1,241 unit tests, and 8 build tests. A separate run passed all 16 acceptance tests, 9 sanitizer deletion interface tests, and 7 new contract tests. The contract tests also appear in the unit count.

The manager signed off slice 2 code, tests, and eight habit retention reasons after independent review. `habit-hooks --branch origin/main` exited with status 1: seven explanatory comments and scanner size reduced from 239 to 225 lines were retained with reasons documented in PR #32. No suppressions were added; the snooze file was empty. The PR links contain the detailed review and verification records. This record confirms the merges and local evidence; it makes no separate claim about CI results.

[PR #33](https://github.com/3-headed-monkey/Magumagu/pull/33) merged at `2026-10-11T22:16:00Z`, with merge commit `05d1ef6ff841f93bf42ffa60e1571f62b31f3847`. Slice 3 was implemented on `codex/hidden-html-removal-session`. All 95 existing baseline tests passed before implementation. The new session contract tests first failed because the module was missing; after implementation, all 54 focused tests passed, including the 8 new cases. The change preserves failure behavior and range algorithms. The manager reviewed the code, tests, and documents against the coding principles and signed off the per-invocation owner, preserved behavior, local range function, and absence of extra abstractions. This record confirms the merge and local evidence; it makes no separate claim about CI results. Slice 4 is underway on `codex/prepared-html-document`, from this merge commit. No slice 4 implementation or final checks are claimed yet.

The slice 3 candidate passed `npm run check`: type checking, 1,249 unit tests, and 8 build tests. A separate 33-test run passed all 16 acceptance tests, 9 sanitizer deletion interface tests, and 8 new session contract tests. The new tests also appear in the unit count; the required suites contain 1,282 distinct tests. `habit-hooks --branch origin/main` exited with status 0 and reported two transferred rationale comments in `hidden-html-removal-session.ts`. The manager retained both: the last removal can form hidden markup, which explains withholding after exhaustion; rescans can see the same tags, which explains maxima instead of sums. No suppressions were added, and the snooze file remains `[]`.

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

`SourceHtmlDocument` is implemented in the existing [`css-visibility-tree.ts`](../../src/html-cleaner-pipeline/prompt-injection-remover/css-visibility-tree.ts). Keeping the implementation here avoids an extra facade module. Its factory is `SourceHtmlDocument.parse(html: string): SourceHtmlDocument`. It owns the parsed document, element list, authored parsing mode, source identities, adopted locations, decoded style values, and `HtmlTextSourceRanges` for one parse.

It exposes read-only properties `document` and `elements` for parser/tree collaboration. Read-only access does not promise a deeply immutable DOM. Map mutation stays private. It provides these queries with existing node types:

```ts
sourceElement(element: HtmlElement): HtmlElement;
textRanges(node: TextNode): readonly SourceRange[];
styleSources(element: HtmlElement): readonly StyleSource[];
elementTagRanges(element: HtmlElement): readonly SourceRange[];
```

`SourceRange` is `{ readonly start: number; readonly end: number }`. `StyleSource` is `{ readonly range: SourceRange; readonly decodedValues: readonly string[] }`. Queries return fresh records and collections so callers cannot mutate private mappings, including through a nested array. These are facts, not visibility verdicts.

`styleSources` combines the source element location, adopted attribute locations, and decoded style values by source offset. It preserves encounter order and duplicate decoded values; later report deduplication belongs outside this query. `elementTagRanges` returns the explicit start/end tag intervals and adopted-tag intervals currently used by the scanner. Do not replace them with a whole-element interval, which could cover visible foster-parented content. `textRanges` retains disjoint parser token intervals and the existing missing-source failure behavior.

Seven contract tests in `test/unit/source-html-document.test.ts` cover the new owner. Its construction owns the private maps and adapter hooks, retaining the local `SourceParser` subclass and `HtmlTextSourceRanges` adapter behavior. Source recovery keeps standards parsing and restores authored mode for CSS selectors.

The five source files migrated together. `HiddenHtmlScanner` now calls `textRanges`, `styleSources`, and `elementTagRanges`; it still decides visibility, hidden deletion roots, and the shared-visible-copy guard. `CssVisibilityProvenance`, `HiddenHtmlRemovalCounts`, and CSS resolution use `SourceHtmlDocument`. The old `parseSourceDocument` factory and `CssHtmlDocument` alias were removed in the same change.

Given duplicated document tags, reconstructed copies, or foster-parented text, querying sources and running the scanner must yield the same deletions and retained styles. Use [tree tests](../../test/unit/css-html-tree.test.ts), [source-token tests](../../test/unit/css-document-source-tokens.test.ts), [source-range tests](../../test/unit/visibility-source-ranges.test.ts), and [hidden tree tests](../../test/unit/hidden-html-tree.test.ts).

Completion: no public `adoptedSources`, `decodedStyleValues`, or mutable source map remains; clients ask source questions; output and counters match baseline. Roll back this slice if source ownership cannot reproduce parser distinctions. Do not solve a mapping failure by broadening removal intervals.

## Slice 3: hidden-removal invocation lifetime

This slice is implemented in [PR #33](https://github.com/3-headed-monkey/Magumagu/pull/33). Manager review and local candidate checks are complete; owner review remains pending. The specification below records its scope.

`hidden-html-removal-session.ts` now sits beside [`prompt-injection-remover-sanitizer.ts`](../../src/html-cleaner-pipeline/prompt-injection-remover/prompt-injection-remover-sanitizer.ts). Its `HiddenHtmlRemovalSession` constructor takes cleaned HTML; `run()` returns the existing removal-result shape with an explicit type. One object owns current HTML, provenance, removal counts, warning maxima, exfiltration reasons, visible style values, and scan count. It is created once inside each `invoke`, after control sanitation, and is never stored on the reusable sanitizer.

The session now owns the removal loop, scan reports, and scan error handling. The eight-scan constant stays with session policy. Range slicing stays a local free function in the new module, with the existing sort, overlap, cursor, and replacement behavior.

Leave the UTF-8 size guard, `sanitizeHtmlControls`, decoded style reports, category/warning formatting, and context accumulation in `PromptInjectionRemoverSanitizer.invoke`. The session owns scan policy, not the entire sanitizer. Keep raw exfiltration detection before scanning and parsed-attribute detection when recording scan reports. Retain findings even when later scans delete their source. Warning tag and data-source counts use maxima, not sums.

The eight contract cases in [`hidden-html-removal-session.test.ts`](../../test/unit/hidden-html-removal-session.test.ts) cover formed hidden markup and final style reporting; seven-removal success and eighth-removal withholding; retained reports after a later scan failure; raw URL findings before a failed scan; selector-limit error identity; warning maxima and first-seen reasons across overlapping ranges; and isolation across repeated and concurrent calls. The isolation case compares one reusable sanitizer with separate sanitizer instances.

Given retained visible declarations and newly formed hidden markup, the next pass must preserve the former and inspect the latter. Given exhaustion, unchecked HTML must be withheld. Use hidden-pass, CSS-pass, [sanitizer counter](../../test/unit/sanitizer-counters.test.ts), and [visible-control](../../test/unit/css-visible-controls.test.ts) cases.

Completion: scan state and provenance have one invocation owner; `invoke` only combines stage reports; result order and warning text remain unchanged. Roll back if isolation or withholding differs. Do not retain session state on the cleaner to reduce allocation.

## Slice 4: prepared extraction ownership

Introduce `PreparedHtmlDocument` in [`prepare-html-document.ts`](../../src/html-cleaner-pipeline/html-to-markdown/prepare-html-document.ts). Use `PreparedHtmlDocument.fromHtml(html, url)` as the factory and `extract(sanitizeText): Promise<{ content: string; title: string }>` as the message. The factory parses HTML and captures the original fragment flag only. The converter supplies its per-conversion sanitizer callback once, to `extract`. That operation owns all remaining preparation, concrete extraction, and finishing work. The object owns the parsed DOM, original fragment flag, extraction options and URL, original URL, and unique code marker for one conversion. Keep fields private.

Preserve this exact sequence: `fromHtml` parses and captures fragment status; `extract` normalizes, sanitizes source DOM, determines preserved-content status, prepares fragment headings/code, configures local extraction and metadata, calls concrete Defuddle with extracted-DOM sanitation, and removes the object's marker. Plain-text selection, final Markdown/title sanitation, and accumulated reports stay in [`CleanHtmlToMarkdownDefuddle.invoke`](../../src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts).

Move the concrete Defuddle import and option assembly into `PreparedHtmlDocument.extract`. `convertHtml` asks the object to extract. Do not introduce an extraction strategy callback or interface. Keep DOM helpers as local free functions. The existing `prepareHtmlDocument` record has a different shape and one production caller. Migrate `convertHtml` atomically in this slice and remove that old record API, including exposed options and finish closure. A trivial forwarding wrapper cannot preserve its contract. If implementation requires an internal transitional adapter, make its translation explicit and remove it before slice completion.

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

Update affected sanitizer, limit, metric, and design documents in the implementation PR. Open Draft first. Before Ready, type checking, tests, and build checks must pass on the complete candidate. Run `habit-hooks` on that candidate; correct each enforced finding or record the reason to retain it. Its snooze file must stay empty. After Ready, every Actions job that starts for that head must pass; pending, skipped, cancelled, or failed jobs do not qualify. Return to Draft before fixing a Ready candidate. The manager reviews delegated work and the owner reviews the PR; no agent PR reviewer is introduced. Merge one clean PR once. A PR adding a decision record remains owner-merged. The progress record above reports slices 1, 2, and 3 merged, with local test evidence and documented habit retention reasons. It makes no separate claim about CI results. Slice 4 is underway on `codex/prepared-html-document`; implementation and final checks remain pending.
