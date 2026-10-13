import { applyLayer1, sanitize } from 'agent-input-sanitizer';
import {} from '../html-to-markdown-pipeline.js';
import {} from './clean-html-to-markdown.js';
import { plainTextMarkdown } from './plain-text-input.js';
import { PreparedHtmlDocument } from './prepare-html-document.js';
import {} from './sanitize-html-document.js';
export class CleanHtmlToMarkdownDefuddle {
    async invoke(ctx) {
        if (/^[\t\n\f\r ]*$/.test(ctx.html)) {
            return {
                ...ctx, markdown: '', title: null,
                ...(ctx.found && { found: [...new Set(ctx.found)] }),
                ...(ctx.warnings && { warnings: [...new Set(ctx.warnings)] }),
            };
        }
        const reports = [];
        const sanitizeText = (text, onDelete) => {
            // DOM fields are inside the HTML input, so a leading BOM is not a file BOM.
            const input = ' ' + text;
            const { cleaned } = applyLayer1(input, onDelete);
            if (!cleaned.startsWith(' ')) {
                throw new Error('Sanitizer changed the text boundary prefix');
            }
            if (cleaned !== input)
                reports.push(sanitize(input));
            return cleaned.slice(1);
        };
        const plainMarkdown = plainTextMarkdown(ctx.html, sanitizeText);
        const result = plainMarkdown === undefined
            ? await this.convertHtml(ctx, sanitizeText)
            : { content: plainMarkdown, title: '' };
        const [markdown, title, ...decodedReports] = await Promise.all([
            sanitize(result.content),
            sanitize(result.title),
            ...reports,
        ]);
        const allReports = [...decodedReports, markdown, title];
        const detected = new Set(allReports.flatMap((report) => report.found));
        const notices = new Set(allReports.flatMap((report) => report.warnings));
        return {
            ...ctx,
            markdown: markdown.cleaned,
            title: title.cleaned,
            found: [...new Set([...(ctx.found ?? []), ...detected])],
            warnings: [...new Set([...(ctx.warnings ?? []), ...notices])],
        };
    }
    async convertHtml(ctx, sanitizeText) {
        return PreparedHtmlDocument.fromHtml(ctx.html, ctx.finalUrl).extract(sanitizeText);
    }
}
//# sourceMappingURL=clean-html-to-markdown-defuddle.js.map