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

The cleaner owns selector selection through its private engine. Callers supply the page context and do not select cosmetic rules. Before it asks the engine for selectors, the cleaner walks the full parsed document and checks the element depth limit. This check also applies when no host rule matches or generic hiding is disabled. Selection uses the final URL, collected class and ID tokens, and rule exceptions.

The application owns rule trust, persistence, versions, updates, and update failures. For example, an application can read a configured absolute path and pass its contents to the constructor:

```ts
import { readFileSync } from 'node:fs';

const rules = readFileSync('/etc/thermus/ad-rules.txt', 'utf8');
const ads = new CleanHtmlAdsAdblockRs(rules);
```

Choose and validate that path in application configuration. If the file cannot be read, `readFileSync` throws before the cleaner is constructed. The caller owns the failure policy. The cleaner does not download rules or make network requests. This step applies cosmetic rules to supplied HTML. It does not block network requests. Test fixture rule lists are supplied by tests only. The self-hosted and hosted servers read their rules from `AD_RULES_FILE`; the [server rules file](#server-rules-file) section gives its policy.

If you used `new CleanHtmlAdsAdblockRs()` before, pass the intended rules string instead. For a deliberate no-op, pass `''`.

Matched elements use source ranges. The cleaner merges overlapping and adjacent ranges, then slices the retained spans from the original HTML in source order and joins them once. Output construction takes O(n + r) work for n source UTF-16 units and r merged ranges. It does not rebuild the remaining document for each match. Each matched DOM node with a source range adds one to `removed`, even when its range overlaps another match. Multiple selectors for the same node count once. A matched ancestor and matched child count separately. Unselected descendants removed with an ancestor do not add targets. Ad removal does not add detection categories to `found`. The cleaner preserves prior findings and warnings.

Retained spans keep their exact source text, including supplementary Unicode and line endings. The existing lone-line rule removes spaces, tabs, and the following LF when an ad is the only content on that line. A CR before LF prevents that expansion; CRLF whitespace stays in the source after the element is removed.

Run the deterministic construction regression with:

```sh
npm run build && node --test dist/test/unit/html-cleaner-pipeline/ad-cleaner/clean-html-ads-construction.test.js
```

The cleaner scans the source once to record each LF line boundary and the first and last character other than a space or tab on each line. Each matched range uses binary searches in that line index to check the lone-line rule. It does not scan or slice the same long line again for each match. For n source UTF-16 units, m matched ranges, and l source lines, this check takes O(n + m log l) work and uses O(l) line records. Parsing, selector matching, and range sorting have separate costs.

The test uses 32, 128, and 512 matches on short lines, in minified source, and in minified source with long whitespace gaps and supplementary Unicode. Through the public cleaner interface, it checks exact output and counts and records source scans, slice calls, and requested UTF-16 units. Every fixture permits at most three inspected source units and two requested slice units per source UTF-16 unit, and at most three slice calls per match plus one. This is an operation-count regression, not a timing benchmark or a measure of physical string allocation. It does not bound parsing, selector matching, or range sorting.

## Server rules file

Both production server compositions use the trusted rules file that `AD_RULES_FILE` names. [`readAdRulesFile(environment)`](../../src/config/ad-rules-file.ts) reads the setting from the server environment. [`createFetchOperation()`](../../src/fetch-tool.ts) gives the text to one `CleanHtmlAdsAdblockRs` when the server starts.

- The value must be the absolute path of a trusted file.
- The server reads the file one time, with one `readFileSync` call. There is no check before the read, so the file cannot change between a check and the read.
- The text must be UTF-8. The decoder is strict. It removes a UTF-8 byte order mark at the start.
- There is no size limit, because the operator trusts the file.
- There is no syntax check. The native parser ignores lines that it cannot parse. An empty file, or a file with only comments, makes the cleaner a no-op. The other pipeline steps still run.
- There is no updater. The server keeps the rules that it read at startup. A changed file takes effect at the next server start.

Only the server reads `AD_RULES_FILE`. `loadDeploymentConfig` does not read it. The local account and client commands share that loader and never read the rules. The commands load no rules reader, renderer, cleaning pipeline, or adblock-rs module. The hosted server loads these modules for its protected fetch tool. The production rules source, license, version, and update policy remain an owner choice for RHD-03; test fixtures are not a production rules policy.

A rules failure stops startup before the server opens the data directory and before it listens. The server writes one `FATAL` line and exits with status 1:

| Condition | `FATAL` message |
| --- | --- |
| The setting is not set or is empty | `AD_RULES_FILE is required. Set it to the absolute path of a trusted ad rules file.` |
| The path is relative | `AD_RULES_FILE must be an absolute path.` |
| The read fails | `AD_RULES_FILE could not be read (<code>).` The code is the error code, for example `ENOENT`, `EISDIR`, or `EACCES`. It is `unknown error` when the error has no string code. |
| The text is not UTF-8 | `AD_RULES_FILE must contain UTF-8 text.` |
| The native adblock-rs parser fails | `The ad cleaner could not load the rules in AD_RULES_FILE.` |

No message shows the path or the file contents. A read, decoder, or parser failure keeps the original error as `cause`, but the `FATAL` line shows only the message. The parser message is not shown, because it can repeat rule text.

The container image sets `AD_RULES_FILE=/etc/thermus/ad-rules.txt`, but it has no rules file. The [container installation](../../README.md#container-installation) tells how to supply one.
