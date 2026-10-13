# Notes

- Give reason and compare actual behaviour 
- Block/step up large files (or requests)
- Step
- Looks into AI caching support

# Tests

## Unit

**MCP Server**

[V] Connects to the MCP server and runs server/discover; advertises protocol 2026-07-28 and the magumagu identity (`test/unit/mcp/discovery.test.ts`)
[] Every tool call is logged (with the user name)
[] Lists one tool, fetchURLAsMarkdown(url), with its URL input schema
[] Calls the fetcher with the requested URL, passes fetched HTML and the final URL to the pipeline, and returns the pipeline's Markdown
[] Rejects an unknown tool or missing, malformed, or unsupported URL input without calling the fetcher or pipeline
[] Returns a tool error when the fetcher fails, skips the pipeline, and returns no partial Markdown
[] Returns a tool error when the pipeline fails and returns no partial Markdown
[] Closes the transport and cancels pending requests when the server closes; repeated close calls succeed
[] Keeps request state separate between connections

Planned tool tests use test doubles at the fetcher and pipeline public interfaces. They do not run the renderer or the real pipeline.

**MCP Authentication**

HTTP request unit tests use `IdentityVerifierMock` and `AccessResolverMock` from `test/unit/mcp/fixtures/`. The verifier mock supplies configured claims or errors and rejects unknown tokens. Its claims can be incomplete, so that tests reach the boundary checks. The resolver mock gives a configured decision, failure, or delayed decision for each user subject, records its calls, and denies an unknown user. `FailureReporterMock` records each failure report that MCPServer gives to the operator callback. Test-only factory tools report the context that MCPServer binds to each request; production code registers no such tool. MCPServer adapts the verifier to the SDK's OAuthTokenVerifier. Unit tests use the real SDK middleware and import the access contracts as types only.

[V] Maps IdentityVerifier claims to SDK auth information, supplies the original token, and keeps changes to SDK scopes separate from verifier claims (`test/unit/mcp/identity-verifier-sdk-adapter.test.ts`)
[V] Puts frozen copies of the actual user, issuer, client, scope, issue time, expiration, and audience claims in `AuthInfo.extra` (`test/unit/mcp/identity-verifier-sdk-adapter.test.ts`)
[V] Rejects an identity without a user, issuer, client ID, issue time, expiration, or audience, or with the client ID as the user subject, as `invalid_token` (`test/unit/mcp/identity-verifier-sdk-adapter.test.ts`)
[V] Reports a provider rejection only as `invalid_token` and passes an unexpected provider failure on as a failure (`test/unit/mcp/identity-verifier-sdk-adapter.test.ts`)
[V] Gives the cause of an unexpected provider failure one time to the adapter's failure callback; an accepted token, a provider rejection, and an identity without a usable user give nothing (`test/unit/mcp/identity-verifier-sdk-adapter.test.ts`)
[V] IdentityVerifierMock rejects unknown tokens and keeps verification call records separate between instances (`test/unit/mcp/identity-verifier-sdk-adapter.test.ts`)
[V] Requires a Bearer token for server/discover, tools/list, and tools/call; missing tokens return HTTP 401 with a Bearer challenge and the protected-resource metadata URL (`test/unit/mcp/auth.test.ts`)
[V] Rejects a missing Authorization header with HTTP 401 before token verification or MCP dispatch (`test/unit/mcp/auth.test.ts`)
[V] Rejects a malformed Authorization header with HTTP 401 before token verification or MCP dispatch (`test/unit/mcp/auth.test.ts`)
[V] Returns HTTP 401 with invalid_token when the verifier rejects a token, including a malformed token or an untrusted issuer, before access resolution (`test/unit/mcp/auth.test.ts`, `test/unit/mcp/auth-claims.test.ts`)
[V] Returns HTTP 401 with invalid_token for an expired token or a token with no expiration or issue time (`test/unit/mcp/auth-claims.test.ts`)
[V] Returns HTTP 401 with invalid_token when the verified token audience is missing or does not match the MCP resource (`test/unit/mcp/auth-claims.test.ts`)
[V] Returns HTTP 403 with insufficient_scope and the required scope in the Bearer challenge when a verified token lacks permission (`test/unit/mcp/auth-claims.test.ts`)
[V] Allows a token for the MCP resource with a future expiration and all required scopes to reach the requested MCP operation (`test/unit/mcp/auth.test.ts`, `test/unit/mcp/access-resolver.test.ts`)
[] Serves protected-resource metadata without a token; identifies the MCP resource, trusted authorization server, and supported scopes, without allowing anonymous tool access
[V] Verifies each token once, gives only the verified user to the access resolver, and binds the decided context with the verified claims to the request (`test/unit/mcp/access-resolver.test.ts`)
[V] Supplies the verified user and tenant context to the tool handler; request headers and tool arguments cannot replace that context, and the OAuth client ID is never a user or tenant (`test/unit/mcp/request-context-binding.test.ts`)
[V] Rejects token details that cannot establish the required user or tenant context: an identity without a usable user, or an allowed decision without a tenant ID (`test/unit/mcp/identity-verifier-sdk-adapter.test.ts`, `test/unit/mcp/access-resolver.test.ts`)
[V] Keeps user and tenant context separate for sequential and concurrent requests, including resolutions that finish in reverse order, a slow request body, and overlapping tool handlers (`test/unit/mcp/request-context-binding.test.ts`)
[V] Binds a frozen copy of the decided context; later changes to the resolver's records cannot reach the request (`test/unit/mcp/request-context-binding.test.ts`)
[V] Checks every request again; a valid request does not authorize a later request with a missing or rejected token (`test/unit/mcp/access-resolver.test.ts`)
[V] Returns a safe HTTP 403 access_denied without a Bearer challenge for each denial reason and MCP method, distinct from the SDK insufficient_scope response, before the request factory or MCP dispatch (`test/unit/mcp/access-resolver.test.ts`)
[V] Returns a generic HTTP 500 for an access resolver failure or an allowed decision without a tenant ID, with no private details, request factory, or MCP dispatch (`test/unit/mcp/access-resolver.test.ts`)
[V] Stops before MCP dispatch, the fetcher, and the pipeline after any authentication or scope failure (`test/unit/mcp/auth.test.ts`, `test/unit/mcp/auth-claims.test.ts`, `test/integration/auth/mcp-context.test.ts`)
[V] Returns a server error if token verification fails unexpectedly; performs no MCP dispatch or access resolution and exposes no token or internal error details (`test/unit/mcp/auth.test.ts`)
[V] Gives one `token-verification` report that keeps the cause to the operator callback when token verification fails unexpectedly; the client still gets the generic 500 (`test/unit/mcp/auth.test.ts`)
[V] Gives one `access-resolution` report that keeps the cause to the operator callback for an access resolver failure or an allowed decision without a tenant ID; the client still gets the generic 500 (`test/unit/mcp/access-resolver.test.ts`)
[V] Puts no bearer token, cookie, password, or proxy credential from the request in a failure report (`test/unit/mcp/auth.test.ts`, `test/unit/mcp/access-resolver.test.ts`)
[V] Reports no failure for a missing or malformed Authorization header, a rejected token, rejected claims, a missing scope, or an access denial (`test/unit/mcp/auth.test.ts`, `test/unit/mcp/auth-claims.test.ts`, `test/unit/mcp/access-resolver.test.ts`)

Real issuer, signature, and key rotation checks belong in authentication interface tests. Browser OAuth flows and provider compatibility need separate integration and acceptance tests. A fake verifier does not prove those behaviors.

**Access context** (`test/unit/auth/access-context.test.ts`)

[V] Combines the explicit permissions of every independent grant; no highest-role check replaces the complete grant set
[V] Gives a Super Admin grant alone no product access; no role inherits the permissions of another role
[V] Keeps every grant and the same permission set for any grant order, and lists a shared permission once
[V] Denies every permission check when the context has no grants
[V] Stops work with a safe `AccessDeniedError` (`Access denied`, reason `permission-required`); repeated checks change nothing
[V] Copies only the contract fields, freezes the context and its collections, and ignores later changes to the input records
[V] Omits the organization for an installation user and refuses a context without a tenant ID

**Deployment configuration** (`test/unit/config/deployment-config.test.ts`)

[V] Returns the self-hosted and hosted records with the exact MCP resource and metadata URLs for root and sub-path base URLs
[V] Accepts only `self-hosted` or `hosted` in `DEPLOYMENT`; no other setting selects or changes the edition, and `AUTH_MODE`, mock, and paid-feature settings have no effect
[V] Reads only the settings of the selected edition from the supplied record and ignores `process.env`
[V] Rejects a missing, relative, padded, non-HTTPS, credential, query, or fragment URL; allows HTTP only for a self-hosted loopback host
[V] Rejects a missing or relative `DATA_DIR`, a missing hosted setting, a redirect URI on another origin, and a cookie password shorter than 32 characters
[V] Rejects hosted stdio and accepts self-hosted stdio at this layer
[V] Names the setting and the rule in each error, without a setting value; keeps the issuer exactly as written; returns frozen records
[V] Uses listen host `127.0.0.1` and port 8080 when `LISTEN_HOST` and `LISTEN_PORT` are missing or empty; returns a frozen address for valid hosts and ports from 0 to 65535
[V] Rejects a `LISTEN_PORT` that is not a whole number from 0 to 65535 and a `LISTEN_HOST` with spaces or control characters, without the value in the message; reads only `LISTEN_HOST` and `LISTEN_PORT`

**Local authentication migrations** (`test/unit/auth-better-auth/local-auth-migrations.test.ts`)

These tests run the pinned Better Auth packages with an in-memory `node:sqlite` database and the production provider settings.

[V] The shipped `0001-better-auth.sql` is the exact `compileMigrations()` output for the pinned provider settings on an empty database
[V] After the shipped migrations, Better Auth plans no table, column, or index change, and its schema check passes
[V] The installation table holds one identity: a second row or another singleton value fails; three accounts can still be added

**HTTP bridge** (`test/unit/http/server-requests.test.ts`, `server-responses.test.ts`, `server-lifecycle.test.ts`)

These tests run `startHttpServer()` on a loopback port with test handlers. Raw socket requests check request targets that `fetch` would change.

[V] Listens on the configured host and a free port and reports the real address, with an IPv6 host in brackets; rejects a port in use and keeps no server; stops listening when the address cannot become a URL
[V] Gives the handler the public origin with the path and query of the target; the `Host` and forwarded headers cannot change it
[V] Refuses the absolute form, `*`, `//`, `\`, and `#` targets with 400 and `TRACE` with 501, without a handler call
[V] Replaces every client copy of `x-magumagu-client-address` with the socket address and keeps all other headers
[V] Streams a large JSON request body to the handler; a request body that the handler does not read does not block the next request on the connection
[V] Returns the status, status text, headers, separate `Set-Cookie` headers, and body; streams events as they arrive, follows client back-pressure, and sends no body for `HEAD`
[V] Answers a handler that throws or rejects with a generic 500 and a log line without request data; ends the connection when a streamed body fails
[V] Aborts the request signal and cancels the response body when the client disconnects
[V] `close()` ends idle connections at once, refuses new connections, lets running responses finish, ends a response that never ends after the grace period, and gives the same result for repeated calls

**Better Auth runtime lifecycle** (`test/unit/auth-better-auth/better-auth-runtime.test.ts`)

Doubles stand in for the data-directory lock, the local installation, and the provider at their public interfaces.

[V] Locks the data directory, opens the installation, starts the provider with the installation ID, secret, and database, and reports tenant `local:<installation-id>`
[V] A lock failure opens nothing; an installation failure releases the lock; a provider failure closes the installation and then releases the lock; each original error reaches the caller
[V] When a cleanup step also fails, the remaining cleanup still runs and the caller gets both errors in a `SuppressedError`
[V] `close()` closes the installation and then releases the lock one time, also for repeated and concurrent calls; a close failure still releases the lock and reaches the caller

**Data-directory lock** (`test/unit/auth-better-auth/data-directory-lock.test.ts`)

[V] A second lock from the same process or from another process fails with `DataDirectoryInUseError` until the holder releases it or ends, also after `SIGKILL`
[V] A second release does nothing; the lock leaves only `data-directory.lock` in the directory
[V] A missing directory or a regular file in its place fails with `DataDirectoryUnavailableError` and creates nothing

**Local installation** (`test/unit/auth-better-auth/local-installation.test.ts`)

[V] A fresh data directory gets one installation UUID, a generated secret, and the migrated database; `auth.sqlite` and `auth.secret` have mode `0600`
[V] A second open keeps the identity and secret; two fresh directories get different identities and secrets; a second close does nothing
[V] Retained data with a deleted, dropped, or invalid installation identity, or with provider tables only, fails closed with a restore message and changes no data
[V] Retained data without `auth.secret`, with an invalid secret, or with another schema version fails closed, writes no new secret, and puts no secret in the message
[V] A secret and an empty database from an interrupted first start give a new installation identity with that secret

**Application failure reports** (`test/unit/application.test.ts`)

A logger double records the lines that `operatorFailureReporter()` writes.

[V] Gives each MCPServer failure report to the operator as one error line that names the failed step and keeps the cause, also for a cause that is not an error; writes no info line

**Billing** (`test/unit/billing/billing-free.test.ts`)

`BillingFree` is the only `Billing` implementation until the owner chooses a payment provider. No paid billing test exists yet; the [AUTH-11 specification](../design/billing-design.md#auth-11-implementation-specification) lists the planned tests.

[V] Rejects an empty or missing organization ID with a `TypeError` from `stateOf` and `updateSeats`
[V] Rejects a seat count that is negative, fractional, NaN, infinite, or above `Number.MAX_SAFE_INTEGER` with a `RangeError`
[V] Refuses input with a rejected promise, never a synchronous throw; a refused call confirms no state
[V] Accepts 0 seats and `Number.MAX_SAFE_INTEGER` seats and confirms the free plan with no billed seat
[V] Gives frozen state records that keep the free state

**Audit Trail**

[] Support OTLP protocol
[] Generate a user token we can use in audit trail

**Console logger** (`test/unit/logging/console-logger.test.ts`)

[V] Writes one line to stderr by default or to a supplied writable stream
[V] Includes the timestamp, level label, level color, message, and final newline
[V] Includes the caller file and line, including filenames with parentheses and files beside the logging directory
[V] Starts at INFO by default and applies each constructor threshold from DEBUG through NONE
[V] Applies threshold changes, hides all levels at NONE, and resumes when the threshold is lowered

**Renderer network policy**

[V] Rejects blocked IPv4 and IPv6 ranges, obfuscated loopback addresses, mixed DNS answers, and failed DNS before renderer launch
[V] Accepts public addresses and checks every DNS answer again on each fetch
[V] Passes the native network policy and disables proxy environment settings on every renderer launch
[V] Rejects URL-supplied flags and unsupported schemes; fails when Lightpanda is missing or cannot apply the required policy

**Clean HTML Ads**

[V] Removes documented ad targets, honors element-hiding exceptions, and leaves HTML unchanged when no host matches
[V] Counts unsupported procedural actions as skipped
[V] Counts unsupported selector and procedural work again on a repeated ad invocation
[V] Returns an updated context, preserves metadata, adds to existing counts, and does not mutate the input
[V] Keeps nested selector matches within the 256 element depth limit
[V] Rejects 5,000 nested elements before it gets selectors for the page URL, for matching and non-matching hosts
[V] Rejects 5,000 unclosed nested template elements followed by text for matching and non-matching hosts without a parser stack overflow
[V] Completes EOF recovery for an unclosed HTML template inside an SVG title and preserves the source content
[V] Removes an unclosed matching ancestor and its template content at EOF, while preserving preceding content
[V] Removes the matched explicit body after foreign-content and template EOF recovery
[V] Checks depth when generic hiding is disabled
[V] Collects nested class and ID tokens for generic selectors
[V] Accepts parsed element depth 256 and rejects depth 257 (254 and 255 nested divs in the body)
[V] Allows template content at depth 256 without counting its document fragment and rejects template children at depth 257
[V] Accepts depth 256 and rejects depth 257 for unclosed nested template content at end of file
[V] Counts script, style, span, and template elements toward the limit
[V] Propagates the depth error for deeply nested divs and unclosed nested templates and does not invoke later pipeline steps
[V] Preserves the next paragraph and its source text when an ad paragraph omits its end tag
[V] Preserves the next list item and its attributes when an ad item omits its end tag
[V] Preserves following elements after omitted paragraph end tags inside list items and before dialog, search, menu, and hgroup
[V] Preserves a table after an ad paragraph with an omitted end tag in a fragment without an explicit html element or doctype
[V] Preserves non-ad tables between reconstructed formatting matches and counts overlapping selectors per DOM node
[V] Removes an explicit ad body that reaches end of source, with and without a doctype
[V] Preserves Unicode, comments, attributes, and source formatting
[V] Preserves nested list boundaries and parent end tags around explicit, nested, adjacent, and overlapping ad matches
[V] Preserves text and repeated body and html end tags during parser recovery
[V] Preserves leading text, doctypes, and non-breaking spaces when an implied head closes without a token; preserves source and counts with no match and keeps explicit-body behavior
[V] Keeps leading text and matching element source offsets when an implied head closes without a token
[V] Keeps parent reads bounded for deeply nested malformed HTML at end of file
[V] Counts each ad element once and keeps selector exceptions
[V] Keeps source scans, requested slice units, and slice calls within fixed linear budgets for 32, 128, and 512 short-line, minified, and long-whitespace-gap ad matches; preserves exact output and counts
[V] Preserves CRLF whitespace, unrelated whitespace-only lines, supplementary Unicode, and counts across nested, adjacent, duplicate, and source-boundary matches
[V] Preserves lone-line behavior for multiline matches, spaces and tabs at EOF, source-start matches followed by a final LF, and non-breaking spaces

**Prompt Injection Remover**

[V] Removes zero-width format characters and reports detection categories without changing skipped
[V] Counts independent hidden targets and comments, excludes covered descendants, and preserves prior counts and metadata without mutating input
[V] Counts parser copies of one authored hidden source once and does not count an empty implied hidden element
[V] Counts hidden text nodes and replaced content independently
[V] Keeps categories and warnings unique across fresh inputs and repeated stages
[V] Removes hidden display-none text and HTML comments while keeping visible content
[V] Cleans the hidden-text fixture without adding removal markers
[V] Preserves authored removal markers in text, code, and attributes
[V] Preserves an authored marker in a link payload without reporting it
[V] Preserves authored markers formed across removed hidden spans or comments
[V] Removes hidden elements and comments in nested template bodies and preserves source offsets
[V] Reports resource tags and hidden, visible, and final exfil-shaped URLs in template bodies once
[V] Removes adjacent and nested hidden ranges without adding markers
[V] Reports final links formed by removal of comments or hidden elements
[V] Retains reports from removed URLs and reports final URLs without duplicate reasons
[V] Normalizes invisible characters before URL checks and counts each category once
[V] Preserves visible content and context without mutating the input
[V] Rejects HTML larger than 10 MiB by UTF-8 byte size
[V] Reports exfil-shaped URLs and keeps them in the HTML
[V] Removes inherited zero-font-size text and keeps descendants with visible font-size or font shorthand overrides
[V] Keeps visible images inside zero-font-size parents and removes hidden images
[V] Uses unitless `font-size` in full quirks mode and rejects nonzero unitless sizes in standards and limited-quirks modes
[V] Resolves font-size declaration order and `!important` rules without changing the font shorthand grammar
[V] Keeps sizes with named deferred `var()`, `env()`, and `attr()` functions unknown, including typed `attr()` raw syntax; invalid raw values and nameless `env()` or `attr()` do not replace an earlier size
[V] Removes whole subtrees for display:none, zero opacity, content-visibility:hidden, zero scale, and collapsed height with hidden overflow
[V] Composes supported matrix, scale, rotation, and resolvable translate functions in CSS order before checking the projected plane
[V] Checks composed pure-translation X/Y offsets, keeps cancelling X/Y and `em` translations and matrix compensation, removes truly offscreen results, keeps a mirrored wide plane visible, and applies the unresolved `translate3d()` offscreen heuristic to X/Y only
[V] Removes collapsed composed transforms and known singular operands, but keeps unresolved lists when they do not prove collapse
[V] Keeps transforms whose combined projection is visible, including rotations in the rendered plane with zero diagonal matrix values
[V] Keeps content visible when matrix lists use invalid comma or plus separators
[V] Keeps content visible for invalid lists with singular operands, malformed matrices, or invalid function arguments
[V] Decodes escaped transform names before visibility checks and recognizes collapsed matrices
[V] Applies transform declaration order and `!important`, and leaves deferred `var()`, `env()`, and `attr()` values unknown
[V] Hides zero numeric or percentage Z scales, keeps small nonzero numeric or percentage Z scales, and checks near-zero X and Y scales
[V] Applies `transform-style` declaration order and `!important`; supported opacity, overflow, filter, clipping, isolation, masking, blend, and paint-containment values flatten `preserve-3d`
[V] Applies `clip` grouping only with a valid winning `position:absolute` or `fixed`
[V] Composes affine parent and child planes in confirmed preserved 3D contexts; a collapsed parent plane alone does not hide the full subtree
[V] Removes hidden direct text and images while checking flat and preserved descendants for restored visible planes
[V] Keeps child planes unknown when transform-style, grouping values, or perspective need unresolved layout or style data
[V] Still removes singular transforms and whole subtrees hidden by display or opacity rules in a preserved 3D context
[V] Keeps a collapsed flat subtree hidden
[V] Treats sparse full documents and HTML fragments as HTML at every line and tag density
[V] Removes hidden spans from sparse HTML, including spans inside fenced-looking text
[V] Keeps visible Markdown punctuation, text inside `pre` and `code`, and encoded tag examples

**Raw inline control context** (`test/unit/html-cleaner-pipeline/prompt-injection-remover/controls/raw-inline-emoji-joiners.test.ts`)

[V] Preserves exact HTML source, authored entities, replacement characters, prior findings, counts, and input immutability for a permitted split joiner
[V] Maps numeric emoji neighbors, literal CRLF, decoded CR references, ANSI deletions, and the original leading BOM
[V] Removes and reports invalid or isolated joiners and bidi controls; does not borrow context from block, break, image, comment, hidden, script, style, or template boundaries
[V] Checks controls in raw attributes, hidden content, and control-split tag and attribute names; checks permits again when cleanup forms hidden markup
[V] Keeps original payload scatter evidence and shared document, proportional, floor, and cluster limits across joiners, variation selectors, tag characters, and blank fillers
[V] Adds no document allowance for synthetic run separators and keeps supplementary control widths in source deletions
[V] Uses raw checks for unmappable decoded source and keeps ANSI-aborted payload controls in the scatter gate
[V] Maps 150,000 candidates in one text node within the test time limit

**Supported CSS Visibility Rules**

[V] Applies inline and eligible local style rules after the default sanitizer pass
[V] Applies importance, inline specificity, selector specificity, and source order
[V] Applies important selector specificity when the less-specific rule comes later
[V] Handles type, universal, ID, class, attribute, and combinator selectors
[V] Matches selectors against the browser-compatible HTML tree, including implied table bodies
[V] Applies inline importance on explicit `html` and `body` elements
[V] Removes content hidden by explicit `html` or `body` selectors and styles
[V] Removes direct text hidden by implied or explicit document elements
[V] Keeps separate visibility for parser-reconstructed formatting elements that share a source tag
[V] Removes attributes when every reconstructed copy of a source tag is hidden
[V] Keeps hidden title and link attributes removed when text ends at the same source offset as a reconstructed tag
[V] Checks CSS-hidden content formed by a previous removal and keeps visible inline overrides
[V] Keeps visible source tags and reconstructed copies when a removal changes a sibling selector match
[V] Keeps an implied table body's visibility when a hidden caption and its first row are removed
[V] Checks new hidden children and ancestors while keeping unchanged visible content
[V] Applies a formed stylesheet to new targets and resets saved visibility for each invocation
[V] Checks hiding attributes that a formed tag adds to an implied or explicit document element
[V] Removes hidden attributes on duplicate document tags, keeps URL findings, and preserves visible duplicate tags
[V] Clears resolved visible styles on duplicate document tags before Markdown conversion
[V] Keeps decoded control findings from cleared style values, including duplicate document tags, without duplicate reports or a second entity decode
[V] Preserves visible text after parser-created formatting copies without source locations
[V] Removes hidden content from parser-created copies without source locations
[V] Preserves unrelated attributes on reconstructed source tags
[V] Decodes escaped attribute selector `i` and `s` flags
[V] Uses ASCII-only case folding for the attribute selector `i` flag
[V] Uses default ASCII-insensitive matching for `rel` and honors its `s` flag
[V] Splits class and `~=` attribute values only at HTML whitespace
[V] Matches escaped nonbreaking spaces in class names and accepts escaped leading digits in ID selectors
[V] Treats an escaped `*` as a type name and does not fetch linked stylesheets
[V] Rejects a selector list with invalid ID or attribute selector forms, while accepting an escaped leading digit
[V] Rejects a whole rule when its selector list has an unsupported selector
[V] Skips pseudo selectors, namespace selectors, invalid selector forms, and inactive media rules
[V] Rejects selector matching when a selector or document exceeds its stated complexity budget
[V] Rejects over-budget documents without returning partial HTML or Markdown
[V] Handles uppercase and escaped units and function names
[V] Keeps visible text for invalid declarations, malformed escaped values, and unresolved variables
[V] Keeps same-color text visible when its background image is unresolved
[V] Keeps same-color text visible when a background shorthand or color is unresolved and still applies independent hiding rules
[V] Normalizes inline styles in nested template content while keeping embedded stylesheet rules outside templates
[V] Preserves visible text, unrelated attributes, and Layer 1 findings
[V] Preserves attributes after a Unicode tag name in the source
[V] Does not fetch linked stylesheets or CSS imports
[V] Limits output growth from a selected shared background image while preserving visible Markdown text
[V] Rejects repeated descendant selectors within a subprocess time limit and keeps ordinary combinators working

**HTML to Markdown Pipeline**

[V] Removes ad targets before Markdown conversion and keeps the removal count
[V] Returns empty Markdown when sanitization removes all content
[V] Propagates a step error without calling the next step
[V] Does not mutate the input context
[V] Preserves sanitizer findings and warnings through Markdown conversion
[V] Rejects oversized HTML before Markdown conversion
[V] Withholds HTML with an unsourced hidden body before Markdown conversion and keeps URL findings
[V] Keeps hidden payload out of the next step for deeply nested HTML, with safe output or complete withholding
[V] Keeps visible descendants, images, and rotated content in the final Markdown and removes hidden text and collapsed content
[V] Checks exact final Markdown for deferred font sizes, composed transforms and offsets, preserved 3D descendants, and quirks-mode font sizes
[V] Omits the fenced offscreen payload from final Markdown and retains the hidden-HTML finding
[V] Removes hidden payload after an ad with an omitted paragraph end tag and keeps following visible text

**HTML to MD**

[V] Converts surviving HTML text to Markdown
[V] Preserves visible plain text and HTML fragments without `html` or `body` tags
[V] Uses supplied empty, plain-text, or fragment HTML at a URL with a site-specific extractor
[V] Keeps fragment metadata and resolves relative links at a URL with a site-specific extractor
[V] Escapes plain-text angle tokens, such as email addresses and generic type names, before HTML parsing
[V] Keeps schema headline metadata for empty and nonempty documents without restoring removed body content from schema `articleBody` or `text`
[V] Keeps body content when the document omits the closing `</head>` tag
[V] Keeps text and element siblings before and after an existing body in source order, with or without document metadata
[V] Keeps line breaks and fenced Markdown for styled `<code>` and bare `<pre>` blocks
[V] Keeps relative indentation in preformatted fragments, including nested indentation, tabs, and leading whitespace
[V] Keeps removed ad targets out of the Markdown
[V] Returns Markdown instead of raw HTML
[V] Returns empty output for a document with an empty body and no embedded page content
[V] Returns empty Markdown for empty, whitespace-only, and fully sanitized input with no embedded page content
[V] Sets a null title and preserves findings when cleaning leaves empty HTML or only HTML whitespace
[V] Removes duplicate inherited findings and warnings for empty and whitespace-only input without mutating the input
[V] Preserves URL, HTML, and existing counts in a new context without mutating the input
[V] Keeps prior counts and unique decoded findings on a repeated converter invocation
[V] Extracts the title from a full document
[V] Makes no network requests for preferred async site extractors when the document has content
[V] Makes no network requests when the API fallback receives an empty document
[V] Extracts embedded Substack `body_html` synchronously and sanitizes generated page content
[V] Preserves local content and resolves relative links with finalUrl
[V] Resolves relative, root-relative, and protocol-relative links after same-host and cross-host redirects
[V] Applies ad rules for the final host after redirects, in both host-change directions
[V] Preserves direct content when requestedUrl and finalUrl match
[V] Removes literal and entity-decoded controls from DOM text, attributes, Markdown, and title; reports the control finding once
[V] Removes controls before Markdown escaping and code-fence selection, including generated Substack code with literal, decimal, and hexadecimal controls
[V] Checks logical text runs across inline spans and preserves contextual Persian ZWNJ and emoji ZWJ across highlighted spans
[V] Ends text runs at block, line-break, and image boundaries; maps deletions to original nodes and preserves inline formatting
[V] Preserves formatting and link boundaries when an encoded ANSI sequence repeats visible text
[V] Removes and reports isolated joiners
[V] Removes all four prohibited controls from links in generated extractor content
[V] Preserves ordinary ampersands, copyright signs, and supplementary characters; preserves valid emoji joiners in the title during the control check
[V] Cleans controls from link and image destinations before URL serialization
[V] Keeps visibly escaped entity examples through LinkeDOM attribute serialization and Defuddle's serialize/reparse step
[V] Does not parse converted output as HTML or decode another entity layer during control checks
[V] Keeps an escaped image example in noscript as text without converting it to an image
[V] Keeps top-level noscript fragment text and escaped image examples in body order and preserves metadata in an explicit or unclosed head
[V] Keeps real image elements in noscript available to Defuddle
[V] Keeps a real fallback image and an escaped image example visible when both appear in noscript
[V] Keeps a picture fallback and escaped example separate, with one real image
[V] Uses a noscript fallback for a lazy image outside a figure and keeps escaped examples visible
[V] Keeps nested escaped noscript code as text
[V] Emits one escaped noscript example after repeated extractor callbacks
[V] Preserves parser behavior for malformed entities and invalid code points
[V] Keeps a less-than sign in a quoted image attribute and omits event handlers from Markdown
[V] Keeps table cells with preformatted code and removes internal code markers
[V] Keeps schema headline text with CSS comments and literal or escaped slashes; omits schema `articleBody` and `text`
[V] Escapes a single equals sign after plain text so it does not become a heading underline
[V] Removes raw controls from plain-text input before Markdown escaping and reports each finding once

**HTML Fetcher**

[V] Returns requestedUrl, finalUrl, and HTML for direct and redirected fetches
[V] Preserves the exact requested URL
[V] Rejects missing or invalid fetch metadata

**Lightpanda Website Fetcher**

[V] Uses a nonempty LIGHTPANDA_BIN value as the exact executable path, including spaces, without a shell or version subprocess
[V] Uses lightpanda from PATH when LIGHTPANDA_BIN is empty or unset
[V] Keeps the missing executable cause, reports the selected path and runtime setup document, and does not fall back to another executable
[V] Passes the supported readiness options and keeps the 60000 ms timeout and 32 MiB output limit
[V] Returns HTML with the requested and final URLs on immediate success
[V] Stops the child at the five-second readiness deadline, waits for its callback, then rejects with `Lightpanda readiness limit exceeded after 5000 ms` and no partial HTML
[V] Preserves a child result or error when the child has already exited at the deadline, and rejects a late success when the child was still running at the deadline
[V] Cancels the readiness timer after success or a process error
[V] Preserves process timeout and output limit errors, and handles missing executable (ENOENT), permission error (EACCES), and synchronous launch failure
[V] Keeps an HTTP failure when the child exits before the readiness deadline
[V] Reports a readiness failure when an HTTP error callback arrives after the deadline
[V] Reports HTTP status failures with WebsiteFetchHttpError and preserves the status and process cause when available
[V] Preserves a failed HTTP status from renderer errors with exit code 1, including bot challenges
[V] Uses --json and --fail-on-http-error while preserving the readiness, timeout, output, and network-blocking options

**Local renderer fixture launcher** (`test/unit/website-fetcher/network-fixture.test.ts`)

[V] Uses the selected executable for default, empty, and configured LIGHTPANDA_BIN values, including a path with spaces
[V] Permits only the trusted localhost fetch scope, keeps the launch options, and disables fixture telemetry
[V] Rejects another executable or a public-site fetch through the fixture launcher

### Planned Cache Key Tests

No cache key helper exists yet. The required unit test inputs and expected results are listed in the [planned cache key design](../design/cache-design.md#required-key-tests). All cases are pending. Do not mark them executed until the helper is implemented and each test passes after a RED → GREEN run.

## Integration

**MCP access context** (`test/integration/auth/mcp-context.test.ts`)

These tests run MCPServer with the real access contracts through a test-only protected tool. The tool checks its permission, then records fetch and clean steps in its trusted tenant. Doubles stand in for the identity verifier, the access resolver, and the operator failure callback.

[V] Keeps four concurrent members in two tenants in their own trusted contexts while their resolutions finish in reverse order and their protected work overlaps
[V] Checks access again for each request: after a User grant is revoked, the next request with the same token gets no protected work
[V] Runs no tool, fetch, or clean step after HTTP 401 for a missing or rejected token, 403 insufficient_scope, 403 access_denied, or a generic 500
[V] Gives the operator one `access-resolution` report with the cause for an access lookup outage, and no report for a missing or rejected token, a missing scope, or an access denial
[V] Refuses protected work when the grants lack the required permission, for example Admin without User

**Local installation** (`test/integration/auth/local-installation.test.ts`)

These tests run the real application, Better Auth runtime, MCPServer, and provider with SQLite files in temporary data directories.

[V] A fresh data directory gives one logged `local:<installation-id>` tenant; the application holds the data-directory lock until it closes; MCP requests without a token or with a forged token get 401 with the Bearer challenge and give no failure report, and other paths get 404
[V] Two applications that start at the same time on a fresh directory: one starts, the other fails with `DataDirectoryInUseError`, and one installation identity exists
[V] A restart keeps the tenant and the IDs of enabled and disabled accounts
[V] With zero accounts or only a disabled account, startup succeeds, the disabled account cannot sign in (`BANNED_USER`), and MCP requests stay denied
[V] A copy of the complete stopped data directory keeps the tenant, the user IDs, and a browser session that its secret signed
[V] A client that an enabled account registers through the provider has the installation ID as `reference_id` and no `user_id`
[V] Retained data without its installation identity, and retained data with a damaged provider schema, stop startup and release the data-directory lock
[V] The hosted deployment stops with `HostedEditionUnavailableError`

Run the integration suite with `npm run test:integration`. `npm run check` does not select it.

## Interface

**Better Auth local provider** (`test/interface/auth/better-auth.test.ts`)

These proofs run the pinned Better Auth 1.7.7 packages with an in-memory `node:sqlite` database. They use the provider's HTTP handler and server APIs. They need no renderer or network access; a blocked `fetch` records no outbound request. The [authentication plan](../design/authentication-design.md#pinned-provider-proof) records the proven contracts.

[V] Rejects public signup over HTTP and from the server API, and rejects email password reset; no account exists
[V] Rejects a duplicate email in another letter case through the private create operation and keeps the original account
[V] Lists each account ID, email, and disabled state without credentials
[V] Resets one user's password and ends that user's sessions; the old password and session fail, the new password signs in the same user, and the peer session stays
[V] Disables one user and ends that user's sessions; sign-in gives `BANNED_USER`, the user ID stays, and the peer can sign in
[V] Registers the approved clients with a server sign-in of an enabled account and then deletes that session; the installation owns the clients, they serve another user, and a disabled account cannot sign in to register
[V] Issues a JWT access token bound to the MCP resource, the user, the client, and the browser session after PKCE authorization with the resource indicator, without a refresh token
[V] Lets the linked resource-server client introspect MCP tokens; refuses a public client and a wrong secret; reports an unknown token inactive
[V] Reports a user's MCP access token inactive after that user's sessions end and keeps the peer's token active
[V] Completes discovery, authorization, and code exchange with the MCP TypeScript SDK 2.3.1 client and a pre-registered public client, without a refresh token; when the token is no longer accepted, the SDK authorizes again, and the live browser session completes that without consent
[V] Refuses dynamic registration, advertises no registration endpoint, and serves the protected-resource and authorization-server metadata
[V] Refuses `offline_access` at authorization and in client registration, refuses the refresh grant in client registration and at the token endpoint, and lists neither in the metadata
[V] Reports a user's MCP token inactive after that user signs out in the browser and keeps the peer's token active
[V] Resets one user's password; that user's old password and MCP token fail, the new password gives a new active token, and the peer's token stays active
[V] Disables one user; sign-in, the exchange of a pending authorization code, a new authorization, a refresh request, and the old MCP token fail, and the peer's token stays active
[V] Rejects a foreign origin, a missing or `null` origin with a cookie, a cross-site sign-in navigation, and a foreign callback URL with HTTP 403
[V] Limits sign-in to three attempts in 10 seconds for each client address with HTTP 429 and `X-Retry-After`; another address can still sign in
[V] Refuses the private admin, client-management, client-secret rotation, and session-JWT routes over HTTP; the resource-server secret still works

Run these proofs offline:

```sh
npm run build && node --test dist/test/interface/auth/better-auth.test.js
```

**Renderer network policy**

[V] Blocks literal and DNS loopback targets before a connection
[V] Blocks a DNS change, IPv6 loopback, a redirect, a script resource, fetch, XHR, and WebSocket to a blocked address
[V] Allows an IPv4 loopback fixture only inside the test scope, preserves production readiness options, and ignores proxy environment settings

**HTML Fetcher**

[V] Fetches a page without JavaScript (https://quotes.toscrape.com) and returns rendered HTML
[V] Fetches a page with JavaScript (https://quotes.toscrape.com/js/) and returns rendered HTML
[V] Returns a direct fetch result through Lightpanda
[V] Traces a redirect chain through Lightpanda and resolves Markdown links against the final URL
[V] Returns local HTTP 200 content and successful redirects; reports local HTTP 403, 404, 429, and 500 responses as HTTP errors
[V] Reports local 403 and 429 bot challenges as HTTP errors, both directly and after two redirects

The unit suite runs without an installed renderer or public network access:

```bash
pnpm test:unit
```

Use the pinned runtime for the local renderer interface tests. [Runtime setup](../lightpanda-runtime.md#verify-rendering) gives the checksum recipe and separate local fixture and public-site smoke commands. The controlled local interface suite passed 27 tests with Lightpanda 1.0.0 on macOS ARM64 for this change. Other platform binaries were not exercised. The public-site smoke tests remain a separate check.

**LinkeDOM Serialization**

[V] ESM and CommonJS preserve escaped numeric entities, ordinary entities, quotes, and query ampersands after attribute serialization and reparsing

**Sanitizer Deletion Positions**

[V] Reports exact UTF-16 deletion ranges for ANSI passes, Unicode controls, contextual joiners, emoji tags, and BOM handling
[V] Keeps sanitizer output and findings the same when deletion reporting is enabled

**Defuddle Extracted DOM**

[V] Passes decoded selector-based Substack and generated Discourse content to the callback before URL conversion

**Defuddle Emoji Joiners** (`test/interface/defuddle-emoji-joiners.test.ts`)

[V] Keeps the exact woman-technologist code points from contiguous literal, decimal, and hexadecimal input
[V] Keeps a literal joiner in a separate span or text node, including a sequence split across three spans

**Website Fetcher Readiness** (`test/interface/website-fetcher-readiness.test.ts`)

[V] Returns the completed asynchronous DOM after its 500 ms request delay, before the full wait budget
[V] Rejects when overlapping requests prevent network idle, kills the child at five seconds, waits for child completion, and returns no partial HTML

## Acceptance

**MCP access context** (`test/acceptance/auth/mcp-access.test.ts`)

A real MCP client calls MCPServer through its HTTP fetch interface. Doubles stand in for the identity verifier and the access resolver.

[V] Given two members of different organizations, each call uses only its verified user and trusted tenant, also with forged tenant headers and arguments; AuthInfo.extra carries the actual verified claims
[V] Given independent Super Admin and User grants, the context holds both grants and every permission that they give
[V] Given Admin and Super Admin without User, the protected tool refuses before any fetch or clean step
[V] Given an inactive membership, the server denies access with HTTP 403 before any request tool exists
[V] Given no token or a rejected token, the client must authenticate; no access resolution or protected work runs
[V] Given an access lookup outage, the client gets a generic server error and no protected work runs

**MCP failure reports** (`test/acceptance/auth/mcp-failure-reports.test.ts`)

A real MCP client calls MCPServer through its HTTP fetch interface with a bearer token and a session cookie. Doubles stand in for the identity verifier, the access resolver, and the operator failure callback.

[V] Given an identity provider outage or an access lookup outage, the client gets a generic server error, and the operator gets one report that names the failed step, keeps the cause, and holds no bearer token or session cookie
[V] Given a rejected token, a token without the required scope, or an inactive membership, the client is refused and the operator gets no failure report

**Free billing** (`test/acceptance/billing/free-billing.test.ts`)

The tests use `BillingFree` through the `Billing` interface. They do not cover paid billing.

[V] Given a new hosted organization, its billing is on the free plan, and no seat is billed
[V] Given active User seats that go from 3 to 5, to 4, and to 0, each update confirms the free plan with no billed seat
[V] Given a repeated count or an older count, the result does not change
[V] Given two organizations, a seat change in one does not change the other

`npm run test:acceptance` runs every acceptance test. `npm run check` does not select the acceptance directory.

**Self-hosted startup** (`test/acceptance/auth/self-hosted-startup.test.ts`)

Each test starts the built server, `dist/src/index.js`, as a separate Node process on a loopback port with a temporary data directory. Account setup uses the Better Auth runtime in the test process while no server runs.

[V] Given a fresh data directory, a start, stop, and second start persist one installation identity, report the same `local:` tenant, and exit with status 0 after `SIGTERM`
[V] Given zero accounts, startup succeeds, MCP requests get a Bearer challenge, and no public route creates an account
[V] Given only a disabled account, startup succeeds, MCP requests stay denied, and the account keeps its ID
[V] Given two servers that start at the same time on a fresh directory, one serves, the other stops with a lock error before it listens, and one installation identity exists
[V] Given retained data without its installation identity, startup stops before it listens, asks for a restore, and creates no new identity
[V] Given a restored copy of the complete data directory, the server starts with the same tenant; a restore without `auth.secret` stops before it listens
[V] Given a command argument, the process stops with status 2 before it listens, does not repeat the arguments, and creates no local data
[V] Given the hosted edition with a `DATA_DIR` setting, startup stops with an unavailable-edition error and creates no local data

Run only these tests:

```sh
npm run build && node --test dist/test/acceptance/auth/self-hosted-startup.test.js
```

**Small-text cutoff** (`test/acceptance/small-text-cutoff.test.ts`)

[V] Given 11px, 12px, and 13px text, keeps only text at or above the default 12px cutoff in final Markdown and reports one removal with `hidden-html`
[V] Uses a custom 8px cutoff; a zero cutoff keeps small visible text while existing zero-font, near-zero-font, and hidden-attribute checks remain active
[V] Keeps larger child text and images under a small parent
[V] Applies inherited, embedded stylesheet, `em`, `%`, `rem`, and absolute point font sizes
[V] Keeps enlarged and reduced text at the effective 12px boundary and removes text just below it
[V] Composes parent and child scales to keep restored child text
[V] Removes proven tiny text and keeps unresolved fonts, font calculations, transforms, and projected planes

Run these acceptance tests separately; `npm run check` does not select the acceptance directory:

```sh
npm run build && node --test dist/test/acceptance/small-text-cutoff.test.js
```

**Literal inline emoji joiners** (`test/acceptance/literal-inline-emoji-joiners.test.ts`)

[V] Given a woman-technologist emoji with the joiner in a separate span, a separate text node, or three spans, keeps exact final Markdown code points
[V] Produces the same Markdown and empty findings for literal, decimal, and hexadecimal joiners

**Emoji joiners** (`test/acceptance/emoji-joiners.test.ts`)

[V] Given a contiguous literal, decimal, or hexadecimal woman-technologist emoji, keeps its exact code points in final pipeline Markdown
[V] Keeps encoded joiners in separate inline spans and text nodes through the pipeline
[V] Removes and reports prohibited bidi controls and joiners in ASCII words for all three encodings

Run these tests separately; `npm run check` does not select the acceptance or interface directories:

```sh
npm run build && node --test dist/test/acceptance/emoji-joiners.test.js dist/test/acceptance/literal-inline-emoji-joiners.test.js dist/test/interface/defuddle-emoji-joiners.test.js
```

**Pipeline counters** (`test/acceptance/pipeline-counters.test.ts`)

[V] Given ads, hidden siblings, a comment, encoded controls, and unsupported ad work, returns separate removal and unsupported-attempt counts with unique detection categories; repeated sanitizer and converter stages preserve the counts and input metadata

Run this acceptance test separately; `npm run check` does not select the acceptance directory:

```sh
npm run build && node --test dist/test/acceptance/pipeline-counters.test.js
```

**Visibility and parsed source ranges**

[V] Keeps visible font overrides and images when an earlier removal forms a zero-font-size parent
[V] Removes hidden local text and keeps visible child planes when an earlier removal forms a preserved 3D parent
[V] Uses parsed parents for font inheritance around tables and in template content
[V] Keeps a visible override under a zero-font-size document body in quirks mode
[V] Keeps visible content outside hidden tables and removes overrides inside display-none ancestors
[V] Keeps visible table cells between hidden merged text segments, including character references
[V] Keeps visible children under mask shorthands and parent perspective
[V] Removes offscreen text and images while it keeps descendants restored by transforms or layout offsets
[V] Resolves mask shorthand order and important mask-image declarations
[V] Keeps valid transform declarations when later raw syntax is invalid, and keeps named deferred values unknown
[V] Applies perspective declaration order and important priority; rejects invalid raw values and negative lengths
[V] Keeps non-replaced inline text when its own transform does not apply, and uses display declaration order and important priority
[V] Removes collapsed inline-block boxes, images, and boxes made block by positioning, float, or flex/grid rules
[V] Keeps transforms with unknown display applicability unresolved, and still removes display-none content
[V] Keeps default inline del and ins text and unclassified element defaults; applies a known display value on a custom element
[V] Keeps font-size overrides and images inside a zero-font-size class, including when an important CSS rule overrides inline display
[V] Applies importance, specificity, and source order across font and font-size declarations
[V] Keeps visible class rotations, preserved child planes, and parent perspective while removing collapsed class subtrees
[V] Keeps exact table source between merged hidden text segments with class font sizes
[V] Applies a formed font-size parent to retained descendants and keeps their visible overrides
[V] Keeps distinct saved declarations for reconstructed formatting copies, including nested copies that share source tags
[V] Rejects empty env() and attr() transform values so they cannot replace a valid hiding transform
[V] Resolves compound mask and mask-border sources, omitted sources, multiple layers, deferred values, and declaration priority
[V] Keeps non-collapsed child planes after compound masks flatten the parent
[V] Keeps flex/grid applicability and preserved transform context through nested display:contents wrappers
[V] Keeps font overrides, perspective uncertainty, and restored translated children through display:contents wrappers
[V] Ignores boxless wrapper offsets and keeps positioned descendants whose layout offsets are unresolved
[V] Keeps projective planes with unresolved Z origins and still removes singular full matrices
[V] Removes local and inherited offscreen input values, keeps visible inputs, and keeps descendants whose transforms return them to view
[V] Keeps a nearly singular matrix with a resolved or unresolved inverse, and keeps a preserved child whose inverse restores the parent plane
[V] Removes a truly singular operand when another transform has unresolved geometry but the complete declaration has a supported valid form
[V] Keeps a flat child restored by an inverse transform, including finite coefficients that exceed the exact decimal proof budget
[V] Removes zero-font text-entry input values from effective author rules, including class rules and explicit font inheritance
[V] Keeps input values with default, visible, or unresolved fonts under zero-font parents, and keeps images and native input controls
[V] Keeps known inherited offsets and planes through unstyled elements with unknown box defaults
[V] Keeps inherited offsets when an unknown box has an explicit none, initial, or unset transform
[V] Removes replaced HTML images with display:contents and keeps visible images with default or unresolved display
[V] Keeps invertible local and accumulated matrices, including Z translations, non-planar matrix3d values, and nested preserved contexts
[V] Removes meter and progress fallback text with display:contents and respects display declaration priority
[V] Rejects malformed deferred function headers, reserved variable names, and empty attribute namespace prefixes
[V] Keeps valid deferred values unknown, including nested and empty fallbacks, escaped names, and typed attributes
[V] Keeps native control text under zero-font parents unless an effective author font rule hides it
[V] Keeps a visible table formatting copy when copies with the same parent and source have conflicting styles
[V] Uses ASCII case matching for input types and treats a Unicode lookalike as an invalid text type
[V] Applies a collapsed transform to the blockified HTML root and keeps its visible identity controls
[V] Keeps a visible button label when display:contents removes its box
[V] Flattens preserved 3D contexts for content-visibility:auto, respects class, reset, and important declarations, and keeps deferred grouping unknown
[V] Applies deferred class font and transform replacements and class unitless font sizes in each parser mode
[V] Applies overflow axis grouping, shorthand resets, and important declarations from class rules
[V] Keeps finite composed transforms when binary rounding makes distinct projected columns equal
[V] Keeps the true root font size when an SVG element is named html, for visible and zero rem sizes
[V] Keeps zero-font input elements with missing or empty values and reports no hidden payload
[V] Keeps visible axes after numeric cancellation in local and preserved matrix compositions, including unknown exact proof
[V] Ignores transforms on inline and run-in flow list items and applies them to atomic inline flow-root list items
[V] Keeps preserved child planes unknown when box applicability is unresolved, including identity transforms and contents wrappers
[V] Keeps descendants that invert near-zero flat scales, including intermediate wrappers and near-edge-on rotations
[V] Accumulates flat parent and child transforms while retaining true edge-on flat collapse
[V] Applies known singular transforms to roots with inherited or deferred display and keeps identity controls
[V] Keeps restored child planes through unresolved contents boundaries and ignores a contents wrapper's own transform
[V] Keeps deferred overflow axes unknown, respects longhand order and importance, and retains confirmed flattening controls
[V] Removes exact zero scales with supported scalar calc wrappers and keeps deferred and compound math unknown
[V] Applies transforms to default native control and fieldset boxes, with explicit display and native font controls
[V] Rejects known invalid math siblings before singularity proof and cascade selection, with source-order and important controls
[V] Keeps projective coefficients unknown when they underflow or round to an affine row
[V] Preserves inherited local state through exact identity lists at unknown box boundaries while keeping child planes unknown
[V] Removes edge-on text and images after in-plane rotations while keeping restored planes and exact nonzero matrix controls
[V] Keeps matrix offsets unresolved when the authored linear part only rounds to a pure translation
[V] Keeps visible text and images after local and inherited offset cancellation or overflow, including embedded CSS and contents wrappers
[V] Requires proven zero ancestor offsets before a relative-unit fallback and retains actual offscreen and restored-child controls
[V] Applies offset error bounds through the independent public hidden-element check

**Build output** (`test/unit/build-output.test.ts`, `pnpm test:build`)

[V] All test commands exclude output from renamed and deleted tests
[V] Unit, integration, acceptance, and interface commands keep their suite selection
[V] Fresh and stale-output fixture tests produce the same current test names, complete emitted file set, and file bytes, including test source maps
[V] Repeated builds remove deleted production modules and source maps
[V] Builds preserve source and files outside the owned output when called from another directory
[V] Builds reject symlink and regular-file output paths without deleting their data
[V] Typecheck does not emit files or clear existing output
