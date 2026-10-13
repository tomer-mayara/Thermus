# Magumagu

Magumagu is the web tool an agent is allowed to use. An admin turns off native web search, points the agent at this MCP server, and every fetch comes back as a cleaned page with a log line.

Agents need the web, and today that means an unlogged fetch from a process that can also see company data. A page can carry hidden instructions. A query can carry an internal project name out to a search engine. The same fetch also burns tokens on ads, navigation, and pages the agent already retrieved. DongAI sits on that path. It does not sit on the network: a local harness with a shell can still go around it, and a web app only reaches it after native search is off.

The server does four things with each call. It checks the tenant's allowlist and denylist. It redacts a configured list of internal terms from the outbound query. It fetches the page, strips scripts, hidden text, ads, and boilerplate, and returns markdown. It writes a log of the query, the URL, and a hash of what it returned.

Fetching is deliberately not a disguise. The client announces itself as a bot. A normal HTTP fetch is tried first. If the body is an empty shell, a local Lightpanda process runs the JavaScript and returns the DOM as HTML. The same cleaner handles both. A site that refuses bots stays refused.

Lightpanda waits for `networkidle`. The fetcher allows five seconds from process launch for readiness, including navigation. It can return as soon as the page is ready. If the child has already exited when the deadline fires, the fetcher preserves its completion result. If the child is still running, the fetcher sends `SIGKILL` and waits for the child process callback. It then rejects with `Lightpanda readiness limit exceeded after 5000 ms`, even if that callback reports success. It does not return partial HTML.

Use the pinned Lightpanda **1.0.0** runtime. The [runtime setup guide](docs/lightpanda-runtime.md) gives the release download, SHA256 checks, version check, and `LIGHTPANDA_BIN` selection. Lightpanda supports [`--wait-until networkidle --wait-ms 60000`](https://lightpanda.io/docs/reference/cli/fetch) and can return partial HTML with success when its native wait limit expires. The fetcher's five-second readiness limit prevents that output from being returned. The separate process timeout is 60000 ms, and the output limit is 32 MiB. Readiness does not guarantee that scripts or content that appear much later will be present. Test fixtures keep these production readiness options and allow loopback only inside the trusted test scope.

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

The ad cleaner takes trusted ABP rules as a constructor string. The application owns rule loading and updates. It applies domain rules using the fetched page's `finalUrl`. See [Ad rules](docs/reference/ad-rules.md) for examples and no-op behavior.

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

Embedded selectors match a `parse5` HTML tree. The parser inserts implied `html`, `head`, and `body` elements before selector matching. It also inserts implied `tbody` elements in tables, as specified by the [HTML parsing rules for tables](https://html.spec.whatwg.org/multipage/parsing.html#parsing-main-intable). The CSS work budget for each scan covers at most 1,000,000 node checks, parent reads, element-name reads, attribute reads, and returned element-name and attribute-value characters combined. A selector can contain at most 128 direct selector nodes and 4096 generated characters. Exceeding a selector limit or the scan work budget raises `RangeError`; cleaning fails without returning partly checked HTML or Markdown.

The hidden-style checks cover `display:none`, `visibility:hidden` or `collapse`, and `content-visibility:hidden`. They also cover opacity below `0.01`, near-zero font sizes, far offscreen offsets, zero-area clips, hiding transforms and opacity filters, transparent or same-color text, and near-zero dimensions with `overflow:hidden`. A near-zero length or size has magnitude below `0.01`. An offset below `-900` in these units counts as offscreen: `px`, `em`, `rem`, `ex`, `ch`, `pt`, `pc`, `in`, `cm`, or `mm`. An offset at or below `-100` in `vw`, `vh`, `vmin`, or `vmax` also counts as offscreen. Percentage box offsets and `text-indent` use the same `-100` rule.

The sanitizer hides `clip:rect()` when opposite edges match within `0.01` in the same units. It hides `clip-path:circle(0)`. It also hides an `inset()` when all four expanded edges are at least `50%`.

The transform checks use the composed matrices and inherited state described above. An `opacity()` filter below `0.01` also counts as hidden. These checks do not use rendered geometry or full browser layout.

This check does not fetch linked stylesheets or `@import` rules. It skips at-rules, media queries, layers, and nested rules. It cannot resolve deferred values, calculated values, page geometry, or all inherited properties and shorthands. The font and transform checks support only the units, functions, inheritance, and shorthand rules described above. An unresolved `background`, `background-color`, or `background-image` value prevents a same-color verdict because unknown paint may make text readable. A percentage in `translate()` cannot prove that content is hidden. An unresolved value alone cannot prove that content is hidden. An independent supported rule can still hide content. Inherited properties outside the supported font and transform rules retain the existing subtree behavior. For example, a hidden `visibility` value can still remove descendants that override it. Selector matching uses browser-compatible HTML tree construction, but the visibility checks do not compute full browser layout.

The step applies the configured font-size cutoff to visible text. It does not enable content-based span deletion, secret redaction, or homoglyph normalization. It does not fetch pages or call a model. Pipeline composition and startup warm-up are deferred to loader and acceptance tests.

The ad cleaner limits parsed HTML to 256 element levels. See [HTML processing limits](docs/reference/html-processing-limits.md) for the depth rule and error behavior.

**MVP.** One tool, `fetch`. Allowlist, denylist, and outbound redaction. Boilerplate and hidden-text stripping. Per-tenant content cache. Audit log. A container that runs the server and Lightpanda on localhost, and a hosted version of the same container.

Out of scope: step-up approval, a second renderer, request-level ad blocking, and any connector other than the web. Done when an admin can disable native search, point an agent at DongAI, and get a cleaned page back with a log line for every fetch.


## MCP server component

[`MCPServer`](src/mcp/mcp-server.ts) wraps the official TypeScript SDK v2. Pass an SDK transport to `server.connect(transport)` and call `await server.close()` to release the connection. The SDK handles `server/discover` and advertises the `magumagu` identity with support for protocol version `2026-07-28`. A stdio connection has no verified user, so it registers no tools. A later local stdio entry must first bind a selected active local user.

For HTTP requests, construct the server with `{ auth: { verifier, accessResolver, resourceMetadataUrl, expectedResource }, registerTools, reportFailure }` and call `await server.fetch(request)`. The verifier implements our [`IdentityVerifier`](src/mcp/identity-verifier.ts) contract, and the access resolver implements [`AccessResolver`](src/auth/access-context.ts). MCPServer validates the Authorization header before the SDK verifies the token. Missing or malformed headers receive HTTP 401 with a Bearer challenge and the configured protected-resource metadata URL. Call `await server.close()` to release the HTTP handler and any transport connection.

`verifyAccessToken(token)` returns a `VerifiedIdentity`: the verified user (`authority`, `subject`, and an optional `selectedOrganizationId`), the token `issuer`, the OAuth `clientId`, the granted `scopes`, `issuedAtUnixSeconds`, `expiresAtUnixSeconds`, and the `resource` URL from the token audience. A provider accepts only human user tokens. The client ID identifies the client application; it is never a user or tenant ID. Throw `InvalidAccessTokenError` to reject a token. The adapter turns that error into a generic `401 invalid_token` response. It gives the same response for an identity without a user, issuer, client ID, issue time, expiration, or audience, and for an identity whose user subject is the client ID. Any other verification error is unexpected. It receives a generic `500 server_error` response, and MCPServer reports it to `reportFailure`. The adapter puts frozen copies of the verified claims in `AuthInfo.extra`: `user`, `issuer`, `clientId`, `scopes`, `issuedAt`, `expiresAt`, and `audience`.

`auth.expectedResource` is the MCP resource URL. The SDK rejects an expired token or a token for another audience with `401 invalid_token`. Set `auth.requiredScopes` to require OAuth scopes. The SDK rejects a token without them with `403 insufficient_scope`, and the Bearer challenge includes the required scopes. Require only scopes that the configured OAuth flow can grant.

MCPServer verifies each token once. Then it gives only the verified user to `accessResolver.resolve(user)`. Request headers, tool arguments, earlier requests, and the client ID cannot select the user, tenant, or organization. An allowed decision carries a `RequestContext` from `createRequestContext()`: the user, the trusted tenant ID, the optional organization, every current role grant, and the union of the permissions of all grants. MCPServer binds a frozen copy of that context to the request. The SDK factory gives it to `registerTools(server, context)`. Each tool calls `requirePermission(context, permission)` before its work starts. A denied decision receives `403 access_denied` without a Bearer challenge. A resolver failure, or an allowed decision without a tenant ID, receives a generic `500 server_error`, and MCPServer reports it to `reportFailure`. After a refusal, no factory, tool, or MCP dispatch runs. Production code registers no tools yet.

`reportFailure(report)` lets the operator see an unexpected failure, such as a provider outage. MCPServer calls it one time for each request that fails unexpectedly, before the client gets the generic `500 server_error`. The client response does not change. The [`FailureReport`](src/mcp/mcp-server.ts) has the failed `step`, `token-verification` or `access-resolution`, and the original error as its `cause`. Expected results give no report: a missing or malformed Authorization header, a rejected token, a missing scope, and an access denial. A report contains no request data, so it holds no raw token, cookie, password, or other credential from the request. The verifier receives the raw token, so its errors must not contain the token. The callback must not throw. The composition decides where the reports go; MCPServer adds no logging framework or telemetry.

The [discovery test](test/unit/mcp/discovery.test.ts) connects a real SDK client through an in-memory transport. The MCP unit tests use [`IdentityVerifierMock`](test/unit/mcp/fixtures/identity-verifier-mock.ts), [`AccessResolverMock`](test/unit/mcp/fixtures/access-resolver-mock.ts), [`FailureReporterMock`](test/unit/mcp/fixtures/failure-reporter-mock.ts), and test-only factory tools with the real SDK middleware. The [integration tests](test/integration/auth/mcp-context.test.ts) add the real access contracts. The [access acceptance tests](test/acceptance/auth/mcp-access.test.ts) and the [failure report acceptance tests](test/acceptance/auth/mcp-failure-reports.test.ts) use a real MCP client. The [test inventory](docs/testing/test-list.md) lists the cases. In the self-hosted edition, [`BetterAuthProvider`](src/auth-better-auth/better-auth-provider.ts) is the verifier and the access resolver, and Better Auth serves the metadata documents; the [sign-in and MCP client guide](#sign-in-and-mcp-clients) gives the details. The hosted identity provider remains planned; until it exists, the [hosted edition](#hosted-edition) answers each MCP request with `503`. The [Better Auth interface proofs](test/interface/auth/better-auth.test.ts) check the pinned local provider packages; the [authentication plan](docs/design/authentication-design.md#pinned-provider-proof) records the proven contracts and the resolved provider blockers.

## Deployment configuration

[`loadDeploymentConfig(environment, transport)`](src/config/deployment-config.ts) checks the settings before the server listens. It reads only the record that it gets, never `process.env` directly. A missing or incorrect setting throws `DeploymentConfigError`; the message names the setting and the rule, but never its value. [`.env.example`](.env.example) documents each setting with placeholder values.

- `DEPLOYMENT` alone selects the edition: `self-hosted` or `hosted`. There is no `AUTH_MODE`, no mock mode, and no setting that enables paid features locally. Invalid hosted settings never fall back to the self-hosted edition or to anonymous access.
- `PUBLIC_BASE_URL` is the canonical public address. It gives the MCP resource URL (`<base>/mcp`) and its protected-resource metadata URL. Forwarded request headers never change it. It has no credentials, query, or fragment. The hosted edition requires `https`. The self-hosted edition requires `https`, but it can use `http` on `localhost`, `127.0.0.1`, or `[::1]` for local development.
- The self-hosted edition reads `DATA_DIR`, an absolute path.
- The hosted edition reads no other setting. It reads no `WORKOS_*` setting, so a value of such a setting changes nothing: it turns on no provider and no access, and it appears in no error. The WorkOS provider that replaces the [hosted placeholder](#hosted-edition) will read and check its own settings. Hosted startup rejects stdio.
- [`loadListenAddress(environment)`](src/config/deployment-config.ts) reads the optional `LISTEN_HOST` and `LISTEN_PORT` for both editions. The defaults are `127.0.0.1` and `8080`. The port is a whole number from 0 to 65535; with 0, the system selects a free port. The listen address never changes the public identity from `PUBLIC_BASE_URL`. Use `LISTEN_HOST=0.0.0.0` in a container.

The server calls both loaders before it opens any resource or listens.

## Self-hosted server

Start the server from a build, or run it in a container as [container installation](#container-installation) tells. For a build, `DATA_DIR` must be an existing directory:

```sh
mkdir -p /tmp/magumagu-data
pnpm build
DEPLOYMENT=self-hosted PUBLIC_BASE_URL=http://localhost:8080 DATA_DIR=/tmp/magumagu-data pnpm start
```

[`src/index.ts`](src/index.ts) starts the server when it gets no arguments. With arguments, it runs one of the offline [local account and client commands](#local-accounts-and-clients). The server loads the settings, calls [`createApplication(config, logger)`](src/application.ts), and serves the application through the Node HTTP bridge, [`startHttpServer()`](src/http/server.ts). It writes `Listening on <address>` to stderr. `SIGINT` or `SIGTERM` stops it: the HTTP server stops, then the application releases its resources, and the process exits with status 0. The stop handlers are in place before the `Listening on` line, so a signal that a script sends as soon as the line appears also gets this clean stop. A second signal ends the process at once. A startup failure writes one `FATAL` line, which names the problem but no secret, and exits with status 1.

`createApplication()` makes the one edition branch. Only the self-hosted branch loads the Better Auth runtime. The hosted branch starts the [hosted edition](#hosted-edition) placeholder and never falls back to the self-hosted edition.

[`openBetterAuthRuntime(settings)`](src/auth-better-auth/better-auth-runtime.ts) owns the local resources and opens them in this order:

1. The exclusive data-directory lock, `DATA_DIR/data-directory.lock`, from [`lockDataDirectory()`](src/auth-better-auth/data-directory-lock.ts). Another server or command that uses the same directory stops with `DataDirectoryInUseError` and changes no data. The lock does not wait for its holder, so that process stops at once. When several processes start at the same time with the same directory, exactly one of them gets the lock. The operating system releases the lock when the process ends, also after a crash.
2. The installation, from [`openLocalInstallation()`](src/auth-better-auth/local-installation.ts). For fresh data, it writes a generated secret to `auth.secret`. Then, in one transaction, it applies the shipped migrations to `auth.sqlite` and stores one installation UUID in the singleton `magumagu_installation` row. Both files have mode `0600`. The singleton holds only the installation identity; it does not limit the number of accounts.
3. Better Auth with the [proven provider settings](docs/design/authentication-design.md#pinned-provider-proof). `clientReference` returns the installation ID, so the installation owns each registered client. Startup waits for the provider's schema check and stops if the schema does not match. The settings keep the origin and CSRF checks on, also with `NODE_ENV=test` or with `TEST` set. Better Auth reads `BETTER_AUTH_SECRETS`, `BETTER_AUTH_TRUSTED_ORIGINS`, and `BETTER_AUTH_TELEMETRY` from the process environment, also when a setting disagrees. No setting stops that without another effect: the `secrets` setting stops `BETTER_AUTH_SECRETS`, but it changes the encryption format of the stored keys. Thus, when one of these variables has a value, startup stops with `ProviderEnvironmentError`, which names the variable but not its value. The provider secret is always `auth.secret`. The [provider environment variables](docs/design/authentication-design.md#provider-environment-variables) give the reasons.

The runtime reports the tenant `local:<installation-id>`, and the server logs it at startup. If a startup step fails, the runtime releases the resources that it already holds, in reverse order. `close()` closes the database and then releases the lock.

Retained data keeps its identity. Startup stops with `LocalInstallationError` when a database with schema objects has no valid installation identity, when `auth.secret` is missing or not valid, or when the database has another schema version. The server never creates a new identity for retained data. To recover, restore the complete data directory from a backup, or move the data away to start a new installation. Fresh data always gets a new tenant.

The server starts with zero accounts or with only disabled accounts, and protected access stays denied. To recover, stop the server and add an account with `users add`. The application routes each request by its path. The MCP endpoint, `<base>/mcp`, goes to MCPServer, which uses [`BetterAuthProvider`](src/auth-better-auth/better-auth-provider.ts) to verify each token and to check the current account. The discovery documents, `<base>/api/auth/oauth2/authorize`, and `<base>/api/auth/oauth2/token` go to Better Auth. The bundled pages, `<base>/sign-in`, `<base>/consent`, and `<base>/authorization-error`, go to [`LocalAuthPages`](src/auth-better-auth/local-auth-pages.ts). Other paths give `404`, also the provider's sign-up, sign-in, session, introspection, and client routes, so there is no public sign-up or account-create route. The application gives MCPServer [`operatorFailureReporter(logger)`](src/application.ts) as `reportFailure`: it writes each failure report as one `ERROR` line with the failed step and the cause. A missing or rejected token gives no report. Without a resource-server client for the MCP resource of `PUBLIC_BASE_URL`, the MCP endpoint cannot check a token: a request with a valid token gets a generic `500`, and its `ERROR` line tells the operator to run `clients register`. The [sign-in and MCP client guide](#sign-in-and-mcp-clients) describes the flow.

The HTTP bridge builds each request URL from the origin of `PUBLIC_BASE_URL` and the request target, so the `Host` header and forwarded headers cannot change it. It refuses a target that is not in origin form (`/path?query`) with `400`, and `TRACE` with `501`. It removes every client copy of `x-magumagu-client-address` and sets that header to the socket address, for the provider's rate limits. It streams request and response bodies and keeps each `Set-Cookie` header separate. When a client disconnects, it aborts the request signal and cancels the response body. A handler failure gives a generic `500` and a log line without request data. When the server stops, the bridge refuses new connections, lets running responses finish, and ends the remaining connections after five seconds.

To make a backup, stop the server and copy the complete data directory. To restore, copy all of its files together into an empty directory, and start the server with that `DATA_DIR`. The installation ID, the tenant, the user IDs, the browser sessions, the registered clients, the consents, the signing keys, and the resource-server client in `resource-server-client.json` stay the same. Filesystem access to the data directory is administration authority for the installation; it gives no application role.

[`migrations/auth-local/`](migrations/auth-local/) holds the shipped SQL. `0001-better-auth.sql` is the output of Better Auth `compileMigrations()` for the pinned packages and the provider settings on an empty database. `0002-installation.sql` adds the singleton installation table. The server never downloads a migration tool. A unit test fails if the shipped SQL is different from the output of the pinned provider; after a change to the provider packages or settings, generate the file again.

## Container installation

The container image is the self-hosted evaluation edition. It holds the server and the offline commands of the same program, the shipped migrations, the bundled sign-in and consent pages, and the pinned production packages. The server and the commands need no outbound connection: a start downloads nothing, and telemetry is off. The image has no Lightpanda renderer, because no production tool fetches pages yet.

You need Docker Engine with Buildx and Compose. The image build downloads the pinned base images and packages, so the build needs network access. Run the commands from the repository root:

```sh
docker compose build
docker compose up -d
docker compose logs magumagu
```

The log shows the tenant of the installation and `Listening on http://0.0.0.0:8080`. A fresh installation has no account and no client. Add them as **Accounts and clients** below tells. Then a user can connect a supported MCP client to `http://localhost:8080/mcp`; the [sign-in and MCP client guide](#sign-in-and-mcp-clients) gives its settings. `docker compose stop magumagu` stops the server, and `docker compose start magumagu` starts it again.

**Settings.** [`compose.yaml`](compose.yaml) has one service, `magumagu`, with an init process. The [`Dockerfile`](Dockerfile) sets `DEPLOYMENT=self-hosted`, `DATA_DIR=/var/lib/magumagu`, `LISTEN_HOST=0.0.0.0`, `LISTEN_PORT=8080`, and `NODE_ENV=production`, and the image runs as the `node` user. The service sets `PUBLIC_BASE_URL`, by default `http://localhost:8080`, and publishes port 8080 on `127.0.0.1` only. With `http` on `localhost`, the port of `PUBLIC_BASE_URL` is the published port. Another address must use `https`: put a TLS reverse proxy in front of the published port, and set `PUBLIC_BASE_URL` to the address of the proxy, in the shell or in a `.env` file next to `compose.yaml`. A registered client belongs to the MCP resource of one `PUBLIC_BASE_URL`, so after a change, register the clients again. A published port and a reverse proxy give the server the same client address for all users. Thus the sign-in limit of three attempts in ten seconds for each client address applies to all users together. The image sets no telemetry setting. Do not set `BETTER_AUTH_TELEMETRY` or the other [refused Better Auth variables](#self-hosted-server): startup stops.

**Data volume.** The named volume `magumagu_magumagu-data` is mounted at `DATA_DIR`. It holds all data of the installation: `auth.sqlite` with the accounts, sessions, clients, consents, signing keys, and installation identity; `auth.secret`; `resource-server-client.json`; and `data-directory.lock`. The image keeps no data. Only the `node` user of the image can open the directory (mode `0700`). `auth.sqlite`, `auth.secret`, and `resource-server-client.json` have mode `0600`. Access to the volume is administration authority for the installation; it gives no application role.

**Accounts and clients.** The commands of [local accounts and clients](#local-accounts-and-clients) run in a one-off container of the same image with the same volume. Stop the server first, and start it again after the commands:

```sh
docker compose stop magumagu
docker compose run --rm magumagu users add alice@example.com
docker compose run --rm magumagu users add bob@example.com
docker compose run --rm magumagu users list
docker compose run --rm magumagu clients register --user alice@example.com --name "Native MCP client" --redirect-uri http://127.0.0.1:33418/callback
docker compose start magumagu
```

In a terminal, `docker compose run` gives the command a terminal, so the password prompts do not show the typed characters. A script can add `-T` and write one line for each prompt to standard input:

```sh
printf '%s\n%s\n' "$NEW_PASSWORD" "$NEW_PASSWORD" | docker compose run --rm -T magumagu users add carol@example.com
```

While the server runs, each command stops with the lock error and changes nothing. A command in the server container, such as `docker compose exec magumagu node /app/dist/src/index.js users list`, is another process on the same volume, so the lock stops it too.

**Restart and update.** A restart (`docker compose restart magumagu`), a new container (`docker compose up -d --force-recreate`), and a new image (`docker compose build`, then `docker compose up -d`) keep the volume. The installation ID, the tenant, the user IDs, the sessions, the clients, the consents, the signing keys, and the access tokens stay usable. An image with another schema version of the database stops at startup and changes no data, because this version has no data migration.

**Backup and restore.** Stop the server, and copy the complete volume to a tar archive with the `tar` program of the image:

```sh
docker compose stop magumagu
docker compose run --rm -T --entrypoint tar magumagu -cf - -C /var/lib/magumagu . > magumagu-backup.tar
docker compose start magumagu
```

The archive holds the provider secret and the signing keys. Keep it as safe as the volume. To restore, put all files of one archive into an empty volume, and then start the server:

```sh
docker compose down
docker volume rm magumagu_magumagu-data
docker compose run --rm -T --entrypoint tar magumagu -xf - -C /var/lib/magumagu < magumagu-backup.tar
docker compose up -d
```

The restored installation keeps its tenant, the user IDs, the sessions, the clients, the consents, and the signing keys. The database and `auth.secret` must come from the same archive. Retained data without its installation identity, or without `auth.secret`, stops each start with a `FATAL` line that asks for a restore. The server never makes a new identity for retained data. Docker starts the service again and again, and `docker compose logs magumagu` shows the line. Stop the service with `docker compose stop magumagu`, and restore the complete archive.

**Recovery.**

- No account, or only disabled accounts: stop the server, add an account with `docker compose run --rm magumagu users add <email>`, and start the server. The tenant and the other accounts stay. The installation owns each approved client, so the new account can use the registered clients.
- A forgotten password: stop the server and run `users reset-password` in the same way.
- A lock error: stop the server container, then run the command again.
- A new installation: `docker compose down --volumes` deletes the volume with all accounts and data. The next start makes a new installation with a new tenant.

**Edition limits.** All enabled local accounts are equal users of one shared workspace, with the same evaluation permissions. There is no local administrator role. The image has no organizations, invitations, seats, billing, payment collection, or hosted sign-in, and their paths give `404`. With `DEPLOYMENT=hosted`, the container starts the [hosted edition](#hosted-edition) placeholder: each request gets the authentication-unavailable answer, and the container writes nothing to the volume. A change of `DEPLOYMENT` or of another setting is a configuration change: it does not move accounts or data to the other edition. Migration between editions is separate future work.

**Verification.** `npm run test:container` builds this image and runs the [container gate](docs/implementation/test-gate-policy.md#container-gate) without outbound access.

## Local accounts and clients

The self-hosted edition has no public sign-up, invitation, email recovery, or administration page. The operator adds and manages local accounts, and registers MCP clients, with offline commands of the same program. A command needs no network or email service and starts no HTTP listener. All enabled accounts have the same evaluation permissions in one shared workspace.

Stop the server before you run a command. Give the command the same settings as the server: `DEPLOYMENT=self-hosted`, `PUBLIC_BASE_URL`, and `DATA_DIR`. A registered client is linked to the MCP resource of `PUBLIC_BASE_URL`, so a different value gives a client that the server does not serve. Then start the server again.

```sh
export DEPLOYMENT=self-hosted PUBLIC_BASE_URL=http://localhost:8080 DATA_DIR=/tmp/magumagu-data
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

**Revocation.** `users reset-password` and `users disable` delete only the sessions of the selected account. Each MCP access token carries the browser session ID in its `sid` claim, so the tokens of that account become inactive at introspection, and its pending authorization codes fail at the token endpoint. The other accounts keep their sessions and tokens. The local edition issues no refresh tokens, so no refresh grant stays. [`LocalUserAdministration`](src/auth-better-auth/local-user-administration.ts) uses only supported Better Auth operations: `createUser`, which hashes the password; the provider hash, password update, ban, user list, and session deletion of the provider data API; and `signInEmail` with `adminCreateOAuthClient` for client registration. No command edits provider tables with SQL. [`runLocalAuthCommand()`](src/auth-better-auth/local-auth-command.ts) parses the arguments with [`parseLocalAuthCommand()`](src/auth-better-auth/local-auth-command-line.ts) and holds the runtime, with its lock, for the whole command.

**Client registration.** The command registers a public native client: `token_endpoint_auth_method: none`, the `authorization_code` grant only, and PKCE. Each `--redirect-uri` must be an `http` URI on `localhost`, `127.0.0.1`, or `[::1]`, without user information or a fragment. The provider then accepts only these redirect URIs; for a loopback URI it also accepts another port, as RFC 8252 requires. The command signs in the selected enabled account with its password, registers the client with that session, and then deletes that session. The other sessions of the account stay. The installation, not the account, owns the client. Give the printed client ID to the MCP client as its pre-registered client ID. The tested client is the MCP TypeScript SDK 2.3.1 client. Dynamic client registration stays off.

**Resource-server client.** The MCP server checks each access token at the provider's introspection endpoint as a confidential client. The provider registers a client only for a signed-in session, so the first `clients register` also registers this resource-server client in the same session and writes its ID and secret to `DATA_DIR/resource-server-client.json` with mode `0600`. Then the command prints one more line. A later registration uses the stored client. After a change of `PUBLIC_BASE_URL`, the stored client belongs to the old MCP resource, so the next registration registers a new one. No output contains the secret. If the file is damaged, startup and `clients register` stop with `LocalInstallationError`: restore the complete data directory, or remove the file and run `clients register` again.

**Lock errors.** The server and each command hold the same exclusive data-directory lock. A command on a data directory that another Magumagu process uses stops with exit status 1, asks for no password, and changes no data:

```
The data directory is in use by another Magumagu process. Stop that process, then try again.
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

The hosted edition has no authentication provider yet: the WorkOS AuthKit and Connect integration (AUTH-06) is deferred. Until it is ready, `DEPLOYMENT=hosted` starts a small shell with a replaceable placeholder. The shell needs no WorkOS account, credential, SDK, or network access:

```sh
pnpm build
DEPLOYMENT=hosted PUBLIC_BASE_URL=https://magumagu.example pnpm start
```

- Startup checks `PUBLIC_BASE_URL`, which must be an `https` URL, and the listen settings, and it rejects stdio. It reads no `WORKOS_*` setting, opens no data directory, calls no service, and asks for no credential. The log says that hosted authentication is not available yet. `SIGINT` or `SIGTERM` stops the server with status 0.
- Each browser path under `PUBLIC_BASE_URL` gives `503` with the authentication-unavailable notice, for example the root, account, sign-in, onboarding, organization, organization selection, and billing paths. The notice is a small HTML page with no form, script, or cookie.
- The MCP resource, `<base>/mcp`, and its protected-resource metadata give `503` with the OAuth error `temporarily_unavailable` and no Bearer challenge, also for a request without a credential.
- No bearer token, cookie, form token, organization ID, or form value gets an identity, a grant, a session cookie, a tenant, or protected work. No test identity, organization, grant, demonstration mode, or setting turns on access, also not `NODE_ENV=test` or `AUTH_MODE=mock`. There is no anonymous access, default tenant, local fallback, or automatic User role. Other paths give `404`.

The shell is the composition that the hosted provider will replace. [`composeHostedApplication()`](src/application.ts) takes the four parts that change with the provider:

- a [`BrowserSession`](src/hosted-admin/browser-session.ts). It gets only the `Cookie` header of a browser request. A signed-in session gives the verified user, with the organization that its session selected, the form token of the session, its cookie effects, and `selectOrganization(organizationId)`. Thus no form field, query, or other header can choose the user or the organization. The form token is a secret of the session, and each form of the account pages sends it back. It stays the same for the whole session, also after a refresh or an organization switch, so that a form shown before still posts. The cookie effects are `Set-Cookie` values that must reach the browser with the answer, also with a redirect or an error page, so that the browser does not lose a session that the provider refreshed or ended during the request. A signed-out session also has cookie effects. Only `selectOrganization()` changes the organization of a session, and only for that browser. A failure, such as an outage, throws, so that it cannot erase a session;
- an [`AccessResolver`](src/auth/access-context.ts);
- an [`OrganizationDirectory`](src/organizations/organization-administration.ts). `membershipsOf(user)` reads the current memberships of that user from the provider: the organization ID and name, the active state, and every current grant. A grant holds only application permissions, so that a default role, which gives none, authorizes nothing. A failed read throws, so that it never looks like a missing membership;
- the MCP endpoint, which answers the MCP resource and its metadata. The application closes it.

The third argument gives `reportFailure`, which gets each unexpected failure of an account request, and an optional account operation. The hosted edition gives [`accountFailureReporter(logger)`](src/application.ts), which writes one `ERROR` line with the path and the cause: `An account request failed unexpectedly for <path>: <cause>`.

[`HostedAccountRoutes`](src/hosted-admin/account-routes.ts) checks the browser session first for each path. An unavailable session gets `503` with the notice and no cookie, and a signed-out session gets `401` with its cookie effects. For a signed-in session, the organization page and the organization selection below need only the identity. Each other path needs the current access: the routes resolve it and require a trusted tenant. Only then do they give the request and a frozen copy of its trusted `RequestContext` to an account operation. A denial gets `403`, with a link to the organization page: "To select another organization, or to see how to get access, open the organization page." A request with no operation gets `404`. No production account operation exists yet.

Organization onboarding and selection (AUTH-07) use [`OrganizationAdministration`](src/organizations/organization-administration.ts). It reads the current memberships of the session user for each request and authorizes only the active memberships whose grants give at least one application permission. A default role gives none, so its organization is not listed. There is no default organization. The organization page accepts only `GET` and `HEAD`, and the selection accepts only `POST`; other methods get `405`.

- `GET <base>/organizations` lists the authorized organizations. Each one has a form with a button that shows its name, with "(selected)" for the organization that the session selected. The form posts the organization ID, the form token, and the return destination. The optional `return_to` query gives the return destination, with the rules of the selection below; the default is `<base>/organizations`, and an invalid value gets `400`. Without an authorized organization, the page tells the user that the account has no active access to an organization: accept the invitation in the email, or, with no invitation, contact the operator of the service, because only the operator can set up a new organization. This page has no form.
- `POST <base>/organizations/select` changes the organization of this browser session only. An MCP token and the other browser sessions of the user keep their organization. A post from another origin, or without an `Origin` header, gets `403` before its body is read. A content type other than `application/x-www-form-urlencoded` gets `415`, a body larger than 16 KiB gets `413`, and a missing or wrong form token gets `403`. The form must have exactly one `organization_id`, with 1 to 256 visible ASCII characters, exactly one `return_to`, and no other field. The return destination must be a path under the public path, with at most 1,024 characters and no query, fragment, backslash, space, control character, dot segment, or second slash at the start. Else the post gets `400`. Then a current read must authorize the organization for the session user, else the post gets `403` and no switch. After the switch, the browser gets `303` to the destination, where the operation checks its own permission. If the provider refuses the switch, the browser gets `403`; if the session ended, `401`.
- Each answer after a sign-in carries the cookie effects of the session before the cookies of the answer itself. This includes an operation answer, a redirect, a refusal page, and a failure page. A failure after a sign-in, such as a provider outage or an operation answer that cannot carry the cookie effects, gives a `500` page, "The request failed. Try again later.", and one `ERROR` line in the operator log. A failed session lookup gives the generic `500` of the HTTP server without a cookie. Thus an outage never looks like a signed-out session and never ends a session.
- No route creates, resumes, renames, or changes the settings of an organization. The operator sets up each organization outside this service. The self-hosted edition has no organization route.

The placeholder module, [`src/auth-unavailable/unavailable-hosted-authentication.ts`](src/auth-unavailable/unavailable-hosted-authentication.ts), gives the session, access, and organization parts and the MCP endpoint. `UnavailableHostedAuthentication` says that each browser session is unavailable, denies each access request, and gives no membership for any user. `UnavailableMcpEndpoint` gives the MCP answer above. Thus the organization routes are also unavailable in production.

Deferred work:

- AUTH-06 replaces the placeholder with the WorkOS provider. That provider implements `BrowserSession` and `AccessResolver`, and `IdentityVerifier` for an `MCPServer` that becomes the MCP endpoint. Its `WorkOSBrowserSession` gives the cookie effects and the form token, does `selectOrganization()` as a session refresh with the organization, and adds sign-in, callback, and logout. Its form token must stay the same for the whole session, so it cannot come from the access token or the sealed cookie value. The provider reads and checks its own settings. It must pass the [hosted live gate](docs/implementation/test-gate-policy.md#hosted-live-gate-auth-06) before hosted access is enabled.
- AUTH-07W, which is deferred with WorkOS, implements `WorkOSOrganizations`, the `OrganizationDirectory` reads from WorkOS, and the runbook for operator setup and recovery. It must map each provider role to application permissions; a permission that only the provider knows is not an application permission.
- AUTH-08 adds grant management, invitations, and the seat summary as account operations. Its tests use doubles of these roles. A double never becomes a production sign-in.
- Organization rename and other organization settings wait until the product owner decides their authority.
- AUTH-11 adds paid billing.

The acceptance tests of the [placeholder](test/acceptance/auth/hosted-placeholder.test.ts), of [organization onboarding and selection](test/acceptance/auth/hosted-organizations.test.ts), and of the [organization requests](test/acceptance/auth/hosted-organization-requests.test.ts), the integration tests of the [account routes](test/integration/auth/hosted-account.test.ts) and of the [organization routes](test/integration/auth/hosted-organizations.test.ts) with session and membership doubles, and the unit tests of the [account routes](test/unit/hosted-admin/account-routes.test.ts), their [failure answers and cookie effects](test/unit/hosted-admin/account-routes-effects.test.ts), the [organization page](test/unit/hosted-admin/account-routes-organization-page.test.ts), the [selection input checks](test/unit/hosted-admin/account-routes-selection-input.test.ts), the [organization selection](test/unit/hosted-admin/account-routes-selection.test.ts), [`OrganizationAdministration`](test/unit/organizations/organization-administration.test.ts), and the [placeholder](test/unit/auth-unavailable/unavailable-hosted-authentication.test.ts) run offline. They prove application policy with doubles. A pass of these tests is no proof of WorkOS behavior and no hosted live gate pass.

## Billing

The owner has not chosen a payment provider. Billing is a separate object: hosted code uses the [`Billing`](src/billing/billing.ts) interface, and only a `Billing` implementation calls a payment provider. [`BillingFree`](src/billing/billing-free.ts) is the only implementation. It bills no organization and collects no payment, so billing never changes access.

- `stateOf(organizationId)` gives the confirmed `BillingState`: `organizationId`, `plan`, and `billedSeats`. `BillingFree` gives `plan: 'free'` and `billedSeats: 0` for each organization.
- `updateSeats(organizationId, seatCount)` gets the complete current count of active User seats, never a change to add or subtract. The same count again has no further effect. `BillingFree` accepts each whole count from 0 to `Number.MAX_SAFE_INTEGER` and gives the same free state.
- An empty or missing organization ID gives a `TypeError`. Any other seat count gives a `RangeError`. Each operation refuses input with a rejected promise. A rejected call confirms nothing.
- Each state is a frozen record. `Billing` does not check roles; the caller checks Super Admin authority before a customer billing change.

Only the hosted edition has billing, and no production code calls `Billing` yet: the [hosted placeholder](#hosted-edition) answers each billing request with the authentication-unavailable notice. AUTH-11 adds the provider implementation after the owner's decisions. The [paid billing design](docs/design/billing-design.md) records the decision, the rules, the open paid decisions, and the AUTH-11 specification. The [unit tests](test/unit/billing/billing-free.test.ts) and the [acceptance tests](test/acceptance/billing/free-billing.test.ts) check `BillingFree`.

## Contributing and design

Use the [documentation index](docs/README.md) to find current reference guides, pending designs, tests, and completed plans.

Read the [coding principles](docs/coding-principles.md) for general design guidance and [AGENTS.md](AGENTS.md) for repository work rules. The [completed OO refactoring record](docs/archive/oo-refactoring-plan.md) preserves the implementation scope and verification evidence.

## Requirements

Node 24 ESM package. Application and suite TypeScript compiles with `tsc`, and Node runs the output in `dist/`. Build acceptance tests run directly from TypeScript source on Node 24. `tsx` is only for local development.

- Node 24 (`nvm use` reads `.nvmrc`)
- pnpm 12.10.1
- A POSIX shell for build commands (macOS or Linux)
- Lightpanda 1.0.0 for rendering and live renderer tests; follow [runtime setup](docs/lightpanda-runtime.md). `pnpm install` does not install it. The unit suite needs no renderer.
- Docker Engine with Buildx and Compose for the [container installation](#container-installation) and `pnpm test:container`. No other suite needs Docker.

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
pnpm test:container   # clean build, then the container gate: the image and its containers without outbound access
pnpm typecheck   # tsc --noEmit
```

`pnpm start` runs `dist/src/index.js` because `src/` and `test/` share one compilation root. A test import such as `../../src/application.ts` still resolves after emit.

## Layout

```
src/         TypeScript source
test/        node:test files
migrations/  Shipped SQL migrations, such as auth-local/ for the self-hosted edition
docs/        Documentation, design plans, and archived records
dist/        tsc output (gitignored)
Dockerfile, compose.yaml, .dockerignore
             The self-hosted evaluation image, its Compose service, and its build context
```

## TypeScript

`tsconfig.json` is ESM with `module` and `moduleResolution` set to `NodeNext`, in strict mode, targeting ES2024. It adds the `ESNext.Disposable` library for `AsyncDisposableStack`, which Node 24 supplies. Relative imports use the `.ts` extension, and `rewriteRelativeImportExtensions` makes `tsc` emit `.js`:

```ts
import { createApplication } from './application.ts';
```

`package.json` maps `#auth-local-migrations/*` to `migrations/auth-local/*`, so code in `src/` and in `dist/src/` reads the same SQL files.

## Build and test commands

`pnpm build` runs the cleanup and compiler commands from `package.json`. It clears the project-owned `dist` directory before it compiles current source. It rejects a symlink or regular file at that path. npm and pnpm run package scripts from the project root, so the caller’s working directory does not change the cleanup target. Files outside `dist` stay in place. Do not keep user data in `dist`.

`pnpm test` builds and runs all compiled tests. `pnpm test:unit`, `pnpm test:integration`, `pnpm test:acceptance`, and `pnpm test:interface` build and run only their respective suites. Each command removes output from deleted or renamed source files. Use `pnpm build` before a focused `node --test dist/...` command. `pnpm start` runs `dist/src/index.js` from the last build. `pnpm typecheck` checks source without emitting or clearing output.

The unit, integration, and acceptance suites are offline. Live renderer tests need the pinned Lightpanda executable. The [runtime setup guide](docs/lightpanda-runtime.md#verify-rendering) gives separate commands for local fixture tests and the public-site smoke test. `pnpm test` and `pnpm test:interface` include the public-site smoke test and need public network access.

`pnpm test:build` runs the source TypeScript build acceptance tests with Node 24, temporary projects, and the real compiler. The main TypeScript config checks these tests. `tsconfig.build.json` excludes them from emitted output, so compiled test discovery cannot run them again. `npm run check` includes these tests after type checking and the unit suite.

`npm run check` does not run the integration, acceptance, interface, or container suites. The [test gate policy](docs/implementation/test-gate-policy.md) gives the suite prerequisites, focused commands, and the runs that a pull request needs before Ready.

`pnpm test:container` makes a clean build, builds the image of the current candidate with Docker, and runs `dist/test/acceptance/auth/self-hosted-container.test.js` with `MAGUMAGU_CONTAINER_GATE=1`. The containers run with the production settings of the image and without outbound access. `pnpm test` and `pnpm test:acceptance` select the same file, but they skip its suite. Only `pnpm test:container` is a [container gate](docs/implementation/test-gate-policy.md#container-gate) pass.

The hosted placeholder and organization tests are offline, and the unit, integration, and acceptance suites select them. To run only the hosted integration and acceptance files:

```sh
npm run build && node --test dist/test/integration/auth/hosted-account.test.js dist/test/integration/auth/hosted-organizations.test.js dist/test/acceptance/auth/hosted-placeholder.test.js dist/test/acceptance/auth/hosted-organizations.test.js dist/test/acceptance/auth/hosted-organization-requests.test.js
```

A pass of these files is not a hosted live gate pass and no proof of WorkOS behavior.

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
