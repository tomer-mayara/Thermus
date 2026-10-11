import { applyLayer1, sanitize } from 'agent-input-sanitizer';
import { Defuddle } from 'defuddle/node';
import { type Ctx } from '../html-to-markdown-pipeline.ts';
import { type CleanHtmlToMarkdown } from './clean-html-to-markdown.ts';
import { plainTextMarkdown } from './plain-text-input.ts';
import { prepareHtmlDocument } from './prepare-html-document.ts';
import { sanitizeHtmlDocument, type SanitizeText } from './sanitize-html-document.ts';

export class CleanHtmlToMarkdownDefuddle implements CleanHtmlToMarkdown {
  public async invoke(ctx: Ctx): Promise<Ctx> {
    if (/^[\t\n\f\r ]*$/.test(ctx.html)) {
      return {
        ...ctx, markdown: '', title: null,
        ...(ctx.found && { found: [...new Set(ctx.found)] }),
        ...(ctx.warnings && { warnings: [...new Set(ctx.warnings)] }),
      };
    }
    const reports: ReturnType<typeof sanitize>[] = [];
    const sanitizeText: SanitizeText = (text, onDelete) => {
      // DOM fields are inside the HTML input, so a leading BOM is not a file BOM.
      const input = ' ' + text;
      const { cleaned } = applyLayer1(input, onDelete);
      if (!cleaned.startsWith(' ')) {
        throw new Error('Sanitizer changed the text boundary prefix');
      }
      if (cleaned !== input) reports.push(sanitize(input));
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

  private async convertHtml(ctx: Ctx, sanitizeText: SanitizeText): Promise<{ content: string; title: string }> {
    const prepared = prepareHtmlDocument(ctx.html, ctx.finalUrl, (document) => {
      sanitizeHtmlDocument(document, sanitizeText);
    });
    const result = await Defuddle(prepared.document, prepared.extractionUrl, {
      markdown: true,
      useAsync: false,
      processExtractedDom: (root) => sanitizeHtmlDocument(root, sanitizeText),
      ...prepared.options,
    });
    return {
      content: prepared.finishMarkdown(result.content ?? ''),
      title: result.title ?? '',
    };
  }
}
