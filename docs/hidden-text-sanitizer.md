# Hidden-text sanitizer

`PromptInjectionRemoverSanitizer` removes hidden HTML elements and comments from source HTML. It also removes invisible characters. It does not remove authored marker text outside removed content.

The sanitizer removes invisible characters once. It then scans the HTML up to eight times. Each scan finds source ranges for hidden elements and comments. The sanitizer removes those ranges and scans the result again. This allows a removal to expose a new hidden element or comment. Source-range removal preserves supplementary characters. The scan count includes the final scan that finds no ranges. If the eighth scan still finds ranges, the sanitizer returns empty HTML and adds the warning `HTML scan limit reached; remaining HTML withheld`. It does not return HTML that it has not checked.

If a parser scan fails, the sanitizer stops and returns empty HTML. It adds the warning `HTML scan failed; remaining HTML withheld` and keeps reports from earlier scans. A parser failure does not count as a hidden element removal.

Before each scan, the sanitizer checks URLs for threats. It keeps threat findings and warnings when a later scan removes their source content. A visible flagged URL stays in the HTML. Each finding category and warning reason appears once per invocation. The sanitizer adds each category found in the invocation to `skipped` once and preserves existing context values.

The sanitizer rejects HTML larger than 10 MiB in UTF-8 bytes. This behavior does not change ad removal or Markdown conversion.
