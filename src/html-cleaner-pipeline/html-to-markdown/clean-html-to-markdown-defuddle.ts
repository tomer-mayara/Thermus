import { sanitize } from 'agent-input-sanitizer';
import { Defuddle } from 'defuddle/node';
import { parseHTML } from 'linkedom';
import { type Ctx } from '../html-to-markdown-pipeline.ts';
import { type CleanHtmlToMarkdown } from './clean-html-to-markdown.ts';

export class CleanHtmlToMarkdownDefuddle implements CleanHtmlToMarkdown {
  public async invoke(ctx: Ctx): Promise<Ctx> {
    const { document } = parseHTML(ctx.html);
    const result = await Defuddle(document, ctx.url, { markdown: true, useAsync: false });
    // Defuddle returns empty strings for missing content and titles.
    const [markdown, title] = await Promise.all([
      sanitize(result.content),
      sanitize(result.title),
    ]);
    const found = [...new Set([...markdown.found, ...title.found])]
      .filter((category) => !ctx.found?.includes(category));
    const warnings = [...new Set([...markdown.warnings, ...title.warnings])]
      .filter((warning) => !ctx.warnings?.includes(warning));

    return {
      ...ctx,
      markdown: markdown.cleaned,
      title: title.cleaned,
      skipped: ctx.skipped + found.length,
      found: [...(ctx.found ?? []), ...found],
      warnings: [...(ctx.warnings ?? []), ...warnings],
    };
  }
}
