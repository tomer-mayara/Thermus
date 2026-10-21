# HTML processing limits

`CleanHtmlAdsAdblockRs` rejects parsed HTML that is deeper than 256 elements. This limit bounds tree walks that ad selectors can trigger.

The module [html-depth-limit-error.ts](../../src/pipelines/html-processing/ad-cleaner/html-depth-limit-error.ts) exports `HtmlDepthLimitError` and `MAX_HTML_ELEMENT_DEPTH` for callers.

Depth follows the tree that `SourceRangeParser` parses with parse5 and the htmlparser2 tree adapter. The parser can add `html`, `head`, and `body` elements to the tree. These elements count toward the limit.

The document root has depth 0. The `html` element has depth 1. The `body` element has depth 2. A `div` supplied without an `html` element is placed in the body at depth 3. Text and comment nodes do not add depth. Script and style elements count as elements. Void elements and implicit tag closures follow the parser's rules.

Template content uses a document fragment. The fragment does not add depth. Elements inside the fragment count toward the limit.

The parser handles EOF recovery in a loop. If parse5 requests another EOF pass, the loop runs that pass after the current pass returns. This prevents deeply nested, unclosed `<template>` elements from adding one call-stack frame per element during parsing. The parser still builds the tree before the collector checks it.

The collector uses an explicit stack. It checks the full parsed tree before it gets selectors for the page URL or evaluates selectors. This check also applies when no host rule matches and when generic hiding is disabled.

If an element is deeper than 256, the cleaner throws the exported `HtmlDepthLimitError` with this exact message:

```text
HTML input exceeds the 256 element depth limit
```

The cleaner returns no partial result and does not report a successful skip. The pipeline rejects the operation and does not invoke later steps.

A 5,000-level nested input is rejected both when rules match the host and when they do not. This also applies to 5,000 unclosed nested `<template>` elements followed by text. Parsing completes without a stack overflow, then the collector rejects the parsed tree with the depth error. In a body, 254 nested `div` elements reach depth 256. They are within the limit. 255 nested `div` elements reach depth 257 and exceed the limit. The same boundary applies to unclosed template content. Nested selectors continue to work when the matching elements are within the limit.

This depth limit applies only to the ad cleaner. `ProcessHtmlStep`, the
cleaner-owned adapter used by the protected fetch operation, checks
the shared 10 MiB UTF-8 byte limit before the pipeline starts, so oversized input
cannot reach ad parsing. The hidden-text sanitizer also checks that shared
limit for callers that invoke it directly. Exactly 10 MiB is allowed; one more
byte is refused. Character count is not byte count.

The pipeline accepts a per-call `AbortSignal`. It checks cancellation before
the first step, between steps, and before it returns. Later steps do not run
after cancellation. Synchronous parsing cannot be preempted. The [MCP fetch
tool](mcp-fetch-tool.md) maps an oversized input or a thrown pipeline failure to
a safe processing error. Oversize input produces a failed incoming record,
with no cleaner or parser work. A completed ordinary empty Markdown result is
allowed. Known typed sanitizer withholding produces a blocked incoming record
and exact empty MCP success.
