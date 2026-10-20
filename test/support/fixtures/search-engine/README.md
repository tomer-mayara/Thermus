# Brave HTTP fixtures

These files are data for provider unit tests and real-cleaner integration
tests. Tests read them locally. They run no page scripts and make no network
requests.

## Captured results

`brave-results.html` is the complete, unchanged HTML returned by
`WebsiteFetcherLightpanda` for `https://search.brave.com/search?q=lightpanda+browser`.
The capture used the production fetcher options and Lightpanda **1.0.0** on
macOS ARM64 on 2026-10-20 at 18:22:11 UTC. Its executable SHA256 was
`955440053a84754dd64c62f970449a56a2b350cdf43ea5f2e809a73047b8173d`,
as recorded in the [runtime guide](../../../../docs/lightpanda-runtime.md).
The fetch took 3,707 ms.

`brave-results.json` records the query, requested and final URLs, capture time,
runtime version, size, and duration. The HTML has 244,841 UTF-8 bytes and SHA256
`e84b3692b05b0450fe3c59b17b86059683b82bb8e47aba3e00bd97a229b79ce6`.
Keep the full head, body, styles, scripts, and ancestors. The embedded page
state and public asset URLs are captured data, not executable test setup.

`brave-results-expected.json` lists all 18 captured web results in their
original order. Each entry has its primary title, destination, and a short
snippet excerpt. The integration test renders the output Markdown and checks
real links and text. Finding a raw URL in Markdown is not enough.

## Derived no-results page

`brave-no-results-derived.html` is a controlled variant, **not a captured
no-results response**. It keeps the captured page above and replaces only
the children of `section#mixed-main` with Brave's generic fallback banner.
The other source bytes, including embedded result data in scripts, stay in
place. This also tests that classification uses the DOM rather than page-state
text. The variant has 162,027 UTF-8 bytes and SHA256
`ca66177f765932cd5510a57af6b009448ee067f8a993e36b5d08b1afda3a3e37`.

The captured page references Brave's
[search page module](https://cdn.search.brave.com/serp/v3/_app/immutable/nodes/37.BbHpYnFS.js).
That module imports the
[fallback component](https://cdn.search.brave.com/serp/v3/_app/immutable/chunks/neQBzUED2.js).
The latter was read on 2026-10-20 and had SHA256
`5b7d11230e1dbc5519f99e9e894925a37d5790ef7612fb3b50450aac53207c17`.
Its generic branch supplies the wrapper, banner, query span, and two keyword
tips used here. The English header comes from the captured page's translation
data.

The same banner ID also appears in error and excessive-query branches.
The generic header means that few matches were found; it does not alone
establish absence. Tests therefore require the supported structure and
refuse result markers, conflicting banners, or the other branches. Unknown
and translated structures fail closed.

The live capture attempt for a quoted rare term returned fallback results,
not an empty page. A later query received HTTP 429 from the renderer. No
retry or challenge bypass was used. These fixtures do not prove that the
supported no-results branch occurs in a current live response. That remains
an explicit limit of this ticket and needs a live check in SEARCH-06.

## Controlled test changes

Provider tests change the captured shapes to check missing fields, bounds,
phrases in ordinary text, ambiguous pages, and unsupported responses.
Integration tests add named ad and CSS-hidden targets and relative links to
the full results page. These changes test cleaning and URL resolution; they
are not additional Brave captures. The original capture stays unchanged.
