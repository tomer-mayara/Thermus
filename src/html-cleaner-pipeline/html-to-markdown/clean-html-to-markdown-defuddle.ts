import { Defuddle } from 'defuddle/node';
import { parseHTML } from 'linkedom';
import { type Ctx } from '../html-to-markdown-pipeline.ts';
import { type CleanHtmlToMarkdown } from './clean-html-to-markdown.ts';

export class CleanHtmlToMarkdownDefuddle implements CleanHtmlToMarkdown {
  public async invoke(ctx: Ctx): Promise<Ctx> {
    if (/^[\t\n\f\r ]*$/.test(ctx.html)) {
      return { ...ctx, markdown: '', title: null };
    }
    const { document } = parseHTML(ctx.html);
    const result = await Defuddle(document, ctx.finalUrl, { markdown: true, useAsync: false });
    return {
      ...ctx,
      markdown: result.content ?? '',
      title: result.title ?? null,
    };
  }
}
