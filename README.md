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

`PromptInjectionRemoverSanitizer` always parses its input as HTML, regardless of document length or tag density. It preserves visible text in `pre` and `code` elements and encoded tag examples. It still removes hidden descendants.

Removed HTML and comments leave no generated markers. Authored marker text stays unchanged in visible text, code, and attributes, including URL values. The step checks URLs before each removal and in the final HTML. It retains findings from removed content and reports each category and warning reason once. A flagged visible URL stays in the HTML. The scanner visits nested template content and preserves source offsets.

The sanitizer first runs its default pass, which removes invisible formatting characters. A CSS pass then checks inline styles and local `<style>` rules. Inline style checks include elements inside nested templates. A style block is active when its `type` is empty or `text/css`, its `media` is empty or `all`, and it is outside a `<template>`. Stylesheet selectors do not match template content. The pass reads top-level rules with type, universal, ID, class, attribute, and combinator selectors. It rejects pseudo selectors and namespace selectors. It rejects a whole rule when any selector in its selector list is unsupported.

The CSS pass checks only declarations related to visibility. It applies `!important`, selector specificity, and source order. For declarations with equal importance, inline styles have higher specificity than stylesheet rules. This follows the [CSS Cascade specification](https://www.w3.org/TR/css-cascade-4/#cascade-sort). CSS escapes and case in declaration names, keyword identifiers, units, and function names are normalized before the check. Attribute selector `i` and `s` flags are also decoded before matching. The `i` flag folds ASCII letters only. Class selectors and the attribute `~=` operator split values only at HTML whitespace: tab, line feed, form feed, carriage return, and space. Escaped selector characters are decoded, including an escaped leading digit in an ID and an escaped `*` in a type name. An invalid selector in a selector list rejects the whole rule.

The pass uses the sanitizer's hidden-style checks. It gives the effective style of each parsed element to the HTML scanner. The scanner removes hidden source content directly. It keeps the original style attributes during removal scans. An unchanged visible source tag keeps its CSS visibility on later scans. This prevents removal of a hidden sibling from hiding visible content through a changed selector match. Implied wrappers keep their visibility when unchanged source content identifies them. New elements use the current CSS rules. A new hidden ancestor still removes its descendants. A style rule formed by a removal applies to new elements; it does not change the saved visibility of retained elements. Saved visibility applies only to the current invocation. After the last clean scan, the sanitizer sets resolved visible inline styles to an empty value. This prevents Markdown conversion from applying a different declaration order. The sanitizer keeps control-character findings from decoded style values before it clears them. It does not decode escaped entity examples again. A fully hidden document returns empty HTML and Markdown.

Embedded selectors match a `parse5` HTML tree. The parser inserts implied `html`, `head`, and `body` elements before selector matching. It also inserts implied `tbody` elements in tables, as specified by the [HTML parsing rules for tables](https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-intable). The CSS work budget for each scan covers at most 1,000,000 node checks, parent reads, element-name reads, attribute reads, and returned element-name and attribute-value characters combined. A selector can contain at most 128 direct selector nodes and 4096 generated characters. Exceeding a selector limit or the scan work budget raises `RangeError`; cleaning fails without returning partly checked HTML or Markdown.

The hidden-style checks cover `display:none`, `visibility:hidden` or `collapse`, and `content-visibility:hidden`. They also cover opacity below `0.01`, near-zero font sizes, far offscreen offsets, zero-area clips, hiding transforms and opacity filters, transparent or same-color text, and near-zero dimensions with `overflow:hidden`. A near-zero length or size has magnitude below `0.01`. An offset below `-900` in these units counts as offscreen: `px`, `em`, `rem`, `ex`, `ch`, `pt`, `pc`, `in`, `cm`, or `mm`. An offset at or below `-100` in `vw`, `vh`, `vmin`, or `vmax` also counts as offscreen. Percentage box offsets and `text-indent` use the same `-100` rule.

The sanitizer hides `clip:rect()` when opposite edges match within `0.01` in the same units. It hides `clip-path:circle(0)`. It also hides an `inset()` when all four expanded edges are at least `50%`.

The sanitizer hides supported scale or matrix functions when a scale factor is near zero. It hides `rotateX()` or `rotateY()` at a near edge-on angle. It hides `translate()`, `translateX()`, or `translateY()` when a supported negative offset moves content far offscreen. An `opacity()` filter below `0.01` also counts as hidden. These are heuristics. They do not use rendered geometry or full browser layout.

This check does not fetch linked stylesheets or `@import` rules. It skips at-rules, media queries, layers, and nested rules. It cannot resolve `var()` or `env()` values, calculated values, inheritance, shorthand expansion, full transform composition, or page geometry. An unresolved `background`, `background-color`, or `background-image` value prevents a same-color verdict because unknown paint may make text readable. A percentage in `translate()` cannot prove that content is hidden. An unresolved value alone cannot prove that content is hidden. An independent supported rule can still hide content. The sanitizer can remove a parent and its subtree when a child overrides an inherited visibility property. This can remove visible child content. Selector matching uses browser-compatible HTML tree construction, but the visibility checks do not compute browser layout or inherited styles.

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
