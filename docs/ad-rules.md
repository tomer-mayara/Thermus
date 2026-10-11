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

The constructor throws `TypeError('Ad rules must be supplied as a string')` when the value is missing, `null`, or not a string. An empty string, a string with only blank lines, and a string with only comments make the cleaner a no-op. The native adblock-rs parser ignores lines that it cannot parse and keeps accepted rules. Those ignored lines do not increment `skipped`. Each unsupported procedural action, selector evaluation error, and matched node attempt without a source range adds one to `skipped`. A selector with no matches adds nothing. A second invocation can attempt unsupported work again and add to `skipped` again. A rules string with only ignored lines can make the cleaner a no-op. The cleaner does not use a fallback source or fetch rules. See [pipeline metrics](pipeline-metrics.md) for the shared result contract.

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

Matched elements use source ranges. The cleaner merges overlapping and adjacent ranges, then slices the retained spans from the original HTML in source order and joins them once. Output construction takes O(n + r) work for n source UTF-16 units and r merged ranges. It does not rebuild the remaining document for each match. Each matched DOM node with a source range adds one to `removed`, even when its range overlaps another match. Multiple selectors for the same node count once. A matched ancestor and matched child count separately. Unselected descendants removed with an ancestor do not add targets. Ad removal does not add detection categories to `found`. The cleaner preserves prior findings and warnings.

Retained spans keep their exact source text, including supplementary Unicode and line endings. The existing lone-line rule removes spaces, tabs, and the following LF when an ad is the only content on that line. A CR before LF prevents that expansion; CRLF whitespace stays in the source after the element is removed.

Run the deterministic construction regression with:

```sh
npm run build && node --test dist/test/unit/clean-html-ads-construction.test.js
```

The cleaner scans the source once to record each LF line boundary and the first and last character other than a space or tab on each line. Each matched range uses binary searches in that line index to check the lone-line rule. It does not scan or slice the same long line again for each match. For n source UTF-16 units, m matched ranges, and l source lines, this check takes O(n + m log l) work and uses O(l) line records. Parsing, selector matching, and range sorting have separate costs.

The test uses 32, 128, and 512 matches on short lines, in minified source, and in minified source with long whitespace gaps and supplementary Unicode. Through the public cleaner interface, it checks exact output and counts and records source scans, slice calls, and requested UTF-16 units. Every fixture permits at most three inspected source units and two requested slice units per source UTF-16 unit, and at most three slice calls per match plus one. This is an operation-count regression, not a timing benchmark or a measure of physical string allocation. It does not bound parsing, selector matching, or range sorting.
