import { Defuddle } from 'defuddle/node';
import { parseHTML } from 'linkedom';
import { type Ctx } from '../html-to-markdown-pipeline.ts';
import { type CleanHtmlToMarkdown } from './clean-html-to-markdown.ts';

type HtmlDocument = ReturnType<typeof parseHTML>['document'];
const headElements = new Set(['TITLE', 'META', 'LINK', 'BASE', 'STYLE', 'SCRIPT', 'NOSCRIPT', 'TEMPLATE']);

export class CleanHtmlToMarkdownDefuddle implements CleanHtmlToMarkdown {
  public async invoke(ctx: Ctx): Promise<Ctx> {
    const { document } = parseHTML(ctx.html);
    const isFragment = document.documentElement?.localName !== 'html' || !document.querySelector('body');
    CleanHtmlToMarkdownDefuddle.normalizeDocument(document);
    const preserveSuppliedContent = isFragment || !CleanHtmlToMarkdownDefuddle.hasBodyContent(document);
    if (preserveSuppliedContent) {
      CleanHtmlToMarkdownDefuddle.preserveFragmentHeadings(document);
      CleanHtmlToMarkdownDefuddle.normalizeFragmentCode(document);
      CleanHtmlToMarkdownDefuddle.prepareLocalExtraction(document, ctx.url);
    }

    const result = await Defuddle(document, preserveSuppliedContent ? 'about:blank' : ctx.url, {
      markdown: true,
      useAsync: false,
      standardize: !preserveSuppliedContent,
      removeContentPatterns: !preserveSuppliedContent,
      removeExactSelectors: !preserveSuppliedContent,
      removePartialSelectors: !preserveSuppliedContent,
      removeLowScoring: !preserveSuppliedContent,
      contentSelector: preserveSuppliedContent ? 'body' : undefined,
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
    // LinkeDOM inserts missing head and body elements through these getters after the root exists.
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
      } else if (headElements.has(node.nodeName)) {
        head.appendChild(node);
      } else {
        body.appendChild(node);
      }
    }
    CleanHtmlToMarkdownDefuddle.moveImpliedBodyContent(document);
  }

  private static moveImpliedBodyContent(document: HtmlDocument): void {
    const firstBodyNode = document.body.firstChild;
    let bodyStarted = false;
    // LinkeDOM keeps body content in head when the head end tag is omitted.
    for (const node of [...document.head.childNodes]) {
      const isBodyText = node.nodeType === document.TEXT_NODE && Boolean(node.textContent?.trim());
      const isBodyElement = node.nodeType === document.ELEMENT_NODE && !headElements.has(node.nodeName);
      bodyStarted ||= isBodyText || isBodyElement;
      if (bodyStarted) {
        document.body.insertBefore(node, firstBodyNode);
      }
    }
  }

  private static hasBodyContent(document: HtmlDocument): boolean {
    const body = document.body.cloneNode(true) as HtmlDocument['body'];
    for (const node of body.querySelectorAll('script, style, noscript, template')) {
      node.remove();
    }
    return Boolean(body.textContent?.trim() || body.querySelector('img, picture, video, audio, iframe, svg, math, hr'));
  }

  private static prepareLocalExtraction(document: HtmlDocument, url: string): void {
    // Defuddle 0.19.4 has no option to disable synchronous site extractors.
    // A neutral extraction URL keeps them inactive. Keep the page URL for metadata.
    Object.defineProperty(document, 'URL', { value: url, configurable: true });
    const base = document.head.querySelector('base[href]') ?? document.createElement('base');
    let baseUrl = url;
    try {
      baseUrl = new URL(base.getAttribute('href') || url, url).href;
    } catch {
      baseUrl = url;
    }
    base.setAttribute('href', baseUrl);
    if (!base.parentNode) {
      document.head.appendChild(base);
    }
    // The generic BBCode extractor reads replacement content from this attribute.
    document.querySelector('#application_config')?.removeAttribute('data-partnereventstore');
    // Schema articleBody can replace visible text even when site extractors are inactive.
    for (const script of document.querySelectorAll('script')) {
      script.remove();
    }
  }

  private static normalizeFragmentCode(document: HtmlDocument): void {
    for (const code of document.body.querySelectorAll('code')) {
      const preservesWhitespace = /(?:^|;)\s*white-space\s*:\s*(?:pre(?:-wrap)?|break-spaces)(?:\s*!important)?\s*(?:;|$)/i.test(code.getAttribute('style') ?? '');
      if (!code.closest('pre') && preservesWhitespace) {
        const pre = document.createElement('pre');
        code.replaceWith(pre);
        pre.appendChild(code);
      }
    }
    // Defuddle's Markdown converter requires a code child to make a fenced block.
    for (const pre of document.body.querySelectorAll('pre')) {
      const innerCode = pre.querySelector('code');
      if (pre.childNodes.length === 1 && pre.firstChild === innerCode) {
        continue;
      }
      const code = innerCode ? innerCode.cloneNode(false) : document.createElement('code');
      for (const child of pre.querySelectorAll('code')) {
        child.replaceWith(...child.childNodes);
      }
      code.append(...pre.childNodes);
      pre.appendChild(code);
    }
  }

  private static preserveFragmentHeadings(document: HtmlDocument): void {
    const firstHeading = document.body.querySelector('h1');
    if (firstHeading && !document.querySelector('title')) {
      document.title = firstHeading.textContent?.trim() ?? '';
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
