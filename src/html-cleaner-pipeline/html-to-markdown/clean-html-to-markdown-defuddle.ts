import { Defuddle } from 'defuddle/node';
import { parseHTML } from 'linkedom';
import { type CleanHtmlToMarkdown } from './clean-html-to-markdown.ts';

export class CleanHtmlToMarkdownDefuddle implements CleanHtmlToMarkdown {
  public async invoke(html: string): Promise<string> {
    const { document } = parseHTML(html);
    const result = await Defuddle(document, undefined, { markdown: true });
    return result.content ?? '';
  }
}
