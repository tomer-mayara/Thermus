# Pipeline metrics

The pipeline keeps the existing `Ctx` fields. `removed`, `skipped`, and `found` report different results. `HtmlToMarkdownPipeline.process` starts each run with `removed: 0` and `skipped: 0`. Each step preserves prior counts and reports when it returns a new context. It does not mutate the input context.

| Field | Meaning | Limits |
| --- | --- | --- |
| `removed` | Number of HTML removal targets handled by the ad cleaner and hidden-text sanitizer | Does not measure characters, bytes, source ranges, detection categories, or Defuddle boilerplate removal |
| `skipped` | Number of ad processing attempts that the cleaner cannot apply | Does not count detections, ignored rule lines, selectors with no matches, or sanitizer removals |
| `found` | Detection categories, in first-report order, with each category once across stages | Does not count occurrences or measure severity; a finding need not cause a removal |

`found` is optional. An absent list means no reported categories. Use the list to calculate the number of distinct categories:

```ts
const detectionCount = new Set(result.found ?? []).size;
```

There is no separate numeric detection field. Repeated controls, URLs, or hidden targets can report the same category. Warnings give further detail; their number is not a detection count. The sanitizer and converter preserve prior warnings and do not append an identical warning string again.

## Removal targets

The ad cleaner counts each distinct matched DOM node with a source range once per invocation. Two selectors for the same node add one. A matched ancestor and a matched child add two, even when their source ranges overlap. A child that is removed only with its matched ancestor adds nothing. Merging ranges or removing adjacent line whitespace does not add targets.

The hidden-text sanitizer counts each independent hidden element, hidden text node with non-whitespace text, hidden replaced-content element, and HTML comment that it removes. A hidden ancestor is one target; descendants removed with that ancestor, including comments, add nothing. A text-only hiding rule can remove separate text nodes while it keeps their element wrappers and visible descendants. Each such text node is a target. A hidden input value or image handled as replaced content is one target. Whitespace-only text is not an independent target, but it can disappear with a hidden ancestor.

The configurable small-text policy uses these same counts. A non-whitespace text node removed below the effective font-size cutoff adds one target. A removed text-entry value uses the existing replaced-content target rule. These removals report `hidden-html` and the existing HTML removal warning, even when the removed text could be visible. They do not add a new counter or category, and they do not change `skipped`.

The sanitizer counts a target only when that target or a covered descendant contributes source content to remove. An implied hidden element with no such content adds nothing. Parser copies of the same authored element count as one sanitizer target. For example, `<p><b hidden>A<p>B</b>C` creates multiple parsed hidden elements from one authored `<b>` and adds one to `removed`. These sanitizer rules differ from the ad cleaner's count of distinct matched DOM nodes.

Counts accumulate across removal scans. A later scan can remove a new target formed by an earlier removal. One target can need several source intervals; these intervals do not add targets. If a failed scan or the scan limit causes the sanitizer to withhold remaining HTML, withholding adds no target. The count retains only removals completed by earlier successful scans.

Invisible-character cleanup, resolved style cleanup, and the converter's text, attribute, title, and Markdown checks do not add HTML removal targets. Defuddle's content extraction and boilerplate cleanup do not add targets either. These operations can add detection categories and warnings where applicable.

## Unsupported attempts

The ad cleaner adds one to `skipped` for each unsupported procedural action returned for the page, each selector evaluation that throws, and each matched node attempt that has no source range. An unsourced node can be attempted by more than one selector. Each attempt counts. A rule line ignored by the rule parser adds nothing because no processing attempt occurs.

The sanitizer and converter preserve `skipped`. Parser failure and HTML withholding produce sanitizer warnings; they do not add unsupported ad attempts. Input limits that throw do not return a completed result with updated counts.

Invoking a step again with its prior output is a new attempt. Unsupported ad work can add to `skipped` again. Retained findings do not add duplicate categories, and HTML already removed does not add to `removed` again. Starting a new `process` call starts new counts.

## Examples

These examples start with zero counts and no findings. They assume that no other stage reports a category.

| Result | `removed` | `skipped` | Detection categories |
| --- | ---: | ---: | --- |
| One matched ad ancestor and one matched child removed | 2 | 0 | None from ad removal |
| One hidden element removed with a nested comment | 1 | 0 | Hidden HTML |
| One 11px text node removed by the default 12px cutoff | 1 | 0 | Hidden HTML |
| Two separate comments removed | 2 | 0 | HTML comments, once |
| Repeated prohibited controls cleaned from visible text | 0 | 0 | Each reported control category, once |
| One visible exfil-shaped URL reported and retained | 0 | 0 | Exfil-shaped URLs |
| One unsupported procedural action attempted | 0 | 1 | None from the unsupported attempt |

## Migration

The field names and types have not changed, but their meaning has changed:

- `removed` previously counted ad targets only. It now also counts HTML sanitizer targets. Do not label it as an ad-only count.
- `skipped` previously mixed unsupported ad attempts with sanitizer and converter detection categories. It now counts unsupported ad attempts only. Use distinct `found` categories for a detection count.
- Findings now remain unique across sanitizer and converter stages. Do not use repeated category entries as an occurrence count.

Stored results with the old mixed `skipped` value cannot be split reliably into unsupported attempts and detections. Keep their old meaning when you display historical data. Start fresh counts for new runs; do not carry an old mixed value into a new context. Comparing old and new `removed` values also requires the metric version or run date because the scope changed.

See [Ad rules](ad-rules.md) and [the hidden-text sanitizer contract](hidden-text-sanitizer.md) for stage behavior.
