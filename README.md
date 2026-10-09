# Magumagu

Magumagu is the web tool an agent is allowed to use. An admin turns off native web search, points the agent at this MCP server, and every fetch comes back as a cleaned page with a log line.

Agents need the web, and today that means an unlogged fetch from a process that can also see company data. A page can carry hidden instructions. A query can carry an internal project name out to a search engine. The same fetch also burns tokens on ads, navigation, and pages the agent already retrieved. DongAI sits on that path. It does not sit on the network: a local harness with a shell can still go around it, and a web app only reaches it after native search is off.

The server does four things with each call. It checks the tenant's allowlist and denylist. It redacts a configured list of internal terms from the outbound query. It fetches the page, strips scripts, hidden text, ads, and boilerplate, and returns markdown. It writes a log of the query, the URL, and a hash of what it returned.

Fetching is deliberately not a disguise. The client announces itself as a bot. A normal HTTP fetch is tried first. If the body is an empty shell, a local Lightpanda process runs the JavaScript and returns the DOM as HTML. The same cleaner handles both. A site that refuses bots stays refused.

Lightpanda waits for `networkidle`. The fetcher allows five seconds from process launch for readiness, including navigation. It can return as soon as the page is ready. If the five-second limit expires, the fetcher sends `SIGKILL` and waits for the child process callback. It then rejects with `Lightpanda readiness limit exceeded after 5000 ms`. It does not return partial HTML.

Lightpanda 1.1.0-nightly.10257+c3dfbaab3 supports [`--wait-until networkidle --wait-ms 60000`](https://lightpanda.io/docs/reference/cli/fetch). Lightpanda can return partial HTML with success when its native wait limit expires. The fetcher's five-second readiness limit prevents that output from being returned. The separate process timeout is 60000 ms, and the output limit is 32 MiB. Readiness does not guarantee that scripts or content that appear much later will be present. Test fixtures keep these production readiness options and allow loopback only inside the trusted test scope.

`WebsiteFetcher.fetchURL` returns `requestedUrl`, `finalUrl`, and `html`. `requestedUrl` keeps the URL as supplied. `finalUrl` is the URL of the returned page after redirects. Lightpanda still renders pages that need JavaScript.

HTML-to-Markdown conversion uses only the fetch result that the pipeline receives. It does not make network requests or fetch missing content. The pipeline uses `finalUrl` to resolve relative links and to apply host rules. Pass the fetch result directly to the pipeline:

```ts
const page = await fetcher.fetchURL(url);
const result = await pipeline.process(page);
```

The ad cleaner removes matching elements from the HTML source. It preserves adjacent source text when a paragraph or list item omits its end tag. This applies to paragraphs inside list items and before `dialog`, `search`, `menu`, `hgroup`, and `table`. Fragments without a doctype or an explicit `html` element use the same paragraph boundaries. It preserves tables between matched formatting elements that the parser reconstructs. It removes an ad body through the end of the source if the body has no end tag. It counts each matching element once, including overlapping selector matches, and honors element-hiding exceptions.

The converter removes prohibited invisible controls from decoded text and attribute values before Defuddle converts the page. It checks logical text runs across inline elements and maps deletions back to the original text nodes. Block elements, line breaks, and images end a run. This keeps valid Persian ZWNJ and emoji ZWJ sequences when syntax highlighting splits them across spans. The converter also cleans link and image destinations before URL serialization. These checks run before Markdown escaping and code-fence selection. It checks the final Markdown and page title, then reports each finding once. The checks do not decode another layer of HTML entities. Escaped entity examples, ordinary ampersands, copyright signs, and supplementary characters stay visible.

The converter keeps escaped image examples in `noscript` as text. It does not parse the decoded text as HTML. Real image elements and their wrappers remain available to Defuddle. When both forms appear together, the fallback image and escaped example remain visible without a duplicate image. Preserved text is removed from the retained image tree, so repeated extractor callbacks do not copy it again. A small patch to pinned Defuddle 0.19.4 adds a callback to its Node entry point. It checks extracted content before cleanup, URL conversion, and Markdown conversion for selector-based and generated-HTML extractors, without another HTML parse. The converter applies the sanitizer's synchronous text check to DOM edits and aggregates findings with its public sanitizer API.

The pinned `agent-input-sanitizer` 1.47.14 patch reports the exact UTF-16 ranges that each text pass removes. The converter applies those ranges to the original DOM nodes. This keeps visible text in its original link or formatting element when an ANSI sequence contains the same characters. The patch does not change the control policy. Its optional callback uses the input offsets for each pass, after all earlier removals. Keep the patch until a dependency upgrade passes the sanitizer deletion interface tests.

The pinned LinkeDOM 0.18.13 patch makes HTML attribute serialization escape values in both ESM and CommonJS builds. Keep the patch until a dependency upgrade passes the encoded-control regression tests. It preserves escaped entity examples during Defuddle's serialize and reparse step.

The cleaned page is cached per tenant, keyed by URL with the query string removed. The cache is never keyed on the reason the agent gave. A hit does not fetch the page again.

## Hidden-text sanitizer

`PromptInjectionRemoverSanitizer` is a pipeline step. It removes hidden HTML, comments, and invisible characters. It rejects HTML larger than 10 MiB in UTF-8 bytes. It adds the number of detected categories to `skipped` and keeps findings and warnings in the context. It reports exfil-shaped URLs. A finding alone does not remove a visible URL. A URL in removed hidden HTML is removed with that HTML. See [the hidden-text sanitizer contract](docs/hidden-text-sanitizer.md) for scan limits and reporting behavior.

`PromptInjectionRemoverSanitizer` always parses its input as HTML, regardless of document length or tag density. It preserves visible text in `pre` and `code` elements and encoded tag examples. It still removes hidden descendants.

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
