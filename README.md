# Magumagu

Magumagu is the web tool an agent is allowed to use. An admin turns off native web search, points the agent at this MCP server, and every fetch comes back as a cleaned page with a log line.

Agents need the web, and today that means an unlogged fetch from a process that can also see company data. A page can carry hidden instructions. A query can carry an internal project name out to a search engine. The same fetch also burns tokens on ads, navigation, and pages the agent already retrieved. DongAI sits on that path. It does not sit on the network: a local harness with a shell can still go around it, and a web app only reaches it after native search is off.

The server does four things with each call. It checks the tenant's allowlist and denylist. It redacts a configured list of internal terms from the outbound query. It fetches the page, strips scripts, hidden text, ads, and boilerplate, and returns markdown. It writes a log of the query, the URL, and a hash of what it returned.

Fetching is deliberately not a disguise. The client announces itself as a bot. A normal HTTP fetch is tried first. If the body is an empty shell, a local Lightpanda process runs the JavaScript and returns the DOM as HTML. The same cleaner handles both. A site that refuses bots stays refused.

Lightpanda waits for `networkidle`. The fetcher allows five seconds from process launch for readiness, including navigation. It can return as soon as the page is ready. If the child has already exited when the deadline fires, the fetcher preserves its completion result. If the child is still running, the fetcher sends `SIGKILL` and waits for the child process callback. It then rejects with `Lightpanda readiness limit exceeded after 5000 ms`, even if that callback reports success. It does not return partial HTML.

Lightpanda 1.1.0-nightly.10257+c3dfbaab3 supports [`--wait-until networkidle --wait-ms 60000`](https://lightpanda.io/docs/reference/cli/fetch). Lightpanda can return partial HTML with success when its native wait limit expires. The fetcher's five-second readiness limit prevents that output from being returned. The separate process timeout is 60000 ms, and the output limit is 32 MiB. Readiness does not guarantee that scripts or content that appear much later will be present. Test fixtures keep these production readiness options and allow loopback only inside the trusted test scope.

`WebsiteFetcher.fetchURL` returns `requestedUrl`, `finalUrl`, and `html`. `requestedUrl` keeps the URL as supplied. `finalUrl` is the URL of the returned page after redirects. Lightpanda still renders pages that need JavaScript.

The Lightpanda fetcher returns rendered HTML for successful HTTP responses. It reports HTTP responses with status 400 or above as `WebsiteFetchHttpError`. See [the fetcher contract](docs/website-fetcher.md) for the error shape, CLI options, network policy, and local test requirements.

HTML-to-Markdown conversion uses only the fetch result that the pipeline receives. It does not make network requests or fetch missing content. The pipeline uses `finalUrl` to resolve relative links and to apply host rules. Pass the fetch result directly to the pipeline:

```ts
const page = await fetcher.fetchURL(url);
const result = await pipeline.process(page);
```

The ad cleaner removes matching elements from the HTML source. It preserves adjacent source text when a paragraph or list item omits its end tag. This applies to paragraphs inside list items and before `dialog`, `search`, `menu`, `hgroup`, and `table`. Fragments without a doctype or an explicit `html` element use the same paragraph boundaries. It preserves tables between matched formatting elements that the parser reconstructs. It removes an ad body through the end of the source if the body has no end tag. It counts each matching element once, including overlapping selector matches, and honors element-hiding exceptions.

The ad cleaner takes trusted ABP rules as a constructor string. The application owns rule loading and updates. It applies domain rules using the fetched page's `finalUrl`. See [Ad rules](docs/ad-rules.md) for examples and no-op behavior.

The converter removes prohibited invisible controls from decoded text and attribute values before Defuddle converts the page. It checks logical text runs across inline elements and maps deletions back to the original text nodes. Block elements, line breaks, and images end a run. This keeps valid Persian ZWNJ and emoji ZWJ sequences when syntax highlighting splits them across spans. The converter also cleans link and image destinations before URL serialization. These checks run before Markdown escaping and code-fence selection. It checks the final Markdown and page title, then reports each finding once. The checks do not decode another layer of HTML entities. Escaped entity examples, ordinary ampersands, copyright signs, and supplementary characters stay visible.

The converter keeps escaped image examples in `noscript` as text. It does not parse the decoded text as HTML. Real image elements and their wrappers remain available to Defuddle. When both forms appear together, the fallback image and escaped example remain visible without a duplicate image. Preserved text is removed from the retained image tree, so repeated extractor callbacks do not copy it again. A small patch to pinned Defuddle 0.19.4 adds a callback to its Node entry point. It checks extracted content before cleanup, URL conversion, and Markdown conversion for selector-based and generated-HTML extractors, without another HTML parse. The converter applies the sanitizer's synchronous text check to DOM edits and aggregates findings with its public sanitizer API.

The pinned `agent-input-sanitizer` 1.47.14 patch reports the exact UTF-16 ranges that each text pass removes. The converter applies those ranges to the original DOM nodes. This keeps visible text in its original link or formatting element when an ANSI sequence contains the same characters. The patch does not change the control policy. Its optional callback uses the input offsets for each pass, after all earlier removals. Keep the patch until a dependency upgrade passes the sanitizer deletion interface tests.

The pinned LinkeDOM 0.18.13 patch makes HTML attribute serialization escape values in both ESM and CommonJS builds. Keep the patch until a dependency upgrade passes the encoded-control regression tests. It preserves escaped entity examples during Defuddle's serialize and reparse step.

HTML-to-Markdown conversion uses the cleaned HTML that the pipeline supplies. Input with no visible or embedded page content, including empty or whitespace-only input and input fully removed by sanitization, produces empty Markdown. For empty input or input that contains only tab, line feed, form feed, carriage return, or space, the converter sets `title` to `null` and preserves existing findings. A full document can contain page content in an embedded script, such as Substack `body_html`; the converter extracts that content synchronously from the supplied page. It sanitizes the source and extracted content and makes no network requests.

The converter preserves visible plain text and HTML fragments without `html` or `body` tags. For plain-text input, it escapes literal angle tokens such as `email <alice@example.com>` and `List<T>` in the Markdown output, and removes and reports prohibited raw controls. Full documents keep their metadata. The pipeline uses `finalUrl` to resolve relative links and apply host rules. Schema headline metadata remains available, including text with escaped slashes or CSS comments. Schema `articleBody` and `text` fields cannot restore content removed from the document body. An omitted `</head>` does not hide following body content.

Preformatted `<pre>` blocks and `<code style="white-space: pre">` keep their line breaks and become fenced Markdown code. Fragment code keeps relative indentation, including common and nested indentation, tabs, and leading whitespace. Conversion does not mutate the input context.

**Planned:** the cleaned page cache will use a versioned key made from the trusted tenant ID and the exact accepted absolute HTTP(S) URL string. The key will retain the full URL spelling, including the query and fragment. The caller's reason will be metadata, not part of content identity. No cache exists yet. See the [planned cache design](docs/cache-design.md) and [pending cache key tests](doc/test-list.md#planned-cache-key-tests).

## Hidden-text sanitizer

`PromptInjectionRemoverSanitizer` is a pipeline step. It removes hidden HTML, comments, and invisible characters. It rejects HTML larger than 10 MiB in UTF-8 bytes. It adds the number of detected categories to `skipped` and keeps findings and warnings in the context. It reports exfil-shaped URLs. A finding alone does not remove a visible URL. A URL in removed hidden HTML is removed with that HTML. See [the hidden-text sanitizer contract](docs/hidden-text-sanitizer.md) for scan limits and reporting behavior.

The HTML scanner tracks visibility through parsed elements and template content on each removal scan. For effective `font-size` and `font` declarations, it resolves absolute lengths, inherited `em` and `%` values, and root-relative `rem` values. It uses the original parser mode for CSS. It keeps the existing table boundaries for HTML without a doctype. In full quirks mode, a nonzero unitless `font-size` is in pixels. Standards and limited-quirks modes reject a nonzero unitless `font-size`. The `font` shorthand grammar does not change. The step removes text with a resolved zero font size. It keeps descendants that set a visible font size, and it keeps visible images. A zero font size alone does not remove a whole subtree. A recognized `var()`, `env()`, or `attr()` function makes the declaration's size unknown and lets it replace an earlier declaration at the same priority. This also applies when the CSS parser keeps typed `attr()` syntax as raw text. Raw values without a recognized deferred function, and malformed deferred function signatures, do not replace an earlier size. The step does not compute full browser layout or values such as `calc()`.

The check also removes nonempty values from text-entry inputs when an effective author font rule confirms a near-zero size. Input type matching ignores ASCII case only. Missing and invalid types use the text state. Native HTML controls with no effective author font rule keep an unknown default size. A zero-font parent alone does not hide their values or labels. Images and other native controls remain subject to their supported element and transform rules.

Rules such as `display:none`, zero opacity, and applicable singular transforms still remove the whole subtree. The sanitizer decodes CSS escapes and validates each transform declaration before it replaces an earlier declaration in the cascade. An invalid declaration does not replace an earlier valid declaration. The cascade respects `!important`. Deferred `var()`, `env()`, and `attr()` values replace earlier declarations, but remain unknown to the visibility check. Raw syntax without a valid named deferred function signature cannot replace a valid declaration. Perspective uses the same declaration order and `!important` rules.

The scanner uses known element defaults and effective display rules to check whether a local transform can apply. A non-replaced inline box keeps its text when only its own transform would hide it. Transform checks still apply to inline-block boxes and replaced content, such as images. They also apply when known positioning, float, or flex/grid rules make the box a block. The HTML root uses its blockified display, including when its declared display is `inline`, `contents`, or a table column. Ordinary HTML wrappers with `display:contents` keep the nearest generated box's transform, perspective, and flex/grid context for descendants. Font size still inherits through the parsed parent. The wrapper's own box transforms and layout offsets do not apply. HTML elements suppressed by effective `display:contents`, including images, `meter`, and `progress`, are removed. Unknown element defaults or box applicability leave an authored local transform unresolved. An absent local transform, or an explicit `none`, `initial`, or `unset` value, keeps known inherited offsets and planes. Font inheritance and rules such as `display:none` still apply.

The sanitizer converts supported `matrix()`, `matrix3d()`, scale, rotation, and resolvable translate functions to matrices. It composes the functions in CSS order, then checks whether the combined affine transform collapses the element's local plane. A singularity check can remove a whole subtree only when the authored matrix values prove that the matrix is not invertible. A nearly singular matrix does not provide that proof. Local and accumulated affine matrices use the same rank rule. The check uses bounded exact arithmetic for supported matrix, scale, and translation values. Rounding or an unresolved exact determinant cannot prove rank loss. This keeps a child whose inverse restores the parent transform, including transforms with a Z translation or a non-planar matrix. The near-zero projected-axis rule still applies. After this check, projective matrices remain unknown because an unresolved transform origin can change their projection. The sanitizer tracks pure translations through descendants and checks the combined X and Y offsets against the offscreen threshold. It removes offscreen text and void replaced elements, including images and input values, while it keeps descendants whose transforms return them to view. Position and margin declarations on generated boxes make inherited offsets unknown. It does not check translate operands one at a time, so opposite offsets or a matrix can cancel them. Rotation and scale also move the plane around its layout-dependent transform origin, so their offset entries alone do not prove that the plane is offscreen. A lone unresolved translate keeps the existing offscreen unit heuristic when its parent has no transform offset. A lone unresolved `translate3d()` uses that heuristic for X and Y and ignores Z. A mixed unresolved list stays unknown unless a known transform is singular.

In a confirmed preserved 3D context, the sanitizer composes affine transforms from ancestors and descendants. A collapsed parent plane cannot by itself hide the whole preserved subtree. The sanitizer removes direct text and flat descendants, including images, when their planes are hidden. It continues through preserved wrappers to find child planes that remain visible. Unresolved `transform-style` or grouping values, and perspective, make accumulated child planes unknown. The sanitizer keeps those planes because it cannot prove that they are hidden.

Supported grouping values for opacity, overflow, filters, clipping, isolation, masking (including `mask` and `mask-border` shorthands), blend mode, and paint containment make the effective `transform-style` flat. This includes paint containment from `content-visibility:auto`. Compound mask shorthands use each layer's image or source component; an omitted image or source is `none`. Deferred values remain unknown. For `clip`, the sanitizer requires a validated effective `position` of `absolute` or `fixed`. Declaration order and `!important` determine which property values apply. Applicable singular transforms and other rules that hide a whole subtree still apply. The sanitizer does not fully evaluate stylesheets, layout, or perspective context.

The project pins `agent-input-sanitizer` to `1.47.14` and applies [a local pnpm patch](patches/agent-input-sanitizer@1.47.14.patch) for these visibility rules. The patch exposes declaration validation and element visibility state to the CSS pass and source-range scanner. It reuses the package's CSS parser. Use `pnpm install` to install or reinstall the packages with the patches. Keep the patch and pnpm configuration when you update dependencies.

`PromptInjectionRemoverSanitizer` always parses its input as HTML, regardless of document length or tag density. It preserves visible text in `pre` and `code` elements and encoded tag examples. It still removes hidden descendants.

Removed HTML and comments leave no generated markers. Authored marker text stays unchanged in visible text, code, and attributes, including URL values. The step checks URLs before each removal and in the final HTML. It retains findings from removed content and reports each category and warning reason once. A flagged visible URL stays in the HTML. The scanner visits nested template content and preserves source offsets.

The sanitizer first runs its default pass, which removes invisible formatting characters. A CSS pass then checks inline styles and local `<style>` rules. Inline style checks include elements inside nested templates. A style block is active when its `type` is empty or `text/css`, its `media` is empty or `all`, and it is outside a `<template>`. Stylesheet selectors do not match template content. The pass reads top-level rules with type, universal, ID, class, attribute, and combinator selectors. It rejects pseudo selectors and namespace selectors. It rejects a whole rule when any selector in its selector list is unsupported.

The CSS pass checks only declarations related to visibility. It applies `!important`, selector specificity, and source order. For declarations with equal importance, inline styles have higher specificity than stylesheet rules. This follows the [CSS Cascade specification](https://www.w3.org/TR/css-cascade-4/#cascade-sort). CSS escapes and case in declaration names, keyword identifiers, units, and function names are normalized before the check. Attribute selector `i` and `s` flags are also decoded before matching. The `i` flag folds ASCII letters only. Class selectors and the attribute `~=` operator split values only at HTML whitespace: tab, line feed, form feed, carriage return, and space. Escaped selector characters are decoded, including an escaped leading digit in an ID and an escaped `*` in a type name. An invalid selector in a selector list rejects the whole rule.

The pass gives each parsed element's effective declarations to the HTML scanner. The scanner combines these declarations with inherited font and transform state before it checks visibility. The scanner removes hidden source content directly. It keeps the original style attributes during removal scans. An unchanged visible source tag keeps its effective CSS declarations on later scans. This prevents removal of a hidden sibling from hiding visible content through a changed selector match. Implied wrappers keep their effective declarations when unchanged source content identifies them. New elements use the current CSS rules. A new hidden ancestor still removes its descendants. A style rule formed by a removal applies to new elements; it does not change the saved declarations of retained elements. The scanner computes parent visibility again on each scan. Saved declarations apply only to the current invocation. After the last clean scan, the sanitizer sets resolved visible inline styles to an empty value. This prevents Markdown conversion from applying a different declaration order. The sanitizer keeps control-character findings from decoded style values before it clears them. It does not decode escaped entity examples again. A fully hidden document returns empty HTML and Markdown.

Embedded selectors match a `parse5` HTML tree. The parser inserts implied `html`, `head`, and `body` elements before selector matching. It also inserts implied `tbody` elements in tables, as specified by the [HTML parsing rules for tables](https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-intable). The CSS work budget for each scan covers at most 1,000,000 node checks, parent reads, element-name reads, attribute reads, and returned element-name and attribute-value characters combined. A selector can contain at most 128 direct selector nodes and 4096 generated characters. Exceeding a selector limit or the scan work budget raises `RangeError`; cleaning fails without returning partly checked HTML or Markdown.

The hidden-style checks cover `display:none`, `visibility:hidden` or `collapse`, and `content-visibility:hidden`. They also cover opacity below `0.01`, near-zero font sizes, far offscreen offsets, zero-area clips, hiding transforms and opacity filters, transparent or same-color text, and near-zero dimensions with `overflow:hidden`. A near-zero length or size has magnitude below `0.01`. An offset below `-900` in these units counts as offscreen: `px`, `em`, `rem`, `ex`, `ch`, `pt`, `pc`, `in`, `cm`, or `mm`. An offset at or below `-100` in `vw`, `vh`, `vmin`, or `vmax` also counts as offscreen. Percentage box offsets and `text-indent` use the same `-100` rule.

The sanitizer hides `clip:rect()` when opposite edges match within `0.01` in the same units. It hides `clip-path:circle(0)`. It also hides an `inset()` when all four expanded edges are at least `50%`.

The transform checks use the composed matrices and inherited state described above. An `opacity()` filter below `0.01` also counts as hidden. These checks do not use rendered geometry or full browser layout.

This check does not fetch linked stylesheets or `@import` rules. It skips at-rules, media queries, layers, and nested rules. It cannot resolve deferred values, calculated values, page geometry, or all inherited properties and shorthands. The font and transform checks support only the units, functions, inheritance, and shorthand rules described above. An unresolved `background`, `background-color`, or `background-image` value prevents a same-color verdict because unknown paint may make text readable. A percentage in `translate()` cannot prove that content is hidden. An unresolved value alone cannot prove that content is hidden. An independent supported rule can still hide content. Inherited properties outside the supported font and transform rules retain the existing subtree behavior. For example, a hidden `visibility` value can still remove descendants that override it. Selector matching uses browser-compatible HTML tree construction, but the visibility checks do not compute full browser layout.

The step does not enable the span-deleting filter, secret redaction, visible-text filtering, or homoglyph normalization. It does not fetch pages or call a model. Pipeline composition and startup warm-up are deferred to loader and acceptance tests.

**MVP.** One tool, `fetch`. Allowlist, denylist, and outbound redaction. Boilerplate and hidden-text stripping. Per-tenant content cache. Audit log. A container that runs the server and Lightpanda on localhost, and a hosted version of the same container.

Out of scope: step-up approval, a second renderer, request-level ad blocking, and any connector other than the web. Done when an admin can disable native search, point an agent at DongAI, and get a cleaned page back with a log line for every fetch.


## Requirements

Node 24 ESM package. TypeScript compiles with `tsc`, and Node runs the output in `dist/`. `tsx` is only for local development.

- Node 24 (`nvm use` reads `.nvmrc`)
- pnpm 12.10.1

## Scripts

```bash
pnpm install
pnpm dev         # tsx watch src/index.ts
pnpm build       # tsc
pnpm start       # node dist/src/index.js
pnpm test             # tsc, then node --test on dist/test/
pnpm test:unit        # tsc, then node --test on dist/test/unit/
pnpm test:interface   # tsc, then node --test on dist/test/interface/
pnpm typecheck   # tsc --noEmit
```

`pnpm start` runs `dist/src/index.js` because `src/` and `test/` share one compilation root. A test import such as `../src/hello.js` still resolves after emit.

## Layout

```
src/     TypeScript source
test/    node:test files
dist/    tsc output (gitignored)
```

## TypeScript

`tsconfig.json` is ESM with `module` and `moduleResolution` set to `NodeNext`, in strict mode, targeting ES2024. Relative imports use the `.js` extension that `tsc` emits:

```ts
import { hello } from './hello.js';
```
