# SEARCH-02: Brave HTTP engine and full-page fidelity

Date: 2026-10-20.
Status: implemented; complete-candidate verification in progress.

This record covers [SEARCH-02](search-pipeline-plan.md#search-02-prove-brave-http-classification-and-full-page-fidelity).
The existing [draft pull request](https://github.com/tomer-mayara/Thermus/pull/200)
continues SEARCH-01 and SEARCH-02. Search pipeline orchestration, resource
composition, and MCP registration remain in later tickets.

## Changes

`SearchEngineBraveHttp` implements the public `SearchEngine` contract and
receives a `WebsiteFetcher`. It builds one HTTPS Brave request with one
encoded `q` parameter. It checks the final origin, path, and credentials
before it reads the HTML. It accepts provider query parameters on that URL.
It returns the same full page object with `results` or `no_results`.

The private classification methods apply a 10 MiB UTF-8 bound before parsing
and an iterative element-depth bound of 256 before selector work. They
require one supported search root and results section. Results need complete
web-result structures. The supported English no-results template needs its
wrapper, header, query span, and two tips, with no result markers anywhere
in the search root. Extra content in the results section, fallback wrapper,
or banner subtree is refused; comments and whitespace are allowed.
Error, excessive-query, translated, ambiguous, and
unknown structures fail with `Search failed`. Phrases in a query, snippet,
or script do not establish absence or a challenge.

Cancellation is checked around fetch and classification work. An observed
abort takes precedence over a late renderer result or error. Renderer
errors keep their identity and typed diagnostics. The engine makes no
retry and has no configurable endpoint, API key, or API adapter.

Real cleaning exposed malformed Markdown links from block elements inside
Brave result anchors. Normalizing those labels alone changed article scoring
and lost results. `CleanHtmlToMarkdownDefuddle` therefore has the opt-in
`{ preserveSearchResults: true }`. It retains the full cleaned body through
the existing preservation options and makes block/cite children of anchors
inline, with spaces between words. Sanitization still runs before and after
extraction. The default fetch mode keeps its existing behavior.
`PreparedHtmlDocument` derives fragment status from its owned document;
callers do not pass redundant state.

SEARCH-04 must enable this option on the search converter. The ad cleaner
and prompt-injection sanitizer can be shared with fetch; the converter
instances need different settings.

## Fixture evidence

The [shared fixture notes](../../test/support/fixtures/search-engine/README.md)
record URLs, capture time, runtime digest, HTML digest, and all controlled
changes. The original full results page came from the production fetcher
with verified Lightpanda 1.0.0. It has 18 web results.

Integration tests run that original document through the real Brave engine,
ad cleaner, prompt-injection sanitizer, and Defuddle. They render the output
Markdown and check all 18 primary titles, working destination links, snippet
excerpts, and order. Controlled full-page variants check ad removal,
CSS-hidden content removal, and absent, relative, and invalid base URLs.
They retain the original page object and its full safety context.

The no-results fixture is derived from the captured shell and Brave's
published client template. It is not a live no-results capture. A quoted
rare-term query returned fallback results; a later query received HTTP 429.
No retry or challenge bypass was added. The template tests prove the
supported DOM contract, not that a current live response uses it.
SEARCH-06 must verify that live branch and the complete MCP search flow.
The controlled challenge fixture proves rejection of an unsupported page;
it is not a claim about every challenge Brave can serve.

## Test-first evidence

| Step | Observed result |
| --- | --- |
| Provider tests before the engine file | Failed with `ERR_MODULE_NOT_FOUND`. |
| Initial provider boundary implementation | 13 focused cases passed. Supported page classification was still closed. |
| Full-page integration before classification | Failed with `Search failed`; no fidelity claim was made. |
| Results classification from the capture | 21 provider cases passed. |
| Real-cleaner fidelity before the converter option | All 3 integration cases failed because the first primary title did not render as a link. Raw URL text alone was not accepted. |
| Focused converter specification | 1 new mode case failed with no rendered anchor; the default-fetch characterization passed. |
| Supported no-results template before implementation | 2 of 42 provider cases failed: the derived no-results page was refused and a conflicting results/banner page was accepted. |
| Duplicate-container review before correction | 2 of 50 provider cases failed because duplicate roots or sections were accepted. |
| Unknown-content review before correction | 4 of 55 provider cases failed because unknown results-section content or nesting was accepted as absence. A further banner-content case failed before its correction. |
| Whole-banner review before correction | 5 of 62 cases failed because unknown list text or descendants of the header, query, or tips were accepted. Literal query text and comments remained valid. |
| Final provider tests | All 62 cases passed after the complete template checks. |
| Final converter and integration checks | All 152 cases passed, including existing converter and fetch regressions. |
| Initial changed-test check | All 67 then-current provider, converter, and integration cases passed before the last whole-banner correction. |
| Final changed-test check | All 73 new cases passed from the clean build of the final source: 62 provider, 3 converter, and 8 integration cases. |

The final focused commands were:

```sh
pnpm run build
pnpm exec node --test dist/test/unit/search-engine/search-engine-brave-http.test.js
pnpm exec tsc --noEmit
pnpm exec tsx --test test/unit/search-engine/search-engine-brave-http.test.ts
node --test 'dist/test/unit/html-cleaner-pipeline/html-to-markdown/*.test.js' \
  dist/test/integration/mcp/get-url-as-markdown-pipeline.test.js \
  dist/test/integration/search-pipeline/brave-markdown.test.js \
  dist/test/integration/search-pipeline/brave-renderer-failures.test.js
```

The provider matrix covers query encoding, final destinations, UTF-8 byte
and element-depth boundaries, incomplete results, duplicate containers,
unknown no-results content,
phrase false positives, error and challenge shapes, and abort precedence.
Integration cases preserve canonical HTTP 429, launch, and readiness error
objects. Converter cases also verify inline formatting, word separation,
format-control removal, and unchanged default output.

## Check selection

Production source changes select `npm test`, `npm run typecheck`,
`npm run test:build`, and `npm run build:user-portal`. If backend failures
stop `npm test`, run the selected portal tests separately. The shared
converter changes also select the renderer gate and hosted build/image
checks. Authentication and WorkOS behavior do not change, so their live
gates are not selected.

Run habit-hooks and the full ast-metrics process with fresh unit coverage.
The incomplete public search specification from SEARCH-01 remains a failed
gate until MCP registration is implemented. The pull request stays Draft.

## Complete-candidate results

These results cover the final whole-banner correction at `c7a951a3`.

| Check | Exit | Result |
| --- | --- | --- |
| Focused new tests | 0 | All 73 cases passed: 62 provider, 3 converter, and 8 integration cases. |
| `npm test` | 1 | 5,517 of 5,523 backend cases passed in 303 suites. Two public search cases await MCP registration. Three logging cases require `AXIOM_API_KEY`, which is unset. The existing metrics timeout case also failed; see the diagnosis below. |
| `npm run test:user-portal` | 0 | All 41 cases passed. Run separately because backend failures stopped the ordinary command before portal tests. |
| `npm run typecheck` | 0 | Backend and portal types passed, including the static engine contracts. |
| `npm run test:build` | 0 | All 13 cases passed. |
| `npm run build:user-portal` | 0 | Passed. |
| `npm run test:mcp:renderer` | 0 | All 9 cases passed with pinned Lightpanda 1.0.0. |
| `npm run build:hosted` | 0 | Every stage passed: 3,921 backend unit cases, 23 portal unit cases, 13 build cases, 18 portal acceptance cases, 566 integration cases, 142 selected acceptance/interface cases, and 9 renderer cases. |
| `npm run test:container:hosted` | 0 | All 9 Linux AMD64 image cases passed, including runtime rendering, cancellation, shutdown, and refusal to produce an image after a failed offline check. |
| Metrics timeout-test diagnosis | 0 | All 16 existing cases in `ast-metrics-mcp.test.js` passed when run alone after the image gate. |
| `habit-hooks --branch origin/main` | 1 | Completed with 26 retained findings, explained below. |
| ast-metrics process with fresh coverage | Pending | Required because production source changed. |

Every completed test run above had zero cancelled, skipped, or todo tests.
The ordinary suite remains a failed gate. No public acceptance case or logger
case was skipped, weakened, or changed to expect its current failure.

The metrics timeout case received the expected exit code and timeout text.
Its next assertion failed: the fake recorded zero tool calls rather than
one. The command's 300 ms deadline includes process startup and the MCP
handshake, so it can expire before the tool call. All 16 cases in that file
passed in an isolated rerun after the build gates, including the timeout
case. This supports a startup-timing diagnosis; it does not turn the failed
ordinary-suite run into a pass. The test and its deadline have not changed.

The focused changed-test command used the output from the clean build in
`npm test`:

```sh
node --test dist/test/unit/search-engine/search-engine-brave-http.test.js \
  dist/test/unit/html-cleaner-pipeline/html-to-markdown/html-to-markdown-search-links.test.js \
  dist/test/integration/search-pipeline/brave-markdown.test.js \
  dist/test/integration/search-pipeline/brave-renderer-failures.test.js
```

## Code-quality and manager review

The manager reviewed both implementation agents' changes and their test-first
evidence. Review tightened the no-results structure, required real rendered
Markdown links instead of URL text, and removed redundant constructor state.

`habit-hooks --branch origin/main` reports 26 findings. The snooze file
remains `[]`. The retained findings have these reasons:

- Two complexity findings: `PreparedHtmlDocument.extract` keeps the ordered
  normalization, sanitization, extraction, and output steps together. The
  extraction flags share one preservation decision. `isNoResults` checks one
  complete provider template; its early refusals keep unknown or conflicting
  content from becoming a claim of absence. Splitting each guard would hide
  that contract without removing its decisions.
- Ten comments in the converter files explain non-obvious library or safety
  constraints: DOM BOM boundaries; Markdown link labels; LinkeDOM's implied
  head/body behavior; neutral extraction URLs and relative links; BBCode's
  alternate content source; JSON comment handling; and Defuddle's code-block,
  initial-whitespace, and heading behavior. They state reasons rather than
  repeat the code.
- Twelve comments in the SEARCH-01 contract fixture are required
  `@ts-expect-error` assertions. Removing them would remove the negative
  compiler specification.
- Two file-size findings: the prepared document file owns one ordered
  conversion process and its parser workarounds; the provider unit file owns
  one public contract matrix. Neither needs a mechanical split.

The six trailing-whitespace findings from `git diff --check` are in the two
HTML fixture files. They are retained to preserve the original captured
bytes and the documented derivative. Source and document edits have no such
findings.

### Maintainability inspection

All comparisons use base `0524a43646886f143ddf707bfb73d2157085649a`.
Direct inspection with `ast-metrics-mcp.ts file` gives these file scores,
all below the goal of 85:

| File | Score | Retained reason |
| --- | --- | --- |
| `src/search-engine/search-engine-brave-http.ts` | 34.3 | One provider owns the fixed request, response bounds, supported DOM grammar, and safe failure boundary. Its seven named methods have at most 15 decision paths each. A separate file for each guard would spread this provider contract without simplifying it. The no-results method checks one strict template with early refusals. Its final descendant-count check uses the known elements; a redundant second order check was removed. |
| `src/html-cleaner-pipeline/html-to-markdown/prepare-html-document.ts` | 44.5 | The document owns parsing, ordered normalization and sanitization, and local Defuddle extraction. The new inline-label operation has three paths. Fragment status now comes from the owned document. Keep the existing parser workarounds together; splitting them does not simplify their order or invariants. |
| `src/html-cleaner-pipeline/html-to-markdown/clean-html-to-markdown-defuddle.ts` | 62.9 | One converter owns input sanitization, extraction, output sanitization, and report accumulation. The added option changes only document preparation. The existing shared boundary stays explicit. |
| `src/search-pipeline/search-query.ts` | 65.4 | The class owns bounded Unicode validation, a fixed constructor error, and read-only exact text. The scalar loop uses constant space and stops at the bound. Moving the checks or replacing them with a counting expression would hide this contract. |

These are retained goal misses, not passes. The complete process and its
coverage assessment are pending.

### Analyzer completeness correction

The pinned ast-metrics 0.43.1 process collected fresh coverage successfully:
3,921 backend unit cases and 23 portal unit cases passed. The process then
stopped at the source-declaration completeness check. Its file metrics omitted
anonymous callbacks that have the same qualified class name. The converter
had 6 source declarations but 5 measured functions; the prepared document had
17 but 16; the Brave engine had 12 but 8. This is a tool failure, not an
allowed score exception.

The [saved upstream patch](search-02-ast-metrics.patch) applies to
[ast-metrics v0.43.1](https://github.com/ast-metrics/ast-metrics/tree/b2f83dc17bc5f13084c163400def4d55d691f983).
Its six-line source change gives unnamed functions a deduplication key from
their source span, or object identity when no span exists. It keeps named
function handling and reported names and measurements unchanged. It does not
change Thermus source, scripts, coverage, rules, or baseline.

Two upstream regression files first reproduced the failure, then passed after
the correction. They cover distinct declarations, same-span aliases, absent
spans, repeated scope aliases, outside-class selection, and real TypeScript
parsing of two callbacks. The existing engine suites then passed in 19
packages, with 328 top-level tests and 614 passing test events including
subtests. Two existing opt-in corpus diagnostic tests were skipped because
their corpus environment variables were unset; two packages have no tests.
No failed test was changed or skipped.

The tool checkout, Go toolchain, and caches are isolated under ignored
`ast-report/search-02-tooling/`. The installed Homebrew analyzer is unchanged.
The Go toolchain is 1.27.3 for Darwin ARM64; its official archive SHA-256 is
`dd3908cf20959d798c1e06ebe5b72213f0505ce01373b40ce3110975a6cd99c2`.
The saved patch SHA-256 is
`a75412fe6c1cf3b22f8bdcdc5c55677f2abb3f4a7a07b48c2ed58b5ff502c0e6`.
The custom binary reports `0.43.1-search02-anonymous-fix`; its SHA-256 is
`f834fbf0587bbfff3e25da094965d2d4c0faabe49247dec30dcc74a8a13ad115`.
This is a local correction, not the pinned upstream release.

To reproduce the tool, check out the exact upstream commit above in an
isolated directory, apply the saved patch with `git apply`, and run:

```sh
go test ./internal/engine ./internal/engine/typescript \
  -run 'Test(GetFunctionsInFile|GetFunctionsOutsideClassesInFile|TypeScriptParser_PreservesAnonymousClassCallbacks)' \
  -count=1 -v
go test ./internal/engine/... -count=1 -json
go build -trimpath \
  -ldflags '-X main.version=0.43.1-search02-anonymous-fix -X main.commit=b2f83dc17bc5f13084c163400def4d55d691f983+anonymous-dedup' \
  -o ../0.43.1-search02-anonymous-fix/bin/ast-metrics ./cmd/ast-metrics
```

The recorded run used `GOTOOLCHAIN=local` and isolated `GOPATH` and `GOCACHE`.
Run the Thermus wrappers with that binary directory first on command-scoped
`PATH` and the explicit `--allow-tool-version` option. Use the same base for
every comparison and reuse the fresh unit coverage while Thermus source,
tests, and scripts remain unchanged. The native comparison checks out its
base, so commit document changes before starting it.
