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
[V] Cleans the hidden-text fixture and removes sanitizer placeholder markers
[V] Preserves visible content and context without mutating the input
[V] Rejects HTML larger than 10 MiB by UTF-8 byte size
[V] Reports exfil-shaped URLs and keeps them in the HTML
[V] Treats sparse full documents and HTML fragments as HTML at every line and tag density
[V] Removes hidden spans from sparse HTML, including spans inside fenced-looking text
[V] Keeps visible Markdown punctuation, text inside `pre` and `code`, and encoded tag examples

**HTML to Markdown Pipeline**

[V] Removes ad targets before Markdown conversion and keeps the removal count
[V] Propagates a step error without calling the next step
[V] Does not mutate the input context
[V] Preserves sanitizer findings and warnings through Markdown conversion
[V] Rejects oversized HTML before Markdown conversion
[V] Omits the fenced offscreen payload from final Markdown and retains the hidden-HTML finding
[V] Removes hidden payload after an ad with an omitted paragraph end tag and keeps following visible text

**HTML to MD**

[V] Converts surviving HTML text to Markdown
[V] Keeps removed ad targets out of the Markdown
[V] Returns Markdown instead of raw HTML
[V] Returns empty output for a document with an empty body
[V] Preserves URL, HTML, and existing counts in a new context without mutating the input
[V] Extracts the document title
[V] Makes no network requests for preferred async site extractors when the document has content
[V] Makes no network requests when the API fallback receives an empty document
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
