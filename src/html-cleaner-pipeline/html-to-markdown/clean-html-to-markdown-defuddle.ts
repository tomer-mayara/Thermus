import { Defuddle } from 'defuddle/node';
import { parseHTML } from 'linkedom';
import { type Ctx } from '../html-to-markdown-pipeline.ts';
import { type CleanHtmlToMarkdown } from './clean-html-to-markdown.ts';

type HtmlDocument = ReturnType<typeof parseHTML>['document'];

export class CleanHtmlToMarkdownDefuddle implements CleanHtmlToMarkdown {
  public async invoke(ctx: Ctx): Promise<Ctx> {
    const { document } = parseHTML(ctx.html);
    const isFragment = document.documentElement?.localName !== 'html' || !document.querySelector('body');
    CleanHtmlToMarkdownDefuddle.normalizeDocument(document);
    if (isFragment) {
      CleanHtmlToMarkdownDefuddle.preserveFragmentHeadings(document);
    }

    const result = await Defuddle(document, ctx.url, {
      markdown: true,
      useAsync: false,
      standardize: !isFragment,
      removeContentPatterns: !isFragment,
    });
    return {
      ...ctx,
      markdown: result.content ?? '',
      title: result.title ?? null,
    };
  }

  private static ensureDocumentRoot(document: HtmlDocument): void {
    if (document.documentElement?.localName !== 'html') {
      const nodes = [...document.childNodes];
      const root = document.createElement('html');
      document.appendChild(root);
      for (const node of nodes) {
        if (node.nodeType !== document.DOCUMENT_TYPE_NODE) {
          root.appendChild(node);
        }
      }
    }
  }

  private static normalizeDocument(document: HtmlDocument): void {
    CleanHtmlToMarkdownDefuddle.ensureDocumentRoot(document);
    const head = document.head;
    const body = document.body;
    for (const node of [...document.documentElement.childNodes]) {
      if (node === head || node === body) {
        continue;
      }
      if (node.nodeName === 'HEAD' || node.nodeName === 'BODY') {
        const target = node.nodeName === 'HEAD' ? head : body;
        for (const child of [...node.childNodes]) {
          target.appendChild(child);
        }
        node.remove();
      } else if (['TITLE', 'META', 'LINK', 'BASE', 'STYLE'].includes(node.nodeName)) {
        head.appendChild(node);
      } else {
        body.appendChild(node);
      }
    }
  }

  private static preserveFragmentHeadings(document: HtmlDocument): void {
    const heading = document.body.querySelector('h1');
    if (heading && !document.querySelector('title')) {
      document.title = heading.textContent?.trim() ?? '';
    }
    // Defuddle removes a leading h1 from Markdown. Keep fragment headings as h2.
    for (const heading of document.body.querySelectorAll('h1')) {
      const replacement = document.createElement('h2');
      for (const attribute of heading.attributes) {
        replacement.setAttribute(attribute.name, attribute.value);
      }
      replacement.append(...heading.childNodes);
      heading.replaceWith(replacement);
    }
  }
}
