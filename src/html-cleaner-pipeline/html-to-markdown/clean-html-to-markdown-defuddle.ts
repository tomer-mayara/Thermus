import { sanitize } from 'agent-input-sanitizer';
import { Defuddle } from 'defuddle/node';
import { type DOMParser, NodeFilter, parseHTML } from 'linkedom';
import { type Ctx } from '../html-to-markdown-pipeline.ts';
import { type CleanHtmlToMarkdown } from './clean-html-to-markdown.ts';

type HtmlDocument = ReturnType<DOMParser['parseFromString']>;
type HtmlText = ReturnType<HtmlDocument['createTextNode']>;
type HtmlElement = ReturnType<HtmlDocument['createElement']>;

export class CleanHtmlToMarkdownDefuddle implements CleanHtmlToMarkdown {
  public async invoke(ctx: Ctx): Promise<Ctx> {
    const detected = new Set<string>();
    const notices = new Set<string>();
    const sanitizeText = async (text: string): Promise<string> => {
      const result = await sanitize(text);
      for (const category of result.found) detected.add(category);
      for (const warning of result.warnings) notices.add(warning);
      return result.cleaned;
    };

    const { document } = parseHTML(ctx.html);
    await this.sanitizeDocument(document, sanitizeText);
    const result = await Defuddle(document, ctx.url, { markdown: true, useAsync: false });
    // Defuddle returns empty strings for missing content and titles.
    const [markdown, title] = await Promise.all([
      sanitizeText(result.content),
      sanitizeText(result.title),
    ]);
    const found = [...detected]
      .filter((category) => !ctx.found?.includes(category));
    const warnings = [...notices]
      .filter((warning) => !ctx.warnings?.includes(warning));

    return {
      ...ctx,
      markdown,
      title,
      skipped: ctx.skipped + found.length,
      found: [...(ctx.found ?? []), ...found],
      warnings: [...(ctx.warnings ?? []), ...warnings],
    };
  }

  private async sanitizeDocument(
    document: HtmlDocument,
    sanitizeText: (text: string) => Promise<string>,
  ): Promise<void> {
    // Entity decoding can split a valid joiner sequence across adjacent text nodes.
    document.normalize();
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (node.nodeType === node.TEXT_NODE) {
        const text = node as HtmlText;
        // A BOM in a DOM field is inside the HTML input, not at its start.
        text.data = (await sanitizeText(` ${text.data}`)).slice(1);
      } else {
        const element = node as HtmlElement;
        for (const attribute of element.attributes) {
          attribute.value = (await sanitizeText(` ${attribute.value}`)).slice(1);
        }
      }
    }
  }
}
