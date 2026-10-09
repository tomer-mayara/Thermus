# Magumagu

Magumagu is the web tool an agent is allowed to use. An admin turns off native web search, points the agent at this MCP server, and every fetch comes back as a cleaned page with a log line.

Agents need the web, and today that means an unlogged fetch from a process that can also see company data. A page can carry hidden instructions. A query can carry an internal project name out to a search engine. The same fetch also burns tokens on ads, navigation, and pages the agent already retrieved. DongAI sits on that path. It does not sit on the network: a local harness with a shell can still go around it, and a web app only reaches it after native search is off.

The server does four things with each call. It checks the tenant's allowlist and denylist. It redacts a configured list of internal terms from the outbound query. It fetches the page, strips scripts, hidden text, ads, and boilerplate, and returns markdown. It writes a log of the query, the URL, and a hash of what it returned.

Fetching is deliberately not a disguise. The client announces itself as a bot. A normal HTTP fetch is tried first. If the body is an empty shell, a local Lightpanda process runs the JavaScript and returns the DOM as HTML. The same cleaner handles both. A site that refuses bots stays refused.

`WebsiteFetcher.fetchURL` returns `requestedUrl`, `finalUrl`, and `html`. `requestedUrl` keeps the URL as supplied. `finalUrl` is the URL of the returned page after redirects. Lightpanda still renders pages that need JavaScript.

HTML-to-Markdown conversion uses only the fetch result that the pipeline receives. It does not make network requests or fetch missing content. The pipeline uses `finalUrl` to resolve relative links and to apply host rules. Pass the fetch result directly to the pipeline:

```ts
const page = await fetcher.fetchURL(url);
const result = await pipeline.process(page);
```

The ad cleaner removes matching elements from the HTML source. It preserves adjacent source text when a paragraph or list item omits its end tag. This applies to paragraphs inside list items and before `dialog`, `search`, `menu`, `hgroup`, and `table`. Fragments without a doctype or an explicit `html` element use the same paragraph boundaries. It preserves tables between matched formatting elements that the parser reconstructs. It removes an ad body through the end of the source if the body has no end tag. It counts each matching element once, including overlapping selector matches, and honors element-hiding exceptions.

The cleaned page is cached per tenant, keyed by URL with the query string removed. The cache is never keyed on the reason the agent gave. A hit does not fetch the page again.

## Hidden-text sanitizer

`PromptInjectionRemoverSanitizer` is a pipeline step. It removes hidden HTML, comments, and invisible characters. It rejects HTML larger than 10 MiB in UTF-8 bytes. It adds the number of detected categories to `skipped` and keeps findings and warnings in the context. It reports exfil-shaped URLs. A finding alone does not remove a visible URL. A URL in removed hidden HTML is removed with that HTML. See [the hidden-text sanitizer contract](docs/hidden-text-sanitizer.md) for scan limits and reporting behavior.

The HTML scanner tracks visibility through parsed elements and template content on each removal scan. For inline `font-size` and `font` declarations, it resolves absolute lengths, inherited `em` and `%` values, and root-relative `rem` values. It uses the original parser mode for CSS. It keeps the existing table boundaries for HTML without a doctype. In full quirks mode, a nonzero unitless `font-size` is in pixels. Standards and limited-quirks modes reject a nonzero unitless `font-size`. The `font` shorthand grammar does not change. The step removes text with a resolved zero font size. It keeps descendants that set a visible font size, and it keeps visible images. A zero font size alone does not remove a whole subtree. A recognized `var()`, `env()`, or `attr()` function makes the declaration's size unknown and lets it replace an earlier declaration at the same priority. This also applies when the CSS parser keeps typed `attr()` syntax as raw text. Raw values without a recognized deferred function, and `env()` or `attr()` with no name, do not replace an earlier size. The step does not compute stylesheet rules, layout, or values such as `calc()`.

Rules such as `display:none`, zero opacity, and collapsed transforms still remove the whole subtree. The sanitizer decodes CSS escapes and validates each transform declaration before it replaces an earlier declaration in the cascade. An invalid declaration does not replace an earlier valid declaration. The cascade respects `!important`. Deferred `var()`, `env()`, and `attr()` values replace earlier declarations, but remain unknown to the visibility check. Unsupported syntax also remains unknown.

The sanitizer converts supported `matrix()`, `matrix3d()`, scale, rotation, and resolvable translate functions to matrices. It composes the functions in CSS order, then checks whether the combined transform collapses the element's local plane. It tracks pure translations through descendants and checks the combined X and Y offsets against the offscreen threshold. It removes offscreen text and images while it keeps descendants whose transforms return them to view. Position and margin declarations make inherited offsets unknown. It does not check translate operands one at a time, so opposite offsets or a matrix can cancel them. Rotation and scale also move the plane around its layout-dependent transform origin, so their offset entries alone do not prove that the plane is offscreen. A lone unresolved translate keeps the existing offscreen unit heuristic when its parent has no transform offset. A lone unresolved `translate3d()` uses that heuristic for X and Y and ignores Z. A mixed unresolved list stays unknown unless a known transform is singular.

In a confirmed preserved 3D context, the sanitizer composes affine transforms from ancestors and descendants. A collapsed parent plane cannot by itself hide the whole preserved subtree. The sanitizer removes direct text and flat descendants, including images, when their planes are hidden. It continues through preserved wrappers to find child planes that remain visible. Unresolved `transform-style` or grouping values, and perspective, make accumulated child planes unknown. The sanitizer keeps those planes because it cannot prove that they are hidden.

Supported grouping values for opacity, overflow, filters, clipping, isolation, masking (including `mask` and `mask-border` shorthands), blend mode, and paint containment make the effective `transform-style` flat. For `clip`, the sanitizer requires a validated effective `position` of `absolute` or `fixed`. Declaration order and `!important` determine which property values apply. Singular transforms and other rules that hide a whole subtree still apply. The sanitizer does not fully evaluate stylesheets, layout, or perspective context.

The project pins `agent-input-sanitizer` to `1.47.14` and applies [a local pnpm patch](patches/agent-input-sanitizer@1.47.14.patch) for these visibility rules. The patch exposes element visibility state to the source-range scanner and reuses the package's CSS parser. Use `pnpm install` to install or reinstall the packages with the patches. Keep the patch and pnpm configuration when you update dependencies.

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
