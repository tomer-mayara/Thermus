# Ad rules

`CleanHtmlAdsAdblockRs` needs an explicit string of trusted Adblock Plus (ABP) rules. The application supplies the rules when it creates the cleaner. The cleaner does not choose or read a file, read environment variables, fetch rules, or refresh them.

```ts
import { CleanHtmlAdsAdblockRs } from './html-cleaner-pipeline/ad-cleaner/adb/clean-html-ads-adblock-rs.js';
import { HtmlToMarkdownPipeline } from './html-cleaner-pipeline/html-to-markdown-pipeline.js';

const rules = 'example.com##.ad';
const ads = new CleanHtmlAdsAdblockRs(rules);
const pipeline = new HtmlToMarkdownPipeline([ads]);
const page = {
  requestedUrl: 'https://example.com/article',
  finalUrl: 'https://example.com/article',
  html: '<aside class="ad">Ad</aside><p>Story</p>',
};
const result = await pipeline.process(page);
```

The page has `requestedUrl`, `finalUrl`, and `html` fields. The cleaner uses `finalUrl` to select domain rules after redirects.

The constructor throws `TypeError('Ad rules must be supplied as a string')` when the value is missing, `null`, or not a string. An empty string, a string with only blank lines, and a string with only comments make the cleaner a no-op. The native adblock-rs parser ignores lines that it cannot parse and keeps accepted rules. Those ignored lines do not increment `skipped`. Accepted selectors that the cleaner does not support and procedural actions encountered during `invoke` do increment `skipped`. A rules string with only ignored lines can make the cleaner a no-op. The cleaner does not use a fallback source or fetch rules.

Use ABP exception rules in the supplied string when a site needs an exception. For example, `example.com#@#.sponsor` exempts the `.sponsor` selector on `example.com`.

Each cleaner builds its engine when it is constructed. That engine keeps a snapshot of the supplied rules. To use an updated list, construct a new cleaner and replace the old instance. You can reuse one cleaner in a pipeline. Each cleaner owns its engine; instances do not share engines.

The application owns rule trust, persistence, versions, updates, and update failures. For example, an application can read a configured absolute path and pass its contents to the constructor:

```ts
import { readFileSync } from 'node:fs';

const rules = readFileSync('/etc/magumagu/ad-rules.txt', 'utf8');
const ads = new CleanHtmlAdsAdblockRs(rules);
```

Choose and validate that path in application configuration. If the file cannot be read, `readFileSync` throws before the cleaner is constructed. The caller owns the failure policy. The cleaner does not download rules or make network requests. This step applies cosmetic rules to supplied HTML. It does not block network requests. Test fixture rule lists are supplied by tests only.

If you used `new CleanHtmlAdsAdblockRs()` before, pass the intended rules string instead. For a deliberate no-op, pass `''`.

Matched elements use source ranges. The cleaner merges overlapping and adjacent ranges, then slices the retained spans from the original HTML in source order and joins them once. Output construction takes O(n + r) work for n source UTF-16 units and r merged ranges. It does not rebuild the remaining document for each match. Each matched DOM node still adds one to `removed`, even when its range overlaps another match. Multiple selectors for the same node count once.

Retained spans keep their exact source text, including supplementary Unicode and line endings. The existing lone-line rule removes spaces, tabs, and the following LF when an ad is the only content on that line. A CR before LF prevents that expansion; CRLF whitespace stays in the source after the element is removed.

Run the deterministic construction regression with:

```sh
npm run build && node --test dist/test/unit/clean-html-ads-construction.test.js
```

The test uses 32, 128, and 512 matches on short lines and in minified source. It counts slice calls and requested UTF-16 units through the public cleaner interface, checks exact output and counts, and requires a fixed linear slice-call budget. Short-line inputs also require a fixed linear budget for requested slice units. Minified inputs report slice units without that bound, so the remaining line-scan cost is visible. This is an operation-count regression, not a timing benchmark or a measure of physical string allocation. It bounds output construction for these inputs; parsing, selector matching, range sorting, and per-match line scans have separate costs. In particular, many matches on one long line can still cause repeated line scans and whitespace slices.

For 32 matches in those fixtures, the original loop and the retained-span construction request these slice sizes. The measurements include the unchanged lone-line checks.

| Fixture | Source UTF-16 units | Original slice calls | New slice calls | Original requested slice units | New requested slice units |
| --- | ---: | ---: | ---: | ---: | ---: |
| Short lines | 2,060 | 128 | 97 | 54,464 | 2,508 |
| Minified source | 1,163 | 128 | 97 | 60,992 | 36,843 |

The comparison uses the same public `invoke` input and slice counter, with the original removal loop substituted in an isolated Node process. It changes no production API. The minified fixture is repeated `<div id="eh-id">ad</div><p>keep</p>` after the test prefix. Its requested slice units still grow with both source length and match count because of the unchanged line checks.
