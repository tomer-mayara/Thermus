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

## Captured results with a video description

`brave-results-video.html` is a second complete, unchanged rendered response
for `https://search.brave.com/search?q=Lightpanda+browser`. A single diagnostic
request through the production fetcher started on 2026-10-20 at
23:02:00.483 UTC. It used Lightpanda **1.0.0** on macOS ARM64 with the same
executable SHA256 above. No endpoint, renderer option, user agent, proxy,
network rule, or page content was changed. No challenge bypass was used.

The response has 241,431 UTF-8 bytes and SHA256
`f27f913dab952f1f2604e1dda098b18420ed86c31a6d90107f2b357396570ce8`.
`brave-results-video.json` records the capture metadata and confirms that no
transformations were made. Keep its full document context unchanged.

The page has 18 web result cards. Seventeen use the generic description.
The YouTube card uses `.video-snippet[data-macro="video"] > .content`.
Its description is the direct `.desktop-default-regular.line-clamp-2` child;
the other child holds publication metadata. The classifier requires the
description itself. Publication metadata alone cannot qualify a card.
The original classifier refused this page because it required a generic
description for every card. The public MCP regression reproduces that failure
offline and then checks all 18 cleaned titles, destination links, description
excerpts, and their order against `brave-results-video-expected.json`.

This capture is provider data. It does not prove a successful live MCP call.

## Captured results with an inline question

`brave-results-inline-qa.html` is the complete, unchanged rendered response
for `https://search.brave.com/search?q=consumer+laptop+2026+for+coding`.
The diagnostic request through `WebsiteFetcherLightpanda` started on
2026-10-21 at 15:25:53.719 UTC and took 2,440 ms. It used pinned Lightpanda
**1.0.0** on macOS ARM64, with executable SHA256
`955440053a84754dd64c62f970449a56a2b350cdf43ea5f2e809a73047b8173d`.
The request used the production fetcher options. No challenge bypass was used.

The response has 396,040 UTF-8 bytes and SHA256
`aef6be672fff0cc94f93555c1fb97bbb8793394738d7eadceda36a3e07ba4a5f`.
`brave-results-inline-qa.json` records the capture metadata and confirms that
no transformations were made. Keep the full document unchanged.

The page has 20 web result cards. The seventeenth card is a Reddit result
with a standard title and destination. Its direct
`.result-content > .inline-qa-question` description contains a timestamp
and question paragraphs. A separate `.inline-qa` widget contains answer
cards, vote counts, and a top-answer label. Only the question is an organic
description. The answer widget is excluded from output.

The original classifier refused the whole page because it recognized only
generic and video descriptions. The public MCP regression first reproduced
that failure offline, then checked all 20 titles, destination links,
description excerpts, and their order against
`brave-results-inline-qa-expected.json`. It also checks that answer text and
widget labels do not reach the client. Focused tests refuse a blank question,
answer-only content, a misplaced question, or a missing title or destination.
The integration safety case checks hidden text, ad targets, decoded controls,
and safe links in a controlled inline question.

This local capture reproduces the classifier failure. Hosted completion and
stage records were consistent with that failure, but no hosted response HTML
was captured. The fixture is provider data, not proof of a live MCP success.

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
unverified. [SEARCH-06](../../../../docs/implementation/search-06.md) records
a successful live results call and controlled no-results coverage; it does
not claim a live empty-results proof.

## Controlled test changes

Provider tests change the captured shapes to check missing fields, bounds,
phrases in ordinary text, ambiguous pages, and unsupported responses.
Integration tests add named ad and CSS-hidden targets and relative links to
the full results page. These changes test cleaning and URL resolution; they
are not additional Brave captures. The original capture stays unchanged.
