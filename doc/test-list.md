# Notes


# Tests

## Unit


**Clean HTML Ads**

[V] Removes documented ad targets, honors element-hiding exceptions, and leaves HTML unchanged when no host matches
[V] Counts unsupported procedural actions as skipped
[V] Returns an updated context, preserves metadata, adds to existing counts, and does not mutate the input

**Prompt Injection Remover**

[V] Removes zero-width format characters and counts detections as skipped
[V] Removes hidden display-none text and HTML comments while keeping visible content
[V] Cleans the hidden-text fixture and removes sanitizer placeholder markers
[V] Preserves visible content and context without mutating the input
[V] Rejects HTML larger than 10 MiB by UTF-8 byte size
[V] Reports exfil-shaped URLs and keeps them in the HTML

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
[V] Preserves visible text after parser-created formatting copies without source locations
[V] Keeps source tag names and closing tags for hidden copies without source locations
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
[V] Preserves visible text, unrelated attributes, and Layer 1 findings
[V] Preserves attributes after a Unicode tag name in the source
[V] Does not fetch linked stylesheets or CSS imports
[V] Limits output growth from a selected shared background image while preserving visible Markdown text
[V] Rejects repeated descendant selectors within a subprocess time limit and keeps ordinary combinators working

**HTML to Markdown Pipeline**

[V] Removes ad targets before Markdown conversion and keeps the removal count
[V] Propagates a step error without calling the next step
[V] Does not mutate the input context
[V] Preserves sanitizer findings and warnings through Markdown conversion
[V] Rejects oversized HTML before Markdown conversion

**HTML to MD**

[V] Converts surviving HTML text to Markdown
[V] Keeps removed ad targets out of the Markdown
[V] Returns Markdown instead of raw HTML
[V] Returns empty output for a document with an empty body
[V] Preserves URL, HTML, and existing counts in a new context without mutating the input
[V] Extracts the document title
[V] Makes no network requests for preferred async site extractors when the document has content
[V] Makes no network requests when the API fallback receives an empty document
[V] Preserves local content and resolves relative links with the page URL

## Interface

**HTML Fetcher**

[V] Can get a plan URL (https://quotes.toscrape.com) and return a rendered HTML
[V] Can get a JS based page (https://quotes.toscrape.com/js/) and return a rendered HTML

## Acceptance
