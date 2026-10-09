import { CATEGORY, sanitize } from 'agent-input-sanitizer';
import { detectExfil } from 'agent-input-sanitizer/html';
import { describeRemoved, describeWarned } from 'agent-input-sanitizer/output';
import type { Ctx } from '../html-to-markdown-pipeline.ts';
import { HiddenHtmlScanner } from './hidden-html-scanner.ts';
import { CssSelectorLimitError } from './css-visibility-selectors.ts';
import { CssVisibilityProvenance } from './css-visibility-provenance.ts';
import type { PromptInjectionRemover } from './prompt-injection-remover.ts';

type HtmlScan = ReturnType<typeof HiddenHtmlScanner.scan>;
type HtmlRemoval = {
  html: string;
  removed: { comments: number; hidden: number };
  warned: HtmlScan['warned'];
  exfilReasons: Set<string>;
  visibleStyleValues: string[];
};

export class PromptInjectionRemoverSanitizer implements PromptInjectionRemover {
  private static readonly maxHtmlBytes = 10 * 1024 * 1024;
  private static readonly maxHtmlScans = 8;

  public async invoke(ctx: Ctx): Promise<Ctx> {
    if (Buffer.byteLength(ctx.html, 'utf8') > PromptInjectionRemoverSanitizer.maxHtmlBytes) {
      throw new RangeError('HTML input exceeds the 10 MiB limit');
    }

    const sanitized = await sanitize(ctx.html);
    const result = PromptInjectionRemoverSanitizer.removeHiddenHtml(sanitized.cleaned);
    const styleReports = await Promise.all([...new Set(result.visibleStyleValues)].map((value) => sanitize(` ${value}`)));
    const found = new Set([...sanitized.found, ...styleReports.flatMap((report) => report.found)]);
    const warnings = new Set([...sanitized.warnings, ...styleReports.flatMap((report) => report.warnings)]);
    if (result.removed.comments > 0) found.add(CATEGORY.HTML_COMMENTS);
    if (result.removed.hidden > 0) found.add(CATEGORY.HIDDEN_HTML);
    const removed = describeRemoved(result.removed);
    if (removed) warnings.add(`HTML sanitized: ${removed} removed`);
    const preserved = describeWarned(result.warned);
    if (preserved) warnings.add(preserved);
    if (result.exfilReasons.size > 0) {
      found.add(CATEGORY.EXFIL_URLS);
      warnings.add(`Exfil-shaped URLs detected: ${[...result.exfilReasons].join('; ')}`);
    }
    if (result.withholdWarning) {
      warnings.add(result.withholdWarning);
    }

    return {
      ...ctx,
      html: result.html,
      skipped: ctx.skipped + found.size,
      found: [...(ctx.found ?? []), ...found],
      warnings: [...(ctx.warnings ?? []), ...warnings],
    };
  }

  private static removeHiddenHtml(text: string) {
    const provenance = new CssVisibilityProvenance();
    const result: HtmlRemoval = {
      html: text,
      removed: { comments: 0, hidden: 0 },
      warned: { tags: {}, dataSrc: 0 },
      exfilReasons: new Set<string>(),
      visibleStyleValues: [],
    };

    for (let pass = 0; pass < PromptInjectionRemoverSanitizer.maxHtmlScans; pass++) {
      for (const threat of detectExfil(result.html) ?? []) {
        result.exfilReasons.add(
          `${threat.isImage ? 'image' : 'link'} to ${threat.target}: ${threat.reason}`,
        );
      }
      const scan = PromptInjectionRemoverSanitizer.tryScanHtml(result.html, provenance);
      if (!scan) {
        return { ...result, html: '', withholdWarning: 'HTML scan failed; remaining HTML withheld' };
      }
      PromptInjectionRemoverSanitizer.recordScanWarnings(scan, result);
      if (scan.ranges.length === 0) {
        const html = PromptInjectionRemoverSanitizer.removeRanges(result.html, scan.visibleStyles, 'style=""');
        return { ...result, html, visibleStyleValues: scan.visibleStyleValues, withholdWarning: undefined };
      }

      result.removed.comments += scan.removed.comments;
      result.removed.hidden += scan.removed.hidden;
      result.html = PromptInjectionRemoverSanitizer.removeRanges(
        result.html,
        scan.ranges,
      );
    }

    // The last removal can form more hidden HTML. Withhold the unchecked result.
    return { ...result, html: '', withholdWarning: 'HTML scan limit reached; remaining HTML withheld' };
  }

  private static recordScanWarnings(scan: HtmlScan, result: HtmlRemoval): void {
    for (const threat of detectExfil(scan.urlSource) ?? []) {
      result.exfilReasons.add(
        `${threat.isImage ? 'image' : 'link'} to ${threat.target}: ${threat.reason}`,
      );
    }
    // Keep the largest count for each reason. A new scan can see the same tag.
    for (const [tag, count] of Object.entries(scan.warned.tags)) {
      result.warned.tags[tag] = Math.max(result.warned.tags[tag] ?? 0, count);
    }
    result.warned.dataSrc = Math.max(result.warned.dataSrc, scan.warned.dataSrc);
  }

  private static tryScanHtml(text: string, provenance: CssVisibilityProvenance): HtmlScan | undefined {
    try {
      return HiddenHtmlScanner.scan(text, provenance);
    } catch (error) {
      if (error instanceof CssSelectorLimitError) throw error;
      return undefined;
    }
  }

  private static removeRanges(
    text: string,
    ranges: HtmlScan['ranges'],
    replacement = '',
  ): string {
    const parts: string[] = [];
    let cursor = 0;
    for (const range of ranges.sort((left, right) => left.start - right.start)) {
      if (range.start >= cursor) parts.push(text.slice(cursor, range.start), replacement);
      cursor = Math.max(cursor, range.end);
    }
    parts.push(text.slice(cursor));
    return parts.join('');
  }
}
