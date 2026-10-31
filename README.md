# Thermus

Thermus searches the web and fetches pages through MCP tools that return cleaned Markdown. Each dispatched tool call attempts a completion record in the application log.

Agents need the web, and a page can carry hidden instructions or use tokens on ads and navigation. Thermus handles calls that an agent routes through its MCP tool. A shell or another web tool can still reach the internet directly.

The fetch tool checks access and the requested URL, runs an outgoing observation step, renders the page, removes matching ads and hidden content, extracts the article, and returns Markdown. The outgoing step allows the exact URL unchanged. The incoming step processes the fetched HTML and distinguishes ordinary empty output from typed scan withholding. Each step executor attempts a fixed record without request or page content. The fetch completion record includes the trusted caller, operation ID, URL origin and path, reason, status, and duration. Tenant URL rules, outbound term redaction, and content hashes are planned; they are not part of the current tool.

Each page fetch uses a local Lightpanda process to run JavaScript and return rendered HTML. The cleaner processes that HTML. HTTP errors, including a site that refuses the request, remain fetch failures. These protections apply to traffic sent through Thermus MCP; an agent's other internet access remains outside this tool.

Lightpanda waits for `networkidle`. The fetcher allows 20 seconds from process launch for readiness, including navigation. It can return as soon as the page is ready. If the child has already exited when the deadline fires, the fetcher preserves its completion result. If the child is still running, the fetcher sends `SIGKILL` and waits for the child process callback. It then rejects with `Lightpanda readiness limit exceeded after 20000 ms`, even if that callback reports success. It does not return partial HTML.

Use the pinned Lightpanda **1.0.0** runtime. The [runtime setup guide](docs/lightpanda-runtime.md) gives the release download, SHA256 checks, version check, and `LIGHTPANDA_BIN` selection. Lightpanda supports [`--wait-until networkidle --wait-ms 60000`](https://lightpanda.io/docs/reference/cli/fetch) and can return partial HTML with success when its native wait limit expires. The fetcher's 20-second readiness limit prevents that output from being returned. The separate process timeout is 60000 ms, and the output limit is 32 MiB. Readiness does not guarantee that scripts or content that appear much later will be present. Test fixtures keep these production readiness options and allow loopback only inside the trusted test scope.

`WebsiteFetcher.fetchURL` returns `requestedUrl`, `finalUrl`, and `html`. `requestedUrl` keeps the URL as supplied. `finalUrl` is the URL of the returned page after redirects. Lightpanda still renders pages that need JavaScript.

The Lightpanda fetcher returns rendered HTML for successful HTTP responses. It reports HTTP responses with status 400 or above as `WebsiteFetchHttpError`. See [the fetcher contract](docs/reference/website-fetcher.md) for the error shape, CLI options, network policy, and local test requirements.

HTML-to-Markdown conversion uses only the fetch result that the pipeline receives. It does not make network requests or fetch missing content. The pipeline uses `finalUrl` to resolve relative links and to apply host rules. Pass the fetch result directly to the pipeline:

```ts
const page = await fetcher.fetchURL(url);
const result = await pipeline.process(page);
```

The result uses `removed` for HTML removal targets, `skipped` for unsupported ad processing attempts, and `found` for unique detection categories. Use `new Set(result.found ?? []).size` for a detection count. See [pipeline metrics](docs/reference/pipeline-metrics.md) for counting rules and the migration from earlier meanings.

The ad cleaner removes matching elements from the HTML source. It preserves adjacent source text when a paragraph or list item omits its end tag. This applies to paragraphs inside list items and before `dialog`, `search`, `menu`, `hgroup`, and `table`. Fragments without a doctype or an explicit `html` element use the same paragraph boundaries. It preserves tables between matched formatting elements that the parser reconstructs. It removes an ad body through the end of the source if the body has no end tag. It counts each matching element once, including overlapping selector matches, and honors element-hiding exceptions.

The ad cleaner indexes source lines once and slices retained spans once after it merges removal ranges. Repeated matches on one long line do not repeat newline or whitespace scans. Retained text keeps its exact source form.

Leading text can close an implied head without a closing token. The ad cleaner preserves that text, a leading doctype, and non-breaking spaces when it removes a matching element. With no match, it preserves the original source and counts.

The ad cleaner takes trusted ABP rules as a constructor string. Both production server compositions read the rules one time when they start, from the file that `AD_RULES_FILE` names. There is no rule updater: a changed file takes effect at the next start. The cleaner applies domain rules using the fetched page's `finalUrl`. See [Ad rules](docs/reference/ad-rules.md) for examples and no-op behavior.

The converter removes prohibited invisible controls from decoded text and attribute values before Defuddle converts the page. It checks logical text runs across inline elements and maps deletions back to the original text nodes. Block elements, line breaks, and images end a run. This keeps valid Persian ZWNJ and emoji ZWJ sequences when syntax highlighting splits them across spans. The converter also cleans link and image destinations before URL serialization. These checks run before Markdown escaping and code-fence selection. It checks the final Markdown and page title, then reports each finding once. The checks do not decode another layer of HTML entities. Escaped entity examples, ordinary ampersands, copyright signs, and supplementary characters stay visible.

The converter keeps escaped image examples in `noscript` as text. It does not parse the decoded text as HTML. Real image elements and their wrappers remain available to Defuddle. When both forms appear together, the fallback image and escaped example remain visible without a duplicate image. Preserved text is removed from the retained image tree, so repeated extractor callbacks do not copy it again. A small patch to pinned Defuddle 0.19.4 adds a callback to its Node entry point. It checks extracted content before cleanup, URL conversion, and Markdown conversion for selector-based and generated-HTML extractors, without another HTML parse. The converter applies the sanitizer's synchronous text check to DOM edits and aggregates findings with its public sanitizer API.

The Defuddle patch also keeps U+200D in its text and empty-line cleanup. This preserves emoji sequences such as woman-technologist (`👩‍💻`) in Markdown, including literal joiners and numeric character references split across visible inline nodes. The sanitizer still removes and reports prohibited bidi controls and joiners in ASCII words. Keep the patch until a dependency upgrade passes the emoji-joiner acceptance and Defuddle interface tests.

The pinned `agent-input-sanitizer` 1.47.14 patch reports the exact UTF-16 ranges that each text pass removes. The converter applies those ranges to the original DOM nodes. This keeps visible text in its original link or formatting element when an ANSI sequence contains the same characters. The patch does not change the control policy. Its optional callback uses the input offsets for each pass, after all earlier removals. Keep the patch until a dependency upgrade passes the sanitizer deletion interface tests.

The pinned LinkeDOM 0.18.13 patch makes HTML attribute serialization escape values in both ESM and CommonJS builds. Keep the patch until a dependency upgrade passes the encoded-control regression tests. It preserves escaped entity examples during Defuddle's serialize and reparse step.

HTML-to-Markdown conversion uses the cleaned HTML that the pipeline supplies. Input with no visible or embedded page content, including empty or whitespace-only input and input fully removed by sanitization, produces empty Markdown. For empty input or input that contains only tab, line feed, form feed, carriage return, or space, the converter sets `title` to `null` and preserves existing findings. A full document can contain page content in an embedded script, such as Substack `body_html`; the converter extracts that content synchronously from the supplied page. It sanitizes the source and extracted content and makes no network requests.

The converter preserves visible plain text and HTML fragments without `html` or `body` tags. For plain-text input, it escapes literal angle tokens such as `email <alice@example.com>` and `List<T>` in the Markdown output, and removes and reports prohibited raw controls. Full documents keep their metadata. The pipeline uses `finalUrl` to resolve relative links and apply host rules. Schema headline metadata remains available, including text with escaped slashes or CSS comments. Schema `articleBody` and `text` fields cannot restore content removed from the document body. An omitted `</head>` does not hide following body content.

Preformatted `<pre>` blocks and `<code style="white-space: pre">` keep their line breaks and become fenced Markdown code. Fragment code keeps relative indentation, including common and nested indentation, tabs, and leading whitespace. Conversion does not mutate the input context.

Each HTML conversion uses a `PreparedHtmlDocument`. `fromHtml(html, url)` parses the input and records its original fragment status. `extract(sanitizeText)` receives the sanitizer callback once and owns document preparation, source and extracted-content sanitation, local metadata and URL setup, concrete Defuddle extraction, and code-marker cleanup. The DOM, original URL, and fragment status stay private; extraction options and markers stay local to extraction. The converter receives finished content and title. It retains plain-text handling, final Markdown and title checks, and findings. DOM helpers remain free functions.

**Planned:** the cleaned page cache will use a versioned key made from the trusted tenant ID and the exact accepted absolute HTTP(S) URL string. The key will retain the full URL spelling, including the query and fragment. The caller's reason will be metadata, not part of content identity. No cache exists yet. See the [planned cache design](docs/design/cache-design.md) and [pending cache key tests](docs/testing/test-list.md#planned-cache-key-tests).

## Component structure

The source uses logical owners under `app`, `accounts`, `interfaces`,
`pipelines`, `logging`, and `runtime`. Grouping directories are not packages.
The shared review policy defines ownership and permitted dependencies. The
[current component registry](architecture/components.md) describes responsibilities,
public boundaries, and runtime dependencies. Follow the
[registry workflow](docs/implementation/component-registry-workflow.md) when a
change affects that map. The [component migration record](docs/design/component-structure-proposal.md)
keeps the reviewed move map as historical evidence. Server web code shares one
owner; browser modules remain separate from Node Vite tooling.

## Hidden-text sanitizer

`PromptInjectionRemoverSanitizer` is a pipeline step. It removes hidden HTML, comments, and invisible characters. It rejects HTML larger than 10 MiB in UTF-8 bytes. It adds HTML removal targets to `removed`, keeps unique findings and warnings in the context, and preserves `skipped`. It reports exfil-shaped URLs. A finding alone does not remove a visible URL. A URL in removed hidden HTML is removed with that HTML. See [the hidden-text sanitizer contract](docs/reference/hidden-text-sanitizer.md) for scan limits and reporting behavior.

The step also removes text with a proven effective font size below 12 CSS pixels by default. It keeps 12px and larger text. This policy can remove visible captions and footnotes. Set the independent cutoff with `new PromptInjectionRemoverSanitizer({ minTextFontSizePx: 8 })`. The option must be a finite, nonnegative number; invalid values raise `RangeError`. Set it to `0` to disable this small-text policy. Existing hidden-content rules, including the near-zero font rule, still apply.

The cutoff uses the resolved font size and the smaller projected axis scale from supported accumulated transforms. It checks each descendant separately, so a larger child font or a child transform can restore text. It keeps images when only the font size is below the cutoff. If the font size, transform, projected plane, or numeric error bound is unresolved, the small-text policy keeps the text. It removes text only when the supported checks prove that its effective size is below the cutoff. Text kept at the boundary includes 6px text enlarged by `scale(2)` and 24px text reduced by `scale(0.5)`.

The HTML scanner tracks visibility through parsed elements and template content on each removal scan. For effective `font-size` and `font` declarations, it resolves absolute lengths, inherited `em` and `%` values, and root-relative `rem` values. Root-relative sizes use only the actual HTML document root. A foreign element named `html` cannot replace that root size. It uses the original parser mode for CSS. It keeps the existing table boundaries for HTML without a doctype. In full quirks mode, a nonzero unitless `font-size` is in pixels. Standards and limited-quirks modes reject a nonzero unitless `font-size`. The `font` shorthand grammar does not change. The step removes text with a resolved zero font size. It keeps descendants that set a visible font size, and it keeps visible images. A zero font size alone does not remove a whole subtree. A recognized `var()`, `env()`, or `attr()` function makes the declaration's size unknown and lets it replace an earlier declaration at the same priority. This also applies when the CSS parser keeps typed `attr()` syntax as raw text. Raw values without a recognized deferred function, and malformed deferred function signatures, do not replace an earlier size. The font-size check does not compute full browser layout or values such as `calc()`.

The check also removes nonempty values from text-entry inputs when an effective author font rule confirms a near-zero size. Input type matching ignores ASCII case only. Missing and invalid types use the text state. Native HTML controls with no effective author font rule keep an unknown default size. A zero-font parent alone does not hide their values or labels. Images and other native controls remain subject to their supported element and transform rules.

Rules such as `display:none`, zero opacity, and applicable singular transforms still remove the whole subtree. The sanitizer decodes CSS escapes and validates each transform declaration before it replaces an earlier declaration in the cascade. A known invalid declaration does not replace an earlier valid declaration. The cascade respects `!important`. Deferred `var()`, `env()`, and `attr()` values replace earlier declarations, but remain unknown to the visibility check. Raw syntax without a valid named deferred function signature cannot replace a valid declaration. Perspective uses the same declaration order and `!important` rules.

The scanner uses known element defaults and effective display rules to check whether a local transform can apply. Known default boxes for `button`, `meter`, `progress`, and `fieldset` are transformable. The special box rules for `button` and `fieldset` also keep transforms active with an authored inline display. Their `display:none` and `display:contents` behavior still applies. A non-replaced inline flow box keeps its text when only its own transform would hide it. This includes inline and run-in list items. An inline flow-root list item remains transformable. Transform checks still apply to inline-block boxes and replaced content, such as images. They also apply when known positioning, float, or flex/grid rules make the box a block. The HTML root uses its blockified display, including when its declared display is `inline`, `contents`, or a table column. An unresolved root display cannot disable a known singular transform. Ordinary HTML wrappers with `display:contents` keep the nearest generated box's transform, perspective, and flex/grid context for descendants. Font size still inherits through the parsed parent. The wrapper's own box transforms and layout offsets do not apply. HTML elements suppressed by effective `display:contents`, including images, `meter`, and `progress`, are removed. Unknown element defaults or box applicability leave an authored local transform unresolved. An absent local transform, or an explicit `none`, `initial`, or `unset` value, keeps known inherited offsets and the element's own plane. Bounded exact proof also retains this state for supported matrix and scalar scale identities and zero translations, including supported lists that compose to identity. Rounded numeric identity is not sufficient. Unknown box generation leaves the child plane unresolved. Font inheritance and rules such as `display:none` still apply.

The sanitizer converts supported `matrix()`, `matrix3d()`, scale, rotation, and resolvable translate functions to matrices. It composes the functions in CSS order and accumulates supported affine transforms through ancestors. At a confirmed flat boundary, it projects the child into the parent's local XY plane before it applies the parent transform. It then checks the element's accumulated plane. A singularity check can remove a whole subtree only when the authored matrix values prove that the matrix is not invertible. A nearly singular matrix does not provide that proof. Local and accumulated affine matrices use the same rank rule. The check uses bounded exact arithmetic for supported matrix, scale, and translation values. Rounding or an unresolved exact determinant cannot prove rank loss. This keeps a child whose inverse restores the parent transform, including transforms with a Z translation or a non-planar matrix. The near-zero projected-axis rule requires an upper error bound below the size threshold. Unknown or excessive rounding error cannot prove that an axis is hidden. When exact projected rank is unavailable, a bounded projected-width check also detects an edge-on plane after in-plane rotations. This check affects local content only and keeps the existing exact nonzero matrix behavior. After the singularity check, projective matrices remain unknown because an unresolved transform origin can change their projection. Authored exact values determine whether a matrix is affine; numeric underflow or rounding cannot establish this condition. A pure-translation claim also requires exact proof that the authored linear part is identity. Numeric rounding of a scale or matrix cannot establish this claim. The sanitizer tracks pure translations and their error bounds through descendants. It declares an X or Y offset offscreen only when a finite upper bound stays below the threshold. The bounds include numeric conversion, local matrix composition, and ancestor addition. Cancellation, overflow, and unknown error cannot prove that content is offscreen. It removes offscreen text and void replaced elements, including images and input values, while it keeps descendants whose transforms return them to view. Position and margin declarations on generated boxes make inherited offsets unknown. It does not check translate operands one at a time, so opposite offsets or a matrix can cancel them. Rotation and scale also move the plane around its layout-dependent transform origin, so their offset entries alone do not prove that the plane is offscreen. A lone unresolved translate keeps the existing offscreen unit heuristic only when its parent has a proven zero transform offset. Rounded zero with nonzero uncertainty cannot enable that heuristic. Proven identity transforms and ordinary contents wrappers pass the offset state through unchanged. A lone unresolved `translate3d()` uses that heuristic for X and Y and ignores Z. A list with unresolved geometry can still hide a singular transform when the complete declaration has a supported valid form. Unresolved validity blocks that proof.

An exact zero scale factor can prove rank loss when each factor is a supported scalar value. This includes numeric or percentage literals in bounded single-value `calc()` and parenthesis wrappers, such as `scale(0,calc(1))`. The complete declaration must be valid before any zero factor can hide content. The check rejects known invalid scalar types, empty wrappers, dangling operators, and unsupported single-token forms before cascade selection. It validates supported wrapped result types in every transform argument. Valid wrapped relative lengths remain eligible for an independent zero-scale proof. General arithmetic and valid deferred values remain unknown and block that proof for the complete list. A valid named deferred function also keeps a declaration with a fixed invalid sibling unknown. The check does not infer a valid scalar from the CSS parser's structural math match alone.

A near-zero invertible plane hides local text but does not hide the complete subtree. The scanner checks both flat and preserved descendants for transforms that restore visible content. A confirmed flat box can hide its complete subtree when exact projected rank loss proves that no child can restore its plane. Unresolved box generation, `transform-style`, grouping values, and perspective leave child planes unknown. A deferred `overflow` shorthand leaves both axes unknown. Effective longhand declarations can replace those values according to source order and `!important`. The sanitizer keeps those planes because it cannot prove that they are hidden.

Supported grouping values for opacity, overflow, filters, clipping, isolation, masking (including `mask` and `mask-border` shorthands), blend mode, and paint containment make the effective `transform-style` flat. This includes paint containment from `content-visibility:auto`. Compound mask shorthands use each layer's image or source component; an omitted image or source is `none`. Deferred values remain unknown. For `clip`, the sanitizer requires a validated effective `position` of `absolute` or `fixed`. Declaration order and `!important` determine which property values apply. Applicable singular transforms and other rules that hide a whole subtree still apply. The sanitizer does not fully evaluate stylesheets, layout, or perspective context.

The project pins `agent-input-sanitizer` to `1.47.14` and applies [a local pnpm patch](patches/agent-input-sanitizer@1.47.14.patch) for these visibility rules. The patch exposes declaration validation and element visibility state to the CSS pass and source-range scanner. It reuses the package's CSS parser. Use `pnpm install` to install or reinstall the packages with the patches. Keep the patch and pnpm configuration when you update dependencies.

`PromptInjectionRemoverSanitizer` always parses its input as HTML, regardless of document length or tag density. It preserves visible text in `pre` and `code` elements and encoded tag examples. It still removes hidden descendants.

Removed HTML and comments leave no generated markers. Authored marker text stays unchanged in visible text, code, and attributes, including URL values. The step checks URLs before each removal and in the final HTML. It retains findings from removed content and reports each category and warning reason once. A flagged visible URL stays in the HTML. The scanner visits nested template content and preserves source offsets.

The sanitizer first removes prohibited invisible controls. It keeps valid literal U+200D joiners across visible inline HTML by checking decoded text runs and mapping permitted positions back to the source. Block elements, line breaks, images, comments, and hidden content end a run. Raw tag names, attributes, and hidden content still receive control checks. The provider’s shared document and cluster limits still apply. Source spelling, including character references, stays unchanged. Complete ANSI sequences are removed before context checks; remaining ANSI introducers use the default raw policy. A CSS pass then checks inline styles and local `<style>` rules. Inline style checks include elements inside nested templates. A style block is active when its `type` is empty or `text/css`, its `media` is empty or `all`, and it is outside a `<template>`. Stylesheet selectors do not match template content. The pass reads top-level rules with type, universal, ID, class, attribute, and combinator selectors. It rejects pseudo selectors and namespace selectors. It rejects a whole rule when any selector in its selector list is unsupported.

The CSS pass checks only declarations related to visibility. It applies `!important`, selector specificity, and source order. For declarations with equal importance, inline styles have higher specificity than stylesheet rules. This follows the [CSS Cascade specification](https://www.w3.org/TR/css-cascade-4/#cascade-sort). CSS escapes and case in declaration names, keyword identifiers, units, and function names are normalized before the check. Attribute selector `i` and `s` flags are also decoded before matching. The `i` flag folds ASCII letters only. Class selectors and the attribute `~=` operator split values only at HTML whitespace: tab, line feed, form feed, carriage return, and space. Escaped selector characters are decoded, including an escaped leading digit in an ID and an escaped `*` in a type name. An invalid selector in a selector list rejects the whole rule.

The pass gives each parsed element's effective declarations to the HTML scanner. The scanner combines these declarations with inherited font and transform state before it checks visibility. The scanner removes hidden source content directly. It keeps the original style attributes during removal scans. An unchanged visible source tag keeps its effective CSS declarations on later scans. This prevents removal of a hidden sibling from hiding visible content through a changed selector match. Implied wrappers keep their effective declarations when unchanged source content identifies them. New elements use the current CSS rules. A new hidden ancestor still removes its descendants. A style rule formed by a removal applies to new elements; it does not change the saved declarations of retained elements. The scanner computes parent visibility again on each scan. Saved declarations apply only to the current invocation. After the last clean scan, the sanitizer sets resolved visible inline styles to an empty value. This prevents Markdown conversion from applying a different declaration order. The sanitizer keeps control-character findings from decoded style values before it clears them. It does not decode escaped entity examples again. A fully hidden document returns empty HTML and Markdown.

Embedded selectors match a `parse5` HTML tree. The parser inserts implied `html`, `head`, and `body` elements before selector matching. It also inserts implied `tbody` elements in tables, as specified by the [HTML parsing rules for tables](https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-intable). Each scan builds class, ID, and type indexes as needed to skip impossible selectors and select candidates after relevant declarations are found. Descendant or child combinators can limit targets to an indexed ancestor's descendants; sibling combinators prevent that restriction. The exact matcher still checks every candidate. The [sanitizer contract](docs/reference/hidden-text-sanitizer.md) gives the candidate rules.

The CSS work budget for each scan remains 1,000,000 units. Index construction, class-token entries, lookups, subtree traversal, node checks, parent reads, attribute reads, and returned name and attribute characters use that budget. Class selectors reuse parsed tokens within one scan. The first class read charges the string length; each token lookup still charges work. A new scan has fresh indexes, tokens, descendant sets, and budget. A selector can contain at most 128 direct selector nodes and 4096 generated characters. Exceeding a selector limit or the scan work budget raises `RangeError`; cleaning fails without returning partly checked HTML or Markdown.

The hidden-style checks cover `display:none`, `visibility:hidden` or `collapse`, and `content-visibility:hidden`. They also cover opacity below `0.01`, near-zero font sizes, far offscreen offsets, zero-area clips, hiding transforms and opacity filters, transparent or same-color text, and near-zero dimensions with `overflow:hidden`. A near-zero length or size has magnitude below `0.01`. An offset below `-900` in these units counts as offscreen: `px`, `em`, `rem`, `ex`, `ch`, `pt`, `pc`, `in`, `cm`, or `mm`. An offset at or below `-100` in `vw`, `vh`, `vmin`, or `vmax` also counts as offscreen. Percentage box offsets and `text-indent` use the same `-100` rule.

The sanitizer hides `clip:rect()` when opposite edges match within `0.01` in the same units. It hides `clip-path:circle(0)`. It also hides an `inset()` when all four expanded edges are at least `50%`.

The transform checks use the composed matrices and inherited state described above. An `opacity()` filter below `0.01` also counts as hidden. These checks do not use rendered geometry or full browser layout.

This check does not fetch linked stylesheets or `@import` rules. It supports the bounded local opacity animations in [the sanitizer contract](docs/reference/hidden-text-sanitizer.md#local-opacity-animations). A supported animation that can reveal content makes opacity unknown without an animation clock. Important opacity and independent hiding rules still apply. Other at-rules, media queries, layers, and nested rules are skipped. The check cannot resolve deferred values, calculated values, page geometry, or all inherited properties and shorthands. The font and transform checks support only the units, functions, inheritance, and shorthand rules described above. An unresolved `background`, `background-color`, or `background-image` value prevents a same-color verdict because unknown paint may make text readable. A percentage in `translate()` cannot prove that content is hidden. An unresolved value alone cannot prove that content is hidden. An independent supported rule can still hide content. Inherited properties outside the supported font and transform rules retain the existing subtree behavior. For example, a hidden `visibility` value can still remove descendants that override it. Selector matching uses browser-compatible HTML tree construction, but the visibility checks do not compute full browser layout.

The step applies the configured font-size cutoff to visible text. It does not enable content-based span deletion, secret redaction, or homoglyph normalization. It does not fetch pages or call a model. The self-hosted server adds this step to its cleaning pipeline in [`src/app/fetch-tool.ts`](src/app/fetch-tool.ts). Startup warm-up remains deferred.

The ad cleaner limits parsed HTML to 256 element levels. See [HTML processing limits](docs/reference/html-processing-limits.md) for the depth rule and error behavior.

**Current tool.** `getURLAsMarkdown(url, reason)` provides protected fetching, cleaning, exact Markdown, and best-effort completion records in both server editions. **Planned:** tenant allowlists and denylists, outbound redaction, content hashes, and a per-tenant content cache.

Later scope includes step-up approval and outgoing policy. A second renderer, request-level ad blocking, and other connectors remain outside this work. Current calls return cleaned Markdown or a fixed failure, and each dispatched call attempts a best-effort completion record.


## MCP server component

[`MCPServer`](src/interfaces/mcp/mcp-server.ts) wraps the official TypeScript SDK v2. Pass an SDK transport to `server.connect(transport)` and call `await server.close()` to release the connection. The SDK handles `server/discover` and advertises the `thermus` identity with support for protocol version `2026-07-28`. A stdio connection has no verified user, so it registers no tools. A later local stdio entry must first bind a selected active local user.

For HTTP requests, construct the server with `{ auth: { verifier, accessResolver, resourceMetadataUrl, expectedResource }, buildServer, reportFailure }` and call `await server.fetch(request)`. The verifier implements our [`IdentityVerifier`](src/accounts/identity/identity-verifier.ts) contract, and the access resolver implements [`AccessResolver`](src/accounts/identity/access-context.ts). MCPServer validates the Authorization header before the SDK verifies the token. Missing or malformed headers receive HTTP 401 with a Bearer challenge and the configured protected-resource metadata URL. Call `await server.close()` to release the HTTP handler and any transport connection.

`verifyAccessToken(token)` returns a `VerifiedIdentity`: the verified user (`authority`, `subject`, and an optional `selectedOrganizationId`), the token `issuer`, the OAuth `clientId`, the granted `scopes`, `issuedAtUnixSeconds`, `expiresAtUnixSeconds`, and the `resource` URL from the token audience. A provider accepts only human user tokens. The client ID identifies the client application; it is never a user or tenant ID. Throw `InvalidAccessTokenError` to reject a token. The adapter turns that error into a generic `401 invalid_token` response. It gives the same response for an identity without a user, issuer, client ID, issue time, expiration, or audience, and for an identity whose user subject is the client ID. Any other verification error is unexpected. It receives a generic `500 server_error` response, and MCPServer reports it to `reportFailure`. The adapter puts frozen copies of the verified claims in `AuthInfo.extra`: `user`, `issuer`, `clientId`, `scopes`, `issuedAt`, `expiresAt`, and `audience`.

`auth.expectedResource` is the MCP resource URL. The SDK rejects an expired token or a token for another audience with `401 invalid_token`. Set `auth.requiredScopes` to require OAuth scopes. The SDK rejects a token without them with `403 insufficient_scope`, and the Bearer challenge includes the required scopes. Require only scopes that the configured OAuth flow can grant.

MCPServer verifies each token once. Then it gives only the verified user to `accessResolver.resolve(user)`. Request headers, tool arguments, earlier requests, and the client ID cannot select the user, tenant, or organization. An allowed decision carries a `RequestContext` from `createRequestContext()`: the user, the trusted tenant ID, the optional organization, every current role grant, and the union of the permissions of all grants. MCPServer binds a frozen copy of that context to the request. The SDK factory gives it to `buildServer(context)`, which returns an SDK `Server` or `McpServer`. Each tool calls `requirePermission(context, permission)` before its work starts. A denied decision receives `403 access_denied` without a Bearer challenge. A resolver failure, or an allowed decision without a tenant ID, receives a generic `500 server_error`, and MCPServer reports it to `reportFailure`. After a refusal, no factory, tool, or MCP dispatch runs. In the self-hosted edition, the production `buildServer` gives each request a server with both tools below.

Both server editions register [search](docs/reference/mcp-search-tool.md), `search(query, reason)`, and the [HTTP fetch tool](docs/reference/mcp-fetch-tool.md), `getURLAsMarkdown(url, reason)`. Their discovery descriptions direct web queries to search and known URLs to fetch. [`createToolOperations(environment, logger)`](src/app/fetch-tool.ts) reads the [trusted ad rules](docs/reference/ad-rules.md#server-rules-file) once. It creates both operations with one shared `WebsiteFetcherLightpanda`, ad cleaner, sanitizer, outgoing observation step, record sink, and renderer setup reporter. Each operation has its own converter; search enables result preservation. `fetchToolServers(operations, logger)` gives each MCP request its own SDK server with both operations.

Search uses the public Brave website through Lightpanda, with no API key. It processes the first results page and fetches no result links. Brave can block or rate-limit requests. Search accepts 1–512 well-formed Unicode scalar values and a nonblank reason of 1–2,000 code points; it refuses extra fields. An explicit no-results page gives `No search results.` after incoming checks. Known scan withholding gives the error `Search content withheld`. The [SEARCH-05 record](docs/implementation/search-05.md) covers public MCP verification. The [SEARCH-09 record](docs/implementation/search-09.md) gives the stronger live result/description proof and final selected checks. The [SEARCH-06 record](docs/implementation/search-06.md) retains the earlier pinned search runtime results and dated live Brave evidence.

The [MCP cancellation follow-up](docs/implementation/search-mcp-cancellation.md) covers cancellation during failure inspection and records verification for the later candidate.

Search completion records retain trusted identity, operation ID, tool, fixed status, and duration. They omit query, reason, URL, page, and failure data. Fetch keeps its existing completion fields, including the URL origin/path and reason.

`FetchPage` checks product access, the URL, and operation identity before its outgoing executor runs the observation step. Only allow with the exact original URL advances to fetch; block, failure, or invalid output gives the fixed fetch error. `ProcessHtmlStep` checks the shared HTML size limit before any cleaner or parser runs and runs the fixed HTML pipeline once. Its incoming executor validates string Markdown before release. A typed `scan_failed` or `scan_limit` signal blocks the incoming step and returns a payload-free withheld outcome. The MCP adapter maps only those known incoming codes to exact empty success; ordinary empty output is allowed. Unknown codes, invalid output, and generic blocks give the fixed processing error. Warnings do not select a release decision. `requestedUrl` keeps the accepted spelling; `finalUrl` selects ad rules and resolves relative links. Per-call and shutdown cancellation, renderer diagnostics, and hosted capacity ownership stay in force. The [hosted edition](#hosted-edition) uses WorkOS Connect and current User grants. `createHostedToolOperations` gives fetch and search one shared capacity of `OPERATION_CAPACITY` calls, default 10, through operation settlement and cleanup.

Dispatch generates an operation UUID before tool/argument checks and carries it with the same cancellation signal through the protected operation. Each dispatched `tools/call` attempts one JSON completion record with that ID. Each entered outgoing or incoming step also attempts one fixed `pipeline.step.completed` record with that ID, its fixed step ID, outcome, bounded duration, and an optional fixed code. It includes no URL, reason, payload, or raw error; sink failure cannot change the decision or repeat work. The MCP arguments and exact Markdown result remain unchanged. Outgoing policy remains planned. The fetch completion record is best effort; its URL path and verbatim reason can contain sensitive text. The SDK owns envelope parsing and its 4 MiB body limit. Tests can supply fetcher and step doubles or run the real cleaner behind the HTTP bridge in modern and legacy protocol eras. The [MCP-PIPE-01 record](docs/implementation/mcp-pipe-01.md) gives the completed extraction evidence; the [MCP-PIPE-02 record](docs/implementation/mcp-pipe-02.md) records operation correlation and its verification results. The [MCP-PIPE-03 record](docs/implementation/mcp-pipe-03.md) records outgoing observation and fixed step records, merged in PR #160. The [MCP-PIPE-04 record](docs/implementation/mcp-pipe-04.md) tracks incoming processing and typed withholding.

`reportFailure(report)` lets the operator see an unexpected failure, such as a provider outage. MCPServer calls it one time for each request that fails unexpectedly, before the client gets the generic `500 server_error`. The client response does not change. The [`FailureReport`](src/interfaces/mcp/mcp-server.ts) has the failed `step`, `token-verification` or `access-resolution`, and the original error as its `cause`. Expected results give no report: a missing or malformed Authorization header, a rejected token, a missing scope, and an access denial. A report contains no request data, so it holds no raw token, cookie, password, or other credential from the request. The verifier receives the raw token, so its errors must not contain the token. The callback must not throw. The composition decides where the reports go; MCPServer adds no logging framework or telemetry.

The [discovery test](test/unit/mcp/discovery.test.ts) connects a real SDK client through an in-memory transport. The MCP request tests use [`IdentityVerifierSpy`](test/support/doubles/auth/identity-verifier-spy.ts), [`AccessResolverSpy`](test/support/doubles/auth/access-resolver-spy.ts), [`FailureReporterSpy`](test/support/doubles/mcp/failure-reporter-spy.ts), and test-only factory tools with the real SDK middleware. The [authentication integration tests](test/integration/mcp/auth.test.ts) execute the canonical auth rejection class. The [access-context integration tests](test/integration/auth/mcp-context.test.ts) add real context creation and permission checks. Request-context binding remains unit coverage with type-only shared records. The [access acceptance tests](test/acceptance/auth/mcp-access.test.ts) and the [failure report acceptance tests](test/acceptance/auth/mcp-failure-reports.test.ts) use a real MCP client. The [test inventory](docs/testing/test-list.md) lists the cases. In the self-hosted edition, [`BetterAuthProvider`](src/accounts/providers/better-auth/better-auth-provider.ts) is the verifier and the access resolver, and Better Auth serves the metadata documents; the [sign-in and MCP client guide](#sign-in-and-mcp-clients) gives the details. In the [hosted edition](#hosted-edition), [`WorkOSAuthProvider`](src/accounts/providers/workos/workos-auth-provider.ts) checks Connect tokens and reads the current grants from WorkOS. The [authentication plan](docs/design/authentication-design.md#pinned-workos-sdk-proof) records the historical WorkOS SDK and live provider results. The [Better Auth interface proofs](test/interface/auth/better-auth.test.ts) check the pinned local provider packages; the [authentication plan](docs/design/authentication-design.md#pinned-provider-proof) records the proven contracts and the resolved provider blockers.

## Deployment configuration

[`loadDeploymentConfig(environment, transport)`](src/runtime/config/deployment-config.ts) checks the settings before the server listens. It reads only the record that it gets, never `process.env` directly. A missing or incorrect setting throws `DeploymentConfigError`; the message names the setting and the rule, but never its value. [`.env.example`](.env.example) documents each setting with placeholder values.

- `DEPLOYMENT` alone selects the edition: `self-hosted` or `hosted`. There is no `AUTH_MODE`, no mock mode, and no setting that enables paid features locally. Invalid hosted settings never fall back to the self-hosted edition or to anonymous access.
- `PUBLIC_BASE_URL` is the canonical public address. It gives the MCP resource URL (`<base>/mcp`) and its protected-resource metadata URL. Forwarded request headers never change it. It has no credentials, query, or fragment. The hosted edition requires `https` and the root base path `/`. The self-hosted edition requires `https`, but it can use `http` on `localhost`, `127.0.0.1`, or `[::1]` for local development.
- The self-hosted edition reads `DATA_DIR`, an absolute path.
- The hosted edition also needs the five `WORKOS_*` settings. The WorkOS provider reads and checks them itself, so the common settings never turn WorkOS on. Hosted startup rejects stdio.
- [`loadListenAddress(environment)`](src/runtime/config/deployment-config.ts) reads the optional `LISTEN_HOST` and `LISTEN_PORT` for both editions. The defaults are `127.0.0.1` and `8080`. The port is a whole number from 0 to 65535; with 0, the system selects a free port. The listen address never changes the public identity from `PUBLIC_BASE_URL`. Use `LISTEN_HOST=0.0.0.0` in a container.

The server calls both loaders before it opens any resource or listens.

Both server editions read `AD_RULES_FILE` and `LIGHTPANDA_BIN` when they start. `loadDeploymentConfig` does not read them. The local account and client commands share that loader and never read these settings. The [self-hosted server](#self-hosted-server) and [hosted edition](#hosted-edition) sections give the startup rules.

## Self-hosted server

Start the server from a build, or run it in a container as [container installation](#container-installation) tells. For a build, `DATA_DIR` must be an existing directory, and `AD_RULES_FILE` must name an existing rules file. `LIGHTPANDA_BIN` selects the renderer:

```sh
mkdir -p /tmp/thermus-data
touch /tmp/thermus-ad-rules.txt
pnpm build
DEPLOYMENT=self-hosted PUBLIC_BASE_URL=http://localhost:8080 DATA_DIR=/tmp/thermus-data \
  AD_RULES_FILE=/tmp/thermus-ad-rules.txt \
  LIGHTPANDA_BIN="$(pwd -P)/.cache/lightpanda/1.0.0/lightpanda" pnpm start
```

`touch` makes an empty rules file when the file does not exist. An empty file gives no ad rules; the other cleaning steps still run. To remove ads, put a trusted Adblock Plus list in the file. The [runtime setup guide](docs/lightpanda-runtime.md) installs the pinned Lightpanda 1.0.0 at the `LIGHTPANDA_BIN` path above. Without `LIGHTPANDA_BIN`, the server uses `lightpanda` on `PATH`.

[`src/index.ts`](src/index.ts) starts the server when it gets no arguments. With arguments, it runs one of the offline [local account and client commands](#local-accounts-and-clients). The server loads the settings, calls [`createApplication(config, logger, environment)`](src/app/application.ts), and serves the application through the Node HTTP bridge, [`startHttpServer()`](src/runtime/http/server.ts). The third argument is the server environment, for the settings that only the server reads: `AD_RULES_FILE` and `LIGHTPANDA_BIN` for both editions, and the `WORKOS_*` settings for the hosted edition. `serve()` loads the settings and then calls `serveApplication()`, the exported serve sequence, with `createApplication()`. The server writes `Listening on <address>` to stderr. `SIGINT` or `SIGTERM` stops it: the HTTP server stops, then the application releases its resources, and the process exits with status 0. The server registers the stop handlers before it writes the `Listening on` line. Thus a script can send a signal as soon as the line appears, and the server still stops cleanly. A second signal ends the process at once. A startup failure writes one `FATAL` line, which names the problem but no secret, and exits with status 1.

`createApplication()` makes the one edition branch. The self-hosted branch loads the tool composition and the Better Auth runtime. The branch calls [`createToolOperations()`](src/app/fetch-tool.ts) first. That call reads `AD_RULES_FILE` and makes both operations and their shared resources. The branch gives the pair to `fetchToolServers()`. Then it opens the Better Auth runtime. Thus a rules failure holds no resource and changes no data. The hosted branch uses `createHostedToolOperations()` with the WorkOS provider and never falls back to the self-hosted edition.

**Ad rules file.** `AD_RULES_FILE` is required. It is the absolute path of a trusted Adblock Plus rules file in UTF-8. The server reads the file one time when it starts and keeps those rules until it stops. A changed file takes effect at the next start. There is no size limit and no syntax check; the [ad rules reference](docs/reference/ad-rules.md#server-rules-file) gives the details. After a rules failure, the server writes one `FATAL` line and exits with status 1, before it opens the data directory or listens. No message shows the path or the file contents:

- `AD_RULES_FILE is required. Set it to the absolute path of a trusted ad rules file.`: the setting is not set or is empty.
- `AD_RULES_FILE must be an absolute path.`: the path is relative.
- `AD_RULES_FILE could not be read (<code>).`: the read failed, for example with `ENOENT`, `EISDIR`, or `EACCES`. The code is `unknown error` when the error has no string code.
- `AD_RULES_FILE must contain UTF-8 text.`: the file is not UTF-8.
- `The ad cleaner could not load the rules in AD_RULES_FILE.`: the native adblock-rs parser failed. Its message is not shown.

**Renderer.** Startup does not run or check the renderer. A server with a missing executable starts. Each page fetch then gets the tool error `Page fetch failed` and a `fetch_failed` completion record. The error that names the missing executable does not reach the client or the record. The server log gets one `Renderer setup failure` line for each error code, such as `ENOENT` or `EACCES`, without request data; the [renderer setup report](docs/lightpanda-runtime.md#renderer-setup-report) explains it. Each failed fetch also writes a structured `renderer.fetch.failed` event linked to its completion by `operationId`, with safe observed status, renderer code, exit fields, and failure phase when available. Unknown facts stay unknown; successful and cancelled fetches write no failure event. See the [diagnostic fields](docs/reference/mcp-fetch-tool.md#fetch-failure-diagnostics). Verify the runtime before use with the [runtime setup guide](docs/lightpanda-runtime.md).

[`openBetterAuthRuntime(settings)`](src/accounts/providers/better-auth/better-auth-runtime.ts) owns the local resources and opens them in this order:

1. The exclusive data-directory lock, `DATA_DIR/data-directory.lock`, from [`lockDataDirectory()`](src/accounts/providers/better-auth/data-directory-lock.ts). Another server or command that uses the same directory stops with `DataDirectoryInUseError` and changes no data. The lock does not wait for its holder, so that process stops at once. When several processes start at the same time with the same directory, exactly one of them gets the lock. The operating system releases the lock when the process ends, also after a crash.
2. The installation, from [`openLocalInstallation()`](src/accounts/providers/better-auth/local-installation.ts). For fresh data, it writes a generated secret to `auth.secret`. Then, in one transaction, it applies the shipped migrations to `auth.sqlite` and stores one installation UUID in the singleton `thermus_installation` row. Both files have mode `0600`. The singleton holds only the installation identity; it does not limit the number of accounts.
3. Better Auth with the [proven provider settings](docs/design/authentication-design.md#pinned-provider-proof). `clientReference` returns the installation ID, so the installation owns each registered client. Startup waits for the provider's schema check and stops if the schema does not match. The settings keep the origin and CSRF checks on, also with `NODE_ENV=test` or with `TEST` set. Better Auth reads `BETTER_AUTH_SECRETS`, `BETTER_AUTH_TRUSTED_ORIGINS`, and `BETTER_AUTH_TELEMETRY` from the process environment, also when a setting disagrees. No setting stops that without another effect: the `secrets` setting stops `BETTER_AUTH_SECRETS`, but it changes the encryption format of the stored keys. Thus, when one of these variables has a value, startup stops with `ProviderEnvironmentError`, which names the variable but not its value. The provider secret is always `auth.secret`. The [provider environment variables](docs/design/authentication-design.md#provider-environment-variables) give the reasons.

The runtime reports the tenant `local:<installation-id>`, and the server logs it at startup. If a startup step fails, the runtime releases the resources that it already holds, in reverse order. `close()` closes the database and then releases the lock.

Retained data keeps its identity. Startup stops with `LocalInstallationError` when a database with schema objects has no valid installation identity, when `auth.secret` is missing or not valid, or when the database has another schema version. The server never creates a new identity for retained data. To recover, restore the complete data directory from a backup, or move the data away to start a new installation. Fresh data always gets a new tenant.

The server starts with zero accounts or with only disabled accounts, and protected access stays denied. To recover, stop the server and add an account with `users add`. The application routes each request by its path. The MCP endpoint, `<base>/mcp`, goes to MCPServer, which uses [`BetterAuthProvider`](src/accounts/providers/better-auth/better-auth-provider.ts) to verify each token and to check the current account. The discovery documents, `<base>/api/auth/oauth2/authorize`, and `<base>/api/auth/oauth2/token` go to Better Auth. The bundled pages, `<base>/sign-in`, `<base>/consent`, and `<base>/authorization-error`, go to [`LocalAuthPages`](src/interfaces/web/auth/better-auth/local-auth-pages.ts). Other paths give `404`, also the provider's sign-up, sign-in, session, introspection, and client routes, so there is no public sign-up or account-create route. The application gives MCPServer [`operatorFailureReporter(logger)`](src/app/application.ts) as `reportFailure`: it writes each failure report as one `ERROR` line with the failed step and the cause. A missing or rejected token gives no report. Without a resource-server client for the MCP resource of `PUBLIC_BASE_URL`, the MCP endpoint cannot check a token: a request with a valid token gets a generic `500`, and its `ERROR` line tells the operator to run `clients register`. The [sign-in and MCP client guide](#sign-in-and-mcp-clients) describes the flow.

The HTTP bridge builds each request URL from the origin of `PUBLIC_BASE_URL` and the request target, so the `Host` header and forwarded headers cannot change it. It refuses a target that is not in origin form (`/path?query`) with `400`, and `TRACE` with `501`. It removes every client copy of `x-thermus-client-address` and sets that header to the socket address, for the provider's rate limits. It streams request and response bodies and keeps each `Set-Cookie` header separate. When a client disconnects, it aborts the request signal and cancels the response body. A handler failure gives a generic `500` and a log line without request data. When the server stops, the bridge refuses new connections and at once ends idle connections and connections that have sent no request. It lets running responses finish and ends the remaining connections after five seconds. During the stop, the bridge ends the connection of a finished response as soon as Node has read the complete request, also when the handler did not read the request body.

To make a backup, stop the server and copy the complete data directory. To restore, copy all of its files together into an empty directory, and start the server with that `DATA_DIR`. The installation ID, the tenant, the user IDs, the browser sessions, the registered clients, the consents, the signing keys, and the resource-server client in `resource-server-client.json` stay the same. Filesystem access to the data directory is administration authority for the installation; it gives no application role.

[`migrations/auth-local/`](migrations/auth-local/) holds the shipped SQL. `0001-better-auth.sql` is the output of Better Auth `compileMigrations()` for the pinned packages and the provider settings on an empty database. `0002-installation.sql` adds the singleton installation table. The server never downloads a migration tool. A unit test fails if the shipped SQL is different from the output of the pinned provider; after a change to the provider packages or settings, generate the file again.

## Container installation

The container image is the self-hosted evaluation edition. It holds the server and the offline commands of the same program, the shipped migrations, the bundled sign-in and consent pages, the pinned production packages, and the pinned [Lightpanda 1.0.0 renderer](docs/lightpanda-runtime.md#container-image) with the CA certificates that it needs for HTTPS pages. The image build supports `linux/amd64` and `linux/arm64`, the platforms of the Linux renderer assets, and stops for another platform. The server and the commands need no outbound connection: a start downloads nothing, and telemetry is off, also the telemetry of the renderer. Only a call of the `getURLAsMarkdown` tool connects out: it looks up the host of the page in DNS, and the renderer loads the page and its resources. The renderer blocks private and loopback addresses, as on a local Node process.

You need Docker Engine with Buildx and Compose. The image build downloads the pinned base images, the packages, and the Lightpanda asset of the platform, so the build needs network access. The build checks the asset against the SHA256 digest that the [runtime guide](docs/lightpanda-runtime.md#container-image) records, and a mismatch stops the build. Run the commands from the repository root. Before the first `docker compose up` or `docker compose run`, make the trusted rules file `ad-rules.txt` next to `compose.yaml`:

```sh
touch ad-rules.txt
docker compose build
docker compose up -d
docker compose logs thermus
```

`touch` makes an empty rules file. With an empty file, the server uses no ad rules, as the [ad rules reference](docs/reference/ad-rules.md#server-rules-file) tells. To remove ads, put a trusted Adblock Plus list in the file instead, for example a copy of a list that you chose and checked. Compose mounts the file read-only and does not make it. Without the file, each Compose command that starts a container of the service stops with the error `bind source path does not exist`. This includes `docker compose run --rm thermus users ...`. Compose makes no directory in place of the file. Git and the image build ignore `ad-rules.txt`.

The log shows the tenant of the installation and `Listening on http://0.0.0.0:8080`. A fresh installation has no account and no client. Add them as **Accounts and clients** below tells. Then a user can connect a supported MCP client to `http://localhost:8080/mcp`; the [sign-in and MCP client guide](#sign-in-and-mcp-clients) gives its settings. `docker compose stop thermus` stops the server, and `docker compose start thermus` starts it again.

**Settings.** [`compose.yaml`](compose.yaml) has one service, `thermus`, with an init process. The [`Dockerfile`](Dockerfile) sets `DEPLOYMENT=self-hosted`, `DATA_DIR=/var/lib/thermus`, `AD_RULES_FILE=/etc/thermus/ad-rules.txt`, `LIGHTPANDA_BIN=/opt/lightpanda/1.0.0/lightpanda`, `LIGHTPANDA_DISABLE_TELEMETRY=true`, `LISTEN_HOST=0.0.0.0`, `LISTEN_PORT=8080`, and `NODE_ENV=production`, and the image runs as the `node` user. Root owns the renderer, so the `node` user cannot change it. The image has no rules file at `AD_RULES_FILE`. The service mounts `./ad-rules.txt` there read-only, with `create_host_path: false`. The server reads the file when it starts; the commands do not read it. The service sets `PUBLIC_BASE_URL`, by default `http://localhost:8080`, and publishes port 8080 on `127.0.0.1` only. With `http` on `localhost`, the port of `PUBLIC_BASE_URL` is the published port. Another address must use `https`: put a TLS reverse proxy in front of the published port, and set `PUBLIC_BASE_URL` to the address of the proxy, in the shell or in a `.env` file next to `compose.yaml`. A registered client belongs to the MCP resource of one `PUBLIC_BASE_URL`, so after a change, register the clients again. A published port and a reverse proxy give the server the same client address for all users. Thus the sign-in limit of three attempts in ten seconds for each client address applies to all users together. The only telemetry setting of the image is `LIGHTPANDA_DISABLE_TELEMETRY=true`. It turns telemetry off for each Lightpanda run in the container, and the fetcher also sets it for each renderer run (see [runtime telemetry](docs/lightpanda-runtime.md#telemetry)). Do not set `BETTER_AUTH_TELEMETRY` or the other [refused Better Auth variables](#self-hosted-server): startup stops.

**Data volume.** The named volume `thermus_thermus-data` is mounted at `DATA_DIR`. It holds all data of the installation: `auth.sqlite` with the accounts, sessions, clients, consents, signing keys, and installation identity; `auth.secret`; `resource-server-client.json`; and `data-directory.lock`. The image keeps no data. Only the `node` user of the image can open the directory (mode `0700`). `auth.sqlite`, `auth.secret`, and `resource-server-client.json` have mode `0600`. Access to the volume is administration authority for the installation; it gives no application role.

**Accounts and clients.** The commands of [local accounts and clients](#local-accounts-and-clients) run in a one-off container of the same image with the same volume. Stop the server first, and start it again after the commands:

```sh
docker compose stop thermus
docker compose run --rm thermus users add alice@example.com
docker compose run --rm thermus users add bob@example.com
docker compose run --rm thermus users list
docker compose run --rm thermus clients register --user alice@example.com --name "Native MCP client" --redirect-uri http://127.0.0.1:33418/callback
docker compose start thermus
```

In a terminal, `docker compose run` gives the command a terminal, so the password prompts do not show the typed characters. A script can add `-T` and write one line for each prompt to standard input:

```sh
printf '%s\n%s\n' "$NEW_PASSWORD" "$NEW_PASSWORD" | docker compose run --rm -T thermus users add carol@example.com
```

While the server runs, each command stops with the lock error and changes nothing. A command in the server container, such as `docker compose exec thermus node /app/dist/src/index.js users list`, is another process on the same volume, so the lock stops it too.

**Restart and update.** A restart (`docker compose restart thermus`), a new container (`docker compose up -d --force-recreate`), and a new image (`docker compose build`, then `docker compose up -d`) keep the volume. The installation ID, the tenant, the user IDs, the sessions, the clients, the consents, the signing keys, and the access tokens stay usable. An image with another schema version of the database stops at startup and changes no data, because this version has no data migration. The server reads `ad-rules.txt` only when it starts. After a change of the file, make a new server container with `docker compose up -d --force-recreate thermus`. Do not use only `docker compose restart thermus`: a restarted container keeps its old mount. If an editor replaced the file, the restarted server can find no file and stop with `AD_RULES_FILE could not be read (ENOENT).`

**Backup and restore.** Stop the server, and copy the complete volume to a tar archive with the `tar` program of the image:

```sh
docker compose stop thermus
docker compose run --rm -T --entrypoint tar thermus -cf - -C /var/lib/thermus . > thermus-backup.tar
docker compose start thermus
```

The archive holds the provider secret and the signing keys. Keep it as safe as the volume. To restore, put all files of one archive into an empty volume, and then start the server:

```sh
docker compose down
docker volume rm thermus_thermus-data
docker compose run --rm -T --entrypoint tar thermus -xf - -C /var/lib/thermus < thermus-backup.tar
docker compose up -d
```

The restored installation keeps its tenant, the user IDs, the sessions, the clients, the consents, and the signing keys. The database and `auth.secret` must come from the same archive. Retained data without its installation identity, or without `auth.secret`, stops each start with a `FATAL` line that asks for a restore. The server never makes a new identity for retained data. Docker starts the service again and again, and `docker compose logs thermus` shows the line. Stop the service with `docker compose stop thermus`, and restore the complete archive.

**Recovery.**

- No account, or only disabled accounts: stop the server, add an account with `docker compose run --rm thermus users add <email>`, and start the server. The tenant and the other accounts stay. The installation owns each approved client, so the new account can use the registered clients.
- A forgotten password: stop the server and run `users reset-password` in the same way.
- A lock error: stop the server container, then run the command again.
- The error `bind source path does not exist`: make `ad-rules.txt` next to `compose.yaml`, for example with `touch ad-rules.txt`, then run the command again.
- A server that stops with a `FATAL` line that names `AD_RULES_FILE`: correct `ad-rules.txt`, then make a new server container with `docker compose up -d --force-recreate thermus`. The server must be able to read the file, and the file must contain UTF-8 text. The server writes nothing to the volume before this check. Docker starts the service again and again, and `docker compose logs thermus` shows the line.
- A new installation: `docker compose down --volumes` deletes the volume with all accounts and data. The next start makes a new installation with a new tenant.

**Edition limits.** All enabled local accounts are equal users of one shared workspace, with the same evaluation permissions. There is no local administrator role. The image has no organizations, invitations, seats, billing, payment collection, or hosted sign-in, and their paths give `404`. `DEPLOYMENT=hosted` selects the [hosted startup path](#hosted-edition), which writes nothing to the volume but also needs WorkOS settings, trusted rules, its portal build, and a checked renderer. The current image omits the portal build and is the self-hosted evaluation image; the hosted image belongs to [RHD-03](docs/implementation/render-hosted-docker-plan.md#rhd-03--build-and-prove-the-hosted-image). A change of `DEPLOYMENT` or of another setting is a configuration change: it does not move accounts or data to the other edition. Migration between editions is separate future work.

**Verification.** `npm run test:container` builds this image and runs the [container gate](docs/implementation/test-gate-policy.md#container-gate) without outbound access. The gate copies a trusted test rules file into each server container. With a test-only page in the server container, it shows that the renderer of the image gives the exact cleaned Markdown and blocks private and loopback addresses. It also shows that a renderer asset that does not match the recorded digest stops the build. The gate cannot reach a public HTTPS page.

## Local accounts and clients

The self-hosted edition has no public sign-up, invitation, email recovery, or administration page. The operator adds and manages local accounts, and registers MCP clients, with offline commands of the same program. A command needs no network or email service and starts no HTTP listener. All enabled accounts have the same evaluation permissions in one shared workspace.

Stop the server before you run a command. Give the command the same settings as the server: `DEPLOYMENT=self-hosted`, `PUBLIC_BASE_URL`, and `DATA_DIR`. The commands do not read `AD_RULES_FILE` or `LIGHTPANDA_BIN`. A registered client is linked to the MCP resource of `PUBLIC_BASE_URL`, so a different value gives a client that the server does not serve. Then start the server again.

```sh
export DEPLOYMENT=self-hosted PUBLIC_BASE_URL=http://localhost:8080 DATA_DIR=/tmp/thermus-data
node dist/src/index.js users add alice@example.com
node dist/src/index.js users list
node dist/src/index.js users reset-password alice@example.com
node dist/src/index.js users disable bob@example.com
node dist/src/index.js clients register --user alice@example.com --name "Native MCP client" --redirect-uri http://127.0.0.1:33418/callback
```

| Command | Result |
| --- | --- |
| `users add <email>` | Adds an enabled account and prints its email and ID. An email that an account already has, in any letter case, stops the command before the password prompt; a disabled account also keeps its email. |
| `users list` | Prints the email, the state (`enabled` or `disabled`), and the ID of each account, in email order, without credentials. With no account, it tells how to add one. |
| `users reset-password <email>` | Sets a new password and ends all sessions of that account. The account keeps its ID and its state: the command does not enable a disabled account. |
| `users disable <email>` | Disables the account without an expiry and ends all its sessions. The account keeps its ID and cannot sign in or get tokens. No command enables an account again. |
| `clients register --user <email> --name <name> --redirect-uri <uri> [--redirect-uri <uri> ...]` | Registers one native MCP client for the installation and prints its client ID. |

**Passwords.** A command never takes a password from its arguments or options. `users add` and `users reset-password` ask for the new password two times; the two entries must be the same. `clients register` asks one time for the password of the selected account. On a terminal, the prompt does not show the typed characters. When standard input is not a terminal, the command reads one line for each prompt, so a script can write the passwords to standard input. A password has 8 to 128 characters. Prompts and messages go to standard error, and the command result goes to standard output. No output contains a password, a password hash, or a session token.

**Explicit targets.** Each user command needs exactly one email address; the letter case does not matter. There is no default account. Client registration needs exactly one `--user` and one `--name`, and at least one `--redirect-uri`. A command with a missing target, an extra argument, or an unknown option stops with exit status 2 and the usage text. That message does not repeat the arguments, because a mistyped argument can be a password. An unknown email stops the command with `No local account has this email address.` before the password prompt.

**Exit status.** `0` means that the command completed. `1` means that the command failed; the message gives the reason, such as a duplicate email, an unknown or disabled account, a wrong password, a password outside the length rule, or a lock error. `2` means a usage error.

**Revocation.** `users reset-password` and `users disable` delete only the sessions of the selected account. Each MCP access token carries the browser session ID in its `sid` claim, so the tokens of that account become inactive at introspection, and its pending authorization codes fail at the token endpoint. The other accounts keep their sessions and tokens. The local edition issues no refresh tokens, so no refresh grant stays. The [Better Auth administrator](src/accounts/providers/better-auth/better-auth-user-administration.ts) uses only supported Better Auth operations: `createUser`, which hashes the password; the provider hash, password update, ban, user list, and session deletion of the provider data API; and `signInEmail` with `adminCreateOAuthClient` for client registration. No command edits provider tables with SQL.

[`runLocalAuthCommand()`](src/interfaces/cli/local-auth-command.ts) parses the arguments with [`parseLocalAuthCommand()`](src/interfaces/cli/local-auth-command-line.ts) and uses the five-operation [`LocalUserAdministration` role](src/accounts/identity/local-user-administration.ts). The entry point supplies a lazy administration opener. It loads the provider only after syntax, configuration, and edition checks. The command holds the data-directory lock through password input and output, then closes the opened resources.

**Client registration.** The command registers a public native client: `token_endpoint_auth_method: none`, the `authorization_code` grant only, and PKCE. Each `--redirect-uri` must be an `http` URI on `localhost`, `127.0.0.1`, or `[::1]`, without user information or a fragment. The provider then accepts only these redirect URIs; for a loopback URI it also accepts another port, as RFC 8252 requires. The command signs in the selected enabled account with its password, registers the client with that session, and then deletes that session. The other sessions of the account stay. The installation, not the account, owns the client. Give the printed client ID to the MCP client as its pre-registered client ID. The tested client is the MCP TypeScript SDK 2.3.1 client. Dynamic client registration stays off.

**Resource-server client.** The MCP server checks each access token at the provider's introspection endpoint as a confidential client. The provider registers a client only for a signed-in session, so the first `clients register` also registers this resource-server client in the same session and writes its ID and secret to `DATA_DIR/resource-server-client.json` with mode `0600`. Then the command prints one more line. A later registration uses the stored client. After a change of `PUBLIC_BASE_URL`, the stored client belongs to the old MCP resource, so the next registration registers a new one. No output contains the secret. If the file is damaged, startup and `clients register` stop with `LocalInstallationError`: restore the complete data directory, or remove the file and run `clients register` again.

**Lock errors.** The server and each command hold the same exclusive data-directory lock. A command on a data directory that another Thermus process uses stops with exit status 1, asks for no password, and changes no data:

```
The data directory is in use by another Thermus process. Stop that process, then try again.
```

A command that you run inside a live server container is also another process on the same files, so the lock stops it too. A command holds the lock until it ends, also while it waits for a password; a server start on the same directory then stops with the same error. For a container installation, stop the server container, run the command in a one-off container from the same image with the same volume, and start the server container again. The [container installation](#container-installation) section gives the commands.

**Recovery.**

- No account, or only disabled accounts: stop the server and add an account with `users add`. The installation keeps its tenant and the IDs of the other accounts.
- A forgotten password: stop the server and run `users reset-password` for the account.
- A lock error: stop the process that uses the data directory, then run the command again. The operating system releases the lock when that process ends, also after a crash.
- `LocalInstallationError`: restore the complete data directory, as the [self-hosted server](#self-hosted-server) section describes.

## Sign-in and MCP clients

A local user connects an MCP client to the self-hosted server through the OAuth flow of Better Auth and the bundled pages. The flow needs no outbound network access: the server reads its keys, sessions, clients, and consents from `DATA_DIR`, and the pages load no script, font, or image.

**Supported client.** The tested client set is the MCP TypeScript SDK 2.3.1 client (`@modelcontextprotocol/client`) with a pre-registered public native client. No other MCP client is claimed. Configure the client with:

- the server URL `<base>/mcp`;
- the client ID from `clients register` as the pre-registered client information (`clientInformation()` gives `{ client_id }`);
- one redirect URI that `clients register` registered for it; for a loopback redirect URI, the client can use another port.

The SDK reads the protected-resource and authorization-server metadata, uses PKCE with S256, sends the MCP resource as the resource indicator, and checks the `iss` parameter of the callback. Metadata paths start at the public origin: `/.well-known/oauth-protected-resource/mcp` and `/.well-known/oauth-authorization-server/api/auth` for a root installation, or `/.well-known/oauth-protected-resource/team/mcp` and `/.well-known/oauth-authorization-server/team/api/auth` when `PUBLIC_BASE_URL` ends in `/team/`. The server has no dynamic client registration and reads no client metadata document, so a client that needs either does not work.

**Sign-in and consent.** The client opens the browser at the authorization endpoint. Without a browser session, the provider shows the sign-in page, `<base>/sign-in`, for the email and password of a local account. At the first authorization of a client, the consent page, `<base>/consent`, names the client, the account, and the requested scopes, with **Allow** and **Deny**. Then the browser goes to the client's redirect URI with the code, and the client gets an access token. An authorization request with an unknown client ID or an unregistered redirect URI goes to `<base>/authorization-error`, which shows only the error code.

**Tokens.** An access token is a JWT for the MCP resource, valid for 3,600 seconds and bound to the browser session in its `sid` claim. The local edition issues no refresh token, and a refresh request gets `400 unsupported_grant_type`. When the server no longer accepts a token, the SDK starts a new authorization; while the browser session lives, the provider gives a new code at once, without the pages.

**Checks for each MCP request.** The server checks the JWT signature, type, issuer, audience, and time with the provider's own keys, then introspects the token, so a token of an ended session fails. Then it reads the current account. A missing, malformed, expired, revoked, or foreign token gets `401`. A disabled or deleted account gets `403 access_denied`, also with a valid token. `users reset-password` and `users disable` end the sessions of one account, so its tokens fail at the next request, and the other accounts keep working. Each enabled account has the same access: the tenant `local:<installation-id>` and one grant, role `user` with the permission `product:access`.

**Protections of the pages.** Each sign-in and consent post goes through the Better Auth handler, so its checks apply: a post from another origin, a cross-site sign-in navigation, and a consent post with the session cookie but without an origin get `403`. More than three sign-in attempts from one client address in ten seconds get `429` with `Retry-After`. A wrong password gets `401` and the form again; a disabled account gets `403`. The pages never repeat a password or a provider message.

The consent page verifies the signed authorization query before it displays the client name and current account. Client and session lookups stay inside the server. Form bodies and authorization queries are limited to 16 KiB; ambiguous required form fields are refused. Internal token introspection has no shared request quota, so normal MCP traffic does not exhaust the sign-in rate limit or bypass revocation checks.

## Hosted edition

For hosted early access, follow [User onboarding](docs/implementation/hosted-user-onboarding.md)
before a User grant and [account deletion](docs/implementation/hosted-account-deletion.md)
for a removal request. Acceptance is an operator-managed private record, not an
application check. Updated policy pages remain unpublished until separately approved.

The hosted edition uses WorkOS: AuthKit signs in browser users, and Connect authorizes MCP clients. `DEPLOYMENT=hosted` needs the five `WORKOS_*` settings of [`.env.example`](.env.example):

```sh
pnpm build
pnpm build:user-portal
DEPLOYMENT=hosted PUBLIC_BASE_URL=https://thermus.example \
WORKOS_API_KEY=... WORKOS_CLIENT_ID=... WORKOS_AUTHKIT_ISSUER=https://example.authkit.app \
WORKOS_REDIRECT_URI=https://thermus.example/callback WORKOS_COOKIE_PASSWORD=... \
AD_RULES_FILE=/absolute/path/to/trusted-ad-rules.txt \
LIGHTPANDA_BIN=/absolute/path/to/lightpanda pnpm start
```

S1-02 uses two customer roles: User has `product:access`; Admin also has
`user-grants:manage`, `admin-grants:manage`, and `billing:manage`. Both roles
permit product and MCP access in their authorized organization. Password access
has no application MFA gate or policy option. Sessions report
`mfaCompleted: false`, including retained inferred evidence on read, refresh,
and organization selection. Default/unknown grants give no access, and invalid
role catalogs fail closed. The [S1-05 checklist](docs/implementation/hosted-organization-setup.md#s1-05-cutover-checklist-prepared-not-executed)
prepares the provider role/password cutover; S1-02 executes no provider change.

- Startup checks `PUBLIC_BASE_URL`, which must be an `https` URL, the listen settings, and the WorkOS settings, and it rejects stdio. A missing or refused WorkOS setting stops startup before the server listens, with one error that names each setting and its rule but no value. There is no fallback to local or anonymous access. The start makes no WorkOS call and opens no data directory. The hosted server reads the trusted `AD_RULES_FILE` at startup, loads the native cleaner and pipeline, and selects the renderer through `LIGHTPANDA_BIN`. A missing or invalid rules file stops startup before listening. Hosted startup requires an absolute `LIGHTPANDA_BIN` and runs a bounded check for Lightpanda 1.0.0 before listening; the [runtime guide](docs/lightpanda-runtime.md#select-the-executable) gives the bounds and safe errors. The log names the WorkOS client ID and the AuthKit issuer. Normal `SIGINT` or `SIGTERM` shutdown exits with status 0. The hosted CLI sets a 10-second shutdown deadline; stalled cleanup or residual handles produce an error line and exit status 1. Self-hosted startup adds no such deadline.
- [RHD-01](docs/implementation/rhd-01.md) supplies `getURLAsMarkdown` through the production WorkOS composition. Fetch and search share one capacity: up to `OPERATION_CAPACITY` calls run at the same time in one process, default 10. Each call holds its place through the full fetch, cleaning, and cleanup operation. When all places are in use, the next call gets `isError: true`, `Server busy. Try again later.`, and completion status `busy`. There is no queue. Cancellation holds capacity until the operation settles. Startup reads `OPERATION_CAPACITY`, a whole number from 1 to 100; an invalid value stops startup before listening, with an error that names the setting and the rule but not the value. [`composeWorkOSApplication()`](src/app/hosted-workos-application.ts) still accepts an optional `buildServer` for tests and the development work slice.
- [SO-04](docs/implementation/self-onboarding-plan.md#slice-2-free-tier-end-to-end) adds the [tenant registry](src/tenancy/tenants/) of the self on-boarding plan. With `MCP_TENANTS_ENABLED=true`, startup reads `FREE_TENANT_LIMIT`, a whole number from 0 to 1000, default 25; without the switch, the cap is 25 and the setting is not read; 0 closes free signup through the cap, and an invalid value stops startup before listening, with an error that names the setting and the rule but not the value. A tenant request is one idempotent insert of a `requested` row in the private PostgreSQL `tenants` table. Every row except a failed or a deleted one holds a place under the cap; at a full cap, the request inserts nothing and says so. An in-memory lookup gives the state and the internal address of an organization: its copy refreshes after 10 s and, after a failed refresh, serves up to 60 s. The registry uses the one SQL runtime of the private hosted storage (`DATABASE_URL` in [`.env.example`](.env.example) and the [database setup](docs/implementation/admin-s2-01a-database-setup.md)), exists only when that storage is configured, and opens no connection at startup. The MCP gateway (SO-05), signup, and the workspace status of the portal (SO-07) call it.
- [SO-06](docs/implementation/self-onboarding-plan.md#slice-2-free-tier-end-to-end) adds the [tenant provisioner](src/tenancy/tenants/tenant-provisioner.ts) and its [Render adapter](src/tenancy/providers/render/render-tenant-platform.ts). The rollout switch `MCP_TENANTS_ENABLED` is off by default: then startup reads no tenant setting and starts no provisioner. With `true`, startup reads and checks the Render settings, the tenant image, the free plan, the name prefix, and the public tenant values of [`.env.example`](.env.example), needs the private hosted storage, and starts one loop. The loop takes one `requested` row at a time. It names the service `TENANT_NAME_PREFIX` and the organization ID in lower case with each character outside `a-z`, `0-9`, and `-` as a hyphen (`org_01HX…` gives `thermus-tenant-org-01hx…`). Render shortens a long name into the private hostname and keeps hostnames unique, so the loop records the address that Render returns. It searches by that name before it creates, and creates an image-backed private service with the tenant settings and `OPERATION_CAPACITY=5`. Then it watches the newest deploy every 5 s for at most 15 minutes and records `live` with `http://<slug>:8080`, or `failed` with the reason and one operator report. Two services with the name stop the row as `failed`. Reads and the delete have up to 3 attempts; a create goes one time in each attempt, at most three attempts. The adapter refuses a write for a service that the registry does not own, and always for the production service. A `deploying` row after a resume also goes `live` through the loop. The [tenant fleet runbooks](docs/implementation/tenant-fleet-runbooks.md) give the repair of a `failed` row, the orphan check, the key rotations, and the alerts.
- [SO-11a](docs/implementation/self-onboarding-plan.md#slice-2-free-tier-end-to-end) exports the system log of the control plane to an OTLP/HTTP logs endpoint, in addition to standard error. With `SYSTEM_LOG_OTLP_ENDPOINT`, `SYSTEM_LOG_OTLP_TOKEN`, and `SYSTEM_LOG_AXIOM_DATASET` of [`.env.example`](.env.example) empty, the system log goes to standard error only, as before. With the endpoint, an `https` URL, and the token, a bearer token that the tenant role refuses, [app](src/app/system-log-output.ts) writes each record to standard error and, through `OtelSystemLogSink` and the OpenTelemetry SDK, to the endpoint: the body is the message with the caller file and line, the severity comes from the level, the header `X-Axiom-Dataset` names the dataset when it is set, and the resource has `service.name` `thermus-control-plane` and `service.instance.id` from `RENDER_INSTANCE_ID`. The endpoint without the token, the token without the endpoint, or an invalid value stops startup before listening, with an error that names the setting and the rule but not the value. The export never stops a request: it keeps at most 2,048 records in memory and drops the newest at a full queue, sends a batch at most every 2 s, ends each export with its retries within 4 s, drops a failed batch, and writes one `System log export failed:` line to standard error at most once a minute, not through the export. At a stop, after the HTTP server closed, it waits at most 5 s for the last records. The production service `srv-db8mnqg473hc739d529g` gets `SYSTEM_LOG_OTLP_ENDPOINT=https://us-east-1.aws.edge.axiom.co/v1/logs`, `SYSTEM_LOG_AXIOM_DATASET=system-log`, and the secret variable `SYSTEM_LOG_OTLP_TOKEN`, an Axiom API token with ingest permission for `system-log` only, before step 6 of the SO-12 order; [runbook 7.3](docs/implementation/tenant-fleet-runbooks.md#73-axiom-monitors) gives the check.
- [RHD-02](docs/implementation/rhd-02.md) serves `GET` and `HEAD /` and allowlisted built assets with the portal CSP. Build the portal before startup; missing or invalid files stop startup before listening. `GET` and `HEAD /healthz` return constant `200` after local initialization, and other methods return `405`. Health calls no provider and renders no page.
- The server owns the browser session: `GET <base>login` starts the AuthKit sign-in with PKCE, the callback at the path of `WORKOS_REDIRECT_URI` sets a sealed `HttpOnly`, `Secure`, `SameSite=Lax` session cookie, `POST <base>logout` ends the session, and `GET <base>session` gives the portal its JSON. The [user portal](docs/user-portal.md) uses these routes on the same origin.
- With product access, choose CLI or Desktop Apps in the portal to see the setup steps for your MCP client. Desktop guides show the app settings and the configured MCP URL; Cursor uses its configuration file, and ChatGPT directs you to web setup. The [setup guide](docs/user-portal.md#mcp-setup-guides) lists the clients.
- The MCP resource, `<base>/mcp`, accepts only Connect user tokens of the AuthKit issuer for this resource, and each request needs current product permission from User or Admin in the organization of the token. Its protected-resource metadata names the AuthKit issuer. Before authentication, the exact hosted MCP path allows an absent `Origin` for native clients or the exact serialized public origin. Foreign, malformed, opaque `null`, and noncanonical values get `403`.
- Each protected request reads the current memberships and roles from WorkOS. A failed read gives a `500` and no protected work. No bearer token, cookie, form token, organization ID, or form value from the client gets an identity, a grant, a tenant, or protected work by itself. No test identity, organization, grant, demonstration mode, or setting turns on access, also not `NODE_ENV=test` or `AUTH_MODE=mock`. There is no anonymous access, default tenant, local fallback, or automatic User role. Other paths give `404`.
- [SO-03](docs/implementation/self-onboarding-plan.md#slice-2-free-tier-end-to-end) adds the tenant role of the same image. `THERMUS_ROLE` selects `control-plane`, the default and the behavior above, or `tenant`; another value stops startup. A tenant serves only `/healthz` and `/mcp`, for the one organization in `TENANT_ORGANIZATION_ID`, behind the MCP gateway of the control plane (SO-05). It reads `PUBLIC_BASE_URL` with its public value and the root base path, `WORKOS_AUTHKIT_ISSUER`, `GATEWAY_PUBLIC_KEY` (Ed25519 PEM public keys, separated by commas), `CONTROL_PLANE_INTERNAL_URL`, `AD_RULES_FILE`, `LIGHTPANDA_BIN`, and `OPERATION_CAPACITY`, as [`.env.example`](.env.example) gives them. It refuses to start when a secret of the control plane has a value, such as `WORKOS_API_KEY`, `DATABASE_URL`, `RENDER_API_KEY`, `SYSTEM_LOG_OTLP_TOKEN`, or a `STRIPE_*` setting; the error names the setting. Its start makes no network call. Each MCP request needs the signed access context of the control plane in the `Thermus-Access` header: a request without it, or with a bad signature, an expired context, a context of another organization, or a context of another bearer token, gets `403` before MCP handling. Then the bearer check, the product permission, one MCP server for each request, and `405` for `GET` and `DELETE` stay as above; the grants come from the context, with no WorkOS read. The tenant relays its audit events to `POST /internal/audit` of the control plane, bounded best effort. The [authentication design](docs/design/authentication-design.md#tenant-role-and-signed-access-context) gives the contract.
- [SO-05](docs/implementation/self-onboarding-plan.md#slice-2-free-tier-end-to-end) adds the MCP gateway of the control plane behind the rollout switch `MCP_TENANTS_ENABLED`: `true` or `false`, default `false`; another value stops startup. With `false`, the control plane reads no setting of the tenants and runs the tools itself, as above. With `true`, startup also reads `FREE_TENANT_LIMIT`, `GATEWAY_SIGNING_KEY` (the Ed25519 private key in PEM form that signs each access context), and `CONTROL_PLANE_INTERNAL_URL` (the origin of the control plane on the private network), as [`.env.example`](.env.example) gives them, and needs the private hosted storage of the tenant registry; a missing or invalid setting stops startup before listening with an error that names the setting but not its value. Startup also stops when `GATEWAY_PUBLIC_KEY` of the provisioning settings, which each new tenant gets, does not include the public key of `GATEWAY_SIGNING_KEY`; the error names both settings, never a key. The list can hold more keys for a rotation. A rotation first adds the new public key to the control plane and to each tenant. Then it changes the signing key. Last, it removes the old public key. Then each MCP request that passes the Origin check, the bearer check, and the access check of today goes to the tenant of its organization: a live tenant gets it with the signed context and streams the answer back; a tenant that is requested, being created, or deploying gives `503` with `Retry-After: 15`; a suspended tenant is resumed one time and gives `503` with `Retry-After: 60`; a failed tenant gives `503` and one operator report; an organization without a tenant gets one requested, or the capacity message at a full cap. A tenant that fails before its first answer byte gives the tool error `Server restarted. Try again in a minute.`; 5 searches at a time pass across all tenants, and the sixth gets `Server busy. Try again later.` `POST /internal/audit` accepts a relay of a tenant only on the host of `CONTROL_PLANE_INTERNAL_URL`, with a valid context for the organization and the user of the event, and one time for each operation ID; it exports the event with the destination settings of the organization. Each other request to `/internal/*` gets `404`. The [authentication design](docs/design/authentication-design.md#mcp-gateway-and-audit-relay) gives the states and the rules.
- [SO-10](docs/implementation/self-onboarding-plan.md#slice-2-free-tier-end-to-end) suspends idle free tenants and resumes them on the next call. With `MCP_TENANTS_ENABLED=true`, startup also reads `FREE_TENANT_IDLE_DAYS`, a whole number from 1 to 365, default 14 (decision D-6); an invalid value stops startup before listening, with an error that names the setting and the rule but not the value. Each day at `TENANT_SWEEP_HOUR_UTC`, the idle sweep suspends, through the Render API, each live free tenant without an MCP call for that many days, or since its creation when it never served one, and writes one `Tenant suspension record:` line for each and one `Idle sweep:` line with the counts. A team tenant is never suspended, and a suspended tenant costs nothing. A suspend that Render refuses or limits changes no row and gives one `Tenant suspension failed:` line; the next sweep tries again. The first MCP call of a suspended tenant sends one resume call to Render, and each call gets `503` with `Retry-After: 60` until the provisioner records the deploy of the resume as live, for about a minute; then the next call reaches the tenant. A resume that Render refuses or limits gives one operator report, and the next call tries again. Connect in the portal keeps the connection guide of a suspended workspace and shows the notice "Your workspace was paused after 14 days without use. It restarts on the next request, which can take about a minute.", with the days of the setting ([workspace setup state](docs/user-portal.md#workspace-setup-state)). The [tenant fleet runbooks](docs/implementation/tenant-fleet-runbooks.md#log-lines-of-the-fleet) give the log lines.
- [SO-07](docs/implementation/self-onboarding-plan.md#slice-2-free-tier-end-to-end) hands a new free organization to its tenant. The marketing **Start free** link of thermus.ai opens `https://app.thermus.ai/signup?tier=free`; only the free tier exists, so the route ignores the `tier` value. With `MCP_TENANTS_ENABLED=true`, signup checks the free-tenant cap `FREE_TENANT_LIMIT` before the notice and shows the closed notice at a full cap; after the confirmed first Admin membership, it requests the tenant and opens Quick start. Connect in the portal reads `GET <base>workspace/status` and shows "Setting up your workspace. This takes about two minutes." with a meta refresh every 5 s, then the connection guide when the tenant is live ([workspace setup state](docs/user-portal.md#workspace-setup-state)). The [free subscription guide](docs/free-subscription-guide.md) gives the switch, a test signup, and the client connection. The [SO-12 release record](docs/implementation/self-onboarding-s2-release.md) gives the rehearsal and the production order of the free tier.

The [authentication design](docs/design/authentication-design.md#hosted-composition-with-workos) gives the composition, the [hosted access](docs/design/authentication-design.md#hosted-access-of-auth-06) rules, and the [browser session](docs/design/authentication-design.md#browser-session-of-auth-06).

[`composeHostedApplication()`](src/app/application.ts) takes the parts that change with the provider, and [`composeWorkOSApplication()`](src/app/hosted-workos-application.ts) gives the WorkOS parts:

- a [`BrowserSession`](src/accounts/identity/browser-session.ts). It gets only the `Cookie` header of a browser request. A signed-in session gives the verified user, with the organization that its session selected, the form token of the session, its compatibility MFA field, its cookie effects, and `selectOrganization(organizationId)`. Thus no form field, query, or other header can choose the user or the organization. The compatibility field `mfaCompleted` stays false; Password sign-in and retained cookie values do not prove MFA. The form token is a secret of the session, and each form of the account pages sends it back. It stays the same for the whole session, also after a refresh or an organization switch, so that a form shown before still posts. The cookie effects are `Set-Cookie` values that must reach the browser with the answer, also with a redirect or an error page, so that the browser does not lose a session that the provider refreshed or ended during the request. A signed-out session also has cookie effects. Only `selectOrganization()` changes the organization of a session, and only for that browser. A failure, such as an outage, throws, so that it cannot erase a session;
- an [`AccessResolver`](src/accounts/identity/access-context.ts);
- an [`OrganizationDirectory`](src/accounts/organizations/organization-directory.ts). `membershipsOf(user)` reads the current memberships of that user from the provider: the organization ID and name, the active state, and every current grant. A grant holds only application permissions, so that a default role, which gives none, authorizes nothing. The other methods read the members and invitations of an organization page by page, and send, resend, or revoke an invitation; the provider owns the acceptance of an invitation. Each page read names its statuses or states, so that no default filter of the provider decides. A failed read or change throws, so that it never looks like a missing record or a result; after a failed change, its effect is not known;
- the MCP endpoint, which answers the MCP resource and its metadata. The application closes it;
- optional browser routes of the provider that need no signed-in session, such as the sign-in, the callback, the sign-out, and the session JSON. They answer before the account routes.

The third argument gives three required parts and an optional account operation. The required parts are `reportFailure`, which gets each unexpected failure of an account request, `changeRecords`, which gets each record of a privileged change, and `billing`, the one [`Billing`](src/accounts/billing/billing.ts) of the hosted organizations. The hosted edition gives [`accountFailureReporter(logger)`](src/app/application.ts), which writes one `ERROR` line with the path and the cause: `An account request failed unexpectedly for <path>: <cause>`. It also gives [`accountChangeRecorder(logger)`](src/app/application.ts), which writes each change record to the operator log as one `INFO` line, `Account change record: <JSON>`, until hosted storage exists. For `billing`, it gives a [`BillingFree`](src/accounts/billing/billing-free.ts) until AUTH-11 replaces `BillingFree` with the provider implementation. See [Billing](#billing).

[`HostedAccountRoutes`](src/interfaces/web/account/account-routes.ts) checks the browser session first for each path. A signed-out session gets `401` with its cookie effects. For a signed-in session, the organization page and the organization selection below need only the identity. Each other path needs the current access: the routes resolve it and require a trusted tenant. Only then do they give the member and invitation paths below to the administration routes, and each other path, with a frozen copy of its trusted `RequestContext`, to an account operation. A denial gets `403`, with a link to the organization page: "To select another organization, or to see how to get access, open the organization page." A request with no route or operation gets `404`. The hosted edition gives one account operation: the protected portal request `GET <base>portal/access`, which needs User or Admin (`product:access`) and gives the organization, the roles of its current grants, and its plan, `free` with the `memberLimit` 5 or `team`, or `403`.

Organization onboarding and selection (AUTH-07) use [`OrganizationAdministration`](src/accounts/organizations/organization-administration.ts). It reads the current memberships of the session user for each request and authorizes only the active memberships whose grants give at least one application permission. A default role gives none, so its organization is not listed. There is no default organization. The organization page accepts only `GET` and `HEAD`, and the selection accepts only `POST`; other methods get `405`.

- `GET <base>/organizations` lists the authorized organizations. Each one has a form with a button that shows its name, with "(selected)" for the organization that the session selected. The form posts the organization ID, the form token, and the return destination. The optional `return_to` query gives the return destination, with the rules of the selection below; the default is `<base>/organizations`, and an invalid value gets `400`. Without an authorized organization, the page tells the user that the account has no active access to an organization: accept the invitation in the email, or, with no invitation, contact the operator of the service, because only the operator can set up a new organization. This page has no form.
- `POST <base>/organizations/select` changes the organization of this browser session only. An MCP token and the other browser sessions of the user keep their organization. A post from another origin, or without an `Origin` header, gets `403` before its body is read. A content type other than `application/x-www-form-urlencoded` gets `415`, a body larger than 16 KiB gets `413`, and a missing or wrong form token gets `403`. The form must have exactly one `organization_id`, with 1 to 256 visible ASCII characters, exactly one `return_to`, and no other field. The return destination must be a path under the public path, with at most 1,024 characters and no query, fragment, backslash, space, control character, dot segment, or second slash at the start. Else the post gets `400`. Then a current read must authorize the organization for the session user, else the post gets `403` and no switch. After the switch, the browser gets `303` to the destination, where the operation checks its own permission. If the provider refuses the switch, the browser gets `403`; if the session ended, `401`.
- Each answer after a sign-in carries the cookie effects of the session before the cookies of the answer itself. This includes an operation answer, a redirect, a refusal page, and a failure page. A failure after a sign-in, such as a provider outage or an operation answer that cannot carry the cookie effects, gives a `500` page, "The request failed. Try again later.", and one `ERROR` line in the operator log. A failed session lookup gives the generic `500` of the HTTP server without a cookie. Thus an outage never looks like a signed-out session and never ends a session.
- The organization account routes create, resume, rename, or change no organization settings. Self-serve signup accepts a valid organization name and one organization/authority agreement, confirms the first Admin, and selects that organization for Quick start. The production personal-User legal bundle does not authorize this creation flow; rollout requires the exact approved organization bundle. The [operator checklist](docs/implementation/hosted-organization-setup.md) prepares S1-05 cutover and marks the former Super Admin procedure as historical. Existing signup product access, including Admin alone, offers Continue without another personal workspace. The self-hosted edition has no organization route.

Member reads, invitations, and the product-member summary use `OrganizationAdministration`. After session and current-access checks, [`AdministrationRoutes`](src/interfaces/web/account/administration-routes.ts) gets the actor and organization from the trusted context. Each operation reads current membership authority in that organization. Admin manages either User or Admin invitation; User cannot administer members or invitations. These operations need no application MFA evidence. No query, header, or form field can choose the actor or trusted organization.

- `GET <base>/members` shows "Active product members: N" and each member's status and roles. Rows have no grant controls. Each unique active membership with `product:access` counts once, including Admin alone. Default-only, pending, and inactive memberships and invitations do not count. Every provider page must succeed; a failed page shows no partial count. This count is not a bill. On the free plan, the page also shows "N of 5 seats used": the active memberships with `product:access` and the pending invitations, because a pending invitation reserves its seat. Expired invitations hold no seat.
- `GET <base>/invitations` shows each invitation with its role and with its state as the provider gives it: pending, accepted, revoked, or expired. Each role that the actor manages has an invitation form ("Invite as User" or "Invite as Admin"), and each pending invitation of such a role has a resend and a revoke button. An invitation gives only the role that it names, so an Admin invitation gives Admin product and administration access without a separate User role. The page says "Only a sign-in with the invited email address can accept the invitation." only when the provider enforces it. Else it says that the sign-in service decides and can accept another address, for example an address of the same domain. The page also says: "The acceptance of a pending invitation gives the role that the page shows. For an accepted, revoked, or expired invitation, the sign-in service can show the current role of the member instead."
- `POST <base>/members/grants` is retired. After session and current-access checks it gets `404`, with no membership write or change record. Customer removal and role changes are later work.
- `POST <base>/invitations/send`, `<base>/invitations/resend`, and `<base>/invitations/revoke` keep the origin, content type, size, CSRF, field, and selected-organization checks. Bad fields get `400`; a session organization mismatch gets `409`. Unsupported roles are refused. Repeating a pending invitation for the same address and role sends nothing. On the free plan, an invitation beyond the 5 seats gets `409` limit-reached with "This free workspace has 5 of 5 seats. Upgrade to Team to add more members.", without a link, and nothing is sent; the count reads every member and invitation page, a failed page sends nothing, and the check and the send of one organization run one at a time. An existing member or pending invitation for another role gets `409` address-in-use. A resend or revoke of a non-pending invitation gets `409`. An applied or unchanged request gets `303` to the invitations page.
- Each invitation send, resend, or revoke, including a refusal, produces a credential-free change record with time, actor, organization, target, action, role, and outcome. A page read produces no change record. Current membership reads enforce provider-side revocation on the next browser or MCP request without changing another organization's access.

Since AUTH-07W, the organization directory of the hosted composition is [`WorkOSOrganizations`](src/accounts/providers/workos/workos-organizations.ts). [`composeWorkOSApplication()`](src/app/hosted-workos-application.ts) makes one instance with the WorkOS authority and gives it to the access resolution and, through `OrganizationAdministration`, to the account routes.

- `membershipsOf(user)` gives no membership to a user of another authority and sends WorkOS no read. For a WorkOS user, it reads each active membership with the explicit status `active`, in pages of 100 by the `after` cursor and at most 10 pages, and the roles of each organization. Each membership has the WorkOS organization name and the grants of the [hosted role mapping](docs/design/authentication-design.md#hosted-role-mapping). Each read asks WorkOS again; nothing is kept.
- An inactive or pending membership or a membership of another user in an answer, a membership without an organization name, two active memberships in one organization, a repeated page cursor, more than 10 pages, a role configuration error, and each failed WorkOS read throw. Thus access fails closed, and the request gets the `500` failure page and an operator report, never the onboarding guidance.
- Since AUTH-08W, the member reads give each membership of the organization page by page, with the statuses that the read names, the email of each member from a WorkOS user read, its grants, and a revision from its WorkOS update time, status, and roles. The active product-member count reads every page; a failed page fails the count.
- An invitation names one role. WorkOS sends the email, makes a pending membership with only that role, and activates only that role at the acceptance in AuthKit, also for a person with an inactive membership. The invitation link goes through the Initiate login URI to `GET <base>login`, and AuthKit accepts the invitation in that sign-in, before the callback; the server has no invitation route. WorkOS gives the role of an invitation from the current role of its membership, so only the role of a pending invitation is the role of its acceptance. The invitations page shows the state that WorkOS gives; a pending invitation whose expiry time has passed shows as expired. No invitation token or link reaches a page or a record. The invitation policy is `provider-rules`: WorkOS can accept another address of the same domain, so the directory claims no strict address match.

Thus the organization page, the organization selection, the billing page, and the members and invitations pages with their changes work with current WorkOS reads and changes. A user can also choose the organization of a browser session at the AuthKit sign-in. The [WorkOS organization administration](docs/design/authentication-design.md#workos-organization-administration-of-auth-08w) gives the rules, and the [hosted provider findings](docs/design/authentication-design.md#hosted-provider-findings) give the WorkOS behavior that they need.

Historical provider evidence and remaining work (the dated runs below used the earlier three-role/MFA model and do not prove S1-02):

- The [hosted live gate](docs/implementation/test-gate-policy.md#hosted-live-gate-auth-06) passed as a whole in run r3 of AUTH-08W on 2026-10-14: in its third complete run, each of its 77 tests passed, the proofs and cases of AUTH-06, AUTH-07W, and AUTH-08W. A later change to the hosted authentication flow or to the WorkOS organization reads or changes needs the gate again.
- AUTH-07W implemented the `OrganizationDirectory` reads of `WorkOSOrganizations`, with the hosted role mapping, and the [runbook for operator setup and recovery](docs/implementation/hosted-organization-setup.md). Its proofs and cases of the hosted live gate passed in run r2 of AUTH-07W on 2026-10-14. The ticket `9255ad59-3484-43bd-bdf5-e6e391e07bd6` changed the Super Admin steps of the runbook to single-role writes, a role assignment on the organization and its removal, so that a change of User or Admin by a customer at the same time stays; the complete hosted live gate passed again in its run r1 on 2026-10-14. The completed MFA of the operator is a manual precondition of the runbook, and no test proves it, because the WorkOS API cannot show it. On 2026-10-14, the owner removed this proof from AUTH-07W. The decision ticket `ae984833-e115-4da9-bebe-7c4b1fb1a025` decides how the operator MFA is enforced and proven.
- AUTH-08W implemented the member and invitation reads and the grant and invitation changes of `OrganizationDirectory` in `WorkOSOrganizations`, with live seat reads. It answers `unsupported` when it cannot make a grant change safely. Its proofs of the safe grant and invitation effects in WorkOS and its cases of the hosted server are in the hosted live gate: single-role changes on the revision that the page showed, retries, concurrent changes, the default role, and an acceptance that activates only the role of the invitation. A run of only the AUTH-08W tests passed the 16 proofs and cases that existed then, and run r3 of AUTH-08W passed all 17 with the complete command.
- Change records stay in the operator log. Hosted storage, full audit logs, step-up authentication, SSO, SCIM, and Okta are later work.
- Organization rename and other organization settings wait until the product owner decides their authority.
- AUTH-11 adds paid billing after the owner selects its rules and provider. It adds no current payment or MFA requirement.

The acceptance tests of the [hosted startup](test/acceptance/auth/hosted-startup.test.ts), of the [WorkOS composition with a fake WorkOS API](test/acceptance/auth/hosted-workos.test.ts), its [organization onboarding and selection from WorkOS reads](test/acceptance/auth/hosted-workos-organizations.test.ts), and its [organization administration with WorkOS reads and changes](test/acceptance/auth/hosted-workos-administration.test.ts), of [organization onboarding and selection](test/acceptance/auth/hosted-organizations.test.ts), of the [organization requests](test/acceptance/auth/hosted-organization-requests.test.ts), of [grant retirement](test/acceptance/auth/hosted-grant-retirement.test.ts) and [current membership access](test/acceptance/auth/hosted-membership-access.test.ts), of [invitations](test/acceptance/auth/hosted-invitations.test.ts), of the [product-member summary](test/acceptance/auth/hosted-seats.test.ts), and of the [free member limit](test/acceptance/auth/hosted-free-member-limit.test.ts) and its [WorkOS composition](test/acceptance/auth/hosted-workos-member-limit.test.ts), the integration tests of the [account routes](test/integration/auth/hosted-account.test.ts), of the [organization routes](test/integration/auth/hosted-organizations.test.ts), and of [organization administration](test/integration/auth/hosted-administration.test.ts) with session and directory doubles, and the unit tests of the [account routes](test/integration/hosted-admin/account-routes.test.ts), their [failure answers and cookie effects](test/integration/hosted-admin/account-routes-effects.test.ts), the [organization page](test/integration/hosted-admin/account-routes-organization-page.test.ts), the [selection input checks](test/integration/hosted-admin/account-routes-selection-input.test.ts), the [organization selection](test/integration/hosted-admin/account-routes-selection.test.ts), the [member and invitation pages](test/integration/hosted-admin/account-routes-administration-pages.test.ts), their [changes](test/integration/hosted-admin/account-routes-administration-changes.test.ts) and [change input checks](test/integration/hosted-admin/account-routes-administration-input.test.ts), [`OrganizationAdministration`](test/unit/organizations/organization-administration.test.ts) with its [retired writer contract](test/unit/organizations/organization-administration-changes.test.ts), [members and seats](test/unit/organizations/organization-administration-members.test.ts), [invitation changes](test/unit/organizations/organization-administration-invitations.test.ts), and [invitation overview](test/unit/organizations/organization-administration-invitation-overview.test.ts), the [operator log lines](test/unit/application-operator-log.test.ts), and the WorkOS provider tests in [`test/unit/auth-workos/`](test/unit/auth-workos), among them the [membership reads of a user](test/unit/auth-workos/workos-organizations-memberships.test.ts), the [member reads](test/unit/auth-workos/workos-organizations-members.test.ts), and the [invitations](test/unit/auth-workos/workos-organizations-invitations.test.ts), and in `test/integration/auth/workos-*.test.ts`, among them the [organization reads with the real organization service and routes](test/integration/auth/workos-provider-organizations.test.ts) and the [organization administration with the real organization service](test/integration/auth/workos-provider-administration.test.ts), run offline. They prove the application side with doubles or with a fake of the WorkOS API only. A pass of these tests is no proof of WorkOS behavior and no hosted live gate pass.

## Billing

The owner has not chosen a payment provider. Billing is a separate object: hosted code uses the [`Billing`](src/accounts/billing/billing.ts) interface, and only a `Billing` implementation calls a payment provider. [`BillingFree`](src/accounts/billing/billing-free.ts) is the only implementation. It bills no organization and collects no payment, so billing never changes access.

- `stateOf(organizationId)` gives the confirmed `BillingState`: `organizationId`, `plan`, and `billedSeats`, and for the plan `free` also `memberLimit`. The plan `team` has no member limit. `BillingFree` gives `plan: 'free'`, `memberLimit: 5`, and `billedSeats: 0` for each organization.
- `updateSeats(organizationId, seatCount)` gets the complete current membership count from its caller, never a change to add or subtract. The same count again has no further effect. `BillingFree` accepts each whole count from 0 to `Number.MAX_SAFE_INTEGER` and gives the same free state.
- An empty or missing organization ID gives a `TypeError`. Any other seat count gives a `RangeError`. Each operation refuses input with a rejected promise. A rejected call confirms nothing.
- Each state is a frozen record. `Billing` does not check roles; the caller checks the approved authority before a customer billing change; no such change is implemented.

Only the hosted edition has billing. Its composition gives `OrganizationAdministration` and the portal request a `BillingFree`; invitation sends use its member limit. `GET <base>billing` needs current `billing:manage` (Admin) in the selected organization, with no MFA precondition; otherwise it gets `403`. The page shows Free with no billed seat and no form. A billing POST gets `405`. No customer membership route calls `updateSeats`; native invitation acceptance does not synchronize billing seats. AUTH-11 adds a paid provider after the owner's decisions. The [billing design](docs/design/billing-design.md) records the current free policy and pending paid decisions. [BillingFree tests](test/unit/billing/billing-free.test.ts), [free-plan acceptance](test/acceptance/billing/free-billing.test.ts), and [billing page tests](test/acceptance/billing/hosted-billing.test.ts) check these boundaries.

## Contributing and design

Use the [documentation index](docs/README.md) to find current reference guides, pending designs, tests, and completed plans.

Read the [coding principles](docs/coding-principles.md) for general design guidance and [AGENTS.md](AGENTS.md) for repository work rules. The [completed OO refactoring record](docs/archive/oo-refactoring-plan.md) preserves the implementation scope and verification evidence.

## User portal

The TypeScript browser portal is in `src/interfaces/user-portal/`. It uses the
server-owned session of the hosted edition on the same origin, and the root
pnpm installation. See the [portal guide](docs/user-portal.md) for its server
routes, the deployment layout, the builds, and the live verification.

Admins have Quick start as their first menu item. A newly created organization
opens this setup guide after selection; later sign-ins and normal workspace
choices keep Connect. The guide covers agent controls, audit logs, and
invitations. Identity-provider enrollment is marked Planned. The server checks
current Admin access to the selected organization before it serves the guide.

## Requirements

Node 24 ESM package. Application and suite TypeScript compiles with `tsc`, and Node runs the output in `dist/`. Build acceptance tests run directly from TypeScript source on Node 24. `tsx` is only for local development.

- Node 24 for production; Node 24.20.0 for development and checks (`nvm use` reads `.nvmrc`)
- pnpm 12.10.1
- A POSIX shell for build commands (macOS or Linux)
- Lightpanda 1.0.0 for rendering, the live renderer tests, and the renderer gate; follow [runtime setup](docs/lightpanda-runtime.md). `pnpm install` does not install it. The unit suite needs no renderer. The container image holds its own renderer.
- Docker Engine with Buildx and Compose for the [container installation](#container-installation) and `pnpm test:container`. The hosted image gate also needs a builder and runtime for Linux AMD64; see the [test gate policy](docs/implementation/test-gate-policy.md).

`package.json` and `pnpm-lock.yaml` pin the development runtime to Node 24.20.0,
the same version as the Docker image. `pnpm install` installs this runtime if it
is not cached, and pnpm scripts use it even when the shell has another Node
version. Use `pnpm exec node --version` to check it. Before direct `npm` or
`node` commands, run `nvm use` or select Node 24.20.0 with your runtime manager.

## Scripts

```bash
pnpm install
pnpm dev         # tsx watch src/index.ts
pnpm build       # clean build
pnpm start       # node dist/src/index.js: start the server
pnpm test             # clean build, then node --test on dist/test/
pnpm test:unit        # clean build, then node --test on dist/test/unit/
pnpm test:integration # clean build, then node --test on dist/test/integration/
pnpm test:acceptance  # clean build, then node --test on dist/test/acceptance/
pnpm test:interface   # clean build, then node --test on dist/test/interface/
pnpm test:container   # clean build, then the self-hosted container gate without outbound access
pnpm test:container:hosted # clean build, then the final Linux AMD64 hosted image gate
pnpm test:logging:collector # audit sender and browser/MCP journey with a real Collector; needs Docker and OpenSSL
pnpm build:hosted     # offline checks, integration selection, and local renderer gate; needs pinned LIGHTPANDA_BIN and OpenSSL
pnpm test:hosted-live # clean build, portal build, then the hosted live gate; needs WorkOS staging settings, Playwright Chromium, and the pinned LIGHTPANDA_BIN
pnpm test:mcp:renderer # clean build, then local fetch and search renderer gates; needs pinned LIGHTPANDA_BIN
pnpm test:mcp:search:live # clean build, then only the real Brave MCP search proof; needs pinned LIGHTPANDA_BIN and public network access
pnpm work-slice:basic-mcp-url-fetch # the basic MCP URL fetch work slice: the fetch tool with the mock provider, a local LLM client, and Axiom logs; needs PUBLIC_BASE_URL, AD_RULES_FILE, LIGHTPANDA_BIN, and the Axiom settings
pnpm work-slice:auth-workos-mcp-url-fetch # the auth WorkOS MCP URL fetch work slice: the hosted edition with the real WorkOS provider and the fetch tool, Google sign-in, a Connect token for Claude Code, and Axiom logs; needs the staging launcher, the defaults and the certificate of its launcher script, AD_RULES_FILE, LIGHTPANDA_BIN, the portal build, and the Axiom settings
pnpm typecheck   # server and portal types; no output
pnpm dev:user-portal     # Vite at http://localhost:5173
pnpm build:user-portal   # portal types and browser bundle
pnpm preview:user-portal # preview the browser bundle
pnpm test:user-portal    # offline portal unit and acceptance tests
```

`pnpm start` runs `dist/src/index.js` because `src/` and `test/` share one compilation root. A test import such as `../../src/app/application.ts` still resolves after emit.

## Layout

```
src/         Node server TypeScript source
src/interfaces/user-portal/
             Browser TypeScript, HTML, CSS, and Vite configuration
test/        node:test files
test/acceptance/work-slice/
             Work slices: the guide, and one folder for each slice with its entry
             point, launcher script, acceptance test, and README
migrations/  Shipped SQL migrations, such as auth-local/ for the self-hosted edition
docs/        Documentation, design plans, and archived records
dist/        tsc output (gitignored)
Dockerfile, compose.yaml, .dockerignore
             The self-hosted evaluation image, its Compose service, and its build context
Dockerfile.hosted, Dockerfile.hosted.dockerignore
             The hosted image and its build context
```

## TypeScript

`tsconfig.user-portal.json` checks browser source and portal tests in strict
mode with DOM types and Bundler resolution. The server configs exclude these
files, so browser globals do not enter the Node build.

`tsconfig.json` is ESM with `module` and `moduleResolution` set to `NodeNext`, in strict mode, targeting ES2024. It adds the `ESNext.Disposable` library for `AsyncDisposableStack`, which Node 24 supplies. Relative imports use the `.ts` extension, and `rewriteRelativeImportExtensions` makes `tsc` emit `.js`:

```ts
import { createApplication } from './application.ts';
```

`package.json` maps `#auth-local-migrations/*` to `migrations/auth-local/*`, so code in `src/` and in `dist/src/` reads the same SQL files.

## Build and test commands

`pnpm build` runs the cleanup and compiler commands from `package.json`. It clears the project-owned `dist` directory before it compiles current source. It rejects a symlink or regular file at that path. npm and pnpm run package scripts from the project root, so the caller’s working directory does not change the cleanup target. Files outside `dist` stay in place. Do not keep user data in `dist`.

`pnpm test` builds and runs all compiled tests. `pnpm test:unit`, `pnpm test:integration`, `pnpm test:acceptance`, and `pnpm test:interface` build and run only their respective suites. Each command removes output from deleted or renamed source files. Use `pnpm build` before a focused `node --test dist/...` command. `pnpm start` runs `dist/src/index.js` from the last build. `pnpm typecheck` checks source without emitting or clearing output.

The unit and integration suites are offline. The acceptance and interface OTel logger tests send logs to Axiom on every run and need ingest credentials and public network access. `pnpm test:hosted-live` builds the portal and runs `test/acceptance/auth/hosted.live.ts` and `test/acceptance/auth/hosted-removal.live.ts` in sequence against a WorkOS staging environment; ordinary suite commands select neither file. Without its settings, it fails with a setup error, which is not a pass. It drives the hosted AuthKit pages with Playwright and reaches the production portal and application through the local TLS front at `https://localhost:24443/`. It needs OpenSSL and Docker Engine for the disposable verified-TLS PostgreSQL of the scoped removal proof and of the SO-07 signup scenario, which reaches only an in-process Render fake. That proof creates fresh staging fixtures, records exact IDs, and verifies cleanup; it creates no factor or directory resource. Set an absolute `LIGHTPANDA_BIN` path to the pinned renderer for the hosted startup version check. The single password-only profile reads back `passwordAuthEnabled: true`, `mfaEnabled: false`, and `mfaRequired: false` before login and changes no provider setting. API-created verified users do not prove fresh email verification or password reset; those remain applicable live/manual requirements. The [test gate policy](docs/implementation/test-gate-policy.md#hosted-live-gate-auth-06) gives the settings, the WorkOS configuration, and the prerequisites. Live renderer tests need the pinned Lightpanda executable. The [runtime setup guide](docs/lightpanda-runtime.md#verify-rendering) gives separate commands for local fixture tests and the public-site smoke test. `pnpm test` and `pnpm test:interface` include the public-site smoke test and need public network access.

`pnpm test:interface:axiom` runs the separate OTel interface test against Axiom and
sends one additional test log to `system-log-test`. Normal suite commands do not
select this separate file, but their OTel logger tests also export to that dataset.
The [OTel logger test guide](docs/testing/otel-logger.md) gives the settings, which
the tests read from the environment or the repository's `.env.local`.

`pnpm test:logging:collector` checks the customer Audit sender and the integrated
Admin browser/MCP journey against an isolated TLS receiver and open-source Collector.
It needs Docker and OpenSSL, with network
access only to obtain the pinned container images when they are not cached.
The test network has no outbound access. The tests use real sockets and hostname
verification; they do not relax the sender's public-address policy. This checks
the sender, capture, and dispatch through real Collector receipt. The journey uses
controlled identity, storage, and tool operations. It does not prove an Admin's
live destination or durable storage. These `.runtime.ts` files run only through
this dedicated command.

`npm run check` runs type checking, unit tests, portal acceptance tests, and
builds the portal bundle. Portal tests
run from TypeScript source on Node 24 because the Node build excludes browser source.

`npm run check` does not run the full integration, acceptance, interface, or container suites,
the hosted image gate, or the renderer gate.

Before Ready, run the full ordinary suite with `npm test` only when the pull
request changes a file under `src/`, plus the remaining static and build checks
in the test gate policy. Do not add `npm run check`, which would repeat unit
and portal tests. For changes under `test/`, run only the affected test groups,
including the groups that use changed helpers or fixtures. For
scripts, documents, configuration, and tooling, use relevant build, type, lint,
or manual checks. Tests under `test/` verify behavior whose subject is under `src/`. Combine
these selections for mixed changes; a `src/` change requires the full ordinary
suite. A selected command or test must not start a broader suite indirectly.
Document changes alone need no executable tests added to check prose. Keep
`habit-hooks` and the static ast-metrics review for each pull request. The
[test gate policy](docs/implementation/test-gate-policy.md) gives the group
selection, prerequisites, focused commands, and applicable gates. Explicit
release work uses the separate release checks below.

`pnpm test:container` makes a clean build, builds the image of the current candidate with Docker, and runs `dist/test/acceptance/auth/self-hosted-container.test.js` with `THERMUS_CONTAINER_GATE=1`. The containers run with the production settings of the image and without outbound access. `pnpm test` and `pnpm test:acceptance` select the same file, but they skip its suite. Only `pnpm test:container` is a [container gate](docs/implementation/test-gate-policy.md#container-gate) pass.

`pnpm build:hosted` runs `check`, all emitted integration tests, the selected
architecture and hosted acceptance/interface tests, including signup close and
reopen, public search, shared capacity, search shutdown, and both real local
renderer gates. Set an absolute `LIGHTPANDA_BIN` to
Lightpanda 1.0.0 and have OpenSSL in
`PATH`. No live credentials or public network access are
needed. `Dockerfile.hosted` supplies the renderer and requires these checks
before it can produce the runtime. The [hosted offline build checks](docs/implementation/test-gate-policy.md#hosted-offline-build-checks)
give the exact selection and prerequisites.

`pnpm test:container:hosted` builds and tests the final hosted image for Linux
AMD64, with a native or emulated Docker builder/runtime and public HTTPS
egress to `https://example.com/`. The file
`test/acceptance/auth/hosted-image.test.ts` uses the standard acceptance-test
name. The ordinary `test` and `test:acceptance` command globs explicitly exclude
`hosted-image.test.js`. Only this command runs the [hosted image gate](docs/implementation/test-gate-policy.md#hosted-image-gate).
The workflow [`.github/workflows/hosted-image.yml`](.github/workflows/hosted-image.yml)
runs this command on a native AMD64 runner at each merge to `main` and at each
manual dispatch without deploy inputs, and then pushes the tested image to GHCR.
[Hosted release](#hosted-release) gives the release path.
The [RHD-03 record](docs/implementation/rhd-03.md) gives the current proof
status and the completed Linux AMD64 image proof. The image ships the
owner-selected pinned EasyList snapshot for the hosted rules. The [hosted image policy](docs/reference/ad-rules.md#hosted-image-policy)
gives its provenance, license, limits, and update process. The self-hosted
Compose installation keeps its separate gate.

`pnpm test:mcp:renderer` makes a clean build and runs both explicit renderer
files: `dist/test/acceptance/mcp/get-url-as-markdown.runtime.js` and
`dist/test/acceptance/mcp/search-pipeline.runtime.js`. Their `.runtime.ts`
names keep them out of ordinary suite globs. Set `LIGHTPANDA_BIN` to the
absolute path of the pinned Lightpanda 1.0.0 executable; the
[runtime setup guide](docs/lightpanda-runtime.md#verify-rendering) gives the
steps. Both files use local fixtures and need no public network access or
Axiom credentials. The search transport maps the canonical Brave request to
a local renderer fixture and returns canonical Brave metadata to the real
engine. It proves local rendering, classification, cleaning, and MCP output.
It does not prove current Brave access. The last phase of `pnpm build:hosted`
runs both complete files. Missing or unsupported renderer setup fails the gate.
The [renderer gate policy](docs/implementation/test-gate-policy.md#renderer-gate-mcp-p03)
gives the evidence rules.

`pnpm test:mcp:search:live` makes a clean backend build and runs only
`dist/test/acceptance/mcp/search-pipeline.live.js`. It calls the public Brave
provider through the real adapter, classifier, cleaners, and MCP result with
the pinned renderer. It needs public network access and no API key. A block,
rate limit, or unsupported page fails the proof. Ordinary suites and offline
or container build gates do not select it. Record the dated tool result
separately from the local fixture result under
[SEARCH-06](docs/implementation/search-pipeline-plan.md#search-06-prove-the-pinned-runtime-and-select-the-delivery-gates).

`pnpm work-slice:basic-mcp-url-fetch` runs `test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.ts` from source with `tsx`. The file name has no `.test`, so `pnpm test` and `pnpm test:acceptance` do not select it, as with the `.runtime.ts` and `.live.ts` files. The script composes the production parts with the test-only mock provider, which accepts any Bearer token. It prints the command that adds the server to Claude Code with a static `Authorization` header. It sends its log only to Axiom's `system-log-test` dataset: one tool call writes the URL before the fetch, the Markdown after it, and the completion record. The console shows only the export failures and, when the script fails, one `FATAL` line. The script reads the settings of the server. `PUBLIC_BASE_URL` is required, for example `http://127.0.0.1:8080`. `AD_RULES_FILE` is required; an empty file gives no ad rules, as for the server. `LIGHTPANDA_BIN` must be the absolute path of the pinned Lightpanda 1.0.0. `LISTEN_HOST` and `LISTEN_PORT` are optional; the default port is 8080, and it must be free. The script also needs the Axiom settings of the [OTel logger test guide](docs/testing/otel-logger.md), in the environment or in `.env.local`, and public network access. `test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.sh` sets the required settings with their defaults, except `AXIOM_API_KEY`, and runs the entry point with the pinned Node runtime of pnpm from the repository root, also when you start it from another directory; a signal to its process stops the server. The [README of the slice](test/acceptance/work-slice/basic-mcp-url-fetch/README.md) describes it, and the [work slice guide](test/acceptance/work-slice/README.md) lists the slices. The [work slice plan](docs/implementation/basic-mcp-url-fetch-plan.md) records the decisions and the run. The acceptance test of the slice, `test/acceptance/work-slice/basic-mcp-url-fetch/basic-mcp-url-fetch.test.ts`, runs offline in the acceptance suite with a renderer double. The script is a development tool. Production keeps Better Auth and the hosted WorkOS provider, and no server setting selects the mock provider.

`pnpm work-slice:auth-workos-mcp-url-fetch` runs `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.ts` from source with `tsx`. As for the basic slice, no test command selects it. The script starts the hosted edition with the real WorkOS provider and the fetch tool behind the local HTTPS site at `https://localhost:24443/`. Thus it cannot run at the same time as the hosted live gate. Start it through the staging launcher and its launcher script, `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.sh`. The staging launcher gives the three WorkOS settings. The launcher script sets the other settings with their defaults and makes the certificate when it is missing. The [README of the slice](test/acceptance/work-slice/auth-workos-mcp-url-fetch/README.md) gives the setup in WorkOS, the settings, the walk with Google sign-in and Claude Code, and the log lines. The acceptance test of the slice, `test/acceptance/work-slice/auth-workos-mcp-url-fetch/auth-workos-mcp-url-fetch.test.ts`, runs offline in the acceptance suite with the fake WorkOS API and a renderer double.

Only the slice enables automatic onboarding: a trusted WorkOS Google sign-in with a verified exact `thermus.ai` email domain can create an absent membership with the explicit role `user` in `THERMUS_SLICE_ORGANIZATION_ID`. The launcher defaults that ID to the staging slice organization. Existing roles and membership states stay unchanged. The browser session selects the organization before the client opens its own Connect OAuth consent. Normal hosted startup enables no onboarding policy and keeps the `member` default role. The [validation record](docs/implementation/auth-workos-mcp-url-fetch-validation.md) gives the completed checks and retained findings. The live Google, Connect, HTTPS fetch, and Axiom proof remains required before the draft PR is ready.

The hosted WorkOS, organization, and administration tests are offline. They use
doubles or a local fake of the WorkOS API. The [hosted offline checks](docs/implementation/test-gate-policy.md#hosted-offline-checks)
give the focused integration and acceptance selection. A pass proves the
application side and does not prove WorkOS behavior or pass the hosted live gate.

The small-text acceptance tests exercise the sanitizer and Defuddle through the public pipeline. `pnpm test:acceptance` runs them with the other acceptance tests. To run only this file:

```sh
npm run build && node --test dist/test/acceptance/small-text-cutoff.test.js
```

### Release checks

A release of the self-hosted evaluation image needs these commands on a clean checkout of the release commit: `git status --porcelain` shows nothing, because the image build and the container gate read the working tree. Each command must exit with status 0 and show each required test as passed:

```sh
npm run check
habit-hooks
npm run test:integration
npm run test:acceptance
npm run build && node --test dist/test/interface/auth/better-auth.test.js
npm run test:container
```

For `habit-hooks`, correct each finding or give the reason that you keep it. Then build the release image with `docker compose build`. The [test gate policy](docs/implementation/test-gate-policy.md#self-hosted-release) gives the release rules. A self-hosted release does not claim payment collection, hosted features, or migration between editions.

### Hosted release

The workflow [`.github/workflows/hosted-image.yml`](.github/workflows/hosted-image.yml)
is the release path of the hosted image, from SO-02 of the
[self on-boarding plan](docs/implementation/self-onboarding-plan.md#slice-2-free-tier-end-to-end).
The [SO-02 record](docs/implementation/self-onboarding-s1.md#so-02-release-path-on-each-merge-to-main)
gives its runs.

- **Build on each merge.** Each push to `main` starts the job "Build, gate,
  and push the hosted image". It builds `Dockerfile.hosted` for `linux/amd64`
  one time, runs the [hosted image gate](docs/implementation/test-gate-policy.md#hosted-image-gate)
  against that image, and pushes the tested image as
  `ghcr.io/tomer-mayara/thermus-hosted:<commit SHA>`. The job summary and the
  log give the digest, the compressed size, and the build, gate, and push
  times. A failed offline check stops the build, and a failed gate stops the
  job, so nothing is pushed. A manual dispatch without inputs does the same
  for the branch that it names.
- **Deploy only by a manual dispatch on `main`.** A merge deploys nothing. Give
  two inputs: `digest`, the digest of an image that a run pushed
  (`sha256:<64 hex>`), and `service_id`, the Render web service, for example
  `gh workflow run hosted-image.yml --repo tomer-mayara/Thermus --ref main -f digest=sha256:<digest> -f service_id=srv-<ID>`.
  The job "Deploy a pushed digest to a Render web service" checks the request
  before any call, checks that GHCR has the digest as one `linux/amd64` image,
  and then calls the Render API deploy with `imageUrl`
  (`POST /v1/services/<ID>/deploys`). That call also sets the image setting
  `imagePath` of the service, so later Render deploys use the same image. A
  deploy hook does not: after a hook deploy, later deploys use the image of the
  service settings, so the workflow uses no deploy hook. The job reads the
  deploy every 5 s until it is `live`, for at most 15 minutes. Then it checks
  that the live deploy and `imagePath` name the digest, and it requests
  `/healthz` on the public URL of the service until the answer is `200` with
  `ok`. After a `502`, it sends the request again, at most 6 requests 5 s
  apart; each other answer fails the job. The public URL is a verified custom
  domain, such as `app.thermus.ai`, or else the `onrender.com` URL. The job
  summary names the service, the deploy ID, the image before and after, and
  the health result. A failed step fails the run.
- **Refusals.** A deploy request on another branch fails before any call. The
  service must be a web service of the Thermus AI workspace that runs an
  image of `ghcr.io/tomer-mayara/thermus-hosted` and is not suspended. Tenants
  are private services; the fleet script of SO-09 deploys them. The production
  service `srv-db8mnqg473hc739d529g` also needs the third input
  `confirm_production` with that same service ID.
- **Production.** Production still builds from Git, with automatic deploys off
  (`autoDeploy: no`). It changes to the image at step 5 of the SO-12 order, an
  API deploy of the release candidate digest. Do not dispatch a deploy of
  production before that step. The
  [SO-12 release record](docs/implementation/self-onboarding-s2-release.md#4-production-order)
  gives the candidate, the order with its checks, and the rollback image.
- **Key.** The deploy job runs in the GitHub environment `production`. It
  reads the secret `RENDER_API_KEY` of that environment: the API key of a
  dedicated Render user who is a Member of the Thermus AI workspace. The job
  also reads `GITHUB_TOKEN`, and it never prints the key or the token. The
  deployment branch rule of the environment allows only `main`. GitHub refuses
  a job of the environment on another branch before the job starts. A job
  outside the environment cannot read the secrets of the environment. So, when
  the repository has no secret `RENDER_API_KEY`, a workflow on another branch
  cannot reach the key. The repository secret stays until the first dispatch
  on `main` passes with the environment; then the owner deletes the repository
  secret. Until then, the job reads the environment secret first, and the
  repository secret only when the environment has none. The request check of
  the workflow keeps its own branch rule. On GitHub Free, environment secrets
  and deployment branch rules work only in a public repository (GitHub
  documentation, read on 31 October 2026). This repository became public on
  31 October 2026. GitHub shows each deploy run as a deployment to
  `production`, also when the target is another service. To rotate the key,
  follow [runbook 5.1](docs/implementation/tenant-fleet-runbooks.md#51-render-api-keys).

GHCR facts, from the GitHub documentation read on 26 and 27 October 2026:

- **Quota.** Container image storage and bandwidth of the Container registry
  are free now, and GitHub gives at least one month of notice before a change.
  Other private packages share 500 MB on GitHub Free, or 2 GB on Pro and Team,
  with Actions artifacts.
- **Visibility.** The package `ghcr.io/tomer-mayara/thermus-hosted` is private
  and linked to this repository, and it gets its access from the repository.
  Render pulls it with the registry credential `ghcr-thermus-hosted-read` of
  the Thermus AI workspace, whose token has only `read:packages`. The token
  has an expiry date;
  [runbook 5.4](docs/implementation/tenant-fleet-runbooks.md#54-github-token-of-the-registry-credential)
  rotates it.
- **Limits.** 10 GB for each layer and 10 minutes for each upload. The image is
  about 148 MiB compressed, in 16 layers.
- **Retention.** GHCR deletes no version automatically. Each build adds one
  version. A deleted version can be restored for 30 days.

**Pruning rule (27 October 2026).** Keep every digest that the control plane or
a tenant runs, and the last ten release digests for a rollback. A release
digest is the image of a commit on `main`: its tag is that commit SHA. Once a
month, delete the other versions:

1. Get a token with `read:packages` and `delete:packages`, for example with
   `gh auth refresh --scopes read:packages,delete:packages`.
2. List the versions with their digests, dates, and tags:
   `gh api --paginate /user/packages/container/thermus-hosted/versions --jq '.[] | [.id, .name, .created_at, (.metadata.container.tags | join(","))] | @tsv'`.
3. Write down the digests to keep: the `imagePath` of the control plane, from
   the Render Dashboard or `GET /v1/services/<ID>`; `TENANT_IMAGE` of the
   control plane, the image of each new tenant; the `image_digest` of each
   `tenants` row that is not `deleted`; and the ten newest versions whose tag
   is a commit of `main` (`git merge-base --is-ancestor <tag> origin/main`).
4. Delete each other version on the package page (**Delete version**), or with
   `gh api --method DELETE /user/packages/container/thermus-hosted/versions/<version ID>`.

The [monthly pruning runbook](docs/implementation/tenant-fleet-runbooks.md#55-monthly-ghcr-pruning)
adds the checks, the restore of a version, and the removal of the two scopes.
