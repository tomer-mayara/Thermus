import { Defuddle } from 'defuddle/node';
import { parseHTML } from 'linkedom';
import { type Ctx } from '../html-to-markdown-pipeline.ts';
import { type CleanHtmlToMarkdown } from './clean-html-to-markdown.ts';

export class CleanHtmlToMarkdownDefuddle implements CleanHtmlToMarkdown {
  public async invoke(ctx: Ctx): Promise<Ctx> {
    const { document } = parseHTML(ctx.html);
    const result = await Defuddle(document, ctx.url, { markdown: true });
    return {
      ...ctx,
      markdown: result.content ?? '',
      title: result.title ?? null,
    };
  }
}
