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

**Prompt Injection Remover**

[V] Removes zero-width format characters and counts detections as skipped
[V] Removes hidden display-none text and HTML comments while keeping visible content
[V] Cleans the hidden-text fixture and removes sanitizer placeholder markers
[V] Preserves visible content and context without mutating the input
[V] Rejects HTML larger than 10 MiB by UTF-8 byte size
[V] Reports exfil-shaped URLs and keeps them in the HTML

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

**Renderer network policy**

[V] Blocks literal and DNS loopback targets before a connection
[V] Blocks a DNS change, IPv6 loopback, a redirect, a script resource, fetch, XHR, and WebSocket to a blocked address
[V] Allows an IPv4 loopback fixture only inside the test scope and ignores proxy environment settings

**HTML Fetcher**

[V] Can get a plan URL (https://quotes.toscrape.com) and return a rendered HTML
[V] Can get a JS based page (https://quotes.toscrape.com/js/) and return a rendered HTML

## Acceptance
