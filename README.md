# Magumagu

Magumagu is the web tool an agent is allowed to use. An admin turns off native web search, points the agent at this MCP server, and every fetch comes back as a cleaned page with a log line.

Agents need the web, and today that means an unlogged fetch from a process that can also see company data. A page can carry hidden instructions. A query can carry an internal project name out to a search engine. The same fetch also burns tokens on ads, navigation, and pages the agent already retrieved. DongAI sits on that path. It does not sit on the network: a local harness with a shell can still go around it, and a web app only reaches it after native search is off.

The server does four things with each call. It checks the tenant's allowlist and denylist. It redacts a configured list of internal terms from the outbound query. It fetches the page, strips scripts, hidden text, ads, and boilerplate, and returns markdown. It writes a log of the query, the URL, and a hash of what it returned.

Fetching is deliberately not a disguise. The client announces itself as a bot. A normal HTTP fetch is tried first. If the body is an empty shell, a local Lightpanda process runs the JavaScript and returns the DOM as HTML. The same cleaner handles both. A site that refuses bots stays refused.

HTML-to-Markdown conversion uses only the HTML that the pipeline supplies. It does not make network requests or fetch missing content. The page URL in the context resolves relative links in the supplied HTML. `WebsiteFetcher` still fetches pages, and Lightpanda still renders pages that need JavaScript.

The converter removes prohibited invisible controls from decoded text and attribute values before Defuddle converts the page. It cleans link and image destinations before URL serialization. This check runs before Markdown escaping and code-fence selection. The converter also checks the final Markdown and page title. It reports each finding once across these stages. `document.normalize()` joins adjacent text nodes before checks, so joiners within one text run retain their context. The checks do not decode another layer of HTML entities. Escaped entity examples, ordinary ampersands, copyright signs, and supplementary characters stay visible.

The pinned LinkeDOM 0.18.13 patch makes HTML attribute serialization escape values in both ESM and CommonJS builds. Keep the patch until a dependency upgrade passes the encoded-control regression tests. It preserves escaped entity examples during Defuddle's serialize and reparse step.

The cleaned page is cached per tenant, keyed by URL with the query string removed. The cache is never keyed on the reason the agent gave. A hit does not fetch the page again.

## Hidden-text sanitizer

`PromptInjectionRemoverSanitizer` is a pipeline step. It removes hidden HTML, comments, invisible characters, and sanitizer placeholders. It rejects HTML larger than 10 MiB in UTF-8 bytes. It adds the number of detected categories to `skipped` and keeps findings and warnings in the context. It reports exfil-shaped URLs. A finding alone does not remove a URL. A URL in removed hidden HTML is removed with that HTML.

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
