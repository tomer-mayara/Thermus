# Notes


# Tests

## Unit

**Renderer network policy**

[V] Rejects blocked IPv4 and IPv6 ranges, obfuscated loopback addresses, mixed DNS answers, and failed DNS before renderer launch
[V] Accepts public addresses and checks every DNS answer again on each fetch
[V] Passes the native network policy and disables proxy environment settings on every renderer launch
[V] Rejects URL-supplied flags and unsupported schemes; fails when Lightpanda is missing or cannot apply the required policy

**Clean HTML Ads**

[V] Removes documented ad targets, honors element-hiding exceptions, and leaves HTML unchanged when no host matches
[V] Counts unsupported procedural actions as skipped
[V] Returns an updated context, preserves metadata, adds to existing counts, and does not mutate the input
[V] Preserves the next paragraph and its source text when an ad paragraph omits its end tag
[V] Preserves the next list item and its attributes when an ad item omits its end tag
[V] Preserves following elements after omitted paragraph end tags inside list items and before dialog, search, menu, and hgroup
[V] Preserves a table after an ad paragraph with an omitted end tag in a fragment without an explicit html element or doctype
[V] Preserves non-ad tables between reconstructed formatting matches and counts overlapping selectors per DOM node
[V] Removes an explicit ad body that reaches end of source, with and without a doctype
[V] Preserves Unicode, comments, attributes, and source formatting
[V] Preserves nested list boundaries and parent end tags around explicit, nested, adjacent, and overlapping ad matches
[V] Preserves text and repeated body and html end tags during parser recovery
[V] Keeps parent reads bounded for deeply nested malformed HTML at end of file
[V] Counts each ad element once and keeps selector exceptions

**Prompt Injection Remover**

[V] Removes zero-width format characters and counts detections as skipped
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
[V] Treats sparse full documents and HTML fragments as HTML at every line and tag density
[V] Removes hidden spans from sparse HTML, including spans inside fenced-looking text
[V] Keeps visible Markdown punctuation, text inside `pre` and `code`, and encoded tag examples

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
[V] Keeps line breaks and fenced Markdown for styled `<code>` and bare `<pre>` blocks
[V] Keeps relative indentation in preformatted fragments, including nested indentation, tabs, and leading whitespace
[V] Keeps removed ad targets out of the Markdown
[V] Returns Markdown instead of raw HTML
[V] Returns empty output for a document with an empty body and no embedded page content
[V] Returns empty Markdown for empty, whitespace-only, and fully sanitized input with no embedded page content
[V] Sets a null title and preserves findings when cleaning leaves empty HTML or only HTML whitespace
[V] Preserves URL, HTML, and existing counts in a new context without mutating the input
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

## Interface

**Renderer network policy**

[V] Blocks literal and DNS loopback targets before a connection
[V] Blocks a DNS change, IPv6 loopback, a redirect, a script resource, fetch, XHR, and WebSocket to a blocked address
[V] Allows an IPv4 loopback fixture only inside the test scope and ignores proxy environment settings

**HTML Fetcher**

[V] Fetches a page without JavaScript (https://quotes.toscrape.com) and returns rendered HTML
[V] Fetches a page with JavaScript (https://quotes.toscrape.com/js/) and returns rendered HTML
[V] Returns a direct fetch result through Lightpanda
[V] Traces a redirect chain through Lightpanda and resolves Markdown links against the final URL

**LinkeDOM Serialization**

[V] ESM and CommonJS preserve escaped numeric entities, ordinary entities, quotes, and query ampersands after attribute serialization and reparsing

**Sanitizer Deletion Positions**

[V] Reports exact UTF-16 deletion ranges for ANSI passes, Unicode controls, contextual joiners, emoji tags, and BOM handling
[V] Keeps sanitizer output and findings the same when deletion reporting is enabled

**Defuddle Extracted DOM**

[V] Passes decoded selector-based Substack and generated Discourse content to the callback before URL conversion

## Acceptance
