# HTML processing limits

`CleanHtmlAdsAdblockRs` rejects parsed HTML that is deeper than 256 elements. This limit bounds tree walks that ad selectors can trigger.

The module [html-depth-limit-error.ts](../src/html-cleaner-pipeline/ad-cleaner/html-depth-limit-error.ts) exports `HtmlDepthLimitError` and `MAX_HTML_ELEMENT_DEPTH` for callers.

Depth follows the tree that `SourceRangeParser` parses with parse5 and the htmlparser2 tree adapter. The parser can add `html`, `head`, and `body` elements to the tree. These elements count toward the limit.

The document root has depth 0. The `html` element has depth 1. The `body` element has depth 2. A `div` supplied without an `html` element is placed in the body at depth 3. Text and comment nodes do not add depth. Script and style elements count as elements. Void elements and implicit tag closures follow the parser's rules.

Template content uses a document fragment. The fragment does not add depth. Elements inside the fragment count toward the limit.

The collector uses an explicit stack. It checks the full parsed tree before it gets selectors for the page URL or evaluates selectors. This check also applies when no host rule matches and when generic hiding is disabled.

If an element is deeper than 256, the cleaner throws the exported `HtmlDepthLimitError` with this exact message:

```text
HTML input exceeds the 256 element depth limit
```

The cleaner returns no partial result and does not report a successful skip. The pipeline rejects the operation and does not invoke later steps.

A 5,000-level nested input is rejected both when rules match the host and when they do not. In a body, 254 nested `div` elements reach depth 256. They are within the limit. 255 nested `div` elements reach depth 257 and exceed the limit. Nested selectors continue to work when the matching elements are within the limit.

This limit applies only to the ad cleaner. The hidden-text sanitizer keeps its existing 10 MiB UTF-8 byte limit.
