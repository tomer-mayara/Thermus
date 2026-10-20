# MCP search tool

`search(query, reason)` searches the first Brave results page and returns
cleaned Markdown. Both authenticated server editions expose it with
`getURLAsMarkdown`, in both supported MCP protocol eras. Use `search` to
find pages and `getURLAsMarkdown` to read a known page URL.

## Discovery and inputs

The `tools/list` description is:

> Search the web with a text query and return cleaned results as Markdown.
> Use this tool for web searches; search engines may block generic page-fetch
> requests. Use getURLAsMarkdown to read a result page. Give the reason the
> agent needs the search.

The description guides the model's choice. It does not guarantee that a
model follows the guidance or that Brave accepts the request.

The input object has exactly two required string fields:

- `query`: 1 to 512 well-formed Unicode scalar values, with at least one
  non-whitespace character. Lone UTF-16 surrogates are refused.
- `reason`: 1 to 2,000 Unicode code points, with at least one non-whitespace
  character. It states why the agent needs the search.

Extra fields are refused. Accepted text is not trimmed, normalized, or
truncated. `SearchQuery` owns semantic query validation. The reason does not
go to the search engine or appear in search completion records.

```json
{
  "name": "search",
  "arguments": {
    "query": "Lightpanda browser documentation",
    "reason": "Find the browser's official documentation"
  }
}
```

## Results and failures

A successful call returns one text content item with the exact Markdown.
It adds no title, footer, JSON wrapper, or structured content. An explicit
no-results page returns exactly `No search results.` after incoming processing
allows it. A missing result structure or a challenge page is a search failure.

| Outcome | Text and completion status |
| --- | --- |
| Cleaned results or explicit no-results | Exact Markdown; `success` |
| Known scan withholding | `Search content withheld`; `withheld` |
| Invalid arguments | `Invalid tool arguments`; `invalid_arguments` |
| Missing product permission inside the operation | `Access denied`; `access_denied` |
| Shared hosted slot occupied | `Server busy. Try again later.`; `busy` |
| Provider, classifier, or outgoing failure | `Search failed`; `search_failed` |
| Incoming or unexpected processing failure | `Search processing failed`; `processing_failed` |
| Observed cancellation | `Request cancelled`; `cancelled` |

Every failure result has `isError: true` and one text item. A disconnected
client can receive no result. Typed renderer failures can add a fixed safe
diagnosis to `Search failed`, such as `Search failed: HTTP 429`. They use the
same bounded diagnostic vocabulary as the
[fetch tool](mcp-fetch-tool.md#public-fetch-failures). Provider text, raw
exceptions, page content, and renderer output never become error details.
Search withholding is an error; the fetch tool retains its existing empty
success for known withholding.

Authentication, access resolution, Origin checks, the SDK envelope, and the
SDK's 4 MiB body limit apply before dispatch. Their existing HTTP and protocol
refusals remain unchanged. The protected pipeline also checks product access,
the query, and the operation UUID before stages or provider work.

## Execution and logging

`createToolOperations` constructs both protected operations once per
application. `SearchEngineBraveHttp` encodes the query in the fixed HTTPS Brave
search URL and uses the shared Lightpanda fetcher. It validates the final
destination and classifies the full rendered page. The search pipeline runs
outgoing observation, the engine, and incoming processing in that order.

Incoming processing applies the shared ad cleaner and sanitizer, then a
separate Defuddle converter with result preservation enabled. It fetches no
result links. The public Brave website needs no API key. It can refuse or
rate-limit requests; this adapter does not retry around a challenge.

`fetchToolServers(operations, logger)` supplies both operations to each
request server. Hosted fetch and search use one capacity owner for the full
operation through cleanup. Self-hosted concurrency is unchanged. Existing
request lifetime tracking owns search cancellation and shutdown too.

Every dispatched call attempts one `mcp.tool.completed` record, including
invalid arguments. Search records contain only `event`, `operationId`,
`authority`, `subject`, `tenantId`, `tool`, `status`, and `durationMs`.
They omit query, reason, URL, page, provider response, and failure data.
The search branch is selected before any fetch argument projection.

Each entered stage attempts one correlated `pipeline.step.completed` record
with `search.outgoing.observe_request` or `search.incoming.process_html`.
Its outcome and optional code are fixed values. No unentered stage gets a
record. Refusals before dispatch get no tool completion or stage record.
Logger or sink failures cannot change the result or repeat the operation.
Fetch completion fields retain their existing contract.

## Verification

[SEARCH-05](../implementation/search-05.md) records public MCP verification.
Ordinary tests use controlled renderer processes with the captured Brave page
and real classification and cleaning.

With `LIGHTPANDA_BIN` set to an absolute path for Lightpanda 1.0.0, run:

```sh
npm run test:mcp:renderer
```

This command runs both fetch and search runtime files. The search file maps
the canonical Brave request to a local renderer fixture through a test-only
transport and returns canonical Brave metadata to the real engine. It checks
rendering, classification, cleaning, and MCP output without public network
access. The hosted offline build also selects both runtime files and ordinary
public search, capacity, and shutdown cases. Production has no endpoint
override or private-network bypass.

The public provider proof has its own command:

```sh
npm run test:mcp:search:live
```

It builds and runs only `search-pipeline.live.js`, using the pinned renderer,
real Brave adapter, classifier, cleaners, and MCP result. It needs public
network access and no Brave API key. It requires useful result titles,
destination links, snippets, and private correlated records. Ordinary,
offline, and container build gates exclude it. A block, rate limit, or
unsupported page fails this proof. A successful local fixture run does not
establish current Brave availability.

The [SEARCH-06 record](../implementation/search-06.md) gives the local runtime
results and the successful live MCP call on 2026-10-20 with Lightpanda 1.0.0.
The saved result is evidence for that call; it does not guarantee later access
or verify a live empty-results response. The
[runtime guide](../lightpanda-runtime.md#verify-rendering) and
[test gate policy](../implementation/test-gate-policy.md#live-brave-search-proof-search-06)
give setup and evidence rules.
