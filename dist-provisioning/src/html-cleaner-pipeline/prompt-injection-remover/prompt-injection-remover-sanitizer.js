import { CATEGORY, sanitize } from 'agent-input-sanitizer';
import { describeRemoved, describeWarned } from 'agent-input-sanitizer/output';
import { HiddenHtmlRemovalSession } from './hidden-html-removal-session.js';
import { sanitizeHtmlControls } from './sanitize-html-controls.js';
import { SmallTextPolicy } from './small-text-policy.js';
export class PromptInjectionRemoverSanitizer {
    static maxHtmlBytes = 10 * 1024 * 1024;
    smallText;
    constructor(options = {}) {
        this.smallText = new SmallTextPolicy(options);
    }
    async invoke(ctx) {
        if (Buffer.byteLength(ctx.html, 'utf8') > PromptInjectionRemoverSanitizer.maxHtmlBytes) {
            throw new RangeError('HTML input exceeds the 10 MiB limit');
        }
        const sanitized = await sanitizeHtmlControls(ctx.html, this.smallText);
        const result = new HiddenHtmlRemovalSession(sanitized.cleaned, this.smallText).run();
        const styleReports = await Promise.all([...new Set(result.visibleStyleValues)].map((value) => sanitize(` ${value}`)));
        const found = new Set([...sanitized.found, ...styleReports.flatMap((report) => report.found)]);
        const warnings = new Set([...sanitized.warnings, ...styleReports.flatMap((report) => report.warnings)]);
        if (result.removed.comments > 0)
            found.add(CATEGORY.HTML_COMMENTS);
        if (result.removed.hidden > 0)
            found.add(CATEGORY.HIDDEN_HTML);
        const removed = describeRemoved(result.removed);
        if (removed)
            warnings.add(`HTML sanitized: ${removed} removed`);
        const preserved = describeWarned(result.warned);
        if (preserved)
            warnings.add(preserved);
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
            removed: ctx.removed + result.removed.comments + result.removed.hidden,
            found: [...new Set([...(ctx.found ?? []), ...found])],
            warnings: [...new Set([...(ctx.warnings ?? []), ...warnings])],
        };
    }
}
//# sourceMappingURL=prompt-injection-remover-sanitizer.js.map