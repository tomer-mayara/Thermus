import { detectExfil } from 'agent-input-sanitizer/html';
import { HiddenHtmlScanner } from './hidden-html-scanner.js';
import { CssSelectorLimitError } from './css-visibility-selectors.js';
import { CssVisibilityProvenance } from './css-visibility-provenance.js';
import { SmallTextPolicy } from './small-text-policy.js';
export class HiddenHtmlRemovalSession {
    html;
    smallText;
    static maxHtmlScans = 8;
    provenance = new CssVisibilityProvenance();
    removed = { comments: 0, hidden: 0 };
    warned = { tags: {}, dataSrc: 0 };
    exfilReasons = new Set();
    visibleStyleValues = [];
    scanCount = 0;
    constructor(html, smallText = new SmallTextPolicy()) {
        this.html = html;
        this.smallText = smallText;
    }
    run() {
        for (; this.scanCount < HiddenHtmlRemovalSession.maxHtmlScans; this.scanCount++) {
            for (const threat of detectExfil(this.html) ?? []) {
                this.exfilReasons.add(`${threat.isImage ? 'image' : 'link'} to ${threat.target}: ${threat.reason}`);
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
    result(html, withholdWarning) {
        return {
            html,
            removed: this.removed,
            warned: this.warned,
            exfilReasons: this.exfilReasons,
            visibleStyleValues: this.visibleStyleValues,
            withholdWarning,
        };
    }
    recordScanWarnings(scan) {
        for (const threat of detectExfil(scan.urlSource) ?? []) {
            this.exfilReasons.add(`${threat.isImage ? 'image' : 'link'} to ${threat.target}: ${threat.reason}`);
        }
        // Keep the largest count for each reason. A new scan can see the same tag.
        for (const [tag, count] of Object.entries(scan.warned.tags)) {
            this.warned.tags[tag] = Math.max(this.warned.tags[tag] ?? 0, count);
        }
        this.warned.dataSrc = Math.max(this.warned.dataSrc, scan.warned.dataSrc);
    }
    tryScanHtml() {
        try {
            return HiddenHtmlScanner.scan(this.html, this.provenance, { smallText: this.smallText });
        }
        catch (error) {
            if (error instanceof CssSelectorLimitError)
                throw error;
            return undefined;
        }
    }
}
function removeRanges(text, ranges, replacement = '') {
    const parts = [];
    let cursor = 0;
    for (const range of ranges.sort((left, right) => left.start - right.start)) {
        if (range.start >= cursor)
            parts.push(text.slice(cursor, range.start), replacement);
        cursor = Math.max(cursor, range.end);
    }
    parts.push(text.slice(cursor));
    return parts.join('');
}
//# sourceMappingURL=hidden-html-removal-session.js.map