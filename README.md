# Magumagu

Magumagu is the web tool an agent is allowed to use. An admin turns off native web search, points the agent at this MCP server, and every fetch comes back as a cleaned page with a log line.

Agents need the web, and today that means an unlogged fetch from a process that can also see company data. A page can carry hidden instructions. A query can carry an internal project name out to a search engine. The same fetch also burns tokens on ads, navigation, and pages the agent already retrieved. DongAI sits on that path. It does not sit on the network: a local harness with a shell can still go around it, and a web app only reaches it after native search is off.

The server does four things with each call. It checks the tenant's allowlist and denylist. It redacts a configured list of internal terms from the outbound query. It fetches the page, strips scripts, hidden text, ads, and boilerplate, and returns markdown. It writes a log of the query, the URL, and a hash of what it returned.

Fetching is deliberately not a disguise. The client announces itself as a bot. A normal HTTP fetch is tried first. If the body is an empty shell, a local Lightpanda process runs the JavaScript and returns the DOM as HTML. The same cleaner handles both. A site that refuses bots stays refused.

HTML-to-Markdown conversion uses only the HTML that the pipeline supplies. It does not make network requests or fetch missing content. The page URL in the context resolves relative links in the supplied HTML. `WebsiteFetcher` still fetches pages, and Lightpanda still renders pages that need JavaScript.

The cleaned page is cached per tenant, keyed by URL with the query string removed. The cache is never keyed on the reason the agent gave. A hit does not fetch the page again.

## Hidden-text sanitizer

`PromptInjectionRemoverSanitizer` is a pipeline step. It removes hidden HTML, comments, invisible characters, and sanitizer placeholders. It rejects HTML larger than 10 MiB in UTF-8 bytes. It adds the number of detected categories to `skipped` and keeps findings and warnings in the context. It reports exfil-shaped URLs. A finding alone does not remove a URL. A URL in removed hidden HTML is removed with that HTML.

The sanitizer first runs its default pass, which removes invisible formatting characters. A CSS pass then checks inline styles and local `<style>` rules. A style block is active when its `type` is empty or `text/css`, its `media` is empty or `all`, and it is outside a `<template>`. The pass reads top-level rules with type, universal, ID, class, attribute, and combinator selectors. It rejects pseudo selectors and namespace selectors. It rejects a whole rule when any selector in its selector list is unsupported.

The CSS pass checks only declarations related to visibility. It applies `!important`, selector specificity, and source order. For declarations with equal importance, inline styles have higher specificity than stylesheet rules. This follows the [CSS Cascade specification](https://www.w3.org/TR/css-cascade-4/#cascade-sort). CSS escapes and case in declaration names, keyword identifiers, units, and function names are normalized before the check. Attribute selector `i` and `s` flags are also decoded before matching. The pass uses the sanitizer's hidden-style checks. It rewrites each selected source element's inline style to `display:none` when the check finds hidden content, or to an empty style otherwise. This removes the element's original style details. When a hidden element exists only in the parsed tree, the pass marks its direct source text as hidden. It preserves other text and attributes.

Embedded selectors match a `parse5` HTML tree. The parser inserts implied elements such as `tbody` in tables before selector matching, as specified by the [HTML parsing rules for tables](https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-intable). The document work budget covers at most 1,000,000 node checks, parent reads, attribute reads, and returned attribute-value characters combined. A selector can contain at most 128 direct selector nodes and 4096 generated characters. Exceeding a selector limit or the document work budget raises `RangeError`; cleaning fails without returning partly checked HTML or Markdown.

The hidden-style checks cover `display:none`, `visibility:hidden` or `collapse`, and `content-visibility:hidden`. They also cover opacity below `0.01`, near-zero font sizes, far offscreen offsets, zero-area clips, hiding transforms and opacity filters, transparent or same-color text, and near-zero dimensions with `overflow:hidden`. A near-zero length or size has magnitude below `0.01`. An offset below `-900` in these units counts as offscreen: `px`, `em`, `rem`, `ex`, `ch`, `pt`, `pc`, `in`, `cm`, or `mm`. An offset at or below `-100` in `vw`, `vh`, `vmin`, or `vmax` also counts as offscreen. Percentage box offsets and `text-indent` use the same `-100` rule.

The sanitizer hides `clip:rect()` when opposite edges match within `0.01` in the same units. It hides `clip-path:circle(0)`. It also hides an `inset()` when all four expanded edges are at least `50%`.

The sanitizer hides supported scale or matrix functions when a scale factor is near zero. It hides `rotateX()` or `rotateY()` at a near edge-on angle. It hides `translate()`, `translateX()`, or `translateY()` when a supported negative offset moves content far offscreen. An `opacity()` filter below `0.01` also counts as hidden. These are heuristics. They do not use rendered geometry or full browser layout.

This check does not fetch linked stylesheets or `@import` rules. It skips at-rules, media queries, layers, and nested rules. It cannot resolve `var()` or `env()` values, calculated values, inheritance, shorthand expansion, full transform composition, or page geometry. An unresolved `background-image` stays as paint context. This prevents a same-color verdict when an image may make text readable. A percentage in `translate()` cannot prove that content is hidden. An unresolved value alone cannot prove that content is hidden. A supported rule can still hide content. The sanitizer can remove a parent and its subtree when a child overrides an inherited visibility property. This can remove visible child content. Selector matching uses browser-compatible HTML tree construction, but the visibility checks do not compute browser layout or inherited styles.

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
