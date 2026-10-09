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
