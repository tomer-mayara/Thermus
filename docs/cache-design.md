# Planned cache key design

No cache exists yet. This note defines the key for a future cleaned-page cache. It does not define a cache service, expiry, storage, or security policy.

## Default identity

The default key will represent a versioned structured tuple:

1. The trusted tenant ID from the authenticated request context.
2. The exact accepted absolute HTTP(S) URL string supplied to the fetch path.

Keep the URL spelling, including scheme, authority, host and port, path, raw query, and fragment. Preserve whether `?` or `#` is present, including with an empty value. Keep the accepted string for the key if the fetcher later parses the URL.

Do not normalize the URL by default. Redundant entries are acceptable. Do not parse query fields into a map or use `URLSearchParams` and serialize them for the key. These operations can change order, repeated fields, blank values, and encoding. Parsing and serialization can also change spelling. See the [WHATWG URL Standard](https://url.spec.whatwg.org/#interface-urlsearchparams) and [RFC 3986 section 6.2.1](https://www.rfc-editor.org/rfc/rfc3986#section-6.2.1).

Encode the tuple with a structured form that preserves field boundaries. Do not join fields with an unescaped delimiter. Include a key-format version. Any change to URL equivalence requires a new version.

Tenant ID is part of content identity, so one URL in two tenants has different keys. Caller reason is logging or audit metadata; it is not content identity.

## Equivalence rules

No URL equivalence rule is enabled by this ticket. A future rule may remove or normalize URL parts only under an explicit, scoped, tested contract. The contract must state its origin, route, transform, and rule version. It must establish that equivalent inputs produce the same cached output, including links and URL-derived metadata, under the same effective fetch and clean settings. Audit records may still contain different request URLs or reasons.

Tests of fetched, rendered, and cleaned output must support the contract. Tests alone do not prove that arbitrary responses are always equal. A rule also needs a site contract that guarantees the stated behavior for its scope. If the contract does not cover an input, use exact-string identity.

Fragments stay in the default key. Lightpanda JavaScript can use hash routes, so dropping a fragment can change the rendered page. A future rule may remove fragments only with a scoped site contract and tests for the full fetch, render, and clean path.

## Required key tests

These future unit tests remain pending. Unless a row says otherwise, use tenant `t1` and reason `research` for both inputs. Run new tests RED → GREEN. Confirm each fails for the expected reason before implementing the key, then confirm it passes.

| Exact input pair or condition | Expected result under default policy |
| --- | --- |
| Tenant `t1`, URL `https://example.test/article`; repeat the same input | Equal keys; deterministic result |
| Tenant `t1` versus `t2`, URL `https://example.test/article` | Different keys |
| Same tenant and URL `https://example.test/article`, reason `research` versus `compare` | Equal keys |
| `https://example.test/article?id=1` versus `https://example.test/article?id=2` | Different keys; dropping `id` can change an article |
| `https://example.test/search?q=alpha` versus `https://example.test/search?q=beta` | Different keys; dropping `q` can change search results |
| `https://example.test/article?sort=asc` versus `https://example.test/article?sort=desc` | Different keys |
| `https://example.test/article?a=1&b=2` versus `https://example.test/article?b=2&a=1` | Different keys |
| `https://example.test/article?a=1&a=2` versus `https://example.test/article?a=2&a=1` | Different keys; first or last value can matter |
| `https://example.test/article?a=1&a=1` versus `https://example.test/article?a=1` | Different keys; do not collapse duplicates |
| `https://example.test/article?x` versus `https://example.test/article?x=` versus `https://example.test/article` | Each spelling has a different key; missing, bare, and empty values can select different defaults |
| `https://example.test/search?q=a+b`, `https://example.test/search?q=a%20b`, and `https://example.test/search?q=a%2Bb` | Each spelling has a different key |
| `https://example.test/search?q=a%26b` versus `https://example.test/search?q=a&b` | Different keys; decoding `%26` can turn a value byte into a field separator |
| `https://example.test/search?q=%2F`, `https://example.test/search?q=/`, and `https://example.test/search?q=%2f` | Each spelling has a different key |
| `https://example.test/article/a%2Fb` versus `https://example.test/article/a/b` | Different keys |
| `https://example.test/search?q=%2526` versus `https://example.test/search?q=%26` | Different keys; these are different decoding levels |
| `https://example.test/search?Color=blue` versus `https://example.test/search?color=blue`; `https://example.test/search?q=Blue` versus `https://example.test/search?q=blue` | Different keys; lowercase conversion can alter names or values |
| `https://example.test/article#one` versus `https://example.test/article#two` | Different keys, including for hash routes |
| `https://example.test/article` versus `https://example.test/article?`; `https://example.test/article` versus `https://example.test/article#` | Different keys for each pair |
| `https://example.test/article` versus `http://example.test/article`; `https://example.test/article` versus `https://other.test/article`; `https://example.test/article` versus `https://example.test:8443/article`; `https://example.test/article` versus `https://example.test/other` | Different keys for each pair |
| Tenant `t1:https://example.test/p`, URL `https://example.test/q` versus tenant `t1`, URL `https://example.test/p:https://example.test/q` | Different keys; if tenant IDs cannot contain `:`, reject an invalid ID instead of conflating tuple fields |

## Hypothetical scoped equivalence tests

This example is not enabled by this ticket. Suppose a site contract covers exact origin `https://example.test` and route `/article`. Rule version `article-tracking-v1` splits the raw query on `&`, then removes complete fields whose exact raw name is `utm_source`: the bytes before the first `=`, or the whole field when it has no `=`. It rejoins remaining fields in their original order and keeps their raw spelling and whether `?` was present. It does not decode fields. Names `UTM_SOURCE` and `%75tm_source` remain unchanged. The contract covers every duplicate, bare, or blank `utm_source` field. Other query names, values, and bytes remain unchanged.

Enable this rule only if the site's contract guarantees that removing those fields preserves the cached output, including links and URL-derived metadata, under the same fetch and clean settings. Add fetch, render, and clean tests for those results across the covered forms. Audit request URL and reason may still differ. Equivalence holds only for the same tenant when the complete URL strings after this transform are equal under the same rule version. No rule is enabled here.

| Exact input pair or condition | Expected result with `article-tracking-v1` |
| --- | --- |
| `https://example.test/article?utm_source=a&x=1` versus `https://example.test/article?x=1&utm_source=b` | Equal keys: transformed full URLs match |
| `https://example.test/article?utm_source=a` versus `https://example.test/article?utm_source=&utm_source` | Equal keys: the contract covers all listed forms |
| `https://example.test/article?utm_source=a&x=1` versus `https://example.test/article?utm_source=b&x=2` | Different keys: another field differs |
| `https://example.test/article?utm_source=a` versus `https://example.test/article?utm_source=b`, with rule disabled | Different keys under default identity |
| `https://other.test/article?utm_source=a` versus `https://other.test/article?utm_source=b` | Different keys; origin is outside scope |
| `https://example.test/other?utm_source=a` versus `https://example.test/other?utm_source=b` | Different keys; route is outside scope |
| Same inputs with `article-tracking-v1` versus another rule version | Different key namespace |
