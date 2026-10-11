import { detectExfil } from 'agent-input-sanitizer/html';
import { HiddenHtmlScanner } from './hidden-html-scanner.ts';
import { CssSelectorLimitError } from './css-visibility-selectors.ts';
import { CssVisibilityProvenance } from './css-visibility-provenance.ts';

type HtmlScan = ReturnType<typeof HiddenHtmlScanner.scan>;
export type HiddenHtmlRemovalResult = {
  html: string;
  removed: { comments: number; hidden: number };
  warned: HtmlScan['warned'];
  exfilReasons: Set<string>;
  visibleStyleValues: string[];
  withholdWarning: string | undefined;
};

export class HiddenHtmlRemovalSession {
  private static readonly maxHtmlScans = 8;
  private readonly provenance = new CssVisibilityProvenance();
  private readonly removed = { comments: 0, hidden: 0 };
  private readonly warned: HtmlScan['warned'] = { tags: {}, dataSrc: 0 };
  private readonly exfilReasons = new Set<string>();
  private visibleStyleValues: string[] = [];
  private scanCount = 0;

  public constructor(private html: string) {}

  public run(): HiddenHtmlRemovalResult {
    for (; this.scanCount < HiddenHtmlRemovalSession.maxHtmlScans; this.scanCount++) {
      for (const threat of detectExfil(this.html) ?? []) {
        this.exfilReasons.add(
          `${threat.isImage ? 'image' : 'link'} to ${threat.target}: ${threat.reason}`,
        );
      }
      const scan = this.tryScanHtml();
      if (!scan) {
        return this.result('', 'HTML scan failed; remaining HTML withheld');
      }
      this.recordScanWarnings(scan);
      if (scan.ranges.length === 0) {
        this.html = removeRanges(this.html, scan.visibleStyles, 'style=""');
        this.visibleStyleValues = scan.visibleStyleValues;
        return this.result(this.html);
      }

      this.removed.comments += scan.removed.comments;
      this.removed.hidden += scan.removed.hidden;
      this.html = removeRanges(this.html, scan.ranges);
    }

    // The last removal can form more hidden HTML. Withhold the unchecked result.
    return this.result('', 'HTML scan limit reached; remaining HTML withheld');
  }

  private result(html: string, withholdWarning?: string): HiddenHtmlRemovalResult {
    return {
      html,
      removed: this.removed,
      warned: this.warned,
      exfilReasons: this.exfilReasons,
      visibleStyleValues: this.visibleStyleValues,
      withholdWarning,
    };
  }

  private recordScanWarnings(scan: HtmlScan): void {
    for (const threat of detectExfil(scan.urlSource) ?? []) {
      this.exfilReasons.add(
        `${threat.isImage ? 'image' : 'link'} to ${threat.target}: ${threat.reason}`,
      );
    }
    // Keep the largest count for each reason. A new scan can see the same tag.
    for (const [tag, count] of Object.entries(scan.warned.tags)) {
      this.warned.tags[tag] = Math.max(this.warned.tags[tag] ?? 0, count);
    }
    this.warned.dataSrc = Math.max(this.warned.dataSrc, scan.warned.dataSrc);
  }

  private tryScanHtml(): HtmlScan | undefined {
    try {
      return HiddenHtmlScanner.scan(this.html, this.provenance);
    } catch (error) {
      if (error instanceof CssSelectorLimitError) throw error;
      return undefined;
    }
  }
}

function removeRanges(
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
